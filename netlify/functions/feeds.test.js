import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  FEEDS,
  cleanHttpUrl,
  getStories,
  handler,
  itemListJsonLd,
  parseFeedXml,
  plainText,
  resetFeedCache,
  storyCardsHtml,
} from './feeds.js';

const RSS_FIXTURE = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Example &amp; Co</title>
    <item>
      <title>Markets rally &amp; hold</title>
      <link>https://example.com/rally</link>
      <pubDate>Wed, 21 Oct 2026 15:00:00 GMT</pubDate>
      <description><![CDATA[<p>Stocks <b>rose</b> today.</p>]]></description>
      <media:thumbnail url="https://images.example.com/rally.jpg"/>
    </item>
    <item>
      <title>Skip me</title>
      <link>javascript:alert(1)</link>
      <description>nope</description>
    </item>
  </channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">The Verge</title>
  <entry>
    <title type="html"><![CDATA[Device &amp; review]]></title>
    <link rel="alternate" type="text/html" href="https://www.theverge.com/story" />
    <published>2026-10-21T08:15:00-04:00</published>
    <summary type="html"><![CDATA[A <em>short</em> summary.]]></summary>
    <content type="html"><![CDATA[<img src="https://cdn.example.com/pic.jpg?quality=90&#038;strip=all" />]]></content>
  </entry>
</feed>`;

test('parser reads RSS and Atom items and drops unsafe links', () => {
  const rss = parseFeedXml(RSS_FIXTURE, { category: 'finance', fallbackName: 'Fallback' });
  assert.equal(rss.length, 1);
  assert.equal(rss[0].title, 'Markets rally & hold');
  assert.equal(rss[0].sourceName, 'Example & Co');
  assert.equal(rss[0].description, 'Stocks rose today.');
  assert.equal(rss[0].thumbnail, 'https://images.example.com/rally.jpg');
  assert.equal(rss[0].category, 'finance');
  assert.equal(Number.isNaN(Date.parse(rss[0].pubDate)), false);

  const atom = parseFeedXml(ATOM_FIXTURE, { category: 'tech', fallbackName: 'The Verge' });
  assert.equal(atom.length, 1);
  assert.equal(atom[0].title, 'Device & review');
  assert.equal(atom[0].link, 'https://www.theverge.com/story');
  assert.equal(atom[0].description, 'A short summary.');
  assert.equal(atom[0].thumbnail, 'https://cdn.example.com/pic.jpg?quality=90&strip=all');
});

test('plain text and urls reject active content', () => {
  assert.equal(plainText('<script>alert(1)</script><p>Hello</p>'), 'Hello');
  assert.equal(cleanHttpUrl('javascript:alert(1)'), '');
  assert.equal(cleanHttpUrl('https://example.com/a'), 'https://example.com/a');
});

test('getStories caches a warm result and serves it when upstream later fails', async () => {
  resetFeedCache();
  let calls = 0;
  const fetchImpl = async (url) => {
    calls += 1;
    assert.equal(FEEDS.some((feed) => feed.url === url), true);
    const feed = FEEDS.find((entry) => entry.url === url);
    const xml = `<rss><channel><title>${feed.fallbackName}</title><item><title>${feed.fallbackName} story</title><link>https://example.com/${encodeURIComponent(feed.fallbackName)}</link><pubDate>Wed, 21 Oct 2026 12:00:00 GMT</pubDate><description>Body</description></item></channel></rss>`;
    return new Response(xml, { status: 200 });
  };

  const first = await getStories({ fetchImpl, now: 1_000, ttlMs: 5_000 });
  assert.equal(first.cache, 'fresh');
  assert.equal(first.stories.length, FEEDS.length);
  assert.equal(calls, FEEDS.length);

  const second = await getStories({ fetchImpl: async () => { throw new Error('should not fetch'); }, now: 2_000, ttlMs: 5_000 });
  assert.equal(second.cache, 'memory');
  assert.equal(second.stories.length, FEEDS.length);

  const stale = await getStories({ fetchImpl: async () => { throw new Error('down'); }, now: 20_000, ttlMs: 5_000 });
  assert.equal(stale.cache, 'stale');
  assert.equal(stale.stories.length, FEEDS.length);
  resetFeedCache();
});

test('handler ignores a caller-supplied feed url and rejects unknown categories', async () => {
  resetFeedCache();
  const requested = [];
  const original = global.fetch;
  global.fetch = async (url) => {
    requested.push(String(url));
    return new Response('<rss><channel><title>T</title><item><title>One</title><link>https://example.com/one</link><pubDate>Wed, 21 Oct 2026 12:00:00 GMT</pubDate><description>Body</description></item></channel></rss>', { status: 200 });
  };

  try {
    const bad = await handler({
      httpMethod: 'GET',
      queryStringParameters: { category: 'secrets', rss_url: 'https://evil.example/rss' },
    });
    assert.equal(bad.statusCode, 400);
    assert.equal(requested.length, 0);

    const ok = await handler({
      httpMethod: 'GET',
      queryStringParameters: { category: 'tech', rss_url: 'https://evil.example/rss' },
    });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.headers['Netlify-CDN-Cache-Control'].includes('s-maxage=900'), true);
    assert.equal(ok.headers['Cache-Control'].includes('max-age=600'), true);
    const body = JSON.parse(ok.body);
    assert.equal(body.items.every((item) => item.category === 'tech'), true);
    assert.equal(requested.includes('https://evil.example/rss'), false);
    assert.deepEqual(requested, FEEDS.map((feed) => feed.url));
  } finally {
    global.fetch = original;
    resetFeedCache();
  }
});

test('story html and json-ld escape headline text', () => {
  const html = storyCardsHtml([{
    title: 'A <script> & "quote"',
    link: 'https://example.com/a',
    description: 'Hello <b>there</b>',
    pubDate: '2026-10-21T00:00:00.000Z',
    thumbnail: '',
    sourceName: 'Source',
    category: 'tech',
  }]);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('A &lt;script&gt; &amp; &quot;quote&quot;'), true);
  const json = itemListJsonLd([{ title: 'A </script> story', link: 'https://example.com/a' }]);
  assert.equal(json.includes('</script>'), false);
  assert.equal(JSON.parse(json)['@type'], 'ItemList');
});

test('pages call the same-origin feed function and keep the live ad units', () => {
  const home = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const legacy = readFileSync(new URL('../../index3.html', import.meta.url), 'utf8');
  for (const html of [home, legacy]) {
    assert.equal(html.includes('api.rss2json.com'), false);
    assert.equal(html.includes('SUPABASE_ANON_KEY'), false);
    assert.equal(html.includes('eyJ'), false);
    assert.equal(html.includes('/.netlify/functions/feeds'), true);
  }
  assert.equal(home.includes('https://pl28802746.profitablecpmratenetwork.com/c9/04/cf/c904cf8b83d6b3ab17b034c8f662e310.js'), true);
  assert.equal(home.includes('id="adsterra-sidebar"'), true);
  assert.equal(home.includes('id="adsterra-infeed"'), true);
  assert.equal(home.includes("loadAdsterraInIframe('adsterra-sidebar', '198695a08a60e90b59f6a5370452a9fb', 160, 600);"), true);
  assert.equal(home.includes("loadAdsterraInIframe('adsterra-infeed', '5d1d33fad1aa774f2588e74770c88134', 728, 90);"), true);
  assert.equal(legacy.includes('id="adsterra-sidebar"'), false);
});
