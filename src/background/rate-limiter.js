/**
 * @module rate-limiter
 * @description Message rate limiter for the WebSuddhi background service worker.
 * Fix issue #3: Replaced `setInterval` for rate limit reset with a simple
 * timestamp-based check that resets counters when the window has elapsed.
 * This avoids keeping a persistent timer alive in the service worker.
 *
 * @version 2.1.0
 */
'use strict';

import {
  RATE_LIMIT_PER_TAB,
  RATE_LIMIT_GLOBAL,
  RATE_LIMIT_WINDOW
} from '../shared/constants.js';

// ============================================
// STATE
// ============================================

/** @type {Map<number, number>} tabId → message count in current window */
const perTab = new Map();

/** @type {number} Global message count in current window */
let globalCount = 0;

/** @type {number} Timestamp of last counter reset */
let lastReset = Date.now();

// ============================================
// PUBLIC API
// ============================================

/**
 * Check whether a message from a given tab should be rate-limited.
 * Automatically resets counters when the rate-limit window has elapsed.
 *
 * @param {number|undefined} tabId - The tab ID sending the message.
 * @returns {boolean} `true` if the message should be dropped, `false` if allowed.
 */
export function isRateLimited(tabId) {
  const now = Date.now();

  // Reset counters if the window has elapsed (replaces setInterval — fix #3)
  if (now - lastReset >= RATE_LIMIT_WINDOW) {
    resetRateLimits();
  }

  // Check global rate limit
  if (globalCount >= RATE_LIMIT_GLOBAL) {
    return true;
  }

  // Check per-tab rate limit
  if (tabId !== undefined) {
    const tabCount = perTab.get(tabId) || 0;
    if (tabCount >= RATE_LIMIT_PER_TAB) {
      return true;
    }
    perTab.set(tabId, tabCount + 1);
    globalCount++;
  }

  return false;
}

/**
 * Reset all rate-limit counters. Called automatically when the window
 * elapses, or can be invoked manually for testing.
 *
 * @returns {void}
 */
export function resetRateLimits() {
  perTab.clear();
  globalCount = 0;
  lastReset = Date.now();
}
