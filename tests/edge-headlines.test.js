import test from 'node:test';
import assert from 'node:assert/strict';
import { injectHeadlines } from '../netlify/edge-functions/fresh-headlines.js';

const page = '<head><!-- headline-jsonld:start -->\nOLD\n<!-- headline-jsonld:end --></head><div><!-- headlines:start -->\nOLD\n<!-- headlines:end --></div>';

test('edge function swaps stale baked headlines for current ones', () => {
  const out = injectHeadlines(page, [{ title: 'Today $& <b>', link: 'https://example.com/a', pubDate: '2026-10-28T12:00:00Z', sourceName: 'X' }]);
  assert.equal(out.includes('OLD'), false);
  assert.equal(out.includes('Today $&amp; &lt;b&gt;'), true);
  assert.equal(out.includes('"@type":"ItemList"'), true);
  assert.equal(out.includes('\\u003cb>'), true);
});

test('edge function leaves the page alone when the feed is empty', () => {
  assert.equal(injectHeadlines(page, []), page);
});
