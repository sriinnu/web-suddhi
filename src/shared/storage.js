/**
 * @module storage
 * @description Cross-browser storage helpers for the WebSuddhi extension.
 * Wraps `chrome.storage.local` and `chrome.storage.sync` with a consistent
 * Promise-based API that works on Chrome, Edge, Firefox, and Safari.
 *
 * Fix #9/#45: Properly handles Firefox's Promise-based `browser.storage` API
 * by checking `typeof result?.then === 'function'`.
 *
 * Fix #14: All functions resolve with an empty object (or void) on error and
 * log a warning — they never reject, ensuring callers always get a usable value.
 *
 * @version 2.1.0
 */
'use strict';

/**
 * Resolve the appropriate storage API object.
 * Prefers `browser` (Firefox/Safari) over `chrome`.
 *
 * @returns {object|null} The extension API namespace, or `null` if unavailable.
 * @private
 */
function getApi() {
  if (typeof browser !== 'undefined' && browser?.runtime) return browser;
  if (typeof chrome !== 'undefined' && chrome?.runtime) return chrome;
  return null;
}

/**
 * Internal helper that wraps a storage call to handle both callback-based
 * (Chrome) and Promise-based (Firefox) APIs uniformly.
 *
 * @param {Function} callbackStyleFn - A function like `api.storage.local.get`
 *   that accepts `(arg, callback)` or returns a Promise.
 * @param {*} arg - The argument to pass (key array or data object).
 * @param {object|null} api - The browser API namespace (for `runtime.lastError`).
 * @param {*} fallback - Value to resolve with if the API is unavailable or errors.
 * @returns {Promise<*>} Resolves with the storage result or `fallback`.
 * @private
 */
function storageCall(callbackStyleFn, arg, api, fallback) {
  return new Promise((resolve) => {
    try {
      const result = callbackStyleFn(arg);

      // Fix #45: Firefox returns a Promise directly
      if (result && typeof result.then === 'function') {
        result
          .then((data) => resolve(data ?? fallback))
          .catch((err) => {
            console.warn('[WebSuddhi] Storage error:', err);
            resolve(fallback);
          });
        return;
      }

      // Chrome / Edge: callback-based — re-invoke with callback
      callbackStyleFn(arg, (data) => {
        if (api?.runtime?.lastError) {
          console.warn('[WebSuddhi] Storage error:', api.runtime.lastError);
          resolve(fallback);
        } else {
          resolve(data ?? fallback);
        }
      });
    } catch (err) {
      console.warn('[WebSuddhi] Storage error:', err);
      resolve(fallback);
    }
  });
}

/**
 * Get values from `chrome.storage.local` (or `browser.storage.local`).
 *
 * @param {string|string[]|Object} keys - Storage key(s) to retrieve.
 *   Pass a string, an array of strings, or an object whose keys are the
 *   storage keys and values are defaults.
 * @returns {Promise<Object>} Resolves with an object of key/value pairs.
 *   Resolves with `{}` if the storage API is unavailable or an error occurs.
 *
 * @example
 * const { enabled } = await getStorage('enabled');
 *
 * @example
 * const data = await getStorage(['enabled', 'whitelistedSites']);
 */
export function getStorage(keys) {
  const api = getApi();
  if (!api?.storage?.local) {
    console.warn('[WebSuddhi] Storage API not available');
    return Promise.resolve({});
  }
  return storageCall(
    (arg, cb) => cb ? api.storage.local.get(arg, cb) : api.storage.local.get(arg),
    keys,
    api,
    {}
  );
}

/**
 * Set values in `chrome.storage.local` (or `browser.storage.local`).
 *
 * @param {Object} data - An object of key/value pairs to persist.
 * @returns {Promise<void>} Resolves when the write completes (or fails silently).
 *
 * @example
 * await setStorage({ enabled: true, toastDuration: 5 });
 */
export function setStorage(data) {
  const api = getApi();
  if (!api?.storage?.local) {
    console.warn('[WebSuddhi] Storage API not available');
    return Promise.resolve();
  }
  return storageCall(
    (arg, cb) => cb ? api.storage.local.set(arg, cb) : api.storage.local.set(arg),
    data,
    api,
    undefined
  );
}

/**
 * Get values from `chrome.storage.sync` (or `browser.storage.sync`).
 *
 * Falls back to an empty object if sync storage is not supported or errors.
 *
 * @param {string|string[]|Object} keys - Storage key(s) to retrieve.
 * @returns {Promise<Object>} Resolves with an object of key/value pairs.
 *
 * @example
 * const { syncEnabled } = await getSyncStorage('syncEnabled');
 */
export function getSyncStorage(keys) {
  const api = getApi();
  if (!api?.storage?.sync) {
    console.warn('[WebSuddhi] Sync storage API not available');
    return Promise.resolve({});
  }
  return storageCall(
    (arg, cb) => cb ? api.storage.sync.get(arg, cb) : api.storage.sync.get(arg),
    keys,
    api,
    {}
  );
}

/**
 * Set values in `chrome.storage.sync` (or `browser.storage.sync`).
 *
 * Falls back silently if sync storage is not supported.
 *
 * @param {Object} data - An object of key/value pairs to persist.
 * @returns {Promise<void>} Resolves when the write completes (or fails silently).
 *
 * @example
 * await setSyncStorage({ syncEnabled: true });
 */
export function setSyncStorage(data) {
  const api = getApi();
  if (!api?.storage?.sync) {
    console.warn('[WebSuddhi] Sync storage API not available');
    return Promise.resolve();
  }
  return storageCall(
    (arg, cb) => cb ? api.storage.sync.set(arg, cb) : api.storage.sync.set(arg),
    data,
    api,
    undefined
  );
}

/**
 * Get storage values with default fallbacks.
 *
 * Retrieves the requested keys from `chrome.storage.local` and fills in
 * any missing values from the supplied `defaults` object.
 *
 * @param {string[]} keys - Array of storage keys to read.
 * @param {Object} defaults - Object mapping keys to their default values.
 * @returns {Promise<Object>} Resolves with a fully populated object where
 *   every key in `keys` has a value (either from storage or defaults).
 *
 * @example
 * const settings = await getStorageWithDefaults(
 *   ['enabled', 'toastDuration'],
 *   { enabled: true, toastDuration: 3 }
 * );
 * // settings.enabled is from storage if present, otherwise true
 */
export async function getStorageWithDefaults(keys, defaults) {
  const storage = await getStorage(keys);
  const result = {};

  for (const key of keys) {
    result[key] = storage[key] !== undefined ? storage[key] : defaults[key];
  }

  return result;
}
