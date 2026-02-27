/**
 * @module import-export
 * @description Full settings import / export with comprehensive validation,
 * version-compatibility checking, migration support, and size limits.
 *
 * Fixes applied:
 * - Fix #5:  Individual array items are validated (`isValidCSSSelector`,
 *            `isValidDomain`, `isValidFilterListURL`).
 * - Fix #13: Object arrays (e.g. `blockedSelectors`) are deduplicated by
 *            a string key (`selector` / `hostname`) instead of using `Set`
 *            which compares by reference and never deduplicates objects.
 * - Fix #21: Version compatibility checking with automatic migration support.
 * - Fix #45: Firefox compatibility — handles Promise returns from `storage` API
 *            via `typeof result?.then === 'function'`.
 *
 * Size limits on imported arrays:
 * - blockedSelectors: max 500
 * - whitelistedSites/blockedDomains/allowedDomains: max 1000
 * - filterSubscriptions: max 50
 *
 * @version 2.1.0
 */
'use strict';

import {
  EXPORT_KEYS,
  EXTENSION_VERSION,
  MAX_IMPORT_SELECTORS,
  MAX_IMPORT_DOMAINS,
  MAX_IMPORT_SUBSCRIPTIONS
} from './constants.js';

import { isValidCSSSelector, isValidFilterListURL } from './css-validator.js';
import { isValidDomain } from './domain-utils.js';
import { getStorage, setStorage } from './storage.js';

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Parse a semver-like version string into numeric components.
 *
 * @param {string} version - Version string (e.g. `"2.1.0"`).
 * @returns {{ major: number, minor: number, patch: number }}
 * @private
 */
function parseVersion(version) {
  const parts = String(version || '0.0.0').split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

/**
 * Compare two version strings.
 *
 * @param {string} a - First version.
 * @param {string} b - Second version.
 * @returns {number} Negative if a < b, 0 if equal, positive if a > b.
 * @private
 */
function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

/**
 * Apply migrations to settings from an older version format.
 * Add migration steps here as new versions introduce breaking changes.
 *
 * @param {Object} settings - The imported settings object (mutated in place).
 * @param {string} fromVersion - The version the export was created with.
 * @returns {Object} The migrated settings object.
 * @private
 */
function migrateSettings(settings, fromVersion) {
  const from = parseVersion(fromVersion);

  // Example migration: v1.x → v2.x renamed 'whitelist' to 'whitelistedSites'
  if (from.major < 2) {
    if (settings.whitelist && !settings.whitelistedSites) {
      settings.whitelistedSites = settings.whitelist;
      delete settings.whitelist;
    }
  }

  return settings;
}

/**
 * Validate and truncate a domain-type array (`whitelistedSites`,
 * `blockedDomains`, `allowedDomains`).
 *
 * @param {Array} arr - Raw imported array.
 * @param {number} max - Maximum allowed items.
 * @returns {string[]} Validated, deduplicated, and truncated array.
 * @private
 */
function validateDomainArray(arr, max) {
  if (!Array.isArray(arr)) return [];

  const seen = new Set();
  const result = [];

  for (const item of arr) {
    if (result.length >= max) break;

    const domain = typeof item === 'string' ? item.trim().toLowerCase() : null;
    if (!domain || seen.has(domain)) continue;

    if (!isValidDomain(domain)) {
      console.warn(`[WebSuddhi] Skipping invalid domain during import: ${domain}`);
      continue;
    }

    seen.add(domain);
    result.push(domain);
  }

  return result;
}

/**
 * Validate and deduplicate a `blockedSelectors` array.
 *
 * Items may be plain selector strings **or** objects of shape
 * `{ selector: string, hostname?: string, date?: number }`.
 *
 * Fix #13: Dedup by the `selector` string key instead of using `Set` on
 * object references (which never deduplicates).
 *
 * @param {Array} arr - Raw imported array.
 * @param {number} max - Maximum allowed items.
 * @returns {Array} Validated and deduplicated array.
 * @private
 */
function validateSelectorArray(arr, max) {
  if (!Array.isArray(arr)) return [];

  const seen = new Set();
  const result = [];

  for (const item of arr) {
    if (result.length >= max) break;

    let selector = '';
    let entry = item;

    if (typeof item === 'string') {
      selector = item.trim();
      entry = selector;
    } else if (item && typeof item === 'object' && typeof item.selector === 'string') {
      selector = item.selector.trim();
    } else {
      continue;
    }

    if (!selector || seen.has(selector)) continue;

    if (!isValidCSSSelector(selector)) {
      console.warn(`[WebSuddhi] Skipping invalid CSS selector during import: ${selector}`);
      continue;
    }

    seen.add(selector);
    result.push(entry);
  }

  return result;
}

/**
 * Validate and deduplicate a `filterSubscriptions` array.
 *
 * Items are objects with at least a `url` property. Deduplication is by URL.
 *
 * @param {Array} arr - Raw imported array.
 * @param {number} max - Maximum allowed items.
 * @returns {Array} Validated and deduplicated array.
 * @private
 */
function validateSubscriptionArray(arr, max) {
  if (!Array.isArray(arr)) return [];

  const seen = new Set();
  const result = [];

  for (const item of arr) {
    if (result.length >= max) break;

    if (!item || typeof item !== 'object') continue;

    const url = typeof item.url === 'string' ? item.url.trim() : '';
    if (!url || seen.has(url)) continue;

    if (!isValidFilterListURL(url)) {
      console.warn(`[WebSuddhi] Skipping invalid filter subscription URL during import: ${url}`);
      continue;
    }

    seen.add(url);
    result.push(item);
  }

  return result;
}

/**
 * Deduplicate two arrays during a merge, keyed by a string accessor.
 *
 * Fix #13: Works correctly for both primitive strings and objects.
 *
 * @param {Array} existing - Array already in storage.
 * @param {Array} incoming - Array from the import.
 * @param {Function} keyFn - Extracts a dedup key from an item.
 * @returns {Array} Merged array with no duplicates.
 * @private
 */
function deduplicateMerge(existing, incoming, keyFn) {
  const seen = new Set();
  const merged = [];

  for (const item of existing) {
    const key = keyFn(item);
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  for (const item of incoming) {
    const key = keyFn(item);
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

/**
 * Returns a dedup key function for a given storage key.
 *
 * @param {string} key - The settings key name.
 * @returns {Function} A function that extracts a string key from an array item.
 * @private
 */
function getKeyFn(key) {
  switch (key) {
    case 'blockedSelectors':
      return (item) =>
        typeof item === 'string' ? item : (item?.selector || '');
    case 'filterSubscriptions':
      return (item) =>
        typeof item === 'string' ? item : (item?.url || '');
    case 'whitelistedSites':
    case 'blockedDomains':
    case 'allowedDomains':
      return (item) => (typeof item === 'string' ? item.trim().toLowerCase() : '');
    default:
      return (item) => String(item);
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Export all extension settings as a serialisable object.
 *
 * @returns {Promise<Object>} An export payload containing `version`,
 *   `exportedAt` (ISO 8601), and `settings`.
 * @throws {Error} If the storage API is not available.
 *
 * @example
 * const backup = await exportSettings();
 * console.log(backup.version); // '2.1.0'
 */
export async function exportSettings() {
  const data = await getStorage(EXPORT_KEYS);

  const exportData = {
    version: EXTENSION_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {}
  };

  for (const key of EXPORT_KEYS) {
    if (data[key] !== undefined) {
      exportData.settings[key] = data[key];
    }
  }

  return exportData;
}

/**
 * Import settings with comprehensive validation, version checking, and
 * optional merge.
 *
 * @param {Object} exportedData - The parsed JSON export payload (must contain
 *   `version` and `settings`).
 * @param {Object} [options={}] - Import options.
 * @param {boolean} [options.merge=false] - If `true`, array values are merged
 *   with existing storage data instead of replacing them.
 * @returns {Promise<{ success: boolean, imported: number, warnings: string[] }>}
 *   Result summary.
 * @throws {Error} If `exportedData` is structurally invalid.
 *
 * @example
 * const result = await importSettings(backup, { merge: true });
 * // { success: true, imported: 12, warnings: [] }
 */
export async function importSettings(exportedData, options = {}) {
  // Structural validation
  if (!exportedData || typeof exportedData !== 'object') {
    throw new Error('Invalid export format');
  }
  if (!exportedData.version) {
    throw new Error('Missing version information');
  }
  if (!exportedData.settings || typeof exportedData.settings !== 'object') {
    throw new Error('Missing settings data');
  }

  // Fix #21: Version compatibility check
  const exportVersion = exportedData.version;
  const currentParsed = parseVersion(EXTENSION_VERSION);
  const exportParsed = parseVersion(exportVersion);

  // Reject exports from a future major version (not forward-compatible)
  if (exportParsed.major > currentParsed.major) {
    throw new Error(
      `Export version ${exportVersion} is newer than current version ${EXTENSION_VERSION}. ` +
      'Please update the extension before importing.'
    );
  }

  const warnings = [];

  // Apply migrations if coming from an older version
  let settings = { ...exportedData.settings };
  if (compareVersions(exportVersion, EXTENSION_VERSION) < 0) {
    settings = migrateSettings(settings, exportVersion);
    warnings.push(`Migrated settings from v${exportVersion} to v${EXTENSION_VERSION}`);
  }

  const importData = {};

  // Validate each setting key
  for (const key of EXPORT_KEYS) {
    if (settings[key] === undefined) continue;

    const value = settings[key];

    switch (key) {
      // ---- Domain arrays ----
      case 'whitelistedSites':
      case 'blockedDomains':
      case 'allowedDomains': {
        if (!Array.isArray(value)) {
          warnings.push(`Skipping ${key}: expected array`);
          continue;
        }
        const validated = validateDomainArray(value, MAX_IMPORT_DOMAINS);
        if (validated.length < value.length) {
          warnings.push(`${key}: ${value.length - validated.length} item(s) removed during validation`);
        }
        importData[key] = validated;
        break;
      }

      // ---- CSS selector array ----
      case 'blockedSelectors': {
        if (!Array.isArray(value)) {
          warnings.push(`Skipping ${key}: expected array`);
          continue;
        }
        const validated = validateSelectorArray(value, MAX_IMPORT_SELECTORS);
        if (validated.length < value.length) {
          warnings.push(`${key}: ${value.length - validated.length} item(s) removed during validation`);
        }
        importData[key] = validated;
        break;
      }

      // ---- Filter subscriptions ----
      case 'filterSubscriptions': {
        if (!Array.isArray(value)) {
          warnings.push(`Skipping ${key}: expected array`);
          continue;
        }
        const validated = validateSubscriptionArray(value, MAX_IMPORT_SUBSCRIPTIONS);
        if (validated.length < value.length) {
          warnings.push(`${key}: ${value.length - validated.length} item(s) removed during validation`);
        }
        importData[key] = validated;
        break;
      }

      // ---- Booleans ----
      case 'enabled':
      case 'paywallEnabled':
      case 'socialBlockingEnabled':
      case 'networkBlockingEnabled':
      case 'urlCleaningEnabled':
      case 'cookieConsentEnabled':
      case 'annoyanceBlockingEnabled':
      case 'phishingProtectionEnabled':
      case 'pingProtectionEnabled':
      case 'referrerStrippingEnabled':
      case 'webrtcProtectionEnabled':
      case 'telemetryBlockingEnabled':
      case 'thirdPartyCookieBlockingEnabled':
      case 'loggingEnabled':
      case 'syncEnabled':
        if (typeof value !== 'boolean') {
          warnings.push(`Skipping ${key}: expected boolean`);
          continue;
        }
        importData[key] = value;
        break;

      // ---- Numbers ----
      case 'toastDuration':
      case 'maxBlockedCount':
      case 'maxLogEntries':
      case 'maxWhitelistSize':
      case 'maxBlockedDomains':
      case 'maxBlockedSelectors':
        if (typeof value !== 'number' || value < 0) {
          warnings.push(`Skipping ${key}: expected positive number`);
          continue;
        }
        importData[key] = value;
        break;

      default:
        // Unknown key — skip
        warnings.push(`Skipping unknown key: ${key}`);
        break;
    }
  }

  // Merge with existing data if requested
  if (options.merge) {
    const existingKeys = Object.keys(importData).filter(
      (k) => Array.isArray(importData[k])
    );

    if (existingKeys.length > 0) {
      const existing = await getStorage(existingKeys);

      for (const key of existingKeys) {
        if (Array.isArray(existing[key]) && Array.isArray(importData[key])) {
          // Fix #13: Use proper string-key dedup instead of Set on object refs
          importData[key] = deduplicateMerge(
            existing[key],
            importData[key],
            getKeyFn(key)
          );
        }
      }
    }
  }

  // Persist
  await setStorage(importData);

  return {
    success: true,
    imported: Object.keys(importData).length,
    warnings
  };
}

/**
 * Generate and trigger a downloadable JSON backup file.
 *
 * Only works in DOM contexts (popup, options page).
 *
 * @param {string} [filename='websuddhi-backup.json'] - The download filename.
 * @returns {Promise<{ success: boolean, error?: string }>}
 *
 * @example
 * const result = await downloadExport();
 * if (!result.success) console.error(result.error);
 */
export async function downloadExport(filename = 'websuddhi-backup.json') {
  try {
    const data = await exportSettings();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Import settings from a user-selected file.
 *
 * Reads the file as text, parses JSON, and delegates to
 * {@link importSettings}.
 *
 * @param {File} file - The `File` object from an `<input type="file">`.
 * @param {Object} [options={}] - Import options forwarded to `importSettings`.
 * @returns {Promise<{ success: boolean, imported: number, warnings: string[] }>}
 * @throws {Error} If the file cannot be read or contains invalid JSON.
 *
 * @example
 * const fileInput = document.getElementById('import-file');
 * const result = await uploadImport(fileInput.files[0]);
 */
export function uploadImport(file, options = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const result = await importSettings(data, options);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
