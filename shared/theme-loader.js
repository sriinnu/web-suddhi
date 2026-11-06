/**
 * @module theme-loader
 * @description Loads the saved palette, colour mode, font and border radius
 * from storage and applies them before first paint. Load it after
 * shared/palettes.js and before any other page script in popup.html and
 * options.html.
 *
 * The old single `theme` setting (light, forest-dark, …) is migrated to
 * `palette` + `colorMode` the first time it is read.
 * @version 3.1.0
 */
'use strict';

(function () {
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  const themes = globalThis.WebSuddhiThemes || null;
  if (!api || !api.storage || !themes) return;

  const FONT_STACKS = {
    system: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif",
    mono: "'SF Mono', 'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Consolas', 'Liberation Mono', monospace"
  };

  // A custom palette's CSS arrives a moment later from themes.json, so accept
  // any well-formed id here. One whose CSS never arrives shows the default.
  function knownPalette(id) {
    return typeof id === 'string' && id !== '' && themes.safeId(id) === id;
  }

  let current = { palette: themes.DEFAULT_PALETTE, colorMode: 'system' };

  function applyTheme(stored) {
    current = themes.resolve(stored, knownPalette);
    themes.apply(document, current.palette, current.colorMode);
    return current;
  }

  function applyFontFamily(fontFamily) {
    const root = document.documentElement;
    if (!fontFamily || fontFamily === 'system') {
      root.style.removeProperty('--font-family');
      root.style.removeProperty('font-family');
      return;
    }
    const stack = FONT_STACKS[fontFamily] || ("'" + fontFamily + "', " + FONT_STACKS.system);
    root.style.setProperty('--font-family', stack);
    root.style.fontFamily = stack;
  }

  function applyBorderRadius(value) {
    const root = document.documentElement;
    root.style.setProperty('--radius-sm', Math.max(value - 4, 0) + 'px');
    root.style.setProperty('--radius-md', value + 'px');
    root.style.setProperty('--radius-lg', Math.min(value + 6, 30) + 'px');
  }

  api.storage.local.get(['palette', 'colorMode', 'theme', 'fontSize', 'fontFamily', 'borderRadius'], function (result) {
    result = result || {};
    const resolved = applyTheme(result);
    if (resolved.migrated) {
      api.storage.local.set({ palette: resolved.palette, colorMode: resolved.colorMode });
    }

    const fontSize = result.fontSize || 14;
    if (fontSize !== 14) document.documentElement.style.fontSize = fontSize + 'px';

    if (result.fontFamily && result.fontFamily !== 'system') applyFontFamily(result.fontFamily);
    if (typeof result.borderRadius === 'number') applyBorderRadius(result.borderRadius);

    // Enables the colour transitions in themes.css once the first paint is right.
    document.documentElement.classList.add('theme-loaded');
  });

  // Live-sync: a change made in the options page shows in an open popup too.
  if (api.storage.onChanged && api.storage.onChanged.addListener) {
    api.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      if (changes.palette || changes.colorMode) {
        applyTheme({
          palette: changes.palette ? changes.palette.newValue : current.palette,
          colorMode: changes.colorMode ? changes.colorMode.newValue : current.colorMode
        });
      } else if (changes.theme && changes.theme.newValue) {
        // An old backup restored over the top: migrate it on the fly.
        const migrated = applyTheme({ theme: changes.theme.newValue });
        api.storage.local.set({ palette: migrated.palette, colorMode: migrated.colorMode });
      }
      if (changes.fontSize) {
        document.documentElement.style.fontSize = (changes.fontSize.newValue || 14) + 'px';
      }
      if (changes.fontFamily) applyFontFamily(changes.fontFamily.newValue || 'system');
      if (changes.borderRadius && typeof changes.borderRadius.newValue === 'number') {
        applyBorderRadius(changes.borderRadius.newValue);
      }
    });
  }
})();
