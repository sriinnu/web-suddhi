#!/usr/bin/env node
/**
 * Writes shared/themes.css from shared/palettes.js.
 *
 * Usage: node scripts/build-themes.mjs [--check]
 *   --check  exit 1 if shared/themes.css is out of date (used by the tests).
 */

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'shared', 'themes.css');
const require = createRequire(import.meta.url);

// Everything below is derived from the ten core tokens, so a palette only ever
// sets those. The custom properties all live on <html>, so these var()
// references resolve against whichever palette and mode is active there.
const DERIVED = `/* ============================================
   Derived tokens. Built from the core ten; never set per palette.
   ============================================ */
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', 'Fira Code', 'Consolas', 'Liberation Mono', monospace;
  --font-family: var(--font-sans);

  --line: color-mix(in srgb, var(--fg) 16%, var(--surface));
  --line-strong: color-mix(in srgb, var(--fg) 30%, var(--surface));
  --hover: color-mix(in srgb, var(--fg) 7%, var(--surface2));
  --accent-soft: color-mix(in srgb, var(--accent) 13%, transparent);
  --good-soft: color-mix(in srgb, var(--good) 13%, transparent);
  --warn-soft: color-mix(in srgb, var(--warn) 14%, transparent);
  --bad-soft: color-mix(in srgb, var(--bad) 13%, transparent);
  --on-status: var(--surface);
  --focus-ring: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent);

  /* Chart shades: four steps of the accent that stay apart in both modes. */
  --c1: var(--accent);
  --c2: color-mix(in srgb, var(--accent) 70%, var(--fg));
  --c3: color-mix(in srgb, var(--accent) 45%, var(--mute));
  --c4: color-mix(in srgb, var(--mute) 70%, var(--surface));

  --shadow-sm: 0 1px 2px color-mix(in srgb, var(--shadow-base) 8%, transparent);
  --shadow-md: 0 4px 6px -1px color-mix(in srgb, var(--shadow-base) 12%, transparent), 0 2px 4px -2px color-mix(in srgb, var(--shadow-base) 9%, transparent);
  --shadow-lg: 0 10px 15px -3px color-mix(in srgb, var(--shadow-base) 14%, transparent), 0 4px 6px -4px color-mix(in srgb, var(--shadow-base) 10%, transparent);
  --shadow-glow: 0 0 20px color-mix(in srgb, var(--accent) 18%, transparent);
  --shadow: var(--shadow-sm);
  --shadow-lg-popup: 0 4px 16px color-mix(in srgb, var(--shadow-base) 14%, transparent);
  --scrim: color-mix(in srgb, var(--shadow-base) 45%, transparent);

  /* Legacy names, kept so popup.css and options.css read the active palette. */
  --bg-primary: var(--bg);
  --bg-secondary: var(--surface);
  --bg-card: var(--surface);
  --bg-tertiary: var(--surface2);
  --bg-hover: var(--hover);
  --text-primary: var(--fg);
  --text-secondary: color-mix(in srgb, var(--fg) 30%, var(--mute));
  --text-tertiary: var(--mute);
  --border-color: var(--line);
  --border: var(--line);
  --border-focus: var(--accent);
  --accent-hover: color-mix(in srgb, var(--accent) 85%, var(--fg));
  --accent-light: color-mix(in srgb, var(--accent) 80%, var(--surface));
  --accent-bg: var(--accent-soft);
  --accent-color: var(--accent);
  --primary: var(--accent);
  --primary-light: var(--accent-light);
  --success: var(--good);
  --success-bg: var(--good-soft);
  --warning: var(--warn);
  --warning-bg: var(--warn-soft);
  --danger: var(--bad);
  --danger-bg: var(--bad-soft);

  /* Gradients shade each colour toward the text colour, which keeps
     --accent-fg (on accent ones) and --on-status (on the others) readable. */
  --gradient-accent: linear-gradient(135deg, var(--accent) 0%, var(--c2) 100%);
  --gradient-blue: var(--gradient-accent);
  --gradient-purple: linear-gradient(135deg, var(--c2) 0%, var(--accent) 100%);
  --gradient-green: linear-gradient(135deg, var(--good) 0%, color-mix(in srgb, var(--good) 75%, var(--fg)) 100%);
  --gradient-orange: linear-gradient(135deg, var(--warn) 0%, var(--bad) 100%);
  --gradient-sidebar: linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%);
  --stat-gradient-1: var(--gradient-accent);
  --stat-gradient-2: var(--gradient-green);
  --stat-gradient-3: var(--gradient-purple);
  --stat-gradient-4: var(--gradient-orange);
}
`;

const TAIL = `
/* ============================================
   Smooth theme transitions
   ============================================ */
html {
  background: var(--bg);
  color: var(--fg);
  transition: background-color 0.3s ease, color 0.3s ease;
}

html.theme-loaded body,
html.theme-loaded .card,
html.theme-loaded .sidebar,
html.theme-loaded .main-content,
html.theme-loaded .popup-wrapper {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
  html, html.theme-loaded body, html.theme-loaded .card, html.theme-loaded .sidebar,
  html.theme-loaded .main-content, html.theme-loaded .popup-wrapper {
    transition: none;
  }
}
`;

export function buildThemesCss() {
  const themes = require(join(ROOT, 'shared', 'palettes.js'));
  const head = `/* ============================================
   WebSuddhi colour themes. GENERATED FILE, do not edit.
   Source: shared/palettes.js. Rebuild: node scripts/build-themes.mjs

   <html data-palette="…">  colour family (absent = ${themes.DEFAULT_PALETTE})
   <html data-theme="…">    light | dark (absent = follow the system)
   ============================================ */
`;
  const blocks = themes.ORDER.map((id) => {
    const p = themes.PALETTES[id];
    return `\n/* ${p.name}: ${p.note} */\n` + themes.paletteCss(id, p);
  });
  return head + '\n' + DERIVED + blocks.join('\n') + '\n' + TAIL;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const css = buildThemesCss();
  if (process.argv.includes('--check')) {
    const current = readFileSync(OUT, 'utf8');
    if (current !== css) {
      console.error('shared/themes.css is out of date. Run: node scripts/build-themes.mjs');
      process.exit(1);
    }
    console.log('shared/themes.css is up to date.');
  } else {
    writeFileSync(OUT, css);
    console.log(`Wrote ${OUT}`);
  }
}
