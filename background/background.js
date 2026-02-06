// WebSuddhi - Background Service Worker
// Universal: Chrome, Edge, Firefox, Safari
// v2.1.0 - Full ad blocker with network blocking, stats, privacy, filter lists

// MV3: Import all modules via importScripts
try {
  if (typeof importScripts === 'function') {
    importScripts(
      '../shared/utils.js',
      'network-blocker.js',
      'url-cleaner.js',
      'stats-manager.js',
      'privacy.js',
      'filter-lists.js',
      'phishing-detector.js'
    );
  }
} catch (e) {
  if (self.WebSuddhi && self.WebSuddhi.utils) {
    self.WebSuddhi.utils.error('importScripts error:', e);
  } else {
    console.error('WebSuddhi: importScripts error:', e);
  }
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

  // ============================================
  // CERTIFICATE & SECURITY INFO (Firefox only has full support)
  // ============================================
  const tabSecurityInfo = new Map();

  // Collect security info for tabs (works best in Firefox with webRequest)
  async function collectSecurityInfo(tabId, url) {
    if (!url || !url.startsWith('http')) return null;

    const securityData = {
      url: url,
      isSecure: url.startsWith('https://'),
      protocol: url.startsWith('https://') ? 'HTTPS' : 'HTTP',
      certificate: null,
      thirdPartyDomains: [],
      blockedFrames: []
    };

    // Firefox has getSecurityInfo API
    if (typeof browser !== 'undefined' && browser.webRequest && browser.webRequest.getSecurityInfo) {
      try {
        // Note: This requires the webRequestBlocking permission
        const secInfo = await browser.webRequest.getSecurityInfo(tabId, { certificateChain: true });
        if (secInfo && secInfo.certificates && secInfo.certificates.length > 0) {
          const cert = secInfo.certificates[0];
          securityData.certificate = {
            issuer: cert.issuer || 'Unknown',
            subject: cert.subject || 'Unknown',
            organization: extractOrgFromSubject(cert.subject) || extractOrgFromSubject(cert.issuer),
            validFrom: cert.validity?.start ? new Date(cert.validity.start).toLocaleDateString() : null,
            validTo: cert.validity?.end ? new Date(cert.validity.end).toLocaleDateString() : null,
            fingerprint: cert.fingerprint?.sha256?.substring(0, 20) + '...' || null
          };
        }
      } catch (e) {
        // Firefox API not available or permission denied
      }
    }

    tabSecurityInfo.set(tabId, securityData);
    return securityData;
  }

  // Extract organization name from certificate subject/issuer string
  function extractOrgFromSubject(subject) {
    if (!subject) return null;
    // Format: "CN=example.com,O=Example Inc,L=City,ST=State,C=US"
    const orgMatch = subject.match(/O=([^,]+)/);
    if (orgMatch) return orgMatch[1];
    const cnMatch = subject.match(/CN=([^,]+)/);
    if (cnMatch) return cnMatch[1];
    return null;
  }

  // Track third-party frames per tab
  function addThirdPartyFrame(tabId, frameUrl, frameHost, blocked) {
    const secData = tabSecurityInfo.get(tabId);
    if (!secData) return;

    const entry = {
      url: frameUrl,
      host: frameHost,
      blocked: blocked,
      timestamp: Date.now()
    };

    if (blocked) {
      if (!secData.blockedFrames.find(f => f.host === frameHost)) {
        secData.blockedFrames.push(entry);
      }
    } else {
      if (!secData.thirdPartyDomains.find(f => f.host === frameHost)) {
        secData.thirdPartyDomains.push(entry);
      }
    }
  }

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
      warn('Rate limit exceeded: global limit reached (' + rateLimits.global + '/' + RATE_LIMIT_GLOBAL + ' messages/sec)');
      return true;
    }

    // Increment global counter
    rateLimits.global++;

    // Check per-tab rate limit if tabId is provided
    if (tabId !== undefined) {
      const tabCount = rateLimits.perTab.get(tabId) || 0;
      if (tabCount >= RATE_LIMIT_PER_TAB) {
        warn('Rate limit exceeded: tab ' + tabId + ' limit reached (' + tabCount + '/' + RATE_LIMIT_PER_TAB + ' messages/sec)');
        return true;
      }
      rateLimits.perTab.set(tabId, tabCount + 1);
    }

    return false;
  }

  // ============================================
  // BADGE COUNTER - Track blocked count per tab
  // ============================================
  const tabBlockedCounts = new Map();

  // ============================================
  // ICON BLINKING - For phishing/security alerts
  // ============================================
  const blinkingTabs = new Map();

  const MAX_BLINK_DURATION = 30000; // 30 seconds max blink duration

  function startIconBlink(tabId) {
    if (blinkingTabs.has(tabId)) return; // Already blinking

    const actionAPI = getActionAPI();
    if (!actionAPI) return;

    let isRed = true;
    const startTime = Date.now();

    const interval = setInterval(() => {
      try {
        // Check timeout first - clear interval BEFORE any operation that might throw
        if (Date.now() - startTime > MAX_BLINK_DURATION) {
          clearInterval(interval);
          blinkingTabs.delete(tabId);
          // Reset to normal icon (use .catch for promises)
          actionAPI.setIcon({
            tabId: tabId,
            path: ICON_PATHS_NORMAL
          }).catch(() => {});
          actionAPI.setBadgeText({ tabId, text: '' }).catch(() => {});
          actionAPI.setBadgeBackgroundColor({ tabId, color: '#0ea5e9' }).catch(() => {});
          return;
        }

        // Do the icon toggle
        if (isRed) {
          // Set to red warning icon
          actionAPI.setIcon({
            tabId: tabId,
            path: ICON_PATHS_ALERT
          }).catch(() => {}); // Ignore errors (tab might be closed)
          actionAPI.setBadgeText({ tabId, text: '\u26A0' }).catch(() => {});
          actionAPI.setBadgeBackgroundColor({ tabId, color: '#ef4444' }).catch(() => {});
        } else {
          // Set back to normal icon
          actionAPI.setIcon({
            tabId: tabId,
            path: ICON_PATHS_NORMAL
          }).catch(() => {}); // Ignore errors (tab might be closed)
          actionAPI.setBadgeText({ tabId, text: '' }).catch(() => {});
        }
        isRed = !isRed;
      } catch (err) {
        // On ANY error, clean up immediately
        clearInterval(interval);
        blinkingTabs.delete(tabId);
      }
    }, 500); // Blink every 500ms

    blinkingTabs.set(tabId, interval);
  }

  function stopIconBlink(tabId) {
    const interval = blinkingTabs.get(tabId);
    if (interval) {
      clearInterval(interval);
      blinkingTabs.delete(tabId);

      // Reset to normal icon
      const actionAPI = getActionAPI();
      if (actionAPI) {
        actionAPI.setIcon({
          tabId,
          path: ICON_PATHS_NORMAL
        }).catch(() => {});
        actionAPI.setBadgeText({ tabId, text: '' }).catch(() => {});
        actionAPI.setBadgeBackgroundColor({ tabId, color: '#0ea5e9' }).catch(() => {});
      }
    }
  }

  // Stop all blinking (cleanup)
  function stopAllIconBlinks() {
    for (const [tabId, interval] of blinkingTabs) {
      clearInterval(interval);
    }
    blinkingTabs.clear();
  }

  // Get the appropriate action API (MV3 vs MV2)
  function getActionAPI() {
    return chrome.action || chrome.browserAction;
  }

  // Update badge for a specific tab
  function updateBadge(tabId, count) {
    const actionAPI = getActionAPI();
    if (!actionAPI) return;

    const text = count > 0 ? (count > 999 ? '999+' : String(count)) : '';

    try {
      actionAPI.setBadgeText({ text, tabId });
      actionAPI.setBadgeBackgroundColor({ color: '#0ea5e9', tabId });
    } catch (err) {
      // Fallback without tabId for older browsers
      try {
        actionAPI.setBadgeText({ text });
        actionAPI.setBadgeBackgroundColor({ color: '#0ea5e9' });
      } catch (e) {
        logError('Badge update error:', e);
      }
    }
  }

  // Increment blocked count for a tab
  function incrementTabBlockedCount(tabId, count = 1) {
    const current = tabBlockedCounts.get(tabId) || 0;
    const newCount = current + count;
    tabBlockedCounts.set(tabId, newCount);
    updateBadge(tabId, newCount);
  }

  // Reset count when tab navigates to new page
  function resetTabBlockedCount(tabId) {
    tabBlockedCounts.set(tabId, 0);
    updateBadge(tabId, 0);
  }

  // Clean up when tab is closed
  function cleanupTabCount(tabId) {
    tabBlockedCounts.delete(tabId);
  }

  // Default settings
  const DEFAULT_SETTINGS = {
    enabled: true,
    paywallEnabled: true,
    networkBlockingEnabled: true,
    urlCleaningEnabled: true,
    cookieConsentEnabled: true,
    annoyanceBlockingEnabled: true,
    socialBlockingEnabled: false,
    referrerStrippingEnabled: false,
    webrtcProtectionEnabled: false,
    pingProtectionEnabled: true,
    phishingProtectionEnabled: true,
    syncEnabled: false,
    theme: 'system',
    blockedSelectors: [],
    whitelistedSites: [],
    jsDisabledSites: [],
    blockedDomains: [],
    allowedDomains: [],
    filterSubscriptions: [],
    requestLog: [],
    stats: {
      totalBlocked: 0,
      totalNetworkBlocked: 0,
      totalCosmeticBlocked: 0,
      today: {
        date: new Date().toISOString().slice(0, 10),
        networkBlocked: 0,
        cosmeticBlocked: 0,
        perSite: {},
        topDomains: {}
      },
      history: []
    },
    performanceStats: {
      requestsBlocked: 0,
      estimatedDataSaved: 0,
      estimatedTimeSaved: 0
    }
  };

  // Maximum number of log entries to keep
  const MAX_LOG_ENTRIES = 100;

  // ============================================
  // STORAGE API (Cross-browser with Sync Support)
  // ============================================
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  // Get storage area based on syncEnabled setting
  // syncEnabled is always stored in local storage
  async function getStorageArea() {
    return new Promise((resolve, reject) => {
      if (api.storage) {
        const result = api.storage.local.get(['syncEnabled']);
        if (result && typeof result.then === 'function') {
          result.then(data => {
            resolve(data.syncEnabled ? api.storage.sync : api.storage.local);
          }).catch(() => resolve(api.storage.local));
        } else {
          api.storage.local.get(['syncEnabled'], (data) => {
            if (api.runtime.lastError) resolve(api.storage.local);
            else resolve(data.syncEnabled ? api.storage.sync : api.storage.local);
          });
        }
        return;
      }
      resolve(null);
    });
  }

  function getStorage(keys) {
    return new Promise(async (resolve, reject) => {
      if (api.storage) {
        const storageArea = await getStorageArea();
        if (storageArea && typeof storageArea.get === 'function') {
          const result = storageArea.get(keys);
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          } else {
            // Chrome callback style
            storageArea.get(keys, (data) => {
              if (api.runtime.lastError) reject(api.runtime.lastError);
              else resolve(data);
            });
          }
          return;
        }
      }
      // Fallback
      try {
        const result = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(key => {
          const value = self.localStorage?.getItem('websuddhi_' + key);
          result[key] = value ? JSON.parse(value) : undefined;
        });
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  function setStorage(data) {
    return new Promise(async (resolve, reject) => {
      if (api.storage) {
        const storageArea = await getStorageArea();
        if (storageArea) {
          const result = storageArea.set(data);
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          } else {
            storageArea.set(data, () => {
              if (api.runtime.lastError) reject(api.runtime.lastError);
              else resolve();
            });
          }
          return;
        }
      }
      try {
        Object.keys(data).forEach(key => {
          self.localStorage?.setItem('websuddhi_' + key, JSON.stringify(data[key]));
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  // Keys that should NOT be synced (too large or local-only)
  const LOCAL_ONLY_KEYS = ['stats', 'performanceStats', 'filterSubscriptions'];

  // Migrate data between local and sync storage
  async function migrateStorage(toSync) {
    if (!api.storage || !api.storage.sync) {
      return { success: false, error: 'Sync storage not available' };
    }

    try {
      const sourceArea = toSync ? api.storage.local : api.storage.sync;
      const targetArea = toSync ? api.storage.sync : api.storage.local;

      // Get all data from source
      const allKeys = Object.keys(DEFAULT_SETTINGS);
      const keysToMigrate = allKeys.filter(key => !LOCAL_ONLY_KEYS.includes(key));

      const sourceData = await new Promise((resolve, reject) => {
        const result = sourceArea.get(keysToMigrate);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          sourceArea.get(keysToMigrate, (data) => {
            if (api.runtime.lastError) reject(api.runtime.lastError);
            else resolve(data);
          });
        }
      });

      // Copy to target (sync has 100KB limit, so only sync settings, not stats)
      if (Object.keys(sourceData).length > 0) {
        await new Promise((resolve, reject) => {
          const result = targetArea.set(sourceData);
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          } else {
            targetArea.set(sourceData, () => {
              if (api.runtime.lastError) reject(api.runtime.lastError);
              else resolve();
            });
          }
        });
      }

      // Update syncEnabled flag in local storage
      await new Promise((resolve, reject) => {
        const result = api.storage.local.set({ syncEnabled: toSync });
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          api.storage.local.set({ syncEnabled: toSync }, () => {
            if (api.runtime.lastError) reject(api.runtime.lastError);
            else resolve();
          });
        }
      });

      return { success: true, synced: toSync };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Update performance stats when blocking
  async function updatePerformanceStats(count = 1) {
    try {
      // Performance stats are always stored locally (not synced)
      const result = await new Promise((resolve, reject) => {
        api.storage.local.get(['performanceStats'], (data) => {
          if (api.runtime.lastError) reject(api.runtime.lastError);
          else resolve(data);
        });
      });

      const perfStats = result.performanceStats || DEFAULT_SETTINGS.performanceStats;
      perfStats.requestsBlocked += count;
      // Average ad request: ~50KB data, ~200ms load time
      perfStats.estimatedDataSaved += count * 50000;
      perfStats.estimatedTimeSaved += count * 200;

      await new Promise((resolve, reject) => {
        api.storage.local.set({ performanceStats: perfStats }, () => {
          if (api.runtime.lastError) reject(api.runtime.lastError);
          else resolve();
        });
      });
    } catch (err) {
      logError('updatePerformanceStats error:', err);
    }
  }

  // Get performance stats (always from local storage)
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
      api.commands.onCommand.addListener(handleCommand);
    }
  }

  async function handleCommand(command) {
    switch (command) {
      case 'toggle-pick-mode':
        await togglePickModeOnActiveTab();
        break;
      case 'toggle-whitelist':
        await toggleWhitelistForActiveTab();
        break;
      case 'open-settings':
        openSettingsPage();
        break;
    }
  }

  async function togglePickModeOnActiveTab() {
    try {
      const tabs = await queryTabs({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0 && tabs[0].id) {
        // Send message to toggle pick mode
        safeSendToTab(tabs[0].id, { type: 'START_PICK_MODE' });
      }
    } catch (err) {
      logError('togglePickModeOnActiveTab error:', err);
    }
  }

  async function toggleWhitelistForActiveTab() {
    try {
      const tabs = await queryTabs({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0 && tabs[0].url) {
        const url = tabs[0].url;
        let hostname;
        try {
          hostname = new URL(url).hostname.replace(/^www\./, '');
        } catch (e) {
          return;
        }

        const storage = await getStorage(['whitelistedSites']);
        const whitelisted = storage.whitelistedSites || [];

        if (whitelisted.includes(hostname)) {
          // Remove from whitelist
          const filtered = whitelisted.filter(s => s !== hostname);
          await setStorage({ whitelistedSites: filtered });
          // Notify content script
          if (tabs[0].id) {
            safeSendToTab(tabs[0].id, { type: 'UNWHITELIST_SITE', hostname });
          }
        } else {
          // Add to whitelist
          whitelisted.push(hostname);
          await setStorage({ whitelistedSites: whitelisted });
          // Notify content script
          if (tabs[0].id) {
            safeSendToTab(tabs[0].id, { type: 'WHITELIST_SITE', hostname });
          }
        }

        // Reload the tab to apply changes
        if (tabs[0].id) {
          api.tabs.reload(tabs[0].id);
        }
      }
    } catch (err) {
      logError('toggleWhitelistForActiveTab error:', err);
    }
  }

  function openSettingsPage() {
    api.runtime.openOptionsPage();
  }

  // Helper to query tabs with promise support
  function queryTabs(queryInfo) {
    return new Promise((resolve, reject) => {
      const result = api.tabs.query(queryInfo);
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        api.tabs.query(queryInfo, (tabs) => {
          if (api.runtime.lastError) reject(api.runtime.lastError);
          else resolve(tabs);
        });
      }
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  async function init() {
    try {
      const keys = Object.keys(DEFAULT_SETTINGS);
      const storage = await getStorage(keys);

      // Set defaults if not present
      const toSet = {};
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (storage[key] === undefined) {
          toSet[key] = value;
        }
      }
      if (Object.keys(toSet).length > 0) {
        await setStorage(toSet);
      }
    } catch (err) {
      logError('background init error:', err);
    }
  }

  // ============================================
  // MESSAGE LISTENER
  // ============================================
  function setupMessageListener() {
    const handler = (message, sender, sendResponse) => {
      handleMessage(message, sender)
        .then(response => {
          sendResponse(response);
        })
        .catch(err => {
          logError('Message error:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep channel open for async
    };

    api.runtime.onMessage.addListener(handler);
  }

  async function handleMessage(message, sender) {
    // Validate message structure
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      return { success: false, error: 'Invalid message format' };
    }

    const tab = sender.tab;
    const tabId = tab?.id;

    // Check rate limiting before processing message
    if (isRateLimited(tabId)) {
      return { success: false, error: 'Rate limited' };
    }

    switch (message.type) {
      case 'ADD_SELECTOR':
        return await addSelector(message.selector, tab);

      case 'REMOVE_SELECTOR':
        return await removeSelector(message.selector);

      case 'GET_ALL_SELECTORS':
        return await getAllSelectors();

      case 'GET_STATS':
        return await getStats();

      case 'RESET_STATS':
        return await resetStats();

      case 'INCREMENT_STATS':
        // Update badge counter for the tab
        if (tab && tab.id) {
          incrementTabBlockedCount(tab.id, message.count || 1);
        }
        return await incrementStats(message.hostname, message.count);

      case 'WHITELIST_SITE':
        return await whitelistSite(message.hostname || (tab?.url ? new URL(tab.url).hostname : null));

      case 'UNWHITELIST_SITE':
        return await unwhitelistSite(message.hostname);

      case 'GET_WHITELIST':
        return await getWhitelist();

      case 'TOGGLE_ENABLED':
        return await toggleEnabled(message.enabled);

      case 'TOGGLE_JS':
        return await toggleJavaScript(message.hostname, message.block);

      case 'GET_JS_STATUS':
        return await getJavaScriptStatus(message.url);

      case 'EXPORT_RULES':
        return await exportRules();

      case 'IMPORT_RULES':
        return await importRules(message.data);

      // Phase 1: Network blocking
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

      case 'GET_NETWORK_BLOCKED_COUNT':
        if (self.WebSuddhi.networkBlocker) {
          return { success: true, count: self.WebSuddhi.networkBlocker.getNetworkBlockedCount(message.tabId) };
        }
        return { success: true, count: 0 };

      case 'TOGGLE_NETWORK_BLOCKING':
        if (self.WebSuddhi.networkBlocker) {
          return await self.WebSuddhi.networkBlocker.toggleNetworkBlocking(message.enabled);
        }
        return await setStorageAndReturn({ networkBlockingEnabled: message.enabled });

      // Phase 2: URL cleaning
      case 'TOGGLE_URL_CLEANING':
        if (self.WebSuddhi.urlCleaner) {
          return await self.WebSuddhi.urlCleaner.toggleUrlCleaning(message.enabled);
        }
        return await setStorageAndReturn({ urlCleaningEnabled: message.enabled });

      // Phase 3: Cookie consent
      case 'TOGGLE_COOKIE_CONSENT':
        await setStorage({ cookieConsentEnabled: message.enabled });
        return { success: true, enabled: message.enabled };

      // Phase 4: Annoyance blocking
      case 'TOGGLE_ANNOYANCE_BLOCKING':
        await setStorage({ annoyanceBlockingEnabled: message.enabled });
        return { success: true, enabled: message.enabled };

      // Social media widget blocking
      case 'TOGGLE_SOCIAL_BLOCKING':
        await setStorage({ socialBlockingEnabled: message.enabled });
        return { success: true, enabled: message.enabled };

      // Phase 5: Enhanced stats
      case 'GET_ENHANCED_STATS':
        if (self.WebSuddhi.statsManager) {
          return { success: true, stats: self.WebSuddhi.statsManager.getStats() };
        }
        return await getStats();

      case 'GET_STATS_FOR_PERIOD':
        if (self.WebSuddhi.statsManager) {
          return { success: true, stats: self.WebSuddhi.statsManager.getStatsForPeriod(message.days || 1) };
        }
        return { success: true, stats: { network: 0, cosmetic: 0 } };

      case 'INCREMENT_COSMETIC_STATS':
        // Update badge counter for the tab
        if (tab && tab.id) {
          incrementTabBlockedCount(tab.id, message.count || 1);
        }
        if (self.WebSuddhi.statsManager) {
          self.WebSuddhi.statsManager.reportCosmeticBlock(message.hostname, message.count, message.selector);
        }
        return await incrementStats(message.hostname, message.count);

      // Phase 6: Privacy
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
        return await getRequestLog();

      case 'CLEAR_REQUEST_LOG':
        return await clearRequestLog();

      case 'ADD_LOG_ENTRY':
        return await addLogEntry(message.entry);

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
        await setStorage({ phishingProtectionEnabled: message.enabled });
        return { success: true, enabled: message.enabled };

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

      case 'STOP_PHISHING_ALERT':
        // Stop the blinking alert for a specific tab
        if (sender.tab?.id) {
          stopIconBlink(sender.tab.id);
        } else if (message.tabId) {
          stopIconBlink(message.tabId);
        }
        return { success: true };

      // Security & Certificate Info
      case 'GET_SECURITY_INFO': {
        const targetTabId = message.tabId || sender.tab?.id;
        if (!targetTabId) return { success: false, error: 'No tab ID' };

        let secData = tabSecurityInfo.get(targetTabId);
        if (!secData && message.url) {
          secData = await collectSecurityInfo(targetTabId, message.url);
        }
        return { success: true, securityInfo: secData || null };
      }

      case 'REPORT_FRAME': {
        // Content script reports a third-party frame
        const frameTabId = sender.tab?.id;
        if (frameTabId && message.frameHost) {
          addThirdPartyFrame(frameTabId, message.frameUrl, message.frameHost, message.blocked || false);
        }
        return { success: true };
      }

      case 'GET_FRAME_INFO': {
        const fTabId = message.tabId || sender.tab?.id;
        const secData = tabSecurityInfo.get(fTabId);
        return {
          success: true,
          thirdPartyDomains: secData?.thirdPartyDomains || [],
          blockedFrames: secData?.blockedFrames || []
        };
      }

      case 'ALLOW_FRAME': {
        // User chose to allow a blocked frame
        const allowTabId = message.tabId || sender.tab?.id;
        const secData = tabSecurityInfo.get(allowTabId);
        if (secData && message.frameHost) {
          // Move from blocked to allowed
          secData.blockedFrames = secData.blockedFrames.filter(f => f.host !== message.frameHost);
          if (!secData.thirdPartyDomains.find(f => f.host === message.frameHost)) {
            secData.thirdPartyDomains.push({ host: message.frameHost, url: message.frameUrl, allowed: true });
          }
        }
        return { success: true };
      }

      default:
        return { success: false, error: 'Unknown message type' };
    }
  }

  // ============================================
  // OPERATIONS
  // ============================================
  async function addSelector(selector, tab) {
    const storage = await getStorage(['blockedSelectors']);
    const selectors = storage.blockedSelectors || [];

    if (selectors.find(s => s.selector === selector)) {
      return { success: true, message: 'Selector already exists' };
    }

    // Limit to 500 rules
    if (selectors.length >= 500) {
      return { success: false, error: 'Rule limit reached (500)' };
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

  async function getStats() {
    const storage = await getStorage(['stats']);
    return {
      success: true,
      stats: storage.stats || DEFAULT_SETTINGS.stats
    };
  }

  async function resetStats() {
    await setStorage({
      stats: {
        totalBlocked: 0,
        perSite: {}
      }
    });
    // Also reset performance stats
    await new Promise((resolve) => {
      api.storage.local.set({ performanceStats: DEFAULT_SETTINGS.performanceStats }, () => resolve());
    });
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
  // REQUEST LOG FUNCTIONS
  // ============================================
  async function getRequestLog() {
    try {
      const storage = await getStorage(['requestLog']);
      return {
        success: true,
        log: storage.requestLog || []
      };
    } catch (err) {
      return { success: true, log: [] };
    }
  }

  async function clearRequestLog() {
    try {
      await setStorage({ requestLog: [] });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function addLogEntry(entry) {
    if (!entry) return { success: false, error: 'No entry provided' };

    try {
      const storage = await getStorage(['requestLog']);
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
      return { success: false, error: err.message };
    }
  }

  // Expose addLogEntry to be called from other modules (network-blocker, stats-manager)
  self.WebSuddhi.addLogEntry = addLogEntry;

  async function whitelistSite(hostnameOrUrl) {
    if (!hostnameOrUrl) return { success: false, error: 'No hostname provided' };

    try {
      let hostname;
      try {
        hostname = new URL(hostnameOrUrl).hostname;
      } catch (e) {
        hostname = hostnameOrUrl.replace(/^www\./, '');
      }
      const storage = await getStorage(['whitelistedSites']);
      const whitelisted = storage.whitelistedSites || [];

      if (!whitelisted.includes(hostname)) {
        whitelisted.push(hostname);
        await setStorage({ whitelistedSites: whitelisted });
      }

      return { success: true, message: 'Whitelisted ' + hostname };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function unwhitelistSite(hostname) {
    const storage = await getStorage(['whitelistedSites']);
    const whitelisted = (storage.whitelistedSites || []).filter(s => s !== hostname);

    await setStorage({ whitelistedSites: whitelisted });

    return { success: true, message: 'Unwhitelisted ' + hostname };
  }

  async function getWhitelist() {
    const storage = await getStorage(['whitelistedSites']);
    return {
      success: true,
      sites: storage.whitelistedSites || []
    };
  }

  async function toggleEnabled(enabled) {
    await setStorage({ enabled });
    await notifyAllTabs();
    return { success: true, enabled };
  }

  // ============================================
  // HELPER
  // ============================================
  async function setStorageAndReturn(data) {
    await setStorage(data);
    return { success: true };
  }

  // ============================================
  // IMPORT / EXPORT
  // ============================================
  async function exportRules() {
    const storage = await getStorage(['blockedSelectors', 'whitelistedSites', 'enabled', 'paywallEnabled',
      'networkBlockingEnabled', 'urlCleaningEnabled', 'cookieConsentEnabled', 'annoyanceBlockingEnabled',
      'socialBlockingEnabled', 'referrerStrippingEnabled', 'webrtcProtectionEnabled', 'pingProtectionEnabled',
      'phishingProtectionEnabled', 'blockedDomains', 'allowedDomains']);
    return {
      success: true,
      data: {
        version: '2.1.0',
        exportDate: new Date().toISOString(),
        blockedSelectors: storage.blockedSelectors || [],
        whitelistedSites: storage.whitelistedSites || [],
        enabled: storage.enabled !== false,
        paywallEnabled: storage.paywallEnabled !== false,
        networkBlockingEnabled: storage.networkBlockingEnabled !== false,
        urlCleaningEnabled: storage.urlCleaningEnabled !== false,
        cookieConsentEnabled: storage.cookieConsentEnabled !== false,
        annoyanceBlockingEnabled: storage.annoyanceBlockingEnabled !== false,
        socialBlockingEnabled: storage.socialBlockingEnabled === true,
        referrerStrippingEnabled: storage.referrerStrippingEnabled === true,
        webrtcProtectionEnabled: storage.webrtcProtectionEnabled === true,
        pingProtectionEnabled: storage.pingProtectionEnabled !== false,
        phishingProtectionEnabled: storage.phishingProtectionEnabled !== false,
        blockedDomains: storage.blockedDomains || [],
        allowedDomains: storage.allowedDomains || []
      }
    };
  }

  async function importRules(data) {
    if (!data || !data.blockedSelectors) {
      return { success: false, error: 'Invalid import data' };
    }

    try {
      const storage = await getStorage(['blockedSelectors', 'whitelistedSites']);
      const existingSelectors = storage.blockedSelectors || [];
      const existingWhitelist = storage.whitelistedSites || [];

      // Merge selectors (avoid duplicates, validate CSS syntax)
      const selectorSet = new Set(existingSelectors.map(s => s.selector));
      let skippedCount = 0;
      const utils = self.WebSuddhi.utils;

      for (const entry of data.blockedSelectors) {
        if (entry.selector && !selectorSet.has(entry.selector)) {
          // Validate CSS selector before importing
          if (utils && utils.isValidCSSSelector && !utils.isValidCSSSelector(entry.selector)) {
            skippedCount++;
            if (utils.warn) utils.warn('Skipped invalid selector:', entry.selector);
            continue;
          }
          existingSelectors.push(entry);
          selectorSet.add(entry.selector);
        }
      }

      // Merge whitelist
      const whitelistSet = new Set(existingWhitelist);
      for (const site of (data.whitelistedSites || [])) {
        whitelistSet.add(site);
      }

      // Enforce limit
      const limitedSelectors = existingSelectors.slice(0, 500);

      await setStorage({
        blockedSelectors: limitedSelectors,
        whitelistedSites: Array.from(whitelistSet)
      });

      await notifyAllTabs();

      const importedCount = data.blockedSelectors.length - skippedCount;
      return {
        success: true,
        message: 'Imported ' + importedCount + ' rules' + (skippedCount > 0 ? ' (' + skippedCount + ' invalid skipped)' : ''),
        totalRules: limitedSelectors.length,
        skippedCount: skippedCount
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ============================================
  // JAVASCRIPT CONTROL (Per-site)
  // ============================================
  async function toggleJavaScript(hostname, block) {
    if (!hostname) return { success: false, error: 'No hostname provided' };

    try {
      // Try Chrome contentSettings API if available
      if (typeof chrome !== 'undefined' && chrome.contentSettings && chrome.contentSettings.javascript) {
        const pattern = '*://' + hostname + '/*';
        await new Promise((resolve, reject) => {
          chrome.contentSettings.javascript.set({
            primaryPattern: pattern,
            setting: block ? 'block' : 'allow'
          }, () => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve();
          });
        });
      }

      const storage = await getStorage(['jsDisabledSites']);
      const sites = storage.jsDisabledSites || [];
      if (block) {
        if (!sites.includes(hostname)) sites.push(hostname);
      } else {
        const idx = sites.indexOf(hostname);
        if (idx > -1) sites.splice(idx, 1);
      }
      await setStorage({ jsDisabledSites: sites });

      return { success: true, blocked: block };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async function getJavaScriptStatus(url) {
    if (!url) return { success: true, setting: 'allow' };

    try {
      if (typeof chrome !== 'undefined' && chrome.contentSettings && chrome.contentSettings.javascript) {
        const setting = await new Promise((resolve, reject) => {
          chrome.contentSettings.javascript.get({ primaryUrl: url }, (details) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(details.setting);
          });
        });
        return { success: true, setting };
      }

      const storage = await getStorage(['jsDisabledSites']);
      const sites = storage.jsDisabledSites || [];
      let hostname;
      try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { hostname = ''; }
      return { success: true, setting: sites.includes(hostname) ? 'block' : 'allow' };
    } catch (err) {
      return { success: true, setting: 'allow' };
    }
  }

  // ============================================
  // TAB NOTIFICATIONS
  // ============================================
  async function notifyAllTabs() {
    try {
      if (api.tabs) {
        const queryTabs = api.tabs.query({ url: ['http://*/*', 'https://*/*'] });
        let tabs;
        if (queryTabs && typeof queryTabs.then === 'function') {
          tabs = await queryTabs;
        } else {
          tabs = await new Promise(resolve => api.tabs.query({ url: ['http://*/*', 'https://*/*'] }, resolve));
        }
        for (const tab of tabs) {
          if (tab.id) {
            safeSendToTab(tab.id, { type: 'RELOAD_RULES' });
          }
        }
      }
    } catch (err) {
      // Silently fail - tabs may not be accessible
    }
  }

  // ============================================
  // TAB EVENTS
  // ============================================
  function setupTabListeners() {
    if (api.tabs && api.tabs.onUpdated) {
      api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        // Reset badge count when tab navigates to a new page
        if (changeInfo.status === 'loading' && changeInfo.url) {
          resetTabBlockedCount(tabId);
          // Initialize security info for new page
          collectSecurityInfo(tabId, changeInfo.url);
        }
        if (changeInfo.status === 'complete') {
          notifyTab(tabId);
          // Try to collect security info if not already done
          if (tab && tab.url) {
            collectSecurityInfo(tabId, tab.url);
          }
        }
      });
    }

    // Clean up badge count and stop icon blinking when tab is closed
    if (api.tabs && api.tabs.onRemoved) {
      api.tabs.onRemoved.addListener((tabId) => {
        cleanupTabCount(tabId);
        stopIconBlink(tabId);
        tabSecurityInfo.delete(tabId);
      });
    }

    // Reset badge count and stop icon blinking when navigation starts (webNavigation API)
    if (api.webNavigation && api.webNavigation.onBeforeNavigate) {
      api.webNavigation.onBeforeNavigate.addListener((details) => {
        // Only reset for main frame navigation
        if (details.frameId === 0) {
          resetTabBlockedCount(details.tabId);
          stopIconBlink(details.tabId);
        }
      });
    }
  }

  function notifyTab(tabId) {
    if (tabId) {
      safeSendToTab(tabId, { type: 'TAB_UPDATED' });
    }
  }

  // ============================================
  // INSTALL LISTENER
  // ============================================
  function setupInstallListener() {
    api.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        await init();
      }
      // Setup context menu on install or update
      setupContextMenu();
    });
  }

  // ============================================
  // CONTEXT MENU CLICK LISTENER
  // ============================================
  function setupContextMenuListener() {
    if (api.contextMenus && api.contextMenus.onClicked) {
      api.contextMenus.onClicked.addListener(handleContextMenuClick);
    }
  }

  // ============================================
  // START
  // ============================================
  setupInstallListener();
  setupMessageListener();
  setupTabListeners();
  setupContextMenuListener();
  setupCommandListener();
  init();
})();
