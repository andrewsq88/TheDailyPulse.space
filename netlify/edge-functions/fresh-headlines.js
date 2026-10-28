/**
 * Keeps the crawler-visible headlines current between deploys. The static
 * homepage carries headlines baked in at build time; this edge function swaps
 * them for the latest stories from the cached same-origin feed function on
 * every request. If the feed is slow or fails, the static page is served as is.
 */
import { itemListJsonLd, storyCardsHtml } from '../../lib/headline-render.js';

const FEED_TIMEOUT_MS = 2500;

function replaceMarked(html, name, contents) {
  const pattern = new RegExp(`<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`);
  if (!pattern.test(html)) return html;
  return html.replace(pattern, () => `<!-- ${name}:start -->\n${contents}\n<!-- ${name}:end -->`);
}

export function injectHeadlines(html, items) {
  const top = (items || []).slice(0, 12);
  if (!top.length) return html;
  let out = replaceMarked(html, 'headlines', storyCardsHtml(top));
  out = replaceMarked(out, 'headline-jsonld', `<script type="application/ld+json">${itemListJsonLd(top)}</script>`);
  return out;
}

export default async function freshHeadlines(request, context) {
  if (request.method !== 'GET') return context.next();
  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.includes('text/html')) return response;

  try {
    const feedUrl = new URL('/.netlify/functions/feeds', request.url);
    const feed = await fetch(feedUrl, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
    if (!feed.ok) return response;
    const data = await feed.json();
    const html = injectHeadlines(await response.text(), data.items);
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('etag');
    headers.set('cache-control', 'public, max-age=0, must-revalidate');
    return new Response(html, { status: response.status, headers });
  } catch {
    return response;
  }
}

export const config = { path: ['/', '/index.html'] };
