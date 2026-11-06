// WebSuddhi popup: Start-up, event wiring and runtime messages. Loads last.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global api, applySiteState, closePauseMenu, copyCurrentDomain, currentSettings:writable,
   currentTab:writable, elements, featureToggles, fwPending, getActiveHostname, handleReportBroken,
   hideBlockedPanel, isBlacklisted:writable, isWhitelisted:writable, killAllHogs, loadActivity,
   loadFrameCensus, loadPopupTheme, loadSecurityDetails, loadSiteState, logError, openGitHubIssues,
   openOptions, openPauseMenu, pauseForDuration, quickBlacklist, quickWhitelist,
   refreshPauseIndicator, refreshTriStateButtons, relaxCosmetic, removePaywall, renderCounts,
   renderFirewall, reportCurrentSiteAsPhishing, resetFirewall, saveFirewall,
   scheduleActivityRefresh, sendToBackground, setFirewallScope, setSiteState, setTheme,
   showCosmeticStats, showNetworkStats, showToast, toggleAnnoyanceBlocking, toggleCertDetails,
   toggleCookieConsent, toggleEnabled, toggleNetworkBlocking, togglePaywall, togglePickMode,
   toggleScriptlets, toggleSocialBlocking, toggleUrlCleaning, toggleWhitelist, toggleZapMode,
   updateFeatureMeta, updateSecurityInfo, updateUI, updateVerdict */

// ============================================
// START
// ============================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  wireEvents();
  registerRuntimeMessageListener();

  try {
    // Apply saved theme immediately
    await loadPopupTheme();

    // Get current tab
    const tabs = await new Promise((resolve) => {
      api.tabs.query({ active: true, currentWindow: true }, resolve);
    });
    currentTab = tabs[0];

    // Update site display
    if (currentTab?.url) {
      try {
        const url = new URL(currentTab.url);
        if (elements.currentSite) {
          elements.currentSite.textContent = url.hostname;
          elements.currentSite.classList.remove('loading');
        }

        // Update security info
        updateSecurityInfo(url);

        // Get security details (also loads the frame census)
        await loadSecurityDetails();

        // Load tracker summary
        await loadActivity();

        // Load this-site blocking state (protected / default / paused)
        await loadSiteState();
      } catch (e) {
        if (elements.currentSite) {
          elements.currentSite.textContent = 'Unknown site';
          elements.currentSite.classList.remove('loading');
        }
      }
    } else {
      if (elements.currentSite) {
        elements.currentSite.textContent = 'No active tab';
        elements.currentSite.classList.remove('loading');
      }
    }

    // Load settings
    const settingsResponse = await sendToBackground({ type: 'GET_ALL_SETTINGS' });
    const settings = settingsResponse?.settings || {};
    currentSettings = settings;

    // Update UI
    await updateUI(settings, currentTab?.id);

    // Check whitelist status
    if (currentTab?.url) {
      try {
        const hostname = new URL(currentTab.url).hostname;
        const whitelistResponse = await sendToBackground({ type: 'IS_WHITELISTED', hostname });
        isWhitelisted = whitelistResponse?.whitelisted || false;

        // Update button text for whitelist status
        const btnText = elements.whitelistToggleBtn?.querySelector('#whitelistBtnText');
        if (btnText) {
          btnText.textContent = isWhitelisted ? 'Allowed' : 'Whitelist';
        }
      } catch (e) {
        console.error('Whitelist check failed:', e);
      }

      // Refresh pause status + tri-state buttons
      await refreshPauseIndicator();
      await refreshTriStateButtons();
    }

  } catch (e) {
    logError('Init error:', e);
  }
}
// Interaction handlers are wired before any async state fetch so a failed or
// slow background response can never leave the popup unclickable.
function wireEvents() {
  // Set up event listeners
  // Main protection toggle
  elements.enableToggle?.addEventListener('change', toggleEnabled);

  // Feature toggles - use checkbox state after the browser updates it.
  elements.networkBlockingToggle?.addEventListener('change', toggleNetworkBlocking);
  elements.urlCleaningToggle?.addEventListener('change', toggleUrlCleaning);
  elements.cookieConsentToggle?.addEventListener('change', toggleCookieConsent);
  elements.annoyanceToggle?.addEventListener('change', toggleAnnoyanceBlocking);
  elements.paywallToggle?.addEventListener('change', togglePaywall);
  elements.scriptletsToggle?.addEventListener('change', toggleScriptlets);
  elements.socialBlockingToggle?.addEventListener('change', toggleSocialBlocking);
  elements.removePaywallBtn?.addEventListener('click', removePaywall);
  elements.pickModeBtn?.addEventListener('click', togglePickMode);
  elements.zapModeBtn?.addEventListener('click', toggleZapMode);
  elements.openOptionsBtn?.addEventListener('click', () => openOptions());
  elements.reportIssue?.addEventListener('click', (e) => {
    e.preventDefault();
    openGitHubIssues();
  });
  elements.blockedClose?.addEventListener('click', hideBlockedPanel);
  elements.viewAllBlocked?.addEventListener('click', () => openOptions('stats'));
  elements.networkStatBtn?.addEventListener('click', showNetworkStats);
  elements.cosmeticStatBtn?.addEventListener('click', showCosmeticStats);
  elements.copyDomainBtn?.addEventListener('click', copyCurrentDomain);
  elements.reportPhishingBtn?.addEventListener('click', reportCurrentSiteAsPhishing);
  elements.securityMainBtn?.addEventListener('click', toggleCertDetails);
  // Tri-state site actions — clicking an active state clears it
  elements.whitelistBtn?.addEventListener('click', async () => {
    if (isWhitelisted) {
      await toggleWhitelist(); // removes
    } else {
      await quickWhitelist();
    }
    await refreshTriStateButtons();
  });
  elements.blacklistBtn?.addEventListener('click', async () => {
    const host = getActiveHostname();
    if (!host) return;
    if (isBlacklisted) {
      const resp = await sendToBackground({ type: 'REMOVE_DOMAIN_BLOCK', domain: host });
      if (resp?.success) {
        isBlacklisted = false;
        showToast('Unblocked ' + host);
      }
    } else {
      await quickBlacklist();
    }
    await refreshTriStateButtons();
  });
  elements.whitelistToggleBtn?.addEventListener('click', toggleWhitelist);

  // Pause split button — main click opens menu, menu items pause for duration
  elements.pauseBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!elements.pauseMenu) return;
    if (elements.pauseMenu.hidden) openPauseMenu();
    else closePauseMenu();
  });
  elements.pauseMenu?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-duration]');
    if (!btn) return;
    e.stopPropagation();
    pauseForDuration(btn.dataset.duration);
  });
  // Outside click (use mousedown so menu item clicks still resolve) + Escape
  document.addEventListener('mousedown', (e) => {
    if (!elements.pauseMenu || elements.pauseMenu.hidden) return;
    if (e.target.closest('.pause-split')) return;
    closePauseMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePauseMenu();
  });

  elements.pauseResumeBtn?.addEventListener('click', async () => {
    const host = getActiveHostname();
    if (!host) return;
    // RESUME_SITE lifts either kind of pause and keeps "protected".
    const resp = await sendToBackground({ type: 'RESUME_SITE', hostname: host, tabId: currentTab?.id });
    if (resp?.success) {
      applySiteState(resp);
      refreshTriStateButtons();
      showToast('Resumed protection for ' + host);
    } else {
      showToast(resp?.error || 'Failed to resume');
    }
  });
  elements.reportBrokenBtn?.addEventListener('click', handleReportBroken);

  // Protection level and the ladder (these used to be wired a second time
  // in setupEventListeners, so every click ran twice).
  elements.siteStateProtected?.addEventListener('click', () => setSiteState('protected'));
  elements.siteStateDefault?.addEventListener('click', () => setSiteState('default'));
  elements.siteStatePaused?.addEventListener('click', () => setSiteState('paused'));
  elements.actAllowBtn?.addEventListener('click', () => setSiteState('paused'));
  elements.actBlockBtn?.addEventListener('click', () => setSiteState('protected'));
  elements.relaxBtn?.addEventListener('click', async () => {
    await relaxCosmetic();
    elements.relaxBtn.closest('.step')?.classList.add('done');
  });
  elements.killAllHogsBtn?.addEventListener('click', killAllHogs);
  document.getElementById('firewallSave')?.addEventListener('click', saveFirewall);
  document.getElementById('firewallRevert')?.addEventListener('click', () => { fwPending.clear(); renderFirewall(); });
  document.getElementById('firewallReset')?.addEventListener('click', resetFirewall);
  document.getElementById('firewallScope')?.addEventListener('change', (e) => setFirewallScope(e.target.value));
  elements.brokenBtn?.addEventListener('click', () => {
    if (!elements.fixLadder) return;
    const open = elements.fixLadder.hidden;
    elements.fixLadder.hidden = !open;
    elements.brokenBtn.setAttribute('aria-expanded', String(open));
  });

  // Detail tabs, with arrow keys between them.
  const tabs = Array.from(document.querySelectorAll('.tabs [role="tab"]'));
  const selectTab = (tab) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    }
  };
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(next);
      next.focus();
    });
  }

  // Theme: palette dots and the mode segment.
  elements.paletteDots?.addEventListener('click', (e) => {
    const dot = e.target.closest('.dot');
    if (dot) setTheme({ palette: dot.dataset.palette });
  });
  elements.modeSeg?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (btn) setTheme({ colorMode: btn.dataset.mode });
  });

  // Feature count follows the toggles.
  for (const t of featureToggles()) {
    t.addEventListener('change', updateFeatureMeta);
  }
  elements.enableToggle?.addEventListener('change', updateVerdict);
}

function registerRuntimeMessageListener() {
  // Listen for messages from content script or background
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle incoming messages
    // Live frame updates from the background census.
    if (message.type === 'FRAMES_DETECTED' || message.type === 'FRAME_INFO_UPDATED' || message.type === 'CENSUS_UPDATED') {
      loadFrameCensus();
    }

    if (message.type === 'BLOCKED_COUNT_UPDATED' && currentTab?.id && message.tabId === currentTab.id) {
      const total = Number(message.count) || 0;
      const network = Number.isFinite(message.network) ? message.network : total;
      const cosmetic = Number.isFinite(message.cosmetic) ? message.cosmetic : Math.max(0, total - network);
      renderCounts({ count: total, network, cosmetic });
      scheduleActivityRefresh();
    }

    // Return true to indicate async response
    return false;
  });
}
