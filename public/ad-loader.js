import {
  AD_UNITS,
  STORY_AD_LIMIT,
  adsAllowedOnPath,
  buildAdSrcdoc,
  unitForStory,
} from './ad-units.js';

const NEAR_MARGIN = '200px 0px';

function consented(win) {
  return Boolean(win.DailyPulseConsent && win.DailyPulseConsent.accepted());
}

function fillIframe(iframe, unit) {
  if (!iframe || iframe.getAttribute('data-ad-loaded') === '1') return;
  const srcdoc = buildAdSrcdoc(unit);
  if (!srcdoc) return;
  iframe.setAttribute('data-ad-loaded', '1');
  iframe.srcdoc = srcdoc;
}

function loadHomepageAds(win, doc) {
  if (!consented(win)) return;
  const sidebar = doc.getElementById('adsterra-sidebar');
  const infeed = doc.getElementById('adsterra-infeed');
  if (sidebar) fillIframe(sidebar, AD_UNITS.skyscraper);
  if (infeed) fillIframe(infeed, AD_UNITS.leaderboard);
}

function watchStoryAds(win, doc, state) {
  if (state.watching) return;
  if (!consented(win)) return;
  const all = doc.querySelectorAll('[data-ad-placement]');
  if (!all.length) return;
  state.watching = true;
  const slots = Array.prototype.slice.call(all, 0, STORY_AD_LIMIT);
  for (let i = STORY_AD_LIMIT; i < all.length; i += 1) {
    if (typeof all[i].remove === 'function') all[i].remove();
  }

  function loadSlot(slot) {
    fillIframe(slot.querySelector('iframe'), unitForStory(win.innerWidth));
  }

  if (typeof win.IntersectionObserver !== 'function') {
    slots.forEach(loadSlot);
    return;
  }

  const observer = new win.IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadSlot(entry.target);
      observer.unobserve(entry.target);
    });
  }, { root: null, rootMargin: NEAR_MARGIN, threshold: 0 });
  slots.forEach((slot) => observer.observe(slot));
}

export function bootAds(win, doc) {
  if (!win || !doc || !adsAllowedOnPath(win.location && win.location.pathname)) return;
  const state = { watching: false };
  const refresh = () => {
    loadHomepageAds(win, doc);
    watchStoryAds(win, doc, state);
  };
  refresh();
  win.addEventListener('dailypulse-ad-consent', refresh);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  bootAds(window, document);
}
