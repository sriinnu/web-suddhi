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

  // Per-tab blocked request counts (network + cosmetic, tracked separately so nav-reset can clear both)
  const tabBlockedCounts = new Map();
  const tabCosmeticCounts = new Map();

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

  // MV2 tracking domains (unique - duplicates removed to avoid Set waste)
  const MV2_TRACKING_DOMAINS = new Set([
    'fpjs.io', 'perimeterx.com', 'datadome.co',
    'walkme.com', 'appcues.com', 'bugsnag.com', 'rollbar.com',
    'trackjs.com', 'newrelic.com', 'dynatrace.com',
    'appdynamics.com', 'apollo.io', 'lusha.com', 'leadiq.com'
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
    const storage = await getStorage(['networkBlockingEnabled', 'whitelistedSites', 'blockedDomains', 'allowedDomains', 'pausedSites']);
    const enabled = storage.networkBlockingEnabled !== false;

    if (api.declarativeNetRequest) {
      // The manifest enables every ruleset by default, so the stored flag has to
      // be re-applied on each worker start. Without this, importing a backup (or
      // syncing settings) with blocking off leaves 29,500 static rules live.
      await reconcileNetworkRulesets(enabled);

      if (!enabled) {
        await clearManagedDynamicRules();
        return;
      }

      await setupDynamicRules(storage);
      setupDNRFeedback();
    } else if (api.webRequest && api.webRequest.onBeforeRequest) {
      if (!enabled) return;
      // MV2: webRequest blocking, backed by the same generated blocklist
      // Chrome gets via declarativeNetRequest.
      await loadMV2GeneratedDomains();
      setupWebRequestBlocking(storage);
    }

    setupTabListeners();
    setupNavigationListener();
  }

  async function reconcileNetworkRulesets(enabled) {
    const rulesetIds = getNetworkRulesetIds();
    if (!rulesetIds.length) return;

    try {
      await api.declarativeNetRequest.updateEnabledRulesets(
        enabled
          ? { enableRulesetIds: rulesetIds, disableRulesetIds: [] }
          : { enableRulesetIds: [], disableRulesetIds: rulesetIds }
      );
    } catch (e) {
      logError('Failed to reconcile network rulesets:', e);
    }
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

    // Merge non-expired paused sites as transient whitelist entries
    const now = Date.now();
    const pausedMap = (storage.pausedSites && typeof storage.pausedSites === 'object') ? storage.pausedSites : {};
    const pausedActive = Object.entries(pausedMap)
      .filter(([, exp]) => typeof exp === 'number' && exp > now)
      .map(([host]) => host);
    const effectiveWhitelist = [...new Set([...whitelistedSites, ...normalizeDomainList(pausedActive, true)])];

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

    // User-blocked domains — must outrank list exceptions (priority 100).
    for (const domain of blockedDomains) {
      if (!pushManagedRule({
        priority: 500,
        action: { type: 'block' },
        condition: {
          urlFilter: '||' + domain + '^',
          resourceTypes: BLOCKED_RESOURCE_TYPES
        }
      })) break;
    }

    // Explicit allowed domains preserve previous behavior (allow matching URL domain).
    for (const domain of allowedDomains) {
      if (!pushManagedRule({
        priority: 600,
        action: { type: 'allow' },
        condition: {
          urlFilter: '||' + domain + '^',
          resourceTypes: BLOCKED_RESOURCE_TYPES
        }
      })) break;
    }

    // Whitelisted + currently-paused sites: full-site exemption by initiator domain.
    for (const domain of effectiveWhitelist) {
      if (!pushManagedRule({
        priority: 1000,
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

    const storage = await getStorage(['networkBlockingEnabled', 'blockedDomains', 'allowedDomains', 'whitelistedSites', 'pausedSites']);
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
          tabBlockedCounts.set(tabId, (tabBlockedCounts.get(tabId) || 0) + 1);
          updateBadge(tabId, getTotalBlockedCount(tabId));
          notifyCountUpdate(tabId);

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
                updateBadge(tabs[0].id, getTotalBlockedCount(tabs[0].id));
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
  // MV2 blocking state lives here so it can be refreshed at runtime; the old
  // version captured these sets once and ignored every later change.
  const mv2State = {
    whitelistedSites: new Set(),
    userBlockedDomains: new Set(),
    allowedDomains: new Set(),
    pausedMap: {},
    allBlocked: new Set()
  };
  let mv2Handler = null;
  let mv2GeneratedDomains = null;

  async function loadMV2GeneratedDomains() {
    if (mv2GeneratedDomains) return mv2GeneratedDomains;

    try {
      const response = await fetch(api.runtime.getURL('rules/generated-mv2-domains.json'));
      const domains = await response.json();
      mv2GeneratedDomains = new Set(
        (Array.isArray(domains) ? domains : []).map((domain) => String(domain).toLowerCase())
      );
    } catch (e) {
      logError('Could not load generated blocklist for MV2:', e);
      mv2GeneratedDomains = new Set();
    }

    return mv2GeneratedDomains;
  }

  function refreshMV2State(storage) {
    mv2State.whitelistedSites = new Set(storage.whitelistedSites || []);
    mv2State.userBlockedDomains = new Set(storage.blockedDomains || []);
    mv2State.allowedDomains = new Set(storage.allowedDomains || []);
    mv2State.pausedMap = (storage.pausedSites && typeof storage.pausedSites === 'object')
      ? storage.pausedSites
      : {};

    const subscriptionDomains = self.WebSuddhi.filterLists?.getMV2SubscriptionDomains?.() || [];
    const generatedDomains = mv2GeneratedDomains || new Set();

    mv2State.allBlocked = new Set([
      ...MV2_AD_DOMAINS,
      ...MV2_TRACKING_DOMAINS,
      ...mv2State.userBlockedDomains,
      ...generatedDomains,
      ...subscriptionDomains
    ]);
  }

  function isPausedMV2(host) {
    const expiry = mv2State.pausedMap[host];
    return typeof expiry === 'number' && expiry > Date.now();
  }

  function mv2BlockingHandler(details) {
    // Don't block main_frame
    if (details.type === 'main_frame') return {};

    try {
      const url = new URL(details.url);
      const domain = url.hostname;

      // Check if initiator is whitelisted or currently paused
      if (details.initiator || details.documentUrl) {
        const initiatorUrl = details.initiator || details.documentUrl;
        try {
          const initiatorHost = new URL(initiatorUrl).hostname.replace(/^www\./, '');
          if (mv2State.whitelistedSites.has(initiatorHost) || isPausedMV2(initiatorHost)) return {};
        } catch (e) {}
      }

      // Check if domain is allowed
      if (mv2State.allowedDomains.has(domain)) return {};

      // Per-site firewall 'allow' overrides the lists (its own listener handles 'block').
      if (self.WebSuddhi.firewall && self.WebSuddhi.firewall.decideCached(details) === 'allow') return {};

      // Check against blocklist
      if (isDomainBlocked(domain, mv2State.allBlocked)) {
        const tabId = details.tabId;
        if (tabId >= 0) {
          tabBlockedCounts.set(tabId, (tabBlockedCounts.get(tabId) || 0) + 1);
          updateBadge(tabId, getTotalBlockedCount(tabId));
          notifyCountUpdate(tabId);

          if (self.WebSuddhi.reportNetworkBlock) {
            const initiatorSite = (details.initiator || details.documentUrl || '')
              .replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '') || 'Unknown';
            self.WebSuddhi.reportNetworkBlock(tabId, domain, initiatorSite);
          }
        }
        return { cancel: true };
      }
    } catch (e) {}

    return {};
  }

  function applyMV2Blocking(enabled, storage) {
    if (!api.webRequest || !api.webRequest.onBeforeRequest) return;

    if (!enabled) {
      if (mv2Handler) {
        try {
          api.webRequest.onBeforeRequest.removeListener(mv2Handler);
        } catch (e) {
          logError('Could not remove webRequest listener:', e);
        }
        mv2Handler = null;
      }
      return;
    }

    if (storage) refreshMV2State(storage);

    if (!mv2Handler) {
      mv2Handler = mv2BlockingHandler;
      api.webRequest.onBeforeRequest.addListener(
        mv2Handler,
        { urls: ['<all_urls>'] },
        ['blocking']
      );
    }
  }

  function setupWebRequestBlocking(storage) {
    applyMV2Blocking(true, storage);

    // Re-read state whenever any of the sets that drive blocking change.
    if (api.storage && api.storage.onChanged) {
      api.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' && area !== 'sync') return;
        const watched = ['whitelistedSites', 'blockedDomains', 'allowedDomains', 'pausedSites', 'filterSubscriptions'];
        if (!watched.some((key) => key in (changes || {}))) return;

        getStorage(watched).then((next) => {
          refreshMV2State(next);
        }).catch(() => {});
      });
    }
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
        tabCosmeticCounts.delete(tabId);
      });
    }
  }

  function setupNavigationListener() {
    // Reset count on navigation
    if (api.webNavigation && api.webNavigation.onCommitted) {
      api.webNavigation.onCommitted.addListener((details) => {
        if (details.frameId === 0) {
          tabBlockedCounts.set(details.tabId, 0);
          tabCosmeticCounts.set(details.tabId, 0);
          updateBadge(details.tabId, 0);
        }
      });
    } else if (api.tabs && api.tabs.onUpdated) {
      api.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === 'loading') {
          tabBlockedCounts.set(tabId, 0);
          tabCosmeticCounts.set(tabId, 0);
          updateBadge(tabId, 0);
        }
      });
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================
  async function addDomainBlock(domain) {
    // Store the bare host: `||www.example.com^` would not cover example.com, and
    // the popup compares against a www-stripped hostname.
    const normalized = normalizeDomain(domain, true) || domain;
    const storage = await getStorage(['blockedDomains']);
    const domains = storage.blockedDomains || [];

    if (!domains.includes(normalized)) {
      domains.push(normalized);
      await setStorage({ blockedDomains: domains });

      if (api.declarativeNetRequest) {
        const result = await refreshDynamicRules();
        if (result && result.reason === 'network_blocking_disabled') {
          return { success: false, error: 'Network blocking is off — turn it on to block this site' };
        }
      }
    }
    return { success: true, domain: normalized };
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

  function getCosmeticBlockedCount(tabId) {
    return tabCosmeticCounts.get(tabId) || 0;
  }

  function getTotalBlockedCount(tabId) {
    return (tabBlockedCounts.get(tabId) || 0) + (tabCosmeticCounts.get(tabId) || 0);
  }

  function incrementCosmeticForTab(tabId, count) {
    if (typeof tabId !== 'number' || tabId < 0) return;
    const inc = Number.isFinite(count) && count > 0 ? count : 1;
    const next = (tabCosmeticCounts.get(tabId) || 0) + inc;
    tabCosmeticCounts.set(tabId, next);
    updateBadge(tabId, getTotalBlockedCount(tabId));
    notifyCountUpdate(tabId);
  }

  function notifyCountUpdate(tabId) {
    if (typeof self.WebSuddhi.broadcastBlockedCountUpdate === 'function') {
      self.WebSuddhi.broadcastBlockedCountUpdate(tabId);
    }
  }

  // Every ruleset the manifest declares — including the generated blocklist
  // chunks. Hardcoding three IDs left 40,000 generated rules blocking even
  // when the user switched network blocking off.
  // tracking_params is owned by the URL-cleaning toggle; everything else belongs
  // to network blocking. Toggling one must not silently flip the other.
  const URL_CLEANING_RULESET_IDS = new Set(['tracking_params']);

  function getStaticRulesetIds() {
    try {
      const resources = api.runtime.getManifest()?.declarative_net_request?.rule_resources || [];
      const ids = resources.map((resource) => resource && resource.id).filter(Boolean);
      if (ids.length) return ids;
    } catch (e) {
      logError('Could not read ruleset ids from manifest:', e);
    }
    return ['ad_domains', 'tracking_domains', 'tracking_params'];
  }

  function getNetworkRulesetIds() {
    return getStaticRulesetIds().filter((id) => !URL_CLEANING_RULESET_IDS.has(id));
  }

  async function toggleNetworkBlocking(enabled) {
    if (api.declarativeNetRequest) {
      const rulesetIds = getNetworkRulesetIds();

      try {
        await api.declarativeNetRequest.updateEnabledRulesets(
          enabled
            ? { enableRulesetIds: rulesetIds, disableRulesetIds: [] }
            : { enableRulesetIds: [], disableRulesetIds: rulesetIds }
        );
      } catch (e) {
        logError('Failed to toggle rulesets:', e);
        return { success: false, error: e.message || 'Could not update blocking rules' };
      }

      await setStorage({ networkBlockingEnabled: enabled });
      await refreshDynamicRules();
      return { success: true, enabled };
    }

    await setStorage({ networkBlockingEnabled: enabled });

    if (!api.declarativeNetRequest) {
      const storage = await getStorage(['whitelistedSites', 'blockedDomains', 'allowedDomains', 'pausedSites']);
      applyMV2Blocking(enabled, storage);
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
    getCosmeticBlockedCount,
    getTotalBlockedCount,
    incrementCosmeticForTab,
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
