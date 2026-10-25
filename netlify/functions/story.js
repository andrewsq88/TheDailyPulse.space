import { getStories } from './feeds.js';
import {
  SITE_ORIGIN,
  PUBLICATION_NAME,
  escapeHtml,
  findStory,
  formatLastmod,
  storyIdFromEvent,
  storyUrl,
} from '../../lib/search-index.js';

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function safeHttps(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol === 'https:') return url.href;
  } catch {
    return '';
  }
  return '';
}

export function renderStoryHtml(story) {
  const title = String(story.title || '');
  const source = String(story.sourceName || 'News');
  const description = String(story.description || '').trim();
  const pageUrl = storyUrl(story.link);
  const published = formatLastmod(story.pubDate);
  const dateLabel = published
    ? new Date(story.pubDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    })
    : '';
  const image = safeHttps(story.thumbnail) || `${SITE_ORIGIN}/dp-logo.jpg`;
  const outbound = /^https?:\/\//.test(String(story.link)) ? String(story.link) : '';
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    inLanguage: 'en',
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: PUBLICATION_NAME,
      url: `${SITE_ORIGIN}/`,
    },
    author: {
      '@type': 'Organization',
      name: source,
    },
  };
  if (published) structured.datePublished = published;
  if (description) structured.description = description;
  if (outbound) structured.isBasedOn = outbound;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ${escapeHtml(PUBLICATION_NAME)}</title>
  <meta name="description" content="${escapeHtml(description.slice(0, 300))}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description.slice(0, 300))}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${escapeHtml(PUBLICATION_NAME)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  ${published ? `<meta property="article:published_time" content="${escapeHtml(published)}">` : ''}
  <script type="application/ld+json">${jsonLd(structured)}</script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; font-family: Inter, sans-serif; background: #f8fafc; color: #1e293b; }
    header, main { max-width: 42rem; margin: 0 auto; padding: 1.5rem; }
    header a { color: #0f172a; font-weight: 700; text-decoration: none; display: inline-flex; gap: 0.75rem; align-items: center; }
    article h1 { font-size: 2rem; line-height: 1.25; margin: 0 0 0.75rem; }
    .byline, .note { color: #64748b; font-size: 0.95rem; }
    p { line-height: 1.6; }
    a.read { color: #be123c; font-weight: 600; }
  </style>
</head>
<body>
  <header>
    <a href="${SITE_ORIGIN}/">
      <img src="/dp-logo.jpg" alt="" width="40" height="40">
      ${escapeHtml(PUBLICATION_NAME)}
    </a>
  </header>
  <main>
    <article>
      <h1>${escapeHtml(title)}</h1>
      <p class="byline">${dateLabel ? `<time datetime="${escapeHtml(published)}">${escapeHtml(dateLabel)}</time> · ` : ''}${escapeHtml(source)}</p>
      ${description ? `<p>${escapeHtml(description)}</p>` : ''}
      ${outbound ? `<p><a class="read" href="${escapeHtml(outbound)}" rel="noopener noreferrer">Read the original at ${escapeHtml(source)}</a></p>` : ''}
      <p class="note">Summary aggregated by ${escapeHtml(PUBLICATION_NAME)}.</p>
    </article>
  </main>
</body>
</html>`;
}

export function renderMissingStoryHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Story not found | ${escapeHtml(PUBLICATION_NAME)}</title>
  <meta name="robots" content="noindex">
</head>
<body>
  <p>This story is no longer in today's feed.</p>
  <p><a href="${SITE_ORIGIN}/">Back to ${escapeHtml(PUBLICATION_NAME)}</a></p>
</body>
</html>`;
}

function htmlResponse(statusCode, body, cacheable) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': cacheable ? 'public, max-age=600' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (cacheable) {
    headers['Netlify-CDN-Cache-Control'] = 'public, s-maxage=900, stale-while-revalidate=120';
  } else {
    headers['X-Robots-Tag'] = 'noindex';
  }
  return { statusCode, headers, body };
}

export async function handler(event) {
  const id = storyIdFromEvent(event);
  if (!id) return htmlResponse(404, renderMissingStoryHtml(), false);
  try {
    const result = await getStories();
    const story = findStory(result.stories, id);
    if (!story) return htmlResponse(404, renderMissingStoryHtml(), false);
    return htmlResponse(200, renderStoryHtml(story), true);
  } catch {
    return htmlResponse(404, renderMissingStoryHtml(), false);
  }
}
