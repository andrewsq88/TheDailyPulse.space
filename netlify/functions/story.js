import { excerptText, getStories } from './feeds.js';
import {
  SITE_ORIGIN,
  PUBLICATION_NAME,
  ORGANIZATION_ID,
  WEBSITE_ID,
  escapeHtml,
  findStory,
  formatLastmod,
  siteStructuredData,
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

const OTHER_SITES_FOOTER_CSS = `
    .site-footer { margin-top: auto; background: linear-gradient(to bottom right, #0f172a, #1e293b); color: #94a3b8; padding: 3rem 1rem; text-align: center; }
    .site-footer nav { max-width: 80rem; margin: 0 auto; }
    .site-footer h2 { margin: 0 0 0.75rem; font-size: 0.875rem; font-weight: 600; color: #cbd5e1; }
    .site-footer ul { list-style: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.25rem 1.5rem; margin: 0; padding: 0; }
    .site-footer a { display: inline-block; padding: 0.5rem 0; color: #cbd5e1; font-size: 0.875rem; font-weight: 600; text-decoration: none; }
    .site-footer a:hover, .site-footer a:focus-visible { color: #fb7185; }
    .site-footer a:focus-visible { outline: 2px solid #fb7185; outline-offset: 2px; }
    .site-footer .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
`;

function otherSitesFooter() {
  return `<footer class="site-footer">
  <nav aria-labelledby="explore-other-sites">
    <h2 id="explore-other-sites">Explore our other sites</h2>
    <ul>
      <li><a href="https://www.lushlandsmanagement.com/?utm_source=dailypulse&amp;utm_medium=crosslink&amp;utm_campaign=footer-2026-11">LushLands Management</a></li>
      <li><a href="https://www.weeklymealplan.space/?utm_source=dailypulse&amp;utm_medium=crosslink&amp;utm_campaign=footer-2026-11">Weekly Meal Planner</a></li>
    </ul>
  </nav>
  <nav aria-labelledby="legal-pages">
    <h2 id="legal-pages" class="sr-only">Legal</h2>
    <ul>
      <li><a href="/privacy.html">Privacy Policy</a></li>
      <li><a href="/terms.html">Terms of Service</a></li>
      <li><a href="/cookies.html">Cookie Policy</a></li>
    </ul>
  </nav>
</footer>`;
}

export function renderStoryHtml(story) {
  const title = String(story.title || '');
  const source = String(story.sourceName || 'News');
  const excerpt = excerptText(story?.description);
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
  const pageTitle = `${title} | ${PUBLICATION_NAME}`;
  const metaDescription = excerpt || `${title} — ${source}`;
  const structured = siteStructuredData();
  const article = {
    '@type': 'NewsArticle',
    headline: title,
    inLanguage: 'en',
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    isPartOf: { '@id': WEBSITE_ID },
    publisher: { '@id': ORGANIZATION_ID },
    author: {
      '@type': 'Organization',
      name: source,
    },
  };
  if (published) {
    article.datePublished = published;
    article.dateModified = published;
  }
  if (excerpt) article.description = excerpt;
  if (outbound) article.isBasedOn = outbound;
  structured['@graph'].push(article);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${escapeHtml(PUBLICATION_NAME)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  ${published ? `<meta property="article:published_time" content="${escapeHtml(published)}">` : ''}
  <script type="application/ld+json">${jsonLd(structured)}</script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; font-family: Inter, sans-serif; background: #f8fafc; color: #1e293b; }
    header, main { width: 100%; max-width: 42rem; margin: 0 auto; padding: 1.5rem; box-sizing: border-box; }
    main { flex: 1 0 auto; }
    header a { color: #0f172a; font-weight: 700; text-decoration: none; display: inline-flex; gap: 0.75rem; align-items: center; }
    article h1 { font-size: 2rem; line-height: 1.25; margin: 0 0 0.75rem; }
    .byline, .note { color: #64748b; font-size: 0.95rem; }
    p { line-height: 1.6; }
    a.read { color: #be123c; font-weight: 600; }
    ${OTHER_SITES_FOOTER_CSS}
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
      ${excerpt ? `<p class="excerpt">${escapeHtml(excerpt)}</p>` : ''}
      ${outbound ? `<p>Originally published by ${escapeHtml(source)}. <a class="read" href="${escapeHtml(outbound)}" rel="noopener noreferrer">Read the original article</a>.</p>` : ''}
    </article>
  </main>
  ${otherSitesFooter()}
</body>
</html>`;
}

export function renderMissingStoryHtml(pageUrl = '') {
  const title = `Story not found | ${PUBLICATION_NAME}`;
  const description = 'This story is no longer in today\'s feed.';
  const canonical = pageUrl
    ? `<link rel="canonical" href="${escapeHtml(pageUrl)}">`
    : '';
  const ogUrl = pageUrl
    ? `<meta property="og:url" content="${escapeHtml(pageUrl)}">`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="noindex">
  ${canonical}
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${ogUrl}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(PUBLICATION_NAME)}">
  <script type="application/ld+json">${jsonLd(siteStructuredData())}</script>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; font-family: Inter, sans-serif; background: #f8fafc; color: #1e293b; }
    main { flex: 1 0 auto; width: 100%; max-width: 42rem; margin: 0 auto; padding: 1.5rem; box-sizing: border-box; }
    ${OTHER_SITES_FOOTER_CSS}
  </style>
</head>
<body>
  <main>
    <p>This story is no longer in today's feed.</p>
    <p><a href="${SITE_ORIGIN}/">Back to ${escapeHtml(PUBLICATION_NAME)}</a></p>
  </main>
  ${otherSitesFooter()}
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
  const missingUrl = id ? `${SITE_ORIGIN}/stories/${id}` : '';
  if (!id) return htmlResponse(404, renderMissingStoryHtml(missingUrl), false);
  try {
    const result = await getStories();
    const story = findStory(result.stories, id);
    if (!story) return htmlResponse(404, renderMissingStoryHtml(missingUrl), false);
    return htmlResponse(200, renderStoryHtml(story), true);
  } catch {
    return htmlResponse(404, renderMissingStoryHtml(missingUrl), false);
  }
}
