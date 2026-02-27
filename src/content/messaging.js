/**
 * @module content/messaging
 * @description Message passing between content script and background.
 *
 * Provides cross-browser (Chrome / Firefox) message send/receive.
 * Uses a handler registry to avoid circular imports — modules
 * register their message handlers via `registerHandler()`.
 *
 * @version 2.1.0
 */
'use strict';

// ============================================
// HANDLER REGISTRY
// ============================================

/**
 * Map of message type → handler function.
 * Handlers are registered by other modules during init.
 *
 * @type {Map<string, (message: object, sender: object) => Promise<object>>}
 * @private
 */
const handlers = new Map();

/**
 * Register a handler for one or more message types.
 *
 * @param {string|string[]} types - Message type(s) to handle.
 * @param {(message: object, sender: object) => Promise<object>} handler - Async handler function.
 */
export function registerHandler(types, handler) {
  const typeList = Array.isArray(types) ? types : [types];
  typeList.forEach((t) => handlers.set(t, handler));
}

// ============================================
// LISTENER SETUP
// ============================================

/**
 * Install the chrome.runtime.onMessage listener.
 * Dispatches to registered handlers.
 */
export function setupMessageListener() {
  const listener = (message, sender, sendResponse) => {
    const handler = handlers.get(message?.type);
    if (!handler) {
      sendResponse({ success: false, error: 'Unknown message type' });
      return true;
    }

    handler(message, sender)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep port open for async response
  };

  if (typeof browser !== 'undefined' && browser.runtime) {
    browser.runtime.onMessage.addListener(listener);
  } else if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(listener);
  }
}

// ============================================
// SEND HELPERS
// ============================================

/**
 * Send a message to the background service worker.
 * Cross-browser: uses browser.runtime (Firefox) or chrome.runtime (Chrome).
 *
 * @param {object} message - Message payload (must include `type`).
 * @returns {Promise<object>} Response from background.
 */
export function sendMessage(message) {
  return new Promise((resolve, reject) => {
    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage(message).then(resolve).catch(reject);
    } else if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(response);
      });
    } else {
      reject(new Error('No messaging API available'));
    }
  });
}

/**
 * Early message sending (before full init).
 * Identical to sendMessage but kept separate for clarity.
 *
 * @param {object} message
 * @returns {Promise<object>}
 */
export function sendMessageEarly(message) {
  return sendMessage(message);
}
