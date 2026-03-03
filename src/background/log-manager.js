/**
 * @module log-manager
 * @description Batched request-log manager for the WebSuddhi background
 * service worker.
 *
 * Fix issue #22: Log entries are now batched in an in-memory queue and
 * flushed periodically instead of one storage write per entry.
 *
 * Fix issue #3 / #4: Uses `chrome.alarms` for periodic flushing instead
 * of `setInterval`, which is unreliable in MV3 service workers.
 *
 * @version 2.1.0
 */
'use strict';

import { MAX_LOG_ENTRIES } from '../shared/constants.js';
import { getStorage, setStorage } from '../shared/storage.js';

// ============================================
// CONSTANTS
// ============================================

/** @type {string} Alarm name for periodic log flushes. */
const LOG_FLUSH_ALARM = 'websuddhi-logFlush';

/** @type {number} Flush interval in minutes for chrome.alarms (≈10 s, clamped to 0.5 min by Chrome). */
const FLUSH_INTERVAL_MINUTES = 0.5;

// ============================================
// STATE
// ============================================

/** @type {Array<Object>} In-memory queue of pending log entries. */
let pendingEntries = [];

// ============================================
// PUBLIC API
// ============================================

/**
 * Queue a log entry. It will be persisted on the next flush.
 *
 * @param {Object} entry - Log entry with at least `{ type, url|selector, site }`.
 * @returns {{ success: boolean, skipped?: boolean, error?: string }}
 */
export function addLogEntry(entry) {
  if (!entry) return { success: false, error: 'No entry provided' };

  if (!entry.timestamp) {
    entry.timestamp = Date.now();
  }

  pendingEntries.push(entry);
  return { success: true };
}

/**
 * Flush all pending log entries to `chrome.storage.local`.
 * Called by the alarm handler or before extension suspension.
 *
 * @returns {Promise<void>}
 */
export async function flushLogEntries() {
  if (pendingEntries.length === 0) return;

  const batch = pendingEntries.splice(0);

  try {
    const storage = await getStorage(['requestLog', 'loggingEnabled']);
    if (storage.loggingEnabled === false) return;

    const log = storage.requestLog || [];
    log.push(...batch);

    // Trim to MAX_LOG_ENTRIES (keep newest)
    while (log.length > MAX_LOG_ENTRIES) {
      log.shift();
    }

    await setStorage({ requestLog: log });
  } catch (err) {
    // Put entries back so they aren't lost
    pendingEntries.unshift(...batch);
    console.error('[WebSuddhi] Failed to flush log entries:', err);
  }
}

/**
 * Retrieve the full request log from storage.
 *
 * @returns {Promise<Array<Object>>}
 */
export async function getRequestLog() {
  const storage = await getStorage(['requestLog']);
  return storage.requestLog || [];
}

/**
 * Clear the persisted request log and any pending entries.
 *
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function clearRequestLog() {
  pendingEntries = [];
  await setStorage({ requestLog: [] });
  return { success: true, message: 'Request log cleared' };
}

/**
 * Create the periodic flush alarm.
 * @deprecated Alarms are now created centrally in background/index.js
 * with the canonical name 'websuddhi-log-flush'. This function is
 * retained for backward-compat but should not be called.
 *
 * @returns {void}
 */
export function setupLogAlarm() {
  // No-op: alarm created in background/index.js
}

/**
 * Handle an alarm event — flush if the alarm name matches.
 *
 * @param {Object} alarm - chrome.alarms.Alarm object.
 * @returns {boolean} `true` if the alarm was handled.
 */
export function handleLogAlarm(alarm) {
  if (alarm.name === LOG_FLUSH_ALARM) {
    flushLogEntries();
    return true;
  }
  return false;
}
