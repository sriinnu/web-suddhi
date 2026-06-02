// WebSuddhi - Popup Script
// Universal: Chrome, Edge, Firefox, Safari

(function() {
  'use strict';

  // Logging helpers
  const logError = (...args) => {
    if (self.WebSuddhi && self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    } else {
      console.error('[WebSuddhi]', ...args);
    }
  };

  // DOM helpers
  const setButtonContent = (btn, svgPath, text) => {
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', svgPath);
    svg.appendChild(path);
    btn.appendChild(svg);
    btn.appendChild(document.createTextNode(' ' + text));
  };

  const SVG_PATHS = {
    pick: 'M7 2l12 11.5-5.5 1.2 3.3 6.8-2.2 1-3.2-7L7 20V2z',
    cancel: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19z',
    zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    check: 'M9 12l2 2 4-4',
    settings: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'
  };

  // Elements
  const elements = {
    enableToggle: document.getElementById('enableToggle'),
    currentSite: document.getElementById('currentSite'),
    paywallToggle: document.getElementById('paywallToggle'),
    socialBlockingToggle: document.getElementById('socialBlockingToggle'),
    networkBlockedCount: document.getElementById('networkBlockedCount'),
    cosmeticBlockedCount: document.getElementById('cosmeticBlockedCount'),
    rulesCount: document.getElementById('rulesCount'),
    dataSaved: document.getElementById('dataSaved'),
    networkBlockingToggle: document.getElementById('networkBlockingToggle'),
    urlCleaningToggle: document.getElementById('urlCleaningToggle'),
    cookieConsentToggle: document.getElementById('cookieConsentToggle'),
    annoyanceToggle: document.getElementById('annoyanceToggle'),
    removePaywallBtn: document.getElementById('removePaywallBtn'),
    pickModeBtn: document.getElementById('pickModeBtn'),
    zapModeBtn: document.getElementById('zapModeBtn'),
    openOptionsBtn: document.getElementById('openOptionsBtn'),
    reportIssue: document.getElementById('reportIssue'),
    trackerSummary: document.getElementById('trackerSummary'),
    trackerCategories: document.getElementById('trackerCategories'),
    // Security info elements
    siteInfoSection: document.getElementById('siteInfoSection'),
    siteIcon: document.getElementById('siteIcon'),
    siteMascot: document.getElementById('siteMascot'),
    securityBadge: document.getElementById('securityBadge'),
    securityText: document.getElementById('securityText'),
    certProtocol: document.getElementById('certProtocol'),
    certType: document.getElementById('certType'),
    phishingRiskSection: document.getElementById('phishingRiskSection'),
    phishingRiskBadge: document.getElementById('phishingRiskBadge'),
    phishingRiskText: document.getElementById('phishingRiskText'),
    phishingRiskDetails: document.getElementById('phishingRiskDetails'),
    copyDomainBtn: document.getElementById('copyDomainBtn'),
    reportPhishingBtn: document.getElementById('reportPhishingBtn'),
    // Certificate owner elements
    certOwnerSection: document.getElementById('certOwnerSection'),
    certOwnerName: document.getElementById('certOwnerName'),
    certOwnerDetails: document.getElementById('certOwnerDetails'),
    // Frames elements
    framesSection: document.getElementById('framesSection'),
    framesCount: document.getElementById('framesCount'),
    framesSummary: document.getElementById('framesSummary'),
    framesList: document.getElementById('framesList'),
    framesHogs: document.getElementById('framesHogs'),
    framesHogsCount: document.getElementById('framesHogsCount'),
    framesHogsList: document.getElementById('framesHogsList'),
    killAllHogsBtn: document.getElementById('killAllHogsBtn'),
    relaxBtn: document.getElementById('relaxBtn'),
    // Pinned action bar + site state control
    actAllowBtn: document.getElementById('actAllowBtn'),
    actBlockBtn: document.getElementById('actBlockBtn'),
    siteStateProtected: document.getElementById('siteStateProtected'),
    siteStateDefault: document.getElementById('siteStateDefault'),
    siteStatePaused: document.getElementById('siteStatePaused'),
    // Blocked panel elements
    networkStatBtn: document.getElementById('networkStatBtn'),
    cosmeticStatBtn: document.getElementById('cosmeticStatBtn'),
    blockedPanel: document.getElementById('blockedPanel'),
    blockedTitle: document.getElementById('blockedTitle'),
    blockedClose: document.getElementById('blockedClose'),
    blockedList: document.getElementById('blockedList'),
    viewAllBlocked: document.getElementById('viewAllBlocked'),
    // Header action buttons
    whitelistBtn: document.getElementById('whitelistBtn'),
    blacklistBtn: document.getElementById('blacklistBtn'),
    statusBadge: document.getElementById('statusBadge'),
    whitelistToggleBtn: document.getElementById('whitelistToggleBtn'),
    themeSelect: document.getElementById('themeSelect')
  };

  // Cross-browser API
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  let currentTab = null;
  let isPickMode = false;
  let isZapMode = false;
  let currentSettings = {};
  let isWhitelisted = false;
  let currentSecurityContext = null;

  // ============================================
  // THEME
  // ============================================
  async function loadPopupTheme() {
    try {
      const storage = await getStorage(['theme']);
      const theme = storage.theme || 'system';
      applyPopupTheme(theme);
      syncThemeControl(theme);
    } catch (e) {
      // Default to system
      syncThemeControl('system');
    }
  }

  function applyPopupTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system' || !theme) {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }

  function syncThemeControl(theme) {
    if (elements.themeSelect) {
      elements.themeSelect.value = theme || 'system';
    }
  }

  // ============================================
  // CROSS-BROWSER API
  // ============================================
  function getStorage(keys) {
    const sharedGetStorage = self.WebSuddhi?.utils?.getStorage;
    if (sharedGetStorage) {
      return sharedGetStorage(keys);
    }

    return new Promise((resolve, reject) => {
      if (api.storage) {
        if (typeof browser !== 'undefined' && browser.runtime) {
          api.storage.local.get(keys).then(resolve).catch(reject);
        } else {
          api.storage.local.get(keys, (data) => {
            if (api.runtime.lastError) reject(api.runtime.lastError);
            else resolve(data);
          });
        }
        return;
      }
      reject(new Error('No storage API'));
    });
  }

  function setStorage(data) {
    const sharedSetStorage = self.WebSuddhi?.utils?.setStorage;
    if (sharedSetStorage) {
      return sharedSetStorage(data);
    }

    return new Promise((resolve, reject) => {
      if (api.storage) {
        if (typeof browser !== 'undefined' && browser.runtime) {
          api.storage.local.set(data).then(resolve).catch(reject);
        } else {
          api.storage.local.set(data, () => {
            if (api.runtime.lastError) reject(api.runtime.lastError);
            else resolve();
          });
        }
        return;
      }
      reject(new Error('No storage API'));
    });
  }

  function sendToBackground(message) {
    return new Promise((resolve, reject) => {
      const result = api.runtime.sendMessage(message);
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        api.runtime.sendMessage(message, (response) => {
          if (api.runtime.lastError) reject(api.runtime.lastError);
          else resolve(response);
        });
      }
    });
  }

  function isUnknownMessageType(response) {
    return response && response.success === false &&
      typeof response.error === 'string' &&
      response.error.startsWith('Unknown message type');
  }

  async function sendToBackgroundWithFallback(types, payload = {}) {
    const typeList = Array.isArray(types) ? types : [types];
    let lastError = null;

    for (const type of typeList) {
      try {
        const response = await sendToBackground({ ...payload, type });
        if (!isUnknownMessageType(response)) {
          return response;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) throw lastError;
    return null;
  }

  function setStatusBadgeState(enabled) {
    if (!elements.statusBadge) return;

    const dot = document.createElement('span');
    dot.className = 'status-dot';
    const text = enabled ? 'Active' : 'Disabled';

    elements.statusBadge.className = enabled ? 'status-badge' : 'status-badge disabled';
    elements.statusBadge.style.background = enabled ? 'rgba(52, 199, 89, 0.15)' : 'rgba(255, 59, 48, 0.15)';
    elements.statusBadge.style.color = enabled ? '#34C759' : '#FF3B30';
    elements.statusBadge.textContent = '';
    elements.statusBadge.appendChild(dot);
    elements.statusBadge.appendChild(document.createTextNode(' ' + text));
  }

  function normalizeRiskLevel(riskLevel) {
    const normalized = (riskLevel || '').toString().toLowerCase();
    if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
      return normalized;
    }
    return 'unknown';
  }

  function getPrimaryDomainFromTab(tab) {
    if (!tab?.url) return '';
    try {
      return new URL(tab.url).hostname || '';
    } catch (e) {
      return '';
    }
  }

  function extractRequestLog(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.log)) return response.log;
    if (Array.isArray(response?.entries)) return response.entries;
    return [];
  }

  function extractCertificate(securityInfo) {
    return securityInfo?.certificate ||
      securityInfo?.cert ||
      securityInfo?.tlsCertificate ||
      securityInfo?.security?.certificate ||
      null;
  }

  function sendToContentScript(message) {
    return new Promise((resolve, reject) => {
      if (!currentTab || !currentTab.id) {
        reject(new Error('No active tab'));
        return;
      }

      const result = api.tabs.sendMessage(currentTab.id, message);
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        api.tabs.sendMessage(currentTab.id, message, (response) => {
          if (api.runtime.lastError) reject(api.runtime.lastError);
          else resolve(response);
        });
      }
    });
  }

  // ============================================
  // UI STATE MANAGEMENT
  // ============================================

  // Update UI based on settings
  async function updateUI(settings, tabId) {
    // Update main toggle
    if (elements.enableToggle) {
      elements.enableToggle.checked = settings.enabled !== false;
      elements.enableToggle.parentElement.classList.toggle('disabled', settings.enabled === false);
      setStatusBadgeState(settings.enabled !== false);
    }

    // Update feature toggles
    if (elements.networkBlockingToggle) elements.networkBlockingToggle.checked = settings.networkBlockingEnabled !== false;
    if (elements.urlCleaningToggle) elements.urlCleaningToggle.checked = settings.urlCleaningEnabled !== false;
    if (elements.cookieConsentToggle) elements.cookieConsentToggle.checked = settings.cookieConsentEnabled !== false;
    if (elements.annoyanceToggle) elements.annoyanceToggle.checked = settings.annoyanceBlockingEnabled !== false;
    if (elements.paywallToggle) elements.paywallToggle.checked = settings.paywallEnabled !== false;
    if (elements.socialBlockingToggle) elements.socialBlockingToggle.checked = settings.socialBlockingEnabled === true;

    // Update blocked count
    if (elements.networkBlockedCount) {
      if (tabId) {
        try {
          const blockedCount = await sendToBackground({ type: 'GET_BLOCKED_COUNT', tabId });
          elements.networkBlockedCount.textContent = blockedCount.count || 0;
        } catch (e) {
          elements.networkBlockedCount.textContent = '0';
        }
      } else {
        elements.networkBlockedCount.textContent = '0';
      }
    }

    // Update rules count
    if (elements.rulesCount) {
      const rulesCount = 100 + (settings.blockedDomains?.length || 0) + (settings.blockedSelectors?.length || 0);
      elements.rulesCount.textContent = rulesCount;
    }

    // Update data saved estimate
    if (elements.dataSaved && tabId) {
      try {
        const blockedCount = await sendToBackground({ type: 'GET_BLOCKED_COUNT', tabId });
        const dataSaved = (blockedCount.count || 0) * 2.5; // Rough estimate: 2.5 KB per request
        if (dataSaved >= 1024) {
          elements.dataSaved.textContent = (dataSaved / 1024).toFixed(1) + ' MB';
        } else {
          elements.dataSaved.textContent = Math.round(dataSaved) + ' KB';
        }
      } catch (e) {
        elements.dataSaved.textContent = '0 KB';
      }
    }

    // Update status badge
    setStatusBadgeState(settings.enabled !== false);
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  // Toggle main protection
  async function toggleEnabled() {
    if (!elements.enableToggle) return;
    const enabled = elements.enableToggle.checked;

    try {
      await sendToBackground({ type: 'TOGGLE_ENABLED', enabled });

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

    if (response.success) {
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

  // Quick blacklist from header button
  async function quickBlacklist() {
    if (!currentTab?.url) return;

    const hostname = new URL(currentTab.url).hostname;
    const response = await sendToBackground({ type: 'ADD_DOMAIN_BLOCK', domain: hostname });

    if (response.success) {
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
      setButtonContent(elements.pickModeBtn, SVG_PATHS.pick, 'Pick');
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

  // ============================================
  // STATS & BLOCKED ITEMS
  // ============================================
  let showingNetworkStats = false;
  let showingCosmeticStats = false;

  async function showNetworkStats() {
    if (!elements.blockedPanel || !elements.blockedList || !elements.blockedTitle) return;

    showingNetworkStats = true;
    showingCosmeticStats = false;
    elements.blockedTitle.textContent = 'Network Requests';

    try {
      const response = await sendToBackgroundWithFallback(['GET_REQUEST_LOG', 'REQUEST_LOG']);
      const requestLog = extractRequestLog(response).filter(entry => entry?.type === 'network');

      if (requestLog.length > 0) {
        renderBlockedItems(requestLog, 'network');
      } else {
        elements.blockedList.innerHTML = '<div class="blocked-empty">No network requests blocked yet</div>';
      }

      elements.blockedPanel.style.display = 'block';
    } catch (e) {
      elements.blockedList.innerHTML = '<div class="blocked-empty">Error loading stats</div>';
      elements.blockedPanel.style.display = 'block';
    }
  }

  async function showCosmeticStats() {
    if (!elements.blockedPanel || !elements.blockedList || !elements.blockedTitle) return;

    showingCosmeticStats = true;
    showingNetworkStats = false;
    elements.blockedTitle.textContent = 'Blocked Elements';

    try {
      const response = await sendToBackground({ type: 'GET_SELECTORS' });

      if (response && response.success && response.selectors && response.selectors.length > 0) {
        renderBlockedItems(response.selectors, 'cosmetic');
      } else {
        elements.blockedList.innerHTML = '<div class="blocked-empty">No elements blocked yet</div>';
      }

      elements.blockedPanel.style.display = 'block';
    } catch (e) {
      elements.blockedList.innerHTML = '<div class="blocked-empty">Error loading stats</div>';
      elements.blockedPanel.style.display = 'block';
    }
  }

  function hideBlockedPanel() {
    if (elements.blockedPanel) {
      elements.blockedPanel.style.display = 'none';
      showingNetworkStats = false;
      showingCosmeticStats = false;
    }
  }

  async function renderBlockedItems(items, type) {
    if (!elements.blockedList) return;

    const html = items.slice(-20).reverse().map(item => {
      if (type === 'network') {
        const url = item.url || 'Unknown';
        const shortUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;
        const site = item.site || 'Unknown';
        const domain = extractDomain(site);
        const category = item.category || 'Unknown';
        const severity = item.severity || 'low';

        return `
          <div class="blocked-item" title="${escapeHtml(url)}">
            <div class="blocked-item-info">
              <div class="blocked-item-url">${escapeHtml(shortUrl)}</div>
              <div class="blocked-item-type ${type}">${escapeHtml(domain)} • ${category}</div>
            </div>
            <button class="blocked-unblock" data-url="${escapeHtml(url)}">Unblock</button>
          </div>
        `;
      } else {
        const selector = item.selector || 'Unknown';
        const site = item.hostname || 'Unknown';
        const date = item.date ? new Date(item.date).toLocaleDateString() : '';

        return `
          <div class="blocked-item" title="${escapeHtml(selector)}">
            <div class="blocked-item-info">
              <div class="blocked-item-url">${escapeHtml(selector.length > 40 ? selector.substring(0, 40) + '...' : selector)}</div>
              <div class="blocked-item-type ${type}">${escapeHtml(site)} ${date ? '• ' + date : ''}</div>
            </div>
            <button class="blocked-unblock" data-selector="${escapeHtml(selector)}">Unblock</button>
          </div>
        `;
      }
    }).join('');

    elements.blockedList.innerHTML = html;

    // Add event listeners to unblock buttons
    elements.blockedList.querySelectorAll('.blocked-unblock').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = btn.dataset.url;
        const selector = btn.dataset.selector;

        if (url) {
          await unblockRequest(url);
        } else if (selector) {
          await unblockSelector(selector);
        }
      });
    });
  }

  async function unblockRequest(url) {
    try {
      await sendToBackground({ type: 'UNBLOCK_REQUEST', url });
      showToast('Request unblocked');

      // Refresh the list
      if (showingNetworkStats) {
        showNetworkStats();
      }
    } catch (e) {
      showToast('Failed to unblock');
    }
  }

  async function unblockSelector(selector) {
    try {
      await sendToBackground({ type: 'REMOVE_SELECTOR', selector });
      showToast('Element unblocked');

      // Refresh the list
      if (showingCosmeticStats) {
        showCosmeticStats();
      }
    } catch (e) {
      showToast('Failed to unblock');
    }
  }

  // ============================================
  // TOAST NOTIFICATIONS
  // ============================================
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.textContent;
  }

  function extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  }

  function formatDataSize(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  }

  function setPhishingRiskState(connection = {}, phishing = {}) {
    if (!elements.phishingRiskSection) return;

    currentSecurityContext = {
      connection,
      phishing: phishing || {}
    };

    if (!elements.phishingRiskBadge || !elements.phishingRiskText || !elements.phishingRiskDetails) {
      return;
    }

    const hostname = connection.host || connection.normalizedHost || getPrimaryDomainFromTab(currentTab);
    const risk = phishing || {};
    const level = normalizeRiskLevel(risk.riskLevel);
    const isSuspicious = risk.isSuspicious === true;
    const protectionEnabled = risk.protectionEnabled !== false;
    const hasHostname = !!hostname;

    let badgeClass = 'unknown';
    let badgeText = 'Checking';
    let statusText = 'Evaluating destination';
    let detailsText = 'No risk signal available yet.';
    let canReport = hasHostname;
    let canCopy = hasHostname;

    if (!hostname) {
      badgeClass = 'unknown';
      badgeText = 'Unknown';
      statusText = 'No host context';
      detailsText = 'The current tab URL is not available for security checks.';
      canReport = false;
      canCopy = false;
    } else if (!protectionEnabled) {
      badgeClass = 'disabled';
      badgeText = 'Protection Off';
      statusText = 'AI-scam checks disabled';
      detailsText = 'Enable phishing protection in settings to run similarity checks.';
    } else if (risk.evaluationError) {
      badgeClass = 'disabled';
      badgeText = 'Evaluation Error';
      statusText = 'Could not evaluate risk';
      detailsText = risk.reason || 'Re-run security checks on next load.';
    } else if (isSuspicious) {
      badgeClass = level === 'high' ? 'high' : (level === 'medium' ? 'medium' : 'low');
      badgeText = `${level.toUpperCase()} risk`;
      statusText = 'High chance of AI-based spoofing';
      const matchedBrand = risk.matchedBrand || risk.brand || 'Unknown brand';
      const matchedDomain = risk.matchedDomain || risk.suspectedDomain || '';
      detailsText = [
        risk.reason || `Domain resembles ${matchedBrand}.`,
        matchedDomain ? `Similar to: ${matchedDomain}` : null
      ].filter(Boolean).join(' ');
    } else {
      badgeClass = 'safe';
      badgeText = 'Low risk';
      statusText = 'No spoofing signals detected';
      const reason = risk.reason || 'No phishing patterns detected.';
      detailsText = reason;
    }

    elements.phishingRiskBadge.className = 'phishing-risk-badge ' + badgeClass;
    elements.phishingRiskBadge.textContent = badgeText;
    elements.phishingRiskText.textContent = statusText;
    elements.phishingRiskDetails.textContent = detailsText;
    elements.phishingRiskSection.style.display = 'block';

    if (elements.copyDomainBtn) {
      elements.copyDomainBtn.style.display = canCopy ? 'inline-flex' : 'none';
    }
    if (elements.reportPhishingBtn) {
      elements.reportPhishingBtn.style.display = canReport ? 'inline-flex' : 'none';
    }
  }

  async function copyCurrentDomain() {
    const domain = currentSecurityContext?.connection?.host || getPrimaryDomainFromTab(currentTab);
    if (!domain) {
      showToast('No domain available');
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(domain);
        showToast('Domain copied');
      } else {
        throw new Error('Clipboard unavailable');
      }
    } catch (e) {
      showToast('Could not copy domain');
    }
  }

  async function reportCurrentSiteAsPhishing() {
    const domain = currentSecurityContext?.connection?.host || getPrimaryDomainFromTab(currentTab);
    if (!domain) {
      showToast('No domain available');
      return;
    }

    const phishing = currentSecurityContext?.phishing || {};
    try {
      await sendToBackground({
        type: 'REPORT_PHISHING',
        domain,
        matchedBrand: phishing.matchedBrand || phishing.brand || 'Unknown',
        realDomain: phishing.matchedDomain || domain,
        reason: phishing.reason || 'User reported',
        brand: phishing.brand
      });
      showToast('Report submitted');
    } catch (e) {
      showToast('Failed to submit report');
    }
  }

  // Update security info display based on URL
  function updateSecurityInfo(url) {
    if (!elements.siteInfoSection) return;

    const iconSecure = elements.siteIcon?.querySelector('.icon-secure');
    const iconInsecure = elements.siteIcon?.querySelector('.icon-insecure');
    const mascotHappy = elements.siteMascot?.querySelector('.mascot-happy');
    const mascotWorried = elements.siteMascot?.querySelector('.mascot-worried');

    if (!url) {
      // Unknown or invalid URL
      elements.siteInfoSection.classList.add('insecure');
      if (iconSecure) iconSecure.style.display = 'none';
      if (iconInsecure) iconInsecure.style.display = 'block';
      if (mascotHappy) mascotHappy.style.display = 'none';
      if (mascotWorried) mascotWorried.style.display = 'block';
      if (elements.securityBadge) elements.securityBadge.className = 'security-badge insecure';
      if (elements.securityText) elements.securityText.textContent = 'Unknown';
      if (elements.certProtocol) elements.certProtocol.textContent = '???';
      if (elements.certType) elements.certType.textContent = 'Not Available';
      return;
    }

    const isSecure = url.protocol === 'https:';
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isExtension = url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:';
    const isFile = url.protocol === 'file:';

    // Update visual state
    if (isSecure || isExtension) {
      // Secure connection
      elements.siteInfoSection.classList.remove('insecure');
      if (iconSecure) iconSecure.style.display = 'block';
      if (iconInsecure) iconInsecure.style.display = 'none';
      if (mascotHappy) mascotHappy.style.display = 'block';
      if (mascotWorried) mascotWorried.style.display = 'none';
      if (elements.securityBadge) elements.securityBadge.className = 'security-badge secure';
      if (elements.securityText) elements.securityText.textContent = 'Secure Connection';
      if (elements.certProtocol) elements.certProtocol.textContent = 'HTTPS';
      if (elements.certType) elements.certType.textContent = 'TLS Encrypted';
    } else if (isLocalhost) {
      // Localhost - technically not encrypted but safe
      elements.siteInfoSection.classList.remove('insecure');
      if (iconSecure) iconSecure.style.display = 'block';
      if (iconInsecure) iconInsecure.style.display = 'none';
      if (mascotHappy) mascotHappy.style.display = 'block';
      if (mascotWorried) mascotWorried.style.display = 'none';
      if (elements.securityBadge) elements.securityBadge.className = 'security-badge secure';
      if (elements.securityText) elements.securityText.textContent = 'Local Development';
      if (elements.certProtocol) elements.certProtocol.textContent = 'localhost';
      if (elements.certType) elements.certType.textContent = 'Trusted Local';
    } else if (isFile) {
      // File protocol
      elements.siteInfoSection.classList.remove('insecure');
      if (iconSecure) iconSecure.style.display = 'block';
      if (iconInsecure) iconInsecure.style.display = 'none';
      if (mascotHappy) mascotHappy.style.display = 'block';
      if (mascotWorried) mascotWorried.style.display = 'none';
      if (elements.securityBadge) elements.securityBadge.className = 'security-badge secure';
      if (elements.securityText) elements.securityText.textContent = 'Local File';
      if (elements.certProtocol) elements.certProtocol.textContent = 'file://';
      if (elements.certType) elements.certType.textContent = 'Local Access';
    } else {
      // Insecure connection (HTTP)
      elements.siteInfoSection.classList.add('insecure');
      if (iconSecure) iconSecure.style.display = 'none';
      if (iconInsecure) iconInsecure.style.display = 'block';
      if (mascotHappy) mascotHappy.style.display = 'none';
      if (mascotWorried) mascotWorried.style.display = 'block';
      if (elements.securityBadge) elements.securityBadge.className = 'security-badge insecure';
      if (elements.securityText) elements.securityText.textContent = 'Not Secure';
      if (elements.certProtocol) elements.certProtocol.textContent = 'HTTP';
      if (elements.certType) elements.certType.textContent = 'Unencrypted';
    }
  }

  // Load tracker category breakdown from request log
  async function loadTrackerSummary() {
    if (!elements.trackerSummary || !elements.trackerCategories) return;

    try {
      const response = await sendToBackgroundWithFallback(['GET_REQUEST_LOG', 'REQUEST_LOG']);
      const requestLog = extractRequestLog(response);
      if (requestLog.length === 0) {
        elements.trackerSummary.style.display = 'none';
        return;
      }

      // Count by category and severity
      const categoryCounts = {};
      const categorySeverity = {};

      for (const entry of requestLog) {
        if (entry.type === 'network' && entry.category && entry.category !== 'Unknown') {
          categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
          categorySeverity[entry.category] = entry.severity || 'low';
        }
      }

      // If no tracker data, hide the section
      const entries = Object.entries(categoryCounts);
      if (entries.length === 0) {
        elements.trackerSummary.style.display = 'none';
        return;
      }

      // Sort by count descending
      entries.sort((a, b) => b[1] - a[1]);

      // Clear and populate tracker categories
      while (elements.trackerCategories.firstChild) {
        elements.trackerCategories.removeChild(elements.trackerCategories.firstChild);
      }

      // Show top 5 categories
      const topEntries = entries.slice(0, 5);
      for (const [category, count] of topEntries) {
        const badge = document.createElement('span');
        badge.className = 'tracker-badge ' + (categorySeverity[category] || 'low');

        const countSpan = document.createElement('span');
        countSpan.className = 'tracker-count';
        countSpan.textContent = count;
        badge.appendChild(countSpan);
        badge.appendChild(document.createTextNode(' ' + category));

        elements.trackerCategories.appendChild(badge);
      }

      elements.trackerSummary.style.display = 'block';
    } catch (err) {
      elements.trackerSummary.style.display = 'none';
    }
  }

  // Load certificate owner info and third-party frames
  async function loadSecurityDetails() {
    if (!currentTab || !currentTab.id) return;
    const fallbackConnection = (() => {
      try {
        if (!currentTab.url) return {};
        const parsedUrl = new URL(currentTab.url);
        return {
          protocol: parsedUrl.protocol,
          host: parsedUrl.hostname || '',
          normalizedHost: getPrimaryDomainFromTab(currentTab) || '',
          isSecure: parsedUrl.protocol === 'https:',
          isLocal: parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1',
          isFile: parsedUrl.protocol === 'file:'
        };
      } catch (e) {
        return {};
      }
    })();

    try {
      // Get security info from background
      const rawSecurityInfo = await sendToBackgroundWithFallback(
        ['GET_SECURITY_INFO', 'GET_TAB_SECURITY_INFO', 'GET_TAB_SECURITY'],
        { tabId: currentTab.id }
      ) || {};
      const securityInfo = rawSecurityInfo;

      const connection = securityInfo?.connection || fallbackConnection;
      const phishing = securityInfo?.phishing || {};

      setPhishingRiskState(connection, phishing);

      // Update certificate owner section
      if (elements.certOwnerSection) {
        const cert = extractCertificate(securityInfo);
        const derivedOrg = getCertOrganization(connection.host || '');
        const org = cert?.organization || cert?.org || connection?.organization || derivedOrg || '';

        if (org) {
          elements.certOwnerName.textContent = org;

          // Format certificate details
          const details = [];
          const issuer = cert?.issuer || cert?.issuedBy || securityInfo?.issuer;
          if (issuer && issuer !== org) {
            details.push('Issuer: ' + issuer);
          }
          const validFrom = cert?.validFrom || cert?.notBefore;
          if (validFrom) {
            details.push('From: ' + validFrom);
          }
          const validTo = cert?.validTo || cert?.notAfter;
          if (validTo) {
            details.push('Until: ' + validTo);
          }
          elements.certOwnerDetails.textContent = details.join(' | ');
          if (details.length === 0) {
            elements.certOwnerDetails.textContent = `Host: ${connection.host || connection.normalizedHost || getPrimaryDomainFromTab(currentTab) || 'Unknown'}`;
          }

          // Show the section
          elements.certOwnerSection.style.display = 'block';
        } else {
          elements.certOwnerSection.style.display = 'none';
        }
      }

      // Frames are owned by the live census panel (loadFrameCensus), not here.
      await loadFrameCensus();
    } catch (err) {
      setPhishingRiskState(fallbackConnection, {
        isSuspicious: false,
        reason: err?.message || 'Could not load security info',
        evaluationError: true,
        protectionEnabled: false
      });

      if (elements.framesSection) {
        elements.framesSection.style.display = 'none';
      }

      if (elements.certOwnerSection) {
        elements.certOwnerSection.style.display = 'none';
      }
    }
  }

  // Get organization from hostname
  function getCertOrganization(hostname) {
    if (!hostname) return '';

    const knownOrgs = {
      'google.com': 'Google LLC',
      'accounts.google.com': 'Google LLC',
      'facebook.com': 'Meta Platforms, Inc.',
      'instagram.com': 'Meta Platforms, Inc.',
      'twitter.com': 'X Corp.',
      'x.com': 'X Corp.',
      'amazon.com': 'Amazon.com, Inc.',
      'microsoft.com': 'Microsoft Corporation',
      'apple.com': 'Apple Inc.',
      'github.com': 'GitHub, Inc.',
      'netflix.com': 'Netflix, Inc.',
      'linkedin.com': 'LinkedIn Corporation',
      'reddit.com': 'Reddit, Inc.',
      'wikipedia.org': 'Wikimedia Foundation',
      'cloudflare.com': 'Cloudflare, Inc.'
    };

    // Check exact match
    const normalized = hostname.replace(/^www\./, '');
    if (knownOrgs[normalized]) return knownOrgs[normalized];

    // Check if subdomain of known domain
    for (const [domain, org] of Object.entries(knownOrgs)) {
      if (normalized.endsWith('.' + domain)) return org;
    }

    // Return domain as fallback
    return normalized;
  }

  // ============================================
  // FRAMES PANEL — driven by the live per-tab census (GET_TAB_CENSUS)
  // ============================================
  const CATEGORY_LABELS = {
    ad: 'Ads', analytics: 'Analytics', 'session-replay': 'Session replay',
    payment: 'Payments', captcha: 'Captcha', auth: 'Sign-in', embed: 'Embeds',
    social: 'Social', other: 'Other'
  };

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
  }

  async function loadFrameCensus() {
    if (!elements.framesSection || !currentTab) return;
    let census = null;
    try {
      const resp = await sendToBackground({ type: 'GET_TAB_CENSUS', tabId: currentTab.id });
      census = resp && resp.census;
    } catch (e) { census = null; }

    const frames = (census && Array.isArray(census.frames)) ? census.frames : [];
    if (frames.length === 0) {
      elements.framesSection.style.display = 'none';
      return;
    }
    elements.framesSection.style.display = 'block';
    renderCensus(census);
  }

  function renderCensus(census) {
    const frames = census.frames.slice();
    const counts = census.counts || {};

    if (elements.framesCount) elements.framesCount.textContent = String(frames.length);
    if (elements.framesSummary) {
      const blocked = counts.blocked || 0;
      const flagged = counts.flagged || 0;
      const parts = [];
      if (blocked) parts.push(blocked + ' blocked');
      if (flagged) parts.push(flagged + ' flagged');
      elements.framesSummary.textContent = parts.join(' · ');
    }

    // --- Pinned resource hogs (heavy frames, any category) ---
    const hogs = frames.filter((f) => f.isHeavy);
    if (elements.framesHogs && elements.framesHogsList) {
      if (hogs.length) {
        elements.framesHogs.style.display = 'block';
        if (elements.framesHogsCount) elements.framesHogsCount.textContent = String(hogs.length);
        renderFrameRows(elements.framesHogsList, hogs.slice().sort(byWeightDesc));
      } else {
        elements.framesHogs.style.display = 'none';
      }
    }

    // --- Grouped by category, groups sorted by aggregate weight ---
    if (!elements.framesList) return;
    while (elements.framesList.firstChild) elements.framesList.removeChild(elements.framesList.firstChild);

    const groups = new Map();
    for (const f of frames) {
      const key = f.category || 'other';
      if (!groups.has(key)) groups.set(key, { frames: [], bytes: 0 });
      const g = groups.get(key);
      g.frames.push(f);
      g.bytes += Number(f.bytes) || 0;
    }
    const ordered = Array.from(groups.entries()).sort((a, b) => b[1].bytes - a[1].bytes);

    for (const [category, g] of ordered) {
      const groupEl = document.createElement('div');
      groupEl.className = 'frame-group';

      const head = document.createElement('div');
      head.className = 'frame-group-head';

      const label = document.createElement('span');
      label.className = 'frame-group-label';
      label.textContent = (CATEGORY_LABELS[category] || category) + ' (' + g.frames.length + ')';
      head.appendChild(label);

      const cost = document.createElement('span');
      cost.className = 'frame-group-cost';
      cost.textContent = formatBytes(g.bytes);
      head.appendChild(cost);

      // Block-all for non-protected groups.
      const blockable = g.frames.filter((f) => !f.isProtected);
      if (blockable.length) {
        const blockAll = document.createElement('button');
        blockAll.className = 'frame-group-blockall';
        blockAll.textContent = 'Block all';
        blockAll.addEventListener('click', async () => {
          for (const f of blockable) await applyFrameRule(f.domain, 'blocked');
          await loadFrameCensus();
        });
        head.appendChild(blockAll);
      }

      groupEl.appendChild(head);

      const rows = document.createElement('div');
      rows.className = 'frame-list';
      renderFrameRows(rows, g.frames.slice().sort(byWeightDesc));
      groupEl.appendChild(rows);

      elements.framesList.appendChild(groupEl);
    }
  }

  function byWeightDesc(a, b) {
    return (Number(b.bytes) || 0) - (Number(a.bytes) || 0);
  }

  // Render a flat list of frame rows into a container.
  function renderFrameRows(container, frames) {
    while (container.firstChild) container.removeChild(container.firstChild);
    for (const f of frames) {
      container.appendChild(buildFrameRow(f));
    }
  }

  function buildFrameRow(frame) {
    const blocked = frame.action === 'block';
    const item = document.createElement('div');
    item.className = 'frame-item' + (blocked ? ' blocked' : '') + (frame.isHeavy ? ' heavy' : '');

    const main = document.createElement('div');
    main.className = 'frame-main';

    const host = document.createElement('span');
    host.className = 'frame-host';
    host.textContent = frame.domain;
    host.title = frame.url || frame.domain;
    main.appendChild(host);

    const meta = document.createElement('div');
    meta.className = 'frame-meta';

    const tag = document.createElement('span');
    tag.className = 'frame-tag cat-' + (frame.category || 'other');
    tag.textContent = CATEGORY_LABELS[frame.category] || frame.category || 'Other';
    meta.appendChild(tag);

    if (frame.isProtected) {
      const prot = document.createElement('span');
      prot.className = 'frame-tag protected';
      prot.textContent = 'Protected';
      meta.appendChild(prot);
    }

    if (frame.isHeavy) {
      const heavy = document.createElement('span');
      heavy.className = 'frame-heat';
      heavy.textContent = '⚡ ' + formatBytes(frame.bytes) + ' (est.)';
      meta.appendChild(heavy);
    } else if (frame.bytes) {
      const size = document.createElement('span');
      size.className = 'frame-size';
      size.textContent = formatBytes(frame.bytes) + ' (est.)';
      meta.appendChild(size);
    }

    main.appendChild(meta);
    item.appendChild(main);

    // Allow/Block toggle — protected frames can't be auto-blocked but can be paused/blocked manually.
    const btn = document.createElement('button');
    btn.className = 'frame-toggle ' + (blocked ? 'is-blocked' : 'is-allowed');
    btn.textContent = blocked ? 'Allow' : 'Block';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await applyFrameRule(frame.domain, blocked ? 'allowed' : 'blocked');
      await loadFrameCensus();
    });
    item.appendChild(btn);

    return item;
  }

  // Persist a per-frame rule (this-site, persisted) and apply it.
  async function applyFrameRule(frameDomain, rule) {
    try {
      await sendToBackground({
        type: 'SET_FRAME_RULE',
        tabId: currentTab.id,
        frameDomain,
        rule,
        persist: true
      });
    } catch (e) {
      showToast('Failed to update frame');
    }
  }

  // Kill every resource hog at once.
  async function killAllHogs() {
    try {
      const resp = await sendToBackground({ type: 'GET_TAB_CENSUS', tabId: currentTab.id });
      const frames = (resp && resp.census && resp.census.frames) || [];
      const hogs = frames.filter((f) => f.isHeavy && !f.isProtected);
      for (const f of hogs) await applyFrameRule(f.domain, 'blocked');
      showToast('Blocked ' + hogs.length + ' resource hog' + (hogs.length === 1 ? '' : 's'));
      await loadFrameCensus();
    } catch (e) {
      showToast('Failed to kill hogs');
    }
  }

  // ============================================
  // SITE STATE — protected / default / paused
  // ============================================
  function reflectSiteState(stateValue) {
    const map = {
      protected: elements.siteStateProtected,
      default: elements.siteStateDefault,
      paused: elements.siteStatePaused
    };
    for (const key of Object.keys(map)) {
      if (map[key]) map[key].classList.toggle('is-active', key === stateValue);
    }
    // Mirror onto the pinned action bar (Allow = paused, Block = protected).
    if (elements.actAllowBtn) elements.actAllowBtn.classList.toggle('is-active', stateValue === 'paused');
    if (elements.actBlockBtn) elements.actBlockBtn.classList.toggle('is-active', stateValue === 'protected');
  }

  async function loadSiteState() {
    if (!currentTab?.url) return;
    try {
      const hostname = new URL(currentTab.url).hostname;
      const resp = await sendToBackground({ type: 'GET_SITE_STATE', hostname });
      reflectSiteState((resp && resp.state) || 'default');
    } catch (e) { /* non-http */ }
  }

  async function setSiteState(stateValue) {
    if (!currentTab?.url) return;
    try {
      const hostname = new URL(currentTab.url).hostname;
      await sendToBackground({ type: 'SET_SITE_STATE', hostname, state: stateValue, tabId: currentTab.id });
      reflectSiteState(stateValue);
      showToast(stateValue === 'paused' ? 'Blocking paused on ' + hostname
        : stateValue === 'protected' ? 'Full blocking on ' + hostname
          : 'Default blocking on ' + hostname);
      await loadFrameCensus();
    } catch (e) {
      showToast('Failed to change site state');
    }
  }

  // ============================================
  // RELAX — "Looks broken?" : drop cosmetic layers, keep network blocking on.
  // ============================================
  async function relaxCosmetic() {
    const cosmeticToggles = [
      { el: elements.annoyanceToggle, fn: toggleAnnoyanceBlocking },
      { el: elements.paywallToggle, fn: togglePaywall },
      { el: elements.socialBlockingToggle, fn: toggleSocialBlocking },
      { el: elements.cookieConsentToggle, fn: toggleCookieConsent }
    ];
    for (const { el, fn } of cosmeticToggles) {
      if (el && el.checked) {
        el.checked = false;
        try { await fn(); } catch (e) {}
      }
    }
    // Ask the page to restore anything cosmetically hidden.
    try { await sendToContentScript({ type: 'RELAX_COSMETIC' }); } catch (e) {}
    showToast('Relaxed cosmetic blocking — network blocking still on');
  }

  // ============================================
  // START
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  let listenersWired = false;
  function setupEventListeners() {
    if (listenersWired) return;
    listenersWired = true;

    // Main protection toggle
    elements.enableToggle?.addEventListener('change', toggleEnabled);

    // Feature toggles - use checkbox state after the browser updates it.
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
    elements.themeSelect?.addEventListener('change', async () => {
      const theme = elements.themeSelect.value || 'system';
      applyPopupTheme(theme);
      await setStorage({ theme });
    });
    // Header action buttons
    elements.whitelistBtn?.addEventListener('click', quickWhitelist);
    elements.blacklistBtn?.addEventListener('click', quickBlacklist);
    elements.whitelistToggleBtn?.addEventListener('click', toggleWhitelist);

    // Pinned action bar: Allow (pause) / Block (protect) / Pick / Looks-broken
    elements.actAllowBtn?.addEventListener('click', () => setSiteState('paused'));
    elements.actBlockBtn?.addEventListener('click', () => setSiteState('protected'));
    elements.relaxBtn?.addEventListener('click', relaxCosmetic);
    elements.killAllHogsBtn?.addEventListener('click', killAllHogs);
    elements.siteStateProtected?.addEventListener('click', () => setSiteState('protected'));
    elements.siteStateDefault?.addEventListener('click', () => setSiteState('default'));
    elements.siteStatePaused?.addEventListener('click', () => setSiteState('paused'));

    // Listen for live frame updates from the background census.
    api.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'FRAMES_DETECTED' || message.type === 'FRAME_INFO_UPDATED' || message.type === 'CENSUS_UPDATED') {
        loadFrameCensus();
      }
      return false;
    });
  }

  async function init() {
    try {
      // Apply saved theme immediately
      await loadPopupTheme();

      // Get current tab
      const tabs = await new Promise((resolve) => {
        api.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      currentTab = tabs[0];

      // Wire up listeners as soon as the tab is known, BEFORE the slow data
      // loads below — otherwise the first click during init is lost (the
      // "Allow needs two clicks" bug).
      setupEventListeners();

      // Update site display
      if (currentTab?.url) {
        try {
          const url = new URL(currentTab.url);
          if (elements.currentSite) {
            elements.currentSite.textContent = url.hostname;
          }

          // Update security info
          updateSecurityInfo(url);

          // Get security details (also loads the frame census)
          await loadSecurityDetails();

          // Load tracker summary
          await loadTrackerSummary();

          // Load this-site blocking state (protected / default / paused)
          await loadSiteState();
        } catch (e) {
          if (elements.currentSite) {
            elements.currentSite.textContent = 'Unknown site';
          }
        }
      } else {
        if (elements.currentSite) {
          elements.currentSite.textContent = 'No active tab';
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
      }

    } catch (e) {
      logError('Init error:', e);
    }
  }
})();
