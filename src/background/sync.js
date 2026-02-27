/**
 * @module sync
 * @description Cross-device settings sync for the WebSuddhi extension.
 *
 * Fix issue #16: Only syncs user-modifiable settings (enabled,
 * whitelistedSites, blockedDomains, blockedSelectors, paywallEnabled,
 * socialBlockingEnabled), NOT stats, logs, or filter mappings.
 *
 * Fix issue #17: Adds a `_suppressSyncPropagation` guard flag to prevent
 * feedback loops when sync.onChanged fires after we ourselves wrote to
 * sync storage.
 *
 * @version 2.1.0
 */
'use strict';

import { getStorage, setStorage, getSyncStorage, setSyncStorage } from '../shared/storage.js';

// ============================================
// CONSTANTS
// ============================================

/**
 * Keys that should be synchronised across devices.
 * Fix #16: excludes stats, logs, filterRuleMapping, performanceStats, etc.
 * @type {ReadonlySet<string>}
 */
const SYNCABLE_KEYS = new Set([
  'enabled',
  'whitelistedSites',
  'blockedDomains',
  'blockedSelectors',
  'paywallEnabled',
  'socialBlockingEnabled'
]);

// ============================================
// STATE
// ============================================

/**
 * Guard flag to prevent feedback loops (fix #17).
 * Set `true` while we are writing to sync storage so that the
 * `onChanged` listener does not propagate the change back to local.
 * @type {boolean}
 */
let _suppressSyncPropagation = false;

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
 * Enable or disable sync. When enabling, copies syncable settings to
 * `chrome.storage.sync`. When disabling, copies sync data back to local.
 *
 * @param {boolean} enable - `true` to enable, `false` to disable.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function migrateStorage(enable) {
  if (enable) {
    const localData = await getStorage([...SYNCABLE_KEYS]);
    const syncPayload = {};
    for (const key of SYNCABLE_KEYS) {
      if (localData[key] !== undefined) {
        syncPayload[key] = localData[key];
      }
    }

    _suppressSyncPropagation = true;
    try {
      await setSyncStorage(syncPayload);
    } finally {
      _suppressSyncPropagation = false;
    }

    await setStorage({ syncEnabled: true });
    return { success: true, message: 'Sync enabled, settings copied to sync storage' };
  }

  // Disabling — copy sync data back to local
  const syncData = await getSyncStorage([...SYNCABLE_KEYS]);
  const localPayload = {};
  for (const key of SYNCABLE_KEYS) {
    if (syncData[key] !== undefined) {
      localPayload[key] = syncData[key];
    }
  }

  await setStorage({ ...localPayload, syncEnabled: false });
  return { success: true, message: 'Sync disabled, settings copied to local storage' };
}

/**
 * Register a `storage.onChanged` listener that propagates sync changes
 * to local storage, with feedback-loop prevention (fix #17).
 *
 * @returns {void}
 */
export function setupSyncListener() {
  const api = getApi();

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes) return;
    if (_suppressSyncPropagation) return;

    const localChanges = {};
    for (const key in changes) {
      if (SYNCABLE_KEYS.has(key)) {
        localChanges[key] = changes[key].newValue;
      }
    }

    if (Object.keys(localChanges).length > 0) {
      setStorage(localChanges);
    }
  });
}
