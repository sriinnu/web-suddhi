// WebSuddhi - Frame Classifier
// Pure category + heaviness classification. No browser APIs in the hot path.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.classifier) self.WebSuddhi.classifier = {};
  const c = self.WebSuddhi.classifier;

  const KNOWN_TRACKER_CATEGORIES = new Set(['ad', 'analytics', 'session-replay']);

  // Match a host against a { domain: category } map, exact or any parent suffix.
  function matchList(host, list) {
    if (!host || !list) return null;
    const parts = host.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const d = parts.slice(i).join('.');
      if (Object.prototype.hasOwnProperty.call(list, d)) return list[d];
    }
    return Object.prototype.hasOwnProperty.call(list, host) ? list[host] : null;
  }

  c.categorize = function (frameInfo, lists) {
    const info = frameInfo || {};
    const host = (info.domain || '').toLowerCase();
    const protectedList = (lists && lists.protected) || {};
    const categories = (lists && lists.categories) || {};

    const protCat = matchList(host, protectedList);
    if (protCat) return { category: protCat, isProtected: true, isKnownAdTracker: false };

    const knownCat = matchList(host, categories);
    if (knownCat) {
      return { category: knownCat, isProtected: false, isKnownAdTracker: KNOWN_TRACKER_CATEGORIES.has(knownCat) };
    }

    // Heuristics for unknown frames — never marked known-ad-tracker (so they only
    // get auto-blocked at "aggressive", flagged at "balanced"; protects #2).
    const w = Number(info.width) || 0;
    const h = Number(info.height) || 0;
    if (w > 0 && h > 0 && w <= 2 && h <= 2) {
      return { category: 'analytics', isProtected: false, isKnownAdTracker: false };
    }
    const url = (info.url || '').toLowerCase();
    if (/(\/ads?\/|\/pixel|adframe|\/embed\/ad)/.test(url)) {
      return { category: 'ad', isProtected: false, isKnownAdTracker: false };
    }

    return { category: 'other', isProtected: false, isKnownAdTracker: false };
  };

  c.estimateHeaviness = function (metrics, budget) {
    const m = metrics || {};
    const b = budget || { bytes: 500 * 1024, ms: 150 };
    return (Number(m.bytes) || 0) > b.bytes || (Number(m.longTaskMs) || 0) > b.ms;
  };

  c.KNOWN_TRACKER_CATEGORIES = KNOWN_TRACKER_CATEGORIES;
})();
