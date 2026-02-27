/**
 * @module network-blocker
 * @description Network-level request blocking for the WebSuddhi extension.
 * MV3 — declarativeNetRequest (static + dynamic rules).
 * MV2 — webRequest.onBeforeRequest blocking.
 *
 * Fix issue #6 / #13: This module is the single source of truth for
 * `tabBlockedCounts` — no duplicate map exists in the main background script.
 *
 * Fix issue #3: Replaced `setInterval` for DNR polling with `chrome.alarms`.
 *
 * Fix issue #15: For MV2, webRequest listeners are re-registered on settings
 * change, avoiding stale closures over outdated whitelist / blocklist data.
 *
 * @version 2.1.0
 */
'use strict';

import { NETWORK_RULE_ID_START, NETWORK_RULE_ID_END } from '../shared/constants.js';
import { getStorage, setStorage } from '../shared/storage.js';
import { normalizeDomainList } from '../shared/domain-utils.js';

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
// CONSTANTS
// ============================================

const BLOCKED_RESOURCE_TYPES = [
  'script', 'image', 'xmlhttprequest', 'sub_frame',
  'stylesheet', 'font', 'media', 'websocket', 'ping', 'other'
];

const DNR_POLL_ALARM = 'websuddhi-dnrPoll';

// ============================================
// MV2 DOMAIN SETS
// ============================================

const MV2_AD_DOMAINS = new Set([
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.com', 'pagead2.googlesyndication.com',
  'google-analytics.com', 'googletagmanager.com',
  'criteo.com', 'taboola.com', 'outbrain.com',
  'amazon-adsystem.com', 'adnxs.com', 'pubmatic.com',
  'openx.net', 'rubiconproject.com', 'casalemedia.com',
  'indexww.com', 'advertising.com', 'media.net',
  'connect.facebook.net', 'pixel.facebook.com',
  'ads.twitter.com', 'ads.linkedin.com',
  'analytics.twitter.com', 'tr.snapchat.com',
  'mixpanel.com', 'segment.com', 'hotjar.com', 'clarity.ms',
  'moatads.com', 'doubleverify.com', 'thetradedesk.com',
  'serving-sys.com', 'rlcdn.com', 'demdex.net',
  'everesttech.net', 'mathtag.com', 'simpli.fi',
  'bat.bing.com', 'ads.pinterest.com', 'analytics.tiktok.com',
  'scorecardresearch.com', 'imrworldwide.com',
  'adsrvr.org', 'krxd.net', 'tapad.com',
  'bidswitch.net', 'smartadserver.com', 'adform.net',
  'smaato.net', 'sharethrough.com', 'triplelift.com',
  'gumgum.com', '33across.com', 'sovrn.com',
  'adroll.com', 'bluekai.com', 'bombora.com',
  'revcontent.com', 'mgid.com', 'propellerads.com',
  'popads.net', 'adsterra.com', 'exoclick.com',
  'trafficjunky.com', 'spotxchange.com',
  'fingerprintjs.com', 'amplitude.com', 'posthog.com',
  'pendo.io', 'logrocket.com', 'fullstory.com',
  'mouseflow.com', 'smartlook.com', 'contentsquare.com',
  'clearbit.com', 'zoominfo.com',
  'pardot.com', 'marketo.com', 'eloqua.com',
  'carbonads.com', 'buysellads.com',
  'adcolony.com', 'inmobi.com', 'appsflyer.com',
  'adjust.com', 'kochava.com', 'liadm.com',
  'crwdcntrl.net', 'lotame.com', 'eyeota.com',
  'nativo.com', 'bidtellect.com', 'zemanta.com',
  'jwpltx.com', 'connatix.com',
  'sessionstack.com', 'heatmap.com',
  'agkn.com', 'ml314.com', 'bkrtx.com',
  'semasio.net', 'weborama.com',
  'adkernel.com', 'adpushup.com', 'publift.com',
  'setupad.com', 'snigel.com', 'freestar.com',
  'sortable.com', 'playwire.com', 'venatus.com', 'nitropay.com'
]);

const MV2_TRACKING_DOMAINS = new Set([
  'fpjs.io', 'perimeterx.com', 'datadome.co',
  'walkme.com', 'appcues.com', 'bugsnag.com', 'rollbar.com',
  'trackjs.com', 'newrelic.com', 'dynatrace.com',
  'appdynamics.com', 'apollo.io', 'lusha.com', 'leadiq.com'
]);

// ============================================
// STATE (single source of truth — fix #6 / #13)
// ============================================

/** @type {Map<number, number>} tabId → blocked request count */
const tabBlockedCounts = new Map();

/** @type {Function|null} Currently-registered MV2 listener (fix #15). */
let _mv2BlockingListener = null;

// ============================================
// INITIALISATION
// ============================================

/**
 * Initialise the network blocker.
 *
 * @param {Function} reportNetworkBlockFn - Callback for stats reporting.
 * @returns {Promise<void>}
 */
export async function initNetworkBlocker(reportNetworkBlockFn) {
  const api = getApi();
  const storage = await getStorage([
    'networkBlockingEnabled', 'whitelistedSites', 'blockedDomains', 'allowedDomains'
  ]);
  const enabled = storage.networkBlockingEnabled !== false;

  if (!enabled) {
    if (api.declarativeNetRequest) await clearManagedDynamicRules();
    return;
  }

  if (api.declarativeNetRequest) {
    await setupDynamicRules(storage);
    setupDNRFeedback(reportNetworkBlockFn);
  } else if (api.webRequest?.onBeforeRequest) {
    registerMV2Listener(storage, reportNetworkBlockFn);
  }

  setupTabListeners();
  setupNavigationListener();
}

// ============================================
// MV3: DYNAMIC RULES
// ============================================

/** @private */
function isManagedRuleId(id) {
  return Number.isInteger(id) && id >= NETWORK_RULE_ID_START && id <= NETWORK_RULE_ID_END;
}

/** @returns {Promise<void>} @private */
async function clearManagedDynamicRules() {
  const api = getApi();
  if (!api.declarativeNetRequest) return;
  try {
    const existing = await api.declarativeNetRequest.getDynamicRules();
    const ids = existing.filter((r) => isManagedRuleId(r.id)).map((r) => r.id);
    if (ids.length) await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
  } catch (err) {
    console.error('[WebSuddhi] clearManagedDynamicRules:', err);
  }
}

/**
 * @param {Object} storage
 * @returns {Promise<void>}
 * @private
 */
async function setupDynamicRules(storage) {
  const api = getApi();
  const blocked = normalizeDomainList(storage.blockedDomains || []);
  const allowed = normalizeDomainList(storage.allowedDomains || []);
  const whitelisted = normalizeDomainList(storage.whitelistedSites || [], true);

  const rules = [];
  let ruleId = NETWORK_RULE_ID_START;

  /** @param {Object} rule @returns {boolean} */
  function push(rule) {
    if (ruleId > NETWORK_RULE_ID_END) return false;
    rules.push({ ...rule, id: ruleId++ });
    return true;
  }

  for (const d of blocked) {
    if (!push({ priority: 1, action: { type: 'block' }, condition: { urlFilter: '||' + d, resourceTypes: BLOCKED_RESOURCE_TYPES } })) break;
  }
  for (const d of allowed) {
    if (!push({ priority: 2, action: { type: 'allow' }, condition: { urlFilter: '||' + d, resourceTypes: BLOCKED_RESOURCE_TYPES } })) break;
  }
  for (const d of whitelisted) {
    if (!push({ priority: 3, action: { type: 'allow' }, condition: { resourceTypes: BLOCKED_RESOURCE_TYPES, initiatorDomains: [d] } })) break;
  }

  try {
    const existing = await api.declarativeNetRequest.getDynamicRules();
    const removeIds = existing.filter((r) => isManagedRuleId(r.id)).map((r) => r.id);
    await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules: rules });
  } catch (err) {
    console.error('[WebSuddhi] setupDynamicRules:', err);
  }
}

/**
 * Refresh dynamic DNR rules from current storage.
 *
 * @returns {Promise<{ success: boolean, refreshed?: boolean, reason?: string }>}
 */
export async function refreshDynamicRules() {
  const api = getApi();
  if (!api.declarativeNetRequest) return { success: true, refreshed: false, reason: 'dnr_unavailable' };

  const storage = await getStorage(['networkBlockingEnabled', 'blockedDomains', 'allowedDomains', 'whitelistedSites']);
  if (storage.networkBlockingEnabled === false) {
    await clearManagedDynamicRules();
    return { success: true, refreshed: false, reason: 'network_blocking_disabled' };
  }

  await setupDynamicRules(storage);
  return { success: true, refreshed: true };
}

// ============================================
// DNR FEEDBACK (fix #3 — alarms instead of setInterval)
// ============================================

/**
 * @param {Function} reportFn
 * @private
 */
function setupDNRFeedback(reportFn) {
  const api = getApi();

  if (api.declarativeNetRequest?.onRuleMatchedDebug) {
    api.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
      if (info.request?.tabId >= 0) {
        const tabId = info.request.tabId;
        const count = (tabBlockedCounts.get(tabId) || 0) + 1;
        tabBlockedCounts.set(tabId, count);
        updateBadge(tabId, count);
        try {
          const url = new URL(info.request.url);
          if (typeof reportFn === 'function') reportFn(tabId, url.hostname);
        } catch (_e) { /* ignore */ }
      }
    });
  } else if (api.declarativeNetRequest?.getMatchedRules && api.alarms) {
    // Fix #3: Use alarms instead of setInterval for polling
    api.alarms.create(DNR_POLL_ALARM, { periodInMinutes: 0.5 });
  }
}

/**
 * Handle the DNR poll alarm.
 *
 * @param {Object} alarm
 * @returns {boolean}
 */
export function handleDNRPollAlarm(alarm) {
  if (alarm.name !== DNR_POLL_ALARM) return false;

  const api = getApi();
  if (!api.declarativeNetRequest?.getMatchedRules) return true;

  api.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs[0]) return;
    try {
      const result = await api.declarativeNetRequest.getMatchedRules({ tabId: tabs[0].id });
      const count = result.rulesMatchedInfo ? result.rulesMatchedInfo.length : 0;
      if (count > 0) {
        tabBlockedCounts.set(tabs[0].id, count);
        updateBadge(tabs[0].id, count);
      }
    } catch (_e) { /* ignore */ }
  });

  return true;
}

// ============================================
// MV2: WEBREQUEST BLOCKING (fix #15 — re-register on change)
// ============================================

/**
 * Register (or re-register) the MV2 webRequest blocking listener.
 * Fix #15: unregisters the previous listener first to avoid stale closures.
 *
 * @param {Object} storage - Current storage snapshot.
 * @param {Function} reportFn - Network block reporter callback.
 * @private
 */
function registerMV2Listener(storage, reportFn) {
  const api = getApi();

  // Fix #15: remove previous listener to prevent stale closure
  if (_mv2BlockingListener && api.webRequest?.onBeforeRequest) {
    api.webRequest.onBeforeRequest.removeListener(_mv2BlockingListener);
    _mv2BlockingListener = null;
  }

  const whitelistedSites = new Set(storage.whitelistedSites || []);
  const userBlocked = new Set(storage.blockedDomains || []);
  const allowedSet = new Set(storage.allowedDomains || []);
  const allBlocked = new Set([...MV2_AD_DOMAINS, ...MV2_TRACKING_DOMAINS, ...userBlocked]);

  _mv2BlockingListener = (details) => {
    if (details.type === 'main_frame') return {};
    try {
      const url = new URL(details.url);
      const domain = url.hostname;

      let initiatorHost = null;
      if (details.initiator || details.documentUrl) {
        try {
          initiatorHost = new URL(details.initiator || details.documentUrl).hostname.replace(/^www\./, '');
          if (whitelistedSites.has(initiatorHost)) return {};
        } catch (_e) { /* ignore */ }
      }

      if (allowedSet.has(domain)) return {};

      if (isDomainBlocked(domain, allBlocked)) {
        const tabId = details.tabId;
        if (tabId >= 0) {
          const count = (tabBlockedCounts.get(tabId) || 0) + 1;
          tabBlockedCounts.set(tabId, count);
          updateBadge(tabId, count);
          if (typeof reportFn === 'function') {
            const site = initiatorHost || 'Unknown';
            reportFn(tabId, domain, site);
          }
        }
        return { cancel: true };
      }
    } catch (_e) { /* ignore */ }
    return {};
  };

  api.webRequest.onBeforeRequest.addListener(
    _mv2BlockingListener,
    { urls: ['<all_urls>'] },
    ['blocking']
  );
}

/**
 * @param {string} hostname
 * @param {Set<string>} blocklist
 * @returns {boolean}
 * @private
 */
function isDomainBlocked(hostname, blocklist) {
  const parts = hostname.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    if (blocklist.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}

// ============================================
// BADGE & TAB MANAGEMENT
// ============================================

/**
 * @param {number} tabId
 * @param {number} count
 * @private
 */
function updateBadge(tabId, count) {
  const api = getApi();
  try {
    const text = count > 999 ? '999+' : String(count);
    if (api.action) {
      api.action.setBadgeText({ text, tabId });
      api.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
    } else if (api.browserAction) {
      api.browserAction.setBadgeText({ text, tabId });
      api.browserAction.setBadgeBackgroundColor({ color: '#ef4444', tabId });
    }
  } catch (_e) { /* ignore */ }
}

/** @private */
function setupTabListeners() {
  const api = getApi();
  if (api.tabs?.onRemoved) {
    api.tabs.onRemoved.addListener((tabId) => tabBlockedCounts.delete(tabId));
  }
}

/** @private */
function setupNavigationListener() {
  const api = getApi();
  if (api.webNavigation?.onCommitted) {
    api.webNavigation.onCommitted.addListener((d) => {
      if (d.frameId === 0) { tabBlockedCounts.set(d.tabId, 0); updateBadge(d.tabId, 0); }
    });
  } else if (api.tabs?.onUpdated) {
    api.tabs.onUpdated.addListener((tabId, change) => {
      if (change.status === 'loading') { tabBlockedCounts.set(tabId, 0); updateBadge(tabId, 0); }
    });
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Get the blocked-request count for a tab.
 *
 * @param {number} tabId
 * @returns {number}
 */
export function getNetworkBlockedCount(tabId) {
  return tabBlockedCounts.get(tabId) || 0;
}

/**
 * Add a domain to the user-blocked list.
 *
 * @param {string} domain
 * @returns {Promise<{ success: boolean }>}
 */
export async function addDomainBlock(domain) {
  const storage = await getStorage(['blockedDomains']);
  const domains = storage.blockedDomains || [];
  if (!domains.includes(domain)) {
    domains.push(domain);
    await setStorage({ blockedDomains: domains });
    await refreshDynamicRules();
  }
  return { success: true };
}

/**
 * Remove a domain from the user-blocked list.
 *
 * @param {string} domain
 * @returns {Promise<{ success: boolean }>}
 */
export async function removeDomainBlock(domain) {
  const storage = await getStorage(['blockedDomains']);
  const domains = (storage.blockedDomains || []).filter((d) => d !== domain);
  await setStorage({ blockedDomains: domains });
  await refreshDynamicRules();
  return { success: true };
}

/**
 * Toggle network-level blocking on/off.
 *
 * @param {boolean} enabled
 * @returns {Promise<{ success: boolean, enabled: boolean }>}
 */
export async function toggleNetworkBlocking(enabled) {
  const api = getApi();
  await setStorage({ networkBlockingEnabled: enabled });

  if (api.declarativeNetRequest) {
    try {
      await api.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: enabled ? ['ad_domains', 'tracking_domains', 'tracking_params'] : [],
        disableRulesetIds: enabled ? [] : ['ad_domains', 'tracking_domains', 'tracking_params']
      });
    } catch (_e) { /* ignore */ }
    await refreshDynamicRules();
  }

  return { success: true, enabled };
}

/**
 * Get the raw `tabBlockedCounts` map (for debugging).
 *
 * @returns {Map<number, number>}
 */
export function getTabBlockedCounts() {
  return tabBlockedCounts;
}
