import { getStories } from './feeds.js';
import { renderNewsSitemap, xmlResponse } from '../../lib/search-index.js';

export async function handler() {
  let stories = [];
  try {
    const result = await getStories();
    stories = result.stories || [];
  } catch {
    stories = [];
  }
  return xmlResponse(renderNewsSitemap(stories));
}
