import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildThemesCss } from '../scripts/build-themes.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Themes = require('../shared/palettes.js');

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio]
const PAIRS = [
  ['fg', 'bg', 7], ['fg', 'surface', 7], ['fg', 'surface2', 7],
  ['mute', 'bg', 4.5], ['mute', 'surface', 4.5],
  ['accent', 'bg', 4.5], ['accent', 'surface', 4.5],
  ['accentFg', 'accent', 4.5],
  ['good', 'bg', 4.5], ['good', 'surface', 4.5],
  ['warn', 'bg', 4.5], ['warn', 'surface', 4.5],
  ['bad', 'bg', 4.5], ['bad', 'surface', 4.5]
];

it('ships eight palettes, each with a complete light and dark variant', () => {
  expect(Themes.ORDER).toEqual(['suddhi', 'forest', 'coastal', 'ocean', 'aurora', 'mocha', 'sunset', 'vaporwave']);
  for (const id of Themes.ORDER) {
    expect(Themes.isValidPalette(Themes.PALETTES[id]), id).toBe(true);
  }
});

it('meets WCAG contrast for text, accents and states in every palette and mode', () => {
  const failures = [];
  for (const id of Themes.ORDER) {
    for (const mode of ['light', 'dark']) {
      const v = Themes.PALETTES[id][mode];
      for (const [fg, bg, min] of PAIRS) {
        const ratio = contrast(v[fg], v[bg]);
        if (ratio < min) failures.push(`${id}/${mode} ${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`);
      }
    }
  }
  expect(failures).toEqual([]);
});

it('keeps shared/themes.css in step with shared/palettes.js', () => {
  // Run `node scripts/build-themes.mjs` after changing a palette.
  expect(readFileSync(resolve(ROOT, 'shared/themes.css'), 'utf8')).toBe(buildThemesCss());
});

it('defines every token the popup and options styles use', () => {
  const css = ['shared/themes.css', 'popup/popup.css', 'options/options.css']
    .map((f) => readFileSync(resolve(ROOT, f), 'utf8')).join('\n');
  const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  expect([...used].filter((name) => !defined.has(name))).toEqual([]);
});

it('migrates every old theme value to a palette and mode', () => {
  const cases = {
    system: ['suddhi', 'system'], light: ['suddhi', 'light'], dark: ['suddhi', 'dark'],
    ocean: ['ocean', 'dark'], midnight: ['aurora', 'dark'],
    sunset: ['sunset', 'light'], 'sunset-79': ['sunset', 'light'],
    forest: ['forest', 'light'], 'forest-dark': ['forest', 'dark'],
    coastal: ['coastal', 'light'], 'coastal-dark': ['coastal', 'dark'],
    aurora: ['aurora', 'light'], mocha: ['mocha', 'light'], vaporwave: ['vaporwave', 'dark']
  };
  for (const [theme, [palette, colorMode]] of Object.entries(cases)) {
    expect(Themes.resolve({ theme })).toEqual({ palette, colorMode, migrated: true });
  }
});

it('prefers the new settings and falls back safely on bad values', () => {
  expect(Themes.resolve({ palette: 'ocean', colorMode: 'light', theme: 'forest-dark' }))
    .toEqual({ palette: 'ocean', colorMode: 'light', migrated: false });
  expect(Themes.resolve({})).toEqual({ palette: 'suddhi', colorMode: 'system', migrated: false });
  expect(Themes.resolve({ palette: 'nope', colorMode: 'purple' }))
    .toEqual({ palette: 'suddhi', colorMode: 'system', migrated: false });
  // A custom palette id is kept when the caller says it is known.
  expect(Themes.resolve({ palette: 'my-pal' }, (id) => id === 'my-pal').palette).toBe('my-pal');
});

it('applies the palette and mode as attributes on <html>', () => {
  Themes.apply(document, 'forest', 'dark');
  expect(document.documentElement.getAttribute('data-palette')).toBe('forest');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  Themes.apply(document, 'suddhi', 'system');
  expect(document.documentElement.hasAttribute('data-palette')).toBe(false);
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  Themes.apply(document, 'x"]{} body{', 'light');
  expect(document.documentElement.getAttribute('data-palette')).toBe('xbody');
});

it('rejects custom palettes with missing or non-hex colours', () => {
  const good = Themes.PALETTES.ocean;
  expect(Themes.isValidPalette({ light: good.light, dark: good.dark })).toBe(true);
  expect(Themes.isValidPalette({ light: good.light })).toBe(false);
  expect(Themes.isValidPalette({ light: { ...good.light, bg: 'red;}' }, dark: good.dark })).toBe(false);
  expect(Themes.paletteCss('mine', good)).toContain(':root[data-palette="mine"][data-theme="dark"]');
});
