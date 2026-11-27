/**
 * Single source for Daily Pulse display banners.
 * Mainstream Adsterra iframe units only — no popunders, Social Bar, SmartLinks, or interstitials.
 *
 * There is no 300x250 or 320x50 key in this repo. Story pages reuse the 728x90
 * leaderboard below 768px and scale it inside a reserved box. Replace `mobile`
 * with a real unit when one is created so phones can stop scaling the leaderboard.
 */
export const AD_HOST = 'https://www.highperformanceformat.com';

export const AD_UNITS = {
  leaderboard: {
    id: 'leaderboard',
    key: '5d1d33fad1aa774f2588e74770c88134',
    width: 728,
    height: 90,
  },
  skyscraper: {
    id: 'skyscraper',
    key: '198695a08a60e90b59f6a5370452a9fb',
    width: 160,
    height: 600,
  },
  mobile: null,
};

export const STORY_AD_LIMIT = 2;
export const MOBILE_BREAKPOINT = 768;

const BLOCKED_PATH = /^\/(terms|privacy|cookies)(\.html)?\/?$/i;

export function adsAllowedOnPath(pathname) {
  const path = String(pathname || '/').split('?')[0].split('#')[0];
  return !BLOCKED_PATH.test(path);
}

export function unitForStory(viewportWidth) {
  if (Number(viewportWidth) < MOBILE_BREAKPOINT && AD_UNITS.mobile) return AD_UNITS.mobile;
  return AD_UNITS.leaderboard;
}

export function buildAdSrcdoc(unit) {
  const key = String(unit && unit.key || '');
  const width = Number(unit && unit.width);
  const height = Number(unit && unit.height);
  if (!/^[a-f0-9]{32}$/.test(key) || !width || !height) return '';
  return '<!DOCTYPE html><' + 'html><head><style>*{margin:0;padding:0;overflow:hidden;}</style></head><body>'
    + '<script>atOptions={"key":"' + key + '","format":"iframe","height":' + height + ',"width":' + width + ',"params":{}};<\/script>'
    + '<script src="' + AD_HOST + '/' + key + '/invoke.js"><\/script>'
    + '</body></' + 'html>';
}
