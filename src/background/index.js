/**
 * @module background/index
 * @description Main entry point for the WebSuddhi background service worker.
 *
 * Wires together all background modules: message routing, context menu,
 * keyboard shortcuts, tab lifecycle, network blocking, stats, privacy,
 * filter lists, phishing detection, icon management, and sync.
 *
 * FIX #3: Uses chrome.alarms instead of setInterval (which is unreliable
 * in MV3 service workers that can be terminated).
 *
 * @version 2.1.0
 */
'use strict';

// --- Module imports ---
import { isRateLimited, resetRateLimits } from './rate-limiter.js';
import { notifyAllTabs, tabFrameMap, setTabFrameEntry } from './tab-manager.js';
import { ICON_PATHS_NORMAL, ICON_PATHS_ALERT, startIconBlink, stopIconBlink, handleIconBlinkAlarm, clearOrphanedBlinkAlarms } from './icon.js';
import { setupContextMenu, handleContextMenuClick } from './context-menu.js';
import { setupCommandListener } from './commands.js';
import { addLogEntry, getRequestLog, clearRequestLog, flushLogEntries } from './log-manager.js';
import { getStats, getStatsForPeriod, resetStats, incrementStats } from './stats.js';
import { initStatsManager, reportCosmeticBlock, reportNetworkBlock, flushStats } from './stats-manager.js';
import { addSelector, removeSelector, getAllSelectors, mergeSelectorEntries } from './selector-manager.js';
import { initNetworkBlocker, refreshDynamicRules, handleDNRPollAlarm, getNetworkBlockedCount, addDomainBlock, removeDomainBlock } from './network-blocker.js';
import { initPrivacy, toggleReferrerStripping, toggleWebRTCProtection, togglePingProtection, toggleTelemetryBlocking, toggleThirdPartyCookieBlocking } from './privacy.js';
import { initFilterLists, addSubscription, removeSubscription, toggleSubscription, updateSubscription, updateAllSubscriptions, getSubscriptions } from './filter-lists.js';
import { toggleEnabled, togglePaywall, toggleSocialBlocking } from './toggle.js';
import { whitelistSite, unwhitelistSite, toggleWhitelistForSite, isSiteWhitelisted, addAllowedDomain, unblockRequestDomain } from './whitelist.js';
import { migrateStorage, setupSyncListener } from './sync.js';

// Cross-browser API
const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

// ============================================
// CONSTANTS & DEFAULTS
// ============================================

/** @type {object} Default extension settings */
const DEFAULT_SETTINGS = {
  enabled: true,
  paywallEnabled: true,
  socialBlockingEnabled: false,
  networkBlockingEnabled: true,
  urlCleaningEnabled: true,
  cookieConsentEnabled: true,
  annoyanceBlockingEnabled: true,
  phishingProtectionEnabled: true,
  pingProtectionEnabled: true,
  referrerStrippingEnabled: false,
  webrtcProtectionEnabled: false,
  telemetryBlockingEnabled: false,
  thirdPartyCookieBlockingEnabled: false,
  syncEnabled: false,
  loggingEnabled: true,
  toastDuration: 3,
  performanceStats: {
    totalBlocked: 0,
    byCategory: { ads: 0, trackers: 0, annoyances: 0, paywall: 0 },
    today: { blocked: 0, topDomains: {}, perSite: {} },
    history: [],
  },
  maxBlockedCount: 10000,
  maxLogEntries: 1000,
  maxWhitelistSize: 1000,
  maxBlockedDomains: 1000,
  maxBlockedSelectors: 1000,
};

/** Message types exempt from rate limiting */
const RATE_LIMIT_EXEMPT = new Set([
  'GET_ALL_SETTINGS', 'GET_STATS', 'GET_ENHANCED_STATS',
  'GET_PERIOD_STATS', 'GET_STATS_FOR_PERIOD',
]);

// ============================================
// STORAGE HELPERS
// ============================================

/**
 * @param {string[]} keys
 * @returns {Promise<object>}
 */
async function getStorage(keys) {
  return new Promise((resolve) => {
    api.storage.local.get(keys, (data) => {
      if (api.runtime.lastError) {
        console.error('[WebSuddhi]', api.runtime.lastError);
        resolve({});
      } else {
        resolve(data || {});
      }
    });
  });
}

/**
 * @param {object} data
 * @returns {Promise<void>}
 */
async function setStorage(data) {
  return new Promise((resolve) => {
    api.storage.local.set(data, () => {
      if (api.runtime.lastError) {
        console.error('[WebSuddhi]', api.runtime.lastError);
      }
      resolve();
    });
  });
}

function normalizeHostname(value, stripWww = false) {
  if (!value || typeof value !== 'string') return null;
  let host = value.trim().toLowerCase();
  if (!host) return null;
  try {
    const parsed = new URL(host.includes('://') ? host : 'https://' + host);
    host = parsed.hostname.toLowerCase();
  } catch (_) {
    host = host.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  }
  host = host.replace(/^\.+/, '').replace(/\.+$/, '');
  if (stripWww) host = host.replace(/^www\./, '');
  if (!host || host.includes(' ')) return null;
  return host;
}

function normalizeDomainList(domains, stripWww = false, max = Infinity) {
  const out = [];
  const seen = new Set();
  for (const d of domains || []) {
    const h = normalizeHostname(d, stripWww);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    out.push(h);
    if (out.length >= max) break;
  }
  return out;
}

// ============================================
// FRAME & SECURITY HELPERS
// ============================================

async function reportFrame(message, sender) {
  const tabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
  if (typeof tabId !== 'number' || tabId < 0) return { success: false, error: 'No tab ID' };
  const host = normalizeHostname(message.frameHost || message.frameUrl);
  if (!host) return { success: false, error: 'Invalid frame host' };
  setTabFrameEntry(tabId, host, message.frameUrl || host, message.blocked);
  return { success: true };
}

async function allowFrame(message, sender) {
  const tabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
  const host = normalizeHostname(message.frameHost || message.frameUrl);
  if (!host) return { success: false, error: 'Invalid frame host' };
  setTabFrameEntry(tabId, host, message.frameUrl || host, false);
  const r = await addAllowedDomain(host);
  if (!r.success) return r;
  await refreshDynamicRules();
  return { success: true, domain: host };
}

async function getSecurityInfo(tabId) {
  if (typeof tabId !== 'number' || tabId < 0) {
    return { success: false, certificate: null, thirdPartyDomains: [], blockedFrames: [] };
  }
  const storage = await getStorage(['allowedDomains']);
  const allowed = normalizeDomainList(storage.allowedDomains || []);
  const tabFrames = tabFrameMap.get(tabId);
  const thirdPartyDomains = [];
  const blockedFrames = [];

  if (tabFrames) {
    for (const frame of tabFrames.values()) {
      const entry = { host: frame.host, url: frame.url || frame.host };
      const isAllowed = allowed.some((d) => frame.host === d || frame.host.endsWith('.' + d));
      if (isAllowed || frame.blocked !== true) thirdPartyDomains.push(entry);
      else blockedFrames.push(entry);
    }
  }
  thirdPartyDomains.sort((a, b) => a.host.localeCompare(b.host));
  blockedFrames.sort((a, b) => a.host.localeCompare(b.host));

  let certificate = null;
  try {
    const tab = await new Promise((resolve) => {
      api.tabs.get(tabId, (t) => { if (api.runtime.lastError) resolve(null); else resolve(t); });
    });
    const host = normalizeHostname(tab?.url || '', true);
    if (host && tab?.url?.startsWith('https://')) {
      certificate = { organization: host, issuer: host, validFrom: null, validTo: null, protocol: '', cipher: '', fingerprint: '' };
    }
  } catch (_) {}

  return { success: true, certificate, thirdPartyDomains, blockedFrames };
}

// ============================================
// IMPORT / EXPORT
// ============================================

async function exportRules() {
  const s = await getStorage(['blockedSelectors', 'blockedDomains', 'allowedDomains', 'whitelistedSites', 'enabled', 'paywallEnabled']);
  return {
    success: true,
    data: {
      version: '2.1.0',
      exportDate: new Date().toISOString(),
      blockedSelectors: s.blockedSelectors || [],
      blockedDomains: s.blockedDomains || [],
      allowedDomains: s.allowedDomains || [],
      whitelistedSites: s.whitelistedSites || [],
      enabled: s.enabled !== false,
      paywallEnabled: s.paywallEnabled !== false,
    },
  };
}

async function importRules(data) {
  if (!data || typeof data !== 'object') return { success: false, error: 'Invalid import data' };
  const keys = ['blockedSelectors', 'blockedDomains', 'allowedDomains', 'whitelistedSites'];
  if (!keys.some((k) => Array.isArray(data[k]))) return { success: false, error: 'Invalid import format' };

  const maxSel = DEFAULT_SETTINGS.maxBlockedSelectors;
  const maxDom = DEFAULT_SETTINGS.maxBlockedDomains;
  const maxWl = DEFAULT_SETTINGS.maxWhitelistSize;
  const s = await getStorage(keys.concat(['enabled', 'paywallEnabled']));

  const blockedSelectors = Array.isArray(data.blockedSelectors)
    ? mergeSelectorEntries(s.blockedSelectors || [], data.blockedSelectors, maxSel)
    : s.blockedSelectors || [];
  const blockedDomains = Array.isArray(data.blockedDomains)
    ? normalizeDomainList([...(s.blockedDomains || []), ...data.blockedDomains], false, maxDom)
    : normalizeDomainList(s.blockedDomains || [], false, maxDom);
  const allowedDomains = Array.isArray(data.allowedDomains)
    ? normalizeDomainList([...(s.allowedDomains || []), ...data.allowedDomains], false, maxDom)
    : normalizeDomainList(s.allowedDomains || [], false, maxDom);
  const whitelistedSites = Array.isArray(data.whitelistedSites)
    ? normalizeDomainList([...(s.whitelistedSites || []), ...data.whitelistedSites], true, maxWl)
    : normalizeDomainList(s.whitelistedSites || [], true, maxWl);

  const update = { blockedSelectors, blockedDomains, allowedDomains, whitelistedSites };
  if (typeof data.enabled === 'boolean') update.enabled = data.enabled;
  if (typeof data.paywallEnabled === 'boolean') update.paywallEnabled = data.paywallEnabled;

  await setStorage(update);
  if (Array.isArray(data.blockedDomains) || Array.isArray(data.allowedDomains) || Array.isArray(data.whitelistedSites)) {
    await refreshDynamicRules();
  }
  await notifyAllTabs();
  return { success: true, totalRules: blockedSelectors.length, imported: { blockedDomains: blockedDomains.length, allowedDomains: allowedDomains.length, whitelistedSites: whitelistedSites.length } };
}

// ============================================
// PERFORMANCE STATS
// ============================================

async function getPerformanceStats() {
  try {
    const d = await getStorage(['performanceStats']);
    return { success: true, performanceStats: d.performanceStats || DEFAULT_SETTINGS.performanceStats };
  } catch (_) {
    return { success: true, performanceStats: DEFAULT_SETTINGS.performanceStats };
  }
}

// ============================================
// MESSAGE HANDLER
// ============================================

/**
 * Central message dispatcher for the background service worker.
 * Routes incoming messages to the appropriate module function.
 *
 * @param {object} message - Message with `type` field.
 * @param {object} sender - Sender info from runtime.onMessage.
 * @returns {Promise<object>}
 */
async function handleMessage(message, sender) {
  if (!RATE_LIMIT_EXEMPT.has(message.type) && isRateLimited(sender.tab?.id)) {
    return { success: false, error: 'Rate limited' };
  }

  try {
    switch (message.type) {
      // --- Stats ---
      case 'GET_STATS':
      case 'GET_ENHANCED_STATS':
        return await getStats(message.days);
      case 'GET_PERIOD_STATS':
      case 'GET_STATS_FOR_PERIOD':
        return await getStatsForPeriod(message.days || 1);
      case 'INCREMENT_COSMETIC_STATS':
      case 'INCREMENT_STATS':
        reportCosmeticBlock(message.hostname, message.count, message.selector);
        return await incrementStats(message.hostname, message.count);
      case 'RESET_STATS':
        return await resetStats();

      // --- Selectors ---
      case 'ADD_SELECTOR':
        return await addSelector(sender.tab?.id, message.selector);
      case 'REMOVE_SELECTOR':
        return await removeSelector(message.selector);
      case 'GET_SELECTORS':
        return await getAllSelectors();

      // --- Network blocking ---
      case 'ADD_DOMAIN_BLOCK':
        return await addDomainBlock(message.domain);
      case 'REMOVE_DOMAIN_BLOCK':
        return await removeDomainBlock(message.domain);
      case 'GET_BLOCKED_COUNT':
        return { success: true, count: getNetworkBlockedCount(message.tabId) };
      case 'TOGGLE_NETWORK_BLOCKING':
        return await setStorage({ networkBlockingEnabled: message.enabled }).then(() => ({ success: true }));

      // --- URL cleaning ---
      case 'TOGGLE_URL_CLEANING':
        await setStorage({ urlCleaningEnabled: message.enabled });
        return { success: true };
      case 'TOGGLE_COOKIE_CONSENT':
        await setStorage({ cookieConsentEnabled: message.enabled });
        await notifyAllTabs();
        return { success: true };
      case 'TOGGLE_ANNOYANCE_BLOCKING':
        await setStorage({ annoyanceBlockingEnabled: message.enabled });
        await notifyAllTabs();
        return { success: true };

      // --- Privacy ---
      case 'GET_PRIVACY_STATUS':
        return { success: true, status: {} };
      case 'TOGGLE_REFERRER_STRIPPING':
        return await toggleReferrerStripping(message.enabled);
      case 'TOGGLE_WEBRTC_PROTECTION':
        return await toggleWebRTCProtection(message.enabled);
      case 'TOGGLE_PING_PROTECTION':
        return await togglePingProtection(message.enabled);
      case 'TOGGLE_TELEMETRY_BLOCKING':
        return await toggleTelemetryBlocking(message.enabled);
      case 'TOGGLE_THIRD_PARTY_COOKIE_BLOCKING':
        return await toggleThirdPartyCookieBlocking(message.enabled);

      // --- Toggles ---
      case 'TOGGLE_ENABLED':
        return await toggleEnabled(message.enabled);
      case 'TOGGLE_PAYWALL':
        return await togglePaywall(message.enabled);
      case 'TOGGLE_SOCIAL_BLOCKING':
        return await toggleSocialBlocking(message.enabled);

      // --- Whitelist ---
      case 'TOGGLE_WHITELIST':
        if (sender.tab?.url) {
          const h = new URL(sender.tab.url).hostname;
          return await toggleWhitelistForSite(h, sender.tab.id, refreshDynamicRules, { normal: ICON_PATHS_NORMAL, alert: ICON_PATHS_ALERT });
        }
        return { success: false, error: 'No tab URL' };
      case 'IS_WHITELISTED':
        return message.hostname
          ? { success: true, whitelisted: await isSiteWhitelisted(message.hostname) }
          : { success: false, error: 'No hostname' };
      case 'WHITELIST_SITE':
        return await whitelistSite(message.hostname, refreshDynamicRules);
      case 'UNWHITELIST_SITE':
        return await unwhitelistSite(message.hostname, refreshDynamicRules);
      case 'GET_WHITELIST': {
        const wlStore = await getStorage(['whitelistedSites']);
        return { success: true, whitelistedSites: wlStore.whitelistedSites || [] };
      }

      // --- Frames & Security ---
      case 'REPORT_FRAME':
        return await reportFrame(message, sender);
      case 'GET_SECURITY_INFO': {
        const sid = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
        return await getSecurityInfo(sid);
      }
      case 'ALLOW_FRAME':
        return await allowFrame(message, sender);
      case 'UNBLOCK_REQUEST':
        return await unblockRequestDomain(message.url || message.domain);

      // --- Filter lists ---
      case 'GET_FILTER_SUBSCRIPTIONS':
        return { success: true, subscriptions: await getSubscriptions() };
      case 'ADD_FILTER_SUBSCRIPTION':
        return await addSubscription(message.name, message.url);
      case 'REMOVE_FILTER_SUBSCRIPTION':
        return await removeSubscription(message.subscriptionId);
      case 'TOGGLE_FILTER_SUBSCRIPTION':
        return await toggleSubscription(message.subscriptionId, message.enabled);
      case 'UPDATE_FILTER_SUBSCRIPTION':
        return await updateSubscription(message.subscriptionId);
      case 'UPDATE_ALL_FILTER_SUBSCRIPTIONS':
        await updateAllSubscriptions();
        return { success: true };

      // --- Settings ---
      case 'GET_ALL_SETTINGS': {
        const keys = Object.keys(DEFAULT_SETTINGS);
        const all = await getStorage(keys);
        const settings = {};
        for (const k of keys) settings[k] = all[k] !== undefined ? all[k] : DEFAULT_SETTINGS[k];
        const ld = await getStorage(['syncEnabled']);
        settings.syncEnabled = ld.syncEnabled || false;
        return { success: true, settings };
      }

      // --- Sync ---
      case 'TOGGLE_SYNC':
        return await migrateStorage(message.enabled);

      // --- Performance ---
      case 'GET_PERFORMANCE_STATS':
        return await getPerformanceStats();
      case 'RESET_PERFORMANCE_STATS':
        await setStorage({ performanceStats: DEFAULT_SETTINGS.performanceStats });
        return { success: true };

      // --- Request log ---
      case 'GET_REQUEST_LOG':
        return { success: true, log: await getRequestLog() };
      case 'CLEAR_REQUEST_LOG':
        return await clearRequestLog();
      case 'ADD_LOG_ENTRY':
        return addLogEntry(message.entry);

      // --- Import/Export ---
      case 'EXPORT_RULES':
        return await exportRules();
      case 'IMPORT_RULES':
        return await importRules(message.data);

      // --- Phishing ---
      case 'CHECK_PHISHING': {
        const ps = await getStorage(['phishingProtectionEnabled']);
        if (ps.phishingProtectionEnabled === false) return { isSuspicious: false };
        if (message.domain && self.WebSuddhi?.phishingDetector) {
          const result = self.WebSuddhi.phishingDetector.checkDomain(message.domain);
          if (result.isSuspicious) {
            self.WebSuddhi.phishingDetector.recordDetection(result);
            if (sender.tab?.id) startIconBlink(sender.tab.id);
          }
          return result;
        }
        return { isSuspicious: false };
      }
      case 'REPORT_PHISHING':
        if (message.domain && self.WebSuddhi?.phishingDetector) {
          self.WebSuddhi.phishingDetector.recordDetection({
            isSuspicious: true,
            originalDomain: message.domain,
            reason: 'User reported',
            riskLevel: 'user_reported',
            matchedBrand: message.brand || 'Unknown',
          });
          return { success: true };
        }
        return { success: false, error: 'Invalid report data' };
      case 'GET_PHISHING_STATS':
        return {
          success: true,
          stats: self.WebSuddhi?.phishingDetector?.getPhishingStats() ||
            { totalDetected: 0, recentDetections: [], topTargetedBrands: [] },
        };
      case 'RESET_PHISHING_STATS':
        self.WebSuddhi?.phishingDetector?.resetPhishingStats();
        return { success: true };
      case 'TOGGLE_PHISHING_PROTECTION':
        await setStorage({ phishingProtectionEnabled: message.enabled });
        return { success: true, enabled: message.enabled };
      case 'GET_PROTECTED_BRANDS':
        return { success: true, brands: self.WebSuddhi?.phishingDetector?.getProtectedBrands() || [] };
      case 'ADD_PROTECTED_BRAND':
        if (self.WebSuddhi?.phishingDetector && message.name && message.domains) {
          return { success: self.WebSuddhi.phishingDetector.addProtectedBrand(message.name, message.domains) };
        }
        return { success: false, error: 'Invalid brand data' };
      case 'REMOVE_PROTECTED_BRAND':
        if (self.WebSuddhi?.phishingDetector && message.name) {
          return { success: self.WebSuddhi.phishingDetector.removeProtectedBrand(message.name) };
        }
        return { success: false, error: 'Invalid brand name' };
      case 'PHISHING_DETECTED':
        if (sender.tab?.id) startIconBlink(sender.tab.id);
        return { success: true };
      case 'STOP_PHISHING_ALERT': {
        const tid = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
        if (typeof tid === 'number') stopIconBlink(tid);
        return { success: true };
      }

      // --- Anti-adblock injection (FIX #8) ---
      case 'INJECT_ANTI_ADBLOCK': {
        const tId = sender.tab?.id;
        if (tId && chrome.scripting) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tId },
              world: 'MAIN',
              func: () => {
                try {
                  window.canRunAds = true;
                  window.adsCanRun = true;
                  window.adsbygoogle = true;
                } catch (_) {}
              },
            });
          } catch (_) { /* tab may not support scripting */ }
        }
        return { success: true };
      }

      // --- Misc ---
      case 'GET_TABS':
        return new Promise((resolve) => {
          api.tabs.query({}, (tabs) => resolve({ success: true, tabs }));
        });
      case 'OPEN_OPTIONS':
        if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
        else api.tabs.create({ url: api.runtime.getURL('options/options.html') });
        return { success: true };

      default:
        return { success: false, error: 'Unknown message type: ' + message.type };
    }
  } catch (err) {
    console.error('[WebSuddhi] message handler error:', err);
    return { success: false, error: err.message };
  }
}

// ============================================
// ALARM HANDLER (FIX #3 — replaces setInterval)
// ============================================

/**
 * Use chrome.alarms for periodic tasks instead of setInterval,
 * which is unreliable in MV3 service workers.
 */
function setupAlarms() {
  // Rate-limit reset: every 1 second
  if (api.alarms) {
    api.alarms.create('websuddhi-rate-reset', { periodInMinutes: 1 / 60 });
    api.alarms.create('websuddhi-stats-flush', { periodInMinutes: 1 });
    api.alarms.create('websuddhi-log-flush', { periodInMinutes: 2 });

    api.alarms.onAlarm.addListener((alarm) => {
      // Icon blink alarms have dynamic names — check those first
      if (handleIconBlinkAlarm(alarm)) return;

      switch (alarm.name) {
        case 'websuddhi-rate-reset':
          resetRateLimits();
          break;
        case 'websuddhi-stats-flush':
          flushStats().catch(() => {});
          break;
        case 'websuddhi-log-flush':
          flushLogEntries().catch(() => {});
          break;
        default:
          // DNR poll alarm handled by network-blocker
          handleDNRPollAlarm(alarm);
          break;
      }
    });
  }
}

// ============================================
// INITIALIZATION
// ============================================

async function initialize() {
  try {
    // Ensure shared namespace
    if (!self.WebSuddhi) self.WebSuddhi = {};
    self.WebSuddhi.addLogEntry = addLogEntry;

    // Load initial settings
    await getStorage(Object.keys(DEFAULT_SETTINGS));

    // Init sub-modules
    await initStatsManager();
    await initNetworkBlocker(reportNetworkBlock);
    await initPrivacy();
    await initFilterLists();

    // Message listener
    api.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message, sender)
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // keep port open for async
    });

    // Tab lifecycle
    if (api.tabs?.onRemoved) {
      api.tabs.onRemoved.addListener((tabId) => {
        tabFrameMap.delete(tabId);
        stopIconBlink(tabId);
      });
    }
    if (api.tabs?.onUpdated) {
      api.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo?.status === 'loading') tabFrameMap.delete(tabId);
      });
    }

    // Context menu & shortcuts
    setupContextMenu();
    api.contextMenus.onClicked.addListener(handleContextMenuClick);
    setupCommandListener((hostname, tabId) =>
      toggleWhitelistForSite(hostname, tabId, refreshDynamicRules, { normal: ICON_PATHS_NORMAL, alert: ICON_PATHS_ALERT })
    );

    // Sync listener
    setupSyncListener();

    // Alarms (FIX #3)
    setupAlarms();

    // Clean up any orphaned icon-blink alarms from previous SW session (FIX #9)
    clearOrphanedBlinkAlarms();

    // Flush stats & logs before service worker terminates (FIX #5)
    if (api.runtime?.onSuspend) {
      api.runtime.onSuspend.addListener(() => {
        flushStats().catch(() => {});
        flushLogEntries().catch(() => {});
      });
    }

    console.log('[WebSuddhi] Background service worker initialized');
  } catch (err) {
    console.error('[WebSuddhi] Initialization error:', err);
  }
}

// Start
initialize();
