/**
 * @module tab-manager
 * @description Per-tab frame tracking, safe messaging, and frame reporting
 * for the WebSuddhi background service worker.
 *
 * Fix issue #28: Caps entries per tab in `tabFrameMap` at 200 to prevent
 * unbounded memory growth on long-running tabs.
 *
 * @version 2.1.0
 */
'use strict';

import { normalizeHostname, normalizeDomainList } from '../shared/domain-utils.js';
import { getStorage } from '../shared/storage.js';

// ============================================
// CONSTANTS
// ============================================

/** @type {number} Maximum frame entries tracked per tab (fix #28). */
const MAX_FRAMES_PER_TAB = 200;

// ============================================
// STATE
// ============================================

/**
 * Per-tab frame tracking map.
 * tabId → Map<host, { host, url, blocked, lastSeen }>
 * @type {Map<number, Map<string, Object>>}
 */
export const tabFrameMap = new Map();

// ============================================
// CROSS-BROWSER API
// ============================================

/** @returns {object} The extension API namespace. @private */
function getApi() {
  if (typeof browser !== 'undefined' && browser?.runtime) return browser;
  if (typeof chrome !== 'undefined' && chrome?.runtime) return chrome;
  return /** @type {*} */ ({});
}

// ============================================
// SAFE MESSAGING
// ============================================

/**
 * Safely send a message to a tab, suppressing all errors (closed tab, no
 * content script, etc.).
 *
 * @param {number} tabId - Target tab ID.
 * @param {Object} message - Message payload.
 * @returns {void}
 */
export function safeSendToTab(tabId, message) {
  const api = getApi();
  try {
    const result = api.tabs.sendMessage(tabId, message, () => {
      if (api.runtime.lastError) { /* tab not available */ }
    });
    if (result && typeof result.then === 'function') {
      result.catch(() => {});
    }
  } catch (_e) {
    // Synchronous error — tab doesn't exist
  }
}

/**
 * Broadcast a `SETTINGS_CHANGED` message to every open tab.
 *
 * @returns {Promise<void>}
 */
export async function notifyAllTabs() {
  const api = getApi();
  try {
    const tabs = await new Promise((resolve) => {
      api.tabs.query({}, (t) => resolve(t || []));
    });
    for (const tab of tabs) {
      if (tab?.id) safeSendToTab(tab.id, { type: 'SETTINGS_CHANGED' });
    }
  } catch (_e) {
    // Ignore errors
  }
}

/**
 * Broadcast an arbitrary message to every open tab.
 *
 * @param {Object} message - Message payload to send.
 * @returns {Promise<void>}
 */
export async function sendMessageToAllTabs(message) {
  const api = getApi();
  try {
    const tabs = await new Promise((resolve) => {
      api.tabs.query({}, (t) => resolve(t || []));
    });
    for (const tab of tabs) {
      if (tab?.id) safeSendToTab(tab.id, message);
    }
  } catch (_e) {
    // Ignore errors
  }
}

// ============================================
// FRAME TRACKING
// ============================================

/**
 * Record (or update) a third-party frame entry for a tab.
 *
 * @param {number} tabId - Tab ID.
 * @param {string} host - Frame hostname.
 * @param {string} [url] - Full frame URL.
 * @param {boolean} [blocked] - Whether the frame was blocked.
 * @returns {void}
 */
export function setTabFrameEntry(tabId, host, url, blocked) {
  if (typeof tabId !== 'number' || tabId < 0 || !host) return;

  let tabFrames = tabFrameMap.get(tabId);
  if (!tabFrames) {
    tabFrames = new Map();
    tabFrameMap.set(tabId, tabFrames);
  }

  // Fix #28: cap entries per tab at MAX_FRAMES_PER_TAB
  if (!tabFrames.has(host) && tabFrames.size >= MAX_FRAMES_PER_TAB) {
    return;
  }

  const prev = tabFrames.get(host) || {};
  tabFrames.set(host, {
    host,
    url: url || prev.url || host,
    blocked: typeof blocked === 'boolean' ? blocked : Boolean(prev.blocked),
    lastSeen: Date.now()
  });
}

/**
 * Get the frame map for a specific tab.
 *
 * @param {number} tabId - Tab ID.
 * @returns {Map<string, Object>|undefined} The frame map, or `undefined`.
 */
export function getTabFrames(tabId) {
  return tabFrameMap.get(tabId);
}

/**
 * Handle a REPORT_FRAME message from a content script.
 *
 * @param {Object} message - Message payload (frameHost, frameUrl, blocked, tabId).
 * @param {Object} sender - chrome.runtime.MessageSender.
 * @returns {{ success: boolean, error?: string }}
 */
export function reportFrame(message, sender) {
  const tabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
  if (typeof tabId !== 'number' || tabId < 0) {
    return { success: false, error: 'No tab ID for frame report' };
  }

  const host = normalizeHostname(message.frameHost || message.frameUrl);
  if (!host) {
    return { success: false, error: 'Invalid frame host' };
  }

  setTabFrameEntry(tabId, host, message.frameUrl || host, message.blocked);
  return { success: true };
}

/**
 * Handle an ALLOW_FRAME message — mark a frame as allowed and add the
 * domain to the allowed-domains list.
 *
 * @param {Object} message - Message payload.
 * @param {Object} sender - chrome.runtime.MessageSender.
 * @param {Function} addAllowedDomainFn - Reference to whitelist.addAllowedDomain.
 * @param {Function} refreshNetworkRulesFn - Reference to network rule refresh.
 * @returns {Promise<{ success: boolean, domain?: string, error?: string }>}
 */
export async function allowFrame(message, sender, addAllowedDomainFn, refreshNetworkRulesFn) {
  const tabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
  const host = normalizeHostname(message.frameHost || message.frameUrl);

  if (!host) {
    return { success: false, error: 'Invalid frame host' };
  }

  setTabFrameEntry(tabId, host, message.frameUrl || host, false);

  const allowResult = await addAllowedDomainFn(host);
  if (!allowResult.success) return allowResult;

  await refreshNetworkRulesFn();
  return { success: true, domain: host };
}

/**
 * Get certificate info and third-party domain breakdown for a tab.
 *
 * @param {number} tabId - Tab ID.
 * @returns {Promise<Object>} Security info payload.
 */
export async function getSecurityInfo(tabId) {
  const api = getApi();
  if (typeof tabId !== 'number' || tabId < 0) {
    return { success: false, certificate: null, thirdPartyDomains: [], blockedFrames: [] };
  }

  const storage = await getStorage(['allowedDomains']);
  const allowedDomains = normalizeDomainList(storage.allowedDomains || []);
  const tabFrames = tabFrameMap.get(tabId);
  const thirdPartyDomains = [];
  const blockedFrames = [];

  if (tabFrames) {
    for (const frame of tabFrames.values()) {
      const entry = { host: frame.host, url: frame.url || frame.host };
      const isAllowed = allowedDomains.some((d) =>
        frame.host === d || frame.host.endsWith('.' + d)
      );
      if (isAllowed || frame.blocked !== true) {
        thirdPartyDomains.push(entry);
      } else {
        blockedFrames.push(entry);
      }
    }
  }

  thirdPartyDomains.sort((a, b) => a.host.localeCompare(b.host));
  blockedFrames.sort((a, b) => a.host.localeCompare(b.host));

  let certificate = null;
  try {
    const tab = await new Promise((resolve) => {
      api.tabs.get(tabId, (t) => {
        if (api.runtime.lastError) resolve(null);
        else resolve(t || null);
      });
    });
    const host = normalizeHostname(tab?.url || '', true);
    if (host && tab?.url?.startsWith('https://')) {
      certificate = {
        organization: host,
        issuer: host,
        validFrom: null,
        validTo: null,
        protocol: '',
        cipher: '',
        fingerprint: ''
      };
    }
  } catch (_e) { /* tab may be closed */ }

  return { success: true, certificate, thirdPartyDomains, blockedFrames };
}

/**
 * Register tab lifecycle listeners that clean up frame data.
 *
 * @param {Function} stopIconBlinkFn - Reference to icon.stopIconBlink.
 * @returns {void}
 */
export function setupTabListeners(stopIconBlinkFn) {
  const api = getApi();

  if (api.tabs?.onRemoved) {
    api.tabs.onRemoved.addListener((tabId) => {
      tabFrameMap.delete(tabId);
      if (typeof stopIconBlinkFn === 'function') stopIconBlinkFn(tabId);
    });
  }

  if (api.tabs?.onUpdated) {
    api.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo?.status === 'loading') {
        tabFrameMap.delete(tabId);
      }
    });
  }
}
