/**
 * @module context-menu
 * @description Context menu setup for the WebSuddhi browser extension.
 * Provides a "Block this element" right-click option that triggers pick mode
 * in the content script.
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
 * Create the extension's context-menu items.
 * Removes any existing items first to avoid duplicates on re-init.
 *
 * @returns {void}
 */
export function setupContextMenu() {
  const api = getApi();
  api.contextMenus.removeAll(() => {
    api.contextMenus.create({
      id: 'websuddhi-block',
      title: 'Block this element',
      contexts: ['all']
    });
  });
}

/**
 * Handle a context-menu click event.
 *
 * @param {Object} info - `chrome.contextMenus.OnClickData`.
 * @param {Object} tab - `chrome.tabs.Tab`.
 * @returns {void}
 */
export function handleContextMenuClick(info, tab) {
  if (info.menuItemId === 'websuddhi-block' && tab?.id) {
    safeSendToTab(tab.id, { type: 'START_PICK_MODE' });
  }
}
