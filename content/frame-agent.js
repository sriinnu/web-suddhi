// WebSuddhi - Frame Agent
// Runs in every frame: identity announce, self-measurement, teardown of child iframes.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.frameAgent) self.WebSuddhi.frameAgent = {};
  const agent = self.WebSuddhi.frameAgent;

  function hostFromUrl(u) {
    try { return new URL(u).hostname.toLowerCase(); } catch (e) { return null; }
  }

  // win: a window-like object (real `window` in production, a stub in tests).
  agent.buildFrameInfo = function (win) {
    const loc = win.location || {};
    let parentDomain = null;
    const ancestors = win.ancestorOrigins;
    if (ancestors && ancestors.length > 0) {
      parentDomain = hostFromUrl(ancestors[0]) || hostFromUrl(ancestors[ancestors.length - 1]);
    } else if (win.referrer) {
      parentDomain = hostFromUrl(win.referrer);
    }
    return {
      url: loc.href || '',
      domain: (loc.hostname || '').toLowerCase(),
      parentDomain: parentDomain || null,
      width: Number(win.innerWidth) || 0,
      height: Number(win.innerHeight) || 0
    };
  };

  // Sum transferred bytes from the Resource Timing entries (read from inside the
  // frame, so cross-origin Timing-Allow-Origin restrictions are sidestepped).
  agent.measureBytes = function (perf) {
    if (!perf || typeof perf.getEntriesByType !== 'function') return 0;
    let total = 0;
    for (const e of perf.getEntriesByType('resource')) total += Number(e.transferSize) || 0;
    return total;
  };

  // Long-task accumulator wired by startMeasuring(); held here so reports can read it.
  let longTaskMs = 0;
  agent.getLongTaskMs = function () { return longTaskMs; };
  agent._addLongTask = function (ms) { longTaskMs += Number(ms) || 0; }; // used by observer + tests

  agent.startMeasuring = function (win) {
    const w = win || self;
    if (typeof w.PerformanceObserver !== 'function') return null;
    try {
      const obs = new w.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) agent._addLongTask(entry.duration);
      });
      obs.observe({ entryTypes: ['longtask'] });
      return obs;
    } catch (e) {
      return null;
    }
  };

  // Remove child <iframe> nodes whose src contains matchUrl. Runs in the PARENT
  // frame (it owns the iframe element); tearing down the node kills the frame's
  // process, reclaiming RAM/CPU. Returns the number removed.
  agent.teardownChildFrames = function (doc, matchUrl) {
    if (!doc || !matchUrl) return 0;
    let removed = 0;
    const frames = doc.querySelectorAll('iframe');
    for (const f of frames) {
      const src = f.getAttribute('src') || f.src || '';
      if (src.indexOf(matchUrl) !== -1) { f.remove(); removed += 1; }
    }
    return removed;
  };

  // ---- Runtime bootstrap (skipped in tests where there's no chrome.runtime) ----
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser
            : (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : null;

  function send(msg) {
    if (!api) return;
    try { api.runtime.sendMessage(msg, () => void api.runtime.lastError); } catch (e) { /* frame torn down */ }
  }

  agent.start = function () {
    if (!api || typeof window === 'undefined') return;
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;

    send({ type: 'FRAME_ANNOUNCE', frameInfo: agent.buildFrameInfo(window) });

    // Parent enumerates its child iframes for the sandbox/no-script fallback.
    if (document && document.querySelectorAll) {
      const children = Array.from(document.querySelectorAll('iframe'))
        .map((f) => ({ src: f.getAttribute('src') || f.src || '' }))
        .filter((c) => c.src);
      if (children.length) send({ type: 'FRAME_CHILDREN', children });
    }

    agent.startMeasuring(window);
    // Report metrics at settle points rather than polling continuously.
    const report = () => send({ type: 'FRAME_METRICS', bytes: agent.measureBytes(window.performance), longTaskMs: agent.getLongTaskMs() });
    setTimeout(report, 1500);
    setTimeout(report, 5000);

    api.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'TEARDOWN_FRAME') agent.teardownChildFrames(document, msg.matchUrl);
    });
  };

  if (api && typeof window !== 'undefined' && !self.__WS_FRAME_AGENT_TEST__) {
    agent.start();
  }
})();
