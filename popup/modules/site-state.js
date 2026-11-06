// WebSuddhi popup: Protected / default / paused, and "Looks broken?".
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global applySiteState, currentTab, elements, loadFrameCensus, refreshTriStateButtons,
   sendToBackground, sendToContentScript, showToast, siteStateValue:writable, STATE_WHY,
   toggleAnnoyanceBlocking, toggleCookieConsent, togglePaywall, toggleScriptlets,
   toggleSocialBlocking, updateVerdict */
/* exported loadSiteState, reflectSiteState, relaxCosmetic, setSiteState */

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
    { el: elements.scriptletsToggle, fn: toggleScriptlets },
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
