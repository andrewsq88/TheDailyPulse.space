import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { insertStoryAds, renderMissingStoryHtml, renderStoryHtml } from '../netlify/functions/story.js';
import {
  AD_HOST,
  AD_UNITS,
  STORY_AD_LIMIT,
  adsAllowedOnPath,
  buildAdSrcdoc,
  unitForStory,
} from '../public/ad-units.js';
import { bootAds } from '../public/ad-loader.js';

const FORBIDDEN = [
  'profitablecpmratenetwork',
  'effectivegatecpm',
  'popunder',
  'smartlink',
  'socialbar',
  'document.write',
];

function story(overrides = {}) {
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

function placements(html) {
  return [...html.matchAll(/data-ad-placement="([^"]+)"/g)].map((match) => match[1]);
}

describe('story display ads', () => {
  test('unit keys live in one config and there is no mobile banner yet', () => {
    assert.equal(AD_HOST, 'https://www.highperformanceformat.com');
    assert.equal(AD_UNITS.leaderboard.key, '5d1d33fad1aa774f2588e74770c88134');
    assert.deepEqual([AD_UNITS.leaderboard.width, AD_UNITS.leaderboard.height], [728, 90]);
    assert.equal(AD_UNITS.skyscraper.key, '198695a08a60e90b59f6a5370452a9fb');
    assert.deepEqual([AD_UNITS.skyscraper.width, AD_UNITS.skyscraper.height], [160, 600]);
    assert.equal(AD_UNITS.mobile, null);
    assert.equal(STORY_AD_LIMIT, 2);
    assert.equal(unitForStory(1280), AD_UNITS.leaderboard);
    assert.equal(unitForStory(375), AD_UNITS.leaderboard);
    const srcdoc = buildAdSrcdoc(AD_UNITS.leaderboard);
    assert.equal(srcdoc.includes('"format":"iframe"'), true);
    assert.equal(srcdoc.includes(`${AD_HOST}/5d1d33fad1aa774f2588e74770c88134/invoke.js`), true);
    assert.equal(buildAdSrcdoc({ key: 'not-a-key', width: 300, height: 250 }), '');
    for (const word of FORBIDDEN) assert.equal(srcdoc.toLowerCase().includes(word), false, word);
  });

  test('a normal story reserves two display slots and does not change the article metadata', () => {
    const html = renderStoryHtml(story());
    assert.deepEqual(placements(html), ['in-article', 'end']);
    assert.equal((html.match(/class="ad-label">Advertisement</g) || []).length, 2);
    assert.equal(html.includes('height: 90px'), true);
    assert.equal(html.includes('aspect-ratio: 728 / 90'), true);
    assert.equal(html.includes('src="/consent.js"'), true);
    assert.equal(html.includes('src="/ad-loader.js"'), true);
    assert.equal(html.includes('highperformanceformat'), false);
    assert.equal(html.includes('invoke.js'), false);
    assert.equal(html.includes('adsterra'), false);
    const excerptAt = html.indexOf('<p class="excerpt">');
    const midAt = html.indexOf('data-ad-placement="in-article"');
    const creditAt = html.indexOf('Originally published by');
    const endAt = html.indexOf('data-ad-placement="end"');
    const footerAt = html.lastIndexOf('<footer');
    assert.equal(excerptAt < midAt && midAt < creditAt && creditAt < endAt && endAt < footerAt, true);
    assert.equal(html.includes('<link rel="canonical" href="https://thedailypulse.space/stories/'), true);
    assert.equal((html.match(/<script type="application\/ld\+json">/g) || []).length, 1);
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
    const article = JSON.parse(json)['@graph'].find((node) => node['@type'] === 'NewsArticle');
    assert.equal(article.headline, 'Markets rally & hold');
    assert.equal(article.description, 'Stocks rose today.');
    for (const word of FORBIDDEN) assert.equal(html.toLowerCase().includes(word), false, word);
  });

  test('short and longer stories place the in-article unit at the midpoint or after the third paragraph', () => {
    const one = renderStoryHtml(story({ description: '' }));
    const oneExcerpt = one.indexOf('class="excerpt"');
    const oneMid = one.indexOf('data-ad-placement="in-article"');
    const oneCredit = one.indexOf('Originally published by');
    assert.equal(oneExcerpt, -1);
    assert.equal(oneMid < oneCredit, true);
    assert.deepEqual(placements(one), ['in-article', 'end']);

    const four = ['<p>One.</p>', '<p>Two.</p>', '<p>Three.</p>', '<p>Four.</p>'];
    const placed = insertStoryAds(four);
    assert.equal(placed.indexOf('One.') < placed.indexOf('Two.') && placed.indexOf('Two.') < placed.indexOf('Three.'), true);
    assert.equal(placed.indexOf('Three.') < placed.indexOf('data-ad-placement="in-article"'), true);
    assert.equal(placed.indexOf('data-ad-placement="in-article"') < placed.indexOf('Four.'), true);
    assert.equal(placed.indexOf('Four.') < placed.indexOf('data-ad-placement="end"'), true);
    assert.equal((placed.match(/data-ad-placement=/g) || []).length, 2);

    const missing = renderMissingStoryHtml('https://thedailypulse.space/stories/aaaaaaaaaaaaaaaaaaaa');
    assert.deepEqual(placements(missing), []);
    assert.equal(missing.includes('/ad-loader.js'), false);
    assert.equal(missing.includes('Advertisement'), false);
  });

  test('legal pages and the homepage shell do not gain story slots', () => {
    for (const file of ['privacy.html', 'terms.html', 'cookies.html']) {
      const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.equal(html.includes('data-ad-placement'), false, file);
      assert.equal(html.includes('/ad-loader.js'), false, file);
      assert.equal(html.includes('highperformanceformat'), false, file);
    }
    assert.equal(adsAllowedOnPath('/privacy.html'), false);
    assert.equal(adsAllowedOnPath('/terms'), false);
    assert.equal(adsAllowedOnPath('/cookies.html'), false);
    assert.equal(adsAllowedOnPath('/stories/abc'), true);
    assert.equal(adsAllowedOnPath('/'), true);
    const rules = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
    assert.equal(/content-security-policy/i.test(rules), false);
    const retired = readFileSync(new URL('../public/adsterra-ads.js', import.meta.url), 'utf8');
    assert.equal(retired.includes('invoke.js'), false);
    assert.equal(retired.includes('5d1d33fad1aa774f2588e74770c88134'), false);
  });

  test('story iframes load only after consent and only when scrolled near, with a cap of two', () => {
    const created = [];
    class IntersectionObserver {
      constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        created.push(this);
      }
      observe(target) {
        this.callback([{ isIntersecting: false, target }]);
      }
      unobserve() {}
    }
    const frames = [{}, {}, {}].map(() => ({
      srcdoc: '',
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name] || null; },
    }));
    const slots = frames.map((iframe) => ({
      iframe,
      removed: false,
      remove() { this.removed = true; },
      querySelector() { return iframe; },
    }));
    const listeners = {};
    const win = {
      innerWidth: 375,
      location: { pathname: '/stories/abc' },
      DailyPulseConsent: { accepted() { return false; } },
      addEventListener(type, fn) { listeners[type] = fn; },
      IntersectionObserver,
    };
    const doc = {
      getElementById() { return null; },
      querySelectorAll(selector) {
        return selector === '[data-ad-placement]' ? slots : [];
      },
    };

    bootAds(win, doc);
    assert.equal(frames.every((frame) => frame.srcdoc === ''), true);
    assert.equal(created.length, 0);

    win.DailyPulseConsent = { accepted() { return true; } };
    listeners['dailypulse-ad-consent']();
    assert.equal(frames.every((frame) => frame.srcdoc === ''), true);
    assert.equal(created.length, 1);
    assert.equal(created[0].options.rootMargin, '200px 0px');
    assert.equal(slots[2].removed, true);
    assert.equal(slots[0].removed, false);

    created[0].callback([{ isIntersecting: true, target: slots[0] }]);
    assert.equal(frames[0].srcdoc.includes('5d1d33fad1aa774f2588e74770c88134'), true);
    assert.equal(frames[0].srcdoc.includes('"format":"iframe"'), true);
    assert.equal(frames[1].srcdoc, '');
    for (const word of FORBIDDEN) assert.equal(frames[0].srcdoc.toLowerCase().includes(word), false, word);

    const homeFrame = {
      srcdoc: '',
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return this.attributes[name] || null; },
    };
    const blocked = {
      innerWidth: 1280,
      location: { pathname: '/privacy.html' },
      DailyPulseConsent: { accepted() { return true; } },
      addEventListener() {},
      IntersectionObserver,
    };
    bootAds(blocked, {
      getElementById() { return homeFrame; },
      querySelectorAll() { return slots; },
    });
    assert.equal(homeFrame.srcdoc, '');
  });
});
