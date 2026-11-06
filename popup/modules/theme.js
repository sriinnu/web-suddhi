// WebSuddhi popup: Palette and light/dark mode controls.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global elements, getStorage, setStorage */
/* exported loadPopupTheme, setTheme */

// ============================================
// THEME
// ============================================
// A theme is a palette (colour family) plus a mode (system, light, dark).
// shared/palettes.js holds both lists; theme-loader.js has already applied
// the saved choice by the time this runs, so this only fills the controls.
const Themes = window.WebSuddhiThemes;
let themeState = { palette: 'suddhi', colorMode: 'system' };

function availablePalettes() {
  const list = Themes ? Themes.ORDER.map((id) => ({ id, name: Themes.PALETTES[id].name })) : [];
  const custom = Array.isArray(window.__websuddhiCustomThemes) ? window.__websuddhiCustomThemes : [];
  for (const t of custom) {
    if (t && t.id && !list.some((p) => p.id === t.id)) list.push({ id: t.id, name: t.name || t.id });
  }
  return list;
}

// The swatch for a palette: its accent in the mode the popup is showing.
function paletteSwatch(id) {
  const pal = Themes && Themes.PALETTES[id];
  if (!pal) return null;
  const dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.hasAttribute('data-theme') && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const v = dark ? pal.dark : pal.light;
  return { accent: v.accent, bg: v.bg };
}

// One round button per palette. Custom palettes get a neutral swatch.
function fillPaletteDots() {
  const box = elements.paletteDots;
  if (!box) return;
  while (box.firstChild) box.removeChild(box.firstChild);
  for (const p of availablePalettes()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dot';
    btn.dataset.palette = p.id;
    btn.title = p.name;
    btn.setAttribute('aria-label', p.name);
    btn.setAttribute('aria-pressed', 'false');
    const swatch = document.createElement('i');
    const colours = paletteSwatch(p.id);
    if (colours) swatch.style.background = 'linear-gradient(135deg, ' + colours.bg + ' 0 50%, ' + colours.accent + ' 50% 100%)';
    else swatch.style.background = 'var(--c4)';
    btn.appendChild(swatch);
    box.appendChild(btn);
  }
}

function syncThemeControls() {
  if (elements.paletteDots) {
    for (const btn of elements.paletteDots.querySelectorAll('.dot')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.palette === themeState.palette));
    }
  }
  if (elements.paletteName) {
    const match = availablePalettes().find((p) => p.id === themeState.palette);
    elements.paletteName.textContent = match ? match.name : '';
  }
  if (elements.modeSeg) {
    for (const btn of elements.modeSeg.querySelectorAll('button[data-mode]')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === themeState.colorMode));
    }
  }
}

async function loadPopupTheme() {
  fillPaletteDots();
  window.addEventListener('websuddhi:custom-themes-loaded', () => {
    fillPaletteDots();
    syncThemeControls();
  });
  if (!Themes) return;
  try {
    const stored = await getStorage(['palette', 'colorMode', 'theme']);
    themeState = Themes.resolve(stored, (id) => typeof id === 'string' && Themes.safeId(id) === id && id !== '');
    Themes.apply(document, themeState.palette, themeState.colorMode);
    if (themeState.migrated) {
      await setStorage({ palette: themeState.palette, colorMode: themeState.colorMode });
    }
  } catch (e) {
    // Keep the default palette.
  }
  syncThemeControls();
}

async function setTheme(change) {
  if (!Themes) return;
  themeState = {
    palette: change.palette || themeState.palette || Themes.DEFAULT_PALETTE,
    colorMode: change.colorMode || themeState.colorMode || 'system'
  };
  Themes.apply(document, themeState.palette, themeState.colorMode);
  // Swatches follow the mode, so redraw them when it changes.
  if (change.colorMode) fillPaletteDots();
  syncThemeControls();
  await setStorage({ palette: themeState.palette, colorMode: themeState.colorMode });
}
