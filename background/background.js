// WebSuddhi - Background Service Worker
// Universal: Chrome, Edge, Firefox, Safari
// v2.2.0 - Full ad blocker with network blocking, stats, privacy, filter lists

// MV3: Import all modules via importScripts
try {
  if (typeof importScripts === 'function') {
    importScripts(
      '../shared/utils.js',
      '../shared/rule-model.js',
      'classifier.js',
      'list-loader.js',
      'network-blocker.js',
      'url-cleaner.js',
      'stats-manager.js',
      'privacy.js',
      'filter-lists.js',
      'phishing-detector.js',
      'frame-registry.js',
      'frame-blocker.js'
    );
  }
} catch (e) {
  console.error('WebSuddhi: importScripts error:', e);
}

(function() {
  'use strict';

  // Shared namespace
  if (!self.WebSuddhi) self.WebSuddhi = {};

  // Logging helpers (use utils if available, fallback to console)
  const log = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.log) {
      self.WebSuddhi.utils.log(...args);
    }
  };
  const warn = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.warn) {
      self.WebSuddhi.utils.warn(...args);
    }
  };
  const logError = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    } else {
      console.error('[WebSuddhi]', ...args);
    }
  };

  // Cross-browser API
  const hasPromiseExtensionApi = typeof browser !== 'undefined' && browser.runtime;
  const api = hasPromiseExtensionApi ? browser : chrome;

  // ============================================
  // STORAGE HELPERS (used throughout)
  // ============================================
  const STORAGE_KEYS = {
    enabled: 'enabled',
    whitelistedSites: 'whitelistedSites',
    blockedDomains: 'blockedDomains',
    allowedDomains: 'allowedDomains',
    blockedSelectors: 'blockedSelectors',
    stats: 'stats',
    filterSubscriptions: 'filterSubscriptions',
    requestLog: 'requestLog'
  };

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
      history: []
    },
    maxBlockedCount: 10000,
    maxLogEntries: 1000,
    maxWhitelistSize: 1000,
    maxBlockedDomains: 1000,
    maxBlockedSelectors: 1000
  };

  const MAX_LOG_ENTRIES = DEFAULT_SETTINGS.maxLogEntries || 1000;
  const RATE_LIMIT_EXEMPT_TYPES = new Set([
    'GET_ALL_SETTINGS',
    'GET_STATS',
    'GET_ENHANCED_STATS',
    'GET_PERIOD_STATS',
    'GET_STATS_FOR_PERIOD'
  ]);

  // Safe storage wrapper with defaults
  async function getStorage(keys) {
    const sharedGetStorage = self.WebSuddhi?.utils?.getStorage;
    if (sharedGetStorage) {
      return sharedGetStorage(keys);
    }

    return new Promise((resolve) => {
      api.storage.local.get(keys, (data) => {
        if (api.runtime.lastError) {
          logError('Storage get error:', api.runtime.lastError);
          resolve({});
        } else {
          resolve(data || {});
        }
      });
    });
  }

  async function setStorage(data) {
    const sharedSetStorage = self.WebSuddhi?.utils?.setStorage;
    if (sharedSetStorage) {
      return sharedSetStorage(data);
    }

    return new Promise((resolve) => {
      api.storage.local.set(data, () => {
        if (api.runtime.lastError) {
          logError('Storage set error:', api.runtime.lastError);
        }
        resolve();
      });
    });
  }

  function supportsSyncStorage() {
    return !!(
      api.storage &&
      api.storage.sync &&
      typeof api.storage.sync.get === 'function' &&
      typeof api.storage.sync.set === 'function'
    );
  }

  function supportsContextMenus() {
    return !!(
      api.contextMenus &&
      typeof api.contextMenus.removeAll === 'function' &&
      typeof api.contextMenus.create === 'function' &&
      api.contextMenus.onClicked &&
      typeof api.contextMenus.onClicked.addListener === 'function'
    );
  }

  async function getStorageArea(areaName, keys) {
    return new Promise((resolve, reject) => {
      const area = api.storage?.[areaName];
      if (!area || typeof area.get !== 'function') {
        resolve({});
        return;
      }

      try {
        if (hasPromiseExtensionApi) {
          area.get(keys).then((data) => resolve(data || {})).catch(reject);
        } else {
          area.get(keys, (data) => {
            if (api.runtime.lastError) reject(api.runtime.lastError);
            else resolve(data || {});
          });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  async function setStorageArea(areaName, data) {
    return new Promise((resolve, reject) => {
      const area = api.storage?.[areaName];
      if (!area || typeof area.set !== 'function') {
        resolve();
        return;
      }

      try {
        if (hasPromiseExtensionApi) {
          area.set(data).then(resolve).catch(reject);
        } else {
          area.set(data, () => {
            if (api.runtime.lastError) reject(api.runtime.lastError);
            else resolve();
          });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  async function getStorageWithDefaults(keys, defaults) {
    const storage = await getStorage(keys);
    const result = {};
    for (const key of keys) {
      const defaultValue = defaults[key];
      result[key] = storage[key] !== undefined ? storage[key] : defaultValue;
    }
    return result;
  }

  async function setStorageAndReturn(data) {
    await setStorage(data);
    await notifyAllTabs({ type: 'SETTINGS_CHANGED', changed: Object.keys(data || {}) });
    return data;
  }

  // ============================================
  // SAFE TAB MESSAGING - Avoids "No tab with id" errors
  // ============================================
  function safeSendToTab(tabId, message) {
    try {
      const result = api.tabs.sendMessage(tabId, message, () => {
        // Check lastError in callback to suppress "Unchecked runtime.lastError"
        if (api.runtime.lastError) { /* tab not available */ }
      });
      if (result && typeof result.then === 'function') {
        result.catch(() => {});
      }
    } catch (e) {
      // Synchronous error - tab doesn't exist
    }
  }

  // ============================================
  // ICON PATH HELPER - Use full URLs for MV3 service worker
  // ============================================
  function getIconPaths(isAlert = false) {
    const suffix = isAlert ? '-alert' : '';
    const runtime = (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : chrome.runtime;
    // In MV3 service workers, we need runtime.getURL for reliable icon loading
    if (runtime && runtime.getURL) {
      return {
        16: runtime.getURL(`icons/icon16${suffix}.png`),
        32: runtime.getURL(`icons/icon32${suffix}.png`),
        48: runtime.getURL(`icons/icon48${suffix}.png`),
        128: runtime.getURL(`icons/icon128${suffix}.png`)
      };
    }
    // Fallback to relative paths
    return {
      16: `icons/icon16${suffix}.png`,
      32: `icons/icon32${suffix}.png`,
      48: `icons/icon48${suffix}.png`,
      128: `icons/icon128${suffix}.png`
    };
  }

  // Cached icon paths to avoid repeated getURL calls
  const ICON_PATHS_NORMAL = getIconPaths(false);
  const ICON_PATHS_ALERT = getIconPaths(true);
  const tabFrameMap = new Map(); // tabId -> Map<host, { host, url, blocked, lastSeen }>

  // ============================================
  // RATE LIMITING - Protect against DOS attacks
  // ============================================
  const rateLimits = {
    perTab: new Map(), // tabId -> count
    global: 0,
    lastReset: Date.now()
  };
  const RATE_LIMIT_PER_TAB = 10;
  const RATE_LIMIT_GLOBAL = 100;
  const RATE_LIMIT_WINDOW = 1000; // 1 second

  // Reset rate limit counts every second
  setInterval(() => {
    rateLimits.perTab.clear();
    rateLimits.global = 0;
    rateLimits.lastReset = Date.now();
  }, RATE_LIMIT_WINDOW);

  /**
   * Check if a message should be rate limited
   * @param {number|undefined} tabId - The tab ID sending the message
   * @returns {boolean} - true if rate limited, false if allowed
   */
  function isRateLimited(tabId) {
    // Check global rate limit
    if (rateLimits.global >= RATE_LIMIT_GLOBAL) {
      log('Global rate limit exceeded');
      return true;
    }

    // Check per-tab rate limit
    if (tabId !== undefined) {
      const tabCount = rateLimits.perTab.get(tabId) || 0;
      if (tabCount >= RATE_LIMIT_PER_TAB) {
        log('Per-tab rate limit exceeded for tab:', tabId);
        return true;
      }

      // Increment counters
      rateLimits.perTab.set(tabId, tabCount + 1);
      rateLimits.global++;
    }

    return false;
  }

  // ============================================
  // NETWORK STATS & BLOCKED COUNTS
  // ============================================
  // Note: These are now primarily handled by network-blocker.js
  // This function is kept for backwards compatibility

  const tabBlockedCounts = new Map();

  function getNetworkBlockedCount(tabId) {
    return tabBlockedCounts.get(tabId) || 0;
  }

  // ============================================
  // ICON BLINKING - Visual alert for phishing sites
  // ============================================
  const iconBlinkIntervals = new Map();

  function startIconBlink(tabId) {
    // Stop any existing blink
    stopIconBlink(tabId);

    let on = false;
    const interval = setInterval(() => {
      try {
        if (api.action) {
          api.action.setIcon({
            tabId: tabId,
            path: on ? ICON_PATHS_ALERT : ICON_PATHS_NORMAL
          });
        } else if (api.browserAction) {
          api.browserAction.setIcon({
            tabId: tabId,
            path: on ? ICON_PATHS_ALERT : ICON_PATHS_NORMAL
          });
        }
        on = !on;
      } catch (e) {
        // Tab might be closed
        stopIconBlink(tabId);
      }
    }, 500);

    iconBlinkIntervals.set(tabId, interval);

    // Auto-stop after 30 seconds
    setTimeout(() => stopIconBlink(tabId), 30000);
  }

  function stopIconBlink(tabId) {
    const interval = iconBlinkIntervals.get(tabId);
    if (interval) {
      clearInterval(interval);
      iconBlinkIntervals.delete(tabId);

      // Reset to normal icon
      try {
        if (api.action) {
          api.action.setIcon({ tabId: tabId, path: ICON_PATHS_NORMAL });
        } else if (api.browserAction) {
          api.browserAction.setIcon({ tabId: tabId, path: ICON_PATHS_NORMAL });
        }
      } catch (e) {
        // Tab might be closed
      }
    }
  }

  // ============================================
  // REQUEST LOG - Track blocked requests for display
  // ============================================
  async function getRequestLog() {
    const storage = await getStorage(['requestLog']);
    return storage.requestLog || [];
  }

  async function clearRequestLog() {
    await setStorage({ requestLog: [] });
    return { success: true, message: 'Request log cleared' };
  }

  async function addLogEntry(entry) {
    if (!entry) return { success: false, error: 'No entry provided' };

    try {
      const storage = await getStorage(['requestLog', 'loggingEnabled']);
      if (storage.loggingEnabled === false) {
        return { success: true, skipped: true };
      }

      const log = storage.requestLog || [];

      // Add timestamp if not present
      if (!entry.timestamp) {
        entry.timestamp = Date.now();
      }

      // Add tracker category information for network blocks
      if (entry.type === 'network' && entry.url) {
        const utils = self.WebSuddhi.utils;
        if (utils && utils.getTrackerInfo) {
          const domain = utils.extractDomain ? utils.extractDomain(entry.url) : entry.url;
          const trackerInfo = utils.getTrackerInfo(domain);
          if (trackerInfo) {
            entry.category = trackerInfo.category;
            entry.severity = trackerInfo.severity;
            entry.trackerDesc = trackerInfo.desc;
          }
        }
      }

      // Add entry at the end
      log.push(entry);

      // Trim to MAX_LOG_ENTRIES
      while (log.length > MAX_LOG_ENTRIES) {
        log.shift();
      }

      await setStorage({ requestLog: log });
      return { success: true };
    } catch (err) {
      logError('Error adding log entry:', err);
      return { success: false, error: err.message };
    }
  }

  self.WebSuddhi.addLogEntry = addLogEntry;

  // ============================================
  // PERFORMANCE STATS - Track blocking performance
  // ============================================
  async function updatePerformanceStats(count = 1) {
    try {
      const storage = await getStorage(['performanceStats']);
      let stats = storage.performanceStats;

      // Initialize if needed
      if (!stats || typeof stats !== 'object') {
        stats = { ...DEFAULT_SETTINGS.performanceStats };
      }

      // Update total blocked
      stats.totalBlocked = (stats.totalBlocked || 0) + count;

      // Update today's stats
      const today = new Date().toDateString();
      if (!stats.today || stats.today.date !== today) {
        stats.today = {
          date: today,
          blocked: count,
          topDomains: {},
          perSite: {}
        };
      } else {
        stats.today.blocked = (stats.today.blocked || 0) + count;
      }

      await setStorage({ performanceStats: stats });
    } catch (err) {
      logError('Failed to update performance stats:', err);
    }
  }

  async function getPerformanceStats() {
    try {
      const result = await new Promise((resolve, reject) => {
        api.storage.local.get(['performanceStats'], (data) => {
          if (api.runtime.lastError) reject(api.runtime.lastError);
          else resolve(data);
        });
      });
      return {
        success: true,
        performanceStats: result.performanceStats || DEFAULT_SETTINGS.performanceStats
      };
    } catch (err) {
      return {
        success: true,
        performanceStats: DEFAULT_SETTINGS.performanceStats
      };
    }
  }

  // ============================================
  // CONTEXT MENU
  // ============================================
  function setupContextMenu() {
    if (!supportsContextMenus()) return;

    // Remove existing menu items first to avoid duplicates
    api.contextMenus.removeAll(() => {
      api.contextMenus.create({
        id: 'websuddhi-block',
        title: 'Block this element',
        contexts: ['all']
      });
    });
  }

  function handleContextMenuClick(info, tab) {
    if (info.menuItemId === 'websuddhi-block') {
      // Send message to content script to enter pick mode
      if (tab && tab.id) {
        safeSendToTab(tab.id, { type: 'START_PICK_MODE' });
      }
    }
  }

  // ============================================
  // KEYBOARD SHORTCUTS (Commands)
  // ============================================
  function setupCommandListener() {
    if (api.commands && api.commands.onCommand) {
      api.commands.onCommand.addListener((command) => {
        if (command === 'toggle-pick-mode') {
          // Toggle pick mode on active tab
          api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              safeSendToTab(tabs[0].id, { type: 'TOGGLE_PICK_MODE' });
            }
          });
        } else if (command === 'toggle-whitelist') {
          // Toggle whitelist on active tab
          api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id && tabs[0]?.url) {
              const hostname = new URL(tabs[0].url).hostname;
              toggleWhitelistForSite(hostname, tabs[0].id);
            }
          });
        } else if (command === 'open-settings') {
          // Open options page
          openOptionsPage();
        }
      });
    }
  }

  function normalizeHostname(value, stripWww = false) {
    if (!value || typeof value !== 'string') return null;

    let host = value.trim().toLowerCase();
    if (!host) return null;

    try {
      const parsed = new URL(host.includes('://') ? host : ('https://' + host));
      host = parsed.hostname.toLowerCase();
    } catch (e) {
      host = host.split('/')[0].split('?')[0].split('#')[0];
      host = host.split(':')[0];
    }

    host = host.replace(/^\.+/, '').replace(/\.+$/, '');
    if (stripWww) host = host.replace(/^www\./, '');
    if (!host || host.includes(' ')) return null;

    return host;
  }

  function normalizeDomainList(domains, stripWww = false, maxItems = Infinity) {
    const normalized = [];
    const seen = new Set();

    for (const domain of domains || []) {
      const host = normalizeHostname(domain, stripWww);
      if (!host || seen.has(host)) continue;
      seen.add(host);
      normalized.push(host);
      if (normalized.length >= maxItems) break;
    }

    return normalized;
  }

  function domainMatches(host, candidate) {
    return host === candidate || host.endsWith('.' + candidate);
  }

  function normalizeSelectorEntry(entry) {
    let selector = '';
    let hostname = 'imported';
    let date = Date.now();

    if (typeof entry === 'string') {
      selector = entry.trim();
    } else if (entry && typeof entry.selector === 'string') {
      selector = entry.selector.trim();
      if (typeof entry.hostname === 'string' && entry.hostname.trim()) {
        hostname = entry.hostname.trim();
      }
      if (Number.isFinite(entry.date)) {
        date = entry.date;
      }
    }

    if (!selector) return null;
    if (typeof self.WebSuddhi.utils?.isValidCSSSelector === 'function' &&
        !self.WebSuddhi.utils.isValidCSSSelector(selector)) {
      return null;
    }

    return { selector, hostname, date };
  }

  function mergeSelectorEntries(existing, incoming, maxItems) {
    const merged = [];
    const seen = new Set();

    function addEntry(entry) {
      const normalized = normalizeSelectorEntry(entry);
      if (!normalized || seen.has(normalized.selector)) return;
      seen.add(normalized.selector);
      merged.push(normalized);
    }

    for (const entry of (existing || [])) addEntry(entry);
    for (const entry of (incoming || [])) addEntry(entry);

    return merged.slice(0, maxItems);
  }

  function setTabFrameEntry(tabId, host, url, blocked) {
    if (typeof tabId !== 'number' || tabId < 0 || !host) return;

    let tabFrames = tabFrameMap.get(tabId);
    if (!tabFrames) {
      tabFrames = new Map();
      tabFrameMap.set(tabId, tabFrames);
    }

    const prev = tabFrames.get(host) || {};
    tabFrames.set(host, {
      host,
      url: url || prev.url || host,
      blocked: typeof blocked === 'boolean' ? blocked : Boolean(prev.blocked),
      lastSeen: Date.now()
    });
  }

  async function refreshNetworkRules() {
    const refreshFn = self.WebSuddhi.networkBlocker?.refreshDynamicRules ||
      self.WebSuddhi.networkBlocker?.rebuildDynamicRules;

    if (typeof refreshFn !== 'function') {
      return { success: false, error: 'Network rule refresh not available' };
    }

    try {
      await refreshFn();
      return { success: true };
    } catch (err) {
      logError('Failed to refresh network rules:', err);
      return { success: false, error: err.message };
    }
  }

  async function addAllowedDomain(domain) {
    const normalized = normalizeHostname(domain);
    if (!normalized) return { success: false, error: 'Invalid domain' };

    const maxDomains = DEFAULT_SETTINGS.maxBlockedDomains || 1000;
    const storage = await getStorage(['allowedDomains']);
    const allowedDomains = normalizeDomainList(storage.allowedDomains || [], false, maxDomains);

    if (!allowedDomains.includes(normalized)) {
      if (allowedDomains.length >= maxDomains) {
        return { success: false, error: 'Allowed domains limit reached' };
      }
      allowedDomains.push(normalized);
      await setStorage({ allowedDomains });
    }

    return { success: true, domain: normalized };
  }

  async function unblockRequestDomain(urlOrDomain) {
    const domain = normalizeHostname(urlOrDomain);
    if (!domain) return { success: false, error: 'Invalid URL or domain' };

    const targetNoWww = normalizeHostname(domain, true);
    const maxDomains = DEFAULT_SETTINGS.maxBlockedDomains || 1000;
    const storage = await getStorage(['blockedDomains', 'allowedDomains']);
    const blockedDomains = normalizeDomainList(storage.blockedDomains || [], false, maxDomains);
    const allowedDomains = normalizeDomainList(storage.allowedDomains || [], false, maxDomains);

    const updatedBlocked = blockedDomains.filter((entry) => {
      return entry !== domain && normalizeHostname(entry, true) !== targetNoWww;
    });

    const alreadyAllowed = allowedDomains.some((entry) => {
      return entry === domain || normalizeHostname(entry, true) === targetNoWww;
    });

    if (!alreadyAllowed) {
      if (allowedDomains.length >= maxDomains) {
        return { success: false, error: 'Allowed domains limit reached' };
      }
      allowedDomains.push(domain);
    }

    await setStorage({
      blockedDomains: updatedBlocked,
      allowedDomains
    });
    await refreshNetworkRules();

    return { success: true, domain };
  }

  async function reportFrame(message, sender) {
    const tabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
    if (typeof tabId !== 'number' || tabId < 0) {
      return { success: false, error: 'No tab ID for frame report' };
    }

    const host = normalizeHostname(message.frameHost || message.frameUrl);
    if (!host) {
      return { success: false, error: 'Invalid frame host' };
    }

    setTabFrameEntry(tabId, host, message.frameUrl || message.frameHost || host, message.blocked);
    return { success: true };
  }

  async function allowFrame(message, sender) {
    const tabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
    const host = normalizeHostname(message.frameHost || message.frameUrl);

    if (!host) {
      return { success: false, error: 'Invalid frame host' };
    }

    setTabFrameEntry(tabId, host, message.frameUrl || message.frameHost || host, false);

    const allowResult = await addAllowedDomain(host);
    if (!allowResult.success) return allowResult;

    await refreshNetworkRules();
    return { success: true, domain: host };
  }

  async function getSecurityInfo(tabId) {
    if (typeof tabId !== 'number' || tabId < 0) {
      return { success: false, connection: null, phishing: null, thirdPartyDomains: [], blockedFrames: [] };
    }

    const storage = await getStorage(['allowedDomains']);
    const allowedDomains = normalizeDomainList(storage.allowedDomains || []);
    const tabFrames = tabFrameMap.get(tabId);
    const thirdPartyDomains = [];
    const blockedFrames = [];
    const connection = {
      tabId,
      protocol: 'unknown',
      isSecure: false,
      isLocal: false,
      isFile: false,
      host: '',
      normalizedHost: ''
    };

    // Resolve tab and connection details first so detection can run on a real host.
    try {
      const tab = await new Promise((resolve) => {
        api.tabs.get(tabId, (tabInfo) => {
          if (api.runtime.lastError) resolve(null);
          else resolve(tabInfo || null);
        });
      });
      if (tab?.url) {
        try {
          const parsedUrl = new URL(tab.url);
          connection.protocol = parsedUrl.protocol;
          connection.host = parsedUrl.hostname || '';
          connection.normalizedHost = normalizeHostname(parsedUrl.hostname || '', false) || '';
          if (!connection.normalizedHost && connection.protocol === 'file:') {
            connection.normalizedHost = 'localhost';
          }
          connection.isSecure = parsedUrl.protocol === 'https:';
          connection.isLocal = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
          connection.isFile = parsedUrl.protocol === 'file:';
        } catch (e) {
          if (tab.url.startsWith('file://')) {
            connection.isFile = true;
            connection.protocol = 'file:';
            connection.host = 'file://';
          }
        }
      }
    } catch (e) {}

    if (tabFrames) {
      for (const frame of tabFrames.values()) {
        const entry = { host: frame.host, url: frame.url || frame.host };
        const isAllowed = allowedDomains.some((domain) => domainMatches(frame.host, domain));

        if (isAllowed || frame.blocked !== true) {
          thirdPartyDomains.push(entry);
        } else {
          blockedFrames.push(entry);
        }
      }
    }

    thirdPartyDomains.sort((a, b) => a.host.localeCompare(b.host));
    blockedFrames.sort((a, b) => a.host.localeCompare(b.host));

    if (!connection.normalizedHost) {
      const defaultSecurity = {
        isSuspicious: false,
        reason: 'Could not determine host',
        protectionEnabled: false
      };

      return {
        success: true,
        connection,
        phishing: defaultSecurity,
        thirdPartyDomains,
        blockedFrames
      };
    }

    let phishingCheck = null;
    try {
      const phishingSettings = await getStorage(['phishingProtectionEnabled']);
      if (phishingSettings.phishingProtectionEnabled === false) {
        phishingCheck = {
          isSuspicious: false,
          reason: 'Phishing protection disabled',
          protectionEnabled: false
        };
      } else if (connection.isFile || connection.isLocal) {
        phishingCheck = {
          isSuspicious: false,
          reason: 'Local destination not evaluated',
          protectionEnabled: true
        };
      } else if (self.WebSuddhi.phishingDetector) {
        phishingCheck = self.WebSuddhi.phishingDetector.checkDomain(connection.normalizedHost);
        if (phishingCheck && typeof phishingCheck === 'object') {
          phishingCheck.protectionEnabled = true;
        }
      } else {
        phishingCheck = {
          isSuspicious: false,
          reason: 'Phishing detector not available',
          protectionEnabled: false
        };
      }
    } catch (e) {
      phishingCheck = {
        isSuspicious: false,
        reason: 'Could not evaluate phishing risk',
        evaluationError: true
      };
    }

    return {
      success: true,
      connection,
      phishing: phishingCheck,
      thirdPartyDomains,
      blockedFrames
    };
  }

  async function exportRules() {
    const storage = await getStorage([
      'blockedSelectors',
      'blockedDomains',
      'allowedDomains',
      'whitelistedSites',
      'enabled',
      'paywallEnabled',
      'socialBlockingEnabled'
    ]);

    return {
      success: true,
      data: {
        version: '2.2.0',
        exportDate: new Date().toISOString(),
        blockedSelectors: storage.blockedSelectors || [],
        blockedDomains: storage.blockedDomains || [],
        allowedDomains: storage.allowedDomains || [],
        whitelistedSites: storage.whitelistedSites || [],
        enabled: storage.enabled !== false,
        paywallEnabled: storage.paywallEnabled !== false,
        socialBlockingEnabled: storage.socialBlockingEnabled === true
      }
    };
  }

  async function importRules(data) {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid import data' };
    }

    const hasSupportedPayload = [
      'blockedSelectors',
      'blockedDomains',
      'allowedDomains',
      'whitelistedSites'
    ].some((key) => Array.isArray(data[key]));

    if (!hasSupportedPayload) {
      return { success: false, error: 'Invalid import format' };
    }

    const maxSelectors = DEFAULT_SETTINGS.maxBlockedSelectors || 1000;
    const maxDomains = DEFAULT_SETTINGS.maxBlockedDomains || 1000;
    const maxWhitelist = DEFAULT_SETTINGS.maxWhitelistSize || 1000;
    const storage = await getStorage([
      'blockedSelectors',
      'blockedDomains',
      'allowedDomains',
      'whitelistedSites',
      'enabled',
      'paywallEnabled'
    ]);

    const blockedSelectors = Array.isArray(data.blockedSelectors)
      ? mergeSelectorEntries(storage.blockedSelectors || [], data.blockedSelectors, maxSelectors)
      : (storage.blockedSelectors || []);

    const blockedDomains = Array.isArray(data.blockedDomains)
      ? normalizeDomainList([...(storage.blockedDomains || []), ...data.blockedDomains], false, maxDomains)
      : normalizeDomainList(storage.blockedDomains || [], false, maxDomains);

    const allowedDomains = Array.isArray(data.allowedDomains)
      ? normalizeDomainList([...(storage.allowedDomains || []), ...data.allowedDomains], false, maxDomains)
      : normalizeDomainList(storage.allowedDomains || [], false, maxDomains);

    const whitelistedSites = Array.isArray(data.whitelistedSites)
      ? normalizeDomainList([...(storage.whitelistedSites || []), ...data.whitelistedSites], true, maxWhitelist)
      : normalizeDomainList(storage.whitelistedSites || [], true, maxWhitelist);

    const updateData = {
      blockedSelectors,
      blockedDomains,
      allowedDomains,
      whitelistedSites
    };

    if (typeof data.enabled === 'boolean') updateData.enabled = data.enabled;
    if (typeof data.paywallEnabled === 'boolean') updateData.paywallEnabled = data.paywallEnabled;
    if (typeof data.socialBlockingEnabled === 'boolean') updateData.socialBlockingEnabled = data.socialBlockingEnabled;

    await setStorage(updateData);

    if (Array.isArray(data.blockedDomains) || Array.isArray(data.allowedDomains) || Array.isArray(data.whitelistedSites)) {
      await refreshNetworkRules();
    }

    await notifyAllTabs();

    return {
      success: true,
      totalRules: blockedSelectors.length,
      imported: {
        blockedDomains: blockedDomains.length,
        allowedDomains: allowedDomains.length,
        whitelistedSites: whitelistedSites.length
      }
    };
  }

  // ============================================
  // WHITELIST MANAGEMENT
  // ============================================
  async function whitelistSite(hostnameOrUrl) {
    if (!hostnameOrUrl) return { success: false, error: 'No hostname provided' };

    const hostname = normalizeHostname(hostnameOrUrl, true);
    if (!hostname) return { success: false, error: 'Invalid hostname' };

    const storage = await getStorage(['whitelistedSites']);
    const whitelisted = storage.whitelistedSites || [];

    // Normalize existing entries too
    const normalizedWhitelisted = normalizeDomainList(
      whitelisted,
      true,
      DEFAULT_SETTINGS.maxWhitelistSize || 1000
    );

    if (!normalizedWhitelisted.includes(hostname)) {
      normalizedWhitelisted.push(hostname);
      await setStorage({ whitelistedSites: normalizedWhitelisted });
    }

    const refreshResult = await refreshNetworkRules();
    if (!refreshResult.success) warn('Whitelist update saved, but network rules were not refreshed');

    return { success: true, message: 'Whitelisted ' + hostname };
  }

  async function unwhitelistSite(hostname) {
    if (!hostname) return { success: false, error: 'No hostname provided' };

    // Normalize: remove www. prefix for consistent comparison
    const normalizedHostname = normalizeHostname(hostname, true);
    if (!normalizedHostname) return { success: false, error: 'Invalid hostname' };

    const storage = await getStorage(['whitelistedSites']);
    const whitelisted = storage.whitelistedSites || [];

    // Normalize and filter
    const normalizedWhitelisted = normalizeDomainList(
      whitelisted,
      true,
      DEFAULT_SETTINGS.maxWhitelistSize || 1000
    ).filter(s => s !== normalizedHostname);

    await setStorage({ whitelistedSites: normalizedWhitelisted });
    const refreshResult = await refreshNetworkRules();
    if (!refreshResult.success) warn('Whitelist update saved, but network rules were not refreshed');

    return { success: true, message: 'Unwhitelisted ' + normalizedHostname };
  }

  async function toggleWhitelistForSite(hostname, tabId) {
    try {
      const normalizedHostname = normalizeHostname(hostname, true);
      if (!normalizedHostname) {
        return { success: false, error: 'Invalid hostname' };
      }
      const storage = await getStorage(['whitelistedSites']);
      const whitelisted = normalizeDomainList(storage.whitelistedSites || [], true);

      const isWhitelisted = whitelisted.includes(normalizedHostname);

      if (isWhitelisted) {
        await unwhitelistSite(normalizedHostname);
      } else {
        await whitelistSite(normalizedHostname);
      }

      // Notify all tabs of whitelist change
      await notifyAllTabs();

      // Update badge for specific tab
      if (tabId) {
        try {
          const newStorage = await getStorage(['whitelistedSites']);
          const newWhitelisted = normalizeDomainList(newStorage.whitelistedSites || [], true);
          const nowWhitelisted = newWhitelisted.includes(normalizedHostname);
          const iconPath = nowWhitelisted ? ICON_PATHS_ALERT : ICON_PATHS_NORMAL;

          if (api.action) {
            api.action.setIcon({ tabId, path: iconPath });
          } else if (api.browserAction) {
            api.browserAction.setIcon({ tabId, path: iconPath });
          }
        } catch (e) {}
      }

      return { success: true, whitelisted: !isWhitelisted };
    } catch (err) {
      logError('Error toggling whitelist:', err);
      return { success: false, error: err.message };
    }
  }

  async function isSiteWhitelisted(hostname) {
    try {
      const normalizedHostname = normalizeHostname(hostname, true);
      if (!normalizedHostname) return false;
      const storage = await getStorage(['whitelistedSites']);
      const whitelisted = normalizeDomainList(storage.whitelistedSites || [], true);
      return whitelisted.includes(normalizedHostname);
    } catch (err) {
      return false;
    }
  }

  // ============================================
  // NOTIFY ALL TABS
  // ============================================
  async function notifyAllTabs(message = { type: 'SETTINGS_CHANGED' }) {
    try {
      const tabs = await new Promise((resolve) => {
        api.tabs.query({}, (tabs) => resolve(tabs));
      });

      for (const tab of tabs) {
        if (tab?.id) {
          safeSendToTab(tab.id, message);
        }
      }
    } catch (err) {
      logError('Error notifying tabs:', err);
    }
  }

  // ============================================
  // SEND MESSAGE TO ALL CONTENT SCRIPTS
  // ============================================
  async function sendMessageToAllTabs(message) {
    try {
      const tabs = await new Promise((resolve) => {
        api.tabs.query({}, (tabs) => resolve(tabs));
      });

      for (const tab of tabs) {
        if (tab?.id) {
          safeSendToTab(tab.id, message);
        }
      }
    } catch (err) {
      logError('Error sending message to tabs:', err);
    }
  }

  // ============================================
  // OPTIONS PAGE & SYNC
  // ============================================
  function openOptionsPage(anchor) {
    const url = api.runtime.getURL('options/options.html');
    const targetUrl = anchor ? (url + '#' + anchor) : url;

    if (anchor && api.tabs && api.tabs.create) {
      api.tabs.create({ url: targetUrl });
      return;
    }

    if (api.runtime.openOptionsPage) {
      api.runtime.openOptionsPage();
      return;
    }

    if (api.tabs && api.tabs.create) {
      api.tabs.create({ url: targetUrl });
    }
  }

  // ============================================
  // TOGGLE FUNCTIONS - Enable/disable features
  // ============================================
  async function toggleEnabled(enabled) {
    await setStorage({ enabled });
    await notifyAllTabs();

    // Update badge
    try {
      if (api.action) {
        api.action.setIcon({ path: enabled ? ICON_PATHS_NORMAL : ICON_PATHS_ALERT });
      } else if (api.browserAction) {
        api.browserAction.setIcon({ path: enabled ? ICON_PATHS_NORMAL : ICON_PATHS_ALERT });
      }
    } catch (e) {}

    return { success: true, enabled };
  }

  async function togglePaywall(enabled) {
    return await setStorageAndReturn({ paywallEnabled: enabled });
  }

  async function toggleSocialBlocking(enabled) {
    return await setStorageAndReturn({ socialBlockingEnabled: enabled });
  }

  // ============================================
  // STATS MANAGEMENT
  // ============================================
  async function getStats(days = 1) {
    if (self.WebSuddhi.statsManager) {
      return { success: true, stats: self.WebSuddhi.statsManager.getStats() };
    }

    // Fallback
    const storage = await getStorage(['stats']);
    return { success: true, stats: storage.stats || { totalBlocked: 0, perSite: {} } };
  }

  async function getStatsForPeriod(days = 1) {
    if (self.WebSuddhi.statsManager) {
      return { success: true, stats: self.WebSuddhi.statsManager.getStatsForPeriod(days) };
    }

    // Fallback
    return getStats(days);
  }

  async function resetStats() {
    const defaultStats = { totalBlocked: 0, perSite: {} };
    await setStorage({ stats: defaultStats });
    return { success: true, message: 'Stats reset' };
  }

  async function incrementStats(hostname, count) {
    // Use statsManager if available (Phase 5 enhanced stats)
    // This function is kept for backwards compatibility
    if (self.WebSuddhi.statsManager) {
      // statsManager handles its own storage
      return { success: true };
    }

    // Fallback to simple stats (legacy)
    const storage = await getStorage(['stats']);
    const stats = storage.stats || { totalBlocked: 0, perSite: {} };
    // Ensure perSite exists (might be missing from old storage or new format)
    if (!stats.perSite) stats.perSite = {};
    if (typeof stats.totalBlocked !== 'number') stats.totalBlocked = 0;

    stats.totalBlocked += (count || 1);
    if (hostname) {
      stats.perSite[hostname] = (stats.perSite[hostname] || 0) + (count || 1);
    }
    await setStorage({ stats });
    // Also update performance stats
    await updatePerformanceStats(count || 1);
    return { success: true };
  }

  // ============================================
  // SELECTOR MANAGEMENT
  // ============================================
  async function addSelector(tabId, selector) {
    if (!tabId || !selector) return { success: false, error: 'Missing tabId or selector' };

    // Validate selector before adding
    if (typeof self.WebSuddhi.utils?.isValidCSSSelector === 'function' && !self.WebSuddhi.utils.isValidCSSSelector(selector)) {
      return { success: false, error: 'Invalid CSS selector' };
    }

    const storage = await getStorage(['blockedSelectors', 'tabs']);
    const selectors = storage.blockedSelectors || [];
    const tabs = storage.tabs || {};

    // Check for duplicates
    if (selectors.some(s => s.selector === selector)) {
      return { success: false, error: 'Selector already blocked' };
    }

    // Get tab URL for this selector
    let tab;
    if (tabs[tabId]) {
      tab = tabs[tabId];
    } else {
      try {
        tab = await new Promise((resolve) => {
          api.tabs.get(tabId, (t) => resolve(t));
        });
      } catch (e) {}
    }

    const newEntry = {
      selector,
      hostname: tab?.url ? new URL(tab.url).hostname : 'unknown',
      date: Date.now()
    };

    selectors.push(newEntry);
    await setStorage({ blockedSelectors: selectors });
    await notifyAllTabs();

    return { success: true, message: 'Selector added' };
  }

  async function removeSelector(selector) {
    const storage = await getStorage(['blockedSelectors']);
    const selectors = storage.blockedSelectors || [];
    const filtered = selectors.filter(s => s.selector !== selector);

    await setStorage({ blockedSelectors: filtered });
    await notifyAllTabs();

    return { success: true, message: 'Selector removed' };
  }

  async function getAllSelectors() {
    const storage = await getStorage(['blockedSelectors']);
    return {
      success: true,
      selectors: storage.blockedSelectors || []
    };
  }

  // Recompute the per-tab frame census (honouring site + per-frame rules) and
  // apply the resulting decisions (tear down blocked frames).
  async function recomputeTab(tabId) {
    const reg = self.WebSuddhi.frameRegistry;
    const ruleModel = self.WebSuddhi.ruleModel;
    const loader = self.WebSuddhi.listLoader;
    const blocker = self.WebSuddhi.frameBlocker;
    if (!reg || !ruleModel || !loader) return;
    let hostname = '';
    try {
      const tab = await api.tabs.get(tabId);
      hostname = normalizeHostname(new URL(tab.url).hostname, true);
    } catch (e) { /* tab gone or non-http */ }
    const settings = await getStorage(['aggressiveness']);

    // Merge persisted + session frame rules for this top-site (session wins).
    const frameRules = {};
    if (hostname) {
      const persisted = await ruleModel.getFrameRulesForSite(hostname);
      const session = ruleModel.getSessionFrameRulesForSite(hostname);
      for (const d of Object.keys(persisted)) frameRules[d] = { persistentRule: persisted[d] };
      for (const d of Object.keys(session)) frameRules[d] = Object.assign(frameRules[d] || {}, { sessionRule: session[d] });
    }

    const ctx = {
      lists: await loader.loadLists(),
      budget: { bytes: 500 * 1024, ms: 150 },
      siteState: hostname ? await ruleModel.getSiteState(hostname) : 'default',
      aggressiveness: settings.aggressiveness || 'balanced',
      frameRules
    };
    reg.recompute(tabId, ctx);
    if (blocker) blocker.applyTab(api, tabId, reg.getCensus(tabId));
  }

  // ============================================
  // MESSAGE HANDLER
  // ============================================
  async function handleMessage(message, sender, sendResponse) {
    // Handle rate limiting
    if (!RATE_LIMIT_EXEMPT_TYPES.has(message.type)) {
      if (isRateLimited(sender.tab?.id)) {
        return { success: false, error: 'Rate limited' };
      }
    }

    try {
      switch (message.type) {
        // Stats
        case 'GET_STATS':
        case 'GET_ENHANCED_STATS':
          return await getStats(message.days);

        case 'GET_PERIOD_STATS':
        case 'GET_STATS_FOR_PERIOD':
          return await getStatsForPeriod(message.days || 1);

        case 'INCREMENT_COSMETIC_STATS':
        case 'INCREMENT_STATS':
          if (self.WebSuddhi.statsManager) {
            self.WebSuddhi.statsManager.reportCosmeticBlock(message.hostname, message.count, message.selector);
          }
          return await incrementStats(message.hostname, message.count);

        case 'RESET_STATS':
          return await resetStats();

        // Selectors
        case 'ADD_SELECTOR':
          return await addSelector(sender.tab?.id, message.selector);

        case 'REMOVE_SELECTOR':
          return await removeSelector(message.selector);

        case 'GET_SELECTORS':
          return await getAllSelectors();

        // Network blocking
        case 'ADD_DOMAIN_BLOCK':
          if (self.WebSuddhi.networkBlocker) {
            return await self.WebSuddhi.networkBlocker.addDomainBlock(message.domain);
          }
          return { success: false, error: 'Network blocker not available' };

        case 'REMOVE_DOMAIN_BLOCK':
          if (self.WebSuddhi.networkBlocker) {
            return await self.WebSuddhi.networkBlocker.removeDomainBlock(message.domain);
          }
          return { success: false, error: 'Network blocker not available' };

        case 'GET_BLOCKED_COUNT':
          if (self.WebSuddhi.networkBlocker) {
            return { success: true, count: self.WebSuddhi.networkBlocker.getNetworkBlockedCount(message.tabId) };
          }
          return { success: true, count: getNetworkBlockedCount(message.tabId) };

        // Frame engine (Plan 2)
        case 'FRAME_ANNOUNCE':
          if (self.WebSuddhi.frameRegistry && sender.tab) {
            self.WebSuddhi.frameRegistry.registerFrame(
              sender.tab.id, sender.frameId, sender.frameId === 0 ? -1 : 0, message.frameInfo || {}
            );
            await recomputeTab(sender.tab.id);
          }
          return { success: true };

        case 'FRAME_METRICS':
          if (self.WebSuddhi.frameRegistry && sender.tab) {
            self.WebSuddhi.frameRegistry.updateMetrics(sender.tab.id, sender.frameId, message);
            await recomputeTab(sender.tab.id);
          }
          return { success: true };

        case 'FRAME_CHILDREN':
          return { success: true }; // recorded opportunistically; full sandbox-fallback in a later plan

        case 'REPORT_COSMETIC':
          if (self.WebSuddhi.frameRegistry && sender.tab) {
            self.WebSuddhi.frameRegistry.addCosmeticCount(sender.tab.id, message.count || 0);
          }
          return { success: true };

        case 'GET_TAB_CENSUS':
          if (self.WebSuddhi.frameRegistry) {
            return { success: true, census: self.WebSuddhi.frameRegistry.getCensus(message.tabId) };
          }
          return { success: true, census: { frames: [], counts: { frames: 0, heavy: 0, blocked: 0, flagged: 0, cosmetic: 0 } } };

        case 'SET_FRAME_RULE': {
          const reg = self.WebSuddhi.frameRegistry;
          const ruleModel = self.WebSuddhi.ruleModel;
          const blocker = self.WebSuddhi.frameBlocker;
          if (!reg || !ruleModel) return { success: false, error: 'Frame engine unavailable' };
          const tabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
          let site = '';
          try {
            const tab = await api.tabs.get(tabId);
            site = normalizeHostname(new URL(tab.url).hostname, true);
          } catch (e) { return { success: false, error: 'No tab URL' }; }
          if (!site || !message.frameDomain) return { success: false, error: 'Missing site or frameDomain' };

          await ruleModel.setFrameRule(site, message.frameDomain, message.rule || null, { persist: message.persist !== false });
          // Persisted block also gets a network rule so it does not reload.
          if (blocker) {
            if (message.rule === 'blocked' && message.persist !== false) await blocker.addNetworkBlock(api, message.frameDomain);
            else await blocker.removeNetworkBlock(api, message.frameDomain);
          }
          await recomputeTab(tabId);
          return { success: true, census: reg.getCensus(tabId) };
        }

        case 'TOGGLE_NETWORK_BLOCKING':
          if (self.WebSuddhi.networkBlocker) {
            return await self.WebSuddhi.networkBlocker.toggleNetworkBlocking(message.enabled);
          }
          return await setStorageAndReturn({ networkBlockingEnabled: message.enabled });

        // URL cleaning
        case 'TOGGLE_URL_CLEANING':
          if (self.WebSuddhi.urlCleaner) {
            return await self.WebSuddhi.urlCleaner.toggleUrlCleaning(message.enabled);
          }
          return await setStorageAndReturn({ urlCleaningEnabled: message.enabled });

        // Privacy
        case 'GET_PRIVACY_STATUS':
          if (self.WebSuddhi.privacy) {
            return await self.WebSuddhi.privacy.getStatus();
          }
          return { success: true, status: {} };

        case 'TOGGLE_ENABLED':
          return await toggleEnabled(message.enabled);

        case 'TOGGLE_PAYWALL':
          return await togglePaywall(message.enabled);

        case 'TOGGLE_SOCIAL_BLOCKING':
          return await toggleSocialBlocking(message.enabled);

        case 'TOGGLE_WHITELIST':
          try {
            const whitelistInput = message.hostname || sender.tab?.url;
            if (!whitelistInput) {
              return { success: false, error: 'No hostname provided' };
            }
            return await toggleWhitelistForSite(whitelistInput, sender.tab?.id);
          } catch (err) {
            return { success: false, error: err.message || 'Invalid hostname' };
          }

        case 'IS_WHITELISTED':
          if (message.hostname) {
            return { success: true, whitelisted: await isSiteWhitelisted(message.hostname) };
          }
          return { success: false, error: 'No hostname provided' };

        case 'WHITELIST_SITE':
          return await whitelistSite(message.hostname);

        case 'UNWHITELIST_SITE':
          return await unwhitelistSite(message.hostname);

        case 'GET_WHITELIST':
          const storage = await getStorage(['whitelistedSites']);
          return { success: true, whitelistedSites: storage.whitelistedSites || [] };

        case 'REPORT_FRAME':
          return await reportFrame(message, sender);

        case 'GET_SECURITY_INFO': {
          const securityTabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
          return await getSecurityInfo(securityTabId);
        }
        case 'GET_TAB_SECURITY_INFO':
        case 'GET_TAB_SECURITY': {
          const securityTabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
          return await getSecurityInfo(securityTabId);
        }

        case 'ALLOW_FRAME':
          return await allowFrame(message, sender);

        case 'UNBLOCK_REQUEST':
          return await unblockRequestDomain(message.url || message.domain);

        // Referrer/WebRTC/Ping
        case 'TOGGLE_REFERRER_STRIPPING':
          if (self.WebSuddhi.privacy) {
            return await self.WebSuddhi.privacy.toggleReferrerStripping(message.enabled);
          }
          return await setStorageAndReturn({ referrerStrippingEnabled: message.enabled });

        case 'TOGGLE_WEBRTC_PROTECTION':
          if (self.WebSuddhi.privacy) {
            return await self.WebSuddhi.privacy.toggleWebRTCProtection(message.enabled);
          }
          return await setStorageAndReturn({ webrtcProtectionEnabled: message.enabled });

        case 'TOGGLE_PING_PROTECTION':
          if (self.WebSuddhi.privacy) {
            return await self.WebSuddhi.privacy.togglePingProtection(message.enabled);
          }
          return await setStorageAndReturn({ pingProtectionEnabled: message.enabled });

        case 'TOGGLE_TELEMETRY_BLOCKING':
          if (self.WebSuddhi.privacy) {
            return await self.WebSuddhi.privacy.toggleTelemetryBlocking(message.enabled);
          }
          return await setStorageAndReturn({ telemetryBlockingEnabled: message.enabled });

        case 'TOGGLE_THIRD_PARTY_COOKIE_BLOCKING':
          if (self.WebSuddhi.privacy) {
            return await self.WebSuddhi.privacy.toggleThirdPartyCookieBlocking(message.enabled);
          }
          return await setStorageAndReturn({ thirdPartyCookieBlockingEnabled: message.enabled });

        // Phase 7: Filter lists
        case 'GET_FILTER_SUBSCRIPTIONS':
          if (self.WebSuddhi.filterLists) {
            return { success: true, subscriptions: await self.WebSuddhi.filterLists.getSubscriptions() };
          }
          return { success: true, subscriptions: [] };

        case 'ADD_FILTER_SUBSCRIPTION':
          if (self.WebSuddhi.filterLists) {
            return await self.WebSuddhi.filterLists.addSubscription(message.name, message.url);
          }
          return { success: false, error: 'Filter lists not available' };

        case 'REMOVE_FILTER_SUBSCRIPTION':
          if (self.WebSuddhi.filterLists) {
            return await self.WebSuddhi.filterLists.removeSubscription(message.subscriptionId);
          }
          return { success: false, error: 'Filter lists not available' };

        case 'TOGGLE_FILTER_SUBSCRIPTION':
          if (self.WebSuddhi.filterLists) {
            return await self.WebSuddhi.filterLists.toggleSubscription(message.subscriptionId, message.enabled);
          }
          return { success: false, error: 'Filter lists not available' };

        case 'UPDATE_FILTER_SUBSCRIPTION':
          if (self.WebSuddhi.filterLists) {
            return await self.WebSuddhi.filterLists.updateSubscription(message.subscriptionId);
          }
          return { success: false, error: 'Filter lists not available' };

        case 'UPDATE_ALL_FILTER_SUBSCRIPTIONS':
          if (self.WebSuddhi.filterLists) {
            await self.WebSuddhi.filterLists.updateAllSubscriptions();
            return { success: true };
          }
          return { success: false, error: 'Filter lists not available' };

        // Get all settings for popup/options
        case 'GET_ALL_SETTINGS': {
          const allKeys = Object.keys(DEFAULT_SETTINGS);
          const allStorage = await getStorage(allKeys);
          const settings = {};
          for (const key of allKeys) {
            settings[key] = allStorage[key] !== undefined ? allStorage[key] : DEFAULT_SETTINGS[key];
          }
          // Get syncEnabled from local storage
          const localData = await new Promise((resolve) => {
            api.storage.local.get(['syncEnabled'], (data) => resolve(data));
          });
          settings.syncEnabled = localData.syncEnabled || false;
          return { success: true, settings };
        }

        // Sync settings feature
        case 'TOGGLE_SYNC':
          return await migrateStorage(message.enabled);

        // Performance metrics feature
        case 'GET_PERFORMANCE_STATS':
          return await getPerformanceStats();

        case 'RESET_PERFORMANCE_STATS':
          await new Promise((resolve, reject) => {
            api.storage.local.set({ performanceStats: DEFAULT_SETTINGS.performanceStats }, () => {
              if (api.runtime.lastError) reject(api.runtime.lastError);
              else resolve();
            });
          });
          return { success: true };

        // Request log feature
        case 'GET_REQUEST_LOG':
          return { success: true, log: await getRequestLog() };

        case 'CLEAR_REQUEST_LOG':
          return await clearRequestLog();

        case 'ADD_LOG_ENTRY':
          return await addLogEntry(message.entry);

        case 'EXPORT_RULES':
          return await exportRules();

        case 'IMPORT_RULES':
          return await importRules(message.data);

        // Phishing detection
        case 'CHECK_PHISHING': {
          // Check if phishing protection is enabled
          const phishingSettings = await getStorage(['phishingProtectionEnabled']);
          if (phishingSettings.phishingProtectionEnabled === false) {
            return { isSuspicious: false, reason: 'Phishing protection disabled' };
          }

          if (message.domain && self.WebSuddhi.phishingDetector) {
            const result = self.WebSuddhi.phishingDetector.checkDomain(message.domain);
            if (result.isSuspicious) {
              // Record the detection for stats
              self.WebSuddhi.phishingDetector.recordDetection(result);

              // Start icon blinking if we have a tab
              if (sender.tab?.id) {
                startIconBlink(sender.tab.id);
              }
            }
            return result;
          }
          return { isSuspicious: false, reason: 'Phishing detector not available' };
        }

        case 'REPORT_PHISHING': {
          // User reports a domain as phishing (for future use with crowdsourced data)
          if (message.domain && self.WebSuddhi.phishingDetector) {
            // Record the report
            const detection = {
              isSuspicious: true,
              originalDomain: message.domain,
              reason: message.reason || 'User reported',
              riskLevel: 'user_reported',
              matchedBrand: message.brand || 'Unknown'
            };
            self.WebSuddhi.phishingDetector.recordDetection(detection);
            return { success: true, message: 'Phishing report recorded' };
          }
          return { success: false, error: 'Invalid report data' };
        }

        case 'GET_PHISHING_STATS': {
          if (self.WebSuddhi.phishingDetector) {
            return {
              success: true,
              stats: self.WebSuddhi.phishingDetector.getPhishingStats()
            };
          }
          return {
            success: true,
            stats: { totalDetected: 0, recentDetections: [], topTargetedBrands: [] }
          };
        }

        case 'RESET_PHISHING_STATS': {
          if (self.WebSuddhi.phishingDetector) {
            self.WebSuddhi.phishingDetector.resetPhishingStats();
          }
          return { success: true };
        }

        case 'TOGGLE_PHISHING_PROTECTION':
          return await setStorageAndReturn({ phishingProtectionEnabled: message.enabled });

        case 'TOGGLE_COOKIE_CONSENT':
          return await setStorageAndReturn({ cookieConsentEnabled: message.enabled });

        case 'TOGGLE_ANNOYANCE_BLOCKING':
          return await setStorageAndReturn({ annoyanceBlockingEnabled: message.enabled });

        case 'GET_PROTECTED_BRANDS': {
          if (self.WebSuddhi.phishingDetector) {
            return {
              success: true,
              brands: self.WebSuddhi.phishingDetector.getProtectedBrands()
            };
          }
          return { success: true, brands: [] };
        }

        case 'ADD_PROTECTED_BRAND': {
          if (self.WebSuddhi.phishingDetector && message.name && message.domains) {
            const result = self.WebSuddhi.phishingDetector.addProtectedBrand(message.name, message.domains);
            return { success: result };
          }
          return { success: false, error: 'Invalid brand data' };
        }

        case 'REMOVE_PROTECTED_BRAND': {
          if (self.WebSuddhi.phishingDetector && message.name) {
            const result = self.WebSuddhi.phishingDetector.removeProtectedBrand(message.name);
            return { success: result };
          }
          return { success: false, error: 'Invalid brand name' };
        }

        case 'PHISHING_DETECTED':
          // Direct trigger for phishing alert (from content script or other source)
          if (sender.tab?.id) {
            startIconBlink(sender.tab.id);
          }
          return { success: true };

        case 'STOP_PHISHING_ALERT': {
          const tabId = Number.isInteger(message.tabId) ? message.tabId : sender.tab?.id;
          if (typeof tabId === 'number') {
            stopIconBlink(tabId);
          }
          return { success: true };
        }

        // Tab management
        case 'GET_TABS':
          return await new Promise((resolve) => {
            api.tabs.query({}, (tabs) => resolve({ success: true, tabs }));
          });

        case 'OPEN_OPTIONS':
          openOptionsPage(message.anchor);
          return { success: true };

        default:
          return { success: false, error: 'Unknown message type: ' + message.type };
      }
    } catch (err) {
      logError('Message handler error:', err);
      return { success: false, error: err.message };
    }

    return true; // Keep message channel open for async responses
  }

  // ============================================
  // MIGRATE STORAGE FOR SYNC
  // ============================================
  async function migrateStorage(enabled) {
    const pickSyncableStorageData = self.WebSuddhi?.utils?.pickSyncableStorageData;

    if (!supportsSyncStorage()) {
      await setStorage({ syncEnabled: false });
      if (enabled) {
        return { success: false, error: 'Sync storage is not available in this browser' };
      }
      return { success: true, message: 'Sync disabled for this browser' };
    }

    if (enabled) {
      // Sync is being enabled - copy all settings to sync storage
      const localData = await getStorageArea('local', null);
      const syncData = pickSyncableStorageData
        ? pickSyncableStorageData(localData)
        : localData;

      // Copy only user-facing settings and rules into sync storage.
      await setStorageArea('sync', syncData);

      await setStorage({ syncEnabled: true });
      return { success: true, message: 'Sync enabled, settings copied to sync storage' };
    } else {
      // Sync is being disabled - copy sync data back to local
      const syncData = await getStorageArea('sync', null);

      await setStorageArea('local', syncData);

      await setStorage({ syncEnabled: false });
      return { success: true, message: 'Sync disabled, settings copied to local storage' };
    }
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  async function initialize() {
    try {
      // Load initial settings
      await getStorage(Object.keys(DEFAULT_SETTINGS));
      // Modules imported via importScripts auto-initialize themselves.
      // Avoid calling module init functions here to prevent duplicate listeners/timers.

      // Set up listeners
      api.runtime.onMessage.addListener(handleMessage);
      api.runtime.onUpdateCheckStatus && api.runtime.onUpdateCheckStatus.addListener((status) => {
        if (status === 'update_available') {
          log('Update available');
        }
      });
      if (api.tabs && api.tabs.onRemoved) {
        api.tabs.onRemoved.addListener((tabId) => {
          tabFrameMap.delete(tabId);
          stopIconBlink(tabId);
          if (self.WebSuddhi.frameRegistry) self.WebSuddhi.frameRegistry.removeTab(tabId);
        });
      }
      // Reset the per-tab frame census on top-frame navigation (per-page counts).
      if (api.webNavigation && api.webNavigation.onCommitted) {
        api.webNavigation.onCommitted.addListener((details) => {
          if (details.frameId === 0 && self.WebSuddhi.frameRegistry) {
            self.WebSuddhi.frameRegistry.resetTab(details.tabId);
          }
        });
      }
      // Warm the rule-list cache so the first FRAME_ANNOUNCE classifies correctly.
      if (self.WebSuddhi.listLoader) self.WebSuddhi.listLoader.loadLists();
      if (api.tabs && api.tabs.onUpdated) {
        api.tabs.onUpdated.addListener((tabId, changeInfo) => {
          if (changeInfo && changeInfo.status === 'loading') {
            tabFrameMap.delete(tabId);
          }
        });
      }

      // Set up context menu
      if (supportsContextMenus()) {
        setupContextMenu();
        api.contextMenus.onClicked.addListener(handleContextMenuClick);
      }

      // Set up command listener
      setupCommandListener();

      // Set up storage change listener for sync
      if (supportsSyncStorage() && api.storage?.onChanged) {
        api.storage.onChanged.addListener((changes, area) => {
          if (area === 'sync' && changes) {
            // Propagate sync changes to local
            const localChanges = {};
            for (const key in changes) {
              localChanges[key] = changes[key].newValue;
            }
            if (Object.keys(localChanges).length > 0) {
              setStorageArea('local', localChanges).catch((err) => {
                logError('Failed to apply sync changes locally:', err);
              });
            }
          }
        });
      }

      // Clean up old storage keys on init (run monthly)
      const oldKeys = ['adsBlocked', 'trackersBlocked', 'lastCleanUp'];
      const currentStorage = await getStorage(oldKeys);
      const hasOldData = oldKeys.some(key => currentStorage[key] !== undefined);
      if (hasOldData) {
        // Data will be migrated or cleared based on user action
        log('Found old storage data, consider migrating');
      }

      log('Background service worker initialized');
    } catch (err) {
      logError('Initialization error:', err);
    }
  }

  // Start initialization
  initialize();
})();
