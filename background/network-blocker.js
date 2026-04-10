// WebSuddhi - Network-Level Request Blocking
// Phase 1: Block ad/tracking requests at the network level
// MV3: declarativeNetRequest (static + dynamic rules)
// MV2: webRequest.onBeforeRequest

(function() {
  'use strict';

  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  // Shared namespace
  if (!self.WebSuddhi) self.WebSuddhi = {};

  // Logging helpers
  const logError = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    }
  };

  // Per-tab blocked request counts
  const tabBlockedCounts = new Map();

  // MV2 domain blocklist for webRequest fallback
  // Derived from shared tracker DB + additional ad-specific domains
  const _trackerDB = self.WebSuddhi.utils.getTrackerDatabase ? self.WebSuddhi.utils.getTrackerDatabase() : {};
  const _ADDITIONAL_AD_DOMAINS = [
    'pagead2.googlesyndication.com', 'moatads.com', 'doubleverify.com',
    'serving-sys.com', 'rlcdn.com', 'everesttech.net', 'mathtag.com',
    'simpli.fi', 'adsrvr.org', 'tapad.com', 'bidswitch.net',
    'smartadserver.com', 'adform.net', 'smaato.net', 'sharethrough.com',
    'triplelift.com', 'gumgum.com', '33across.com', 'sovrn.com',
    'revcontent.com', 'mgid.com', 'propellerads.com', 'popads.net',
    'adsterra.com', 'exoclick.com', 'trafficjunky.com', 'spotxchange.com',
    'carbonads.com', 'buysellads.com', 'adcolony.com', 'inmobi.com',
    'appsflyer.com', 'adjust.com', 'kochava.com', 'liadm.com',
    'crwdcntrl.net', 'eyeota.com', 'nativo.com', 'bidtellect.com',
    'zemanta.com', 'jwpltx.com', 'connatix.com', 'heatmap.com',
    'agkn.com', 'ml314.com', 'bkrtx.com', 'semasio.net', 'weborama.com',
    'adkernel.com', 'adpushup.com', 'publift.com', 'setupad.com',
    'snigel.com', 'freestar.com', 'sortable.com', 'playwire.com',
    'venatus.com', 'nitropay.com'
  ];
  const MV2_AD_DOMAINS = new Set([
    ...Object.keys(_trackerDB),
    ..._ADDITIONAL_AD_DOMAINS
  ]);

  // MV2 tracking domains (extra domains not in main tracker DB)
  const MV2_TRACKING_DOMAINS = new Set([
    'fpjs.io', 'perimeterx.com', 'datadome.co',
    'walkme.com', 'appcues.com', 'appdynamics.com'
  ]);

  // Resource types to block (exclude main_frame)
  const BLOCKED_RESOURCE_TYPES = [
    'script', 'image', 'xmlhttprequest', 'sub_frame',
    'stylesheet', 'font', 'media', 'websocket', 'ping', 'other'
  ];
  const NETWORK_DYNAMIC_RULE_ID_START = 20001;
  const NETWORK_DYNAMIC_RULE_ID_END = 29999;

  // ============================================
  // INITIALIZATION
  // ============================================
  async function initNetworkBlocker() {
    const storage = await getStorage(['networkBlockingEnabled', 'whitelistedSites', 'blockedDomains', 'allowedDomains']);
    const enabled = storage.networkBlockingEnabled !== false;

    if (!enabled) {
      if (api.declarativeNetRequest) {
        await clearManagedDynamicRules();
      }
      return;
    }

    if (api.declarativeNetRequest) {
      // MV3: Static rules are auto-loaded from manifest
      // Set up dynamic rules for user-added blocks and whitelist
      await setupDynamicRules(storage);
      setupDNRFeedback();
    } else if (api.webRequest && api.webRequest.onBeforeRequest) {
      // MV2: webRequest blocking
      setupWebRequestBlocking(storage);
    }

    setupTabListeners();
    setupNavigationListener();
  }

  // ============================================
  // MV3: DYNAMIC RULES & FEEDBACK
  // ============================================
  function normalizeDomain(value, stripWww = false) {
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

  function normalizeDomainList(domains, stripWww = false) {
    const normalized = [];
    const seen = new Set();

    for (const domain of domains || []) {
      const host = normalizeDomain(domain, stripWww);
      if (!host || seen.has(host)) continue;
      seen.add(host);
      normalized.push(host);
    }

    return normalized;
  }

  function isManagedDynamicRuleId(ruleId) {
    return Number.isInteger(ruleId) &&
      ruleId >= NETWORK_DYNAMIC_RULE_ID_START &&
      ruleId <= NETWORK_DYNAMIC_RULE_ID_END;
  }

  async function clearManagedDynamicRules() {
    if (!api.declarativeNetRequest) return;

    try {
      const existingRules = await api.declarativeNetRequest.getDynamicRules();
      const removeIds = existingRules
        .filter(rule => isManagedDynamicRuleId(rule.id))
        .map(rule => rule.id);

      if (removeIds.length === 0) return;
      await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds });
    } catch (err) {
      logError('Failed to clear managed dynamic rules:', err);
    }
  }

  async function applyManagedDynamicRules(rules) {
    if (!api.declarativeNetRequest) return;

    try {
      const existingRules = await api.declarativeNetRequest.getDynamicRules();
      const removeIds = existingRules
        .filter(rule => isManagedDynamicRuleId(rule.id))
        .map(rule => rule.id);

      // Avoid no-op API calls.
      if (removeIds.length === 0 && rules.length === 0) return;

      await api.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: removeIds,
        addRules: rules
      });
    } catch (err) {
      logError('Failed to update dynamic rules:', err);
    }
  }

  async function setupDynamicRules(storage) {
    const blockedDomains = normalizeDomainList(storage.blockedDomains || []);
    const allowedDomains = normalizeDomainList(storage.allowedDomains || []);
    const whitelistedSites = normalizeDomainList(storage.whitelistedSites || [], true);

    // Build dynamic rules
    const rules = [];
    let ruleId = NETWORK_DYNAMIC_RULE_ID_START;
    let exhaustedIdRange = false;

    function pushManagedRule(rule) {
      if (ruleId > NETWORK_DYNAMIC_RULE_ID_END) {
        exhaustedIdRange = true;
        return false;
      }
      rules.push({ ...rule, id: ruleId++ });
      return true;
    }

    // User-blocked domains
    for (const domain of blockedDomains) {
      if (!pushManagedRule({
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: '||' + domain,
          resourceTypes: BLOCKED_RESOURCE_TYPES
        }
      })) break;
    }

    // Explicit allowed domains preserve previous behavior (allow matching URL domain).
    for (const domain of allowedDomains) {
      if (!pushManagedRule({
        priority: 2,
        action: { type: 'allow' },
        condition: {
          urlFilter: '||' + domain,
          resourceTypes: BLOCKED_RESOURCE_TYPES
        }
      })) break;
    }

    // Whitelisted sites: full-site exemption by initiator domain.
    for (const domain of whitelistedSites) {
      if (!pushManagedRule({
        priority: 3,
        action: { type: 'allow' },
        condition: {
          resourceTypes: BLOCKED_RESOURCE_TYPES,
          initiatorDomains: [domain]
        }
      })) break;
    }

    if (exhaustedIdRange) {
      logError('Managed dynamic rule range exhausted; some rules were not applied.');
    }

    await applyManagedDynamicRules(rules);
  }

  async function refreshDynamicRules() {
    if (!api.declarativeNetRequest) {
      return { success: true, refreshed: false, reason: 'dnr_unavailable' };
    }

    const storage = await getStorage(['networkBlockingEnabled', 'blockedDomains', 'allowedDomains', 'whitelistedSites']);
    const enabled = storage.networkBlockingEnabled !== false;

    if (!enabled) {
      await clearManagedDynamicRules();
      return { success: true, refreshed: false, reason: 'network_blocking_disabled' };
    }

    await setupDynamicRules(storage);
    return { success: true, refreshed: true };
  }

  function setupDNRFeedback() {
    // Preferred: real-time event (requires declarativeNetRequestFeedback - dev mode only)
    if (api.declarativeNetRequest && api.declarativeNetRequest.onRuleMatchedDebug) {
      api.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
        if (info.request && info.request.tabId >= 0) {
          const tabId = info.request.tabId;
          const count = (tabBlockedCounts.get(tabId) || 0) + 1;
          tabBlockedCounts.set(tabId, count);
          updateBadge(tabId, count);

          if (self.WebSuddhi.reportNetworkBlock) {
            try {
              const url = new URL(info.request.url);
              self.WebSuddhi.reportNetworkBlock(tabId, url.hostname);
            } catch (e) {}
          }
        }
      });
    } else if (api.declarativeNetRequest && api.declarativeNetRequest.getMatchedRules) {
      // Fallback: poll getMatchedRules only when debug feedback API is unavailable
      // Use longer interval and only poll when there's an active tab to reduce overhead
      let pollInterval = null;

      function startPolling() {
        if (pollInterval) return;
        pollInterval = setInterval(async () => {
          try {
            const tabs = await api.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
              const result = await api.declarativeNetRequest.getMatchedRules({ tabId: tabs[0].id });
              const count = result.rulesMatchedInfo ? result.rulesMatchedInfo.length : 0;
              if (count > 0) {
                tabBlockedCounts.set(tabs[0].id, count);
                updateBadge(tabs[0].id, count);
              }
            }
          } catch (e) {}
        }, 5000);
      }

      function stopPolling() {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }

      // Only poll when a tab is focused
      if (api.tabs && api.tabs.onActivated) {
        api.tabs.onActivated.addListener(() => startPolling());
      }
      // Stop polling when all windows lose focus
      if (api.windows && api.windows.onFocusChanged) {
        api.windows.onFocusChanged.addListener((windowId) => {
          if (windowId === -1) stopPolling();
          else startPolling();
        });
      }
      startPolling();
    }
  }

  // ============================================
  // MV2: WEBREQUEST BLOCKING
  // ============================================
  function setupWebRequestBlocking(storage) {
    const whitelistedSites = new Set(storage.whitelistedSites || []);
    const userBlockedDomains = new Set(storage.blockedDomains || []);
    const allowedDomains = new Set(storage.allowedDomains || []);

    // Combine all blocked domains
    const allBlocked = new Set([...MV2_AD_DOMAINS, ...MV2_TRACKING_DOMAINS, ...userBlockedDomains]);

    api.webRequest.onBeforeRequest.addListener(
      (details) => {
        // Don't block main_frame
        if (details.type === 'main_frame') return {};

        try {
          const url = new URL(details.url);
          const domain = url.hostname;

          // Check if initiator is whitelisted
          let initiatorHost = null;
          if (details.initiator || details.documentUrl) {
            const initiatorUrl = details.initiator || details.documentUrl;
            try {
              initiatorHost = new URL(initiatorUrl).hostname.replace(/^www\./, '');
              if (whitelistedSites.has(initiatorHost)) return {};
            } catch (e) {}
          }

          // Check if domain is allowed
          if (allowedDomains.has(domain)) return {};

          // Check against blocklist
          if (isDomainBlocked(domain, allBlocked)) {
            const tabId = details.tabId;
            if (tabId >= 0) {
              const count = (tabBlockedCounts.get(tabId) || 0) + 1;
              tabBlockedCounts.set(tabId, count);
              updateBadge(tabId, count);

              if (self.WebSuddhi.reportNetworkBlock) {
                // Get initiator site for logging (reuse parsed value if available)
                const initiatorSite = initiatorHost !== null
                  ? (details.initiator || details.documentUrl || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '')
                  : 'Unknown';
                self.WebSuddhi.reportNetworkBlock(tabId, domain, initiatorSite);
              }
            }
            return { cancel: true };
          }
        } catch (e) {}

        return {};
      },
      { urls: ['<all_urls>'] },
      ['blocking']
    );
  }

  function isDomainBlocked(hostname, blocklist) {
    // Check exact match and parent domains
    const parts = hostname.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const domain = parts.slice(i).join('.');
      if (blocklist.has(domain)) return true;
    }
    return false;
  }

  // ============================================
  // BADGE & TAB MANAGEMENT
  // ============================================
  function updateBadge(tabId, count) {
    try {
      const text = count > 999 ? '999+' : String(count);
      if (api.action) {
        // MV3
        api.action.setBadgeText({ text, tabId });
        api.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
      } else if (api.browserAction) {
        // MV2
        api.browserAction.setBadgeText({ text, tabId });
        api.browserAction.setBadgeBackgroundColor({ color: '#ef4444', tabId });
      }
    } catch (e) {}
  }

  function setupTabListeners() {
    // Reset count when tab is removed
    if (api.tabs && api.tabs.onRemoved) {
      api.tabs.onRemoved.addListener((tabId) => {
        tabBlockedCounts.delete(tabId);
      });
    }
  }

  function setupNavigationListener() {
    // Reset count on navigation
    if (api.webNavigation && api.webNavigation.onCommitted) {
      api.webNavigation.onCommitted.addListener((details) => {
        if (details.frameId === 0) {
          tabBlockedCounts.set(details.tabId, 0);
          updateBadge(details.tabId, 0);
        }
      });
    } else if (api.tabs && api.tabs.onUpdated) {
      api.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === 'loading') {
          tabBlockedCounts.set(tabId, 0);
          updateBadge(tabId, 0);
        }
      });
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================
  async function addDomainBlock(domain) {
    const storage = await getStorage(['blockedDomains']);
    const domains = storage.blockedDomains || [];
    if (!domains.includes(domain)) {
      domains.push(domain);
      await setStorage({ blockedDomains: domains });

      if (api.declarativeNetRequest) {
        await refreshDynamicRules();
      }
    }
    return { success: true };
  }

  async function removeDomainBlock(domain) {
    const storage = await getStorage(['blockedDomains']);
    const domains = (storage.blockedDomains || []).filter(d => d !== domain);
    await setStorage({ blockedDomains: domains });

    if (api.declarativeNetRequest) {
      await refreshDynamicRules();
    }
    return { success: true };
  }

  function getNetworkBlockedCount(tabId) {
    return tabBlockedCounts.get(tabId) || 0;
  }

  async function toggleNetworkBlocking(enabled) {
    await setStorage({ networkBlockingEnabled: enabled });

    if (api.declarativeNetRequest) {
      try {
        await api.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: enabled ? ['ad_domains', 'tracking_domains', 'tracking_params'] : [],
          disableRulesetIds: enabled ? [] : ['ad_domains', 'tracking_domains', 'tracking_params']
        });
      } catch (e) {
        logError('Failed to toggle rulesets:', e);
      }

      await refreshDynamicRules();
    }

    return { success: true, enabled };
  }

  // Shared storage (utils.js is loaded via importScripts before this file)
  const getStorage = self.WebSuddhi.utils.getStorage;
  const setStorage = self.WebSuddhi.utils.setStorage;

  // ============================================
  // EXPOSE API
  // ============================================
  self.WebSuddhi.networkBlocker = {
    init: initNetworkBlocker,
    addDomainBlock,
    removeDomainBlock,
    getNetworkBlockedCount,
    refreshDynamicRules,
    rebuildDynamicRules: refreshDynamicRules,
    toggleNetworkBlocking,
    getTabBlockedCounts: () => tabBlockedCounts
  };

  // Auto-init
  initNetworkBlocker().catch(err => {
    logError('network blocker init error:', err);
  });
})();
