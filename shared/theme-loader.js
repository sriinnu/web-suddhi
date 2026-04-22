/**
 * @module theme-loader
 * @description Loads saved theme, font, and border radius from storage and
 * applies them immediately to prevent FOUC. Must be loaded before any other
 * JS in both popup.html and options.html.
 * @version 2.3.0
 */
'use strict';

(function () {
  var api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  if (!api || !api.storage) return;

  var FONT_STACKS = {
    system: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif",
    mono: "'SF Mono', 'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Consolas', 'Liberation Mono', monospace"
  };

  api.storage.local.get(['theme', 'fontSize', 'fontFamily', 'borderRadius'], function (result) {
    // Theme
    var theme = result.theme || 'system';
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }

    // Font size
    var fontSize = result.fontSize || 14;
    if (fontSize !== 14) {
      document.documentElement.style.fontSize = fontSize + 'px';
    }

    // Font family
    var fontFamily = result.fontFamily || 'system';
    if (fontFamily !== 'system') {
      var stack = FONT_STACKS[fontFamily];
      if (!stack) {
        // Custom font from fonts/ folder — wrap name in quotes, fall back to system
        stack = "'" + fontFamily + "', " + FONT_STACKS.system;
      }
      document.documentElement.style.setProperty('--font-family', stack);
      document.documentElement.style.fontFamily = stack;
    }

    // Border radius
    var borderRadius = result.borderRadius;
    if (typeof borderRadius === 'number') {
      document.documentElement.style.setProperty('--radius-sm', Math.max(borderRadius - 4, 0) + 'px');
      document.documentElement.style.setProperty('--radius-md', borderRadius + 'px');
      document.documentElement.style.setProperty('--radius-lg', Math.min(borderRadius + 6, 30) + 'px');
    }

    // Mark theme as loaded (enables CSS transitions)
    document.documentElement.classList.add('theme-loaded');
  });

  // Live-sync across surfaces: when any setting changes in storage (e.g. the
  // options page picker), reflect it in whichever extension page is open.
  if (api.storage && api.storage.onChanged && api.storage.onChanged.addListener) {
    api.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      if (changes.theme) {
        var t = changes.theme.newValue || 'system';
        if (t === 'system') document.documentElement.removeAttribute('data-theme');
        else document.documentElement.setAttribute('data-theme', t);
      }
      if (changes.fontSize) {
        var fs = changes.fontSize.newValue || 14;
        document.documentElement.style.fontSize = fs + 'px';
      }
      if (changes.fontFamily) {
        var ff = changes.fontFamily.newValue || 'system';
        if (!ff || ff === 'system') {
          document.documentElement.style.removeProperty('--font-family');
          document.documentElement.style.removeProperty('font-family');
        } else {
          var st = FONT_STACKS[ff] || ("'" + ff + "', " + FONT_STACKS.system);
          document.documentElement.style.setProperty('--font-family', st);
          document.documentElement.style.fontFamily = st;
        }
      }
      if (changes.borderRadius && typeof changes.borderRadius.newValue === 'number') {
        var br = changes.borderRadius.newValue;
        document.documentElement.style.setProperty('--radius-sm', Math.max(br - 4, 0) + 'px');
        document.documentElement.style.setProperty('--radius-md', br + 'px');
        document.documentElement.style.setProperty('--radius-lg', Math.min(br + 6, 30) + 'px');
      }
    });
  }
})();
