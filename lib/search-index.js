/**
 * Public URLs, sitemap XML, and IndexNow pings for The Daily Pulse.
 * The IndexNow key is public, but it is read from INDEXNOW_KEY and never logged.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

export const SITE_HOST = 'thedailypulse.space';
export const SITE_ORIGIN = `https://${SITE_HOST}`;
export const PUBLICATION_NAME = 'The Daily Pulse';
export const PUBLICATION_LANGUAGE = 'en';
export const PRIVACY_LASTMOD = '2025-11-01';
export const HOMEPAGE_COPY_UPDATED = '2026-10-25T00:00:00Z';
export const NEWS_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 15 * 60 * 1000;
const INDEXNOW_RECENT_MS = 60 * 60 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

let seenStoryIds = null;

export function resetSearchIndexState() {
  seenStoryIds = null;
}

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function storyId(link) {
  return createHash('sha256').update(String(link)).digest('hex').slice(0, 20);
}

export function storyUrl(link) {
  return `${SITE_ORIGIN}/stories/${storyId(link)}`;
}

export function publishedAt(story) {
  const timestamp = Date.parse(story?.pubDate || '');
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function formatLastmod(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const timestamp = typeof value === 'number' ? value : Date.parse(value || '');
  if (Number.isNaN(timestamp)) return '';
  return new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function usablePublishedAt(story, now) {
  const timestamp = publishedAt(story);
  if (timestamp === null || timestamp > now + FUTURE_SKEW_MS) return null;
  return timestamp;
}

export function sitemapEntries(stories, now = Date.now()) {
  const published = [Date.parse(HOMEPAGE_COPY_UPDATED)];
  for (const story of stories || []) {
    const timestamp = usablePublishedAt(story, now);
    if (timestamp !== null) published.push(timestamp);
  }
  const current = published.filter((timestamp) => timestamp <= now + FUTURE_SKEW_MS);
  const homepageLastmod = current.length ? formatLastmod(Math.max(...current)) : '';

  const pages = [
    {
      loc: `${SITE_ORIGIN}/`,
      lastmod: homepageLastmod,
      changefreq: 'hourly',
      priority: '1.0',
    },
    {
      loc: `${SITE_ORIGIN}/privacy.html`,
      lastmod: PRIVACY_LASTMOD,
      changefreq: 'monthly',
      priority: '0.3',
    },
  ];

  const articles = [...(stories || [])]
    .filter((story) => story?.link && story?.title)
    .sort((a, b) => (publishedAt(b) || 0) - (publishedAt(a) || 0))
    .map((story) => {
      const timestamp = usablePublishedAt(story, now);
      return {
        loc: storyUrl(story.link),
        lastmod: timestamp === null ? '' : formatLastmod(timestamp),
        changefreq: 'daily',
        priority: '0.6',
      };
    });

  return dedupe(pages.concat(articles)).slice(0, 50000);
}

export function newsEntries(stories, now = Date.now()) {
  return [...(stories || [])]
    .filter((story) => {
      const timestamp = publishedAt(story);
      if (!story?.title || !story?.link || timestamp === null) return false;
      return timestamp >= now - NEWS_MAX_AGE_MS && timestamp <= now + FUTURE_SKEW_MS;
    })
    .sort((a, b) => publishedAt(b) - publishedAt(a))
    .slice(0, 1000)
    .map((story) => ({
      loc: storyUrl(story.link),
      title: story.title,
      publicationDate: formatLastmod(publishedAt(story)),
      publicationName: PUBLICATION_NAME,
      language: PUBLICATION_LANGUAGE,
    }));
}

function dedupe(entries) {
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    if (!entry.loc || seen.has(entry.loc)) continue;
    seen.add(entry.loc);
    result.push(entry);
  }
  return result;
}

function urlElement(entry) {
  const lines = ['  <url>', `    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
  if (entry.changefreq) lines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
  if (entry.priority) lines.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
  lines.push('  </url>');
  return lines.join('\n');
}

function newsElement(entry) {
  return [
    '  <url>',
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    '    <news:news>',
    '      <news:publication>',
    `        <news:name>${escapeXml(entry.publicationName)}</news:name>`,
    `        <news:language>${escapeXml(entry.language)}</news:language>`,
    '      </news:publication>',
    `      <news:publication_date>${escapeXml(entry.publicationDate)}</news:publication_date>`,
    `      <news:title>${escapeXml(entry.title)}</news:title>`,
    '    </news:news>',
    '  </url>',
  ].join('\n');
}

export function renderSitemap(stories, now = Date.now()) {
  const body = sitemapEntries(stories, now).map(urlElement).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function renderNewsSitemap(stories, now = Date.now()) {
  const entries = newsEntries(stories, now);
  const body = entries.map(newsElement).join('\n');
  const inner = body ? `\n${body}\n` : '\n';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${inner}</urlset>\n`;
}

export function xmlResponse(body) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=900, stale-while-revalidate=120',
      'X-Content-Type-Options': 'nosniff',
    },
    body,
  };
}

export function readIndexNowKey(env = process.env) {
  const key = String(env?.INDEXNOW_KEY || '').trim();
  return KEY_PATTERN.test(key) ? key : '';
}

export function indexNowUrls(stories) {
  const urls = [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/privacy.html`];
  for (const story of stories || []) {
    if (story?.link && story?.title) urls.push(storyUrl(story.link));
  }
  return urls;
}

export function normalizeIndexNowUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' || url.hostname !== SITE_HOST) return '';
    url.hash = '';
    url.username = '';
    url.password = '';
    return url.href;
  } catch {
    return '';
  }
}

export async function pingIndexNow(urls, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    env = process.env,
    log = console,
    timeoutMs = 2500,
    warnIfMissing = false,
  } = options;
  const key = readIndexNowKey(env);
  const list = [];
  const seen = new Set();
  for (const url of urls || []) {
    const normalized = normalizeIndexNowUrl(url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    list.push(normalized);
    if (list.length === 10000) break;
  }
  if (!key) {
    if (warnIfMissing) log.warn?.('IndexNow skipped: INDEXNOW_KEY is not set');
    return { skipped: true, reason: 'missing-key', count: 0 };
  }
  if (!list.length) return { skipped: true, reason: 'no-urls', count: 0 };
  try {
    const response = await fetchImpl('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: SITE_HOST,
        key,
        keyLocation: `${SITE_ORIGIN}/${key}.txt`,
        urlList: list,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    (log.info || log.log)?.call(log, `IndexNow ping status ${response.status} for ${list.length} urls`);
    return { skipped: false, status: response.status, count: list.length };
  } catch {
    log.warn?.('IndexNow ping failed');
    return { skipped: true, reason: 'error', count: list.length };
  }
}

export async function noteFreshStories(stories, options = {}) {
  const now = options.now ?? Date.now();
  const recentWindowMs = options.recentWindowMs ?? INDEXNOW_RECENT_MS;
  const ping = options.ping || ((urls) => pingIndexNow(urls, options));
  const ids = new Set();
  const fresh = [];
  for (const story of stories || []) {
    if (!story?.link || !story?.title) continue;
    const id = storyId(story.link);
    if (ids.has(id)) continue;
    const timestamp = publishedAt(story);
    const recent = timestamp !== null
      && timestamp >= now - recentWindowMs
      && timestamp <= now + FUTURE_SKEW_MS;
    const isNew = seenStoryIds === null ? recent : !seenStoryIds.has(id);
    ids.add(id);
    if (isNew) fresh.push(storyUrl(story.link));
  }
  const hadBaseline = seenStoryIds !== null;
  seenStoryIds = ids;
  if (!fresh.length) {
    return { skipped: true, reason: hadBaseline ? 'unchanged' : 'baseline', count: 0 };
  }
  return ping(fresh);
}

export async function writeIndexNowKeyFile(directory, env = process.env) {
  const key = readIndexNowKey(env);
  if (!key) return { written: false };
  await writeFile(new URL(`${key}.txt`, directory), key);
  return { written: true };
}

export function normalizeKeyFile(value) {
  const segment = String(value || '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';
  if (segment === 'indexnow-key') return '';
  if (/^[A-Za-z0-9-]{8,128}\.txt$/.test(segment)) return segment;
  if (KEY_PATTERN.test(segment)) return `${segment}.txt`;
  return '';
}

export function indexNowFileCandidates(event) {
  const sources = [
    event?.queryStringParameters?.file,
    event?.rawUrl,
    event?.path,
  ];
  const files = [];
  for (const source of sources) {
    const file = normalizeKeyFile(source);
    if (file && !files.includes(file)) files.push(file);
  }
  return files;
}

export function sameKeyFile(requested, key) {
  const expected = Buffer.from(`${key}.txt`);
  const actual = Buffer.from(String(requested || ''));
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function storyIdFromEvent(event) {
  const sources = [
    event?.queryStringParameters?.id,
    event?.rawUrl,
    event?.path,
  ];
  for (const source of sources) {
    const text = String(source || '');
    if (/^[a-f0-9]{20}$/.test(text)) return text;
    const match = text.match(/\/stories\/([a-f0-9]{20})(?:[/?#]|$)/);
    if (match) return match[1];
  }
  return '';
}

export function findStory(stories, id) {
  if (!/^[a-f0-9]{20}$/.test(id || '')) return null;
  return (stories || []).find((story) => story?.link && storyId(story.link) === id) || null;
}
