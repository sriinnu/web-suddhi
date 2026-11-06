// WebSuddhi popup: Shared DOM handles, browser API and popup-wide state.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* exported SVG_PATHS, animateCount, api, currentSecurityContext, currentSettings, currentTab,
   elements, isBlacklisted, isPaused, isPickMode, isWhitelisted, isZapMode, logError,
   pauseCountdownTimer, pauseExpiry, setButtonContent */

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
  scriptletsToggle: document.getElementById('scriptletsToggle'),
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
