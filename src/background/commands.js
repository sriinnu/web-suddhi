/**
 * @module commands
 * @description Keyboard shortcut (commands) handler for the WebSuddhi
 * background service worker.
 *
 * Fix issue #32: Validates that the active tab's URL uses the `http:` or
 * `https:` protocol before toggling whitelist, preventing errors on
 * `chrome://`, `about:`, and other special pages.
 *
 * @version 2.1.0
 */
'use strict';

import { safeSendToTab } from './tab-manager.js';

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
// PUBLIC API
// ============================================

/**
 * Register keyboard-shortcut listeners.
 *
 * @param {Function} toggleWhitelistFn - Reference to
 *   `whitelist.toggleWhitelistForSite(hostname, tabId, ...)`.
 * @returns {void}
 */
export function setupCommandListener(toggleWhitelistFn) {
  const api = getApi();

  if (!api.commands?.onCommand) return;

  api.commands.onCommand.addListener((command) => {
    if (command === 'toggle-pick-mode') {
      api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          safeSendToTab(tabs[0].id, { type: 'TOGGLE_PICK_MODE' });
        }
      });
    } else if (command === 'toggle-whitelist') {
      api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id || !tab?.url) return;

        // Fix #32: only toggle on http/https pages
        try {
          const url = new URL(tab.url);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
          const hostname = url.hostname;
          if (typeof toggleWhitelistFn === 'function') {
            toggleWhitelistFn(hostname, tab.id);
          }
        } catch (_e) {
          // Malformed URL — do nothing
        }
      });
    } else if (command === 'open-settings') {
      if (api.runtime.openOptionsPage) {
        api.runtime.openOptionsPage();
      }
    }
  });
}
