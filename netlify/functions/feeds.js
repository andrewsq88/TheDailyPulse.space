/**
 * Same-origin RSS aggregator. Feed URLs are a fixed allowlist so the browser
 * never chooses what the server fetches. Responses are cached for 12 minutes
 * in a warm instance and for 15 minutes on Netlify's CDN.
 */
import { noteFreshStories, resetSearchIndexState } from '../../lib/search-index.js';

const CACHE_TTL_MS = 12 * 60 * 1000;
const CDN_MAX_AGE_SECONDS = 900;
const BROWSER_MAX_AGE_SECONDS = 600;
const PER_FEED_LIMIT = 15;
export const EXCERPT_MAX = 300;
const REQUEST_TIMEOUT_MS = 12000;
const USER_AGENT = 'TheDailyPulse/1.0 (+https://www.thedailypulse.space)';

// The homepage originally requested FeedBurner's TechCrunch URL and
// finance.yahoo.com/news/rssindex. FeedBurner now serves an unrelated feed
// titled "Crunch Hype", and the Yahoo path returns 404. These are the current
// feeds for the same publications.
export const FEEDS = Object.freeze([
  { category: 'tech', fallbackName: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { category: 'tech', fallbackName: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { category: 'finance', fallbackName: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  {
    category: 'finance',
    fallbackName: 'Yahoo Finance',
    url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US',
  },
  { category: 'world', fallbackName: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { category: 'world', fallbackName: 'NYT World News', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
]);

const CATEGORIES = new Set(['all', 'tech', 'finance', 'world']);

let cache = { expiresAt: 0, stories: null, updatedAt: null, warnings: [] };

export function resetFeedCache() {
  cache = { expiresAt: 0, stories: null, updatedAt: null, warnings: [] };
  resetSearchIndexState();
}

export function decodeEntities(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

export function plainText(value) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanHttpUrl(value) {
  const decoded = decodeEntities(value).trim();
  if (!decoded) return '';
  try {
    const url = new URL(decoded);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch {
    return '';
  }
}

function tagText(block, name) {
  const match = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? match[1].trim() : '';
}

function itemLink(block) {
  const textLink = cleanHttpUrl(plainText(tagText(block, 'link')));
  if (textLink) return textLink;

  const tags = block.match(/<link\b[^>]*>/gi) || [];
  let fallback = '';
  for (const tag of tags) {
    const href = /href="([^"]+)"/i.exec(tag);
    if (!href) continue;
    const url = cleanHttpUrl(href[1]);
    if (!url) continue;
    const rel = /rel="([^"]+)"/i.exec(tag);
    if (!rel || /(^|\s)alternate(\s|$)/i.test(rel[1])) return url;
    if (!fallback) fallback = url;
  }
  return fallback;
}

function itemImage(block) {
  const patterns = [
    /<media:thumbnail\b[^>]*\burl="([^"]+)"/i,
    /<media:content\b[^>]*\burl="([^"]+)"/i,
    /<enclosure\b[^>]*\burl="([^"]+)"/i,
    /<img\b[^>]*\bsrc="([^"]+)"/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(block);
    if (!match) continue;
    const url = cleanHttpUrl(match[1]);
    if (url) return url;
  }
  return '';
}

export function excerptText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= EXCERPT_MAX) return text;
  let cut = text.slice(0, EXCERPT_MAX - 1).trimEnd();
  const space = cut.lastIndexOf(' ');
  if (space >= 240) cut = cut.slice(0, space).trimEnd();
  cut = cut.replace(/[.,;:!?]+$/, '');
  return `${cut}…`;
}

function blocksOf(xml, tagName) {
  const matches = xml.match(new RegExp(`<${tagName}\\b[\\s\\S]*?</${tagName}>`, 'gi')) || [];
  return matches;
}

export function parseFeedXml(xml, meta) {
  const source = String(xml || '');
  const head = source.split(/<item\b|<entry\b/i)[0] || '';
  const sourceName = plainText(tagText(head, 'title')) || meta.fallbackName;
  const blocks = blocksOf(source, 'item').concat(blocksOf(source, 'entry')).slice(0, PER_FEED_LIMIT);
  const stories = [];

  for (const block of blocks) {
    const title = plainText(tagText(block, 'title'));
    const link = itemLink(block);
    if (!title || !link) continue;
    const published = tagText(block, 'pubDate') || tagText(block, 'published') || tagText(block, 'updated');
    const timestamp = Date.parse(plainText(published));
    // RSS description or Atom summary only. Never content or content:encoded.
    const description = excerptText(plainText(tagText(block, 'description') || tagText(block, 'summary')));
    stories.push({
      title,
      link,
      description,
      pubDate: Number.isNaN(timestamp) ? '' : new Date(timestamp).toISOString(),
      timestamp: Number.isNaN(timestamp) ? 0 : timestamp,
      thumbnail: itemImage(block),
      sourceName,
      category: meta.category,
    });
  }

  return stories;
}

async function fetchFeed(feed, fetchImpl) {
  const response = await fetchImpl(feed.url, {
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${feed.fallbackName} returned ${response.status}`);
  }
  const xml = await response.text();
  return parseFeedXml(xml, feed);
}

function withoutTimestamp(story) {
  const copy = { ...story };
  delete copy.timestamp;
  return copy;
}

export async function getStories({ fetchImpl = globalThis.fetch, now = Date.now(), ttlMs = CACHE_TTL_MS } = {}) {
  if (cache.stories && now < cache.expiresAt) {
    return {
      stories: cache.stories,
      updatedAt: cache.updatedAt,
      warnings: cache.warnings,
      cache: 'memory',
    };
  }

  const settled = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const stories = await fetchFeed(feed, fetchImpl);
        return { feed, stories };
      } catch (error) {
        return { feed, error: error instanceof Error ? error.message : 'fetch failed' };
      }
    }),
  );

  const stories = [];
  const warnings = [];
  for (const result of settled) {
    if (result.stories) {
      stories.push(...result.stories);
    } else {
      warnings.push({ source: result.feed.fallbackName, category: result.feed.category });
    }
  }

  stories.sort((a, b) => b.timestamp - a.timestamp);
  const seen = new Set();
  const unique = [];
  for (const story of stories) {
    if (seen.has(story.link)) continue;
    seen.add(story.link);
    unique.push(withoutTimestamp(story));
  }

  if (unique.length > 0) {
    const updatedAt = new Date(now).toISOString();
    cache = { expiresAt: now + ttlMs, stories: unique, updatedAt, warnings };
    return { stories: unique, updatedAt, warnings, cache: 'fresh' };
  }

  if (cache.stories) {
    return {
      stories: cache.stories,
      updatedAt: cache.updatedAt,
      warnings: cache.warnings,
      cache: 'stale',
    };
  }

  return { stories: [], updatedAt: null, warnings, cache: 'empty' };
}

export function selectStories(stories, category) {
  if (category === 'all') return stories;
  return stories.filter((story) => story.category === category);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function storyCardsHtml(items) {
  return items.map((item) => {
    const title = escapeHtml(item.title);
    const source = escapeHtml(item.sourceName || 'News');
    const link = escapeHtml(item.link);
    const description = escapeHtml(String(item.description || '').slice(0, 120));
    const parsed = new Date(item.pubDate);
    const dateStr = Number.isNaN(parsed.getTime())
      ? ''
      : escapeHtml(parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }));
    const image = item.thumbnail
      ? escapeHtml(item.thumbnail)
      : `https://via.placeholder.com/600x300/e2e8f0/94a3b8?text=${encodeURIComponent(item.sourceName || 'News')}`;
    return `<article class="bg-white rounded-xl shadow-sm hover:shadow-xl hover:shadow-brand-100/50 transition-all duration-300 overflow-hidden border border-slate-100 hover:border-brand-200 flex flex-col group">
                    <div class="relative overflow-hidden h-48 bg-slate-200">
                        <img src="${image}" alt="${title}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.src='https://via.placeholder.com/600x300/e2e8f0/94a3b8?text=News'">
                        <div class="absolute top-2 left-2 bg-white/90 backdrop-blur text-[10px] font-bold px-2 py-1 rounded shadow text-slate-700 uppercase tracking-wide">
                            ${source}
                        </div>
                    </div>
                    <div class="p-5 flex flex-col flex-grow">
                        <div class="flex items-center text-xs text-slate-500 mb-2 font-medium">
                            <span class="text-brand-600 mr-2">● Live</span>
                            <span>${dateStr}</span>
                        </div>
                        <h3 class="font-bold text-slate-900 text-lg leading-tight mb-3 line-clamp-2 group-hover:text-brand-600 transition-colors duration-200">
                            <a href="${link}" target="_blank" rel="noopener noreferrer">${title}</a>
                        </h3>
                        <p class="text-slate-600 text-sm line-clamp-3 mb-4 flex-grow">
                            ${description}...
                        </p>
                        <a href="${link}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors mt-auto">
                            Read Article
                            <svg class="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                        </a>
                    </div>
                </article>`;
  }).join('\n');
}

export function itemListJsonLd(items) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Latest Stories',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.title,
      url: item.link,
    })),
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function jsonResponse(statusCode, body, { cacheable = false } = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheable
      ? `public, max-age=${BROWSER_MAX_AGE_SECONDS}`
      : 'no-store',
  };
  if (cacheable) {
    headers['Netlify-CDN-Cache-Control'] = `public, s-maxage=${CDN_MAX_AGE_SECONDS}, stale-while-revalidate=120`;
  }
  return { statusCode, headers, body: JSON.stringify(body) };
}

export async function handler(event) {
  const method = event?.httpMethod || 'GET';
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
  }
  if (method !== 'GET') {
    return jsonResponse(405, { status: 'error', error: 'Method not allowed' });
  }

  const category = event?.queryStringParameters?.category || 'all';
  if (!CATEGORIES.has(category)) {
    return jsonResponse(400, { status: 'error', error: 'Unknown category' });
  }

  const result = await getStories();
  if (result.cache === 'fresh' && result.stories.length) {
    try {
      await noteFreshStories(result.stories);
    } catch {
      // IndexNow must not affect the feed response.
    }
  }
  const items = selectStories(result.stories, category);
  if (!items.length && result.cache === 'empty') {
    return jsonResponse(502, { status: 'error', error: 'Unable to load feeds' });
  }

  return jsonResponse(200, {
    status: 'ok',
    category,
    updatedAt: result.updatedAt,
    cache: result.cache,
    warnings: result.warnings,
    items,
  }, { cacheable: true });
}
