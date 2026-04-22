/**
 * @module custom-themes-loader
 * @description Reads shared/themes.json and injects one <style> block per
 * custom theme so [data-theme="<id>"] selectors become active. Users add or
 * remove entries in themes.json — no build step, no JS edit needed.
 *
 * Load order: after fonts.css + themes.css, before theme-loader.js applies
 * the saved theme. Keep this file synchronous-looking but fetch is async —
 * a very brief FOUC on first paint for custom themes is the accepted cost.
 * @version 2.3.0
 */
'use strict';

(function () {
  var api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  if (!api || !api.runtime || typeof api.runtime.getURL !== 'function') return;

  var url = api.runtime.getURL('shared/themes.json');

  fetch(url)
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (themes) {
      if (!Array.isArray(themes) || themes.length === 0) return;

      var cssBlocks = [];
      var valid = [];
      for (var i = 0; i < themes.length; i++) {
        var t = themes[i];
        if (!t || typeof t.id !== 'string' || !t.tokens || typeof t.tokens !== 'object') continue;
        var safeId = t.id.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!safeId) continue;
        var decls = [];
        var keys = Object.keys(t.tokens);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          if (!/^--[a-zA-Z0-9_-]+$/.test(key)) continue;
          var val = String(t.tokens[key]).replace(/[<>]/g, '');
          decls.push('  ' + key + ': ' + val + ';');
        }
        if (decls.length === 0) continue;
        cssBlocks.push('[data-theme="' + safeId + '"] {\n' + decls.join('\n') + '\n}');
        valid.push(t);
      }

      if (cssBlocks.length === 0) return;

      var style = document.createElement('style');
      style.id = 'websuddhi-custom-themes';
      style.textContent = cssBlocks.join('\n\n');
      (document.head || document.documentElement).appendChild(style);

      window.__websuddhiCustomThemes = valid;
      window.dispatchEvent(new CustomEvent('websuddhi:custom-themes-loaded', { detail: valid }));
    })
    .catch(function () { /* themes.json missing or invalid — silent fallback */ });
})();
