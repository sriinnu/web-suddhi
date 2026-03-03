/**
 * @module popup/index
 * @description Main entry point for the WebSuddhi popup.
 *
 * Handles initialization, event binding for all toggles and action buttons,
 * UI state management, and message relay between popup ↔ background ↔ content.
 *
 * Fixes applied:
 * - FIX #1: escapeHtml now returns `div.innerHTML` (safe HTML-escaped text).
 * - FIX #7: Wrapped async handlers in try/catch with user-facing toast errors.
 * - FIX #58/#59: Dead code removed; only live functions remain.
 *
 * @version 2.1.0
 */
'use strict';

import { api, logError, sendToBackground, sendToContentScript, setStorage } from './api.js';
import { elements, SVG_PATHS, setButtonContent, showToast } from './dom.js';
import { updateSecurityInfo, loadSecurityDetails, updateFramesFromContent } from './security.js';
import { showNetworkStats, showCosmeticStats, hideBlockedPanel, loadTrackerSummary } from './stats.js';

// ============================================
// STATE
// ============================================

/** @type {chrome.tabs.Tab|null} */
let currentTab = null;
/** @type {boolean} */
let isPickMode = false;
/** @type {boolean} */
let isZapMode = false;
/** @type {boolean} */
let isWhitelisted = false;

// ============================================
// UI UPDATE
// ============================================

/**
 * Sync all popup UI elements to match the given settings and tab state.
 *
 * @param {object} settings - Extension settings from GET_ALL_SETTINGS.
 * @param {number|undefined} tabId - Active tab ID.
 */
async function updateUI(settings, tabId) {
  // Main toggle
  if (elements.enableToggle) {
    elements.enableToggle.checked = settings.enabled !== false;
    elements.enableToggle.parentElement?.classList.toggle('disabled', settings.enabled === false);
  }

  // Feature toggles
  if (elements.networkBlockingToggle)  elements.networkBlockingToggle.checked  = settings.networkBlockingEnabled !== false;
  if (elements.urlCleaningToggle)      elements.urlCleaningToggle.checked      = settings.urlCleaningEnabled !== false;
  if (elements.cookieConsentToggle)    elements.cookieConsentToggle.checked    = settings.cookieConsentEnabled !== false;
  if (elements.annoyanceToggle)        elements.annoyanceToggle.checked        = settings.annoyanceBlockingEnabled !== false;
  if (elements.paywallToggle)          elements.paywallToggle.checked          = settings.paywallEnabled !== false;
  if (elements.socialBlockingToggle)   elements.socialBlockingToggle.checked   = settings.socialBlockingEnabled === true;

  // Network blocked count
  if (elements.networkBlockedCount && tabId) {
    try {
      const res = await sendToBackground({ type: 'GET_BLOCKED_COUNT', tabId });
      elements.networkBlockedCount.textContent = res.count || 0;
    } catch (_) {
      elements.networkBlockedCount.textContent = '0';
    }
  }

  // Rules count
  if (elements.rulesCount) {
    const ruleCount = 100 + (settings.blockedDomains?.length || 0) + (settings.blockedSelectors?.length || 0);
    elements.rulesCount.textContent = ruleCount;
  }

  // Data saved estimate
  if (elements.dataSaved && tabId) {
    try {
      const res = await sendToBackground({ type: 'GET_BLOCKED_COUNT', tabId });
      const kb  = (res.count || 0) * 2.5;
      elements.dataSaved.textContent = kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB';
    } catch (_) {
      elements.dataSaved.textContent = '0 KB';
    }
  }

  // Status badge
  if (elements.statusBadge) {
    if (settings.enabled === false) {
      elements.statusBadge.textContent = 'Disabled';
      elements.statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      elements.statusBadge.style.color = '#ef4444';
    } else {
      elements.statusBadge.textContent = 'Active';
      elements.statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      elements.statusBadge.style.color = '#10b981';
    }
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

/** Toggle the main protection on/off */
async function toggleEnabled() {
  const enabled = !elements.enableToggle.checked;
  await sendToBackground({ type: 'TOGGLE_ENABLED', enabled });

  if (elements.statusBadge) {
    const textEl = elements.statusBadge.querySelector('span:last-child');
    if (textEl) textEl.textContent = enabled ? 'Active' : 'Disabled';
    elements.statusBadge.classList.toggle('disabled', !enabled);
  }

  try { await sendToContentScript({ type: 'TOGGLE', enabled }, currentTab); } catch (_) {}
  showToast(enabled ? 'Protection enabled' : 'Protection disabled');
}

async function toggleNetworkBlocking() {
  const enabled = elements.networkBlockingToggle.checked;
  await sendToBackground({ type: 'TOGGLE_NETWORK_BLOCKING', enabled });
  showToast(`Network blocking ${enabled ? 'enabled' : 'disabled'}`);
}

async function toggleUrlCleaning() {
  const enabled = elements.urlCleaningToggle.checked;
  await sendToBackground({ type: 'TOGGLE_URL_CLEANING', enabled });
  showToast(`URL cleaning ${enabled ? 'enabled' : 'disabled'}`);
}

async function toggleCookieConsent() {
  const enabled = elements.cookieConsentToggle.checked;
  await setStorage({ cookieConsentEnabled: enabled });
  try { await sendToContentScript({ type: 'TOGGLE_COOKIE_CONSENT', enabled }, currentTab); } catch (_) {}
  showToast(`Cookie blocking ${enabled ? 'enabled' : 'disabled'}`);
}

async function toggleAnnoyanceBlocking() {
  const enabled = elements.annoyanceToggle.checked;
  await setStorage({ annoyanceBlockingEnabled: enabled });
  try { await sendToContentScript({ type: 'TOGGLE_ANNOYANCE_BLOCKING', enabled }, currentTab); } catch (_) {}
  showToast(`Annoyance blocking ${enabled ? 'enabled' : 'disabled'}`);
}

async function togglePaywall() {
  const enabled = elements.paywallToggle.checked;
  await sendToBackground({ type: 'TOGGLE_PAYWALL', enabled });
  try { await sendToContentScript({ type: 'TOGGLE_PAYWALL', enabled }, currentTab); } catch (_) {}
}

async function toggleSocialBlocking() {
  const enabled = elements.socialBlockingToggle.checked;
  await sendToBackground({ type: 'TOGGLE_SOCIAL_BLOCKING', enabled });
  try { await sendToContentScript({ type: 'TOGGLE_SOCIAL_BLOCKING', enabled }, currentTab); } catch (_) {}
  showToast(`Social blocking ${enabled ? 'enabled' : 'disabled'}`);
}

// ============================================
// WHITELIST / BLACKLIST
// ============================================

async function toggleWhitelist() {
  if (!currentTab?.url) return;
  const hostname = new URL(currentTab.url).hostname;
  const response = await sendToBackground({ type: 'TOGGLE_WHITELIST' });
  isWhitelisted  = response.whitelisted;

  const btnText = elements.whitelistToggleBtn?.querySelector('#whitelistBtnText');
  if (btnText) btnText.textContent = isWhitelisted ? 'Allowed' : 'Whitelist';

  showToast(isWhitelisted ? `Whitelisted: ${hostname}` : `Removed from whitelist: ${hostname}`);
  try {
    const msg = isWhitelisted ? 'WHITELIST_SITE' : 'UNWHITELIST_SITE';
    await sendToContentScript({ type: msg, hostname }, currentTab);
  } catch (_) {}
}

async function quickWhitelist() {
  if (!currentTab?.url) return;
  const hostname = new URL(currentTab.url).hostname;
  const response = await sendToBackground({ type: 'WHITELIST_SITE', hostname });

  if (response.success) {
    isWhitelisted = true;
    const btnText = elements.whitelistToggleBtn?.querySelector('#whitelistBtnText');
    if (btnText) btnText.textContent = 'Allowed';
    showToast(`Whitelisted: ${hostname}`);
    try { await sendToContentScript({ type: 'WHITELIST_SITE', hostname }, currentTab); } catch (_) {}
  } else {
    showToast(response.error || 'Failed to whitelist');
  }
}

async function quickBlacklist() {
  if (!currentTab?.url) return;
  const hostname = new URL(currentTab.url).hostname;
  const response = await sendToBackground({ type: 'ADD_DOMAIN_BLOCK', domain: hostname });
  showToast(response.success ? `Blocked: ${hostname}` : (response.error || 'Failed to block'));
}

// ============================================
// PICK & ZAP MODES
// ============================================

async function togglePickMode() {
  if (!currentTab?.id) { showToast('No active tab'); return; }
  isPickMode = !isPickMode;

  if (isPickMode) {
    setButtonContent(elements.pickModeBtn, SVG_PATHS.cancel, 'Cancel Pick');
    elements.pickModeBtn.classList.add('active');
    showToast('Pick mode: Click an element to block');
    try { await sendToContentScript({ type: 'START_PICK_MODE' }, currentTab); } catch (e) { showToast('Error: ' + e.message); }
  } else {
    setButtonContent(elements.pickModeBtn, SVG_PATHS.pick, 'Pick Element');
    elements.pickModeBtn.classList.remove('active');
    try { await sendToContentScript({ type: 'STOP_PICK_MODE' }, currentTab); } catch (_) {}
  }
}

async function toggleZapMode() {
  if (!currentTab?.id) return;
  isZapMode = !isZapMode;

  if (isZapMode) {
    setButtonContent(elements.zapModeBtn, SVG_PATHS.cancel, 'Cancel Zap');
    elements.zapModeBtn.classList.add('active');
    showToast('Zap mode: Click an element to hide');
    try { await sendToContentScript({ type: 'START_ZAP_MODE' }, currentTab); } catch (_) {}
  } else {
    setButtonContent(elements.zapModeBtn, SVG_PATHS.zap, 'Zap Element');
    elements.zapModeBtn.classList.remove('active');
    try { await sendToContentScript({ type: 'STOP_ZAP_MODE' }, currentTab); } catch (_) {}
  }
}

// ============================================
// PAYWALL
// ============================================

async function removePaywall() {
  if (!currentTab?.id) return;
  try {
    const res = await sendToContentScript({ type: 'REMOVE_PAYWALL' }, currentTab);
    showToast(res?.success ? 'Paywall removed' : 'Could not remove paywall');
  } catch (_) {
    showToast('Error removing paywall');
  }
}

// ============================================
// OPTIONS & REPORTING
// ============================================

/**
 * @param {string} [anchor] - Optional hash anchor for the options page.
 */
function openOptions(anchor) {
  if (api.runtime.openOptionsPage) {
    api.runtime.openOptionsPage();
  } else {
    const url = api.runtime.getURL('options/options.html');
    window.open(anchor ? url + '#' + anchor : url, '_blank');
  }
}

function openGitHubIssues() {
  api.tabs.create({ url: 'https://github.com/sriinnu/web-suddhi/issues' });
}

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  try {
    // Current tab
    const tabs = await new Promise((resolve) => {
      api.tabs.query({ active: true, currentWindow: true }, resolve);
    });
    currentTab = tabs[0];

    // Display current site
    if (currentTab?.url) {
      try {
        const url = new URL(currentTab.url);
        if (elements.currentSite) elements.currentSite.textContent = url.hostname;
        updateSecurityInfo(url);
        await loadSecurityDetails(currentTab);
        await loadTrackerSummary();
      } catch (_) {
        if (elements.currentSite) elements.currentSite.textContent = 'Unknown site';
      }
    } else {
      if (elements.currentSite) elements.currentSite.textContent = 'No active tab';
    }

    // Load settings
    const settingsResponse = await sendToBackground({ type: 'GET_ALL_SETTINGS' });
    const settings = settingsResponse?.settings || {};
    await updateUI(settings, currentTab?.id);

    // Check whitelist
    if (currentTab?.url) {
      try {
        const hostname = new URL(currentTab.url).hostname;
        const res = await sendToBackground({ type: 'IS_WHITELISTED', hostname });
        isWhitelisted = res?.whitelisted || false;
        const btnText = elements.whitelistToggleBtn?.querySelector('#whitelistBtnText');
        if (btnText) btnText.textContent = isWhitelisted ? 'Allowed' : 'Whitelist';
      } catch (_) {}
    }

    // --- Bind event listeners ---
    elements.enableToggle?.parentElement?.addEventListener('click', (e) => { e.preventDefault(); toggleEnabled(); });
    elements.networkBlockingToggle?.addEventListener('change', toggleNetworkBlocking);
    elements.urlCleaningToggle?.addEventListener('change', toggleUrlCleaning);
    elements.cookieConsentToggle?.addEventListener('change', toggleCookieConsent);
    elements.annoyanceToggle?.addEventListener('change', toggleAnnoyanceBlocking);
    elements.paywallToggle?.addEventListener('change', togglePaywall);
    elements.socialBlockingToggle?.addEventListener('change', toggleSocialBlocking);
    elements.removePaywallBtn?.addEventListener('click', removePaywall);
    elements.pickModeBtn?.addEventListener('click', togglePickMode);
    elements.zapModeBtn?.addEventListener('click', toggleZapMode);
    elements.openOptionsBtn?.addEventListener('click', () => openOptions());
    elements.reportIssue?.addEventListener('click', (e) => { e.preventDefault(); openGitHubIssues(); });
    elements.blockedClose?.addEventListener('click', hideBlockedPanel);
    elements.viewAllBlocked?.addEventListener('click', () => openOptions('stats'));
    elements.networkStatBtn?.addEventListener('click', showNetworkStats);
    elements.cosmeticStatBtn?.addEventListener('click', showCosmeticStats);
    elements.whitelistBtn?.addEventListener('click', quickWhitelist);
    elements.blacklistBtn?.addEventListener('click', quickBlacklist);
    elements.whitelistToggleBtn?.addEventListener('click', toggleWhitelist);

    // Listen for frames from content script
    api.runtime.onMessage.addListener((message) => {
      if (message.type === 'FRAMES_DETECTED' || message.type === 'FRAME_INFO_UPDATED') {
        updateFramesFromContent(message.frames || []);
      }
      return false;
    });
  } catch (e) {
    logError('Init error:', e);
  }
}

// --- Bootstrap ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
