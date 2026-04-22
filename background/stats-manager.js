// WebSuddhi - Enhanced Statistics Manager
// Phase 5: Track network vs cosmetic blocking stats with per-site breakdown

(function() {
  'use strict';

  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  if (!self.WebSuddhi) self.WebSuddhi = {};

  // Logging helpers
  const logError = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    } else {
      console.error('[WebSuddhi]', ...args);
    }
  };

  // In-memory accumulator - flushed to storage every 30 seconds
  let memStats = null;
  let flushTimer = null;
  let dirty = false;

  // Per-hostname selector index: Map<hostname, Map<selector, { count, lastSeen, category }>>
  // Transient (rebuilt on load from stats.perSiteSelectors, lives in memory for fast drawer queries).
  const selectorIndex = new Map();

  const MAX_PER_SITE = 50;
  const MAX_TOP_DOMAINS = 30;
  const MAX_HISTORY_DAYS = 30;
  const MAX_SELECTORS_PER_SITE = 50;

  // ============================================
  // INITIALIZATION
  // ============================================
  async function initStatsManager() {
    await loadStats();
    startFlushTimer();
    setupSuspendListeners();
  }

  async function loadStats() {
    const storage = await getStorage(['stats']);
    memStats = storage.stats || createDefaultStats();

    // Ensure today's entry exists
    const today = getTodayString();
    if (!memStats.today || memStats.today.date !== today) {
      // Archive previous day if exists
      if (memStats.today && memStats.today.date) {
        archiveDay(memStats.today);
      }
      memStats.today = createTodayStats(today);
    }

    // Rebuild in-memory selector index from persisted perSiteSelectors
    selectorIndex.clear();
    const persisted = memStats.today.perSiteSelectors || {};
    for (const [host, selectors] of Object.entries(persisted)) {
      const inner = new Map();
      for (const [sel, meta] of Object.entries(selectors || {})) {
        if (meta && typeof meta === 'object') {
          inner.set(sel, {
            count: meta.count || 0,
            lastSeen: meta.lastSeen || 0,
            category: meta.category || 'ad'
          });
        }
      }
      if (inner.size > 0) selectorIndex.set(host, inner);
    }
  }

  function createDefaultStats() {
    return {
      totalBlocked: 0,
      totalNetworkBlocked: 0,
      totalCosmeticBlocked: 0,
      today: createTodayStats(getTodayString()),
      history: []
    };
  }

  function createTodayStats(date) {
    return {
      date,
      networkBlocked: 0,
      cosmeticBlocked: 0,
      perSite: {},
      topDomains: {},
      perSiteSelectors: {}
    };
  }

  function getTodayString() {
    return new Date().toISOString().slice(0, 10);
  }

  // ============================================
  // RECORDING
  // ============================================
  function reportNetworkBlock(tabId, blockedDomain, initiatorSite) {
    if (!memStats) return;

    ensureToday();

    memStats.totalBlocked++;
    memStats.totalNetworkBlocked++;
    memStats.today.networkBlocked++;

    // Track blocked domain
    if (blockedDomain) {
      const topDomains = memStats.today.topDomains;
      topDomains[blockedDomain] = (topDomains[blockedDomain] || 0) + 1;

      // Trim to top N (trim when over capacity)
      const entries = Object.entries(topDomains);
      if (entries.length > MAX_TOP_DOMAINS) {
        entries.sort((a, b) => b[1] - a[1]);
        memStats.today.topDomains = Object.fromEntries(entries.slice(0, MAX_TOP_DOMAINS));
      }

      // Add to request log
      if (self.WebSuddhi.addLogEntry) {
        self.WebSuddhi.addLogEntry({
          type: 'network',
          url: blockedDomain,
          site: initiatorSite || 'Unknown',
          timestamp: Date.now()
        });
      }
    }

    dirty = true;
  }

  function reportCosmeticBlock(hostname, count, selector, category) {
    if (!memStats) return;

    ensureToday();

    const c = count || 1;
    memStats.totalBlocked += c;
    memStats.totalCosmeticBlocked += c;
    memStats.today.cosmeticBlocked += c;

    // Track per-site
    if (hostname) {
      const perSite = memStats.today.perSite;
      if (!perSite[hostname]) {
        perSite[hostname] = { network: 0, cosmetic: 0 };
      }
      perSite[hostname].cosmetic += c;

      // Trim to top N sites (trim when over capacity)
      const entries = Object.entries(perSite);
      if (entries.length > MAX_PER_SITE) {
        entries.sort((a, b) => (b[1].network + b[1].cosmetic) - (a[1].network + a[1].cosmetic));
        memStats.today.perSite = Object.fromEntries(entries.slice(0, MAX_PER_SITE));
        // Drop selector index entries for sites we no longer track
        const keep = new Set(Object.keys(memStats.today.perSite));
        for (const host of [...selectorIndex.keys()]) {
          if (!keep.has(host)) selectorIndex.delete(host);
        }
      }

      // Update per-hostname selector index
      if (selector) {
        recordSelectorForSite(hostname, selector, c, category);
      }

      // Add to request log (only log first element to avoid flooding)
      if (self.WebSuddhi.addLogEntry && selector) {
        self.WebSuddhi.addLogEntry({
          type: 'cosmetic',
          selector: selector,
          site: hostname,
          category: category || 'ad',
          timestamp: Date.now()
        });
      }
    }

    dirty = true;
  }

  function recordSelectorForSite(hostname, selector, count, category) {
    let inner = selectorIndex.get(hostname);
    if (!inner) {
      inner = new Map();
      selectorIndex.set(hostname, inner);
    }
    const existing = inner.get(selector);
    if (existing) {
      existing.count += count;
      existing.lastSeen = Date.now();
      if (category) existing.category = category;
    } else {
      // Cap per-site selector set to keep memory bounded
      if (inner.size >= MAX_SELECTORS_PER_SITE) {
        // Evict least-recently-seen
        let oldestKey = null;
        let oldestTs = Infinity;
        for (const [key, meta] of inner) {
          if (meta.lastSeen < oldestTs) {
            oldestTs = meta.lastSeen;
            oldestKey = key;
          }
        }
        if (oldestKey) inner.delete(oldestKey);
      }
      inner.set(selector, {
        count,
        lastSeen: Date.now(),
        category: category || 'ad'
      });
    }

    // Mirror into memStats so it flushes to storage
    const persisted = memStats.today.perSiteSelectors || (memStats.today.perSiteSelectors = {});
    const bucket = persisted[hostname] || (persisted[hostname] = {});
    bucket[selector] = {
      count: inner.get(selector).count,
      lastSeen: inner.get(selector).lastSeen,
      category: inner.get(selector).category
    };
  }

  function reportNetworkBlockForSite(hostname, blockedDomain) {
    if (!memStats || !hostname) return;

    ensureToday();

    const perSite = memStats.today.perSite;
    if (!perSite[hostname]) {
      perSite[hostname] = { network: 0, cosmetic: 0 };
    }
    perSite[hostname].network++;

    dirty = true;
  }

  function ensureToday() {
    // Ensure memStats is initialized
    if (!memStats) {
      memStats = createDefaultStats();
    }
    if (!memStats.today) {
      memStats.today = createTodayStats(getTodayString());
      return;
    }
    const today = getTodayString();
    if (memStats.today.date !== today) {
      archiveDay(memStats.today);
      memStats.today = createTodayStats(today);
    }
  }

  function archiveDay(dayStats) {
    if (!dayStats || !dayStats.date) return;
    if (!memStats) return;
    if (!memStats.history) memStats.history = [];

    memStats.history.unshift({
      date: dayStats.date,
      network: dayStats.networkBlocked || 0,
      cosmetic: dayStats.cosmeticBlocked || 0
    });

    // Trim history
    if (memStats.history.length > MAX_HISTORY_DAYS) {
      memStats.history = memStats.history.slice(0, MAX_HISTORY_DAYS);
    }
  }

  // ============================================
  // FLUSH TO STORAGE
  // ============================================
  function startFlushTimer() {
    // Clear existing timer first to prevent duplicates
    if (flushTimer) {
      clearInterval(flushTimer);
    }
    flushTimer = setInterval(() => {
      if (dirty) {
        flushStats();
      }
    }, 30000); // Every 30 seconds
  }

  function stopFlushTimer() {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
  }

  async function flushStats() {
    if (!memStats) return;
    dirty = false;
    try {
      await setStorage({ stats: memStats });
    } catch (err) {
      logError('Failed to flush stats:', err);
    }
  }

  // Setup listeners to flush stats before extension unloads
  function setupSuspendListeners() {
    // MV3: chrome.runtime.onSuspend (service worker about to be stopped)
    if (api.runtime && api.runtime.onSuspend) {
      api.runtime.onSuspend.addListener(() => {
        // Clean up timer
        stopFlushTimer();
        // Flush any pending stats
        if (dirty && memStats) {
          try {
            api.storage.local.set({ stats: memStats });
          } catch (e) {
            // Best effort
          }
        }
      });
    }

    // MV2 / fallback: beforeunload event
    if (typeof self !== 'undefined' && self.addEventListener) {
      self.addEventListener('beforeunload', () => {
        stopFlushTimer();
        if (dirty && memStats) {
          flushStats();
        }
      });
    }
  }

  // ============================================
  // QUERIES
  // ============================================
  function getStats() {
    return memStats || createDefaultStats();
  }

  function getStatsForPeriod(days) {
    if (!memStats) return { network: 0, cosmetic: 0 };

    let network = memStats.today.networkBlocked;
    let cosmetic = memStats.today.cosmeticBlocked;

    const limit = Math.min(days - 1, memStats.history.length);
    for (let i = 0; i < limit; i++) {
      network += memStats.history[i].network;
      cosmetic += memStats.history[i].cosmetic;
    }

    return { network, cosmetic };
  }

  async function resetStats() {
    memStats = createDefaultStats();
    selectorIndex.clear();
    dirty = false;
    await setStorage({ stats: memStats });
    return { success: true };
  }

  function getSiteStats(hostname) {
    if (!memStats || !hostname) return null;
    const entry = memStats.today.perSite?.[hostname];
    if (!entry) return { network: 0, cosmetic: 0 };
    return { network: entry.network || 0, cosmetic: entry.cosmetic || 0 };
  }

  function getSelectorsForSite(hostname, limit) {
    if (!hostname) return [];
    const inner = selectorIndex.get(hostname);
    if (!inner) return [];
    const max = typeof limit === 'number' ? limit : MAX_SELECTORS_PER_SITE;
    return [...inner.entries()]
      .map(([selector, meta]) => ({
        selector,
        count: meta.count,
        lastSeen: meta.lastSeen,
        category: meta.category || 'ad'
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, max);
  }

  async function clearSite(hostname) {
    if (!memStats || !hostname) return { success: false };
    if (memStats.today.perSite && memStats.today.perSite[hostname]) {
      delete memStats.today.perSite[hostname];
    }
    if (memStats.today.perSiteSelectors && memStats.today.perSiteSelectors[hostname]) {
      delete memStats.today.perSiteSelectors[hostname];
    }
    selectorIndex.delete(hostname);
    dirty = true;
    await flushStats();
    return { success: true };
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
  self.WebSuddhi.statsManager = {
    init: initStatsManager,
    reportNetworkBlock,
    reportCosmeticBlock,
    reportNetworkBlockForSite,
    getStats,
    getStatsForPeriod,
    getSiteStats,
    getSelectorsForSite,
    clearSite,
    resetStats,
    flushStats,
    stopFlushTimer
  };

  // Wire up network blocker callback
  self.WebSuddhi.reportNetworkBlock = function(tabId, blockedDomain, initiatorSite) {
    reportNetworkBlock(tabId, blockedDomain, initiatorSite);
  };

  // Auto-init
  initStatsManager().catch(err => {
    logError('stats manager init error:', err);
  });
})();
