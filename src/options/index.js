/**
 * @module options/index
 * @description Entry point for the WebSuddhi options page.
 *
 * Handles initialization, event binding for all settings toggles,
 * filter-list management, import/export, and navigation.
 *
 * Fixes applied:
 * - FIX #1:  escapeHtml now returns `div.innerHTML` (safe).
 * - FIX #25: CSS --accent-color documented; hard-coded fallback on bar-fills.
 * - FIX #26: Settings changes now notify the background via sendMessage.
 *
 * @version 2.1.0
 */
'use strict';

import { api, setStorage, sendMessage, logError } from './api.js';
import { elements, clearElement, showToast, showStatus } from './dom.js';
import {
  loadSettings, loadTheme, applyTheme, updateThemeButtons,
  loadRules, loadWhitelist, loadStats, loadPerformanceStats,
  loadFilterLists, loadRequestLog, createWhitelistItem,
  startLogPolling, stopLogPolling, loggingEnabled,
} from './data.js';

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  try {
    await Promise.all([
      loadSettings(),
      loadTheme(),
      loadRules(),
      loadWhitelist(),
      loadStats(),
      loadFilterLists(),
      loadRequestLog(),
      loadPerformanceStats(),
    ]);
    setupEventListeners();
    if (loggingEnabled) startLogPolling();
  } catch (err) {
    logError('Options init error:', err);
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // --- Theme ---
  if (elements.themeToggle) {
    elements.themeToggle.addEventListener('click', async () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      applyTheme(newTheme);
      await setStorage({ theme: newTheme });
    });
  }
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      updateThemeButtons(theme);
      await setStorage({ theme });
    });
  });

  // --- Protection toggles (FIX #26: also notify background) ---
  elements.enableProtection?.addEventListener('change', async () => {
    const enabled = elements.enableProtection.checked;
    await setStorage({ enabled });
    try { await sendMessage({ type: 'TOGGLE_ENABLED', enabled }); } catch (_) {}
  });
  elements.enablePaywall?.addEventListener('change', async () => {
    const enabled = elements.enablePaywall.checked;
    await setStorage({ paywallEnabled: enabled });
    try { await sendMessage({ type: 'TOGGLE_PAYWALL', enabled }); } catch (_) {}
  });
  elements.enableNetworkBlocking?.addEventListener('change', async () => {
    const enabled = elements.enableNetworkBlocking.checked;
    await setStorage({ networkBlockingEnabled: enabled });
    try { await sendMessage({ type: 'TOGGLE_NETWORK_BLOCKING', enabled }); } catch (_) {}
  });
  elements.enableUrlCleaning?.addEventListener('change', async () => {
    const enabled = elements.enableUrlCleaning.checked;
    await setStorage({ urlCleaningEnabled: enabled });
    try { await sendMessage({ type: 'TOGGLE_URL_CLEANING', enabled }); } catch (_) {}
  });
  elements.enableCookieConsent?.addEventListener('change', async () => {
    const enabled = elements.enableCookieConsent.checked;
    await setStorage({ cookieConsentEnabled: enabled });
    try { await sendMessage({ type: 'TOGGLE_COOKIE_CONSENT', enabled }); } catch (_) {}
  });
  elements.enableAnnoyanceBlocking?.addEventListener('change', async () => {
    const enabled = elements.enableAnnoyanceBlocking.checked;
    await setStorage({ annoyanceBlockingEnabled: enabled });
    try { await sendMessage({ type: 'TOGGLE_ANNOYANCE_BLOCKING', enabled }); } catch (_) {}
  });
  elements.enablePingProtection?.addEventListener('change', async () => {
    const enabled = elements.enablePingProtection.checked;
    await setStorage({ pingProtectionEnabled: enabled });
    try { await sendMessage({ type: 'TOGGLE_PING_PROTECTION', enabled }); } catch (_) {}
  });
  elements.enableReferrerStripping?.addEventListener('change', async () => {
    const enabled = elements.enableReferrerStripping.checked;
    await setStorage({ referrerStrippingEnabled: enabled });
    try { await sendMessage({ type: 'TOGGLE_REFERRER_STRIPPING', enabled }); } catch (_) {}
  });
  elements.enableWebRTCProtection?.addEventListener('change', async () => {
    const enabled = elements.enableWebRTCProtection.checked;
    await setStorage({ webrtcProtectionEnabled: enabled });
    try { await sendMessage({ type: 'TOGGLE_WEBRTC_PROTECTION', enabled }); } catch (_) {}
  });
  if (elements.enablePhishingProtection) {
    elements.enablePhishingProtection.addEventListener('change', async () => {
      const enabled = elements.enablePhishingProtection.checked;
      await setStorage({ phishingProtectionEnabled: enabled });
      try { await sendMessage({ type: 'TOGGLE_PHISHING_PROTECTION', enabled }); } catch (_) {}
    });
  }
  if (elements.enableTelemetryBlocking) {
    elements.enableTelemetryBlocking.addEventListener('change', async () => {
      const enabled = elements.enableTelemetryBlocking.checked;
      await setStorage({ telemetryBlockingEnabled: enabled });
      try { await sendMessage({ type: 'TOGGLE_TELEMETRY_BLOCKING', enabled }); } catch (_) {}
      showToast(enabled ? 'Telemetry blocking enabled' : 'Telemetry blocking disabled', 'success');
    });
  }
  if (elements.enableThirdPartyCookieBlocking) {
    elements.enableThirdPartyCookieBlocking.addEventListener('change', async () => {
      const enabled = elements.enableThirdPartyCookieBlocking.checked;
      await setStorage({ thirdPartyCookieBlockingEnabled: enabled });
      try { await sendMessage({ type: 'TOGGLE_THIRD_PARTY_COOKIE_BLOCKING', enabled }); } catch (_) {}
      showToast(enabled ? 'Third-party cookies blocked' : 'Third-party cookies allowed', 'success');
    });
  }

  // --- Language filters ---
  if (elements.languageFilters) {
    elements.languageFilters.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const url  = cb.dataset.url;
        const name = cb.parentElement.querySelector('span')?.textContent || 'Filter';
        const label = cb.parentElement;

        cb.disabled = true;
        label.classList.add('loading');
        try {
          if (cb.checked) {
            const resp = await sendMessage({ type: 'ADD_FILTER_SUBSCRIPTION', name, url });
            if (resp?.success) {
              showToast(name + ' filter added with ' + (resp.subscription?.ruleCount || 0) + ' rules', 'success');
            } else {
              cb.checked = false;
              showToast(resp?.error || 'Failed to add filter', 'error');
            }
          } else {
            const subsResp = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
            if (subsResp?.success) {
              const sub = subsResp.subscriptions.find((s) => s.url === url);
              if (sub) {
                await sendMessage({ type: 'REMOVE_FILTER_SUBSCRIPTION', subscriptionId: sub.id });
                showToast(name + ' filter removed', 'success');
              }
            }
          }
        } catch (_) {
          showToast('Failed to update filter', 'error');
        } finally {
          cb.disabled = false;
          label.classList.remove('loading');
        }

        // Save state
        const enabled = [];
        elements.languageFilters.querySelectorAll('input[type="checkbox"]:checked').forEach((c) => {
          enabled.push(c.dataset.lang);
        });
        await setStorage({ enabledLanguageFilters: enabled });
        await loadFilterLists();
      });
    });
  }

  // Update language filters button
  const updateLangFiltersBtn = document.getElementById('updateLangFiltersBtn');
  if (updateLangFiltersBtn) {
    updateLangFiltersBtn.addEventListener('click', async () => {
      updateLangFiltersBtn.disabled = true;
      updateLangFiltersBtn.textContent = 'Updating...';
      try {
        const subsResp = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
        if (subsResp?.success && subsResp.subscriptions) {
          const enabledUrls = new Set();
          elements.languageFilters?.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => enabledUrls.add(cb.dataset.url));

          let count = 0;
          for (const sub of subsResp.subscriptions) {
            if (enabledUrls.has(sub.url)) {
              try { await sendMessage({ type: 'UPDATE_FILTER_SUBSCRIPTION', subscriptionId: sub.id }); count++; } catch (_) {}
            }
          }
          showToast(count > 0 ? count + ' language filter(s) updated' : 'No language filters to update', count > 0 ? 'success' : 'info');
          await loadFilterLists();
        }
      } catch (_) {
        showToast('Failed to update language filters', 'error');
      } finally {
        updateLangFiltersBtn.disabled = false;
        updateLangFiltersBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg> Update Language Filters';
      }
    });
  }

  // --- Sync ---
  if (elements.enableSync) {
    elements.enableSync.addEventListener('change', async () => {
      const enabled = elements.enableSync.checked;
      try {
        const resp = await sendMessage({ type: 'TOGGLE_SYNC', enabled });
        if (resp?.success) {
          showStatus(enabled ? 'Settings sync enabled.' : 'Settings sync disabled.', 'success');
        } else {
          elements.enableSync.checked = !enabled;
          showStatus(resp?.error || 'Failed to toggle sync', 'error');
        }
      } catch (_) {
        elements.enableSync.checked = !enabled;
        showStatus('Sync storage not available', 'error');
      }
    });
  }

  // --- Toast duration slider ---
  if (elements.toastDuration) {
    elements.toastDuration.addEventListener('input', () => {
      if (elements.toastDurationValue) elements.toastDurationValue.textContent = elements.toastDuration.value + 's';
    });
    elements.toastDuration.addEventListener('change', async () => {
      await setStorage({ toastDuration: parseInt(elements.toastDuration.value, 10) });
    });
  }

  // --- Logging ---
  elements.enableLogging?.addEventListener('change', async () => {
    const enabled = elements.enableLogging.checked;
    await setStorage({ loggingEnabled: enabled });
    if (enabled) startLogPolling(); else stopLogPolling();
  });
  elements.clearLogBtn?.addEventListener('click', async () => {
    try {
      await sendMessage({ type: 'CLEAR_REQUEST_LOG' });
      // Re-render empty log
      if (elements.requestLog) {
        clearElement(elements.requestLog);
        const empty = document.createElement('div');
        empty.className = 'log-empty';
        empty.textContent = 'No blocked requests logged yet';
        elements.requestLog.appendChild(empty);
      }
      if (elements.logCount) elements.logCount.textContent = '0';
    } catch (err) {
      logError('Failed to clear log:', err);
    }
  });

  // --- Navigation ---
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      if (!section) return;
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Active nav on scroll
  const sections = document.querySelectorAll('.section[id]');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.section === id));
      }
    }
  }, { threshold: 0.3 });
  sections.forEach((s) => observer.observe(s));

  // --- Stats period ---
  document.querySelectorAll('.period-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadStats(btn.dataset.period);
    });
  });

  // --- Filter subscriptions ---
  elements.addSubscriptionBtn?.addEventListener('click', async () => {
    const name = elements.subscriptionNameInput.value.trim();
    const url  = elements.subscriptionUrlInput.value.trim();
    if (!url) { showStatus('Please enter a filter list URL', 'error'); return; }
    try {
      const resp = await sendMessage({ type: 'ADD_FILTER_SUBSCRIPTION', name, url });
      if (resp?.success) {
        elements.subscriptionNameInput.value = '';
        elements.subscriptionUrlInput.value = '';
        showStatus('Subscription added with ' + (resp.subscription?.ruleCount || 0) + ' rules', 'success');
        await loadFilterLists();
      } else {
        showStatus(resp?.error || 'Failed to add subscription', 'error');
      }
    } catch (_) {
      showStatus('Failed to add subscription', 'error');
    }
  });
  elements.updateAllFiltersBtn?.addEventListener('click', async () => {
    try {
      await sendMessage({ type: 'UPDATE_ALL_FILTER_SUBSCRIPTIONS' });
      showStatus('All filter lists updated', 'success');
      await loadFilterLists();
    } catch (_) {
      showStatus('Failed to update filter lists', 'error');
    }
  });

  // --- Whitelist ---
  elements.addSiteBtn?.addEventListener('click', addSiteToWhitelist);
  elements.siteInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSiteToWhitelist();
  });

  // --- Reset stats ---
  elements.resetStatsBtn?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset all statistics?')) return;
    try {
      await sendMessage({ type: 'RESET_STATS' });
      elements.totalBlocked.textContent    = '0';
      elements.networkBlocked.textContent  = '0';
      elements.cosmeticBlocked.textContent = '0';
      if (elements.dataSavedTotal) elements.dataSavedTotal.textContent = '0 MB';
      clearElement(elements.topDomainsChart);
      clearElement(elements.topSitesChart);
    } catch (err) {
      logError('Failed to reset stats:', err);
    }
  });

  // --- Import / Export ---
  elements.exportBtn?.addEventListener('click', exportRules);
  elements.importBtn?.addEventListener('click', () => elements.importFile?.click());
  elements.importFile?.addEventListener('change', handleImportFile);

  // --- External links ---
  const GITHUB_URL = 'https://github.com/sriinnu/web-suddhi';
  elements.rateExtension?.addEventListener('click', (e) => { e.preventDefault(); api.tabs?.create({ url: GITHUB_URL + '/issues' }); });
  elements.viewSource?.addEventListener('click', (e) => { e.preventDefault(); api.tabs?.create({ url: GITHUB_URL }); });
}

// ============================================
// HELPERS
// ============================================

async function addSiteToWhitelist() {
  const site = elements.siteInput.value.trim().toLowerCase();
  if (!site) return;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(site)) {
    showStatus('Please enter a valid domain (e.g., example.com)', 'error');
    return;
  }
  try {
    const resp = await sendMessage({ type: 'WHITELIST_SITE', hostname: site });
    if (resp?.success) {
      elements.whitelistList.appendChild(createWhitelistItem(site));
      elements.siteInput.value = '';
    }
  } catch (err) {
    logError('Failed to whitelist site:', err);
  }
}

async function exportRules() {
  try {
    const resp = await sendMessage({ type: 'EXPORT_RULES' });
    if (resp?.success && resp.data) {
      const blob = new Blob([JSON.stringify(resp.data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'websuddhi-rules-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('Rules exported successfully', 'success');
    }
  } catch (_) {
    showStatus('Failed to export rules', 'error');
  }
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data.blockedSelectors)) {
      showStatus('Invalid file format.', 'error');
      return;
    }
    const resp = await sendMessage({ type: 'IMPORT_RULES', data });
    if (resp?.success) {
      showStatus('Imported ' + data.blockedSelectors.length + ' rules. Total: ' + resp.totalRules, 'success');
      await loadRules();
      await loadWhitelist();
    } else {
      showStatus(resp?.error || 'Import failed', 'error');
    }
  } catch (_) {
    showStatus('Failed to parse import file', 'error');
  }
  elements.importFile.value = '';
}

// ============================================
// BOOTSTRAP
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
