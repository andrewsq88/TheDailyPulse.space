/**
 * After Vite copies the site, keep privacy.html available and, when the
 * publishers respond, bake the latest headlines into the HTML for crawlers.
 * A feed outage must not fail the deploy; the browser still calls the function.
 */
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { getStories, itemListJsonLd, resetFeedCache, storyCardsHtml } from '../netlify/functions/feeds.js';

function replaceMarked(html, name, contents) {
  const pattern = new RegExp(`<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`);
  if (!pattern.test(html)) return html;
  return html.replace(pattern, `<!-- ${name}:start -->\n${contents}\n<!-- ${name}:end -->`);
}

await copyFile(new URL('../privacy.html', import.meta.url), new URL('../dist/privacy.html', import.meta.url));

const indexPath = new URL('../dist/index.html', import.meta.url);
let html = await readFile(indexPath, 'utf8');

try {
  resetFeedCache();
  const { stories } = await getStories();
  const top = stories.slice(0, 12);
  if (top.length) {
    html = replaceMarked(html, 'headlines', storyCardsHtml(top));
    html = replaceMarked(
      html,
      'headline-jsonld',
      `<script type="application/ld+json">${itemListJsonLd(top)}</script>`,
    );
    console.log(`Injected ${top.length} headlines into dist/index.html`);
  } else {
    console.warn('Headline injection skipped: no stories returned');
  }
} catch (error) {
  console.warn(`Headline injection skipped: ${error instanceof Error ? error.message : error}`);
}

await writeFile(indexPath, html);
