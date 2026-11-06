// WebSuddhi - Per-tab connections log
// Observe-only webRequest listeners (never block) that record which hosts a tab
// talks to, by resource type, plus main-frame IP / Server / HSTS / (Firefox) cert.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  const cl = self.WebSuddhi.connectionLog = self.WebSuddhi.connectionLog || {};
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser
    : (typeof chrome !== 'undefined' ? chrome : null);

  const MAX_HOSTS = 300;
  const MAX_IPS = 3;
  const TYPE_MAP = {
    script: 'script',
    sub_frame: 'frame',
    xmlhttprequest: 'xhr',
    fetch: 'xhr',
    websocket: 'xhr',
    image: 'image',
    imageset: 'image',
    stylesheet: 'css',
    media: 'media',
    font: 'font'
  };
  const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac']);
  const BLOCK_ERRORS = ['ERR_BLOCKED_BY_CLIENT', 'NS_ERROR_ABORT', 'NS_ERROR_BLOCKED_BY_POLICY'];

  const tabs = new Map(); // tabId -> entry

  cl.MAX_HOSTS = MAX_HOSTS;

  cl.mapType = function (type) { return TYPE_MAP[type] || 'other'; };

  function emptyTypes() {
    return { script: 0, frame: 0, xhr: 0, image: 0, css: 0, media: 0, font: 0, other: 0 };
  }

  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ''; }
  }

  // Registrable-ish site: last two labels, or three under co.uk / com.au style suffixes.
  cl.siteOf = function (host) {
    if (!host) return '';
    if (/^[\d.]+$/.test(host) || host.indexOf(':') !== -1) return host;
    const p = host.split('.');
    if (p.length <= 2) return host;
    const tld = p[p.length - 1];
    const sld = p[p.length - 2];
    if (tld.length === 2 && SECOND_LEVEL.has(sld) && p.length >= 3) return p.slice(-3).join('.');
    return p.slice(-2).join('.');
  };

  function newEntry(mainHost) {
    return { mainHost: mainHost || '', mainIp: null, server: null, hsts: false, cert: null, hosts: new Map() };
  }

  function entryFor(tabId) {
    let e = tabs.get(tabId);
    if (!e) { e = newEntry(''); tabs.set(tabId, e); }
    return e;
  }

  function hostRec(entry, host) {
    let rec = entry.hosts.get(host);
    if (rec) return rec;
    if (entry.hosts.size >= MAX_HOSTS) return null;
    rec = {
      host: host,
      firstParty: !!entry.mainHost && cl.siteOf(host) === cl.siteOf(entry.mainHost),
      count: 0,
      blocked: 0,
      types: emptyTypes(),
      ips: []
    };
    entry.hosts.set(host, rec);
    return rec;
  }

  function header(details, name) {
    const list = details.responseHeaders || [];
    for (const h of list) {
      if (h && typeof h.name === 'string' && h.name.toLowerCase() === name) return h.value || '';
    }
    return null;
  }

  function validTab(details) {
    return details && Number.isInteger(details.tabId) && details.tabId >= 0;
  }

  cl.onBeforeRequest = function (details) {
    if (!validTab(details) || details.type !== 'main_frame') return;
    tabs.set(details.tabId, newEntry(hostOf(details.url)));
  };

  cl.onResponse = function (details) {
    if (!validTab(details)) return;
    const entry = entryFor(details.tabId);
    const host = hostOf(details.url);
    if (!host) return;
    if (details.type === 'main_frame') {
      if (!entry.mainHost) entry.mainHost = host;
      entry.mainIp = details.ip || null;
      entry.server = header(details, 'server');
      entry.hsts = header(details, 'strict-transport-security') !== null;
    }
    const rec = hostRec(entry, host);
    if (!rec) return;
    rec.count++;
    rec.types[cl.mapType(details.type)]++;
    if (details.ip && rec.ips.length < MAX_IPS && rec.ips.indexOf(details.ip) === -1) rec.ips.push(details.ip);
  };

  cl.onError = function (details) {
    if (!validTab(details) || details.type === 'main_frame') return;
    const host = hostOf(details.url);
    if (!host) return;
    const rec = hostRec(entryFor(details.tabId), host);
    if (!rec) return;
    const err = String(details.error || '');
    rec.count++;
    rec.types[cl.mapType(details.type)]++;
    if (BLOCK_ERRORS.some((s) => err.indexOf(s) !== -1)) rec.blocked++;
  };

  cl.setCert = function (tabId, cert) {
    if (Number.isInteger(tabId) && tabId >= 0) entryFor(tabId).cert = cert;
  };

  cl.removeTab = function (tabId) { tabs.delete(tabId); };
  cl.clearAll = function () { tabs.clear(); };

  cl.getConnections = function (tabId) {
    const e = tabs.get(tabId);
    if (!e) return { mainHost: '', mainIp: null, server: null, hsts: false, cert: null, hosts: [] };
    const hosts = Array.from(e.hosts.values()).map((r) => ({
      host: r.host, firstParty: r.firstParty, count: r.count, blocked: r.blocked,
      types: Object.assign({}, r.types), ips: r.ips.slice()
    }));
    hosts.sort((a, b) => b.count - a.count || a.host.localeCompare(b.host));
    return { mainHost: e.mainHost, mainIp: e.mainIp, server: e.server, hsts: e.hsts, cert: e.cert, hosts: hosts };
  };

  // Firefox only: getSecurityInfo is exposed on MV2 Firefox. Never blocks the request.
  cl.readCert = async function (details, webRequestApi) {
    try {
      const wr = webRequestApi || (api && api.webRequest);
      if (!wr || typeof wr.getSecurityInfo !== 'function') return null;
      const info = await wr.getSecurityInfo(details.requestId, { certificateChain: false });
      if (!info) return null;
      const leaf = (info.certificates && info.certificates[0]) || {};
      const validity = leaf.validity || {};
      return {
        subject: leaf.subject || null,
        issuer: leaf.issuer || null,
        validFrom: Number.isFinite(validity.start) ? validity.start : null,
        validTo: Number.isFinite(validity.end) ? validity.end : null,
        protocolVersion: info.protocolVersion || null,
        cipherSuite: info.cipherSuite || null,
        state: info.state || null
      };
    } catch (e) {
      return null;
    }
  };

  cl.init = function () {
    if (!api || !api.webRequest) return;
    try {
      const filter = { urls: ['<all_urls>'] };
      if (api.webRequest.onBeforeRequest) {
        api.webRequest.onBeforeRequest.addListener(cl.onBeforeRequest, filter);
      }
      if (api.webRequest.onResponseStarted) {
        try {
          api.webRequest.onResponseStarted.addListener(cl.onResponse, filter, ['responseHeaders']);
        } catch (e) {
          api.webRequest.onResponseStarted.addListener(cl.onResponse, filter);
        }
      }
      if (api.webRequest.onErrorOccurred) api.webRequest.onErrorOccurred.addListener(cl.onError, filter);

      if (typeof api.webRequest.getSecurityInfo === 'function' && api.webRequest.onHeadersReceived) {
        api.webRequest.onHeadersReceived.addListener((details) => {
          if (details.type !== 'main_frame') return {};
          return cl.readCert(details).then((cert) => {
            if (cert) cl.setCert(details.tabId, cert);
            return {};
          }).catch(() => ({}));
        }, { urls: ['<all_urls>'], types: ['main_frame'] }, ['blocking']);
      }
      if (api.tabs && api.tabs.onRemoved) api.tabs.onRemoved.addListener((tabId) => cl.removeTab(tabId));
    } catch (e) {
      console.error('[WebSuddhi] connection log init failed:', e);
    }
  };

  cl.init();
})();
