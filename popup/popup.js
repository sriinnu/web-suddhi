// WebSuddhi - Popup Script
// Universal: Chrome, Edge, Firefox, Safari

(function() {
  'use strict';

  // Count-up animation for stat numbers
  function animateCount(element, targetValue) {
    if (!element) return;
    const current = parseInt(element.textContent) || 0;
    if (current === targetValue) return;

    const duration = 600;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(current + (targetValue - current) * eased);
      element.textContent = value.toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

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
    securityMainBtn: document.getElementById('securityMainBtn'),
    certDetailsPanel: document.getElementById('certDetailsPanel'),
    certDetailsGrid: document.getElementById('certDetailsGrid'),
    certDetailsNote: document.getElementById('certDetailsNote'),
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
    whitelistToggleBtn: document.getElementById('whitelistToggleBtn'),
    themeSelect: document.getElementById('themeSelect'),
    // Pause ribbon + split-button + broken-site
    pauseRibbon: document.getElementById('pauseRibbon'),
    pauseRibbonText: document.getElementById('pauseRibbonText'),
    pauseResumeBtn: document.getElementById('pauseResumeBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    pauseMenu: document.getElementById('pauseMenu'),
    reportBrokenBtn: document.getElementById('reportBrokenBtn')
  };

  // Cross-browser API
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  let currentTab = null;
  let isPickMode = false;
  let isZapMode = false;
  let currentSettings = {};
  let isWhitelisted = false;
  let isBlacklisted = false;
  let isPaused = false;
  let pauseExpiry = 0;
  let pauseCountdownTimer = null;
  let currentSecurityContext = null;

  // ============================================
  // THEME
  // ============================================
  async function loadPopupTheme() {
    try {
      const storage = await getStorage(['theme']);
      const theme = storage.theme || 'system';
      applyPopupTheme(theme);
      await populateCustomThemeOptions();
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
      const v = theme || 'system';
      elements.themeSelect.dataset.desiredValue = v;
      elements.themeSelect.value = v;
    }
  }

  function appendCustomThemeOptions(list) {
    if (!elements.themeSelect || !Array.isArray(list) || list.length === 0) return;
    const existing = new Set(
      Array.from(elements.themeSelect.options).map((o) => o.value)
    );
    for (const t of list) {
      if (!t || typeof t.id !== 'string' || existing.has(t.id)) continue;
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name || t.id;
      elements.themeSelect.appendChild(opt);
    }
  }

  function injectCustomThemeCss(themes) {
    if (document.getElementById('websuddhi-custom-themes')) return;
    if (!Array.isArray(themes) || themes.length === 0) return;
    const blocks = [];
    for (const t of themes) {
      if (!t || typeof t.id !== 'string' || !t.tokens || typeof t.tokens !== 'object') continue;
      const safeId = t.id.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeId) continue;
      const decls = [];
      for (const key of Object.keys(t.tokens)) {
        if (!/^--[a-zA-Z0-9_-]+$/.test(key)) continue;
        const val = String(t.tokens[key]).replace(/[<>]/g, '');
        decls.push('  ' + key + ': ' + val + ';');
      }
      if (decls.length === 0) continue;
      blocks.push('[data-theme="' + safeId + '"] {\n' + decls.join('\n') + '\n}');
    }
    if (blocks.length === 0) return;
    const style = document.createElement('style');
    style.id = 'websuddhi-custom-themes';
    style.textContent = blocks.join('\n\n');
    (document.head || document.documentElement).appendChild(style);
  }

  async function populateCustomThemeOptions() {
    if (!elements.themeSelect) return;

    // Fast path: loader already ran
    if (Array.isArray(window.__websuddhiCustomThemes) && window.__websuddhiCustomThemes.length) {
      appendCustomThemeOptions(window.__websuddhiCustomThemes);
      injectCustomThemeCss(window.__websuddhiCustomThemes);
      return;
    }

    // Fallback: fetch themes.json directly. Cheap + deterministic.
    try {
      const url = api.runtime.getURL('shared/themes.json');
      const resp = await fetch(url);
      if (!resp.ok) return;
      const themes = await resp.json();
      if (!Array.isArray(themes)) return;
      window.__websuddhiCustomThemes = themes;
      appendCustomThemeOptions(themes);
      injectCustomThemeCss(themes);
    } catch (e) {
      // Silent — built-in themes still work
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

  let lastSecuritySnapshot = null;

  function detectBrowser() {
    if (typeof browser !== 'undefined' && browser.runtime?.getBrowserInfo) return 'firefox';
    const ua = navigator.userAgent || '';
    if (/Firefox\//.test(ua)) return 'firefox';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'safari';
    return 'chrome';
  }

  function populateCertDetailsPanel() {
    if (!elements.certDetailsGrid || !elements.certDetailsNote) return;
    const info = lastSecuritySnapshot || {};
    const connection = info.connection || {};
    const cert = extractCertificate(info) || {};
    const rows = [];

    const push = (label, value) => {
      if (value === undefined || value === null || value === '') return;
      rows.push([label, String(value)]);
    };

    push('Host', connection.host || connection.normalizedHost);
    push('Protocol', connection.protocol?.replace(':', '').toUpperCase() || (connection.isSecure ? 'HTTPS' : ''));
    push('Organization', cert.organization || cert.org || connection.organization);
    push('Issuer', cert.issuer || cert.issuedBy || info.issuer);
    push('Valid From', cert.validFrom || cert.notBefore);
    push('Valid Until', cert.validTo || cert.notAfter);
    const sans = cert.subjectAltNames || cert.sans || cert.altNames;
    if (Array.isArray(sans) && sans.length > 0) {
      push('Subject Alt Names', sans.slice(0, 8).join(', ') + (sans.length > 8 ? ` (+${sans.length - 8} more)` : ''));
    }
    push('Fingerprint', cert.fingerprint || cert.sha256Fingerprint);

    elements.certDetailsGrid.textContent = '';
    if (rows.length === 0) {
      const dt = document.createElement('dt');
      dt.textContent = 'Status';
      const dd = document.createElement('dd');
      dd.textContent = connection.isSecure ? 'Connection is encrypted' : 'No certificate data available';
      elements.certDetailsGrid.appendChild(dt);
      elements.certDetailsGrid.appendChild(dd);
    } else {
      rows.forEach(([label, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        elements.certDetailsGrid.appendChild(dt);
        elements.certDetailsGrid.appendChild(dd);
      });
    }

    const browserName = detectBrowser();
    let note = '';
    if (!connection.isSecure) {
      note = 'This connection is not encrypted. Avoid entering passwords or payment info.';
    } else if (browserName === 'firefox') {
      note = 'Full certificate chain available. Click the padlock in the address bar to inspect.';
    } else if (browserName === 'safari') {
      note = 'Full chain viewing requires Safari’s Show Certificate dialog (click the padlock in the address bar).';
    } else {
      note = 'For the full certificate chain, click the padlock in the address bar → Connection is secure → Certificate details.';
    }
    elements.certDetailsNote.textContent = note;
  }

  function toggleCertDetails() {
    if (!elements.certDetailsPanel || !elements.securityMainBtn) return;
    const willOpen = elements.certDetailsPanel.hidden;
    if (willOpen) populateCertDetailsPanel();
    elements.certDetailsPanel.hidden = !willOpen;
    elements.securityMainBtn.setAttribute('aria-expanded', String(willOpen));
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
          animateCount(elements.networkBlockedCount, blockedCount.count || 0);
        } catch (e) {
          animateCount(elements.networkBlockedCount, 0);
        }
      } else {
        animateCount(elements.networkBlockedCount, 0);
      }
    }

    // Update rules count
    if (elements.rulesCount) {
      const rulesCount = 100 + (settings.blockedDomains?.length || 0) + (settings.blockedSelectors?.length || 0);
      animateCount(elements.rulesCount, rulesCount);
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
    const label = formatPauseRemaining(pauseExpiry);
    if (!label) {
      // Expired — flip state
      setPausedVisualState(false);
      pauseExpiry = 0;
      refreshTriStateButtons();
      return;
    }
    elements.pauseRibbonText.textContent = 'Paused · ' + label;
  }

  function startCountdown() {
    if (pauseCountdownTimer) clearInterval(pauseCountdownTimer);
    updateRibbonCountdown();
    pauseCountdownTimer = setInterval(updateRibbonCountdown, 30_000);
  }

  async function refreshPauseIndicator() {
    const host = getActiveHostname();
    if (!host) {
      setPausedVisualState(false);
      return;
    }
    try {
      const resp = await sendToBackground({ type: 'IS_PAUSED', hostname: host });
      if (resp?.success && resp.paused) {
        pauseExpiry = resp.expiry || 0;
        setPausedVisualState(true);
        startCountdown();
      } else {
        pauseExpiry = 0;
        setPausedVisualState(false);
      }
    } catch (e) {
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
      isWhitelisted = whitelist.includes(host) || whitelist.includes(currentTab?.url && new URL(currentTab.url).hostname);
      isBlacklisted = blocklist.includes(host);
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
        pauseExpiry = resp.expiresAt || (Date.now() + Number(durationMs));
        setPausedVisualState(true);
        startCountdown();
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

      lastSecuritySnapshot = { ...securityInfo, connection };
      // If panel is already open (e.g. user re-opens popup), refresh it with new data
      if (elements.certDetailsPanel && !elements.certDetailsPanel.hidden) {
        populateCertDetailsPanel();
      }

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

          // Get security details
          await loadSecurityDetails();

          // Load tracker summary
          await loadTrackerSummary();
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

      // Set up event listeners
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
      elements.securityMainBtn?.addEventListener('click', toggleCertDetails);
      elements.themeSelect?.addEventListener('change', async () => {
        const theme = elements.themeSelect.value || 'system';
        applyPopupTheme(theme);
        await setStorage({ theme });
      });
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
        const resp = await sendToBackground({ type: 'UNPAUSE_SITE', hostname: host });
        if (resp?.success) {
          pauseExpiry = 0;
          setPausedVisualState(false);
          showToast('Resumed protection for ' + host);
        } else {
          showToast(resp?.error || 'Failed to resume');
        }
      });
      elements.reportBrokenBtn?.addEventListener('click', handleReportBroken);

      // Listen for messages from content script or background
      api.runtime.onMessage.addListener((message, sender, sendResponse) => {
        // Handle incoming messages
        if (message.type === 'FRAMES_DETECTED' || message.type === 'FRAME_INFO_UPDATED') {
          updateFramesFromContent(message.frames || []);
        }

        if (message.type === 'BLOCKED_COUNT_UPDATED' && currentTab?.id && message.tabId === currentTab.id) {
          if (elements.networkBlockedCount) {
            animateCount(elements.networkBlockedCount, message.count || 0);
          }
          if (elements.dataSaved) {
            const dataSaved = (message.count || 0) * 2.5;
            elements.dataSaved.textContent = dataSaved >= 1024
              ? (dataSaved / 1024).toFixed(1) + ' MB'
              : Math.round(dataSaved) + ' KB';
          }
        }

        // Return true to indicate async response
        return false;
      });
    } catch (e) {
      logError('Init error:', e);
    }
  }
})();
