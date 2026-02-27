/**
 * @module toggle
 * @description Feature toggle helpers for the WebSuddhi background service.
 * Each toggle persists the new value and notifies content scripts or updates
 * the extension icon as appropriate.
 *
 * @version 2.1.0
 */
'use strict';

import { setStorage } from '../shared/storage.js';
import { notifyAllTabs } from './tab-manager.js';
import { ICON_PATHS_NORMAL, ICON_PATHS_ALERT } from './icon.js';

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
 * Toggle the master extension enabled state.
 *
 * @param {boolean} enabled - New state.
 * @returns {Promise<{ success: boolean, enabled: boolean }>}
 */
export async function toggleEnabled(enabled) {
  await setStorage({ enabled });
  await notifyAllTabs();

  const api = getApi();
  try {
    const path = enabled ? ICON_PATHS_NORMAL : ICON_PATHS_ALERT;
    if (api.action) api.action.setIcon({ path });
    else if (api.browserAction) api.browserAction.setIcon({ path });
  } catch (_e) { /* ignore */ }

  return { success: true, enabled };
}

/**
 * Toggle the paywall-bypass feature.
 *
 * @param {boolean} enabled - New state.
 * @returns {Promise<{ paywallEnabled: boolean }>}
 */
export async function togglePaywall(enabled) {
  await setStorage({ paywallEnabled: enabled });
  return { paywallEnabled: enabled };
}

/**
 * Toggle social-widget blocking.
 *
 * @param {boolean} enabled - New state.
 * @returns {Promise<{ socialBlockingEnabled: boolean }>}
 */
export async function toggleSocialBlocking(enabled) {
  await setStorage({ socialBlockingEnabled: enabled });
  return { socialBlockingEnabled: enabled };
}
