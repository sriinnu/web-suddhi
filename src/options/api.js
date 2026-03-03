/**
 * @module options/api
 * @description Cross-browser API helpers for the options page.
 * Mirrors popup/api.js but for the options page context.
 *
 * @version 2.1.0
 */
'use strict';

/** Cross-browser extension API */
export const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

/**
 * Log an error with the WebSuddhi prefix.
 * @param {...*} args
 */
export function logError(...args) {
  if (self.WebSuddhi?.utils?.error) {
    self.WebSuddhi.utils.error(...args);
  } else {
    console.error('[WebSuddhi]', ...args);
  }
}

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

/**
 * Send a message to the background service worker.
 * @param {object} message
 * @returns {Promise<*>}
 */
export function sendMessage(message) {
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
 * Try multiple message types in order, returning the first valid response.
 * @param {string|string[]} types
 * @param {object} [payload={}]
 * @returns {Promise<*>}
 */
export async function sendMessageWithFallback(types, payload = {}) {
  const typeList = Array.isArray(types) ? types : [types];
  let lastError = null;

  for (const type of typeList) {
    try {
      const response = await sendMessage({ ...payload, type });
      if (!(response?.success === false && response?.error?.startsWith('Unknown message type'))) {
        return response;
      }
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return null;
}

/**
 * Extract request log from varying response shapes.
 * @param {*} response
 * @returns {Array}
 */
export function extractRequestLog(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.log)) return response.log;
  if (Array.isArray(response?.entries)) return response.entries;
  return [];
}
