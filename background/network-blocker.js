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
    } else {
      console.error('[WebSuddhi]', ...args);
    }
  };

  // Per-tab blocked request counts
  const tabBlockedCounts = new Map();

  // MV2 domain blocklist for webRequest fallback
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

  // MV2 tracking domains
  const MV2_TRACKING_DOMAINS = new Set([
    'fingerprintjs.com', 'fpjs.io', 'perimeterx.com', 'datadome.co',
    'amplitude.com', 'posthog.com', 'pendo.io', 'walkme.com',
    'appcues.com', 'logrocket.com', 'bugsnag.com', 'rollbar.com',
    'trackjs.com', 'sessionstack.com', 'smartlook.com',
    'contentsquare.com', 'newrelic.com', 'dynatrace.com',
    'appdynamics.com', 'clearbit.com', 'zoominfo.com',
    'apollo.io', 'lusha.com', 'leadiq.com',
    'scorecardresearch.com', 'imrworldwide.com',
    'agkn.com', 'adsrvr.org', 'krxd.net', 'bkrtx.com',
    'tapad.com', 'liadm.com', 'semasio.net', 'weborama.com'
  ]);

  // Resource types to block (exclude main_frame)
  const BLOCKED_RESOURCE_TYPES = [
    'script', 'image', 'xmlhttprequest', 'sub_frame',
    'stylesheet', 'font', 'media', 'websocket', 'ping', 'other'
  ];

  // ============================================
  // INITIALIZATION
  // ============================================
  async function initNetworkBlocker() {
    const storage = await getStorage(['networkBlockingEnabled', 'whitelistedSites', 'blockedDomains', 'allowedDomains']);
    const enabled = storage.networkBlockingEnabled !== false;

    if (!enabled) return;

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
  async function setupDynamicRules(storage) {
    const blockedDomains = storage.blockedDomains || [];
    const allowedDomains = storage.allowedDomains || [];
    const whitelistedSites = storage.whitelistedSites || [];

    // Build dynamic rules
    const rules = [];
    let ruleId = 20001; // Dynamic rules start at 20001

    // User-blocked domains
    for (const domain of blockedDomains) {
      rules.push({
        id: ruleId++,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: '||' + domain,
          resourceTypes: BLOCKED_RESOURCE_TYPES
        }
      });
    }

    // Whitelist: allow rules with higher priority
    const allAllowed = [...allowedDomains, ...whitelistedSites];
    for (const domain of allAllowed) {
      rules.push({
        id: ruleId++,
        priority: 2,
        action: { type: 'allow' },
        condition: {
          urlFilter: '||' + domain,
          resourceTypes: BLOCKED_RESOURCE_TYPES,
          initiatorDomains: [domain]
        }
      });
    }

    // Clear existing dynamic rules and add new ones
    try {
      const existingRules = await api.declarativeNetRequest.getDynamicRules();
      const removeIds = existingRules.map(r => r.id);

      await api.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: removeIds,
        addRules: rules
      });
    } catch (err) {
      logError('Failed to update dynamic rules:', err);
    }
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
          if (details.initiator || details.documentUrl) {
            const initiatorUrl = details.initiator || details.documentUrl;
            try {
              const initiatorHost = new URL(initiatorUrl).hostname.replace(/^www\./, '');
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
                // Get initiator site for logging
                let initiatorSite = 'Unknown';
                if (details.initiator || details.documentUrl) {
                  try {
                    initiatorSite = new URL(details.initiator || details.documentUrl).hostname;
                  } catch (e) {}
                }
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
        await setupDynamicRules(await getStorage(['blockedDomains', 'allowedDomains', 'whitelistedSites']));
      }
    }
    return { success: true };
  }

  async function removeDomainBlock(domain) {
    const storage = await getStorage(['blockedDomains']);
    const domains = (storage.blockedDomains || []).filter(d => d !== domain);
    await setStorage({ blockedDomains: domains });

    if (api.declarativeNetRequest) {
      await setupDynamicRules(await getStorage(['blockedDomains', 'allowedDomains', 'whitelistedSites']));
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
    }

    return { success: true, enabled };
  }

  // ============================================
  // STORAGE HELPERS
  // ============================================
  // Use shared storage helpers from utils.js
  const getStorage = self.WebSuddhi?.utils?.getStorage || function(keys) {
    return new Promise((resolve) => resolve({}));
  };
  const setStorage = self.WebSuddhi?.utils?.setStorage || function() {
    return Promise.resolve();
  };

  // ============================================
  // EXPOSE API
  // ============================================
  self.WebSuddhi.networkBlocker = {
    init: initNetworkBlocker,
    addDomainBlock,
    removeDomainBlock,
    getNetworkBlockedCount,
    toggleNetworkBlocking,
    getTabBlockedCounts: () => tabBlockedCounts
  };

  // Auto-init
  initNetworkBlocker().catch(err => {
    logError('network blocker init error:', err);
  });
})();
