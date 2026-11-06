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
    // Pause ribbon + split-button + broken-site
    pauseRibbon: document.getElementById('pauseRibbon'),
    pauseRibbonText: document.getElementById('pauseRibbonText'),
    pauseResumeBtn: document.getElementById('pauseResumeBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    pauseMenu: document.getElementById('pauseMenu'),
    reportBrokenBtn: document.getElementById('reportBrokenBtn'),
    // v2 layout
    ringSegs: document.getElementById('ringSegs'),
    ringCount: document.getElementById('ringCount'),
    ringLegend: document.getElementById('ringLegend'),
    verdict: document.getElementById('verdict'),
    siteStateWhy: document.getElementById('siteStateWhy'),
    brokenBtn: document.getElementById('brokenBtn'),
    fixLadder: document.getElementById('fixLadder'),
    activityFeed: document.getElementById('activityFeed'),
    activityEmpty: document.getElementById('activityEmpty'),
    activityCount: document.getElementById('activityCount'),
    framesTabCount: document.getElementById('framesTabCount'),
    framesEmpty: document.getElementById('framesEmpty'),
    safetyMeta: document.getElementById('safetyMeta'),
    featMeta: document.getElementById('featMeta'),
    paletteDots: document.getElementById('paletteDots'),
    paletteName: document.getElementById('paletteName'),
    modeSeg: document.getElementById('modeSeg')
  };

  // Cross-browser API
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  // Show the build version from the manifest, so every reload shows which build is loaded.
  try {
    const manifest = api.runtime.getManifest();
    const label = 'v' + (manifest.version_name || manifest.version);
    document.querySelectorAll('.version').forEach((el) => { el.textContent = label; });
  } catch (e) { /* no manifest outside the extension */ }

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
  // A theme is a palette (colour family) plus a mode (system, light, dark).
  // shared/palettes.js holds both lists; theme-loader.js has already applied
  // the saved choice by the time this runs, so this only fills the controls.
  const Themes = window.WebSuddhiThemes;
  let themeState = { palette: 'suddhi', colorMode: 'system' };

  function availablePalettes() {
    const list = Themes ? Themes.ORDER.map((id) => ({ id, name: Themes.PALETTES[id].name })) : [];
    const custom = Array.isArray(window.__websuddhiCustomThemes) ? window.__websuddhiCustomThemes : [];
    for (const t of custom) {
      if (t && t.id && !list.some((p) => p.id === t.id)) list.push({ id: t.id, name: t.name || t.id });
    }
    return list;
  }

  // The swatch for a palette: its accent in the mode the popup is showing.
  function paletteSwatch(id) {
    const pal = Themes && Themes.PALETTES[id];
    if (!pal) return null;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.hasAttribute('data-theme') && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    const v = dark ? pal.dark : pal.light;
    return { accent: v.accent, bg: v.bg };
  }

  // One round button per palette. Custom palettes get a neutral swatch.
  function fillPaletteDots() {
    const box = elements.paletteDots;
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    for (const p of availablePalettes()) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dot';
      btn.dataset.palette = p.id;
      btn.title = p.name;
      btn.setAttribute('aria-label', p.name);
      btn.setAttribute('aria-pressed', 'false');
      const swatch = document.createElement('i');
      const colours = paletteSwatch(p.id);
      if (colours) swatch.style.background = 'linear-gradient(135deg, ' + colours.bg + ' 0 50%, ' + colours.accent + ' 50% 100%)';
      else swatch.style.background = 'var(--c4)';
      btn.appendChild(swatch);
      box.appendChild(btn);
    }
  }

  function syncThemeControls() {
    if (elements.paletteDots) {
      for (const btn of elements.paletteDots.querySelectorAll('.dot')) {
        btn.setAttribute('aria-pressed', String(btn.dataset.palette === themeState.palette));
      }
    }
    if (elements.paletteName) {
      const match = availablePalettes().find((p) => p.id === themeState.palette);
      elements.paletteName.textContent = match ? match.name : '';
    }
    if (elements.modeSeg) {
      for (const btn of elements.modeSeg.querySelectorAll('button[data-mode]')) {
        btn.setAttribute('aria-pressed', String(btn.dataset.mode === themeState.colorMode));
      }
    }
  }

  async function loadPopupTheme() {
    fillPaletteDots();
    window.addEventListener('websuddhi:custom-themes-loaded', () => {
      fillPaletteDots();
      syncThemeControls();
    });
    if (!Themes) return;
    try {
      const stored = await getStorage(['palette', 'colorMode', 'theme']);
      themeState = Themes.resolve(stored, (id) => typeof id === 'string' && Themes.safeId(id) === id && id !== '');
      Themes.apply(document, themeState.palette, themeState.colorMode);
      if (themeState.migrated) {
        await setStorage({ palette: themeState.palette, colorMode: themeState.colorMode });
      }
    } catch (e) {
      // Keep the default palette.
    }
    syncThemeControls();
  }

  async function setTheme(change) {
    if (!Themes) return;
    themeState = {
      palette: change.palette || themeState.palette || Themes.DEFAULT_PALETTE,
      colorMode: change.colorMode || themeState.colorMode || 'system'
    };
    Themes.apply(document, themeState.palette, themeState.colorMode);
    // Swatches follow the mode, so redraw them when it changes.
    if (change.colorMode) fillPaletteDots();
    syncThemeControls();
    await setStorage({ palette: themeState.palette, colorMode: themeState.colorMode });
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

  // A sleeping/absent background worker must never take the popup down with it.
  function isConnectionError(err) {
    const text = String((err && (err.message || err)) || '');
    return text.includes('Receiving end does not exist') ||
      text.includes('Could not establish connection') ||
      text.includes('message port closed');
  }

  function sendToBackground(message) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (response) => {
        if (settled) return;
        settled = true;
        resolve(response === undefined ? null : response);
      };
      const fail = (err) => {
        if (settled) return;
        settled = true;
        if (isConnectionError(err)) resolve(null);
        else reject(err);
      };

      try {
        const result = api.runtime.sendMessage(message);
        if (result && typeof result.then === 'function') {
          result.then(done).catch(fail);
          return;
        }
        // Callback-style API (Chrome MV2 and older): re-send once with the callback.
        const retried = api.runtime.sendMessage(message, (response) => {
          const lastError = api.runtime.lastError;
          if (lastError) fail(lastError);
          else done(response);
        });
        if (retried && typeof retried.then === 'function') {
          retried.then(done).catch(fail);
        }
      } catch (err) {
        fail(err);
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

    // Colours come from the palette (status-badge / .is-off), never inline.
    elements.statusBadge.className = enabled ? 'status-badge' : 'status-badge disabled is-off';
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

    // Blocked on this tab: one request for the ring and the totals.
    let counts = { count: 0, network: 0, cosmetic: 0 };
    if (tabId) {
      try {
        const resp = await sendToBackground({ type: 'GET_BLOCKED_COUNT', tabId });
        const total = Number(resp?.count) || 0;
        const network = Number.isFinite(resp?.network) ? resp.network : total;
        const cosmetic = Number.isFinite(resp?.cosmetic) ? resp.cosmetic : Math.max(0, total - network);
        counts = { count: total, network, cosmetic };
      } catch (e) { /* keep zeros */ }
    }
    renderCounts(counts);

    // Update rules count
    if (elements.rulesCount) {
      const rulesCount = 100 + (settings.blockedDomains?.length || 0) + (settings.blockedSelectors?.length || 0);
      animateCount(elements.rulesCount, rulesCount);
    }

    updateFeatureMeta();
    setStatusBadgeState(settings.enabled !== false);
    updateVerdict();
  }

  let tabCounts = { count: 0, network: 0, cosmetic: 0 };

  function renderCounts(counts) {
    tabCounts = counts;
    animateCount(elements.ringCount, counts.count);
    animateCount(elements.networkBlockedCount, counts.network);
    animateCount(elements.cosmeticBlockedCount, counts.cosmetic);
    if (elements.dataSaved) {
      // Rough estimate: 2.5 KB per blocked request.
      const kb = counts.network * 2.5;
      elements.dataSaved.textContent = kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB';
    }
    updateVerdict();
  }

  // "4 of 6 on" next to Features and look.
  function updateFeatureMeta() {
    if (!elements.featMeta) return;
    const toggles = [elements.networkBlockingToggle, elements.urlCleaningToggle, elements.cookieConsentToggle,
      elements.annoyanceToggle, elements.socialBlockingToggle, elements.paywallToggle].filter(Boolean);
    const on = toggles.filter((t) => t.checked).length;
    elements.featMeta.textContent = on + ' of ' + toggles.length + ' on';
  }

  // ============================================
  // HERO: verdict, ring and the per-site explanation
  // ============================================
  let siteStateValue = 'default';

  const STATE_WHY = {
    protected: 'Also stops heavy frames. Use it on sites you do not trust.',
    default: 'Blocks known ads and trackers, and hides cookie popups.',
    paused: 'Nothing is blocked on this site until you turn it back on.'
  };

  function updateVerdict() {
    const el = elements.verdict;
    if (!el) return;
    let text;
    let off = false;
    if (elements.enableToggle && !elements.enableToggle.checked) {
      text = 'WebSuddhi is off on every site';
      off = true;
    } else if (siteStateValue === 'paused') {
      text = 'Blocking is off here';
      off = true;
    } else if (!currentTab?.url || !/^https?:/.test(currentTab.url)) {
      text = 'Nothing to block on this page';
    } else if (siteStateValue === 'protected') {
      text = 'Strict blocking on this page';
    } else if (tabCounts.count > 0) {
      text = 'This page is protected';
    } else {
      text = 'Watching this page';
    }
    el.textContent = text;
    el.classList.toggle('is-off', off);
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const RING_R = 54;
  const RING_C = 2 * Math.PI * RING_R;

  // Draws up to four category arcs plus "other". Shares come from the recent
  // log for this site; the number in the middle is the live tab count.
  function renderRing(categories) {
    const segs = elements.ringSegs;
    const legend = elements.ringLegend;
    if (segs) while (segs.firstChild) segs.removeChild(segs.firstChild);
    if (legend) while (legend.firstChild) legend.removeChild(legend.firstChild);

    const total = categories.reduce((sum, c) => sum + c.count, 0);
    if (!total) {
      if (legend) {
        const quiet = document.createElement('div');
        quiet.className = 'quiet';
        quiet.textContent = 'Nothing logged here yet';
        legend.appendChild(quiet);
      }
      return;
    }

    const top = categories.slice(0, 3);
    const rest = categories.slice(3).reduce((sum, c) => sum + c.count, 0);
    if (rest) top.push({ name: 'Other', count: rest });

    const gap = top.length > 1 ? 3 : 0;
    let offset = 0;
    top.forEach((cat, i) => {
      const len = (cat.count / total) * RING_C;
      if (segs) {
        const arc = document.createElementNS(SVG_NS, 'circle');
        arc.setAttribute('class', 'seg-arc');
        arc.setAttribute('cx', '64');
        arc.setAttribute('cy', '64');
        arc.setAttribute('r', String(RING_R));
        arc.style.stroke = 'var(--c' + (i + 1) + ')';
        arc.setAttribute('stroke-dasharray', Math.max(0, len - gap) + ' ' + (RING_C - Math.max(0, len - gap)));
        arc.setAttribute('stroke-dashoffset', String(-offset));
        segs.appendChild(arc);
      }
      offset += len;
      if (legend) {
        const row = document.createElement('div');
        const swatch = document.createElement('i');
        swatch.style.background = 'var(--c' + (i + 1) + ')';
        const name = document.createElement('span');
        name.textContent = cat.name;
        const count = document.createElement('b');
        count.textContent = String(cat.count);
        row.append(swatch, name, count);
        legend.appendChild(row);
      }
    });
  }

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
        elements.blockedList.innerHTML = '<div class="blocked-empty">No network requests blocked yet</div>'; // omit-allow: static markup, no interpolation
      }

      elements.blockedPanel.style.display = 'block';
    } catch (e) {
      elements.blockedList.innerHTML = '<div class="blocked-empty">Error loading stats</div>'; // omit-allow: static markup, no interpolation
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
        elements.blockedList.innerHTML = '<div class="blocked-empty">No elements blocked yet</div>'; // omit-allow: static markup, no interpolation
      }

      elements.blockedPanel.style.display = 'block';
    } catch (e) {
      elements.blockedList.innerHTML = '<div class="blocked-empty">Error loading stats</div>'; // omit-allow: static markup, no interpolation
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
              <div class="blocked-item-type ${escapeHtml(type)}">${escapeHtml(domain)} • ${escapeHtml(category)}</div>
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
              <div class="blocked-item-type ${escapeHtml(type)}">${escapeHtml(site)} ${date ? '• ' + date : ''}</div>
            </div>
            <button class="blocked-unblock" data-selector="${escapeHtml(selector)}">Unblock</button>
          </div>
        `;
      }
    }).join('');

    elements.blockedList.innerHTML = html; // omit-allow: every interpolated value goes through escapeHtml

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
    // The key/value row carries the verdict; the long text only shows when it matters.
    const riskChip = document.getElementById('kvRisk');
    if (riskChip) {
      const chipKind = { safe: 'good', low: 'warn', medium: 'warn', high: 'bad' }[badgeClass] || '';
      riskChip.className = 'chip' + (chipKind ? ' ' + chipKind : '');
      riskChip.textContent = badgeClass === 'safe' ? 'Low' : badgeText;
      riskChip.title = detailsText;
    }
    elements.phishingRiskSection.style.display = (isSuspicious || risk.evaluationError) ? 'block' : 'none';

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
    const insecure = elements.siteInfoSection.classList.contains('insecure');
    setSafetyMeta(insecure ? 'Not secure' : 'Secure', insecure ? 'bad' : 'good');
  }

  // The chip on the closed "Site safety" row.
  function setSafetyMeta(label, kind) {
    const meta = elements.safetyMeta;
    if (!meta) return;
    while (meta.firstChild) meta.removeChild(meta.firstChild);
    const chip = document.createElement('span');
    chip.className = 'chip ' + kind;
    chip.textContent = label;
    meta.appendChild(chip);
  }

  // ============================================
  // ACTIVITY: this site's part of the request log drives the ring, the
  // legend and the Activity tab. The log is global, so filter by site.
  // ============================================
  const bareHost = (value) => String(value || '').toLowerCase().replace(/^www\./, '');

  function shortTime(ts) {
    const diff = Date.now() - (Number(ts) || 0);
    if (!ts || diff < 0) return '';
    if (diff < 60_000) return 'now';
    if (diff < 3_600_000) return Math.round(diff / 60_000) + ' min ago';
    if (diff < 86_400_000) return Math.round(diff / 3_600_000) + ' hr ago';
    return new Date(ts).toLocaleDateString();
  }

  // Counts arrive in bursts while a page loads; refresh the log at most once a second.
  let activityTimer = null;
  function scheduleActivityRefresh() {
    if (activityTimer) return;
    activityTimer = setTimeout(() => { activityTimer = null; loadActivity(); }, 1000);
  }

  async function loadActivity() {
    const host = getActiveHostname();
    let entries = [];
    try {
      const response = await sendToBackgroundWithFallback(['GET_REQUEST_LOG', 'REQUEST_LOG']);
      entries = extractRequestLog(response).filter((e) => host && bareHost(e?.site) === host);
      hostCategory.clear();
      for (const e of entries) {
        const h = e.type === 'cosmetic' ? '' : extractDomain(e.url);
        if (h && e.category && !hostCategory.has(h)) hostCategory.set(h, e.category);
      }
    } catch (e) {
      entries = [];
    }

    // Ring: counts per category.
    const byCategory = new Map();
    for (const e of entries) {
      const name = e.category && e.category !== 'Unknown' ? e.category : (e.type === 'cosmetic' ? 'Hidden' : 'Other');
      byCategory.set(name, (byCategory.get(name) || 0) + 1);
    }
    const categories = Array.from(byCategory, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    renderRing(categories);
    renderFeed(entries.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 200));
    if (tabConnections) renderFirewall();
  }

  // Two-letter marks for the activity groups.
  const CATEGORY_MARK = {
    Advertising: 'Ad', Analytics: 'An', Social: 'So', Tracking: 'Tr', Cookie: 'Ck',
    Annoyance: 'Po', Hidden: 'Hd', Malware: 'Mw', Phishing: 'Ph', Cryptomining: 'Cm', Other: 'Ot'
  };
  function categoryMark(name) {
    return CATEGORY_MARK[name] || String(name || '?').slice(0, 2).replace(/^./, (c) => c.toUpperCase());
  }

  function groupTitle(group) {
    const n = group.items.length;
    if (group.cosmetic) return 'Hid ' + n + (n === 1 ? ' page element' : ' page elements');
    const what = group.name === 'Other' ? '' : group.name.toLowerCase() + ' ';
    return 'Stopped ' + n + ' ' + what + (n === 1 ? 'request' : 'requests');
  }

  function buildFeedItem(entry) {
    const cosmetic = entry.type === 'cosmetic';
    const item = document.createElement('li');
    item.className = 'evi';
    const label = document.createElement('span');
    const target = cosmetic ? entry.selector : extractDomain(entry.url) || entry.url;
    label.textContent = target || 'unknown';
    label.title = cosmetic ? (entry.selector || '') : (entry.url || '');
    const when = document.createElement('small');
    when.textContent = shortTime(entry.timestamp);
    const allow = document.createElement('button');
    allow.type = 'button';
    allow.className = 'link';
    allow.textContent = 'Allow';
    allow.title = cosmetic ? 'Stop hiding this on this site' : 'Allow this host on every site';
    allow.addEventListener('click', async () => {
      allow.disabled = true;
      const ok = await allowActivityEntry(entry);
      if (ok) {
        item.classList.add('undone');
        allow.textContent = 'Allowed';
        showToast('Allowed. Reload the page to see it.');
      } else {
        allow.disabled = false;
      }
    });
    item.append(label, when, allow);
    return item;
  }

  function renderFeed(entries) {
    const feed = elements.activityFeed;
    if (!feed) return;
    while (feed.firstChild) feed.removeChild(feed.firstChild);
    if (elements.activityCount) elements.activityCount.textContent = String(entries.length);
    if (elements.activityEmpty) elements.activityEmpty.hidden = entries.length > 0;

    // One row per category, newest group first; the hosts sit under it.
    const groups = new Map();
    for (const entry of entries) {
      const cosmetic = entry.type === 'cosmetic';
      const name = entry.category && entry.category !== 'Unknown' ? entry.category : (cosmetic ? 'Hidden' : 'Other');
      const key = (cosmetic ? 'c:' : 'n:') + name;
      if (!groups.has(key)) groups.set(key, { name, cosmetic, items: [] });
      groups.get(key).items.push(entry);
    }

    for (const group of groups.values()) {
      const row = document.createElement('div');
      row.className = 'ev';

      const icon = document.createElement('span');
      icon.className = 'ic' + (group.cosmetic ? ' hid' : '');
      icon.textContent = categoryMark(group.name);
      icon.setAttribute('aria-hidden', 'true');

      const text = document.createElement('div');
      text.className = 't';
      const title = document.createElement('span');
      title.textContent = groupTitle(group);
      const meta = document.createElement('small');
      const names = Array.from(new Set(group.items.map((e) => (e.type === 'cosmetic' ? e.selector : extractDomain(e.url) || e.url)).filter(Boolean)));
      meta.textContent = names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) : '');
      meta.title = names.join('\n');
      text.append(title, meta);

      const list = document.createElement('ul');
      list.className = 'evlist';
      list.hidden = true;
      for (const entry of group.items) list.appendChild(buildFeedItem(entry));

      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'link';
      more.textContent = 'Details';
      more.setAttribute('aria-expanded', 'false');
      more.addEventListener('click', () => {
        list.hidden = !list.hidden;
        more.setAttribute('aria-expanded', String(!list.hidden));
        more.textContent = list.hidden ? 'Details' : 'Hide';
      });

      row.append(icon, text, more);
      feed.append(row, list);
    }
  }

  async function allowActivityEntry(entry) {
    try {
      let resp;
      if (entry.type === 'cosmetic') {
        resp = await sendToBackground({ type: 'ALLOW_SELECTOR_ON_SITE', hostname: getActiveHostname(), selector: entry.selector });
      } else {
        resp = await sendToBackground({ type: 'UNBLOCK_REQUEST', url: entry.url });
      }
      if (resp && resp.success === false) throw new Error(resp.error || 'failed');
      return true;
    } catch (e) {
      showToast('Could not allow it');
      return false;
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

      // Frames are owned by the live census panel (loadFrameCensus), not here.
      await loadFrameCensus();
      await loadConnections();
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

  // ---- Connections: server address, headers, certificate, other hosts ----
  let tabConnections = null;
  const hostCategory = new Map();

  function setText(id, text, title) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = text;
    if (title !== undefined) node.title = title;
  }

  function daysUntil(ms) {
    return Math.round((Number(ms) - Date.now()) / 86_400_000);
  }

  function certSummary(cert, connection) {
    if (cert && cert.validTo) {
      const issuer = String(cert.issuer || '').match(/O=([^,]+)/)?.[1] || cert.issuer || 'Unknown issuer';
      const days = daysUntil(cert.validTo);
      return issuer + (days >= 0 ? ', valid ' + days + (days === 1 ? ' day' : ' days') : ', expired');
    }
    if (connection && connection.isSecure) return 'Valid (browser checked)';
    return 'None';
  }

  async function loadConnections() {
    if (!currentTab || !currentTab.id) return;
    let connections = null;
    try {
      const resp = await sendToBackground({ type: 'GET_TAB_CONNECTIONS', tabId: currentTab.id });
      connections = resp && resp.success ? resp.connections : null;
    } catch (e) {
      connections = null;
    }
    tabConnections = connections || { mainHost: '', mainIp: null, server: null, hsts: false, cert: null, hosts: [] };
    const conn = (lastSecuritySnapshot && lastSecuritySnapshot.connection) || {};
    const seen = !!(tabConnections.mainIp || tabConnections.hosts.length);
    const cert = tabConnections.cert;

    let connText = conn.isFile ? 'Local file' : (conn.isSecure ? 'HTTPS' : (conn.protocol === 'http:' ? 'HTTP, not encrypted' : 'Unknown'));
    if (cert && cert.protocolVersion) connText += ', ' + cert.protocolVersion.replace('TLSv', 'TLS ');
    setText('kvConnection', connText, cert && cert.cipherSuite ? cert.cipherSuite : '');
    setText('kvIp', tabConnections.mainIp || (seen ? 'Hidden by the browser' : 'Reload the page to see it'));
    const serverRow = document.getElementById('kvServerRow');
    if (serverRow) serverRow.hidden = !tabConnections.server;
    setText('kvServer', tabConnections.server || '');
    setText('kvHsts', seen ? (tabConnections.hsts ? 'On' : 'Off') : 'Unknown');
    setText('kvCert', certSummary(cert, conn), cert && cert.subject ? cert.subject : '');

    // Fold the real certificate into the details panel.
    if (cert && lastSecuritySnapshot) {
      lastSecuritySnapshot.certificate = Object.assign({}, lastSecuritySnapshot.certificate || {}, {
        organization: String(cert.subject || '').match(/O=([^,]+)/)?.[1] || undefined,
        issuer: cert.issuer || undefined,
        validFrom: cert.validFrom ? new Date(cert.validFrom).toLocaleDateString() : undefined,
        validTo: cert.validTo ? new Date(cert.validTo).toLocaleDateString() : undefined
      });
    }

    const others = tabConnections.hosts.filter((h) => !h.firstParty);
    setText('kvThird', String(others.length));
    const list = document.getElementById('safetyHosts');
    if (list) {
      list.textContent = '';
      for (const h of others.slice(0, 8)) {
        const row = document.createElement('div');
        row.className = 'hl';
        const name = document.createElement('span');
        name.className = 'mono';
        name.textContent = h.host;
        name.title = h.host;
        const info = document.createElement('small');
        info.textContent = [h.ips && h.ips[0], h.blocked ? h.blocked + ' blocked' : h.count + ' req'].filter(Boolean).join(' · ');
        row.append(name, info);
        list.appendChild(row);
      }
      list.hidden = others.length === 0;
    }

    await loadFirewall();
  }

  // ---- Firewall matrix: hosts on this page × request types ----
  const FW_COLS = [['script', 'Script'], ['frame', 'Frame'], ['xhr', 'XHR'], ['image', 'Image']];
  let fwRules = {};
  const fwPending = new Map();
  const fwKey = (host, type) => host + '\n' + type;

  async function loadFirewall() {
    const site = getActiveHostname();
    if (!site) return;
    try {
      const resp = await sendToBackground({ type: 'GET_FIREWALL_RULES', site });
      fwRules = resp && resp.success && resp.rules ? resp.rules : {};
    } catch (e) {
      fwRules = {};
    }
    renderFirewall();
  }

  function fwSaved(host, type) {
    return (fwRules[host] && fwRules[host][type]) || null;
  }

  function fwOwn(host, type) {
    const k = fwKey(host, type);
    return fwPending.has(k) ? fwPending.get(k) : fwSaved(host, type);
  }

  // What the filter lists did to this host, as far as we saw.
  function fwListDecision(h) {
    if (!h || !h.count) return null;
    if (!h.blocked) return 'allow';
    return h.blocked >= h.count ? 'block' : null;
  }

  function fwCell(host, type, label, eff, mine, dirty) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cell';
    if (eff) b.dataset.e = eff;
    b.dataset.mine = mine ? '1' : '0';
    if (dirty) b.dataset.dirty = '1';
    b.setAttribute('aria-label', host + ' ' + label + ': ' + (eff || 'mixed') + (mine ? ', your rule' : ', from filter lists'));
    return b;
  }

  function fwToggle(host, type, eff) {
    const k = fwKey(host, type);
    const own = fwOwn(host, type);
    const next = own ? null : (eff === 'block' ? 'allow' : 'block');
    if (next === fwSaved(host, type)) fwPending.delete(k);
    else fwPending.set(k, next);
    renderFirewall();
  }

  function renderFirewall() {
    const body = document.getElementById('firewallBody');
    if (!body) return;
    body.textContent = '';
    const hosts = (tabConnections && tabConnections.hosts ? tabConnections.hosts : []).slice();
    // Hosts with a rule stay listed even when this load did not contact them.
    for (const host of Object.keys(fwRules)) {
      if (host !== '*' && !hosts.some((h) => h.host === host)) hosts.push({ host, firstParty: false, count: 0, blocked: 0, types: {} });
    }
    const groups = [
      ['This site', hosts.filter((h) => h.firstParty)],
      ['Other sites', hosts.filter((h) => !h.firstParty).slice(0, 30)]
    ];

    for (const [label, rows] of groups) {
      if (!rows.length) continue;
      const gtr = document.createElement('tr');
      gtr.className = 'grp';
      const gtd = document.createElement('td');
      gtd.colSpan = 6;
      gtd.textContent = label;
      gtr.appendChild(gtd);
      body.appendChild(gtr);

      for (const h of rows) {
        const tr = document.createElement('tr');
        const head = document.createElement('td');
        head.className = 'h';
        const name = document.createElement('div');
        name.textContent = h.host;
        name.title = h.host + (h.ips && h.ips.length ? '\n' + h.ips.join(', ') : '');
        const sub = document.createElement('small');
        const cat = hostCategory.get(h.host);
        let seenText = 'not seen this load';
        if (h.count && h.blocked >= h.count) seenText = h.blocked + ' blocked';
        else if (h.count && h.blocked) seenText = h.count + ' req, ' + h.blocked + ' blocked';
        else if (h.count) seenText = h.count + (h.count === 1 ? ' request' : ' requests');
        sub.textContent = [cat ? cat.toLowerCase() : (h.firstParty ? 'the page' : ''), seenText].filter(Boolean).join(' · ');
        head.append(name, sub);
        tr.appendChild(head);

        const list = fwListDecision(h);
        const allOwn = fwOwn(h.host, '*');
        const allEff = allOwn || list;
        const all = fwCell(h.host, '*', 'all types', allEff, !!allOwn, fwPending.has(fwKey(h.host, '*')));
        if (h.firstParty) {
          all.disabled = true;
          all.title = 'The page itself cannot be blocked here. Use Strict.';
        } else {
          all.addEventListener('click', () => fwToggle(h.host, '*', allEff));
        }
        const allTd = document.createElement('td');
        allTd.appendChild(all);
        tr.appendChild(allTd);

        for (const [type, colLabel] of FW_COLS) {
          const own = fwOwn(h.host, type);
          const eff = own || allOwn || list;
          const c = fwCell(h.host, type, colLabel, eff, !!(own || allOwn), fwPending.has(fwKey(h.host, type)));
          c.addEventListener('click', () => fwToggle(h.host, type, eff));
          const td = document.createElement('td');
          td.appendChild(c);
          tr.appendChild(td);
        }
        body.appendChild(tr);
      }
    }

    const third = hosts.filter((h) => !h.firstParty).length;
    setText('firewallTabCount', String(third));
    const any = hosts.length > 0;
    const table = document.getElementById('firewallTable');
    if (table) table.hidden = !any;
    const key = document.getElementById('firewallKey');
    if (key) key.hidden = !any;
    const empty = document.getElementById('firewallEmpty');
    if (empty) empty.hidden = any;
    const foot = document.getElementById('firewallFoot');
    if (foot) foot.hidden = Object.keys(fwRules).length === 0;

    const n = fwPending.size;
    const commit = document.getElementById('firewallCommit');
    if (commit) commit.hidden = n === 0;
    setText('firewallChanges', n + (n === 1 ? ' change' : ' changes'));
    setText('firewallScope', 'on ' + getActiveHostname());
  }

  async function saveFirewall() {
    const site = getActiveHostname();
    if (!site || fwPending.size === 0) return;
    let failed = 0;
    for (const [k, action] of fwPending) {
      const [host, type] = k.split('\n');
      try {
        const resp = await sendToBackground({ type: 'SET_FIREWALL_RULE', site, host, requestType: type, action });
        if (resp && resp.success) fwRules = resp.rules || fwRules;
        else failed++;
      } catch (e) {
        failed++;
      }
    }
    fwPending.clear();
    renderFirewall();
    if (failed) {
      showToast(failed + ' rule' + (failed === 1 ? '' : 's') + ' could not be saved');
      return;
    }
    showToast('Saved. Reloading the page.');
    try { await api.tabs.reload(currentTab.id); } catch (e) { /* tab may be gone */ }
  }

  async function resetFirewall() {
    const site = getActiveHostname();
    if (!site) return;
    try {
      await sendToBackground({ type: 'RESET_FIREWALL_SITE', site });
    } catch (e) {
      showToast('Could not clear the rules');
      return;
    }
    fwPending.clear();
    fwRules = {};
    renderFirewall();
    showToast('Your rules for ' + site + ' are cleared. Reload to apply.');
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
    if (elements.framesTabCount) elements.framesTabCount.textContent = String(frames.length);
    if (elements.framesEmpty) elements.framesEmpty.hidden = frames.length > 0;
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
      if (!map[key]) continue;
      map[key].classList.toggle('is-active', key === stateValue);
      map[key].setAttribute('aria-pressed', String(key === stateValue));
    }
    // The ladder's "Turn off" step reads as done while the site is off.
    if (elements.actAllowBtn) {
      elements.actAllowBtn.classList.toggle('is-active', stateValue === 'paused');
      elements.actAllowBtn.closest('.step')?.classList.toggle('done', stateValue === 'paused');
    }
    if (elements.actBlockBtn) elements.actBlockBtn.classList.toggle('is-active', stateValue === 'protected');
    siteStateValue = STATE_WHY[stateValue] ? stateValue : 'default';
    if (elements.siteStateWhy) elements.siteStateWhy.textContent = STATE_WHY[siteStateValue];
    updateVerdict();
  }

  async function loadSiteState() {
    if (!currentTab?.url) return;
    try {
      const hostname = new URL(currentTab.url).hostname;
      const resp = await sendToBackground({ type: 'GET_SITE_STATE', hostname });
      applySiteState(resp);
    } catch (e) { /* non-http */ }
  }

  async function setSiteState(stateValue) {
    if (!currentTab?.url) return;
    try {
      const hostname = new URL(currentTab.url).hostname;
      const resp = await sendToBackground({ type: 'SET_SITE_STATE', hostname, state: stateValue, tabId: currentTab.id });
      if (!resp?.success) throw new Error(resp?.error || 'failed');
      applySiteState(resp);
      refreshTriStateButtons();
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
    for (const t of [elements.networkBlockingToggle, elements.urlCleaningToggle, elements.cookieConsentToggle,
      elements.annoyanceToggle, elements.socialBlockingToggle, elements.paywallToggle]) {
      t?.addEventListener('change', updateFeatureMeta);
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

})();
