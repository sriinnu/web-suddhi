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
    // Certificate owner elements
    certOwnerSection: document.getElementById('certOwnerSection'),
    certOwnerName: document.getElementById('certOwnerName'),
    certOwnerDetails: document.getElementById('certOwnerDetails'),
    // Frames elements
    framesSection: document.getElementById('framesSection'),
    framesCount: document.getElementById('framesCount'),
    framesList: document.getElementById('framesList'),
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
    whitelistToggleBtn: document.getElementById('whitelistToggleBtn')
  };

  // Cross-browser API
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  let currentTab = null;
  let isPickMode = false;
  let isZapMode = false;
  let currentSettings = {};
  let isWhitelisted = false;

  // ============================================
  // CROSS-BROWSER API
  // ============================================
  function getStorage(keys) {
    return new Promise((resolve, reject) => {
      if (api.storage) {
        const result = api.storage.local.get(keys);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
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
    return new Promise((resolve, reject) => {
      if (api.storage) {
        const result = api.storage.local.set(data);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
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

  function extractRequestLog(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.log)) return response.log;
    if (Array.isArray(response?.entries)) return response.entries;
    return [];
  }

  function normalizeFrameList(frames, blocked) {
    if (!Array.isArray(frames)) return [];
    return frames.map((frame) => {
      if (!frame) return null;
      if (typeof frame === 'string') {
        return { host: frame, url: frame, blocked };
      }

      const host = frame.host || frame.hostname || frame.domain;
      if (!host) return null;

      return {
        host,
        url: frame.url || frame.src || frame.frameUrl || host,
        blocked: frame.blocked === true || blocked
      };
    }).filter(Boolean);
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
    }

    // Update feature toggles
    if (elements.networkBlockingToggle) elements.networkBlockingToggle.checked = settings.networkBlockingEnabled !== false;
    if (elements.urlCleaningToggle) elements.urlCleaningToggle.checked = settings.urlCleaningEnabled !== false;
    if (elements.cookieConsentToggle) elements.cookieConsentToggle.checked = settings.cookieConsentEnabled !== false;
    if (elements.annoyanceToggle) elements.annoyanceToggle.checked = settings.annoyanceBlockingEnabled !== false;
    if (elements.paywallToggle) elements.paywallToggle.checked = settings.paywallEnabled !== false;

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

  // Toggle main protection
  async function toggleEnabled() {
    // Click on label fires before browser toggles checkbox, so invert the state
    const enabled = !elements.enableToggle.checked;

    await sendToBackground({ type: 'TOGGLE_ENABLED', enabled });

    // Update status badge
    if (elements.statusBadge) {
      const textEl = elements.statusBadge.querySelector('span:last-child');
      if (textEl) {
        textEl.textContent = enabled ? 'Active' : 'Disabled';
      }
      elements.statusBadge.classList.toggle('disabled', !enabled);
    }

    // Notify content script IMMEDIATELY
    try {
      await sendToContentScript({ type: 'TOGGLE', enabled });
    } catch (e) {
      console.log('Content script not available');
    }

    showToast(enabled ? 'Protection enabled' : 'Protection disabled');
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
    await setStorage({ cookieConsentEnabled: enabled });
    try {
      await sendToContentScript({ type: 'TOGGLE_COOKIE_CONSENT', enabled });
    } catch (e) {}
    showToast(`Cookie blocking ${enabled ? 'enabled' : 'disabled'}`);
  }

  async function toggleAnnoyanceBlocking() {
    const enabled = elements.annoyanceToggle.checked;
    await setStorage({ annoyanceBlockingEnabled: enabled });
    try {
      await sendToContentScript({ type: 'TOGGLE_ANNOYANCE_BLOCKING', enabled });
    } catch (e) {}
    showToast(`Annoyance blocking ${enabled ? 'enabled' : 'disabled'}`);
  }

  async function togglePaywall() {
    const enabled = elements.paywallToggle.checked;
    await sendToBackground({ type: 'TOGGLE_PAYWALL', enabled });
    await sendToContentScript({ type: 'TOGGLE_PAYWALL', enabled });
  }

  async function toggleWhitelist() {
    if (!currentTab?.url) return;

    const hostname = new URL(currentTab.url).hostname;
    const response = await sendToBackground({ type: 'TOGGLE_WHITELIST' });
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
      setButtonContent(elements.pickModeBtn, SVG_PATHS.cancel, 'Cancel Pick');
      elements.pickModeBtn.classList.add('active');
      showToast('Pick mode: Click an element to block');
      await sendToContentScript({ type: 'START_PICK_MODE' });
    } else {
      setButtonContent(elements.pickModeBtn, SVG_PATHS.pick, 'Pick Element');
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
    if (api.runtime.openOptionsPage) {
      api.runtime.openOptionsPage();
    } else {
      const url = api.runtime.getURL('options/options.html');
      if (anchor) {
        window.open(url + '#' + anchor, '_blank');
      } else {
        window.open(url, '_blank');
      }
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
    setTimeout(() => toast.remove(), 2000);
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

    try {
      // Get security info from background
      const securityInfo = await sendToBackgroundWithFallback(
        ['GET_SECURITY_INFO', 'GET_TAB_SECURITY_INFO', 'GET_TAB_SECURITY'],
        { tabId: currentTab.id }
      ) || {};

      // Update certificate owner section
      if (elements.certOwnerSection) {
        const cert = extractCertificate(securityInfo);
        const org = cert?.organization || cert?.org || securityInfo?.organization || '';

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

          // Show the section
          elements.certOwnerSection.style.display = 'block';
        } else {
          elements.certOwnerSection.style.display = 'none';
        }
      }

      let allowedFrames = normalizeFrameList(
        securityInfo?.thirdPartyDomains ||
        securityInfo?.allowedFrames ||
        securityInfo?.frames?.allowed ||
        securityInfo?.frameInfo?.allowed,
        false
      );
      let blockedFrames = normalizeFrameList(
        securityInfo?.blockedFrames ||
        securityInfo?.frames?.blocked ||
        securityInfo?.frameInfo?.blocked,
        true
      );

      // Fallback to content script frame detection for older/newer handlers.
      if (allowedFrames.length === 0 && blockedFrames.length === 0) {
        try {
          const frameResponse = await sendToContentScript({ type: 'GET_FRAMES' });
          const frames = Array.isArray(frameResponse?.frames) ? frameResponse.frames : [];
          allowedFrames = normalizeFrameList(frames.filter(frame => frame?.blocked !== true), false);
          blockedFrames = normalizeFrameList(frames.filter(frame => frame?.blocked === true), true);
        } catch (e) {}
      }

      // Update frames section
      if (elements.framesSection && (allowedFrames.length > 0 || blockedFrames.length > 0)) {
        renderFramesList(allowedFrames, blockedFrames);
        elements.framesSection.style.display = 'block';
      } else if (elements.framesSection) {
        elements.framesSection.style.display = 'none';
      }
    } catch (err) {
      // Silently fail - security info is not critical
    }
  }

  // Get organization from hostname
  function getCertOrganization(hostname) {
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

  // Render frames list
  function renderFramesList(allowed, blocked) {
    if (!elements.framesList) return;

    while (elements.framesList.firstChild) {
      elements.framesList.removeChild(elements.framesList.firstChild);
    }

    // Show blocked frames first
    for (const frame of blocked) {
      const item = document.createElement('div');
      item.className = 'frame-item blocked';

      const host = document.createElement('span');
      host.className = 'frame-host';
      host.textContent = frame.host;
      host.title = frame.url || frame.host;
      item.appendChild(host);

      const allowBtn = document.createElement('button');
      allowBtn.className = 'frame-allow-btn';
      allowBtn.textContent = 'Allow';
      allowBtn.addEventListener('click', () => allowFrame(frame.host, frame.url));
      item.appendChild(allowBtn);

      elements.framesList.appendChild(item);
    }

    // Show allowed frames
    for (const frame of allowed) {
      const item = document.createElement('div');
      item.className = 'frame-item';

      const host = document.createElement('span');
      host.className = 'frame-host';
      host.textContent = frame.host;
      host.title = frame.url || frame.host;
      item.appendChild(host);

      const status = document.createElement('span');
      status.className = 'frame-status allowed';
      status.textContent = 'loaded';
      item.appendChild(status);

      elements.framesList.appendChild(item);
    }

    // Update count
    if (elements.framesCount) {
      elements.framesCount.textContent = allowed.length + blocked.length;
    }
  }

  // Update frames from content script detection
  function updateFramesFromContent(frames) {
    if (!elements.framesList || !frames.length) return;

    // Get existing hosts
    const existingHosts = new Set();
    elements.framesList.querySelectorAll('.frame-host').forEach(el => {
      existingHosts.add(el.textContent);
    });

    // Add new frames
    for (const frame of frames) {
      if (existingHosts.has(frame.host)) continue;

      const item = document.createElement('div');
      item.className = 'frame-item' + (frame.blocked ? ' blocked' : '');

      const host = document.createElement('span');
      host.className = 'frame-host';
      host.textContent = frame.host;
      host.title = frame.src || frame.host;
      item.appendChild(host);

      if (frame.blocked) {
        const allowBtn = document.createElement('button');
        allowBtn.className = 'frame-allow-btn';
        allowBtn.textContent = 'Allow';
        allowBtn.addEventListener('click', () => allowFrame(frame.host, frame.src));
        item.appendChild(allowBtn);
      } else {
        const status = document.createElement('span');
        status.className = 'frame-status allowed';
        status.textContent = 'loaded';
        item.appendChild(status);
      }

      elements.framesList.appendChild(item);
      existingHosts.add(frame.host);
    }

    // Update count
    if (elements.framesCount) {
      elements.framesCount.textContent = existingHosts.size;
    }

    // Show section if we have frames
    if (existingHosts.size > 0 && elements.framesSection) {
      elements.framesSection.style.display = 'block';
    }
  }

  // Allow a blocked frame
  async function allowFrame(host, url) {
    try {
      try {
        await sendToBackgroundWithFallback(
          ['ALLOW_FRAME', 'ALLOW_THIRD_PARTY_FRAME', 'UNBLOCK_FRAME'],
          {
            tabId: currentTab.id,
            frameHost: host,
            frameUrl: url,
            host,
            url
          }
        );
      } catch (e) {}

      // Notify content script to unblock
      await sendToContentScript({
        type: 'ALLOW_FRAME',
        frameHost: host
      });

      showToast('Allowed: ' + host);

      // Refresh the list
      await loadSecurityDetails();
    } catch (e) {
      showToast('Failed to allow frame');
    }
  }

  // ============================================
  // START
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    try {
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
          }

          // Update security info
          updateSecurityInfo(url);

          // Get security details
          await loadSecurityDetails();

          // Load tracker summary
          await loadTrackerSummary();
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

      // Set up event listeners
      // Main protection toggle
      elements.enableToggle?.parentElement?.addEventListener('click', (e) => {
        e.preventDefault();
        toggleEnabled();
      });

      // Feature toggles - use checkbox state after the browser updates it.
      elements.networkBlockingToggle?.addEventListener('change', toggleNetworkBlocking);
      elements.urlCleaningToggle?.addEventListener('change', toggleUrlCleaning);
      elements.cookieConsentToggle?.addEventListener('change', toggleCookieConsent);
      elements.annoyanceToggle?.addEventListener('change', toggleAnnoyanceBlocking);
      elements.paywallToggle?.addEventListener('change', togglePaywall);
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
      // Header action buttons
      elements.whitelistBtn?.addEventListener('click', quickWhitelist);
      elements.blacklistBtn?.addEventListener('click', quickBlacklist);
      elements.whitelistToggleBtn?.addEventListener('click', toggleWhitelist);

      // Listen for messages from content script or background
      api.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Handle incoming messages
        if (message.type === 'FRAMES_DETECTED' || message.type === 'FRAME_INFO_UPDATED') {
          updateFramesFromContent(message.frames || []);
        }

        // Return true to indicate async response
        return false;
      });
    } catch (e) {
      logError('Init error:', e);
    }
  }
})();
