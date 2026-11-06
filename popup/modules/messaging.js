// WebSuddhi popup: Storage, background and content-script messaging, certificate panel.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global api, currentTab, elements */
/* exported extractCertificate, extractRequestLog, getPrimaryDomainFromTab, getStorage,
   lastSecuritySnapshot, normalizeRiskLevel, populateCertDetailsPanel, sendToBackground,
   sendToBackgroundWithFallback, sendToContentScript, setStatusBadgeState, setStorage,
   toggleCertDetails */

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
