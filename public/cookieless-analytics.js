/**
 * Cookieless first-party pageview beacon, plus optional GoatCounter.
 * GoatCounter is free for reasonable public use and does not require a card,
 * but accounts must be created by a human. This script only loads GoatCounter
 * when a goatcounter-code meta tag is present.
 */
(function () {
  function payload() {
    return JSON.stringify({
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || '',
      ts: new Date().toISOString(),
      viewport: window.innerWidth + 'x' + window.innerHeight,
    });
  }

  function sendFirstParty() {
    var body = payload();
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/collect', new Blob([body], { type: 'application/json' }))) {
        return;
      }
    } catch (error) {}
    try {
      fetch('/collect', { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true, credentials: 'omit' }).catch(function () {});
    } catch (error) {}
  }

  function goatCode() {
    var meta = document.querySelector('meta[name="goatcounter-code"]');
    var code = meta && meta.getAttribute('content');
    return code && /^[a-z0-9-]+$/i.test(code) ? code : '';
  }

  function loadGoatCounter(code) {
    if (document.querySelector('script[data-cookieless-analytics="goatcounter"]')) return;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://gc.zgo.at/count.js';
    script.dataset.goatcounter = 'https://' + code + '.goatcounter.com/count';
    script.dataset.cookielessAnalytics = 'goatcounter';
    document.head.appendChild(script);
  }

  var code = goatCode();
  if (code) loadGoatCounter(code);
  sendFirstParty();
})();
