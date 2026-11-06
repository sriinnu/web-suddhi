// WebSuddhi popup: Toggles, allow/pause controls, pick and zap, options.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global api, currentTab, elements, getStorage, isBlacklisted:writable, isPaused:writable,
   isPickMode:writable, isWhitelisted:writable, isZapMode:writable, loadSiteState,
   pauseCountdownTimer:writable, pauseExpiry:writable, reflectSiteState, sendToBackground,
   sendToContentScript, setButtonContent, setStatusBadgeState, setStorage, showToast, SVG_PATHS */
/* exported applySiteState, closePauseMenu, getActiveHostname, handleReportBroken,
   openGitHubIssues, openOptions, openPauseMenu, pauseForDuration, quickBlacklist, quickWhitelist,
   refreshPauseIndicator, refreshTriStateButtons, removePaywall, toggleAnnoyanceBlocking,
   toggleCookieConsent, toggleEnabled, toggleNetworkBlocking, togglePaywall, togglePickMode,
   toggleScriptlets, toggleSocialBlocking, toggleUrlCleaning, toggleWhitelist, toggleZapMode */

// ============================================
// EVENT HANDLERS
// ============================================

// Toggle main protection
async function toggleEnabled() {
  if (!elements.enableToggle) return;
  const enabled = elements.enableToggle.checked;

  try {
    const response = await sendToBackground({ type: 'TOGGLE_ENABLED', enabled });

    // sendToBackground resolves null when the worker is unreachable; without
    // this check the badge flipped and claimed success while nothing persisted.
    if (!response?.success) {
      elements.enableToggle.checked = !enabled;
      setStatusBadgeState(!enabled);
      showToast('Could not reach the background — try again');
      return;
    }

    // Update status badge
    setStatusBadgeState(enabled);

    // Notify content script IMMEDIATELY
    try {
      await sendToContentScript({ type: 'TOGGLE', enabled });
    } catch (e) {
      console.log('Content script not available');
    }

    showToast(enabled ? 'Protection enabled' : 'Protection disabled');
  } catch (err) {
    elements.enableToggle.checked = !enabled;
    setStatusBadgeState(!enabled);
    showToast('Failed to change protection state');
  }
}

// Toggle features - change event fires after checkbox toggled, so use checked directly
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
  try {
    await sendToBackground({ type: 'TOGGLE_COOKIE_CONSENT', enabled });
  } catch (e) {
    await setStorage({ cookieConsentEnabled: enabled });
    try {
      await sendToContentScript({ type: 'TOGGLE_COOKIE_CONSENT', enabled });
    } catch (innerErr) {}
  }
  showToast(`Cookie blocking ${enabled ? 'enabled' : 'disabled'}`);
}

async function toggleAnnoyanceBlocking() {
  const enabled = elements.annoyanceToggle.checked;
  try {
    await sendToBackground({ type: 'TOGGLE_ANNOYANCE_BLOCKING', enabled });
  } catch (e) {
    await setStorage({ annoyanceBlockingEnabled: enabled });
    try {
      await sendToContentScript({ type: 'TOGGLE_ANNOYANCE_BLOCKING', enabled });
    } catch (innerErr) {}
  }
  showToast(`Annoyance blocking ${enabled ? 'enabled' : 'disabled'}`);
}

async function togglePaywall() {
  const enabled = elements.paywallToggle.checked;
  await sendToBackground({ type: 'TOGGLE_PAYWALL', enabled });
  await sendToContentScript({ type: 'TOGGLE_PAYWALL', enabled });
}

// The background re-registers the in-page scriptlets when this key changes.
async function toggleScriptlets() {
  const enabled = elements.scriptletsToggle.checked;
  try {
    await setStorage({ scriptletsEnabled: enabled });
    showToast(`Video ad fixes ${enabled ? 'on' : 'off'}. Reload the video page.`);
  } catch (e) {
    elements.scriptletsToggle.checked = !enabled;
    showToast('Could not change video ad fixes');
  }
}

async function toggleSocialBlocking() {
  const enabled = elements.socialBlockingToggle.checked;
  await sendToBackground({ type: 'TOGGLE_SOCIAL_BLOCKING', enabled });
  try {
    await sendToContentScript({ type: 'TOGGLE_SOCIAL_BLOCKING', enabled });
  } catch (e) {
    console.log('Content script not available');
  }
  showToast(`Social blocking ${enabled ? 'enabled' : 'disabled'}`);
}

async function toggleWhitelist() {
  if (!currentTab?.url) return;

  const hostname = new URL(currentTab.url).hostname;
  const response = await sendToBackground({ type: 'TOGGLE_WHITELIST', hostname });
  if (!response || response.success === false) {
    showToast(response?.error || 'Failed to change whitelist');
    return;
  }

  isWhitelisted = response.whitelisted;

  // Update UI - update button text
  const btnText = elements.whitelistToggleBtn?.querySelector('#whitelistBtnText');
  if (btnText) {
    btnText.textContent = isWhitelisted ? 'Allowed' : 'Whitelist';
  }

  // Show toast notification
  showToast(isWhitelisted ? `Whitelisted: ${hostname}` : `Removed from whitelist: ${hostname}`);

  // Notify content script IMMEDIATELY with correct message type
  try {
    if (isWhitelisted) {
      await sendToContentScript({ type: 'WHITELIST_SITE', hostname });
    } else {
      await sendToContentScript({ type: 'UNWHITELIST_SITE', hostname });
    }
  } catch (e) {
    console.log('Content script not available');
  }
}

// Quick whitelist from header button
async function quickWhitelist() {
  if (!currentTab?.url) return;

  const hostname = new URL(currentTab.url).hostname;
  const response = await sendToBackground({ type: 'WHITELIST_SITE', hostname });

  if (response?.success) {
    isWhitelisted = true;
    // Update button text
    const btnText = elements.whitelistToggleBtn?.querySelector('#whitelistBtnText');
    if (btnText) {
      btnText.textContent = 'Allowed';
    }
    showToast(`Whitelisted: ${hostname}`);
    // Notify content script IMMEDIATELY using correct message type
    try {
      await sendToContentScript({ type: 'WHITELIST_SITE', hostname });
    } catch (e) {
      console.log('Content script not available');
    }
  } else {
    showToast(response.error || 'Failed to whitelist');
  }
}

function getActiveHostname() {
  if (!currentTab?.url) return '';
  try {
    return new URL(currentTab.url).hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

function formatPauseRemaining(expiryMs) {
  const remaining = expiryMs - Date.now();
  if (remaining <= 0) return '';
  const mins = Math.round(remaining / 60000);
  if (mins < 60) return mins + ' min left';
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? hrs + ' hr left' : hrs + ' hr ' + rem + ' min left';
}

function setPausedVisualState(paused) {
  isPaused = !!paused;
  document.body.classList.toggle('is-paused', isPaused);
  if (elements.pauseBtn) {
    elements.pauseBtn.setAttribute('aria-pressed', String(isPaused));
  }
  if (elements.pauseRibbon) {
    elements.pauseRibbon.hidden = !isPaused;
  }
  if (!isPaused && pauseCountdownTimer) {
    clearInterval(pauseCountdownTimer);
    pauseCountdownTimer = null;
  }
}

function updateRibbonCountdown() {
  if (!isPaused || !elements.pauseRibbonText) return;
  if (!pauseExpiry) {
    // Indefinite pause (set from the Paused button): nothing to count down.
    elements.pauseRibbonText.textContent = 'Blocking is off on ' + (getActiveHostname() || 'this site');
    return;
  }
  const label = formatPauseRemaining(pauseExpiry);
  if (!label) {
    // Expired: re-read the real state so the buttons follow.
    setPausedVisualState(false);
    pauseExpiry = 0;
    refreshTriStateButtons();
    loadSiteState();
    return;
  }
  elements.pauseRibbonText.textContent = 'Paused · ' + label;
}

function startCountdown() {
  if (pauseCountdownTimer) clearInterval(pauseCountdownTimer);
  updateRibbonCountdown();
  pauseCountdownTimer = setInterval(updateRibbonCountdown, 30_000);
}

// The ribbon and the Protected/Default/Paused buttons are two views of one
// background answer (GET_SITE_STATE), so they can no longer disagree.
async function refreshPauseIndicator() {
  return loadSiteState();
}

function applySiteState(resp) {
  const stateValue = (resp && resp.state) || 'default';
  reflectSiteState(stateValue);
  if (stateValue === 'paused') {
    pauseExpiry = resp.pausedUntil || 0;
    setPausedVisualState(true);
    startCountdown();
  } else {
    pauseExpiry = 0;
    setPausedVisualState(false);
  }
}

async function refreshTriStateButtons() {
  const host = getActiveHostname();
  if (!host) return;
  try {
    const storage = await getStorage(['whitelistedSites', 'blockedDomains']);
    const whitelist = Array.isArray(storage.whitelistedSites) ? storage.whitelistedSites : [];
    const blocklist = Array.isArray(storage.blockedDomains) ? storage.blockedDomains : [];
    const bare = (value) => String(value || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
    // Normalize stored entries: older builds saved the raw www. hostname, which
    // never matched this www-stripped comparison.
    isWhitelisted = whitelist.some((entry) => bare(entry) === host);
    isBlacklisted = blocklist.some((entry) => bare(entry) === host);
  } catch (e) {
    // silent
  }
  syncTriStateButtons();
}

function syncTriStateButtons() {
  if (elements.whitelistBtn) {
    elements.whitelistBtn.setAttribute('aria-pressed', String(isWhitelisted));
  }
  if (elements.blacklistBtn) {
    elements.blacklistBtn.setAttribute('aria-pressed', String(isBlacklisted));
  }
  // Allow and Block are mutually exclusive at the UI level; Pause is independent
  if (elements.whitelistBtn) elements.whitelistBtn.disabled = isBlacklisted;
  if (elements.blacklistBtn) elements.blacklistBtn.disabled = isWhitelisted;
}

function closePauseMenu() {
  if (elements.pauseMenu) elements.pauseMenu.hidden = true;
  if (elements.pauseBtn) elements.pauseBtn.setAttribute('aria-expanded', 'false');
}

function openPauseMenu() {
  if (elements.pauseMenu) elements.pauseMenu.hidden = false;
  if (elements.pauseBtn) elements.pauseBtn.setAttribute('aria-expanded', 'true');
}

async function pauseForDuration(durationMs) {
  const host = getActiveHostname();
  if (!host) {
    showToast('No active site');
    return;
  }
  closePauseMenu();
  try {
    const resp = await sendToBackground({
      type: 'PAUSE_SITE',
      hostname: host,
      durationMs: Number(durationMs) || 3_600_000
    });
    if (resp?.success) {
      await loadSiteState();
      showToast('Paused on ' + host);
    } else {
      showToast(resp?.error || 'Failed to pause');
    }
  } catch (e) {
    showToast('Failed to pause');
  }
}

async function handleReportBroken() {
  const host = getActiveHostname();
  if (!host) {
    showToast('No active site to report');
    return;
  }
  const note = window.prompt(
    'Describe what\'s broken on ' + host + ' (optional). We\'ll pause blocking for 1 hour.',
    ''
  );
  if (note === null) return; // user cancelled
  const resp = await sendToBackground({
    type: 'REPORT_BROKEN_SITE',
    hostname: host,
    note: note.trim()
  });
  if (resp?.success) {
    showToast('Thanks — paused for 1 hour on ' + host);
    await refreshPauseIndicator();
  } else {
    showToast(resp?.error || 'Failed to report');
  }
}

// Quick blacklist from header button
async function quickBlacklist() {
  if (!currentTab?.url) return;

  const hostname = new URL(currentTab.url).hostname;
  const response = await sendToBackground({ type: 'ADD_DOMAIN_BLOCK', domain: hostname });

  if (response?.success) {
    showToast(`Blocked: ${hostname}`);
    // Blacklisting doesn't need immediate content script update
    // DNR rules will handle network blocking
    // Cosmetic blocking can be refreshed by reloading
  } else {
    showToast(response.error || 'Failed to block');
  }
}

// ============================================
// PICK MODE (Element Picker)
// ============================================
async function togglePickMode() {
  if (!currentTab?.id) return;

  isPickMode = !isPickMode;

  if (isPickMode) {
    setButtonContent(elements.pickModeBtn, SVG_PATHS.cancel, 'Cancel');
    elements.pickModeBtn.classList.add('active');
    showToast('Pick mode: Click an element or frame to block');
    await sendToContentScript({ type: 'START_PICK_MODE' });
  } else {
    setButtonContent(elements.pickModeBtn, SVG_PATHS.pick, 'Pick element');
    elements.pickModeBtn.classList.remove('active');
    await sendToContentScript({ type: 'STOP_PICK_MODE' });
  }
}

// ============================================
// ZAP MODE (Quick Hide)
// ============================================
async function toggleZapMode() {
  if (!currentTab?.id) return;

  isZapMode = !isZapMode;

  if (isZapMode) {
    setButtonContent(elements.zapModeBtn, SVG_PATHS.cancel, 'Cancel Zap');
    elements.zapModeBtn.classList.add('active');
    showToast('Zap mode: Click an element to hide');
    await sendToContentScript({ type: 'START_ZAP_MODE' });
  } else {
    setButtonContent(elements.zapModeBtn, SVG_PATHS.zap, 'Zap Element');
    elements.zapModeBtn.classList.remove('active');
    await sendToContentScript({ type: 'STOP_ZAP_MODE' });
  }
}

// ============================================
// PAYWALL REMOVAL
// ============================================
async function removePaywall() {
  if (!currentTab?.id) return;

  try {
    const response = await sendToContentScript({ type: 'REMOVE_PAYWALL' });

    if (response && response.success) {
      showToast('Paywall removed');
    } else {
      showToast('Could not remove paywall');
    }
  } catch (e) {
    showToast('Error removing paywall');
  }
}

// ============================================
// OPTIONS & REPORTING
// ============================================
function openOptions(anchor) {
  const url = api.runtime.getURL('options/options.html');
  const targetUrl = anchor ? (url + '#' + anchor) : url;

  if (anchor) {
    if (api.tabs?.create) {
      api.tabs.create({ url: targetUrl });
    } else {
      window.open(targetUrl, '_blank');
    }
    return;
  }

  if (api.runtime.openOptionsPage) {
    api.runtime.openOptionsPage();
    return;
  }

  if (api.tabs?.create) {
    api.tabs.create({ url: targetUrl });
  } else {
    window.open(targetUrl, '_blank');
  }
}

function openGitHubIssues() {
  api.tabs.create({ url: 'https://github.com/sriinnu/web-suddhi/issues' });
}
