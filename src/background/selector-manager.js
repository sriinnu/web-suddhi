/**
 * @module selector-manager
 * @description CSS selector management for WebSuddhi element hiding rules.
 *
 * Fix issue #29: Removed dead `storage.tabs` lookup when adding selectors.
 * Now retrieves the tab URL directly via `chrome.tabs.get()`.
 *
 * @version 2.1.0
 */
'use strict';

import { getStorage, setStorage } from '../shared/storage.js';
import { isValidCSSSelector } from '../shared/css-validator.js';
import { notifyAllTabs } from './tab-manager.js';

// ============================================
// CROSS-BROWSER API
// ============================================

/** @returns {object} @private */
function getApi() {
  if (typeof browser !== 'undefined' && browser?.runtime) return browser;
  if (typeof chrome !== 'undefined' && chrome?.runtime) return chrome;
  return /** @type {*} */ ({});
}

// ============================================
// NORMALISATION
// ============================================

/**
 * Normalise a selector entry to the canonical `{ selector, hostname, date }`
 * shape. Validates the selector via `isValidCSSSelector`.
 *
 * @param {string|Object} entry - Raw selector string or entry object.
 * @returns {{ selector: string, hostname: string, date: number }|null}
 *   Normalised entry, or `null` if invalid.
 */
export function normalizeSelectorEntry(entry) {
  let selector = '';
  let hostname = 'imported';
  let date = Date.now();

  if (typeof entry === 'string') {
    selector = entry.trim();
  } else if (entry && typeof entry.selector === 'string') {
    selector = entry.selector.trim();
    if (typeof entry.hostname === 'string' && entry.hostname.trim()) {
      hostname = entry.hostname.trim();
    }
    if (Number.isFinite(entry.date)) {
      date = entry.date;
    }
  }

  if (!selector) return null;
  if (!isValidCSSSelector(selector)) return null;

  return { selector, hostname, date };
}

/**
 * Merge two selector arrays, deduplicating by selector string.
 *
 * @param {Array} existing - Current persisted entries.
 * @param {Array} incoming - New entries to merge.
 * @param {number} maxItems - Hard cap on result length.
 * @returns {Array<{ selector: string, hostname: string, date: number }>}
 */
export function mergeSelectorEntries(existing, incoming, maxItems) {
  const merged = [];
  const seen = new Set();

  /** @param {*} entry */
  function addEntry(entry) {
    const normalized = normalizeSelectorEntry(entry);
    if (!normalized || seen.has(normalized.selector)) return;
    seen.add(normalized.selector);
    merged.push(normalized);
  }

  for (const entry of existing || []) addEntry(entry);
  for (const entry of incoming || []) addEntry(entry);

  return merged.slice(0, maxItems);
}

// ============================================
// CRUD
// ============================================

/**
 * Add a CSS selector to the persisted block list.
 *
 * Fix #29: Retrieves the tab URL directly via `chrome.tabs.get()` instead
 * of a dead `storage.tabs` lookup.
 *
 * @param {number} tabId - The tab that triggered the selector.
 * @param {string} selector - CSS selector string.
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function addSelector(tabId, selector) {
  if (!tabId || !selector) {
    return { success: false, error: 'Missing tabId or selector' };
  }

  if (!isValidCSSSelector(selector)) {
    return { success: false, error: 'Invalid CSS selector' };
  }

  const storage = await getStorage(['blockedSelectors']);
  const selectors = storage.blockedSelectors || [];

  if (selectors.some((s) => s.selector === selector)) {
    return { success: false, error: 'Selector already blocked' };
  }

  // Fix #29: get tab URL directly from the API
  const api = getApi();
  let hostname = 'unknown';
  try {
    const tab = await new Promise((resolve) => {
      api.tabs.get(tabId, (t) => {
        if (api.runtime.lastError) resolve(null);
        else resolve(t);
      });
    });
    if (tab?.url) hostname = new URL(tab.url).hostname;
  } catch (_e) { /* ignore */ }

  selectors.push({ selector, hostname, date: Date.now() });
  await setStorage({ blockedSelectors: selectors });
  await notifyAllTabs();

  return { success: true, message: 'Selector added' };
}

/**
 * Remove a CSS selector from the persisted block list.
 *
 * @param {string} selector - The selector string to remove.
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export async function removeSelector(selector) {
  const storage = await getStorage(['blockedSelectors']);
  const selectors = storage.blockedSelectors || [];
  const filtered = selectors.filter((s) => s.selector !== selector);

  await setStorage({ blockedSelectors: filtered });
  await notifyAllTabs();

  return { success: true, message: 'Selector removed' };
}

/**
 * Retrieve all persisted CSS selectors.
 *
 * @returns {Promise<{ success: boolean, selectors: Array }>}
 */
export async function getAllSelectors() {
  const storage = await getStorage(['blockedSelectors']);
  return { success: true, selectors: storage.blockedSelectors || [] };
}
