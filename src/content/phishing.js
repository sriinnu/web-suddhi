/**
 * @module content/phishing
 * @description Phishing protection overlay.
 *
 * Checks the current domain against the background's phishing database
 * at script load time (before the page renders). If suspicious, displays
 * a full-page warning overlay with go-back, report, and (delayed) proceed
 * options.
 *
 * All user-visible strings are rendered via textContent (never innerHTML
 * with user data) — FIX #1 / #2.
 *
 * @version 2.1.0
 */
'use strict';

import { sendMessageEarly } from './messaging.js';

// ============================================
// EARLY CHECK
// ============================================

/**
 * Check the current domain for phishing indicators.
 * Runs immediately at content-script load, before DOM is ready.
 */
export async function checkForPhishing() {
  try {
    if (window.top !== window) return;
  } catch (_) { return; }

  const protocol = window.location.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') return;

  const hostname = window.location.hostname;
  if (!hostname) return;

  try {
    const response = await sendMessageEarly({ type: 'CHECK_PHISHING', domain: hostname });
    if (response?.isSuspicious) {
      showPhishingWarning(response);
    }
  } catch (_) {
    // Non-critical — fail silently
  }
}

// ============================================
// WARNING OVERLAY
// ============================================

/**
 * Display a full-page phishing warning overlay.
 *
 * @param {object} data
 * @param {string} [data.originalDomain] - The domain the user is visiting.
 * @param {string} [data.realDomain] - The legitimate domain being impersonated.
 * @param {string} [data.matchedBrand] - Brand name being impersonated.
 * @param {string} [data.matchedDomain] - Alias for realDomain.
 * @param {string} [data.riskLevel] - 'high' or 'medium'.
 */
export function showPhishingWarning(data) {
  // Check session dismissal
  try {
    if (sessionStorage.getItem('websuddhi_phishing_dismissed_' + data.originalDomain) === 'true') {
      return;
    }
  } catch (_) { /* sessionStorage may be unavailable */ }

  const realDomain = data.realDomain || data.matchedDomain || 'unknown';
  const matchedBrand = data.matchedBrand || 'Unknown';
  const originalDomain = data.originalDomain || window.location.hostname;
  const riskLevel = (data.riskLevel || '').toString().toLowerCase();
  const isHighRisk = riskLevel === 'high';
  const cooldownSeconds = isHighRisk ? 10 : 5;

  // --- Build overlay using safe DOM methods (no innerHTML with user data) ---
  const overlay = document.createElement('div');
  overlay.className = 'websuddhi-phishing-overlay';
  overlay.id = 'websuddhi-phishing-overlay';

  const modal = document.createElement('div');
  modal.className = 'websuddhi-phishing-modal';

  // Warning icon
  appendWarningIcon(modal);

  // Title
  const title = document.createElement('h1');
  title.className = 'websuddhi-phishing-title';
  title.textContent = 'Warning: Suspicious Website';
  modal.appendChild(title);

  // Alert section
  appendAlertSection(modal, originalDomain, matchedBrand);

  // Domain comparison
  appendComparisonSection(modal, originalDomain, realDomain);

  // Info section
  appendInfoSection(modal);

  // Action buttons
  const { goBackBtn, reportBtn } = appendActionButtons(modal);

  // Advanced — proceed anyway
  const { proceedBtn, domainConfirmInput } = appendAdvancedSection(
    modal, originalDomain, isHighRisk, cooldownSeconds
  );

  // Footer
  appendFooter(modal);

  overlay.appendChild(modal);

  // Insert overlay
  if (document.documentElement) {
    document.documentElement.insertBefore(overlay, document.documentElement.firstChild);
  }

  // Hide page content
  if (document.body) {
    document.body.style.setProperty('display', 'none', 'important');
  }

  // Observe body additions to keep it hidden
  const bodyObserver = new MutationObserver(() => {
    if (document.body && !document.body.hasAttribute('data-websuddhi-phishing-hidden')) {
      document.body.setAttribute('data-websuddhi-phishing-hidden', 'true');
      document.body.style.setProperty('display', 'none', 'important');
    }
  });
  bodyObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Cooldown timer
  let remaining = cooldownSeconds;
  let domainConfirmed = !isHighRisk;
  const baseText = 'Proceed to ' + originalDomain;

  const updateBtn = () => {
    const ready = remaining <= 0 && domainConfirmed;
    proceedBtn.disabled = !ready;
    proceedBtn.style.opacity = ready ? '1' : '0.6';
    proceedBtn.setAttribute('aria-disabled', ready ? 'false' : 'true');
    proceedBtn.textContent = remaining > 0 ? baseText + ' (' + remaining + 's)' : baseText;
  };
  updateBtn();

  const timer = setInterval(() => {
    remaining -= 1;
    updateBtn();
    if (remaining <= 0) clearInterval(timer);
  }, 1000);

  if (domainConfirmInput) {
    const expected = originalDomain.trim().toLowerCase();
    domainConfirmInput.addEventListener('input', () => {
      domainConfirmed = domainConfirmInput.value.trim().toLowerCase() === expected;
      updateBtn();
    });
  }

  // Event handlers
  goBackBtn.onclick = () => {
    clearInterval(timer);
    window.history.length > 1 ? window.history.back() : (window.location.href = 'about:blank');
  };

  reportBtn.onclick = () => {
    reportPhishing(data);
    reportBtn.textContent = 'Thank you for reporting!';
    reportBtn.disabled = true;
    reportBtn.style.opacity = '0.7';
  };

  proceedBtn.onclick = () => {
    if (proceedBtn.disabled) return;
    clearInterval(timer);
    dismissPhishingWarning(overlay, bodyObserver, originalDomain);
  };
}

/**
 * Dismiss the phishing warning overlay and restore page.
 *
 * @param {HTMLElement} overlay
 * @param {MutationObserver} observer
 * @param {string} domain
 */
export function dismissPhishingWarning(overlay, observer, domain) {
  if (observer) observer.disconnect();
  if (overlay?.parentNode) overlay.parentNode.removeChild(overlay);

  if (document.body) {
    document.body.style.removeProperty('display');
    document.body.removeAttribute('data-websuddhi-phishing-hidden');
  }

  try {
    sessionStorage.setItem('websuddhi_phishing_dismissed_' + domain, 'true');
  } catch (_) {}

  sendMessageEarly({ type: 'STOP_PHISHING_ALERT' }).catch(() => {});
}

/**
 * Report a phishing site to the background for telemetry.
 *
 * @param {object} data - Phishing match data.
 */
export function reportPhishing(data) {
  sendMessageEarly({
    type: 'REPORT_PHISHING',
    domain: data.originalDomain,
    matchedBrand: data.matchedBrand,
    realDomain: data.realDomain,
    timestamp: Date.now(),
  }).catch(() => {});
}

// ============================================
// INTERNAL DOM BUILDERS
// ============================================

/** @private */
function appendWarningIcon(parent) {
  const div = document.createElement('div');
  div.className = 'websuddhi-phishing-icon';
  const svg = createSvg('0 0 24 24', 'M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z');
  div.appendChild(svg);
  parent.appendChild(div);
}

/** @private */
function appendAlertSection(parent, originalDomain, matchedBrand) {
  const alertDiv = document.createElement('div');
  alertDiv.className = 'websuddhi-phishing-alert';

  const p = document.createElement('p');
  p.appendChild(document.createTextNode('This website '));
  const strong = document.createElement('strong');
  strong.textContent = originalDomain;
  p.appendChild(strong);
  p.appendChild(document.createTextNode(" looks like it's trying to impersonate:"));
  alertDiv.appendChild(p);

  const brandDiv = document.createElement('div');
  brandDiv.className = 'websuddhi-phishing-brand';
  brandDiv.textContent = matchedBrand;
  alertDiv.appendChild(brandDiv);

  parent.appendChild(alertDiv);
}

/** @private */
function appendComparisonSection(parent, originalDomain, realDomain) {
  const comp = document.createElement('div');
  comp.className = 'websuddhi-phishing-comparison';

  const fakeDiv = createDomainRow('websuddhi-domain-fake', "You're visiting:", originalDomain);
  const realDiv = createDomainRow('websuddhi-domain-real', 'Real website:', realDomain);

  comp.appendChild(fakeDiv);
  comp.appendChild(realDiv);
  parent.appendChild(comp);
}

/** @private */
function createDomainRow(className, label, value) {
  const div = document.createElement('div');
  div.className = className;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'websuddhi-domain-label';
  labelSpan.textContent = label;
  div.appendChild(labelSpan);

  const valueSpan = document.createElement('span');
  valueSpan.className = 'websuddhi-domain-value';
  valueSpan.textContent = value;
  div.appendChild(valueSpan);

  return div;
}

/** @private */
function appendInfoSection(parent) {
  const info = document.createElement('div');
  info.className = 'websuddhi-phishing-info';

  const p = document.createElement('p');
  p.textContent = 'This could be a phishing attempt to steal your:';
  info.appendChild(p);

  const ul = document.createElement('ul');
  ['Passwords and login credentials', 'Credit card information', 'Personal data'].forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ul.appendChild(li);
  });
  info.appendChild(ul);
  parent.appendChild(info);
}

/** @private */
function appendActionButtons(parent) {
  const actions = document.createElement('div');
  actions.className = 'websuddhi-phishing-actions';

  const goBackBtn = document.createElement('button');
  goBackBtn.className = 'websuddhi-btn-safe';
  goBackBtn.id = 'websuddhiGoBack';
  goBackBtn.textContent = ' Go Back to Safety';
  actions.appendChild(goBackBtn);

  const reportBtn = document.createElement('button');
  reportBtn.className = 'websuddhi-btn-report';
  reportBtn.id = 'websuddhiReport';
  reportBtn.textContent = ' Report This Site';
  actions.appendChild(reportBtn);

  parent.appendChild(actions);
  return { goBackBtn, reportBtn };
}

/** @private */
function appendAdvancedSection(parent, originalDomain, isHighRisk, cooldownSeconds) {
  const details = document.createElement('details');
  details.className = 'websuddhi-phishing-advanced';

  const summary = document.createElement('summary');
  summary.textContent = 'I understand the risk, proceed anyway';
  details.appendChild(summary);

  const warning = document.createElement('p');
  warning.className = 'websuddhi-phishing-advanced-warning';
  warning.textContent = 'Only proceed if you are absolutely certain this is safe.';
  details.appendChild(warning);

  const proceedBtn = document.createElement('button');
  proceedBtn.className = 'websuddhi-btn-danger';
  proceedBtn.id = 'websuddhiProceed';
  proceedBtn.disabled = true;
  proceedBtn.setAttribute('aria-disabled', 'true');
  proceedBtn.style.opacity = '0.6';
  details.appendChild(proceedBtn);

  const hint = document.createElement('p');
  hint.className = 'websuddhi-phishing-advanced-warning';
  hint.textContent = isHighRisk
    ? 'High risk: wait ' + cooldownSeconds + ' seconds, then type the full domain to proceed.'
    : 'Please wait ' + cooldownSeconds + ' seconds before proceeding.';
  details.appendChild(hint);

  let domainConfirmInput = null;
  if (isHighRisk) {
    const label = document.createElement('label');
    label.className = 'websuddhi-phishing-advanced-warning';
    label.textContent = 'Type "' + originalDomain + '" to confirm:';
    details.appendChild(label);

    domainConfirmInput = document.createElement('input');
    domainConfirmInput.type = 'text';
    domainConfirmInput.autocomplete = 'off';
    domainConfirmInput.spellcheck = false;
    domainConfirmInput.placeholder = originalDomain;
    domainConfirmInput.setAttribute('aria-label', 'Type domain to confirm proceeding');
    details.appendChild(domainConfirmInput);
  }

  parent.appendChild(details);

  const footer = document.createElement('div');
  footer.className = 'websuddhi-phishing-footer';
  footer.textContent = ' Protected by WebSuddhi';
  parent.appendChild(footer);

  return { proceedBtn, domainConfirmInput };
}

/** @private */
function appendFooter(_parent) {
  // Footer is already appended in appendAdvancedSection for now
  // This is a no-op placeholder for future use
}

/**
 * Create a simple SVG element with a single path.
 * @param {string} viewBox
 * @param {string} d - Path data.
 * @returns {SVGSVGElement}
 * @private
 */
function createSvg(viewBox, d) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  return svg;
}
