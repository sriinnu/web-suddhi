/**
 * @module stats-manager
 * @description Enhanced statistics manager for tracking network vs cosmetic
 * blocking with per-site breakdown and history archival.
 *
 * Fix issue #3 / #4: Replaced `setInterval(flushStats, 30000)` with
 * `chrome.alarms` for reliable periodic flushing in MV3 service workers.
 *
 * Fix issue #4: Removed async storage write in `onSuspend` handler —
 * we rely on frequent alarm-based flushes instead.
 *
 * Fix issue #30: Removed dead `beforeunload` listener (not relevant in
 * MV3 service workers).
 *
 * @version 2.1.0
 */
'use strict';

import { getStorage, setStorage } from '../shared/storage.js';
import { addLogEntry } from './log-manager.js';

// ============================================
// CONSTANTS
// ============================================

const MAX_PER_SITE = 50;
const MAX_TOP_DOMAINS = 30;
const MAX_HISTORY_DAYS = 30;

/** @type {string} Alarm name for periodic stat flushes. */
const STATS_FLUSH_ALARM = 'websuddhi-statsFlush';

/** @type {number} Flush period in minutes (Chrome minimum is 0.5). */
const FLUSH_PERIOD_MINUTES = 0.5;

// ============================================
// STATE
// ============================================

/** @type {Object|null} In-memory stats accumulator. */
let memStats = null;

/** @type {boolean} Whether memStats has unflushed changes. */
let dirty = false;

// ============================================
// INITIALISATION
// ============================================

/**
 * Initialise the stats manager — load from storage.
 * Note: Flush alarms are created centrally in background/index.js
 * with the canonical name 'websuddhi-stats-flush'.
 *
 * @returns {Promise<void>}
 */
export async function initStatsManager() {
  await loadStats();
}

/**
 * Load stats from storage into memory.
 *
 * @returns {Promise<void>}
 * @private
 */
async function loadStats() {
  const storage = await getStorage(['stats']);
  memStats = storage.stats || createDefaultStats();

  const today = getTodayString();
  if (!memStats.today || memStats.today.date !== today) {
    if (memStats.today?.date) archiveDay(memStats.today);
    memStats.today = createTodayStats(today);
  }
}

/** @returns {Object} @private */
function createDefaultStats() {
  return {
    totalBlocked: 0,
    totalNetworkBlocked: 0,
    totalCosmeticBlocked: 0,
    today: createTodayStats(getTodayString()),
    history: []
  };
}

/**
 * @param {string} date
 * @returns {Object}
 * @private
 */
function createTodayStats(date) {
  return { date, networkBlocked: 0, cosmeticBlocked: 0, perSite: {}, topDomains: {} };
}

/** @returns {string} @private */
function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

// ============================================
// RECORDING
// ============================================

/**
 * Record a network block event.
 *
 * @param {number} tabId - Tab ID.
 * @param {string} blockedDomain - Blocked hostname.
 * @param {string} [initiatorSite] - Originating site hostname.
 * @returns {void}
 */
export function reportNetworkBlock(tabId, blockedDomain, initiatorSite) {
  if (!memStats) return;
  ensureToday();

  memStats.totalBlocked++;
  memStats.totalNetworkBlocked++;
  memStats.today.networkBlocked++;

  if (blockedDomain) {
    const td = memStats.today.topDomains;
    td[blockedDomain] = (td[blockedDomain] || 0) + 1;

    const entries = Object.entries(td);
    if (entries.length > MAX_TOP_DOMAINS) {
      entries.sort((a, b) => b[1] - a[1]);
      memStats.today.topDomains = Object.fromEntries(entries.slice(0, MAX_TOP_DOMAINS));
    }

    addLogEntry({
      type: 'network',
      url: blockedDomain,
      site: initiatorSite || 'Unknown',
      timestamp: Date.now()
    });
  }

  dirty = true;
}

/**
 * Record a cosmetic (element-hiding) block event.
 *
 * @param {string} hostname - Page hostname.
 * @param {number} [count=1] - Elements blocked.
 * @param {string} [selector] - CSS selector used.
 * @returns {void}
 */
export function reportCosmeticBlock(hostname, count, selector) {
  if (!memStats) return;
  ensureToday();

  const c = count || 1;
  memStats.totalBlocked += c;
  memStats.totalCosmeticBlocked += c;
  memStats.today.cosmeticBlocked += c;

  if (hostname) {
    const ps = memStats.today.perSite;
    if (!ps[hostname]) ps[hostname] = { network: 0, cosmetic: 0 };
    ps[hostname].cosmetic += c;

    const entries = Object.entries(ps);
    if (entries.length > MAX_PER_SITE) {
      entries.sort((a, b) => (b[1].network + b[1].cosmetic) - (a[1].network + a[1].cosmetic));
      memStats.today.perSite = Object.fromEntries(entries.slice(0, MAX_PER_SITE));
    }

    if (selector) {
      addLogEntry({ type: 'cosmetic', selector, site: hostname, timestamp: Date.now() });
    }
  }

  dirty = true;
}

/**
 * Record per-site network block.
 *
 * @param {string} hostname - Page hostname.
 * @param {string} blockedDomain - Blocked domain.
 * @returns {void}
 */
export function reportNetworkBlockForSite(hostname, _blockedDomain) {
  if (!memStats || !hostname) return;
  ensureToday();

  const ps = memStats.today.perSite;
  if (!ps[hostname]) ps[hostname] = { network: 0, cosmetic: 0 };
  ps[hostname].network++;
  dirty = true;
}

/** @private */
function ensureToday() {
  if (!memStats) memStats = createDefaultStats();
  if (!memStats.today) { memStats.today = createTodayStats(getTodayString()); return; }
  const today = getTodayString();
  if (memStats.today.date !== today) {
    archiveDay(memStats.today);
    memStats.today = createTodayStats(today);
  }
}

/**
 * @param {Object} dayStats
 * @private
 */
function archiveDay(dayStats) {
  if (!dayStats?.date || !memStats) return;
  if (!memStats.history) memStats.history = [];
  memStats.history.unshift({
    date: dayStats.date,
    network: dayStats.networkBlocked || 0,
    cosmetic: dayStats.cosmeticBlocked || 0
  });
  if (memStats.history.length > MAX_HISTORY_DAYS) {
    memStats.history = memStats.history.slice(0, MAX_HISTORY_DAYS);
  }
}

// ============================================
// FLUSH (alarm-based — fix #3 / #4)
// ============================================

/** @private */
function setupFlushAlarm() {
  const api = (typeof browser !== 'undefined' && browser?.runtime) ? browser : chrome;
  if (api.alarms) {
    api.alarms.create(STATS_FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MINUTES });
  }
}

/**
 * Flush in-memory stats to storage. Called by alarm handler.
 *
 * @returns {Promise<void>}
 */
export async function flushStats() {
  if (!memStats || !dirty) return;
  dirty = false;
  try {
    await setStorage({ stats: memStats });
  } catch (err) {
    dirty = true; // retry on next alarm
    console.error('[WebSuddhi] Failed to flush stats:', err);
  }
}

/**
 * Handle an alarm event — flush if the alarm name matches.
 *
 * @param {Object} alarm - chrome.alarms.Alarm.
 * @returns {boolean} `true` if handled.
 */
export function handleStatsAlarm(alarm) {
  if (alarm.name === STATS_FLUSH_ALARM) {
    flushStats();
    return true;
  }
  return false;
}

// ============================================
// QUERIES
// ============================================

/**
 * Get current in-memory stats snapshot.
 *
 * @returns {Object} Stats object.
 */
export function getStats() {
  return memStats || createDefaultStats();
}

/**
 * Get stats aggregated over a specific period.
 *
 * @param {number} days - Number of days to include.
 * @returns {{ network: number, cosmetic: number }}
 */
export function getStatsForPeriod(days) {
  if (!memStats) return { network: 0, cosmetic: 0 };

  let network = memStats.today?.networkBlocked || 0;
  let cosmetic = memStats.today?.cosmeticBlocked || 0;

  const limit = Math.min((days || 1) - 1, (memStats.history || []).length);
  for (let i = 0; i < limit; i++) {
    network += memStats.history[i].network;
    cosmetic += memStats.history[i].cosmetic;
  }

  return { network, cosmetic };
}

/**
 * Reset all statistics.
 *
 * @returns {Promise<{ success: boolean }>}
 */
export async function resetStats() {
  memStats = createDefaultStats();
  dirty = false;
  await setStorage({ stats: memStats });
  return { success: true };
}
