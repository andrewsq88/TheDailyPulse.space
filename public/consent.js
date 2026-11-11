/** Advertising-cookie consent. Stored locally so the choice is remembered. */
(function () {
  var KEY = 'dailypulse-ad-consent';
  var EVENT = 'dailypulse-ad-consent';

  function getConsent() {
    try {
      var value = window.localStorage.getItem(KEY);
      if (value === 'accepted' || value === 'rejected') return value;
    } catch (error) {}
    return 'pending';
  }

  function setConsent(value) {
    try {
      window.localStorage.setItem(KEY, value);
    } catch (error) {}
    window.dispatchEvent(new Event(EVENT));
    render();
  }

  function hideAds() {
    var slots = document.querySelectorAll('#adsterra-sidebar, #adsterra-infeed');
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      slot.removeAttribute('srcdoc');
      slot.removeAttribute('src');
      slot.style.display = 'none';
      if (slot.parentElement) slot.parentElement.style.display = 'none';
    }
  }

  function render() {
    var existing = document.getElementById('ad-consent-banner');
    var consent = getConsent();
    if (consent === 'rejected') hideAds();
    if (consent !== 'pending') {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    var banner = document.createElement('div');
    banner.id = 'ad-consent-banner';
    banner.className = 'fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-900/10 backdrop-blur-sm';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'ad-consent-title');
    banner.setAttribute('aria-describedby', 'ad-consent-body');
    banner.innerHTML =
      '<div class="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">' +
      '<div class="sm:pr-4">' +
      '<h2 id="ad-consent-title" class="text-sm font-semibold text-slate-800">Advertising cookies</h2>' +
      '<p id="ad-consent-body" class="mt-1 text-xs leading-relaxed text-slate-600">We use third-party display ads that may set cookies. Ads load only if you accept. Cookieless analytics does not use advertising cookies and is described in the <a href="/privacy.html" class="underline decoration-slate-300 underline-offset-2">privacy policy</a>. You can change this later on the <a href="/cookies.html" class="underline decoration-slate-300 underline-offset-2">cookie policy</a>.</p>' +
      '</div>' +
      '<div class="flex shrink-0 gap-2">' +
      '<button type="button" data-consent="rejected" class="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reject ads</button>' +
      '<button type="button" data-consent="accepted" class="inline-flex min-h-11 items-center justify-center rounded-lg bg-gradient-to-r from-brand-600 to-brand-700 px-4 text-sm font-semibold text-white hover:from-brand-700 hover:to-brand-800">Accept ads</button>' +
      '</div></div>';
    banner.addEventListener('click', function (event) {
      var button = event.target.closest('[data-consent]');
      if (!button) return;
      setConsent(button.getAttribute('data-consent'));
    });
    document.body.appendChild(banner);
  }

  window.DailyPulseConsent = {
    get: getConsent,
    set: setConsent,
    accepted: function () { return getConsent() === 'accepted'; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
  window.addEventListener(EVENT, render);
})();
