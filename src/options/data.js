/**
 * @module options/data
 * @description Data loading functions for settings, stats, rules, filter lists,
 * and the request log. Each function reads from storage or the background
 * and renders the result into the options DOM.
 *
 * @version 2.1.0
 */
'use strict';

import { getStorage, setStorage, sendMessage, sendMessageWithFallback, extractRequestLog, logError } from './api.js';
import { elements, clearElement, formatNumber, formatDataSize, formatTimeSaved, getRelativeTime, showToast } from './dom.js';
import { renderBarChart, renderPieChart, renderTrendChart } from './charts.js';

// ============================================
// STATE
// ============================================

/** @type {boolean} */
export let loggingEnabled = true;

/** @type {number|null} */
let logPollInterval = null;

// ============================================
// SETTINGS
// ============================================

/**
 * Load all settings from storage and sync toggle states.
 */
export async function loadSettings() {
  const storage = await getStorage([
    'enabled', 'paywallEnabled', 'networkBlockingEnabled', 'urlCleaningEnabled',
    'cookieConsentEnabled', 'annoyanceBlockingEnabled',
    'pingProtectionEnabled', 'referrerStrippingEnabled', 'webrtcProtectionEnabled',
    'phishingProtectionEnabled', 'telemetryBlockingEnabled', 'thirdPartyCookieBlockingEnabled',
    'syncEnabled', 'enabledLanguageFilters', 'loggingEnabled', 'toastDuration',
  ]);

  loggingEnabled = storage.loggingEnabled !== false;
  if (elements.enableLogging) elements.enableLogging.checked = loggingEnabled;

  if (elements.enableProtection)        elements.enableProtection.checked          = storage.enabled !== false;
  if (elements.enablePaywall)           elements.enablePaywall.checked             = storage.paywallEnabled !== false;
  if (elements.enableNetworkBlocking)   elements.enableNetworkBlocking.checked     = storage.networkBlockingEnabled !== false;
  if (elements.enableUrlCleaning)       elements.enableUrlCleaning.checked         = storage.urlCleaningEnabled !== false;
  if (elements.enableCookieConsent)     elements.enableCookieConsent.checked       = storage.cookieConsentEnabled !== false;
  if (elements.enableAnnoyanceBlocking) elements.enableAnnoyanceBlocking.checked   = storage.annoyanceBlockingEnabled !== false;
  if (elements.enablePingProtection)    elements.enablePingProtection.checked      = storage.pingProtectionEnabled !== false;
  if (elements.enableReferrerStripping) elements.enableReferrerStripping.checked   = storage.referrerStrippingEnabled === true;
  if (elements.enableWebRTCProtection)  elements.enableWebRTCProtection.checked    = storage.webrtcProtectionEnabled === true;

  if (elements.enablePhishingProtection)          elements.enablePhishingProtection.checked          = storage.phishingProtectionEnabled !== false;
  if (elements.enableTelemetryBlocking)           elements.enableTelemetryBlocking.checked           = storage.telemetryBlockingEnabled === true;
  if (elements.enableThirdPartyCookieBlocking)    elements.enableThirdPartyCookieBlocking.checked    = storage.thirdPartyCookieBlockingEnabled === true;
  if (elements.enableSync)                        elements.enableSync.checked                        = storage.syncEnabled === true;

  if (elements.toastDuration) {
    const dur = storage.toastDuration || 3;
    elements.toastDuration.value = dur;
    if (elements.toastDurationValue) elements.toastDurationValue.textContent = dur + 's';
  }

  await loadLanguageFilterStates();
}

/**
 * Sync language-filter checkbox states with actual subscriptions.
 */
async function loadLanguageFilterStates() {
  if (!elements.languageFilters) return;

  try {
    const response = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
    if (response?.success && response.subscriptions) {
      const subscribedUrls = new Set(response.subscriptions.map((s) => s.url));
      elements.languageFilters.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = subscribedUrls.has(cb.dataset.url);
      });

      const enabledLangFilters = [];
      elements.languageFilters.querySelectorAll('input[type="checkbox"]:checked').forEach((c) => {
        enabledLangFilters.push(c.dataset.lang);
      });
      await setStorage({ enabledLanguageFilters: enabledLangFilters });
    }
  } catch (_) {
    const storage = await getStorage(['enabledLanguageFilters']);
    const list = storage.enabledLanguageFilters || [];
    elements.languageFilters.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = list.includes(cb.dataset.lang);
    });
  }
}

// ============================================
// THEME
// ============================================

/**
 * Load persisted theme and apply it.
 */
export async function loadTheme() {
  const storage = await getStorage(['theme']);
  const theme = storage.theme || 'system';
  applyTheme(theme);
  updateThemeButtons(theme);
}

/**
 * Apply a theme to the document root.
 * @param {string} theme - 'light', 'dark', or 'system'.
 */
export function applyTheme(theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Highlight the active theme button.
 * @param {string} activeTheme
 */
export function updateThemeButtons(activeTheme) {
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === activeTheme);
  });
}

// ============================================
// RULES
// ============================================

/**
 * Load blocked selectors from storage and render the rules list.
 */
export async function loadRules() {
  const storage = await getStorage(['blockedSelectors']);
  const selectors = storage.blockedSelectors || [];

  elements.rulesCount.textContent = selectors.length;
  if (elements.navRulesCount) elements.navRulesCount.textContent = selectors.length;

  elements.rulesList.querySelectorAll('.rule-item').forEach((el) => el.remove());

  if (selectors.length === 0) {
    elements.emptyState.style.display = 'block';
    return;
  }

  elements.emptyState.style.display = 'none';
  for (const item of selectors) {
    elements.rulesList.appendChild(createRuleElement(item));
  }
}

/**
 * Create a rule-item DOM element with a delete button.
 * @param {object} item - `{ selector, hostname, date }`
 * @returns {HTMLElement}
 */
export function createRuleElement(item) {
  const div = document.createElement('div');
  div.className = 'rule-item';
  div.dataset.selector = item.selector;

  const date = item.date ? new Date(item.date).toLocaleDateString() : 'Unknown';

  const ruleInfo = document.createElement('div');
  ruleInfo.className = 'rule-info';

  const code = document.createElement('code');
  code.className = 'rule-selector';
  code.textContent = item.selector;

  const meta = document.createElement('div');
  meta.className = 'rule-meta';
  meta.textContent = (item.hostname || 'unknown') + ' - ' + date;

  ruleInfo.appendChild(code);
  ruleInfo.appendChild(meta);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'rule-delete';
  deleteBtn.title = 'Remove rule';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z');
  svg.appendChild(path);
  deleteBtn.appendChild(svg);

  div.appendChild(ruleInfo);
  div.appendChild(deleteBtn);

  deleteBtn.addEventListener('click', async () => {
    try {
      await sendMessage({ type: 'REMOVE_SELECTOR', selector: item.selector });
      div.remove();
      const count = parseInt(elements.rulesCount.textContent, 10) - 1;
      elements.rulesCount.textContent = count;
      if (elements.navRulesCount) elements.navRulesCount.textContent = count;
      if (count === 0) elements.emptyState.style.display = 'block';
      showToast('Rule removed', 'success');
    } catch (err) {
      logError('Failed to remove selector:', err);
      showToast('Failed to remove rule', 'error');
    }
  });

  return div;
}

// ============================================
// WHITELIST
// ============================================

/**
 * Load whitelisted sites and render them.
 */
export async function loadWhitelist() {
  const storage = await getStorage(['whitelistedSites']);
  const sites = storage.whitelistedSites || [];
  clearElement(elements.whitelistList);
  for (const site of sites) {
    elements.whitelistList.appendChild(createWhitelistItem(site));
  }
}

/**
 * Create a whitelist-item DOM element with a remove button.
 * @param {string} site
 * @returns {HTMLElement}
 */
export function createWhitelistItem(site) {
  const div = document.createElement('div');
  div.className = 'whitelist-item';
  div.dataset.site = site;

  const span = document.createElement('span');
  span.textContent = site;

  const removeBtn = document.createElement('button');
  removeBtn.title = 'Remove';
  removeBtn.textContent = '\u00D7';

  div.appendChild(span);
  div.appendChild(removeBtn);

  removeBtn.addEventListener('click', async () => {
    try {
      await sendMessage({ type: 'UNWHITELIST_SITE', hostname: site });
      div.remove();
    } catch (err) {
      logError('Failed to unwhitelist:', err);
    }
  });

  return div;
}

// ============================================
// STATS
// ============================================

/**
 * Load blocking stats and render charts.
 * @param {string} [period] - 'today', 'all', or a number string for days.
 */
export async function loadStats(period) {
  try {
    const statsResponse = await sendMessageWithFallback(['GET_STATS', 'GET_ENHANCED_STATS']);
    const stats = statsResponse?.stats || null;
    if (!stats) return;

    if (!period || period === 'all') {
      elements.networkBlocked.textContent  = formatNumber(stats.totalNetworkBlocked || 0);
      elements.cosmeticBlocked.textContent = formatNumber(stats.totalCosmeticBlocked || 0);
      elements.totalBlocked.textContent    = formatNumber(stats.totalBlocked || 0);
    } else if (period === 'today') {
      const t = stats.today || {};
      elements.networkBlocked.textContent  = formatNumber(t.networkBlocked || 0);
      elements.cosmeticBlocked.textContent = formatNumber(t.cosmeticBlocked || 0);
      elements.totalBlocked.textContent    = formatNumber((t.networkBlocked || 0) + (t.cosmeticBlocked || 0));
    } else {
      const days = parseInt(period, 10);
      if (!Number.isNaN(days)) {
        const pr = await sendMessageWithFallback(['GET_PERIOD_STATS', 'GET_STATS_FOR_PERIOD'], { days });
        const ps = pr?.stats || pr || {};
        const net = ps.network ?? ps.networkBlocked ?? 0;
        const cos = ps.cosmetic ?? ps.cosmeticBlocked ?? 0;
        elements.networkBlocked.textContent  = formatNumber(net);
        elements.cosmeticBlocked.textContent = formatNumber(cos);
        elements.totalBlocked.textContent    = formatNumber(net + cos);
      }
    }

    renderBarChart(elements.topDomainsChart, stats.today?.topDomains || {}, 10);
    renderBarChart(elements.topSitesChart, stats.today?.perSite || {}, 10, true);
    renderPieChart(elements.categoryChart, stats.today?.byCategory || stats.byCategory || {});
    renderTrendChart(elements.trendChart, stats.history || []);
  } catch (_) {
    elements.totalBlocked.textContent    = '0';
    elements.networkBlocked.textContent  = '0';
    elements.cosmeticBlocked.textContent = '0';
  }
}

/**
 * Load performance stats (data saved, time saved).
 */
export async function loadPerformanceStats() {
  try {
    const response = await sendMessage({ type: 'GET_PERFORMANCE_STATS' });
    if (response?.success && response.performanceStats) {
      const ps = response.performanceStats;
      if (elements.dataSavedTotal) elements.dataSavedTotal.textContent = formatDataSize(ps.estimatedDataSaved || 0);
      const timeSavedEl = document.getElementById('timeSavedTotal');
      if (timeSavedEl) timeSavedEl.textContent = formatTimeSaved(ps.estimatedTimeSaved || 0);
    }
  } catch (_) {
    if (elements.dataSavedTotal) elements.dataSavedTotal.textContent = '0 MB';
  }
}

// ============================================
// FILTER LISTS
// ============================================

/**
 * Load and render filter list subscriptions.
 */
export async function loadFilterLists() {
  try {
    const response = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
    if (response?.success) renderFilterLists(response.subscriptions || []);
  } catch (err) {
    logError('Failed to load filter lists:', err);
  }
}

/**
 * Render filter subscription list items.
 * @param {Array} subscriptions
 */
function renderFilterLists(subscriptions) {
  clearElement(elements.filterListItems);

  for (const sub of subscriptions) {
    const item = document.createElement('div');
    item.className = 'filter-list-item';

    const lastUpdated = sub.lastUpdated ? new Date(sub.lastUpdated).toLocaleDateString() : 'Never';

    // Toggle label
    const label = document.createElement('label');
    label.className = 'toggle-label compact';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.subId = sub.id;
    if (sub.enabled) checkbox.checked = true;

    const toggleSwitch = document.createElement('span');
    toggleSwitch.className = 'toggle-switch small';
    const slider = document.createElement('span');
    slider.className = 'slider';
    toggleSwitch.appendChild(slider);

    const settingText = document.createElement('span');
    settingText.className = 'setting-text';

    const title = document.createElement('span');
    title.className = 'setting-title';
    title.textContent = sub.name;

    const desc = document.createElement('span');
    desc.className = 'setting-desc';
    desc.textContent = (sub.builtin ? 'Built-in' : (sub.url || '')) +
      ' | ' + (sub.ruleCount || 0) + ' rules | Updated: ' + lastUpdated;

    settingText.appendChild(title);
    settingText.appendChild(desc);
    label.appendChild(checkbox);
    label.appendChild(toggleSwitch);
    label.appendChild(settingText);
    item.appendChild(label);

    // Remove button (custom only)
    if (!sub.builtin) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'rule-delete';
      removeBtn.dataset.removeSub = sub.id;
      removeBtn.title = 'Remove';

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('fill', 'currentColor');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z');
      svg.appendChild(path);
      removeBtn.appendChild(svg);
      item.appendChild(removeBtn);

      removeBtn.addEventListener('click', async () => {
        try {
          await sendMessage({ type: 'REMOVE_FILTER_SUBSCRIPTION', subscriptionId: sub.id });
          item.remove();
        } catch (_) { /* swallow */ }
      });
    }

    checkbox.addEventListener('change', async () => {
      try {
        await sendMessage({ type: 'TOGGLE_FILTER_SUBSCRIPTION', subscriptionId: sub.id, enabled: checkbox.checked });
      } catch (_) { /* swallow */ }
    });

    elements.filterListItems.appendChild(item);
  }
}

// ============================================
// REQUEST LOG
// ============================================

/**
 * Load and render the request log.
 */
export async function loadRequestLog() {
  try {
    const response = await sendMessageWithFallback(['GET_REQUEST_LOG', 'REQUEST_LOG']);
    renderRequestLog(extractRequestLog(response));
  } catch (err) {
    logError('Failed to load request log:', err);
  }
}

/**
 * Render request log entries using safe DOM APIs.
 * @param {Array} log
 */
function renderRequestLog(log) {
  if (!elements.requestLog) return;
  elements.logCount.textContent = log.length;
  clearElement(elements.requestLog);

  if (log.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'log-empty';
    emptyDiv.textContent = 'No blocked requests logged yet';
    elements.requestLog.appendChild(emptyDiv);
    return;
  }

  for (const entry of [...log].reverse()) {
    const div = document.createElement('div');
    div.className = 'log-entry ' + entry.type;

    // Type badge
    const typeSpan = document.createElement('span');
    typeSpan.className = 'log-type';
    typeSpan.textContent = entry.type;
    div.appendChild(typeSpan);

    // Category badge (network only)
    if (entry.type === 'network' && entry.category) {
      const cat = document.createElement('span');
      cat.className = 'log-category ' + (entry.severity || 'low');
      cat.textContent = entry.category;
      cat.title = entry.trackerDesc || entry.category;
      div.appendChild(cat);
    }

    // Details
    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'log-details';

    const urlDiv = document.createElement('div');
    urlDiv.className = 'log-url';
    urlDiv.textContent = (entry.type === 'network' ? entry.url : entry.selector) || 'Unknown';
    detailsDiv.appendChild(urlDiv);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'log-meta';
    metaDiv.textContent = entry.site || 'Unknown site';
    detailsDiv.appendChild(metaDiv);

    div.appendChild(detailsDiv);

    // Time
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = getRelativeTime(entry.timestamp);
    div.appendChild(timeSpan);

    elements.requestLog.appendChild(div);
  }
}

/**
 * Start polling the request log every 2 seconds.
 */
export function startLogPolling() {
  logPollInterval = setInterval(async () => {
    if (loggingEnabled) await loadRequestLog();
  }, 2000);
}

/**
 * Stop the request-log polling interval.
 */
export function stopLogPolling() {
  if (logPollInterval) {
    clearInterval(logPollInterval);
    logPollInterval = null;
  }
}
