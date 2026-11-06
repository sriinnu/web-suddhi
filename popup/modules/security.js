// WebSuddhi popup: Site safety: scam risk, certificate, server, other hosts.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global currentSecurityContext:writable, currentTab, elements, extractCertificate,
   getPrimaryDomainFromTab, lastSecuritySnapshot:writable, loadFirewall, loadFrameCensus,
   normalizeRiskLevel, populateCertDetailsPanel, sendToBackground, sendToBackgroundWithFallback,
   showToast */
/* exported copyCurrentDomain, escapeHtml, extractDomain, hostCategory, loadSecurityDetails,
   reportCurrentSiteAsPhishing, setText, tabConnections, updateSecurityInfo */

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
  // The census ran before the log arrived; redo it so stopped frames show.
  await loadFrameCensus();
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
