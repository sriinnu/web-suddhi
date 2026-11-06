// WebSuddhi - page-world scriptlets.
//
// Some ads cannot be reached by network rules or CSS: YouTube's video ads ride
// inside the player data from youtube.com itself. Those need a small script in
// the page's own JavaScript world (see content/scriptlets/). A page-world
// script cannot read extension storage, so it cannot check "is this site
// paused?" itself. Instead this module registers each scriptlet only where it
// should run, and re-registers whenever the relevant settings change.
//
// Requires chrome.scripting.registerContentScripts with world: "MAIN"
// (Chrome/Edge 111+). Where that is missing (Firefox MV2) this module does
// nothing and the rest of the extension is unaffected.

(function () {
  'use strict';

  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  if (!self.WebSuddhi) self.WebSuddhi = {};

  const logError = (...args) => {
    if (self.WebSuddhi.utils && self.WebSuddhi.utils.error) self.WebSuddhi.utils.error(...args);
    else console.error('[WebSuddhi]', ...args);
  };

  const SCRIPTLETS = [
    {
      id: 'websuddhi-youtube-prune',
      js: ['content/scriptlets/youtube-prune.js'],
      // Registrable domains it runs on; subdomains included (www, m, music, embeds).
      sites: ['youtube.com', 'youtube-nocookie.com']
    }
  ];

  // Settings that decide where scriptlets run.
  const WATCHED_KEYS = ['enabled', 'scriptletsEnabled', 'whitelistedSites', 'pausedSites'];

  function sitePatterns(host) {
    return [`*://${host}/*`, `*://*.${host}/*`];
  }

  function stripWww(host) {
    return String(host || '').toLowerCase().trim().replace(/^www\./, '');
  }

  // An allowed/paused entry for the scriptlet's site or a parent of it turns
  // the scriptlet off entirely; one for a subdomain (music.youtube.com) only
  // excludes that subdomain.
  function coversSite(host, site) {
    return host === site || site.endsWith('.' + host);
  }

  function isSubdomainOf(host, site) {
    return host.endsWith('.' + site);
  }

  /**
   * I work out each scriptlet's registration from the current settings.
   * Pure, so the decision is testable without the scripting API.
   * @returns {Array<{id: string, register: boolean, options?: object}>}
   */
  function planRegistrations(settings) {
    const now = Date.now();
    const on = settings.enabled !== false && settings.scriptletsEnabled !== false;
    const paused = Object.entries(settings.pausedSites || {})
      .filter(([, expiry]) => typeof expiry === 'number' && expiry > now)
      .map(([host]) => host);
    const offHosts = [...(settings.whitelistedSites || []), ...paused].map(stripWww).filter(Boolean);

    return SCRIPTLETS.map((scriptlet) => {
      if (!on) return { id: scriptlet.id, register: false };
      if (offHosts.some((host) => scriptlet.sites.some((site) => coversSite(host, site)))) {
        return { id: scriptlet.id, register: false };
      }
      const excluded = offHosts.filter((host) => scriptlet.sites.some((site) => isSubdomainOf(host, site)));
      return {
        id: scriptlet.id,
        register: true,
        options: {
          id: scriptlet.id,
          js: scriptlet.js,
          matches: scriptlet.sites.flatMap(sitePatterns),
          ...(excluded.length ? { excludeMatches: excluded.flatMap(sitePatterns) } : {}),
          runAt: 'document_start',
          allFrames: true,
          world: 'MAIN',
          persistAcrossSessions: true
        }
      };
    });
  }

  function supported() {
    return !!(api.scripting && typeof api.scripting.registerContentScripts === 'function' &&
      typeof api.scripting.getRegisteredContentScripts === 'function');
  }

  function getSettings() {
    return new Promise((resolve) => {
      try {
        const result = api.storage.local.get(WATCHED_KEYS, (data) => resolve(data || {}));
        if (result && typeof result.then === 'function') result.then((data) => resolve(data || {}), () => resolve({}));
      } catch (e) {
        resolve({});
      }
    });
  }

  // Syncs serialise: two quick settings changes must not race each other into
  // a "duplicate script id" error.
  let queue = Promise.resolve();

  function syncScriptlets() {
    queue = queue.then(doSync, doSync);
    return queue;
  }

  async function doSync() {
    if (!supported()) return { success: false, error: 'scripting.registerContentScripts unavailable' };
    try {
      const plan = planRegistrations(await getSettings());
      const ids = SCRIPTLETS.map((s) => s.id);
      const existing = new Set((await api.scripting.getRegisteredContentScripts({ ids })).map((s) => s.id));

      const toUnregister = plan.filter((p) => existing.has(p.id)).map((p) => p.id);
      if (toUnregister.length) await api.scripting.unregisterContentScripts({ ids: toUnregister });

      const toRegister = plan.filter((p) => p.register).map((p) => p.options);
      if (toRegister.length) await api.scripting.registerContentScripts(toRegister);

      return { success: true, registered: toRegister.map((o) => o.id) };
    } catch (err) {
      logError('Scriptlet sync failed:', err);
      return { success: false, error: err && err.message };
    }
  }

  // Listeners go on synchronously so a waking service worker still hears them.
  try {
    if (api.storage && api.storage.onChanged) {
      api.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes) return;
        if (WATCHED_KEYS.some((key) => key in changes)) syncScriptlets();
      });
    }
    if (api.runtime && api.runtime.onInstalled) api.runtime.onInstalled.addListener(() => { syncScriptlets(); });
    if (api.runtime && api.runtime.onStartup) api.runtime.onStartup.addListener(() => { syncScriptlets(); });
  } catch (e) {
    logError('Scriptlet listeners failed:', e);
  }

  syncScriptlets();

  self.WebSuddhi.scriptlets = { syncScriptlets, planRegistrations, SCRIPTLETS };
})();
