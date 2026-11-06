// WebSuddhi - Per-site firewall
// Rules shape: firewallRules = { site: { hostOrStar: { typeOrStar: 'block' | 'allow' } } }
// MV3 compiles to dynamic DNR rules (ids 80001-89999); MV2 decides in webRequest.
(function () {
  'use strict';
  const root = (typeof self !== 'undefined') ? self : globalThis;
  if (!root.WebSuddhi) root.WebSuddhi = {};
  const fw = root.WebSuddhi.firewall = root.WebSuddhi.firewall || {};
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser
    : (typeof chrome !== 'undefined' ? chrome : null);

  const STORAGE_KEY = 'firewallRules';
  const ID_START = 80001;
  const ID_END = 89999;
  const PRIORITY_STAR = 800;
  const PRIORITY_HOST = 810;
  const MAX_RULES = 2000;
  const TYPES = ['script', 'frame', 'xhr', 'image', 'css', 'media', 'font', '*'];
  const ACTIONS = ['block', 'allow'];
  const DNR_TYPES = {
    script: ['script'],
    frame: ['sub_frame'],
    xhr: ['xmlhttprequest', 'websocket'],
    image: ['image'],
    css: ['stylesheet'],
    media: ['media'],
    font: ['font']
  };
  DNR_TYPES['*'] = [].concat(DNR_TYPES.script, DNR_TYPES.frame, DNR_TYPES.xhr,
    DNR_TYPES.image, DNR_TYPES.css, DNR_TYPES.media, DNR_TYPES.font);
  const WR_TYPE_MAP = {
    script: 'script', sub_frame: 'frame', xmlhttprequest: 'xhr', websocket: 'xhr',
    image: 'image', imageset: 'image', stylesheet: 'css', media: 'media', font: 'font'
  };

  fw.ID_START = ID_START;
  fw.ID_END = ID_END;
  fw.MAX_RULES = MAX_RULES;
  fw.TYPES = TYPES;

  const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

  function normalizeHost(value) {
    if (typeof value !== 'string') return null;
    const h = value.trim().toLowerCase().replace(/^www\./, '');
    if (!h || h.length > 253 || h.indexOf('..') !== -1 || !HOST_RE.test(h)) return null;
    return h;
  }
  fw.normalizeSite = normalizeHost;

  fw.mapWebRequestType = function (type) { return WR_TYPE_MAP[type] || null; };

  fw.validateRule = function (site, host, type, action) {
    const s = normalizeHost(site);
    if (!s) return { ok: false, error: 'Invalid site' };
    const h = host === '*' ? '*' : normalizeHost(host);
    if (!h) return { ok: false, error: 'Invalid host' };
    if (TYPES.indexOf(type) === -1) return { ok: false, error: 'Invalid type' };
    if (action !== null && ACTIONS.indexOf(action) === -1) return { ok: false, error: 'Invalid action' };
    return { ok: true, site: s, host: h, type: type, action: action };
  };

  fw.countRules = function (all) {
    let n = 0;
    for (const s of Object.keys(all || {})) {
      for (const h of Object.keys(all[s] || {})) n += Object.keys(all[s][h] || {}).length;
    }
    return n;
  };

  // Drop anything invalid so a corrupt/imported blob can never break compilation.
  fw.sanitize = function (all) {
    const out = {};
    if (!all || typeof all !== 'object') return out;
    let count = 0;
    for (const site of Object.keys(all)) {
      const s = normalizeHost(site);
      if (!s || !all[site] || typeof all[site] !== 'object') continue;
      for (const host of Object.keys(all[site])) {
        const h = host === '*' ? '*' : normalizeHost(host);
        const cells = all[site][host];
        if (!h || !cells || typeof cells !== 'object') continue;
        for (const type of Object.keys(cells)) {
          if (TYPES.indexOf(type) === -1 || ACTIONS.indexOf(cells[type]) === -1) continue;
          if (count >= MAX_RULES) return out;
          if (!out[s]) out[s] = {};
          if (!out[s][h]) out[s][h] = {};
          out[s][h][type] = cells[type];
          count++;
        }
      }
    }
    return out;
  };

  // Pure edit: returns { ok, rules, site } with the cell set/removed (action null removes).
  fw.applyChange = function (all, site, host, type, action) {
    const v = fw.validateRule(site, host, type, action);
    if (!v.ok) return v;
    const next = fw.sanitize(all);
    if (action === null) {
      if (next[v.site] && next[v.site][v.host]) {
        delete next[v.site][v.host][type];
        if (!Object.keys(next[v.site][v.host]).length) delete next[v.site][v.host];
        if (!Object.keys(next[v.site]).length) delete next[v.site];
      }
    } else {
      const exists = next[v.site] && next[v.site][v.host] && next[v.site][v.host][type];
      if (!exists && fw.countRules(next) >= MAX_RULES) return { ok: false, error: 'Rule limit reached' };
      if (!next[v.site]) next[v.site] = {};
      if (!next[v.site][v.host]) next[v.site][v.host] = {};
      next[v.site][v.host][type] = action;
    }
    return { ok: true, rules: next, site: v.site };
  };

  // Compile every cell into a DNR rule. Host rules outrank '*' rules.
  fw.compileDnrRules = function (all) {
    const clean = fw.sanitize(all);
    const rules = [];
    let id = ID_START;
    for (const site of Object.keys(clean).sort()) {
      for (const host of Object.keys(clean[site]).sort()) {
        for (const type of Object.keys(clean[site][host]).sort()) {
          if (id > ID_END) return rules;
          const condition = { initiatorDomains: [site], resourceTypes: DNR_TYPES[type].slice() };
          if (host === '*') condition.excludedRequestDomains = [site];
          else condition.requestDomains = [host];
          rules.push({
            id: id++,
            // A single type outranks the same host's "all types" cell, as the popup shows it.
            priority: (host === '*' ? PRIORITY_STAR : PRIORITY_HOST) + (type === '*' ? 0 : 1),
            action: { type: clean[site][host][type] === 'allow' ? 'allow' : 'block' },
            condition: condition
          });
        }
      }
    }
    return rules;
  };

  function domainMatches(host, cand) { return host === cand || host.endsWith('.' + cand); }

  function tierDecision(cells, type) {
    if (!cells) return null;
    // Same order as the DNR priorities: the type's own cell, then "all types".
    return cells[type] || cells['*'] || null;
  }

  // MV2 decision. Returns 'block' | 'allow' | null. Host rules beat '*'.
  fw.decide = function (all, site, reqHost, mappedType) {
    const rules = all && all[site];
    if (!rules || !reqHost || !mappedType) return null;
    const host = String(reqHost).toLowerCase();
    const labels = host.split('.');
    let hostDecision = null;
    for (let i = 0; i < labels.length; i++) {
      const d = tierDecision(rules[labels.slice(i).join('.')], mappedType);
      if (d === 'allow') { hostDecision = 'allow'; break; }
      if (d) hostDecision = d;
    }
    if (hostDecision) return hostDecision;
    if (domainMatches(host, site)) return null; // '*' is third-party only
    return tierDecision(rules['*'], mappedType);
  };

  function siteOf(details) {
    const src = details.documentUrl || details.originUrl || details.initiator || '';
    try { return normalizeHost(new URL(src).hostname); } catch (e) { return null; }
  }

  fw.decideRequest = function (all, details) {
    if (!details || details.type === 'main_frame') return null;
    const type = fw.mapWebRequestType(details.type);
    const site = siteOf(details);
    if (!type || !site) return null;
    let host;
    try { host = new URL(details.url).hostname; } catch (e) { return null; }
    return fw.decide(all, site, host, type);
  };

  // ---------- storage + runtime wiring ----------
  let cache = {};
  let store = null; // test hook: { get(): Promise<obj>, set(obj): Promise }

  function readAll() {
    if (store) return store.get();
    const utils = root.WebSuddhi.utils;
    if (utils && utils.getStorage) {
      return utils.getStorage([STORAGE_KEY]).then((d) => (d || {})[STORAGE_KEY] || {});
    }
    return new Promise((resolve) => {
      try { api.storage.local.get([STORAGE_KEY], (d) => resolve((d && d[STORAGE_KEY]) || {})); }
      catch (e) { resolve({}); }
    });
  }
  function writeAll(rules) {
    cache = rules;
    if (store) return store.set(rules);
    const utils = root.WebSuddhi.utils;
    if (utils && utils.setStorage) return utils.setStorage({ [STORAGE_KEY]: rules });
    return new Promise((resolve) => {
      try { api.storage.local.set({ [STORAGE_KEY]: rules }, () => resolve()); } catch (e) { resolve(); }
    });
  }

  fw._setStore = function (s) { store = s; };
  fw._setCache = function (c) { cache = c; };

  fw.recompile = async function (all, apiOverride) {
    const a = apiOverride || api;
    if (!a || !a.declarativeNetRequest) return;
    try {
      const existing = await a.declarativeNetRequest.getDynamicRules();
      const removeRuleIds = (existing || []).map((r) => r.id).filter((id) => id >= ID_START && id <= ID_END);
      await a.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: removeRuleIds, addRules: fw.compileDnrRules(all)
      });
    } catch (e) { console.error('[WebSuddhi] firewall recompile failed:', e); }
  };

  fw.getSiteRules = async function (site) {
    const s = normalizeHost(site);
    if (!s) return {};
    const all = fw.sanitize(await readAll());
    return all[s] || {};
  };

  fw.setRule = async function (site, host, type, action, apiOverride) {
    const all = await readAll();
    const res = fw.applyChange(all, site, host, type, action === undefined ? null : action);
    if (!res.ok) return { success: false, error: res.error };
    await writeAll(res.rules);
    await fw.recompile(res.rules, apiOverride);
    return { success: true, rules: res.rules[res.site] || {} };
  };

  fw.resetSite = async function (site, apiOverride) {
    const s = normalizeHost(site);
    if (!s) return { success: false, error: 'Invalid site' };
    const next = fw.sanitize(await readAll());
    delete next[s];
    await writeAll(next);
    await fw.recompile(next, apiOverride);
    return { success: true };
  };

  function mv2Listener(details) {
    try {
      if (fw.decideRequest(cache, details) === 'block') return { cancel: true };
    } catch (e) { /* never break a request */ }
    return {};
  }
  fw._mv2Listener = mv2Listener;

  // Used by network-blocker's MV2 handler: 'allow' lets a request past the lists.
  fw.decideCached = function (details) {
    try { return fw.decideRequest(cache, details); } catch (e) { return null; }
  };

  fw.init = async function () {
    if (!api) return;
    try {
      cache = fw.sanitize(await readAll());
      if (api.declarativeNetRequest) {
        await fw.recompile(cache);
      } else if (api.webRequest && api.webRequest.onBeforeRequest) {
        api.webRequest.onBeforeRequest.addListener(mv2Listener, { urls: ['<all_urls>'] }, ['blocking']);
      }
      if (api.storage && api.storage.onChanged) {
        api.storage.onChanged.addListener((changes, area) => {
          if (area !== 'local' || !changes || !(STORAGE_KEY in changes)) return;
          cache = fw.sanitize(changes[STORAGE_KEY].newValue);
          if (api.declarativeNetRequest) fw.recompile(cache);
        });
      }
    } catch (e) { console.error('[WebSuddhi] firewall init failed:', e); }
  };

  fw.init();
})();
