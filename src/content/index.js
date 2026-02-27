/**
 * @module content/index
 * @description Main entry point for WebSuddhi content scripts.
 *
 * Wires together all content modules: phishing check (runs first),
 * ad blocking, paywall removal, anti-adblock bypass, pick/zap modes,
 * iframe detection, and the MutationObserver.
 *
 * Bundled by Rollup into a single IIFE for injection.
 *
 * @version 2.1.0
 */
'use strict';

// --- Modules ---
import { state, getCurrentHostname, isSiteWhitelisted, startUrlChangeDetection, saveSelectors } from './state.js';
import { setupMessageListener, registerHandler } from './messaging.js';
import { checkForPhishing } from './phishing.js';
import { applyBlocking, applySocialBlocking, scheduleDelayedPasses } from './cosmetic-filter.js';
import { unblockAll, unblockSelector, unblockSocialWidgets } from './element-hider.js';
import { detectAndRemovePaywall, removePaywall } from './paywall.js';
import { setupAntiAntiAdblock, handleAntiAdblock, removeAntiAdblockOverlays, shouldRunAggressiveAntiAdblock } from './anti-adblock.js';
import { setupMutationObserver, removePingAttributes } from './observer.js';
import { startPickMode, stopPickMode } from './picker.js';
import { startZapMode, stopZapMode } from './zap.js';
// showToast used by picker/zap modules directly
import { detectThirdPartyFrames, unblockFrame, reportFramesToBackground } from './iframe-detector.js';

// ============================================
// PHISHING CHECK — runs immediately (before DOM ready)
// ============================================
checkForPhishing();

// ============================================
// STORAGE HELPERS
// ============================================

const STORAGE_KEYS = [
  'enabled', 'paywallEnabled', 'socialBlockingEnabled',
  'blockedSelectors', 'whitelistedSites', 'toastDuration',
  'aggressiveAntiAdblockEnabled', 'cookieConsentEnabled',
  'annoyancesEnabled',
];

/**
 * Read extension storage (cross-browser).
 * @returns {Promise<object>}
 */
function getStorage() {
  if (self.WebSuddhi?.utils?.getStorage) {
    return self.WebSuddhi.utils.getStorage(STORAGE_KEYS);
  }
  return new Promise((resolve, reject) => {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.get(STORAGE_KEYS).then(resolve).catch(reject);
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(STORAGE_KEYS, (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result);
      });
    } else {
      resolve({});
    }
  });
}

/**
 * Write to extension storage (cross-browser).
 * @param {object} data
 * @returns {Promise<void>}
 */
function setStorage(data) {
  return new Promise((resolve, reject) => {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.set(data).then(resolve).catch(reject);
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

// saveSelectors is imported from state.js

// ============================================
// MESSAGE HANDLERS (registered via messaging module)
// ============================================

registerHandler('TOGGLE', async (msg) => {
  state.enabled = msg.enabled;
  if (state.enabled) applyBlocking(); else unblockAll();
  await setStorage({ enabled: state.enabled });
  return { success: true, enabled: state.enabled };
});

registerHandler('TOGGLE_PAYWALL', async (msg) => {
  state.paywallEnabled = msg.enabled;
  await setStorage({ paywallEnabled: state.paywallEnabled });
  if (state.paywallEnabled) detectAndRemovePaywall();
  return { success: true, paywallEnabled: state.paywallEnabled };
});

registerHandler('TOGGLE_SOCIAL_BLOCKING', async (msg) => {
  state.socialBlockingEnabled = msg.enabled;
  await setStorage({ socialBlockingEnabled: state.socialBlockingEnabled });
  if (state.socialBlockingEnabled) applySocialBlocking(); else unblockSocialWidgets();
  return { success: true, socialBlockingEnabled: state.socialBlockingEnabled };
});

registerHandler('WHITELIST_SITE', async (msg) => {
  const hostname = msg.hostname || getCurrentHostname();
  if (hostname && !state.whitelistedSites.includes(hostname)) {
    // Cap whitelist size to prevent unbounded growth
    if (state.whitelistedSites.length >= 1000) {
      return { success: false, error: 'Whitelist limit reached (1000 sites)' };
    }
    state.whitelistedSites.push(hostname);
    await setStorage({ whitelistedSites: state.whitelistedSites });
    unblockAll();
    state.enabled = false;
  }
  return { success: true, whitelisted: true };
});

registerHandler('UNWHITELIST_SITE', async (msg) => {
  const hostname = msg.hostname || getCurrentHostname();
  state.whitelistedSites = state.whitelistedSites.filter((s) => s !== hostname);
  await setStorage({ whitelistedSites: state.whitelistedSites });
  return { success: true, whitelisted: false };
});

registerHandler('GET_WHITELIST', async () => {
  return { success: true, sites: state.whitelistedSites };
});

registerHandler('START_PICK_MODE', async () => { startPickMode(); return { success: true }; });
registerHandler('STOP_PICK_MODE', async () => { stopPickMode(); return { success: true }; });
registerHandler('START_ZAP_MODE', async () => { startZapMode(); return { success: true }; });
registerHandler('STOP_ZAP_MODE', async () => { stopZapMode(); return { success: true }; });

registerHandler('TOGGLE_PICK_MODE', async () => {
  state.pickMode ? stopPickMode() : startPickMode();
  return { success: true, pickMode: state.pickMode };
});

registerHandler('TOGGLE_ZAP_MODE', async () => {
  state.zapMode ? stopZapMode() : startZapMode();
  return { success: true, zapMode: state.zapMode };
});

registerHandler('TOGGLE_COOKIE_CONSENT', async (msg) => {
  state.cookieConsentEnabled = msg.enabled;
  await setStorage({ cookieConsentEnabled: state.cookieConsentEnabled });
  if (state.cookieConsentEnabled) applyBlocking();
  return { success: true, cookieConsentEnabled: state.cookieConsentEnabled };
});

registerHandler('TOGGLE_ANNOYANCE_BLOCKING', async (msg) => {
  state.annoyancesEnabled = msg.enabled;
  await setStorage({ annoyancesEnabled: state.annoyancesEnabled });
  if (state.annoyancesEnabled) applyBlocking();
  return { success: true, annoyancesEnabled: state.annoyancesEnabled };
});

registerHandler('REMOVE_PAYWALL', async () => {
  const removed = removePaywall();
  return { success: true, removed };
});

registerHandler('ADD_SELECTOR', async (msg) => {
  // Validate the selector before adding (FIX: skip malicious selectors)
  const sel = msg.selector;
  if (!sel || typeof sel !== 'string') {
    return { success: false, error: 'Invalid selector' };
  }
  try { document.querySelector(sel); } catch (_) {
    return { success: false, error: 'Invalid CSS selector' };
  }
  state.blockedSelectors.set(sel, {
    url: window.location.hostname,
    date: Date.now(),
  });
  await saveSelectors();
  applyBlocking();
  return { success: true };
});

registerHandler('REMOVE_SELECTOR', async (msg) => {
  state.blockedSelectors.delete(msg.selector);
  await saveSelectors();
  unblockSelector(msg.selector);
  return { success: true };
});

registerHandler('GET_STATUS', async () => {
  return {
    success: true,
    enabled: state.enabled,
    paywallEnabled: state.paywallEnabled,
    blockedCount: state.blockedCount,
    url: window.location.href,
  };
});

registerHandler('GET_SELECTORS', async () => {
  return { success: true, selectors: Array.from(state.blockedSelectors.entries()) };
});

registerHandler('RELOAD_RULES', async () => {
  const storage = await getStorage();
  state.blockedSelectors = new Map();
  for (const entry of storage.blockedSelectors || []) {
    if (Array.isArray(entry)) {
      state.blockedSelectors.set(entry[0], entry[1]);
    } else if (entry?.selector) {
      state.blockedSelectors.set(entry.selector, { url: entry.hostname, date: entry.date });
    }
  }
  state.whitelistedSites = storage.whitelistedSites || [];
  state.enabled = storage.enabled !== false;
  if (isSiteWhitelisted()) state.enabled = false;
  if (state.enabled) applyBlocking(); else unblockAll();
  return { success: true };
});

registerHandler('GET_FRAMES', async () => {
  return { success: true, frames: detectThirdPartyFrames() };
});

registerHandler('ALLOW_FRAME', async (msg) => {
  if (msg.frameHost) unblockFrame(msg.frameHost);
  return { success: true };
});

registerHandler('SETTINGS_CHANGED', async () => {
  // Re-read storage and re-apply everything (same as RELOAD_RULES)
  const storage = await getStorage();
  state.blockedSelectors = new Map();
  for (const entry of storage.blockedSelectors || []) {
    if (Array.isArray(entry)) {
      state.blockedSelectors.set(entry[0], entry[1]);
    } else if (entry?.selector) {
      state.blockedSelectors.set(entry.selector, { url: entry.hostname, date: entry.date });
    }
  }
  state.whitelistedSites = storage.whitelistedSites || [];
  state.enabled = storage.enabled !== false;
  state.paywallEnabled = storage.paywallEnabled !== false;
  state.socialBlockingEnabled = storage.socialBlockingEnabled === true;
  state.cookieConsentEnabled = storage.cookieConsentEnabled === true;
  state.annoyancesEnabled = storage.annoyancesEnabled === true;
  if (isSiteWhitelisted()) state.enabled = false;
  if (state.enabled) applyBlocking(); else unblockAll();
  return { success: true };
});

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  try {
    const storage = await getStorage();

    // Apply settings to state
    state.enabled = storage.enabled !== false;
    state.paywallEnabled = storage.paywallEnabled !== false;
    state.socialBlockingEnabled = storage.socialBlockingEnabled === true;
    state.cookieConsentEnabled = storage.cookieConsentEnabled === true;
    state.annoyancesEnabled = storage.annoyancesEnabled === true;
    state.whitelistedSites = storage.whitelistedSites || [];
    state.toastDuration = storage.toastDuration || 3;

    // Load blocked selectors
    state.blockedSelectors = new Map();
    for (const entry of storage.blockedSelectors || []) {
      if (Array.isArray(entry)) {
        state.blockedSelectors.set(entry[0], entry[1]);
      } else if (entry?.selector) {
        state.blockedSelectors.set(entry.selector, { url: entry.hostname, date: entry.date });
      }
    }

    // Skip if whitelisted
    if (isSiteWhitelisted()) state.enabled = false;

    // Anti-anti-adblock (early, only when safe)
    if (state.enabled && shouldRunAggressiveAntiAdblock(storage)) {
      setupAntiAntiAdblock();
    }

    if (state.enabled) {
      applyBlocking();
      scheduleDelayedPasses(); // One-time delayed re-scans for late-loading content
      removePingAttributes();
    }

    if (state.socialBlockingEnabled && !isSiteWhitelisted()) {
      applySocialBlocking();
    }

    if (state.paywallEnabled && !isSiteWhitelisted()) {
      setTimeout(() => detectAndRemovePaywall(), 1000);
      setTimeout(() => detectAndRemovePaywall(), 3000);
    }

    if (state.enabled) {
      setTimeout(() => handleAntiAdblock(), 1500);
      setTimeout(() => handleAntiAdblock(), 4000);
      setTimeout(() => removeAntiAdblockOverlays(), 2000);
      setTimeout(() => removeAntiAdblockOverlays(), 5000);
    }

    // Message listener
    setupMessageListener();

    // Re-apply on tab focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.enabled && !isSiteWhitelisted()) {
        applyBlocking();
      }
    });

    // SPA URL change detection (FIX #13)
    startUrlChangeDetection(() => {
      if (state.enabled && !isSiteWhitelisted()) {
        applyBlocking();
        removePingAttributes();
        if (state.paywallEnabled) detectAndRemovePaywall();
      }
    });

    // Start observer + iframe reporting when body is ready
    const startObserver = () => {
      if (state.enabled && !isSiteWhitelisted()) applyBlocking();
      setupMutationObserver();
      setTimeout(reportFramesToBackground, 2000);
    };

    if (document.body) {
      setTimeout(startObserver, 100);
    } else {
      document.addEventListener('DOMContentLoaded', () => setTimeout(startObserver, 100));
    }
  } catch (err) {
    console.error('[WebSuddhi] init error:', err);
  }
}

// ============================================
// START
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
