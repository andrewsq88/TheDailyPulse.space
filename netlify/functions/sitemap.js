import { getStories } from './feeds.js';
import { noteFreshStories, renderSitemap, xmlResponse } from '../../lib/search-index.js';

export async function handler() {
  let stories = [];
  try {
    const result = await getStories();
    stories = result.stories || [];
    if (result.cache === 'fresh' && stories.length) {
      try {
        await noteFreshStories(stories);
      } catch {
        // IndexNow must not fail sitemap generation.
      }
    }
  } catch {
    stories = [];
  }
  return xmlResponse(renderSitemap(stories));
}
