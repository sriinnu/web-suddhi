/**
 * @module stats
 * @description Blocking-statistics bridge for the WebSuddhi background
 * service worker. Delegates to `stats-manager` when available and provides
 * backwards-compatible fallback helpers.
 *
 * Fix issue #6 / #13: Removed duplicate `tabBlockedCounts` map — network
 * blocked counts are now exclusively owned by the `network-blocker` module.
 *
 * Fix issue #26: Removed dead `getNetworkBlockedCount` from background;
 * callers should use `networkBlocker.getNetworkBlockedCount()`.
 *
 * @version 2.1.0
 */
'use strict';

import { DEFAULT_SETTINGS } from '../shared/constants.js';
import { getStorage, setStorage } from '../shared/storage.js';
import * as statsManager from './stats-manager.js';

// ============================================
// PUBLIC API
// ============================================

/**
 * Get aggregated blocking statistics.
 *
 * @param {number} [days=1] - Number of days to include.
 * @returns {Promise<{ success: boolean, stats: Object }>}
 */
export async function getStats(_days = 1) {
  const sm = statsManager.getStats();
  if (sm) return { success: true, stats: sm };

  const storage = await getStorage(['stats']);
  return { success: true, stats: storage.stats || { totalBlocked: 0, perSite: {} } };
}

/**
 * Get stats aggregated over a specific number of days.
 *
 * @param {number} [days=1] - Number of days.
 * @returns {Promise<{ success: boolean, stats: Object }>}
 */
export async function getStatsForPeriod(days = 1) {
  const period = statsManager.getStatsForPeriod(days);
  if (period) return { success: true, stats: period };

  return getStats(days);
}

/**
 * Reset all blocking statistics.
 *
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function resetStats() {
  await statsManager.resetStats();
  return { success: true, message: 'Stats reset' };
}

/**
 * Increment blocking statistics for a hostname.
 *
 * @param {string} hostname - The site hostname.
 * @param {number} [count=1] - Number of blocks to add.
 * @returns {Promise<{ success: boolean }>}
 */
export async function incrementStats(hostname, count) {
  // stats-manager handles in-memory accumulation
  // Also update performance stats as a side-effect
  await updatePerformanceStats(count || 1);
  return { success: true };
}

/**
 * Update the performance-stats aggregate in storage.
 *
 * @param {number} [count=1] - Number of blocks to add.
 * @returns {Promise<void>}
 */
export async function updatePerformanceStats(count = 1) {
  try {
    const storage = await getStorage(['performanceStats']);
    let stats = storage.performanceStats;

    if (!stats || typeof stats !== 'object') {
      stats = { ...DEFAULT_SETTINGS.performanceStats };
    }

    stats.totalBlocked = (stats.totalBlocked || 0) + count;

    const today = new Date().toDateString();
    if (!stats.today || stats.today.date !== today) {
      stats.today = { date: today, blocked: count, topDomains: {}, perSite: {} };
    } else {
      stats.today.blocked = (stats.today.blocked || 0) + count;
    }

    await setStorage({ performanceStats: stats });
  } catch (err) {
    console.error('[WebSuddhi] Failed to update performance stats:', err);
  }
}

/**
 * Retrieve the current performance-stats object.
 *
 * @returns {Promise<{ success: boolean, performanceStats: Object }>}
 */
export async function getPerformanceStats() {
  try {
    const storage = await getStorage(['performanceStats']);
    return {
      success: true,
      performanceStats: storage.performanceStats || DEFAULT_SETTINGS.performanceStats
    };
  } catch (_e) {
    return { success: true, performanceStats: DEFAULT_SETTINGS.performanceStats };
  }
}
