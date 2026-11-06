// WebSuddhi popup: Feature toggles state, counts, verdict and the ring.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global animateCount, currentTab, elements, sendToBackground, setStatusBadgeState */
/* exported STATE_WHY, featureToggles, renderCounts, renderRing, siteStateValue, updateFeatureMeta,
   updateUI, updateVerdict */

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
  if (elements.scriptletsToggle) elements.scriptletsToggle.checked = settings.scriptletsEnabled !== false;
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

function featureToggles() {
  return [elements.networkBlockingToggle, elements.urlCleaningToggle, elements.cookieConsentToggle,
    elements.annoyanceToggle, elements.socialBlockingToggle, elements.paywallToggle,
    elements.scriptletsToggle].filter(Boolean);
}

// "4 of 7 on" next to Features and look.
function updateFeatureMeta() {
  if (!elements.featMeta) return;
  const toggles = featureToggles();
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
