/**
 * @module content/anti-adblock
 * @description Anti-adblock bypass engine.
 *
 * Neutralises scripts that detect ad blockers and show "disable adblocker"
 * overlays. Creates fake ad elements, intercepts detection fetches/XHR,
 * and overrides detection variables.
 *
 * FIX #8 (MV3 limitation): In Chrome MV3, content scripts execute in an
 * isolated world — Object.defineProperty on `window` does NOT reach the
 * page's JS context. The bypass still works in Firefox (MV2) and partially
 * in Chrome MV3 for DOM-based detections. For full MV3 support, the
 * background script should use `chrome.scripting.executeScript` with
 * `world: 'MAIN'` to inject the variable overrides. This module sends a
 * message to the background to trigger that injection.
 *
 * @version 2.1.0
 */
'use strict';

import { state } from './state.js';
import { ANTI_ADBLOCK_SELECTORS } from './selectors.js';
import { sendMessage } from './messaging.js';
import { restoreBodyScroll } from './paywall.js';

// ============================================
// GUARD
// ============================================

/**
 * Check whether aggressive anti-adblock bypass should run.
 * Skips sensitive pages (bank, login) and password fields.
 *
 * @param {object} storage - Extension storage values.
 * @returns {boolean}
 */
export function shouldRunAggressiveAntiAdblock(storage) {
  if (storage?.aggressiveAntiAdblockEnabled !== true) return false;

  try {
    if (window.top !== window) return false;
  } catch (_) {
    return false;
  }

  const protocol = window.location.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') return false;

  const hostname = (window.location.hostname || '').toLowerCase();
  const pathname = (window.location.pathname || '').toLowerCase();
  const sensitivePattern = /(bank|pay|secure|login|account)/i;
  if (sensitivePattern.test(hostname) || sensitivePattern.test(pathname)) return false;

  try {
    if (document.querySelector('input[type="password"]')) return false;
  } catch (_) { /* skip */ }

  return true;
}

// ============================================
// SETUP
// ============================================

/**
 * Main setup: override detection vars, create fake ads,
 * intercept detection requests, neutralise scripts, remove overlays.
 *
 * Also sends INJECT_ANTI_ADBLOCK to background for MV3 world:'MAIN'
 * injection (FIX #8).
 */
export function setupAntiAntiAdblock() {
  if (!state.enabled) return;

  try {
    // --- Content-script-world overrides (MV2 / Firefox) ---
    overrideDetectionVariables();
    createFakeAdElements();
    interceptAntiAdblockRequests();
    neutralizeDetectionScripts();
    removeAntiAdblockOverlays();

    // --- FIX #8: Request background to inject into MAIN world (MV3) ---
    requestMainWorldInjection();
  } catch (_) {
    // Best-effort: anti-adblock bypass is non-critical
  }
}

// ============================================
// OVERLAY REMOVAL
// ============================================

/**
 * Remove anti-adblock overlays matching known selectors.
 * Also scans fixed/absolute elements for adblock-related text.
 */
export function removeAntiAdblockOverlays() {
  const overlaySelector = ANTI_ADBLOCK_SELECTORS.join(',');

  try {
    document.querySelectorAll(overlaySelector).forEach((el) => {
      if (!el.hasAttribute('data-websuddhi-removed')) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.style.setProperty('position', 'absolute', 'important');
        el.style.setProperty('z-index', '-9999', 'important');
        el.setAttribute('data-websuddhi-removed', 'anti-adblock-overlay');
        state.blockedCount++;
      }
    });
  } catch (_) { /* skip */ }

  // Scan text-based adblock prompts on positioned elements
  try {
    const textPatterns = [
      'adblock detected', 'ad blocker detected', 'adblocker detected',
      'disable your ad blocker', 'disable adblock', 'turn off adblock',
      'whitelist this site', 'whitelist us', 'disable your adblocker',
      'please disable', 'ad-blocker', 'adblocker',
    ];

    const positioned = document.querySelectorAll(
      '[style*="position: fixed"], [style*="position:fixed"], ' +
      '[style*="position: absolute"], [style*="position:absolute"]'
    );

    positioned.forEach((el) => {
      if (el.hasAttribute('data-websuddhi-removed')) return;

      const text = (el.innerText || '').toLowerCase().substring(0, 500);
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex) || 0;

      if (zIndex > 100 && textPatterns.some((p) => text.includes(p))) {
        el.style.setProperty('display', 'none', 'important');
        el.setAttribute('data-websuddhi-removed', 'anti-adblock-text');
        state.blockedCount++;
        restoreBodyScroll();
      }
    });
  } catch (_) { /* skip */ }
}

/**
 * Handle anti-adblock detection (selector-based removal + body scroll).
 */
export function handleAntiAdblock() {
  if (!state.enabled) return;

  try {
    const combinedSelector = ANTI_ADBLOCK_SELECTORS.join(',');
    document.querySelectorAll(combinedSelector).forEach((el) => {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('data-websuddhi-removed', 'anti-adblock');
      state.blockedCount++;
    });
  } catch (_) { /* skip */ }

  restoreBodyScroll();
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Override common adblock-detection window variables.
 * Works in content-script world (MV2/Firefox), no-op in MV3 isolated world.
 * @private
 */
function overrideDetectionVariables() {
  const falseyVars = [
    'adblock', 'adBlock', 'AdBlock',
    'adblockDetected', 'adBlockDetected',
    'isAdblockEnabled', 'hasAdblock',
    'adblockEnabled', 'adBlockEnabled',
    'blockAdBlock', 'fuckAdBlock',
    'noAdBlock', 'adsBlocked',
    'adBlocker', 'adblocker',
  ];

  falseyVars.forEach((v) => {
    try { if (window[v] !== undefined) window[v] = false; } catch (_) {}
  });

  const truthyVars = [
    'canRunAds', 'adsCanRun', 'adsbygoogle',
    'adsLoaded', 'adLoaded', 'googleads',
    'showAds', 'displayAds',
  ];

  truthyVars.forEach((v) => {
    try { window[v] = true; } catch (_) {}
  });

  // defineProperty traps
  const protectedProps = [
    'adblock', 'adBlock', 'adblockDetected', 'adBlockDetected',
    'blockAdBlock', 'fuckAdBlock', 'isAdblockEnabled',
    'canRunAds', 'adsBlocked',
  ];

  protectedProps.forEach((prop) => {
    try {
      Object.defineProperty(window, prop, {
        get() {
          return prop.toLowerCase().includes('canrun') || prop.toLowerCase().includes('loaded')
            ? true
            : false;
        },
        set() { return true; },
        configurable: true,
      });
    } catch (_) {}
  });
}

/**
 * Create invisible fake ad elements that detection scripts expect.
 * @private
 */
function createFakeAdElements() {
  const fakeAdClasses = ['ad', 'ads', 'adsbox', 'ad-banner', 'ad-placeholder'];

  fakeAdClasses.forEach((className) => {
    if (document.querySelector('.' + className + '[data-websuddhi-fake-ad]')) return;

    const fakeAd = document.createElement('div');
    fakeAd.className = className;
    fakeAd.setAttribute('data-websuddhi-fake-ad', 'true');
    fakeAd.style.cssText =
      'position:absolute!important;left:-9999px!important;top:-9999px!important;' +
      'width:1px!important;height:1px!important;opacity:0.01!important;' +
      'pointer-events:none!important;visibility:visible!important;display:block!important;';
    fakeAd.innerHTML = '&nbsp;';
    if (document.body) document.body.appendChild(fakeAd);
  });

  // Fake doubleclick/googlesyndication iframe
  if (!document.querySelector('iframe[data-websuddhi-fake-ad]')) {
    const fakeIframe = document.createElement('iframe');
    fakeIframe.setAttribute('data-websuddhi-fake-ad', 'true');
    fakeIframe.style.cssText =
      'position:absolute!important;left:-9999px!important;top:-9999px!important;' +
      'width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;';
    fakeIframe.src = 'about:blank';
    if (document.body) document.body.appendChild(fakeIframe);
  }
}

/**
 * Intercept fetch / XHR to known anti-adblock endpoints and return
 * fake "ads can run" responses.
 * @private
 */
function interceptAntiAdblockRequests() {
  const endpoints = [
    'pagead2.googlesyndication.com', 'pagead.googlesyndication.com',
    'doubleclick.net', 'adservice.google', 'blockadblock',
    'fuckadblock', 'admiral', 'adblock-detect', 'adb-detect',
    'adblock.js', 'ads.js', 'advertisement.js',
    'detect-adblock', 'anti-adblock', 'antiblock',
  ];

  // Intercept fetch
  const originalFetch = window.fetch;
  if (originalFetch && !window._websuddhi_fetch_intercepted) {
    window._websuddhi_fetch_intercepted = true;
    window.fetch = function (url, _options) {
      try {
        const urlStr = typeof url === 'string' ? url : url.url || url.href || '';
        const urlLower = urlStr.toLowerCase();
        if (endpoints.some((ep) => urlLower.includes(ep.toLowerCase()))) {
          return Promise.resolve(
            new Response('var canRunAds=true;', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' },
            })
          );
        }
      } catch (_) {}
      return originalFetch.apply(this, arguments);
    };
  }

  // Intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  if (originalOpen && !window._websuddhi_xhr_intercepted) {
    window._websuddhi_xhr_intercepted = true;

    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        const urlStr = typeof url === 'string' ? url : url.href || '';
        if (endpoints.some((ep) => urlStr.toLowerCase().includes(ep.toLowerCase()))) {
          this._websuddhi_intercept = true;
        }
      } catch (_) {}
      return originalOpen.apply(this, arguments);
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      if (this._websuddhi_intercept) {
        Object.defineProperty(this, 'readyState', { value: 4 });
        Object.defineProperty(this, 'status', { value: 200 });
        Object.defineProperty(this, 'responseText', { value: 'var canRunAds=true;' });
        Object.defineProperty(this, 'response', { value: 'var canRunAds=true;' });
        setTimeout(() => {
          if (typeof this.onreadystatechange === 'function') this.onreadystatechange();
          if (typeof this.onload === 'function') this.onload();
        }, 10);
        return;
      }
      return originalSend.apply(this, arguments);
    };
  }
}

/**
 * Neutralise BlockAdBlock / FuckAdBlock library instances.
 * @private
 */
function neutralizeDetectionScripts() {
  const neutralObj = {
    check() { return false; },
    on() { return this; },
    onDetected() { return this; },
    onNotDetected(fn) { if (typeof fn === 'function') fn(); return this; },
  };

  try {
    if (typeof window.BlockAdBlock === 'function') {
      window.BlockAdBlock = function () { return Object.create(neutralObj); };
    }
    if (typeof window.FuckAdBlock === 'function') {
      window.FuckAdBlock = function () { return Object.create(neutralObj); };
    }
    window.blockAdBlock = Object.create(neutralObj);
    window.fuckAdBlock = Object.create(neutralObj);
    window.sniffAdBlock = Object.create(neutralObj);
    window.adBlockDetected = function () {};
    window.adBlockNotDetected = function () {};
    window.onAdBlockDetected = function () {};
  } catch (_) {}
}

/**
 * Request the background service worker to inject anti-adblock
 * overrides into the MAIN world (Chrome MV3).
 * @private
 */
function requestMainWorldInjection() {
  sendMessage({ type: 'INJECT_ANTI_ADBLOCK', tabId: null }).catch(() => {
    // Background may not support this yet — that's OK
  });
}
