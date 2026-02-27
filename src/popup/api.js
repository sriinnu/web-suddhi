/**
 * @module popup/api
 * @description Cross-browser API helpers for the popup script.
 * Handles storage access, background messaging, and content-script messaging
 * with fallback support for both Chrome (callback) and Firefox (Promise) APIs.
 *
 * @version 2.1.0
 */
'use strict';

/** Cross-browser extension API */
export const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

// ============================================
// LOGGING
// ============================================

/**
 * Log an error with the WebSuddhi prefix.
 * Falls back to console.error if the shared logger isn't available.
 * @param {...*} args
 */
export function logError(...args) {
  if (self.WebSuddhi?.utils?.error) {
    self.WebSuddhi.utils.error(...args);
  } else {
    console.error('[WebSuddhi]', ...args);
  }
}

// ============================================
// STORAGE
// ============================================

/**
 * Get values from storage.local with cross-browser support.
 * @param {string|string[]} keys
 * @returns {Promise<object>}
 */
export function getStorage(keys) {
  return new Promise((resolve, reject) => {
    if (!api.storage) return reject(new Error('No storage API'));
    const result = api.storage.local.get(keys);
    if (result && typeof result.then === 'function') {
      result.then(resolve).catch(reject);
    } else {
      api.storage.local.get(keys, (data) => {
        if (api.runtime.lastError) reject(api.runtime.lastError);
        else resolve(data);
      });
    }
  });
}

/**
 * Set values in storage.local with cross-browser support.
 * @param {object} data
 * @returns {Promise<void>}
 */
export function setStorage(data) {
  return new Promise((resolve, reject) => {
    if (!api.storage) return reject(new Error('No storage API'));
    const result = api.storage.local.set(data);
    if (result && typeof result.then === 'function') {
      result.then(resolve).catch(reject);
    } else {
      api.storage.local.set(data, () => {
        if (api.runtime.lastError) reject(api.runtime.lastError);
        else resolve();
      });
    }
  });
}

// ============================================
// BACKGROUND MESSAGING
// ============================================

/**
 * Send a message to the background service worker.
 * @param {object} message - Must contain a `type` field.
 * @returns {Promise<*>}
 */
export function sendToBackground(message) {
  return new Promise((resolve, reject) => {
    const result = api.runtime.sendMessage(message);
    if (result && typeof result.then === 'function') {
      result.then(resolve).catch(reject);
    } else {
      api.runtime.sendMessage(message, (response) => {
        if (api.runtime.lastError) reject(api.runtime.lastError);
        else resolve(response);
      });
    }
  });
}

/**
 * Check whether a response represents an "Unknown message type" error.
 * @param {object} response
 * @returns {boolean}
 */
function isUnknownMessageType(response) {
  return response?.success === false &&
    typeof response?.error === 'string' &&
    response.error.startsWith('Unknown message type');
}

/**
 * Try multiple message types in order, returning the first successful response.
 * Useful for backward-compat when message type names may have changed.
 *
 * @param {string|string[]} types - One or more message type strings.
 * @param {object} [payload={}] - Extra fields to include in the message.
 * @returns {Promise<*>}
 */
export async function sendToBackgroundWithFallback(types, payload = {}) {
  const typeList = Array.isArray(types) ? types : [types];
  let lastError = null;

  for (const type of typeList) {
    try {
      const response = await sendToBackground({ ...payload, type });
      if (!isUnknownMessageType(response)) return response;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return null;
}

// ============================================
// CONTENT SCRIPT MESSAGING
// ============================================

/**
 * Send a message to the content script in the currently active tab.
 * @param {object} message
 * @param {object} tab - The current tab object (must have `.id`).
 * @param {number} [frameId=0] - Target frame ID (0 = main frame).
 * @returns {Promise<*>}
 */
export function sendToContentScript(message, tab, frameId = 0) {
  return new Promise((resolve, reject) => {
    if (!tab?.id) return reject(new Error('No active tab'));
    const result = api.tabs.sendMessage(tab.id, message, { frameId });
    if (result && typeof result.then === 'function') {
      result.then(resolve).catch(reject);
    } else {
      api.tabs.sendMessage(tab.id, message, { frameId }, (response) => {
        if (api.runtime.lastError) reject(api.runtime.lastError);
        else resolve(response);
      });
    }
  });
}

// ============================================
// RESPONSE HELPERS
// ============================================

/**
 * Extract the request log array from varying response shapes.
 * @param {*} response
 * @returns {Array}
 */
export function extractRequestLog(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.log)) return response.log;
  if (Array.isArray(response?.entries)) return response.entries;
  return [];
}

/**
 * Normalize varied frame list shapes into a consistent `{ host, url, blocked }` array.
 * @param {Array} frames
 * @param {boolean} blocked
 * @returns {Array<{host: string, url: string, blocked: boolean}>}
 */
export function normalizeFrameList(frames, blocked) {
  if (!Array.isArray(frames)) return [];
  return frames.map((frame) => {
    if (!frame) return null;
    if (typeof frame === 'string') return { host: frame, url: frame, blocked };
    const host = frame.host || frame.hostname || frame.domain;
    if (!host) return null;
    return { host, url: frame.url || frame.src || frame.frameUrl || host, blocked: frame.blocked === true || blocked };
  }).filter(Boolean);
}

/**
 * Extract a certificate object from varying security-info shapes.
 * @param {object} securityInfo
 * @returns {object|null}
 */
export function extractCertificate(securityInfo) {
  return securityInfo?.certificate ||
    securityInfo?.cert ||
    securityInfo?.tlsCertificate ||
    securityInfo?.security?.certificate ||
    null;
}
