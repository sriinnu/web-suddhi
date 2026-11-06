// WebSuddhi - Rule List Loader
// Fetches + caches the categorized + protected JSON lists for the classifier.
(function () {
  'use strict';
  if (!self.WebSuddhi) self.WebSuddhi = {};
  if (!self.WebSuddhi.listLoader) self.WebSuddhi.listLoader = {};
  const loader = self.WebSuddhi.listLoader;
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

  let cache = null; // { protected, categories }
  let inflight = null;

  async function fetchJson(path) {
    try {
      const res = await fetch(api.runtime.getURL(path));
      return await res.json();
    } catch (e) {
      return {};
    }
  }

  loader.loadLists = function () {
    if (cache) return Promise.resolve(cache);
    if (inflight) return inflight;
    inflight = Promise.all([
      fetchJson('rules/protected.json'),
      fetchJson('rules/categories.json')
    ]).then(([protectedList, categories]) => {
      cache = { protected: protectedList || {}, categories: categories || {} };
      inflight = null;
      return cache;
    });
    return inflight;
  };

  loader.getLists = function () {
    return cache || { protected: {}, categories: {} };
  };

  loader._reset = function () { cache = null; inflight = null; }; // test hook
})();
