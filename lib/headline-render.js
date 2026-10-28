/**
 * Pure HTML/JSON-LD renderers for headlines. No Node built-ins, so both the
 * build script, the Netlify function and the edge function can import them.
 */
export function escapeHtml(value) {
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
