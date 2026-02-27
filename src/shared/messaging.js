/**
 * @module messaging
 * @description Cross-browser runtime messaging helpers for the WebSuddhi
 * browser extension. Provides thin wrappers around `chrome.runtime.sendMessage`
 * and `chrome.tabs.sendMessage` with consistent error handling that works on
 * Chrome, Edge, Firefox, and Safari.
 *
 * @version 2.1.0
 */
'use strict';

/**
 * Resolve the appropriate browser extension API namespace.
 *
 * @returns {object|null} `browser` (Firefox/Safari) or `chrome`, or `null`.
 * @private
 */
function getApi() {
  if (typeof browser !== 'undefined' && browser?.runtime) return browser;
  if (typeof chrome !== 'undefined' && chrome?.runtime) return chrome;
  return null;
}

/**
 * Send a message via `runtime.sendMessage`.
 *
 * Handles both Chrome's callback API and Firefox's Promise API, and cleanly
 * suppresses the common "Could not establish connection" errors that occur
 * when no listener is available.
 *
 * @param {Object} message - The message payload to send.
 * @returns {Promise<*>} Resolves with the response from the listener, or
 *   `undefined` if no response / no listener.
 * @throws {Error} Re-throws unexpected errors that are not connection-related.
 *
 * @example
 * const response = await sendMessage({ type: 'GET_STATS' });
 */
export function sendMessage(message) {
  const api = getApi();
  if (!api?.runtime?.sendMessage) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    try {
      const result = api.runtime.sendMessage(message);

      // Firefox returns a Promise
      if (result && typeof result.then === 'function') {
        result
          .then(resolve)
          .catch((err) => {
            // Suppress "could not establish connection" errors
            if (isConnectionError(err)) {
              resolve(undefined);
            } else {
              console.warn('[WebSuddhi] sendMessage error:', err);
              resolve(undefined);
            }
          });
        return;
      }

      // Chrome callback-style — already dispatched, check lastError
      if (api.runtime.lastError) {
        // Suppress known benign errors
        resolve(undefined);
      } else {
        resolve(result);
      }
    } catch (err) {
      if (isConnectionError(err)) {
        resolve(undefined);
      } else {
        console.warn('[WebSuddhi] sendMessage error:', err);
        resolve(undefined);
      }
    }
  });
}

/**
 * Send a message to a specific tab via `tabs.sendMessage`.
 *
 * Silently handles errors that occur when the target tab is closed, has no
 * content script, or is otherwise unreachable. This prevents
 * "Unchecked runtime.lastError" warnings in the console.
 *
 * @param {number} tabId - The ID of the target tab.
 * @param {Object} message - The message payload to send.
 * @returns {Promise<*>} Resolves with the response, or `undefined` on error.
 *
 * @example
 * await sendMessageToTab(tabId, { type: 'UPDATE_SETTINGS', settings });
 */
export function sendMessageToTab(tabId, message) {
  const api = getApi();
  if (!api?.tabs?.sendMessage) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    try {
      const result = api.tabs.sendMessage(tabId, message, () => {
        // Consume lastError to suppress "Unchecked runtime.lastError"
        if (api.runtime.lastError) { /* tab not available */ }
        resolve(undefined);
      });

      // Firefox returns a Promise
      if (result && typeof result.then === 'function') {
        result
          .then(resolve)
          .catch(() => resolve(undefined));
      }
    } catch (_e) {
      // Synchronous error — tab doesn't exist
      resolve(undefined);
    }
  });
}

/**
 * Detect whether a response indicates an unknown / unrecognised message type.
 *
 * Background scripts commonly respond with `{ error: 'Unknown message type' }`
 * or similar when they receive a message type they don't handle. This helper
 * lets callers easily check for that condition.
 *
 * @param {*} response - The response returned by the message listener.
 * @returns {boolean} `true` if the response indicates an unknown message type.
 *
 * @example
 * const res = await sendMessage({ type: 'NONEXISTENT' });
 * if (isUnknownMessageTypeResponse(res)) {
 *   console.log('Message type not handled');
 * }
 */
export function isUnknownMessageTypeResponse(response) {
  if (!response || typeof response !== 'object') return false;

  const errMsg = response.error || response.message || '';
  if (typeof errMsg !== 'string') return false;

  const lower = errMsg.toLowerCase();
  return (
    lower.includes('unknown message') ||
    lower.includes('unrecognized message') ||
    lower.includes('unknown type') ||
    lower.includes('unhandled message')
  );
}

/**
 * Check whether an error is a benign browser-extension connection error.
 *
 * @param {Error|object} err - The caught error.
 * @returns {boolean} `true` if the error is a known connection-related error.
 * @private
 */
function isConnectionError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    msg.includes('could not establish connection') ||
    msg.includes('receiving end does not exist') ||
    msg.includes('no tab with id') ||
    msg.includes('extension context invalidated')
  );
}
