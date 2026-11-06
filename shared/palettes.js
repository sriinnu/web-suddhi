/**
 * @module palettes
 * @description The one source of truth for WebSuddhi's colours.
 *
 * A theme is a palette (its colour family) times a mode (light, dark, or
 * follow the system). Each palette has a light and a dark variant of ten core
 * tokens; every other colour the UI uses (lines, tints, gradients, chart
 * shades, the old token names) is derived from those ten in shared/themes.css.
 *
 * Every variant meets WCAG AAA (7:1) for body text and AA (4.5:1) for muted
 * text, the accent, text on the accent, and the good/warn/bad states.
 * tests/themes.test.js enforces this.
 *
 * Used by:
 *  - scripts/build-themes.mjs, which writes shared/themes.css
 *  - shared/theme-loader.js, which applies the saved palette and mode
 *  - shared/custom-themes-loader.js, which adds palettes from themes.json
 *  - the popup and options pickers
 * @version 3.1.0
 */
'use strict';

(function (root) {
  const CORE_KEYS = ['bg', 'surface', 'surface2', 'fg', 'mute', 'accent', 'accentFg', 'good', 'warn', 'bad'];

  // CSS custom property for each core key.
  const CORE_VARS = {
    bg: '--bg', surface: '--surface', surface2: '--surface2', fg: '--fg', mute: '--mute',
    accent: '--accent', accentFg: '--accent-fg', good: '--good', warn: '--warn', bad: '--bad'
  };

  const PALETTES = {
    suddhi: {
      name: 'Suddhi', note: 'Cream and forest. The house palette.',
      light: { bg: '#F4F1D6', surface: '#FFFDF2', surface2: '#EAE6C6', fg: '#0A3323', mute: '#4A6253', accent: '#105666', accentFg: '#FFFFFF', good: '#24663D', warn: '#8A4F00', bad: '#A23D31' },
      dark: { bg: '#0D1C17', surface: '#152820', surface2: '#1E352B', fg: '#ECEBD3', mute: '#A2B5A8', accent: '#5BBFD1', accentFg: '#06222A', good: '#6DD596', warn: '#F0B456', bad: '#EF9C8E' }
    },
    forest: {
      name: 'Forest', note: 'Moss and bark.',
      light: { bg: '#EEF0E2', surface: '#FAFBF3', surface2: '#E1E5CF', fg: '#1D2B16', mute: '#4E5C43', accent: '#4D6B2C', accentFg: '#FFFFFF', good: '#2F6B3A', warn: '#855A0B', bad: '#A0412E' },
      dark: { bg: '#0F160C', surface: '#182214', surface2: '#223020', fg: '#E6EBD6', mute: '#A4B095', accent: '#A9C77C', accentFg: '#162009', good: '#86D49A', warn: '#E3BC62', bad: '#F0A08C' }
    },
    coastal: {
      name: 'Coastal', note: 'Driftwood and wine.',
      light: { bg: '#F3ECE0', surface: '#FCF8F1', surface2: '#E9DFCE', fg: '#3A1424', mute: '#6B5258', accent: '#8E2F52', accentFg: '#FFFFFF', good: '#2E6A4F', warn: '#86560C', bad: '#B02A3A' },
      dark: { bg: '#1A1016', surface: '#24171E', surface2: '#30212A', fg: '#F0E4D6', mute: '#BBA6A9', accent: '#E591B0', accentFg: '#3A0E20', good: '#8DD3AE', warn: '#E8BC6C', bad: '#FF9AA2' }
    },
    ocean: {
      name: 'Ocean', note: 'Deep water and cyan.',
      light: { bg: '#E8F1F5', surface: '#F7FBFD', surface2: '#D8E6EE', fg: '#0B2235', mute: '#46606F', accent: '#00687D', accentFg: '#FFFFFF', good: '#1D6B58', warn: '#8A5300', bad: '#B0363B' },
      dark: { bg: '#0A1724', surface: '#112233', surface2: '#1A2E42', fg: '#E2EDF4', mute: '#93AEBF', accent: '#4FD3E8', accentFg: '#032430', good: '#6FD8BE', warn: '#FFCB7A', bad: '#FF9E9E' }
    },
    aurora: {
      name: 'Aurora', note: 'Violet and teal.',
      light: { bg: '#F3F0F8', surface: '#FDFCFF', surface2: '#E7E2F2', fg: '#1A1830', mute: '#55536E', accent: '#5B3FD9', accentFg: '#FFFFFF', good: '#16736C', warn: '#8A5300', bad: '#B2345A' },
      dark: { bg: '#0B0A14', surface: '#15131F', surface2: '#201D30', fg: '#ECE9F6', mute: '#A19DBC', accent: '#A894FF', accentFg: '#1A0F4A', good: '#5FE0C6', warn: '#FFD166', bad: '#FF97B0' }
    },
    mocha: {
      name: 'Mocha', note: 'Coffee, paper and clay.',
      light: { bg: '#F4EEE4', surface: '#FCF9F3', surface2: '#E9E0D2', fg: '#33241C', mute: '#68564A', accent: '#8A5A44', accentFg: '#FFFFFF', good: '#4B6E3F', warn: '#86560C', bad: '#A8402F' },
      dark: { bg: '#17110D', surface: '#211913', surface2: '#2D231B', fg: '#F1E7DA', mute: '#BCA898', accent: '#D9A88C', accentFg: '#2C170B', good: '#A5CF8F', warn: '#E9BE6E', bad: '#F39B87' }
    },
    sunset: {
      name: 'Sunset', note: 'Burnt orange and ochre.',
      light: { bg: '#FAF0E4', surface: '#FFFAF3', surface2: '#F1E2CF', fg: '#3A1F12', mute: '#6E5240', accent: '#B4421E', accentFg: '#FFFFFF', good: '#3F6A2A', warn: '#865A00', bad: '#AE2B2B' },
      dark: { bg: '#1A100B', surface: '#251812', surface2: '#33221A', fg: '#F7E8D8', mute: '#C4A890', accent: '#FF9466', accentFg: '#3A1204', good: '#A9D68A', warn: '#F2C760', bad: '#FF9C94' }
    },
    vaporwave: {
      name: 'Vaporwave', note: 'Neon pink and cyan on dusk.',
      light: { bg: '#F6EEF8', surface: '#FFFBFF', surface2: '#EBDDF0', fg: '#251338', mute: '#5F4F72', accent: '#B0237F', accentFg: '#FFFFFF', good: '#0F6F78', warn: '#895200', bad: '#B8263F' },
      dark: { bg: '#160F2C', surface: '#20173D', surface2: '#2C2150', fg: '#F1E8FF', mute: '#AFA0D3', accent: '#FF7ACB', accentFg: '#3A0828', good: '#5FE3EE', warn: '#F5D06A', bad: '#FF8DA0' }
    },

    // The palettes below also carry a character: a typeface, a corner shape
    // and whether lines are drawn in ink (the text colour) instead of a tint.
    terminal: {
      name: 'Terminal', note: 'Phosphor green on a black shell.',
      style: { font: 'mono', shape: 'square', ink: false },
      light: { bg: '#EEF3EA', surface: '#F9FCF6', surface2: '#DFE8DA', fg: '#0A1F0F', mute: '#3C5843', accent: '#0B6B2E', accentFg: '#FFFFFF', good: '#156B3B', warn: '#7A5000', bad: '#A3262A' },
      dark: { bg: '#050A06', surface: '#0B130D', surface2: '#132017', fg: '#B6FFC6', mute: '#6FB283', accent: '#3DFF7E', accentFg: '#00170A', good: '#8CFFC0', warn: '#FFD34D', bad: '#FF6B6B' }
    },
    newsprint: {
      name: 'Newsprint', note: 'Black ink, serif type, the morning paper.',
      style: { font: 'serif', shape: 'square', ink: true },
      light: { bg: '#F2EEE3', surface: '#FBF9F3', surface2: '#E6E0D1', fg: '#111111', mute: '#544F45', accent: '#1B3B6F', accentFg: '#FFFFFF', good: '#2D5E3A', warn: '#7D5200', bad: '#9B1C1C' },
      dark: { bg: '#141311', surface: '#1C1B18', surface2: '#272521', fg: '#EEE9DC', mute: '#ACA493', accent: '#A3BDE3', accentFg: '#0F1B2E', good: '#8CC79C', warn: '#E2B65E', bad: '#F2908F' }
    },
    receipt: {
      name: 'Receipt', note: 'Thermal paper, mono type, red second ink.',
      style: { font: 'mono', shape: 'square', ink: false },
      light: { bg: '#F1EEE5', surface: '#FFFEF9', surface2: '#E9E4D6', fg: '#1A1916', mute: '#5A564B', accent: '#A8122A', accentFg: '#FFFFFF', good: '#2F5F2F', warn: '#784C00', bad: '#8C0F22' },
      dark: { bg: '#101010', surface: '#191918', surface2: '#242422', fg: '#EEEEE7', mute: '#A9A9A1', accent: '#FF7C8C', accentFg: '#2A0008', good: '#9ED39E', warn: '#E8C26A', bad: '#FFA08F' }
    },
    'ligne-claire': {
      name: 'Ligne claire', note: 'Clean ink outlines and flat comic-book colour.',
      style: { font: 'sans', shape: 'round', ink: true },
      light: { bg: '#FFF6DF', surface: '#FFFFFF', surface2: '#FBE7B5', fg: '#111111', mute: '#45455A', accent: '#1957B0', accentFg: '#FFFFFF', good: '#1C7337', warn: '#835400', bad: '#C2102C' },
      dark: { bg: '#0D1530', surface: '#141F46', surface2: '#1D2A5C', fg: '#FFF5D6', mute: '#B8C0DD', accent: '#FFD23F', accentFg: '#1A1400', good: '#7FE0A0', warn: '#FFB86B', bad: '#FF8C8C' }
    }
  };

  // What each style option writes. Only these fixed values ever reach the
  // CSS, so a palette's style cannot inject anything.
  const STYLE_FONTS = { mono: 'var(--font-mono)', serif: 'var(--font-serif)', sans: 'var(--font-sans)' };
  const STYLE_SHAPES = {
    square: { sm: '0px', md: '0px', lg: '2px', full: '2px' },
    round: { sm: '10px', md: '16px', lg: '22px', full: '999px' }
  };

  const DEFAULT_PALETTE = 'suddhi';
  const MODES = ['system', 'light', 'dark'];

  // Old single `theme` values -> [palette, mode]. Dark-only themes keep their
  // look by landing on dark; the duplicates merge into their family.
  const LEGACY_THEMES = {
    system: ['suddhi', 'system'],
    light: ['suddhi', 'light'],
    dark: ['suddhi', 'dark'],
    ocean: ['ocean', 'dark'],
    midnight: ['aurora', 'dark'],
    sunset: ['sunset', 'light'],
    'sunset-79': ['sunset', 'light'],
    forest: ['forest', 'light'],
    'forest-dark': ['forest', 'dark'],
    coastal: ['coastal', 'light'],
    'coastal-dark': ['coastal', 'dark'],
    aurora: ['aurora', 'light'],
    mocha: ['mocha', 'light'],
    vaporwave: ['vaporwave', 'dark']
  };

  const HEX = /^#[0-9a-fA-F]{6}$/;

  /** True when `p` has a complete light and dark variant of plain hex colours. */
  function isValidPalette(p) {
    if (!p || typeof p !== 'object') return false;
    for (let v = 0; v < 2; v++) {
      const variant = p[v === 0 ? 'light' : 'dark'];
      if (!variant || typeof variant !== 'object') return false;
      for (let i = 0; i < CORE_KEYS.length; i++) {
        if (!HEX.test(String(variant[CORE_KEYS[i]]))) return false;
      }
    }
    return true;
  }

  function safeId(id) {
    return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  }

  /**
   * Work out the palette and mode to show from stored settings, migrating the
   * old single `theme` key. `known` decides which palette ids are accepted
   * (built-ins plus any custom ones); unknown palettes fall back to the default.
   * Returns { palette, colorMode, migrated }.
   */
  function resolve(stored, known) {
    stored = stored || {};
    const isKnown = typeof known === 'function' ? known : function (id) { return Object.prototype.hasOwnProperty.call(PALETTES, id); };
    let palette = stored.palette;
    let colorMode = stored.colorMode;
    let migrated = false;

    if (typeof palette !== 'string' || !palette) {
      const legacy = LEGACY_THEMES[stored.theme];
      if (legacy) {
        palette = legacy[0];
        colorMode = legacy[1];
      } else if (typeof stored.theme === 'string' && stored.theme) {
        // A custom theme id from the old themes.json: keep it as a palette.
        palette = stored.theme;
        colorMode = 'system';
      } else {
        palette = DEFAULT_PALETTE;
      }
      migrated = typeof stored.theme === 'string' && stored.theme !== '';
    }

    if (!isKnown(palette)) palette = DEFAULT_PALETTE;
    if (MODES.indexOf(colorMode) === -1) colorMode = 'system';
    return { palette: palette, colorMode: colorMode, migrated: migrated };
  }

  /** Set the palette and mode attributes on <html>. */
  function apply(doc, palette, colorMode) {
    const el = doc && doc.documentElement;
    if (!el) return;
    if (!palette || palette === DEFAULT_PALETTE) el.removeAttribute('data-palette');
    else el.setAttribute('data-palette', safeId(palette));
    if (colorMode === 'light' || colorMode === 'dark') el.setAttribute('data-theme', colorMode);
    else el.removeAttribute('data-theme');
  }

  /** Which variant is on screen right now, resolving `system`. */
  function effectiveMode(colorMode, win) {
    if (colorMode === 'light' || colorMode === 'dark') return colorMode;
    const w = win || (typeof window !== 'undefined' ? window : null);
    const dark = !!(w && w.matchMedia && w.matchMedia('(prefers-color-scheme: dark)').matches);
    return dark ? 'dark' : 'light';
  }

  function declarations(variant, scheme, indent) {
    const lines = [];
    for (let i = 0; i < CORE_KEYS.length; i++) {
      const key = CORE_KEYS[i];
      lines.push(indent + CORE_VARS[key] + ': ' + String(variant[key]).toUpperCase() + ';');
    }
    // Shadows darken in light mode and stay black in dark mode.
    lines.push(indent + '--shadow-base: ' + (scheme === 'dark' ? '#000000' : String(variant.fg).toUpperCase()) + ';');
    lines.push(indent + 'color-scheme: ' + scheme + ';');
    return lines.join('\n');
  }

  /**
   * CSS for one palette: light under the palette selector, dark under the
   * system-dark media query (unless light is forced) and under forced dark.
   * The default palette is written against bare :root so it needs no attribute.
   */
  /** Mode-independent character declarations for a palette, or ''. */
  function styleCss(sel, style) {
    if (!style || typeof style !== 'object') return '';
    const lines = [];
    if (STYLE_FONTS[style.font]) lines.push('  --palette-font: ' + STYLE_FONTS[style.font] + ';');
    const shape = STYLE_SHAPES[style.shape];
    if (shape) {
      lines.push('  --radius-sm: ' + shape.sm + ';', '  --radius-md: ' + shape.md + ';',
        '  --radius-lg: ' + shape.lg + ';', '  --radius-full: ' + shape.full + ';');
    }
    if (style.ink === true) {
      lines.push('  --line: color-mix(in srgb, var(--fg) 30%, var(--surface));', '  --line-strong: var(--fg);');
    }
    return lines.length ? sel + ' {\n' + lines.join('\n') + '\n}\n' : '';
  }

  function paletteCss(id, p) {
    const sel = id === DEFAULT_PALETTE ? ':root' : ':root[data-palette="' + safeId(id) + '"]';
    return styleCss(sel, p.style) + [
      sel + ' {\n' + declarations(p.light, 'light', '  ') + '\n}',
      '@media (prefers-color-scheme: dark) {\n  ' + sel + ':not([data-theme="light"]) {\n' +
        declarations(p.dark, 'dark', '    ') + '\n  }\n}',
      sel + '[data-theme="dark"] {\n' + declarations(p.dark, 'dark', '  ') + '\n}'
    ].join('\n');
  }

  const api = {
    CORE_KEYS: CORE_KEYS,
    CORE_VARS: CORE_VARS,
    PALETTES: PALETTES,
    ORDER: Object.keys(PALETTES),
    DEFAULT_PALETTE: DEFAULT_PALETTE,
    MODES: MODES,
    LEGACY_THEMES: LEGACY_THEMES,
    isValidPalette: isValidPalette,
    resolve: resolve,
    apply: apply,
    effectiveMode: effectiveMode,
    paletteCss: paletteCss,
    safeId: safeId
  };

  // eslint-disable-next-line no-undef -- CommonJS export for the build script and tests.
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WebSuddhiThemes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
