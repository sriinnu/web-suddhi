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

  const MAX_PER_SITE = 50;
  const MAX_TOP_DOMAINS = 30;
  const MAX_HISTORY_DAYS = 30;

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
      topDomains: {}
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

  function reportCosmeticBlock(hostname, count, selector) {
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
      }

      // Add to request log (only log first element to avoid flooding)
      if (self.WebSuddhi.addLogEntry && selector) {
        self.WebSuddhi.addLogEntry({
          type: 'cosmetic',
          selector: selector,
          site: hostname,
          timestamp: Date.now()
        });
      }
    }

    dirty = true;
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
    dirty = false;
    await setStorage({ stats: memStats });
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
