// WebSuddhi - Options Page Script
// Universal: Chrome, Edge, Firefox, Safari

(function() {
  'use strict';

  // Logging helpers
  const logError = (...args) => {
    console.error('[WebSuddhi]', ...args);
    if (self.WebSuddhi && self.WebSuddhi.utils && self.WebSuddhi.utils.error) {
      self.WebSuddhi.utils.error(...args);
    } else {
      console.error('[WebSuddhi]', ...args);
    }
  };

  // DOM helpers
  const clearElement = (el) => {
    if (!el) return;
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  };

  // Cross-browser API
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  const elements = {
    // Settings toggles
    enableProtection: document.getElementById('enableProtection'),
    enablePaywall: document.getElementById('enablePaywall'),
    enableNetworkBlocking: document.getElementById('enableNetworkBlocking'),
    enableUrlCleaning: document.getElementById('enableUrlCleaning'),
    enableCookieConsent: document.getElementById('enableCookieConsent'),
    enableAnnoyanceBlocking: document.getElementById('enableAnnoyanceBlocking'),
    enableSocialBlocking: document.getElementById('enableSocialBlocking'),
    enablePingProtection: document.getElementById('enablePingProtection'),
    enableReferrerStripping: document.getElementById('enableReferrerStripping'),
    enableWebRTCProtection: document.getElementById('enableWebRTCProtection'),
    enablePhishingProtection: document.getElementById('enablePhishingProtection'),
    enableTelemetryBlocking: document.getElementById('enableTelemetryBlocking'),
    enableThirdPartyCookieBlocking: document.getElementById('enableThirdPartyCookieBlocking'),
    enableSync: document.getElementById('enableSync'),
    syncDescription: document.getElementById('syncDescription'),
    languageFilters: document.getElementById('languageFilters'),
    // Rules
    rulesList: document.getElementById('rulesList'),
    rulesCount: document.getElementById('rulesCount'),
    navRulesCount: document.getElementById('navRulesCount'),
    emptyState: document.getElementById('emptyState'),
    siteInput: document.getElementById('siteInput'),
    addSiteBtn: document.getElementById('addSiteBtn'),
    whitelistList: document.getElementById('whitelistList'),
    // Stats
    networkBlocked: document.getElementById('networkBlocked'),
    cosmeticBlocked: document.getElementById('cosmeticBlocked'),
    totalBlocked: document.getElementById('totalBlocked'),
    dataSavedTotal: document.getElementById('dataSavedTotal'),
    topDomainsChart: document.getElementById('topDomainsChart'),
    topSitesChart: document.getElementById('topSitesChart'),
    categoryChart: document.getElementById('categoryChart'),
    trendChart: document.getElementById('trendChart'),
    resetStatsBtn: document.getElementById('resetStatsBtn'),
    // Import/Export
    themeToggle: document.getElementById('themeToggle'),
    exportBtn: document.getElementById('exportBtn'),
    exportBackupBtn: document.getElementById('exportBackupBtn'),
    importBtn: document.getElementById('importBtn'),
    importBackupBtn: document.getElementById('importBackupBtn'),
    importFile: document.getElementById('importFile'),
    importBackupFile: document.getElementById('importBackupFile'),
    importExportStatus: document.getElementById('importExportStatus'),
    // Filter lists
    filterListItems: document.getElementById('filterListItems'),
    subscriptionNameInput: document.getElementById('subscriptionNameInput'),
    subscriptionUrlInput: document.getElementById('subscriptionUrlInput'),
    addSubscriptionBtn: document.getElementById('addSubscriptionBtn'),
    updateAllFiltersBtn: document.getElementById('updateAllFiltersBtn'),
    // About links
    rateExtension: document.getElementById('rateExtension'),
    viewSource: document.getElementById('viewSource'),
    // Request log
    requestLog: document.getElementById('requestLog'),
    logCount: document.getElementById('logCount'),
    clearLogBtn: document.getElementById('clearLogBtn'),
    enableLogging: document.getElementById('enableLogging'),
    // Toast duration
    toastDuration: document.getElementById('toastDuration'),
    toastDurationValue: document.getElementById('toastDurationValue'),
    // Toast container
    toastContainer: document.getElementById('toastContainer')
  };

  const QUICK_THEME_TOGGLE = {
    light: 'dark',
    dark: 'light',
    forest: 'forest-dark',
    'forest-dark': 'forest',
    coastal: 'coastal-dark',
    'coastal-dark': 'coastal'
  };

  const RECOMMENDED_LISTS = [
    { id: 'hagezi-pro', name: 'HaGeZi Pro', desc: 'Comprehensive ad & tracker blocking', url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt', category: 'ads', icon: '\u{1F6E1}' },
    { id: 'hagezi-tif', name: 'Threat Intelligence', desc: 'Malware, phishing, C2 protection', url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/tif.mini.txt', category: 'security', icon: '\u{1F512}' },
    { id: 'hagezi-fake', name: 'Fake & Scam Sites', desc: 'Blocks fraud, scam stores, rip-offs', url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/fake.txt', category: 'security', icon: '\u{1F6AB}' },
    { id: 'hagezi-popup', name: 'Pop-Up Ads', desc: 'Aggressive pop-up/under blocking', url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/popupads.txt', category: 'ads', icon: '\u2715' },
    { id: 'hagezi-dyndns', name: 'DynDNS Abuse', desc: 'Blocks dynamic DNS phishing domains', url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/dyndns.txt', category: 'security', icon: '\u{1F310}' },
    { id: 'adguard-dns', name: 'AdGuard DNS', desc: 'Curated DNS-level ad & tracker blocking', url: 'https://adguardteam.github.io/HostlistsRegistry/assets/filter_1.txt', category: 'ads', icon: '\u{1F530}' },
    { id: 'phishing-urls', name: 'Phishing Blocklist', desc: 'Community phishing domain list', url: 'https://adguardteam.github.io/HostlistsRegistry/assets/filter_30.txt', category: 'security', icon: '\u{1F3A3}' },
    { id: 'hagezi-spam-tlds', name: 'Spam TLDs', desc: 'Blocks domains on spam-abused TLDs', url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/spam-tlds-adblock.txt', category: 'spam', icon: '\u{1F4E7}' }
  ];

  const PROTECTION_LEVELS = {
    light: [],
    standard: ['https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt'],
    aggressive: [
      'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt',
      'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/tif.mini.txt',
      'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/fake.txt',
      'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/popupads.txt',
      'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/dyndns.txt'
    ]
  };

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

  function sendMessage(message) {
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

  async function sendMessageWithFallback(types, payload = {}) {
    const typeList = Array.isArray(types) ? types : [types];
    let lastError = null;

    for (const type of typeList) {
      try {
        const response = await sendMessage({ ...payload, type });
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

  function supportsSyncStorage() {
    return !!(
      api.storage &&
      api.storage.sync &&
      typeof api.storage.sync.get === 'function' &&
      typeof api.storage.sync.set === 'function'
    );
  }

  function getEffectiveSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function getActiveTheme() {
    const activeThemeButton = document.querySelector('.theme-btn.active');
    if (activeThemeButton?.dataset.theme) {
      return activeThemeButton.dataset.theme;
    }

    return document.documentElement.getAttribute('data-theme') || 'system';
  }

  function getQuickToggleTheme(currentTheme) {
    if (currentTheme === 'system') {
      return getEffectiveSystemTheme() === 'dark' ? 'light' : 'dark';
    }

    return QUICK_THEME_TOGGLE[currentTheme] || 'dark';
  }

  function getHistoryTotal(entry) {
    if (!entry) return 0;
    if (typeof entry.blocked === 'number') return entry.blocked;
    if (typeof entry.total === 'number') return entry.total;
    const network = entry.network ?? entry.networkBlocked ?? 0;
    const cosmetic = entry.cosmetic ?? entry.cosmeticBlocked ?? 0;
    return network + cosmetic;
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  let loggingEnabled = true;
  let logPollInterval = null;

  async function init() {
    // Set up event listeners FIRST so UI is interactive even if data loading fails
    setupEventListeners();

    try {
      await Promise.all([
        loadSettings().catch(err => logError('loadSettings failed:', err)),
        loadTheme().catch(err => logError('loadTheme failed:', err)),
        loadRules().catch(err => logError('loadRules failed:', err)),
        loadWhitelist().catch(err => logError('loadWhitelist failed:', err)),
        loadStats().catch(err => logError('loadStats failed:', err)),
        loadFilterLists().catch(err => logError('loadFilterLists failed:', err)),
        loadRequestLog().catch(err => logError('loadRequestLog failed:', err)),
        loadPerformanceStats().catch(err => logError('loadPerformanceStats failed:', err)),
        renderRecommendedLists().catch(err => logError('renderRecommendedLists failed:', err)),
        loadProtectionLevel().catch(err => logError('loadProtectionLevel failed:', err))
      ]);
      applyCapabilityState();
      // Only start polling if logging is enabled
      if (loggingEnabled) {
        startLogPolling();
      }
    } catch (err) {
      logError('Options init error:', err);
    }
  }

  // ============================================
  // LOAD FUNCTIONS
  // ============================================
  async function loadSettings() {
    const storage = await getStorage([
      'enabled', 'paywallEnabled', 'networkBlockingEnabled', 'urlCleaningEnabled',
      'cookieConsentEnabled', 'annoyanceBlockingEnabled', 'socialBlockingEnabled',
      'pingProtectionEnabled', 'referrerStrippingEnabled', 'webrtcProtectionEnabled',
      'phishingProtectionEnabled', 'telemetryBlockingEnabled', 'thirdPartyCookieBlockingEnabled',
      'syncEnabled', 'enabledLanguageFilters', 'loggingEnabled', 'toastDuration'
    ]);

    // Load logging setting (default true if not set)
    loggingEnabled = storage.loggingEnabled !== false;
    if (elements.enableLogging) {
      elements.enableLogging.checked = loggingEnabled;
    }
    elements.enableProtection.checked = storage.enabled !== false;
    elements.enablePaywall.checked = storage.paywallEnabled !== false;
    elements.enableNetworkBlocking.checked = storage.networkBlockingEnabled !== false;
    elements.enableUrlCleaning.checked = storage.urlCleaningEnabled !== false;
    elements.enableCookieConsent.checked = storage.cookieConsentEnabled !== false;
    elements.enableAnnoyanceBlocking.checked = storage.annoyanceBlockingEnabled !== false;
    if (elements.enableSocialBlocking) {
      elements.enableSocialBlocking.checked = storage.socialBlockingEnabled === true;
    }
    elements.enablePingProtection.checked = storage.pingProtectionEnabled !== false;
    elements.enableReferrerStripping.checked = storage.referrerStrippingEnabled === true;
    elements.enableWebRTCProtection.checked = storage.webrtcProtectionEnabled === true;
    if (elements.enablePhishingProtection) {
      elements.enablePhishingProtection.checked = storage.phishingProtectionEnabled !== false;
    }
    if (elements.enableTelemetryBlocking) {
      elements.enableTelemetryBlocking.checked = storage.telemetryBlockingEnabled === true;
    }
    if (elements.enableThirdPartyCookieBlocking) {
      elements.enableThirdPartyCookieBlocking.checked = storage.thirdPartyCookieBlockingEnabled === true;
    }
    if (elements.enableSync) {
      elements.enableSync.checked = storage.syncEnabled === true;
    }

    // Toast duration
    if (elements.toastDuration) {
      const duration = storage.toastDuration || 3;
      elements.toastDuration.value = duration;
      if (elements.toastDurationValue) {
        elements.toastDurationValue.textContent = duration + 's';
      }
    }

    // Load language filter states based on actual subscriptions
    await loadLanguageFilterStates();
  }

  // Load language filter checkbox states by checking actual subscriptions
  async function loadLanguageFilterStates() {
    if (!elements.languageFilters) return;

    try {
      const response = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
      if (response?.success && response.subscriptions) {
        const subscribedUrls = new Set(response.subscriptions.map(s => s.url));

        elements.languageFilters.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          const url = cb.dataset.url;
          cb.checked = subscribedUrls.has(url);
        });

        // Update enabledLanguageFilters storage to stay in sync
        const enabledLangFilters = [];
        elements.languageFilters.querySelectorAll('input[type="checkbox"]:checked').forEach(c => {
          enabledLangFilters.push(c.dataset.lang);
        });
        await setStorage({ enabledLanguageFilters: enabledLangFilters });
      }
    } catch (err) {
      // Fallback to storage-based state
      const storage = await getStorage(['enabledLanguageFilters']);
      const enabledLangFilters = storage.enabledLanguageFilters || [];
      elements.languageFilters.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = enabledLangFilters.includes(cb.dataset.lang);
      });
    }
  }

  const FONT_STACKS = {
    system: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif",
    mono: "'SF Mono', 'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Consolas', 'Liberation Mono', monospace"
  };

  async function loadTheme() {
    const storage = await getStorage(['theme', 'fontSize', 'fontFamily', 'borderRadius']);
    const theme = storage.theme || 'system';
    applyTheme(theme);
    updateThemeButtons(theme);
    updateThemeOptionButtons(theme);

    // Font size
    const fontSize = storage.fontSize || 14;
    document.documentElement.style.fontSize = fontSize + 'px';
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeValue = document.getElementById('fontSizeValue');
    if (fontSizeSlider) fontSizeSlider.value = fontSize;
    if (fontSizeValue) fontSizeValue.textContent = fontSize + 'px';

    // Font family
    const fontFamily = storage.fontFamily || 'system';
    applyFontFamily(fontFamily);
    const fontFamilySelect = document.getElementById('fontFamilySelect');
    if (fontFamilySelect) fontFamilySelect.value = fontFamily;

    // Border radius
    const borderRadius = typeof storage.borderRadius === 'number' ? storage.borderRadius : 10;
    applyBorderRadius(borderRadius);
    const borderRadiusSlider = document.getElementById('borderRadiusSlider');
    const borderRadiusValue = document.getElementById('borderRadiusValue');
    if (borderRadiusSlider) borderRadiusSlider.value = borderRadius;
    if (borderRadiusValue) borderRadiusValue.textContent = borderRadius + 'px';
  }

  function applyCapabilityState() {
    if (!elements.enableSync) return;

    const syncSupported = supportsSyncStorage();
    elements.enableSync.disabled = !syncSupported;
    if (!syncSupported) {
      elements.enableSync.checked = false;
    }

    if (elements.syncDescription) {
      elements.syncDescription.textContent = syncSupported
        ? 'Sync rules and settings across devices'
        : 'This browser does not expose extension sync storage, so settings stay local.';
    }
  }

  function getImportExportApi() {
    return self.WebSuddhi?.importExport || null;
  }

  async function refreshOptionState() {
    await Promise.all([
      loadSettings(),
      loadTheme(),
      loadRules(),
      loadWhitelist(),
      loadStats(),
      loadFilterLists(),
      loadRequestLog(),
      loadPerformanceStats()
    ]);
    applyCapabilityState();
    if (loggingEnabled) {
      startLogPolling();
    } else {
      stopLogPolling();
    }
  }

  function applyTheme(theme) {
    if (theme === 'system') {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    document.documentElement.classList.add('theme-loaded');
  }

  function applyFontFamily(fontFamily) {
    if (!fontFamily || fontFamily === 'system') {
      document.documentElement.style.removeProperty('font-family');
      document.documentElement.style.removeProperty('--font-active');
      return;
    }
    var stack = FONT_STACKS[fontFamily];
    if (!stack) {
      // Custom font — name from fonts.json
      stack = "'" + fontFamily + "', " + FONT_STACKS.system;
    }
    document.documentElement.style.setProperty('--font-active', stack);
    document.documentElement.style.fontFamily = stack;
  }

  function applyBorderRadius(val) {
    document.documentElement.style.setProperty('--radius-sm', Math.max(val - 4, 0) + 'px');
    document.documentElement.style.setProperty('--radius-md', val + 'px');
    document.documentElement.style.setProperty('--radius-lg', Math.min(val + 6, 30) + 'px');
  }

  async function loadCustomFonts(selectEl) {
    try {
      const url = api.runtime.getURL('fonts/fonts.json');
      const resp = await fetch(url);
      if (!resp.ok) return;
      const fonts = await resp.json();

      // Deduplicate font family names
      const families = [...new Set(fonts.map(f => f.name))];

      // Register @font-face for each entry
      for (const entry of fonts) {
        const fontUrl = api.runtime.getURL('fonts/' + entry.file);
        // Check if file exists (fetch HEAD)
        try {
          const check = await fetch(fontUrl, { method: 'HEAD' });
          if (!check.ok) continue;
        } catch (_) { continue; }

        const face = new FontFace(entry.name, 'url(' + fontUrl + ')', {
          weight: String(entry.weight || 400),
          style: entry.style || 'normal'
        });
        try {
          await face.load();
          document.fonts.add(face);
        } catch (_) { /* font file missing or corrupt — skip */ }
      }

      // Add available families to select
      for (const name of families) {
        // Only add if at least one face loaded
        if (document.fonts.check('12px "' + name + '"')) {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          selectEl.appendChild(opt);
        }
      }

      // Restore saved selection
      const storage = await getStorage(['fontFamily']);
      if (storage.fontFamily && selectEl) {
        selectEl.value = storage.fontFamily;
      }
    } catch (_) {
      // fonts.json not found or invalid — no custom fonts
    }
  }

  function updateThemeButtons(activeTheme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === activeTheme);
    });
  }

  function updateThemeOptionButtons(activeTheme) {
    document.querySelectorAll('.theme-card').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === activeTheme);
    });
  }

  async function loadRequestLog() {
    try {
      const response = await sendMessageWithFallback(['GET_REQUEST_LOG', 'REQUEST_LOG']);
      renderRequestLog(extractRequestLog(response));
    } catch (err) {
      logError('Failed to load request log:', err);
    }
  }

  function renderRequestLog(log) {
    if (!elements.requestLog) return;

    elements.logCount.textContent = log.length;

    // Clear container using safe method
    while (elements.requestLog.firstChild) {
      elements.requestLog.removeChild(elements.requestLog.firstChild);
    }

    if (log.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'log-empty';
      emptyDiv.textContent = 'No blocked requests logged yet';
      elements.requestLog.appendChild(emptyDiv);
      return;
    }

    // Show most recent first
    const sortedLog = [...log].reverse();

    for (const entry of sortedLog) {
      const div = document.createElement('div');
      div.className = 'log-entry ' + entry.type;

      const relativeTime = getRelativeTime(entry.timestamp);
      const displayText = entry.type === 'network' ? entry.url : entry.selector;

      // Type badge
      const typeSpan = document.createElement('span');
      typeSpan.className = 'log-type';
      typeSpan.textContent = entry.type;
      div.appendChild(typeSpan);

      // Category badge for network blocks
      if (entry.type === 'network' && entry.category) {
        const categorySpan = document.createElement('span');
        categorySpan.className = 'log-category ' + (entry.severity || 'low');
        categorySpan.textContent = entry.category;
        categorySpan.title = entry.trackerDesc || entry.category;
        div.appendChild(categorySpan);
      }

      // Details section
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'log-details';

      const urlDiv = document.createElement('div');
      urlDiv.className = 'log-url';
      urlDiv.textContent = displayText || 'Unknown';
      detailsDiv.appendChild(urlDiv);

      const metaDiv = document.createElement('div');
      metaDiv.className = 'log-meta';
      metaDiv.textContent = entry.site || 'Unknown site';
      detailsDiv.appendChild(metaDiv);

      div.appendChild(detailsDiv);

      // Time
      const timeSpan = document.createElement('span');
      timeSpan.className = 'log-time';
      timeSpan.textContent = relativeTime;
      div.appendChild(timeSpan);

      elements.requestLog.appendChild(div);
    }
  }

  function getRelativeTime(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 1000) return 'just now';
    if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return new Date(timestamp).toLocaleDateString();
  }

  function startLogPolling() {
    stopLogPolling();

    // Poll every 2 seconds for new log entries
    logPollInterval = setInterval(async () => {
      if (loggingEnabled) {
        await loadRequestLog();
      }
    }, 2000);
  }

  function stopLogPolling() {
    if (logPollInterval) {
      clearInterval(logPollInterval);
      logPollInterval = null;
    }
  }

  async function loadRules() {
    const storage = await getStorage(['blockedSelectors']);
    const selectors = storage.blockedSelectors || [];
    elements.rulesCount.textContent = selectors.length;
    if (elements.navRulesCount) {
      elements.navRulesCount.textContent = selectors.length;
    }

    // Clear existing rules
    const existingRules = elements.rulesList.querySelectorAll('.rule-item');
    existingRules.forEach(el => el.remove());

    if (selectors.length === 0) {
      elements.emptyState.style.display = 'block';
      return;
    }

    elements.emptyState.style.display = 'none';

    selectors.forEach(item => {
      const ruleEl = createRuleElement(item);
      elements.rulesList.appendChild(ruleEl);
    });
  }

  async function loadWhitelist() {
    const storage = await getStorage(['whitelistedSites']);
    const sites = storage.whitelistedSites || [];
    clearElement(elements.whitelistList);

    sites.forEach(site => {
      const item = createWhitelistItem(site);
      elements.whitelistList.appendChild(item);
    });
  }

  async function loadStats(period) {
    try {
      const statsResponse = await sendMessageWithFallback(['GET_STATS', 'GET_ENHANCED_STATS']);
      const stats = statsResponse?.stats || null;
      if (!stats) return;

      if (!period || period === 'all') {
        elements.networkBlocked.textContent = formatNumber(stats.totalNetworkBlocked || 0);
        elements.cosmeticBlocked.textContent = formatNumber(stats.totalCosmeticBlocked || 0);
        elements.totalBlocked.textContent = formatNumber(stats.totalBlocked || 0);
      } else if (period === 'today') {
        const today = stats.today || {};
        elements.networkBlocked.textContent = formatNumber(today.networkBlocked || 0);
        elements.cosmeticBlocked.textContent = formatNumber(today.cosmeticBlocked || 0);
        elements.totalBlocked.textContent = formatNumber((today.networkBlocked || 0) + (today.cosmeticBlocked || 0));
      } else {
        const days = parseInt(period, 10);
        if (!Number.isNaN(days)) {
          const periodResponse = await sendMessageWithFallback(
            ['GET_PERIOD_STATS', 'GET_STATS_FOR_PERIOD'],
            { days }
          );
          const ps = periodResponse?.stats || periodResponse || {};
          const network = ps.network ?? ps.networkBlocked ?? 0;
          const cosmetic = ps.cosmetic ?? ps.cosmeticBlocked ?? 0;
          elements.networkBlocked.textContent = formatNumber(network);
          elements.cosmeticBlocked.textContent = formatNumber(cosmetic);
          elements.totalBlocked.textContent = formatNumber(network + cosmetic);
        }
      }

      // Render charts
      renderBarChart(elements.topDomainsChart, stats.today?.topDomains || {}, 10);
      renderBarChart(elements.topSitesChart, stats.today?.perSite || {}, 10, true);

      // Render category pie chart
      const byCategory = stats.today?.byCategory || stats.byCategory || {};
      renderPieChart(elements.categoryChart, byCategory);

      // Render trend chart
      const history = stats.history || [];
      renderTrendChart(elements.trendChart, history);
    } catch (err) {
      elements.totalBlocked.textContent = '0';
      elements.networkBlocked.textContent = '0';
      elements.cosmeticBlocked.textContent = '0';
    }
  }

  async function loadPerformanceStats() {
    try {
      const response = await sendMessage({ type: 'GET_PERFORMANCE_STATS' });
      if (response?.success && response.performanceStats) {
        const perfStats = response.performanceStats;
        if (elements.dataSavedTotal) {
          elements.dataSavedTotal.textContent = formatDataSize(perfStats.estimatedDataSaved || 0);
        }
        if (elements.timeSavedTotal) {
          elements.timeSavedTotal.textContent = formatTimeSaved(perfStats.estimatedTimeSaved || 0);
        }
      }
    } catch (err) {
      if (elements.dataSavedTotal) elements.dataSavedTotal.textContent = '0 MB';
      if (elements.timeSavedTotal) elements.timeSavedTotal.textContent = '0s';
    }
  }

  // ============================================
  // FILTER LISTS
  // ============================================
  async function loadFilterLists() {
    try {
      const response = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
      if (response?.success) {
        renderFilterLists(response.subscriptions || []);
      }
    } catch (err) {
      logError('Failed to load filter lists:', err);
    }
  }

  function renderFilterLists(subscriptions) {
    clearElement(elements.filterListItems);

    for (const sub of subscriptions) {
      const item = document.createElement('div');
      item.className = 'filter-list-item';

      const lastUpdated = sub.lastUpdated
        ? new Date(sub.lastUpdated).toLocaleDateString()
        : 'Never';

      // Create label with toggle
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

      // Remove button (for custom subscriptions only)
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

        // Remove button listener
        removeBtn.addEventListener('click', async () => {
          try {
            await sendMessage({ type: 'REMOVE_FILTER_SUBSCRIPTION', subscriptionId: sub.id });
            item.remove();
          } catch (e) {}
        });
      }

      // Toggle listener
      checkbox.addEventListener('change', async () => {
        try {
          await sendMessage({
            type: 'TOGGLE_FILTER_SUBSCRIPTION',
            subscriptionId: sub.id,
            enabled: checkbox.checked
          });
        } catch (e) {}
      });

      elements.filterListItems.appendChild(item);
    }
  }

  // ============================================
  // BAR CHARTS
  // ============================================
  function renderBarChart(container, data, limit, isSiteData) {
    if (!container) return;
    clearElement(container);

    let entries;
    if (isSiteData) {
      entries = Object.entries(data)
        .map(([key, val]) => {
          if (typeof val === 'number') return [key, val];
          return [key, (val?.network || 0) + (val?.cosmetic || 0)];
        })
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
    } else {
      entries = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);
    }

    if (entries.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-chart';
      emptyDiv.textContent = 'No data yet';
      container.appendChild(emptyDiv);
      return;
    }

    const maxVal = entries[0][1] || 1;

    for (const [label, value] of entries) {
      const row = document.createElement('div');
      row.className = 'bar-row';

      const pct = Math.round((value / maxVal) * 100);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'bar-label';
      labelSpan.textContent = label;

      const trackDiv = document.createElement('div');
      trackDiv.className = 'bar-track';
      const fillDiv = document.createElement('div');
      fillDiv.className = 'bar-fill';
      fillDiv.style.width = pct + '%';
      trackDiv.appendChild(fillDiv);

      const valueSpan = document.createElement('span');
      valueSpan.className = 'bar-value';
      valueSpan.textContent = formatNumber(value);

      row.appendChild(labelSpan);
      row.appendChild(trackDiv);
      row.appendChild(valueSpan);

      container.appendChild(row);
    }
  }

  // ============================================
  // PIE CHART
  // ============================================
  const CATEGORY_COLORS = {
    ads: '#ef4444',
    trackers: '#f59e0b',
    annoyances: '#8b5cf6',
    paywall: '#ec4899',
    other: '#6b7280'
  };

  function renderPieChart(container, byCategory) {
    if (!container) return;
    clearElement(container);

    const entries = Object.entries(byCategory || {})
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-chart';
      emptyDiv.textContent = 'No data yet';
      container.appendChild(emptyDiv);
      return;
    }

    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    const radius = 50;
    const circumference = 2 * Math.PI * radius;

    let cumulativePercent = 0;
    const slices = entries.map(([label, value]) => {
      const percent = value / total;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;

      const dashArray = percent * circumference;
      const dashOffset = (1 - startPercent) * circumference;

      return {
        label,
        value,
        percent: Math.round(percent * 100),
        dashArray,
        dashOffset,
        color: CATEGORY_COLORS[label] || CATEGORY_COLORS.other
      };
    });

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('pie-svg');
    svg.setAttribute('viewBox', '0 0 120 120');

    slices.forEach(slice => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.classList.add('pie-slice');
      circle.setAttribute('cx', '60');
      circle.setAttribute('cy', '60');
      circle.setAttribute('r', String(radius));
      circle.setAttribute('stroke', slice.color);
      circle.setAttribute('stroke-dasharray', `${slice.dashArray} ${circumference}`);
      circle.setAttribute('stroke-dashoffset', String(-slice.dashOffset));
      svg.appendChild(circle);
    });

    // Legend
    const legend = document.createElement('div');
    legend.className = 'pie-legend';

    slices.forEach(slice => {
      const item = document.createElement('div');
      item.className = 'pie-legend-item';

      const color = document.createElement('span');
      color.className = 'pie-legend-color';
      color.style.backgroundColor = slice.color;

      const label = document.createElement('span');
      label.className = 'pie-legend-label';
      label.textContent = slice.label.charAt(0).toUpperCase() + slice.label.slice(1);

      const value = document.createElement('span');
      value.className = 'pie-legend-value';
      value.textContent = slice.percent + '%';

      item.appendChild(color);
      item.appendChild(label);
      item.appendChild(value);
      legend.appendChild(item);
    });

    const containerDiv = document.createElement('div');
    containerDiv.className = 'pie-container';
    containerDiv.appendChild(svg);
    containerDiv.appendChild(legend);

    container.appendChild(containerDiv);
  }

  // ============================================
  // TREND CHART
  // ============================================
  function renderTrendChart(container, history) {
    if (!container) return;
    clearElement(container);

    if (!history || history.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-chart';
      emptyDiv.textContent = 'No data yet';
      container.appendChild(emptyDiv);
      return;
    }

    const last7 = history.slice(-7);
    const maxVal = Math.max(...last7.map(getHistoryTotal), 1);

    const width = 300;
    const height = 120;
    const padding = 10;

    const points = last7.map((d, i) => {
      const x = last7.length === 1
        ? width / 2
        : padding + (i / (last7.length - 1)) * (width - 2 * padding);
      const y = height - padding - (getHistoryTotal(d) / maxVal) * (height - 2 * padding);
      return { x, y, date: d.date || d.day || d.timestamp };
    });

    const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x},${p.y}`).join(' ');
    const areaPath = linePath + ` L${points[points.length - 1].x},${height - padding} L${points[0].x},${height - padding} Z`;

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('trend-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    // Area
    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.classList.add('trend-area');
    area.setAttribute('d', areaPath);
    svg.appendChild(area);

    // Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.classList.add('trend-line');
    line.setAttribute('d', linePath);
    svg.appendChild(line);

    // Dots
    points.forEach(p => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.classList.add('trend-dot');
      dot.setAttribute('cx', String(p.x));
      dot.setAttribute('cy', String(p.y));
      dot.setAttribute('r', '4');
      svg.appendChild(dot);
    });

    // Labels
    const labels = document.createElement('div');
    labels.className = 'trend-labels';

    const dates = last7.map(d => {
      const date = new Date(d.date || d.day || d.timestamp || Date.now());
      return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString('en-US', { weekday: 'short' });
    });

    dates.forEach(dateText => {
      const label = document.createElement('span');
      label.className = 'trend-label';
      label.textContent = dateText;
      labels.appendChild(label);
    });

    container.appendChild(svg);
    container.appendChild(labels);
  }

  // ============================================
  // ELEMENT CREATION
  // ============================================
  function createRuleElement(item) {
    const div = document.createElement('div');
    div.className = 'rule-item';
    div.dataset.selector = item.selector;

    const date = item.date ? new Date(item.date).toLocaleDateString() : 'Unknown';

    // Create rule info section
    const ruleInfo = document.createElement('div');
    ruleInfo.className = 'rule-info';

    const selectorCode = document.createElement('code');
    selectorCode.className = 'rule-selector';
    selectorCode.textContent = item.selector;

    const ruleMeta = document.createElement('div');
    ruleMeta.className = 'rule-meta';
    ruleMeta.textContent = (item.hostname || 'unknown') + ' - ' + date;

    ruleInfo.appendChild(selectorCode);
    ruleInfo.appendChild(ruleMeta);

    // Create delete button
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
        const count = parseInt(elements.rulesCount.textContent) - 1;
        elements.rulesCount.textContent = count;
        if (elements.navRulesCount) {
          elements.navRulesCount.textContent = count;
        }
        if (count === 0) {
          elements.emptyState.style.display = 'block';
        }
        showToast('Rule removed', 'success');
      } catch (err) {
        logError('Failed to remove selector:', err);
        showToast('Failed to remove rule', 'error');
      }
    });

    return div;
  }

  function createWhitelistItem(site) {
    const div = document.createElement('div');
    div.className = 'whitelist-item';
    div.dataset.site = site;

    const siteSpan = document.createElement('span');
    siteSpan.textContent = site;

    const removeBtn = document.createElement('button');
    removeBtn.title = 'Remove';
    removeBtn.textContent = '\u00D7'; // × character

    div.appendChild(siteSpan);
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
  // RECOMMENDED LISTS & PROTECTION LEVELS
  // ============================================
  function formatRuleCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function pollSubscriptionUpdate(url, name, element) {
    let attempts = 0;
    const maxAttempts = 20; // 20 * 3s = 60s max
    const interval = setInterval(async () => {
      attempts++;
      try {
        const resp = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
        if (resp?.success) {
          const sub = resp.subscriptions.find(s => s.url === url);
          if (sub && sub.ruleCount > 0) {
            clearInterval(interval);
            if (element) element.classList.remove('loading');
            showToast(name + ' — ' + formatRuleCount(sub.ruleCount) + ' rules active', 'success');
            await renderRecommendedLists();
            await loadFilterLists();
            return;
          }
        }
      } catch (_) {}
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        if (element) element.classList.remove('loading');
        showToast(name + ' — still loading, check back shortly', 'info');
      }
    }, 3000);
  }

  async function renderRecommendedLists() {
    const container = document.getElementById('recommendedFilters');
    if (!container) return;

    let subscriptions = [];
    try {
      const resp = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
      if (resp?.success) subscriptions = resp.subscriptions || [];
    } catch (_) {}

    const subscribedUrls = new Set(subscriptions.map(s => s.url));
    container.innerHTML = '';

    for (const list of RECOMMENDED_LISTS) {
      const isSubscribed = subscribedUrls.has(list.url);
      const sub = subscriptions.find(s => s.url === list.url);

      const item = document.createElement('div');
      item.className = 'rec-filter-item';
      item.dataset.url = list.url;

      const icon = document.createElement('div');
      icon.className = 'rec-filter-icon ' + list.category;
      icon.textContent = list.icon;

      const info = document.createElement('div');
      info.className = 'rec-filter-info';

      const nameRow = document.createElement('div');
      nameRow.className = 'rec-filter-name';
      nameRow.textContent = list.name;
      if (isSubscribed && sub?.ruleCount) {
        const badge = document.createElement('span');
        badge.className = 'rec-filter-badge';
        badge.textContent = formatRuleCount(sub.ruleCount) + ' rules';
        nameRow.appendChild(badge);
      }

      const desc = document.createElement('div');
      desc.className = 'rec-filter-desc';
      desc.textContent = list.desc;

      info.appendChild(nameRow);
      info.appendChild(desc);

      const toggleWrap = document.createElement('div');
      toggleWrap.className = 'rec-filter-toggle';
      const label = document.createElement('label');
      label.className = 'toggle-label compact';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = isSubscribed;
      const toggleSwitch = document.createElement('span');
      toggleSwitch.className = 'toggle-switch small';
      toggleSwitch.innerHTML = '<span class="slider"></span>';
      label.appendChild(input);
      label.appendChild(toggleSwitch);
      toggleWrap.appendChild(label);

      item.appendChild(icon);
      item.appendChild(info);
      item.appendChild(toggleWrap);
      container.appendChild(item);

      input.addEventListener('change', async () => {
        item.classList.add('loading');
        input.disabled = true;
        try {
          if (input.checked) {
            const resp = await sendMessage({ type: 'ADD_FILTER_SUBSCRIPTION', name: list.name, url: list.url });
            if (resp?.success) {
              if (resp.pending) {
                showToast(list.name + ' added — fetching rules in background...', 'info');
                // Poll for completion
                pollSubscriptionUpdate(list.url, list.name, item);
              } else {
                const count = resp.appliedCount || resp.subscription?.ruleCount || 0;
                showToast(list.name + ' — ' + formatRuleCount(count) + ' rules applied', 'success');
              }
            } else {
              input.checked = false;
              showToast(resp?.error || 'Failed to add ' + list.name, 'error');
            }
          } else {
            const subsResp = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
            if (subsResp?.success) {
              const sub = subsResp.subscriptions.find(s => s.url === list.url);
              if (sub) {
                await sendMessage({ type: 'REMOVE_FILTER_SUBSCRIPTION', subscriptionId: sub.id });
                showToast(list.name + ' removed', 'success');
              }
            }
          }
        } catch (e) {
          input.checked = !input.checked;
          logError('Subscription toggle failed:', e);
          showToast('Failed: ' + (e.message || 'unknown error'), 'error');
        } finally {
          item.classList.remove('loading');
          input.disabled = false;
          await renderRecommendedLists();
        }
      });
    }
  }

  async function detectProtectionLevel() {
    try {
      const resp = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
      if (!resp?.success) return 'light';
      const urls = new Set((resp.subscriptions || []).map(s => s.url));

      if (PROTECTION_LEVELS.aggressive.every(u => urls.has(u))) return 'aggressive';
      if (PROTECTION_LEVELS.standard.every(u => urls.has(u))) return 'standard';
      return 'light';
    } catch (_) {
      return 'light';
    }
  }

  async function applyProtectionLevel(level) {
    const targetUrls = new Set(PROTECTION_LEVELS[level] || []);
    const allManagedUrls = new Set(Object.values(PROTECTION_LEVELS).flat());

    let subsResp;
    try {
      subsResp = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
    } catch (_) { return; }
    if (!subsResp?.success) return;

    const currentSubs = subsResp.subscriptions || [];
    const currentUrls = new Set(currentSubs.map(s => s.url));

    // Remove managed URLs not in target
    for (const sub of currentSubs) {
      if (allManagedUrls.has(sub.url) && !targetUrls.has(sub.url)) {
        try {
          await sendMessage({ type: 'REMOVE_FILTER_SUBSCRIPTION', subscriptionId: sub.id });
        } catch (_) {}
      }
    }

    // Add target URLs not yet subscribed
    for (const url of targetUrls) {
      if (!currentUrls.has(url)) {
        const list = RECOMMENDED_LISTS.find(r => r.url === url);
        try {
          await sendMessage({ type: 'ADD_FILTER_SUBSCRIPTION', name: list?.name || 'Filter', url });
        } catch (_) {}
      }
    }

    await setStorage({ protectionLevel: level });
    await renderRecommendedLists();
    await loadFilterLists();
  }

  async function loadProtectionLevel() {
    const level = await detectProtectionLevel();
    document.querySelectorAll('.protection-level-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === level);
    });
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  function setupEventListeners() {
    // Theme toggle
    if (elements.themeToggle) {
      elements.themeToggle?.addEventListener('click', async () => {
        const newTheme = getQuickToggleTheme(getActiveTheme());
        applyTheme(newTheme);
        updateThemeButtons(newTheme);
        await setStorage({ theme: newTheme });
      });
    }

    // Toggle protection
    elements.enableProtection?.addEventListener('change', async () => {
      const enabled = elements.enableProtection.checked;
      await setStorage({ enabled });
      try {
        await sendMessage({ type: 'TOGGLE_ENABLED', enabled });
      } catch (e) {}
    });

    // Toggle paywall
    elements.enablePaywall?.addEventListener('change', async () => {
      const enabled = elements.enablePaywall.checked;
      await setStorage({ paywallEnabled: enabled });
      try {
        await sendMessage({ type: 'TOGGLE_PAYWALL', enabled });
      } catch (e) {}
    });

    // Toggle network blocking
    elements.enableNetworkBlocking?.addEventListener('change', async () => {
      const enabled = elements.enableNetworkBlocking.checked;
      await setStorage({ networkBlockingEnabled: enabled });
      try {
        await sendMessage({ type: 'TOGGLE_NETWORK_BLOCKING', enabled });
      } catch (e) {}
    });

    // Toggle URL cleaning
    elements.enableUrlCleaning?.addEventListener('change', async () => {
      const enabled = elements.enableUrlCleaning.checked;
      await setStorage({ urlCleaningEnabled: enabled });
      try {
        await sendMessage({ type: 'TOGGLE_URL_CLEANING', enabled });
      } catch (e) {}
    });

    // Toggle cookie consent
    elements.enableCookieConsent?.addEventListener('change', async () => {
      const enabled = elements.enableCookieConsent.checked;
      try {
        await sendMessage({ type: 'TOGGLE_COOKIE_CONSENT', enabled });
      } catch (e) {}
      await setStorage({ cookieConsentEnabled: enabled });
    });

    // Toggle annoyance blocking
    elements.enableAnnoyanceBlocking?.addEventListener('change', async () => {
      const enabled = elements.enableAnnoyanceBlocking.checked;
      try {
        await sendMessage({ type: 'TOGGLE_ANNOYANCE_BLOCKING', enabled });
      } catch (e) {}
      await setStorage({ annoyanceBlockingEnabled: enabled });
    });

    // Toggle social blocking
    if (elements.enableSocialBlocking) {
      elements.enableSocialBlocking?.addEventListener('change', async () => {
        const enabled = elements.enableSocialBlocking.checked;
        await setStorage({ socialBlockingEnabled: enabled });
        try {
          await sendMessage({ type: 'TOGGLE_SOCIAL_BLOCKING', enabled });
        } catch (e) {}
      });
    }

    // Toggle ping protection
    elements.enablePingProtection?.addEventListener('change', async () => {
      const enabled = elements.enablePingProtection.checked;
      await setStorage({ pingProtectionEnabled: enabled });
      try {
        await sendMessage({ type: 'TOGGLE_PING_PROTECTION', enabled });
      } catch (e) {}
    });

    // Toggle referrer stripping
    elements.enableReferrerStripping?.addEventListener('change', async () => {
      const enabled = elements.enableReferrerStripping.checked;
      await setStorage({ referrerStrippingEnabled: enabled });
      try {
        await sendMessage({ type: 'TOGGLE_REFERRER_STRIPPING', enabled });
      } catch (e) {}
    });

    // Toggle WebRTC protection
    elements.enableWebRTCProtection?.addEventListener('change', async () => {
      const enabled = elements.enableWebRTCProtection.checked;
      await setStorage({ webrtcProtectionEnabled: enabled });
      try {
        await sendMessage({ type: 'TOGGLE_WEBRTC_PROTECTION', enabled });
      } catch (e) {}
    });

    // Toggle phishing protection
    if (elements.enablePhishingProtection) {
      elements.enablePhishingProtection?.addEventListener('change', async () => {
        const enabled = elements.enablePhishingProtection.checked;
        await setStorage({ phishingProtectionEnabled: enabled });
        try {
          await sendMessage({ type: 'TOGGLE_PHISHING_PROTECTION', enabled });
        } catch (e) {}
      });
    }

    // Toggle telemetry blocking
    if (elements.enableTelemetryBlocking) {
      elements.enableTelemetryBlocking?.addEventListener('change', async () => {
        const enabled = elements.enableTelemetryBlocking.checked;
        await setStorage({ telemetryBlockingEnabled: enabled });
        try {
          await sendMessage({ type: 'TOGGLE_TELEMETRY_BLOCKING', enabled });
          showToast(enabled ? 'Telemetry blocking enabled' : 'Telemetry blocking disabled', 'success');
        } catch (e) {}
      });
    }

    // Toggle third-party cookie blocking
    if (elements.enableThirdPartyCookieBlocking) {
      elements.enableThirdPartyCookieBlocking?.addEventListener('change', async () => {
        const enabled = elements.enableThirdPartyCookieBlocking.checked;
        await setStorage({ thirdPartyCookieBlockingEnabled: enabled });
        try {
          await sendMessage({ type: 'TOGGLE_THIRD_PARTY_COOKIE_BLOCKING', enabled });
          showToast(enabled ? 'Third-party cookies blocked' : 'Third-party cookies allowed', 'success');
        } catch (e) {}
      });
    }

    // Protection level selector
    document.querySelectorAll('.protection-level-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const level = btn.dataset.level;
        document.querySelectorAll('.protection-level-btn').forEach(b => {
          b.classList.remove('active');
          b.classList.remove('loading');
        });
        btn.classList.add('active', 'loading');
        try {
          await applyProtectionLevel(level);
          showToast('Protection set to ' + level.charAt(0).toUpperCase() + level.slice(1), 'success');
        } catch (e) {
          showToast('Failed to apply protection level', 'error');
        } finally {
          btn.classList.remove('loading');
        }
      });
    });

    // Language filters
    if (elements.languageFilters) {
      elements.languageFilters.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', async () => {
          const lang = cb.dataset.lang;
          const url = cb.dataset.url;
          const name = cb.parentElement.querySelector('span').textContent;
          const label = cb.parentElement;

          if (cb.checked) {
            // Add subscription with loading state
            cb.disabled = true;
            label.classList.add('loading');
            try {
              const response = await sendMessage({ type: 'ADD_FILTER_SUBSCRIPTION', name, url });
              if (response?.success) {
                showToast(name + ' filter added — fetching rules...', 'info');
                label.classList.add('success');
                setTimeout(() => label.classList.remove('success'), 1500);
                // Poll for completion in background
                pollSubscriptionUpdate(url, name, label);
              } else {
                cb.checked = false;
                showToast(response?.error || 'Failed to add filter', 'error');
                label.classList.add('error');
                setTimeout(() => label.classList.remove('error'), 1500);
              }
            } catch (e) {
              cb.checked = false;
              logError('Language filter add failed:', e);
              showToast('Failed to add filter: ' + (e.message || 'unknown'), 'error');
              label.classList.add('error');
              setTimeout(() => label.classList.remove('error'), 1500);
            } finally {
              cb.disabled = false;
              label.classList.remove('loading');
            }
          } else {
            // Find and remove the subscription
            cb.disabled = true;
            label.classList.add('loading');
            try {
              const subsResponse = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
              if (subsResponse?.success) {
                const sub = subsResponse.subscriptions.find(s => s.url === url);
                if (sub) {
                  await sendMessage({ type: 'REMOVE_FILTER_SUBSCRIPTION', subscriptionId: sub.id });
                  showToast(name + ' filter removed', 'success');
                  label.classList.add('success');
                  setTimeout(() => label.classList.remove('success'), 1500);
                }
              }
            } catch (e) {
              showToast('Failed to remove filter', 'error');
              label.classList.add('error');
              setTimeout(() => label.classList.remove('error'), 1500);
            } finally {
              cb.disabled = false;
              label.classList.remove('loading');
            }
          }

          // Save enabled language filters
          const enabledLangFilters = [];
          elements.languageFilters.querySelectorAll('input[type="checkbox"]:checked').forEach(c => {
            enabledLangFilters.push(c.dataset.lang);
          });
          await setStorage({ enabledLanguageFilters: enabledLangFilters });
          // Refresh main filter list to show/hide the language filter
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
          // Get all current subscriptions
          const subsResponse = await sendMessage({ type: 'GET_FILTER_SUBSCRIPTIONS' });
          if (subsResponse?.success && subsResponse.subscriptions) {
            // Get the URLs of enabled language filters
            const enabledUrls = new Set();
            elements.languageFilters.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
              enabledUrls.add(cb.dataset.url);
            });

            // Update each language filter subscription
            let updatedCount = 0;
            for (const sub of subsResponse.subscriptions) {
              if (enabledUrls.has(sub.url)) {
                try {
                  await sendMessage({ type: 'UPDATE_FILTER_SUBSCRIPTION', subscriptionId: sub.id });
                  updatedCount++;
                } catch (e) {
                  // Continue with other updates
                }
              }
            }

            if (updatedCount > 0) {
              showToast(updatedCount + ' language filter(s) updated', 'success');
              await loadFilterLists();
            } else {
              showToast('No language filters to update', 'info');
            }
          }
        } catch (e) {
          showToast('Failed to update language filters', 'error');
        } finally {
          updateLangFiltersBtn.disabled = false;
          updateLangFiltersBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg> Update Language Filters';
        }
      });
    }

    // Toggle sync settings
    if (elements.enableSync) {
      elements.enableSync?.addEventListener('change', async () => {
        const enabled = elements.enableSync.checked;
        if (!supportsSyncStorage()) {
          elements.enableSync.checked = false;
          showStatus('Sync storage is not available in this browser', 'error');
          return;
        }
        try {
          const response = await sendMessage({ type: 'TOGGLE_SYNC', enabled });
          if (response?.success) {
            showStatus(enabled ? 'Settings sync enabled. Data migrated to sync storage.' : 'Settings sync disabled. Data migrated to local storage.', 'success');
          } else {
            elements.enableSync.checked = !enabled;
            showStatus(response?.error || 'Failed to toggle sync', 'error');
          }
        } catch (e) {
          elements.enableSync.checked = !enabled;
          showStatus('Sync storage not available in this browser', 'error');
        }
      });
    }

    // Toast duration slider
    if (elements.toastDuration) {
      elements.toastDuration?.addEventListener('input', () => {
        const val = elements.toastDuration.value;
        if (elements.toastDurationValue) {
          elements.toastDurationValue.textContent = val + 's';
        }
      });
      elements.toastDuration?.addEventListener('change', async () => {
        const val = parseInt(elements.toastDuration.value, 10);
        await setStorage({ toastDuration: val });
      });
    }

    // Theme buttons (sidebar footer)
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const theme = btn.dataset.theme;
        applyTheme(theme);
        updateThemeButtons(theme);
        updateThemeOptionButtons(theme);
        await setStorage({ theme });
      });
    });

    // Theme grid cards (in General > Appearance)
    document.querySelectorAll('.theme-card').forEach(btn => {
      btn.addEventListener('click', async () => {
        const theme = btn.dataset.theme;
        applyTheme(theme);
        updateThemeButtons(theme);
        updateThemeOptionButtons(theme);
        await setStorage({ theme });
      });
    });

    // Font family select
    const fontFamilySelect = document.getElementById('fontFamilySelect');
    if (fontFamilySelect) {
      // Load custom fonts from fonts.json manifest
      loadCustomFonts(fontFamilySelect);

      fontFamilySelect.addEventListener('change', async () => {
        const val = fontFamilySelect.value;
        applyFontFamily(val);
        await setStorage({ fontFamily: val });
      });
    }

    // Font size slider
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeValue = document.getElementById('fontSizeValue');
    if (fontSizeSlider) {
      fontSizeSlider.addEventListener('input', () => {
        const val = fontSizeSlider.value;
        if (fontSizeValue) fontSizeValue.textContent = val + 'px';
        document.documentElement.style.fontSize = val + 'px';
      });
      fontSizeSlider.addEventListener('change', async () => {
        await setStorage({ fontSize: parseInt(fontSizeSlider.value, 10) });
      });
    }

    // Border radius slider
    const borderRadiusSlider = document.getElementById('borderRadiusSlider');
    const borderRadiusValue = document.getElementById('borderRadiusValue');
    if (borderRadiusSlider) {
      borderRadiusSlider.addEventListener('input', () => {
        const val = parseInt(borderRadiusSlider.value, 10);
        if (borderRadiusValue) borderRadiusValue.textContent = val + 'px';
        applyBorderRadius(val);
      });
      borderRadiusSlider.addEventListener('change', async () => {
        await setStorage({ borderRadius: parseInt(borderRadiusSlider.value, 10) });
      });
    }

    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function closeSidebar() {
      if (sidebar) sidebar.classList.remove('open');
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
      if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
    }

    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        const isOpen = sidebar?.classList.toggle('open');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('active', isOpen);
        sidebarToggle.setAttribute('aria-expanded', String(!!isOpen));
      });
    }
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Sidebar navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        if (!section) return;

        // Update active state
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Scroll to section
        const target = document.getElementById(section);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Update active nav item on scroll
    const sections = document.querySelectorAll('.section[id]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.toggle('active', nav.dataset.section === id);
          });
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(section => observer.observe(section));

    // Request log controls
    elements.enableLogging?.addEventListener('change', async () => {
      loggingEnabled = elements.enableLogging.checked;
      // Persist the setting to storage
      await setStorage({ loggingEnabled });
      if (loggingEnabled) {
        startLogPolling();
      } else {
        stopLogPolling();
      }
    });

    elements.clearLogBtn?.addEventListener('click', async () => {
      try {
        await sendMessage({ type: 'CLEAR_REQUEST_LOG' });
        renderRequestLog([]);
      } catch (err) {
        logError('Failed to clear log:', err);
      }
    });

    // Stats period selector
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const period = btn.dataset.period;
        if (period === 'today') {
          loadStats('today');
        } else if (period === 'all') {
          loadStats('all');
        } else {
          loadStats(period);
        }
      });
    });

    // Add filter subscription
    elements.addSubscriptionBtn?.addEventListener('click', async () => {
      const name = elements.subscriptionNameInput.value.trim();
      const url = elements.subscriptionUrlInput.value.trim();
      if (!url) {
        showStatus('Please enter a filter list URL', 'error');
        return;
      }
      try {
        const response = await sendMessage({ type: 'ADD_FILTER_SUBSCRIPTION', name, url });
        if (response?.success) {
          elements.subscriptionNameInput.value = '';
          elements.subscriptionUrlInput.value = '';
          showStatus('Subscription added — fetching rules in background...', 'success');
          await loadFilterLists();
          // Poll for update completion
          pollSubscriptionUpdate(url, name || url, null);
        } else {
          showStatus(response?.error || 'Failed to add subscription', 'error');
        }
      } catch (e) {
        logError('Add subscription failed:', e);
        showStatus('Failed: ' + (e.message || 'unknown error'), 'error');
      }
    });

    // Update all filter lists
    elements.updateAllFiltersBtn?.addEventListener('click', async () => {
      try {
        await sendMessage({ type: 'UPDATE_ALL_FILTER_SUBSCRIPTIONS' });
        showStatus('All filter lists updated', 'success');
        await loadFilterLists();
      } catch (e) {
        showStatus('Failed to update filter lists', 'error');
      }
    });

    // Add site to whitelist
    elements.addSiteBtn?.addEventListener('click', async () => {
      const site = elements.siteInput.value.trim().toLowerCase();
      if (!site) return;

      // Validate domain
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(site)) {
        showStatus('Please enter a valid domain (e.g., example.com)', 'error');
        return;
      }

      try {
        const response = await sendMessage({ type: 'WHITELIST_SITE', hostname: site });
        if (response?.success) {
          const item = createWhitelistItem(site);
          elements.whitelistList.appendChild(item);
          elements.siteInput.value = '';
        }
      } catch (err) {
        logError('Failed to whitelist site:', err);
      }
    });

    // Enter key for adding site
    elements.siteInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        elements.addSiteBtn.click();
      }
    });

    // Reset stats
    elements.resetStatsBtn?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to reset all statistics?')) {
        try {
          await sendMessage({ type: 'RESET_STATS' });
          elements.totalBlocked.textContent = '0';
          elements.networkBlocked.textContent = '0';
          elements.cosmeticBlocked.textContent = '0';
          if (elements.dataSavedTotal) elements.dataSavedTotal.textContent = '0 MB';
          if (elements.timeSavedTotal) elements.timeSavedTotal.textContent = '0s';
          if (elements.topDomainsChart) clearElement(elements.topDomainsChart);
          if (elements.topSitesChart) clearElement(elements.topSitesChart);
        } catch (err) {
          logError('Failed to reset stats:', err);
        }
      }
    });

    // Export full backup
    elements.exportBackupBtn?.addEventListener('click', async () => {
      const importExportApi = getImportExportApi();
      if (!importExportApi) {
        showStatus('Backup module is not available', 'error');
        return;
      }

      try {
        const result = await importExportApi.downloadExport(
          'websuddhi-backup-' + new Date().toISOString().slice(0, 10) + '.json'
        );
        if (result?.success) {
          showStatus('Full settings backup exported', 'success');
        } else {
          showStatus(result?.error || 'Failed to export backup', 'error');
        }
      } catch (err) {
        showStatus('Failed to export backup', 'error');
      }
    });

    // Import full backup - trigger file picker
    elements.importBackupBtn?.addEventListener('click', () => {
      elements.importBackupFile?.click();
    });

    elements.importBackupFile?.addEventListener('change', async (e) => {
      const importExportApi = getImportExportApi();
      const file = e.target.files[0];
      if (!file) return;

      if (!importExportApi) {
        showStatus('Backup module is not available', 'error');
        elements.importBackupFile.value = '';
        return;
      }

      try {
        const result = await importExportApi.uploadImport(file);
        if (result?.success) {
          await refreshOptionState();
          showStatus('Imported full settings backup', 'success');
        } else {
          showStatus(result?.error || 'Backup import failed', 'error');
        }
      } catch (err) {
        showStatus('Failed to parse backup file', 'error');
      }

      elements.importBackupFile.value = '';
    });

    // Export rules
    elements.exportBtn?.addEventListener('click', async () => {
      try {
        const response = await sendMessage({ type: 'EXPORT_RULES' });
        if (response?.success && response.data) {
          const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'websuddhi-rules-' + new Date().toISOString().slice(0, 10) + '.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showStatus('Rules exported successfully', 'success');
        }
      } catch (err) {
        showStatus('Failed to export rules', 'error');
      }
    });

    // Import rules - trigger file picker
    elements.importBtn?.addEventListener('click', () => {
      elements.importFile.click();
    });

    // Handle file selection
    elements.importFile?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.blockedSelectors || !Array.isArray(data.blockedSelectors)) {
          showStatus('Invalid file format. Expected a WebSuddhi export file.', 'error');
          return;
        }

        const response = await sendMessage({ type: 'IMPORT_RULES', data });
        if (response?.success) {
          showStatus('Imported ' + (data.blockedSelectors.length) + ' rules. Total: ' + response.totalRules, 'success');
          await refreshOptionState();
        } else {
          showStatus(response?.error || 'Import failed', 'error');
        }
      } catch (err) {
        showStatus('Failed to parse import file', 'error');
      }

      // Reset file input
      elements.importFile.value = '';
    });

    // External links - use GitHub for all browsers (no store-specific URLs)
    const GITHUB_URL = 'https://github.com/sriinnu/web-suddhi';

    elements.rateExtension?.addEventListener('click', (e) => {
      e.preventDefault();
      if (api.tabs) {
        api.tabs.create({ url: GITHUB_URL + '/issues' });
      }
    });

    elements.viewSource?.addEventListener('click', (e) => {
      e.preventDefault();
      if (api.tabs) {
        api.tabs.create({ url: GITHUB_URL });
      }
    });
  }

  // ============================================
  // UTILITIES
  // ============================================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.textContent;
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function formatDataSize(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  }

  function formatTimeSaved(ms) {
    if (ms >= 3600000) return (ms / 3600000).toFixed(1) + 'h';
    if (ms >= 60000) return (ms / 60000).toFixed(1) + 'm';
    if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
    return ms + 'ms';
  }

  function showStatus(message, type) {
    // Update inline status if it exists
    if (elements.importExportStatus) {
      elements.importExportStatus.textContent = message;
      elements.importExportStatus.className = 'status-message ' + type;
      setTimeout(() => {
        elements.importExportStatus.textContent = '';
        elements.importExportStatus.className = 'status-message';
      }, 4000);
    }
    // Also show toast
    showToast(message, type);
  }

  function showToast(message, type = 'info', title = '') {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    // Icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'toast-icon ' + type;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    if (type === 'success') {
      path.setAttribute('d', 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z');
    } else if (type === 'error') {
      path.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z');
    } else {
      path.setAttribute('d', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z');
    }

    svg.appendChild(path);
    iconDiv.appendChild(svg);
    toast.appendChild(iconDiv);

    // Content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'toast-content';

    if (title) {
      const titleDiv = document.createElement('div');
      titleDiv.className = 'toast-title';
      titleDiv.textContent = title;
      contentDiv.appendChild(titleDiv);
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = title ? 'toast-message' : 'toast-title';
    msgDiv.textContent = message;
    contentDiv.appendChild(msgDiv);

    toast.appendChild(contentDiv);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', () => removeToast(toast));
    toast.appendChild(closeBtn);

    elements.toastContainer.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => removeToast(toast), 4000);
  }

  function removeToast(toast) {
    if (!toast || !toast.parentElement) return;
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  }

  // ============================================
  // START
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
