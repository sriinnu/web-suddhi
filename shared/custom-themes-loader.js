/**
 * @module custom-themes-loader
 * @description Adds user palettes from shared/themes.json. Each entry is
 *   { "id": "my-palette", "name": "My palette", "note": "optional",
 *     "light": { bg, surface, surface2, fg, mute, accent, accentFg, good, warn, bad },
 *     "dark":  { …the same ten keys… } }
 * with every value a #RRGGBB colour. All other colours are derived from these
 * by shared/themes.css, exactly as for the built-in palettes.
 *
 * Load after shared/palettes.js and shared/themes.css. The fetch is async, so a
 * custom palette can flash the default palette for a frame on first paint.
 * @version 3.1.0
 */
'use strict';

(function () {
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  const themes = globalThis.WebSuddhiThemes || null;
  if (!themes || !api || !api.runtime || typeof api.runtime.getURL !== 'function') return;

  fetch(api.runtime.getURL('shared/themes.json'))
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (list) {
      if (!Array.isArray(list) || list.length === 0) return;

      const css = [];
      const valid = [];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        const id = t && themes.safeId(t.id);
        // Built-in ids are reserved so a custom entry cannot repaint them.
        if (!id || id !== t.id || themes.PALETTES[id] || !themes.isValidPalette(t)) continue;
        css.push(themes.paletteCss(id, t));
        valid.push({ id: id, name: String(t.name || id), note: String(t.note || ''), light: t.light, dark: t.dark });
      }
      if (css.length === 0) return;

      const style = document.createElement('style');
      style.id = 'websuddhi-custom-themes';
      style.textContent = css.join('\n\n');
      (document.head || document.documentElement).appendChild(style);

      window.__websuddhiCustomThemes = valid;
      window.dispatchEvent(new CustomEvent('websuddhi:custom-themes-loaded', { detail: valid }));
    })
    .catch(function () { /* themes.json missing or invalid: the built-ins still work */ });
})();
