/**
 * @module icon
 * @description Extension icon management and phishing-alert blink animation
 * for the WebSuddhi background service worker.
 *
 * Fix issue #3: Replaced `setInterval` / `setTimeout` for icon blinking with
 * `chrome.alarms`, which is reliable in MV3 service workers.
 *
 * @version 2.1.0
 */
'use strict';

// ============================================
// CROSS-BROWSER API
// ============================================

/** @returns {object} @private */
function getApi() {
  if (typeof browser !== 'undefined' && browser?.runtime) return browser;
  if (typeof chrome !== 'undefined' && chrome?.runtime) return chrome;
  return /** @type {*} */ ({});
}

// ============================================
// ICON PATHS
// ============================================

/**
 * Generate icon path objects (16/32/48/128) using `runtime.getURL` for
 * reliable loading in MV3 service workers.
 *
 * @param {boolean} [isAlert=false] - Whether to use the alert-variant icons.
 * @returns {{ 16: string, 32: string, 48: string, 128: string }}
 */
export function getIconPaths(isAlert = false) {
  const suffix = isAlert ? '-alert' : '';
  const api = getApi();
  if (api.runtime?.getURL) {
    return {
      16: api.runtime.getURL(`icons/icon16${suffix}.png`),
      32: api.runtime.getURL(`icons/icon32${suffix}.png`),
      48: api.runtime.getURL(`icons/icon48${suffix}.png`),
      128: api.runtime.getURL(`icons/icon128${suffix}.png`)
    };
  }
  return {
    16: `icons/icon16${suffix}.png`,
    32: `icons/icon32${suffix}.png`,
    48: `icons/icon48${suffix}.png`,
    128: `icons/icon128${suffix}.png`
  };
}

/** Cached normal icon paths. */
export const ICON_PATHS_NORMAL = getIconPaths(false);

/** Cached alert icon paths. */
export const ICON_PATHS_ALERT = getIconPaths(true);

// ============================================
// BLINK STATE
// ============================================

/** @type {string} Alarm-name prefix for icon-blink alarms. */
const BLINK_ALARM_PREFIX = 'iconBlink_';

/** @type {string} Alarm-name prefix for auto-stop alarms. */
const BLINK_STOP_PREFIX = 'iconBlinkStop_';

/** @type {Map<number, boolean>} tabId → current toggle state (`true` = alert shown). */
const blinkState = new Map();

// ============================================
// PUBLIC API
// ============================================

/**
 * Start an icon-blink animation on the given tab.
 * Creates recurring alarms that toggle the icon every ~0.5 min (Chrome
 * minimum) and a one-shot alarm to auto-stop after ~1 min.
 *
 * @param {number} tabId - Tab ID to blink.
 * @returns {void}
 */
export function startIconBlink(tabId) {
  stopIconBlink(tabId);

  const api = getApi();
  blinkState.set(tabId, false);

  if (api.alarms) {
    // Chrome alarms minimum period is 0.5 min — use that
    api.alarms.create(`${BLINK_ALARM_PREFIX}${tabId}`, { periodInMinutes: 0.5 });
    // Auto-stop after ~1 minute
    api.alarms.create(`${BLINK_STOP_PREFIX}${tabId}`, { delayInMinutes: 1 });
  }

  // Immediately show alert icon
  _setIcon(tabId, true);
}

/**
 * Stop an icon-blink animation and reset the icon to normal.
 *
 * @param {number} tabId - Tab ID to stop blinking.
 * @returns {void}
 */
export function stopIconBlink(tabId) {
  const api = getApi();
  blinkState.delete(tabId);

  if (api.alarms) {
    api.alarms.clear(`${BLINK_ALARM_PREFIX}${tabId}`);
    api.alarms.clear(`${BLINK_STOP_PREFIX}${tabId}`);
  }

  _setIcon(tabId, false);
}

/**
 * Handle an alarm event for icon blinking.
 *
 * @param {Object} alarm - `chrome.alarms.Alarm` object.
 * @returns {boolean} `true` if the alarm was handled by this module.
 */
export function handleIconBlinkAlarm(alarm) {
  if (alarm.name.startsWith(BLINK_ALARM_PREFIX)) {
    const tabId = parseInt(alarm.name.slice(BLINK_ALARM_PREFIX.length), 10);
    if (Number.isFinite(tabId) && blinkState.has(tabId)) {
      const current = blinkState.get(tabId);
      blinkState.set(tabId, !current);
      _setIcon(tabId, !current);
    }
    return true;
  }

  if (alarm.name.startsWith(BLINK_STOP_PREFIX)) {
    const tabId = parseInt(alarm.name.slice(BLINK_STOP_PREFIX.length), 10);
    if (Number.isFinite(tabId)) stopIconBlink(tabId);
    return true;
  }

  return false;
}

/**
 * Clear any orphaned icon-blink alarms left over from a previous
 * service-worker session. `blinkState` is in-memory only, so after
 * a restart the alarms would fire forever with no matching state.
 *
 * @returns {void}
 */
export function clearOrphanedBlinkAlarms() {
  const api = getApi();
  if (!api.alarms?.getAll) return;

  api.alarms.getAll((alarms) => {
    for (const alarm of alarms) {
      if (alarm.name.startsWith(BLINK_ALARM_PREFIX) || alarm.name.startsWith(BLINK_STOP_PREFIX)) {
        const tabId = parseInt(
          alarm.name.slice(
            alarm.name.startsWith(BLINK_ALARM_PREFIX)
              ? BLINK_ALARM_PREFIX.length
              : BLINK_STOP_PREFIX.length
          ),
          10
        );
        // If we don't have in-memory state for this tab, the alarm is orphaned
        if (!blinkState.has(tabId)) {
          api.alarms.clear(alarm.name);
        }
      }
    }
  });
}

// ============================================
// INTERNAL
// ============================================

/**
 * Set the extension icon for a tab.
 *
 * @param {number} tabId - Tab ID.
 * @param {boolean} isAlert - Whether to show the alert icon.
 * @returns {void}
 * @private
 */
function _setIcon(tabId, isAlert) {
  const api = getApi();
  const path = isAlert ? ICON_PATHS_ALERT : ICON_PATHS_NORMAL;
  try {
    if (api.action) {
      api.action.setIcon({ tabId, path });
    } else if (api.browserAction) {
      api.browserAction.setIcon({ tabId, path });
    }
  } catch (_e) {
    // Tab might be closed
  }
}
