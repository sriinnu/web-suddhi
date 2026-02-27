/**
 * @module content/state
 * @description Centralized state management for WebSuddhi content scripts.
 * All mutable state lives here so modules can import and share it without
 * passing references around.
 *
 * FIX #13: Added `currentUrl` tracking and `onUrlChange` callback support
 * for SPA (Single Page Application) route-change detection.
 *
 * @version 2.1.0
 */
'use strict';

/**
 * Central content-script state.
 * Every content module imports this same object reference.
 *
 * @type {Object}
 */
export const state = {
  /** @type {boolean} Master ad-blocking enabled flag */
  enabled: true,

  /** @type {boolean} Paywall bypass enabled */
  paywallEnabled: true,

  /** @type {boolean} Social widget blocking enabled */
  socialBlockingEnabled: false,

  /** @type {boolean} Cookie consent auto-dismiss enabled */
  cookieConsentEnabled: false,

  /** @type {boolean} Annoyance blocking enabled */
  annoyancesEnabled: false,

  /** @type {string[]} Hostnames the user has whitelisted */
  whitelistedSites: [],

  /**
   * User-defined CSS selectors for element hiding.
   * Key = CSS selector string, Value = { url, date, source }
   * @type {Map<string, {url: string, date: number, source?: string}>}
   */
  blockedSelectors: new Map(),

  // ---- Pick / Zap mode ----
  /** @type {boolean} */
  pickMode: false,
  /** @type {boolean} */
  pickModeShiftHeld: false,
  /** @type {boolean} */
  pickModeCtrlHeld: false,
  /** @type {boolean} */
  pickDialogOpen: false,
  /** @type {boolean} */
  zapMode: false,

  /** @type {HTMLElement|null} Currently hovered element in pick/zap mode */
  hoveredElement: null,

  // ---- Observers & timers ----
  /** @type {MutationObserver|null} Main DOM mutation observer */
  observer: null,
  /** @type {number|null} Debounce timer for observer callback */
  observerTimeout: null,

  // ---- Counters ----
  /** @type {number} Elements blocked on this page load */
  blockedCount: 0,

  // ---- Misc ----
  /** @type {string|null} Original body overflow before paywall removal */
  bodyOverflowOriginal: null,
  /** @type {number} Toast auto-close duration in seconds */
  toastDuration: 3,

  // ---- SPA tracking (FIX #13) ----
  /** @type {string} Last known URL for SPA route-change detection */
  currentUrl: typeof window !== 'undefined' ? window.location.href : '',
};

// ============================================
// HOSTNAME HELPERS
// ============================================

/**
 * Get the current page hostname with `www.` stripped.
 * @returns {string} Normalized hostname, or empty string on error.
 */
export function getCurrentHostname() {
  try {
    return window.location.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Check whether the current site is in the user's whitelist.
 * Matches exact hostname or parent domain.
 *
 * @returns {boolean} `true` if whitelisted.
 */
export function isSiteWhitelisted() {
  const hostname = getCurrentHostname();
  if (!hostname) return false;

  return state.whitelistedSites.some((site) => {
    const normalized = site.replace(/^www\./, '');
    return hostname === normalized || hostname.endsWith('.' + normalized);
  });
}

/**
 * Check if the current page is served over HTTP(S).
 * @returns {boolean}
 */
export function isHttpOrHttpsPage() {
  const protocol = window.location.protocol;
  return protocol === 'http:' || protocol === 'https:';
}

/**
 * Check if this script is running in the top-level frame.
 * @returns {boolean}
 */
export function isTopFrame() {
  try {
    return window.top === window;
  } catch {
    return false;
  }
}

// ============================================
// SPA ROUTE-CHANGE DETECTION  (FIX #13)
// ============================================

/** @type {Array<(newUrl: string, oldUrl: string) => void>} */
const urlChangeCallbacks = [];

/**
 * Register a callback that fires whenever the page URL changes
 * (supports both full navigations and SPA client-side routing).
 *
 * @param {(newUrl: string, oldUrl: string) => void} callback
 */
export function onUrlChange(callback) {
  if (typeof callback === 'function') {
    urlChangeCallbacks.push(callback);
  }
}

/**
 * Start monitoring for URL changes via `popstate`, `hashchange`,
 * and a periodic poll (catches `history.pushState`/`replaceState`
 * which don't fire events).
 *
 * Called once during init.
 *
 * @param {((newUrl: string, oldUrl: string) => void)} [callback] - Optional
 *   callback registered before monitoring starts.
 */
export function startUrlChangeDetection(callback) {
  if (typeof callback === 'function') {
    urlChangeCallbacks.push(callback);
  }

  const check = () => {
    const newUrl = window.location.href;
    if (newUrl !== state.currentUrl) {
      const oldUrl = state.currentUrl;
      state.currentUrl = newUrl;
      for (const cb of urlChangeCallbacks) {
        try { cb(newUrl, oldUrl); } catch { /* swallow */ }
      }
    }
  };

  window.addEventListener('popstate', check);
  window.addEventListener('hashchange', check);

  // Periodic poll for pushState/replaceState (every 1 s)
  setInterval(check, 1000);
}

/**
 * Reset per-page state values when a SPA route change is detected.
 * Called by the URL-change handler in the init module.
 */
export function resetPageState() {
  state.blockedCount = 0;
  state.bodyOverflowOriginal = null;
}

// ============================================
// SELECTOR PERSISTENCE
// ============================================

/**
 * Save `state.blockedSelectors` Map to extension storage.
 *
 * Serializes as an array of `{ selector, hostname, date }` objects.
 * Used by Pick Mode, Zap Mode, and the message handlers.
 *
 * @returns {Promise<void>}
 */
export async function saveSelectors() {
  const data = Array.from(state.blockedSelectors.entries()).map(([selector, info]) => ({
    selector,
    hostname: info.url || info.hostname,
    date: info.date,
  }));

  return new Promise((resolve, reject) => {
    if (typeof browser !== 'undefined' && browser.storage) {
      browser.storage.local.set({ blockedSelectors: data }).then(resolve).catch(reject);
    } else if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ blockedSelectors: data }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    } else {
      try {
        localStorage.setItem('websuddhi_selectors', JSON.stringify(data));
        resolve();
      } catch (err) { reject(err); }
    }
  });
}
