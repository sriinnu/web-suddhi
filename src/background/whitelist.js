/**
 * @module whitelist
 * @description Whitelist (site exemption) and domain allow/unblock management
 * for the WebSuddhi background service worker.
 *
 * @version 2.1.0
 */
'use strict';

import { normalizeHostname, normalizeDomainList } from '../shared/domain-utils.js';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import { getStorage, setStorage } from '../shared/storage.js';
import { notifyAllTabs } from './tab-manager.js';

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
// WHITELIST
// ============================================

/**
 * Add a site to the whitelist (exempt from blocking).
 *
 * @param {string} hostnameOrUrl - Hostname or URL to whitelist.
 * @param {Function} refreshNetworkRulesFn - Callback to refresh DNR rules.
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function whitelistSite(hostnameOrUrl, refreshNetworkRulesFn) {
  if (!hostnameOrUrl) return { success: false, error: 'No hostname provided' };

  const hostname = normalizeHostname(hostnameOrUrl, true);
  if (!hostname) return { success: false, error: 'Invalid hostname' };

  const maxWhitelist = DEFAULT_SETTINGS.maxWhitelistSize || 1000;
  const storage = await getStorage(['whitelistedSites']);
  const normalised = normalizeDomainList(storage.whitelistedSites || [], true, maxWhitelist);

  if (!normalised.includes(hostname)) {
    normalised.push(hostname);
    await setStorage({ whitelistedSites: normalised });
  }

  if (typeof refreshNetworkRulesFn === 'function') {
    await refreshNetworkRulesFn();
  }

  return { success: true, message: 'Whitelisted ' + hostname };
}

/**
 * Remove a site from the whitelist.
 *
 * @param {string} hostname - Hostname to un-whitelist.
 * @param {Function} refreshNetworkRulesFn - Callback to refresh DNR rules.
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
export async function unwhitelistSite(hostname, refreshNetworkRulesFn) {
  if (!hostname) return { success: false, error: 'No hostname provided' };

  const normalised = normalizeHostname(hostname, true);
  if (!normalised) return { success: false, error: 'Invalid hostname' };

  const maxWhitelist = DEFAULT_SETTINGS.maxWhitelistSize || 1000;
  const storage = await getStorage(['whitelistedSites']);
  const whitelisted = normalizeDomainList(storage.whitelistedSites || [], true, maxWhitelist)
    .filter((s) => s !== normalised);

  await setStorage({ whitelistedSites: whitelisted });

  if (typeof refreshNetworkRulesFn === 'function') {
    await refreshNetworkRulesFn();
  }

  return { success: true, message: 'Unwhitelisted ' + normalised };
}

/**
 * Toggle whitelist status for a site. Updates icon and notifies all tabs.
 *
 * @param {string} hostname - Hostname to toggle.
 * @param {number} [tabId] - Tab ID for icon update.
 * @param {Function} refreshNetworkRulesFn - Callback to refresh DNR rules.
 * @param {Object} iconPaths - `{ normal, alert }` icon path objects.
 * @returns {Promise<{ success: boolean, whitelisted?: boolean, error?: string }>}
 */
export async function toggleWhitelistForSite(hostname, tabId, refreshNetworkRulesFn, iconPaths) {
  try {
    const normalised = normalizeHostname(hostname, true);
    if (!normalised) return { success: false, error: 'Invalid hostname' };

    const isWhitelisted = await isSiteWhitelisted(normalised);

    if (isWhitelisted) {
      await unwhitelistSite(normalised, refreshNetworkRulesFn);
    } else {
      await whitelistSite(normalised, refreshNetworkRulesFn);
    }

    await notifyAllTabs();

    // Update icon for the triggering tab
    if (tabId && iconPaths) {
      const api = getApi();
      const nowWhitelisted = !isWhitelisted;
      const path = nowWhitelisted ? iconPaths.alert : iconPaths.normal;
      try {
        if (api.action) api.action.setIcon({ tabId, path });
        else if (api.browserAction) api.browserAction.setIcon({ tabId, path });
      } catch (_e) { /* tab may be closed */ }
    }

    return { success: true, whitelisted: !isWhitelisted };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check whether a site is currently whitelisted.
 *
 * @param {string} hostname - Hostname to check.
 * @returns {Promise<boolean>}
 */
export async function isSiteWhitelisted(hostname) {
  try {
    const normalised = normalizeHostname(hostname, true);
    if (!normalised) return false;
    const storage = await getStorage(['whitelistedSites']);
    const whitelisted = normalizeDomainList(storage.whitelistedSites || [], true);
    return whitelisted.includes(normalised);
  } catch (_e) {
    return false;
  }
}

// ============================================
// ALLOWED / UNBLOCKED DOMAINS
// ============================================

/**
 * Add a domain to the allowed-domains list (exempt from network blocking).
 *
 * @param {string} domain - Domain to allow.
 * @returns {Promise<{ success: boolean, domain?: string, error?: string }>}
 */
export async function addAllowedDomain(domain) {
  const normalised = normalizeHostname(domain);
  if (!normalised) return { success: false, error: 'Invalid domain' };

  const maxDomains = DEFAULT_SETTINGS.maxBlockedDomains || 1000;
  const storage = await getStorage(['allowedDomains']);
  const allowedDomains = normalizeDomainList(storage.allowedDomains || [], false, maxDomains);

  if (!allowedDomains.includes(normalised)) {
    if (allowedDomains.length >= maxDomains) {
      return { success: false, error: 'Allowed domains limit reached' };
    }
    allowedDomains.push(normalised);
    await setStorage({ allowedDomains });
  }

  return { success: true, domain: normalised };
}

/**
 * Unblock a previously user-blocked domain (move from blocked → allowed).
 *
 * @param {string} urlOrDomain - URL or domain to unblock.
 * @param {Function} refreshNetworkRulesFn - Callback to refresh DNR rules.
 * @returns {Promise<{ success: boolean, domain?: string, error?: string }>}
 */
export async function unblockRequestDomain(urlOrDomain, refreshNetworkRulesFn) {
  const domain = normalizeHostname(urlOrDomain);
  if (!domain) return { success: false, error: 'Invalid URL or domain' };

  const targetNoWww = normalizeHostname(domain, true);
  const maxDomains = DEFAULT_SETTINGS.maxBlockedDomains || 1000;
  const storage = await getStorage(['blockedDomains', 'allowedDomains']);
  const blockedDomains = normalizeDomainList(storage.blockedDomains || [], false, maxDomains);
  const allowedDomains = normalizeDomainList(storage.allowedDomains || [], false, maxDomains);

  const updatedBlocked = blockedDomains.filter((entry) =>
    entry !== domain && normalizeHostname(entry, true) !== targetNoWww
  );

  const alreadyAllowed = allowedDomains.some((entry) =>
    entry === domain || normalizeHostname(entry, true) === targetNoWww
  );

  if (!alreadyAllowed) {
    if (allowedDomains.length >= maxDomains) {
      return { success: false, error: 'Allowed domains limit reached' };
    }
    allowedDomains.push(domain);
  }

  await setStorage({ blockedDomains: updatedBlocked, allowedDomains });
  if (typeof refreshNetworkRulesFn === 'function') {
    await refreshNetworkRulesFn();
  }

  return { success: true, domain };
}
