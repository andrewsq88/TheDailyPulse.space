import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { FEEDS, resetFeedCache } from '../netlify/functions/feeds.js';
import { handler as sitemapHandler } from '../netlify/functions/sitemap.js';
import { handler as newsHandler } from '../netlify/functions/news-sitemap.js';
import { handler as keyHandler } from '../netlify/functions/indexnow-key.js';
import { handler as storyHandler, renderStoryHtml } from '../netlify/functions/story.js';
import {
  HOMEPAGE_COPY_UPDATED,
  PRIVACY_LASTMOD,
  findStory,
  indexNowUrls,
  newsEntries,
  noteFreshStories,
  pingIndexNow,
  readIndexNowKey,
  renderNewsSitemap,
  renderSitemap,
  resetSearchIndexState,
  storyId,
  storyUrl,
  writeIndexNowKeyFile,
} from '../lib/search-index.js';

const NOW = Date.parse('2026-10-25T12:00:00Z');
const FIXTURE_KEY = 'indexnowtestkey';

function story(overrides) {
  return {
    title: 'Markets rally & hold',
    link: 'https://example.com/rally',
    description: 'Stocks rose today.',
    pubDate: '2026-10-25T11:00:00.000Z',
    sourceName: 'Example & Co',
    thumbnail: '',
    ...overrides,
  };
}

describe('search indexing', { concurrency: 1 }, () => {
  test('sitemap lists this host only, with real pages and fresh story permalinks', () => {
    const recent = story();
    const old = story({
      title: 'Old <story>',
      link: 'https://example.com/old',
      pubDate: '2020-01-01T00:00:00.000Z',
    });
    const undated = story({ title: 'No date', link: 'https://example.com/nodate', pubDate: '' });
    const xml = renderSitemap([recent, old, undated], NOW);

    assert.equal(xml.includes('www.thedailypulse.space'), false);
    assert.equal(xml.includes('technology.html'), false);
    assert.equal(xml.includes('finance.html'), false);
    assert.equal(xml.includes('world.html'), false);
    assert.equal(xml.includes('<loc>https://example.com/rally</loc>'), false);
    assert.equal(xml.includes(`<loc>${storyUrl(recent.link)}</loc>`), true);
    assert.equal(xml.includes(`<loc>${storyUrl(old.link)}</loc>`), true);
    assert.equal(xml.includes(`<loc>${storyUrl(undated.link)}</loc>`), true);
    assert.equal(xml.includes('<loc>https://thedailypulse.space/</loc>'), true);
    assert.equal(xml.includes('<lastmod>2026-10-25T11:00:00Z</lastmod>'), true);
    assert.equal(xml.includes(`<loc>https://thedailypulse.space/privacy.html</loc>`), true);
    assert.equal(xml.includes(`<lastmod>${PRIVACY_LASTMOD}</lastmod>`), true);
    assert.equal(xml.includes('Old &lt;story&gt;'), false);
    assert.equal(HOMEPAGE_COPY_UPDATED.startsWith('2026-10-25'), true);

    const undatedBlock = xml.slice(xml.indexOf(storyUrl(undated.link)) - 20, xml.indexOf(storyUrl(undated.link)) + 180);
    assert.equal(undatedBlock.includes('<lastmod>'), false);
  });

  test('news sitemap keeps the last 48 hours and the required news fields', () => {
    const edge = story({
      title: 'Edge "case"',
      link: 'https://example.com/edge',
      pubDate: new Date(NOW - (48 * 60 * 60 * 1000)).toISOString(),
    });
    const tooOld = story({
      title: 'Too old',
      link: 'https://example.com/too-old',
      pubDate: new Date(NOW - (48 * 60 * 60 * 1000) - 1000).toISOString(),
    });
    const future = story({
      title: 'Far future',
      link: 'https://example.com/future',
      pubDate: '2027-01-01T00:00:00.000Z',
    });
    const stories = [story(), edge, tooOld, future, story({ title: '', link: 'https://example.com/blank' })];
    const entries = newsEntries(stories, NOW);
    assert.deepEqual(entries.map((entry) => entry.title), ['Markets rally & hold', 'Edge "case"']);
    const xml = renderNewsSitemap(stories, NOW);
    assert.equal(xml.includes('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"'), true);
    assert.equal(xml.includes('<news:name>The Daily Pulse</news:name>'), true);
    assert.equal(xml.includes('<news:language>en</news:language>'), true);
    assert.equal(xml.includes('<news:publication_date>2026-10-25T11:00:00Z</news:publication_date>'), true);
    assert.equal(xml.includes('<news:title>Markets rally &amp; hold</news:title>'), true);
    assert.equal(xml.includes('<news:title>Edge &quot;case&quot;</news:title>'), true);
    assert.equal(xml.includes('Too old'), false);
    assert.equal(xml.includes('Far future'), false);
    assert.equal(xml.includes('<loc>https://example.com/'), false);
    assert.equal(entries.every((entry) => entry.loc.startsWith('https://thedailypulse.space/stories/')), true);
  });

  test('story permalinks are stable and the page repeats the news title', () => {
    assert.equal(storyId('https://example.com/rally'), storyId('https://example.com/rally'));
    assert.notEqual(storyId('https://example.com/rally'), storyId('https://example.com/old'));
    assert.equal(storyId('https://example.com/rally').length, 20);
    const html = renderStoryHtml(story({ title: 'A </script> story' }));
    assert.equal(html.includes('<h1>A &lt;/script&gt; story</h1>'), true);
    assert.equal(html.includes('</script><script'), false);
    assert.equal(html.includes('profitablecpmratenetwork'), false);
    assert.equal(html.includes('highperformanceformat'), false);
    assert.equal(html.includes('adsterra'), false);
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
    assert.equal(JSON.parse(json).headline, 'A </script> story');
    assert.equal(findStory([story()], storyId(story().link)).title, story().title);
  });

  test('privacy lastmod matches the date printed on the policy', () => {
    const html = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
    assert.equal(html.includes('Last updated: November 2025'), true);
    assert.equal(PRIVACY_LASTMOD, '2025-11-01');
  });

  test('homepage copy and canonical host are the apex, and the popunder stays', () => {
    const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
    assert.equal(home.includes('<title>The Daily Pulse: Today\'s Top News Stories in One Page</title>'), true);
    assert.equal(home.includes('content="The day\'s top stories from business, tech, markets and the world, gathered on one page. Catch up in minutes."'), true);
    assert.equal(home.includes('<link rel="canonical" href="https://thedailypulse.space/">'), true);
    assert.equal(home.includes('https://www.thedailypulse.space'), false);
    assert.equal(home.includes('https://pl28802746.profitablecpmratenetwork.com/c9/04/cf/c904cf8b83d6b3ab17b034c8f662e310.js'), true);
    assert.equal(home.includes("loadAdsterraInIframe('adsterra-sidebar', '198695a08a60e90b59f6a5370452a9fb', 160, 600);"), true);
    assert.equal(robots.includes('Sitemap: https://thedailypulse.space/sitemap.xml'), true);
    assert.equal(robots.includes('Sitemap: https://thedailypulse.space/news-sitemap.xml'), true);
    assert.equal(robots.includes('Disallow: /api/'), true);
    assert.equal(robots.includes('Disallow: /admin/'), true);
    assert.equal(existsSync(new URL('../public/sitemap.xml', import.meta.url)), false);
  });

  test('IndexNow key stays in the request body and out of the logs', async () => {
    assert.equal(readIndexNowKey({ INDEXNOW_KEY: 'short' }), '');
    assert.equal(readIndexNowKey({ INDEXNOW_KEY: 'bad key!!' }), '');
    assert.equal(readIndexNowKey({ INDEXNOW_KEY: `  ${FIXTURE_KEY}  ` }), FIXTURE_KEY);

    let called = false;
    const missing = await pingIndexNow(['https://thedailypulse.space/'], {
      env: {},
      fetchImpl: async () => {
        called = true;
        return new Response('', { status: 200 });
      },
    });
    assert.equal(missing.skipped, true);
    assert.equal(called, false);

    const lines = [];
    const log = {
      warn: (message) => lines.push(String(message)),
      info: (message) => lines.push(String(message)),
      log: (message) => lines.push(String(message)),
    };
    let body = null;
    const ping = await pingIndexNow([
      'https://thedailypulse.space/',
      'https://thedailypulse.space/',
      'https://evil.example/phish',
      'http://thedailypulse.space/insecure',
    ], {
      env: { INDEXNOW_KEY: FIXTURE_KEY },
      log,
      fetchImpl: async (url, init) => {
        assert.equal(url, 'https://api.indexnow.org/indexnow');
        assert.equal(init.method, 'POST');
        body = JSON.parse(init.body);
        return new Response('', { status: 200 });
      },
    });
    assert.equal(ping.skipped, false);
    assert.equal(ping.status, 200);
    assert.equal(body.host, 'thedailypulse.space');
    assert.equal(body.key, FIXTURE_KEY);
    assert.equal(body.keyLocation, `https://thedailypulse.space/${FIXTURE_KEY}.txt`);
    assert.deepEqual(body.urlList, ['https://thedailypulse.space/']);
    assert.equal(lines.some((line) => line.includes(FIXTURE_KEY)), false);
    assert.equal(indexNowUrls([story()]).includes(storyUrl('https://example.com/rally')), true);
  });

  test('a fresh story after the baseline is the only IndexNow URL', async () => {
    resetSearchIndexState();
    const calls = [];
    const ping = async (urls) => {
      calls.push(urls);
      return { skipped: false, count: urls.length, status: 202 };
    };
    const later = Date.parse('2026-10-27T12:00:00Z');
    const first = await noteFreshStories([story()], { ping, now: later });
    assert.equal(first.reason, 'baseline');
    const second = await noteFreshStories([
      story(),
      story({ title: 'New', link: 'https://example.com/new', pubDate: '2026-10-25T11:30:00.000Z' }),
    ], { ping, now: later });
    assert.deepEqual(calls, [[storyUrl('https://example.com/new')]]);
    const third = await noteFreshStories([
      story(),
      story({ title: 'New', link: 'https://example.com/new' }),
    ], { ping, now: later });
    assert.equal(third.reason, 'unchanged');
    resetSearchIndexState();
    const cold = await noteFreshStories([
      story({ title: 'Just in', link: 'https://example.com/just', pubDate: '2026-10-25T11:10:00.000Z' }),
    ], { ping, now: Date.parse('2026-10-25T11:30:00Z') });
    assert.equal(cold.skipped, false);
    assert.deepEqual(calls.at(-1), [storyUrl('https://example.com/just')]);
    resetSearchIndexState();
  });

  test('key file contains only the key', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dp-indexnow-'));
    try {
      let directory = pathToFileURL(dir);
      if (!directory.href.endsWith('/')) directory = new URL(`${directory.href}/`);
      const result = await writeIndexNowKeyFile(directory, { INDEXNOW_KEY: FIXTURE_KEY });
      assert.equal(result.written, true);
      assert.equal(Object.hasOwn(result, 'filename'), false);
      const body = await readFile(join(dir, `${FIXTURE_KEY}.txt`), 'utf8');
      assert.equal(body, FIXTURE_KEY);
      const skipped = await writeIndexNowKeyFile(directory, { INDEXNOW_KEY: 'nope' });
      assert.equal(skipped.written, false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('handlers serve sitemap, news, story, and key responses', async () => {
    resetFeedCache();
    resetSearchIndexState();
    const previous = process.env.INDEXNOW_KEY;
    process.env.INDEXNOW_KEY = FIXTURE_KEY;
    const original = global.fetch;
    const requested = [];
    global.fetch = async (url) => {
      requested.push(String(url));
      const recent = new Date().toUTCString();
      const id = encodeURIComponent(String(url));
      const xml = `<rss><channel><title>Src</title><item><title>Fresh &amp; new</title><link>https://example.com/fresh?src=${id}</link><pubDate>${recent}</pubDate><description>Hello</description></item><item><title>Old story</title><link>https://example.com/old?src=${id}</link><pubDate>Wed, 01 Jan 2020 00:00:00 GMT</pubDate><description>Old</description></item></channel></rss>`;
      return new Response(xml, { status: 200 });
    };

    try {
      const sitemap = await sitemapHandler();
      assert.equal(sitemap.statusCode, 200);
      assert.equal(sitemap.headers['Content-Type'].includes('application/xml'), true);
      assert.equal(sitemap.body.includes('<loc>https://thedailypulse.space/</loc>'), true);
      assert.equal(sitemap.body.includes('<loc>https://thedailypulse.space/privacy.html</loc>'), true);
      assert.equal(sitemap.body.includes('www.thedailypulse.space'), false);
      assert.equal((sitemap.body.match(/\/stories\//g) || []).length, FEEDS.length * 2);

      const news = await newsHandler();
      assert.equal(news.body.includes('<news:name>The Daily Pulse</news:name>'), true);
      assert.equal(news.body.includes('<news:language>en</news:language>'), true);
      assert.equal(news.body.includes('<news:title>Fresh &amp; new</news:title>'), true);
      assert.equal(news.body.includes('Old story'), false);
      assert.equal((news.body.match(/<news:title>/g) || []).length, FEEDS.length);

      const sampleLink = `https://example.com/fresh?src=${encodeURIComponent(FEEDS[0].url)}`;
      const page = await storyHandler({ queryStringParameters: { id: storyId(sampleLink) } });
      assert.equal(page.statusCode, 200);
      assert.equal(page.body.includes('<h1>Fresh &amp; new</h1>'), true);
      assert.equal(page.body.includes('profitablecpmratenetwork'), false);
      const missing = await storyHandler({ path: '/stories/aaaaaaaaaaaaaaaaaaaa' });
      assert.equal(missing.statusCode, 404);
      assert.equal(missing.body.includes(FIXTURE_KEY), false);

      const key = await keyHandler({ queryStringParameters: { file: FIXTURE_KEY } });
      assert.equal(key.statusCode, 200);
      assert.equal(key.headers['Content-Type'].includes('text/plain'), true);
      assert.equal(key.body, FIXTURE_KEY);
      const wrong = await keyHandler({ queryStringParameters: { file: 'ads.txt' }, path: '/ads.txt' });
      assert.equal(wrong.statusCode, 404);
      assert.equal(wrong.body.includes(FIXTURE_KEY), false);
      assert.equal(requested.filter((url) => url === 'https://api.indexnow.org/indexnow').length, 1);
    } finally {
      global.fetch = original;
      if (previous === undefined) delete process.env.INDEXNOW_KEY;
      else process.env.INDEXNOW_KEY = previous;
      resetFeedCache();
      resetSearchIndexState();
    }
  });
});
