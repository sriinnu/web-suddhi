// WebSuddhi - Filter List Subscriptions
// Phase 7: Manage external filter list subscriptions with ABP syntax support

(function() {
  'use strict';

  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  if (!self.WebSuddhi) self.WebSuddhi = {};

  // Logging helpers
  const log = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.log) {
      self.WebSuddhi.utils.log(...args);
    } else {
      console.log('[WebSuddhi]', ...args);
    }
  };

  const logError = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    } else {
      console.error('[WebSuddhi]', ...args);
    }
  };

  // Dynamic rule ID range for filter list rules: 40001-69999
  const FILTER_RULE_ID_START = 40001;
  const MAX_FILTER_RULES = 30000;

  // Cache for filter lists with TTL (1 hour default)
  const FILTER_CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
  const filterCache = new Map(); // url -> { data, timestamp }

  // Rate limiting for subscription updates
  let lastUpdateTime = 0;
  const UPDATE_COOLDOWN = 5000; // 5 seconds between updates

  // Built-in filter lists
  const BUILTIN_LISTS = [
    {
      id: 'websuddhi-ads',
      name: 'WebSuddhi Ad Domains',
      url: null, // Bundled as static ruleset
      enabled: true,
      builtin: true,
      ruleCount: 0 // Managed by manifest
    },
    {
      id: 'websuddhi-tracking',
      name: 'WebSuddhi Tracking Domains',
      url: null,
      enabled: true,
      builtin: true,
      ruleCount: 0
    }
  ];

  // MV2: In-memory set of blocked domains from subscriptions
  let mv2SubscriptionDomains = new Set();

  // ============================================
  // INITIALIZATION
  // ============================================
  async function initFilterLists() {
    const storage = await getStorage(['filterSubscriptions']);
    let subscriptions = storage.filterSubscriptions;

    // Initialize with built-in lists if first run or invalid format
    if (!subscriptions || !Array.isArray(subscriptions)) {
      subscriptions = BUILTIN_LISTS.map(list => ({
        ...list,
        lastUpdated: null
      }));
      await setStorage({ filterSubscriptions: subscriptions });
    }

    // Load custom subscription rules for MV2
    if (!api.declarativeNetRequest) {
      await loadMV2SubscriptionRules(subscriptions);
    }

    await restoreSubscriptionRules(subscriptions);

    // Set up auto-update alarm
    setupAutoUpdate();
  }

  async function getStoredSubscriptionDomains() {
    const storage = await getStorage(['filterSubscriptionDomains']);
    return storage.filterSubscriptionDomains || {};
  }

  async function setStoredSubscriptionDomains(storedDomains) {
    await setStorage({ filterSubscriptionDomains: storedDomains });
  }

  async function persistSubscriptionDomains(subscriptionId, domains) {
    const storedDomains = await getStoredSubscriptionDomains();
    storedDomains[subscriptionId] = domains;
    await setStoredSubscriptionDomains(storedDomains);
    return storedDomains;
  }

  async function rebuildMV2SubscriptionRules(subscriptions = null, storedDomains = null) {
    const activeSubscriptions = Array.isArray(subscriptions)
      ? subscriptions
      : ((await getStorage(['filterSubscriptions'])).filterSubscriptions || []);
    const domainMap = storedDomains || await getStoredSubscriptionDomains();

    mv2SubscriptionDomains = new Set();
    for (const sub of activeSubscriptions) {
      if (!sub.enabled || sub.builtin || !Array.isArray(domainMap[sub.id])) {
        continue;
      }

      for (const domain of domainMap[sub.id]) {
        mv2SubscriptionDomains.add(domain);
      }
    }
  }

  async function restoreSubscriptionRules(subscriptions) {
    const activeSubscriptions = (subscriptions || []).filter((sub) => (
      sub.enabled && !sub.builtin && sub.url
    ));

    if (activeSubscriptions.length === 0) {
      return;
    }

    if (api.declarativeNetRequest) {
      const ruleMapping = await getStorage(['filterRuleMapping']);
      const mappedSubscriptions = new Set(Object.values(ruleMapping.filterRuleMapping || {}));

      for (const sub of activeSubscriptions) {
        if (!mappedSubscriptions.has(sub.id)) {
          await updateSubscription(sub.id);
        }
      }

      return;
    }

    const storedDomains = await getStoredSubscriptionDomains();
    for (const sub of activeSubscriptions) {
      if (!Array.isArray(storedDomains[sub.id]) || storedDomains[sub.id].length === 0) {
        await updateSubscription(sub.id);
      }
    }
  }

  // ============================================
  // ABP FILTER PARSER (Basic)
  // ============================================
  function parseABPFilterList(text) {
    const domains = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments, empty lines, metadata
      if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('[')) continue;

      // Skip cosmetic filters (##, #@#, #?#)
      if (trimmed.includes('##') || trimmed.includes('#@#') || trimmed.includes('#?#')) continue;

      // Skip complex patterns (regex, options with specific types)
      if (trimmed.startsWith('/') && trimmed.endsWith('/')) continue;

      // Parse ||domain.com^ syntax (domain blocking)
      const domainMatch = trimmed.match(/^\|\|([a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)+)\^?(\$.*)?$/i);
      if (domainMatch) {
        let domain = domainMatch[1].toLowerCase();

        // Check for exception rules (@@)
        if (trimmed.startsWith('@@')) continue;

        // Check $options for unsupported types
        const options = domainMatch[5];
        if (options) {
          // Skip rules with complex options we can't handle
          const optStr = options.substring(1);
          if (optStr.includes('redirect') || optStr.includes('csp') || optStr.includes('rewrite')) continue;
        }

        domains.push(domain);
      }
    }

    return [...new Set(domains)]; // Deduplicate
  }

  // ============================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================
  async function addSubscription(name, url) {
    const utils = self.WebSuddhi.utils;

    // Validate URL - require HTTPS (or localhost for dev)
    if (utils && utils.isValidFilterListURL) {
      if (!utils.isValidFilterListURL(url)) {
        return { success: false, error: 'Invalid URL. Filter lists must use HTTPS for security.' };
      }
    } else {
      // Fallback validation if utils not loaded
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' &&
            !(parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))) {
          return { success: false, error: 'Invalid URL. Filter lists must use HTTPS for security.' };
        }
      } catch (e) {
        return { success: false, error: 'Invalid URL format' };
      }
    }

    const storage = await getStorage(['filterSubscriptions']);
    const subscriptions = storage.filterSubscriptions || [];

    // Check for duplicates
    if (subscriptions.find(s => s.url === url)) {
      return { success: false, error: 'Subscription already exists' };
    }

    const subscription = {
      id: 'custom-' + Date.now(),
      name: name || url,
      url,
      enabled: true,
      builtin: false,
      ruleCount: 0,
      lastUpdated: null
    };

    subscriptions.push(subscription);
    await setStorage({ filterSubscriptions: subscriptions });

    // Fetch and apply rules immediately
    await updateSubscription(subscription.id);

    return { success: true, subscription };
  }

  async function removeSubscription(subscriptionId) {
    const storage = await getStorage(['filterSubscriptions']);
    const subscriptions = storage.filterSubscriptions || [];
    const sub = subscriptions.find(s => s.id === subscriptionId);

    if (!sub) return { success: false, error: 'Subscription not found' };
    if (sub.builtin) return { success: false, error: 'Cannot remove built-in list' };

    const filtered = subscriptions.filter(s => s.id !== subscriptionId);
    await setStorage({ filterSubscriptions: filtered });

    // Remove associated rules
    await removeSubscriptionRules(subscriptionId, { clearStoredDomains: true });

    return { success: true };
  }

  async function toggleSubscription(subscriptionId, enabled) {
    const storage = await getStorage(['filterSubscriptions']);
    const subscriptions = storage.filterSubscriptions || [];
    const sub = subscriptions.find(s => s.id === subscriptionId);

    if (!sub) return { success: false, error: 'Subscription not found' };

    sub.enabled = enabled;
    await setStorage({ filterSubscriptions: subscriptions });

    if (sub.builtin) {
      // Toggle built-in rulesets
      if (api.declarativeNetRequest) {
        const rulesetId = sub.id === 'websuddhi-ads' ? 'ad_domains' : 'tracking_domains';
        try {
          await api.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: enabled ? [rulesetId] : [],
            disableRulesetIds: enabled ? [] : [rulesetId]
          });
        } catch (e) {}
      }
    } else {
      // Toggle custom subscription rules
      if (enabled) {
        await updateSubscription(subscriptionId);
      } else {
        await removeSubscriptionRules(subscriptionId);
      }
    }

    return { success: true, enabled };
  }

  async function updateSubscription(subscriptionId) {
    const storage = await getStorage(['filterSubscriptions']);
    const subscriptions = storage.filterSubscriptions || [];
    const sub = subscriptions.find(s => s.id === subscriptionId);
    const utils = self.WebSuddhi.utils;

    if (!sub || !sub.url || sub.builtin) return { success: false, error: 'Invalid subscription' };

    const now = Date.now();

    // Check cache first so toggling a recently fetched list back on can reuse it.
    const cached = filterCache.get(sub.url);
    if (cached && (now - cached.timestamp) < FILTER_CACHE_TTL) {
      const domains = cached.data;
      log('Using cached filter list for:', sub.url);
      sub.ruleCount = domains.length;
      sub.lastUpdated = new Date(cached.timestamp).toISOString();
      await setStorage({ filterSubscriptions: subscriptions });

      await persistSubscriptionDomains(subscriptionId, domains);

      if (sub.enabled) {
        await applySubscriptionRules(subscriptionId, domains);
      }

      return { success: true, cached: true, ruleCount: domains.length };
    }

    // Rate limiting per subscription
    if (sub.lastUpdated && (now - new Date(sub.lastUpdated).getTime()) < UPDATE_COOLDOWN) {
      return { success: false, error: 'Subscription updated recently, please wait' };
    }

    // Re-validate URL before fetching (in case of stored legacy URLs)
    if (utils && utils.isValidFilterListURL) {
      if (!utils.isValidFilterListURL(sub.url)) {
        return { success: false, error: 'Invalid URL protocol. HTTPS required.' };
      }
    }

    try {
      // Fetch with timeout (30 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(sub.url, {
        signal: controller.signal,
        headers: { 'Accept': 'text/plain, */*' }
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('HTTP ' + response.status);

      const text = await response.text();

      // Limit response size (2MB max)
      if (text.length > 2 * 1024 * 1024) {
        throw new Error('Filter list too large (max 2MB)');
      }

      // Limit line count (50,000 lines max)
      const lines = text.split('\n');
      if (lines.length > 50000) {
        throw new Error('Filter list has too many lines (max 50,000)');
      }

      // Parse with timeout (5 seconds)
      const parsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Filter parsing timed out')), 5000);
        try {
          const domains = parseABPFilterList(text);
          clearTimeout(timeout);
          resolve(domains);
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });

      const domains = await parsePromise;

      // Limit domain count (10,000 domains max)
      if (domains.length > 10000) {
        throw new Error('Filter list has too many rules (max 10,000)');
      }

      sub.ruleCount = domains.length;
      sub.lastUpdated = new Date().toISOString();
      await setStorage({ filterSubscriptions: subscriptions });
      await persistSubscriptionDomains(subscriptionId, domains);

      // Store in cache
      filterCache.set(sub.url, {
        data: domains,
        timestamp: Date.now()
      });

      // Apply rules
      if (sub.enabled) {
        await applySubscriptionRules(subscriptionId, domains);
      }

      return { success: true, ruleCount: domains.length };
    } catch (err) {
      const errorMsg = err.name === 'AbortError' ? 'Request timed out' : err.message;
      return { success: false, error: errorMsg };
    }
  }

  async function updateAllSubscriptions() {
    // Rate limiting: prevent rapid successive updates
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_COOLDOWN) {
      return { success: false, error: 'Update in progress, please wait' };
    }
    lastUpdateTime = now;

    const storage = await getStorage(['filterSubscriptions']);
    const subscriptions = storage.filterSubscriptions || [];

    for (const sub of subscriptions) {
      if (!sub.builtin && sub.enabled && sub.url) {
        await updateSubscription(sub.id);
        // Small delay between subscriptions to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      }
    }
    return { success: true };
  }

  // ============================================
  // RULE APPLICATION
  // ============================================
  async function applySubscriptionRules(subscriptionId, domains) {
    if (api.declarativeNetRequest) {
      // MV3: Add as dynamic rules
      // Remove existing rules for this subscription first
      await removeSubscriptionRules(subscriptionId);

      // Store domain-to-subscription mapping
      const ruleMapping = await getStorage(['filterRuleMapping']);
      const mapping = ruleMapping.filterRuleMapping || {};

      // Find next available rule ID
      let nextId = FILTER_RULE_ID_START;
      const existingRules = await api.declarativeNetRequest.getDynamicRules();
      const usedIds = new Set(existingRules.map(r => r.id));

      const rules = [];
      for (const domain of domains) {
        // Find next available ID in our range
        while (usedIds.has(nextId) && nextId < FILTER_RULE_ID_START + MAX_FILTER_RULES) {
          nextId++;
        }
        if (nextId >= FILTER_RULE_ID_START + MAX_FILTER_RULES) break;

        rules.push({
          id: nextId,
          priority: 1,
          action: { type: 'block' },
          condition: {
            urlFilter: '||' + domain,
            resourceTypes: [
              'script', 'image', 'xmlhttprequest', 'sub_frame',
              'stylesheet', 'font', 'media', 'websocket', 'ping', 'other'
            ]
          }
        });

        mapping[nextId] = subscriptionId;
        usedIds.add(nextId);
        nextId++;
      }

      if (rules.length > 0) {
        try {
          await api.declarativeNetRequest.updateDynamicRules({
            addRules: rules
          });
          await setStorage({ filterRuleMapping: mapping });
        } catch (e) {
          logError('Failed to apply subscription rules:', e);
        }
      }
    } else {
      await rebuildMV2SubscriptionRules();
    }
  }

  async function removeSubscriptionRules(subscriptionId, options = {}) {
    if (api.declarativeNetRequest) {
      const ruleMapping = await getStorage(['filterRuleMapping']);
      const mapping = ruleMapping.filterRuleMapping || {};

      const ruleIdsToRemove = [];
      for (const [ruleId, subId] of Object.entries(mapping)) {
        if (subId === subscriptionId) {
          ruleIdsToRemove.push(parseInt(ruleId));
          delete mapping[ruleId];
        }
      }

      if (ruleIdsToRemove.length > 0) {
        try {
          await api.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ruleIdsToRemove
          });
          await setStorage({ filterRuleMapping: mapping });
        } catch (e) {
          logError('Failed to remove subscription rules:', e);
        }
      }

      return;
    }

    const storedDomains = await getStoredSubscriptionDomains();
    if (options.clearStoredDomains) {
      delete storedDomains[subscriptionId];
      await setStoredSubscriptionDomains(storedDomains);
    }

    await rebuildMV2SubscriptionRules(null, storedDomains);
  }

  async function loadMV2SubscriptionRules(subscriptions) {
    await rebuildMV2SubscriptionRules(subscriptions);
  }

  // ============================================
  // AUTO-UPDATE
  // ============================================
  function setupAutoUpdate() {
    if (api.alarms) {
      // Create alarm for daily updates
      api.alarms.create('websuddhi-filter-update', {
        periodInMinutes: 24 * 60 // Every 24 hours
      });

      api.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'websuddhi-filter-update') {
          updateAllSubscriptions().catch(err => {
            logError('Auto-update failed:', err);
          });
        }
      });
    }
  }

  // ============================================
  // QUERIES
  // ============================================
  async function getSubscriptions() {
    const storage = await getStorage(['filterSubscriptions']);
    return storage.filterSubscriptions || [];
  }

  function getMV2SubscriptionDomains() {
    return mv2SubscriptionDomains;
  }

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
  self.WebSuddhi.filterLists = {
    init: initFilterLists,
    addSubscription,
    removeSubscription,
    toggleSubscription,
    updateSubscription,
    updateAllSubscriptions,
    getSubscriptions,
    getMV2SubscriptionDomains
  };

  // Auto-init
  initFilterLists().catch(err => {
    logError('filter lists init error:', err);
  });
})();
