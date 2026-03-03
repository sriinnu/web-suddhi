/**
 * @module content/cosmetic-filter
 * @description Cosmetic filtering engine for WebSuddhi.
 *
 * Applies CSS-based element hiding to remove ads, social widgets,
 * and other unwanted content from the visible page.
 *
 * FIX #54: Debounced stats reporting to avoid redundant INCREMENT_STATS
 * messages flooding the background service worker.
 *
 * @version 2.1.0
 */
'use strict';

import { state, getCurrentHostname, isSiteWhitelisted } from './state.js';
import { ALL_AD_SELECTORS, AD_TAGS, SOCIAL_WIDGET_SELECTORS } from './selectors.js';
import { hideElement, hideSocialElement } from './element-hider.js';
import { sendMessage } from './messaging.js';

// ============================================
// DEBOUNCED STATS REPORTING (FIX #54)
// ============================================

/** @type {number|null} Pending report timer id */
let cosmeticReportTimeout = null;

/** @type {number} Count of blocks since last report */
let pendingCosmeticCount = 0;

/** @type {string} Last blocked selector for logging */
let lastBlockedSelector = '';

/**
 * Check if a response indicates an unknown message type.
 *
 * @param {object|undefined} response - Message response.
 * @returns {boolean}
 * @private
 */
function isUnknownMessageTypeResponse(response) {
  return Boolean(
    response &&
    response.success === false &&
    typeof response.error === 'string' &&
    response.error.toLowerCase().includes('unknown message type')
  );
}

/**
 * Send cosmetic stats to the background, falling back to
 * INCREMENT_COSMETIC_STATS if INCREMENT_STATS is unrecognised.
 *
 * @param {{ hostname: string, count: number, selector: string }} payload
 * @private
 */
function sendCosmeticStats(payload) {
  sendMessage({ type: 'INCREMENT_STATS', ...payload })
    .then((response) => {
      if (isUnknownMessageTypeResponse(response)) {
        return sendMessage({ type: 'INCREMENT_COSMETIC_STATS', ...payload });
      }
      return response;
    })
    .catch(() => {
      sendMessage({ type: 'INCREMENT_COSMETIC_STATS', ...payload }).catch(() => {});
    });
}

/**
 * Report a cosmetic block to the background (debounced).
 * Batches multiple blocks into a single message to reduce IPC overhead.
 *
 * @param {string} [selector] - The CSS selector that matched.
 */
export function reportCosmeticBlockDebounced(selector) {
  pendingCosmeticCount++;
  if (selector) lastBlockedSelector = selector;

  clearTimeout(cosmeticReportTimeout);
  cosmeticReportTimeout = setTimeout(() => {
    const count = pendingCosmeticCount;
    const selectorToReport = lastBlockedSelector;
    pendingCosmeticCount = 0;
    lastBlockedSelector = '';
    try {
      sendCosmeticStats({
        hostname: getCurrentHostname(),
        count,
        selector: selectorToReport,
      });
    } catch (_) { /* best-effort */ }
  }, 2000);
}

// ============================================
// CORE BLOCKING
// ============================================

/**
 * Apply all cosmetic blocking rules to the current page.
 * Runs user-defined selectors, built-in ad selectors, attribute
 * checks, dynamic content handling, and optional social blocking.
 */
export function applyBlocking() {
  if (!state.enabled || isSiteWhitelisted()) return;

  // User-defined selectors first
  for (const selector of state.blockedSelectors.keys()) {
    blockSelector(selector);
  }

  // Built-in ad selectors
  for (const selector of ALL_AD_SELECTORS) {
    blockSelector(selector);
  }

  blockByAttributes();

  if (state.socialBlockingEnabled) {
    applySocialBlocking();
  }
}

/**
 * Schedule delayed re-scans for late-loading content.
 *
 * **Must be called only once** (e.g. at init time).  Each callback
 * calls `applyBlocking()` — which does NOT recurse back here, so
 * there is no exponential timeout growth.
 */
export function scheduleDelayedPasses() {
  setTimeout(() => applyBlocking(), 500);
  setTimeout(() => applyBlocking(), 1500);
  setTimeout(() => applyBlocking(), 3000);
}

/**
 * Hide all elements that match a given CSS selector.
 *
 * @param {string} selector - CSS selector to match.
 */
export function blockSelector(selector) {
  try {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      if (isVisible(el) && !el.hasAttribute('data-websuddhi-blocked')) {
        hideElement(el, selector);
      }
    });
  } catch (_) { /* invalid selector — skip */ }
}

/**
 * Block elements identified by known ad-related tag + attribute combos
 * (e.g. `<ins class="adsbygoogle">`, `<iframe src="...doubleclick...">`)
 */
export function blockByAttributes() {
  AD_TAGS.forEach(({ tag, attrs }) => {
    try {
      document.querySelectorAll(tag).forEach((el) => {
        if (el.hasAttribute('data-websuddhi-blocked')) return;

        const attrNames = Array.from(el.attributes).map((a) => a.name.toLowerCase());
        const attrValues = Array.from(el.attributes).map(
          (a) => (a.name + '=' + a.value).toLowerCase()
        );
        const combined = attrNames.concat(attrValues).join(' ');

        const hasAdAttr = attrs.some((adAttr) =>
          combined.includes(adAttr.toLowerCase())
        );

        if (hasAdAttr && isVisible(el)) {
          hideElement(el);
        }
      });
    } catch (_) { /* skip */ }
  });

  // Explicit data-ad / data-ads / data-advertisement attributes
  try {
    document.querySelectorAll('[data-ad], [data-ads], [data-advertisement]').forEach((el) => {
      if (isVisible(el) && !el.hasAttribute('data-websuddhi-blocked')) {
        hideElement(el);
      }
    });
  } catch (_) { /* skip */ }
}

// ============================================
// SHADOW DOM
// ============================================

/**
 * Recursively scan Shadow DOM trees for ad elements.
 *
 * @param {HTMLElement|Document} [container=document.body] - Root to scan.
 */
export function handleShadowDOM(container) {
  container = container || document.body;
  if (!container) return;

  const findInShadow = (root) => {
    if (!root) return;

    for (const selector of ALL_AD_SELECTORS) {
      try {
        root.querySelectorAll(selector).forEach((el) => {
          if (isVisible(el) && !el.hasAttribute('data-websuddhi-blocked')) {
            hideElement(el);
          }
        });
      } catch (_) { /* skip */ }
    }

    try {
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) findInShadow(el.shadowRoot);
      });
    } catch (_) { /* skip */ }
  };

  if (container.shadowRoot) findInShadow(container.shadowRoot);
  findInShadow(container);
}

// ============================================
// SOCIAL WIDGET BLOCKING
// ============================================

/**
 * Apply social widget blocking using the social selector list.
 */
export function applySocialBlocking() {
  if (!state.socialBlockingEnabled || isSiteWhitelisted()) return;

  for (const selector of SOCIAL_WIDGET_SELECTORS) {
    try {
      document.querySelectorAll(selector).forEach((el) => {
        if (isVisible(el) && !el.hasAttribute('data-websuddhi-blocked')) {
          hideSocialElement(el);
        }
      });
    } catch (_) { /* skip */ }
  }
}

// ============================================
// VISIBILITY HELPER
// ============================================

/**
 * Check if an element is visible in the DOM.
 * Uses shared utils when available, with an inline fallback.
 *
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isVisible(el) {
  if (self.WebSuddhi?.utils?.isVisible) {
    return self.WebSuddhi.utils.isVisible(el);
  }
  if (!el) return false;
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}
