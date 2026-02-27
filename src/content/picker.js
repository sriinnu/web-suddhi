/**
 * @module content/picker
 * @description Pick Mode — interactive element selector.
 *
 * Allows the user to hover over page elements, see a live preview
 * of the CSS selector, and click to permanently block the element.
 * Supports Shift (select parent) and Ctrl (specific selector) modifiers.
 *
 * @version 2.1.0
 */
'use strict';

import { state, saveSelectors } from './state.js';
import { getUniqueSelector, getSpecificSelector } from './selector-gen.js';
import { showToast, removeToast, clearHighlights } from './ui.js';
import { blockSelector } from './cosmetic-filter.js';
import { sendMessage } from './messaging.js';
// hideElement available from element-hider.js if needed in future

// ============================================
// PICK MODE LIFECYCLE
// ============================================

/**
 * Start Pick Mode: enable hover highlighting, preview panel, and
 * click-to-block with confirmation dialog.
 */
export function startPickMode() {
  if (!document.body) return;

  if (state.zapMode) {
    // Import stopZapMode lazily to avoid circular deps
    import('./zap.js').then((m) => m.stopZapMode());
  }

  state.pickMode = true;
  state.pickModeShiftHeld = false;
  state.pickModeCtrlHeld = false;
  state.pickDialogOpen = false;
  document.body.classList.add('websuddhi-pick-mode');

  window.focus();
  if (document.body) document.body.focus();

  addPickListeners();

  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';

  createPreviewPanel();
  showToast('Pick mode: click an element to block it. Press Esc to cancel.');
}

/**
 * Stop Pick Mode and clean up all listeners and UI.
 */
export function stopPickMode() {
  state.pickMode = false;
  state.pickModeShiftHeld = false;
  state.pickModeCtrlHeld = false;
  state.pickDialogOpen = false;
  document.body.classList.remove('websuddhi-pick-mode');

  removePickListeners();

  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';

  clearHighlights();
  removePreviewPanel();
  removeToast();

  // Clean up leftover dialogs
  const dialog = document.querySelector('.websuddhi-pick-dialog');
  if (dialog) dialog.remove();
  const preview = document.querySelector('.websuddhi-pick-preview');
  if (preview) preview.remove();
}

// ============================================
// PREVIEW PANEL
// ============================================

/**
 * Create the floating preview panel that shows selector info.
 * @private
 */
function createPreviewPanel() {
  removePreviewPanel();

  const panel = document.createElement('div');
  panel.className = 'websuddhi-preview-panel';

  // Build with DOM methods (no innerHTML)
  const header = document.createElement('div');
  header.className = 'websuddhi-preview-header';
  header.textContent = 'Element Preview';
  panel.appendChild(header);

  const selectorDiv = document.createElement('div');
  selectorDiv.className = 'websuddhi-preview-selector';
  panel.appendChild(selectorDiv);

  const infoDiv = document.createElement('div');
  infoDiv.className = 'websuddhi-preview-info';

  const tagSpan = document.createElement('span');
  tagSpan.className = 'websuddhi-preview-tag';
  infoDiv.appendChild(tagSpan);

  const matchesSpan = document.createElement('span');
  matchesSpan.className = 'websuddhi-preview-matches';
  infoDiv.appendChild(matchesSpan);

  const dimsSpan = document.createElement('span');
  dimsSpan.className = 'websuddhi-preview-dimensions';
  infoDiv.appendChild(dimsSpan);

  panel.appendChild(infoDiv);

  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'websuddhi-preview-details';

  const idSpan = document.createElement('span');
  idSpan.className = 'websuddhi-preview-id';
  detailsDiv.appendChild(idSpan);

  const classesSpan = document.createElement('span');
  classesSpan.className = 'websuddhi-preview-classes';
  detailsDiv.appendChild(classesSpan);

  panel.appendChild(detailsDiv);

  const warningDiv = document.createElement('div');
  warningDiv.className = 'websuddhi-preview-warning';
  warningDiv.style.display = 'none';
  panel.appendChild(warningDiv);

  const hintDiv = document.createElement('div');
  hintDiv.className = 'websuddhi-preview-hint';
  hintDiv.textContent = 'Click to block | Esc cancel | Shift parent | Ctrl specific';
  panel.appendChild(hintDiv);

  panel.style.display = 'none';
  document.body.appendChild(panel);
}

/** @private */
function removePreviewPanel() {
  const panel = document.querySelector('.websuddhi-preview-panel');
  if (panel) panel.remove();
}

/**
 * Update the preview panel with info about the hovered element.
 * @param {HTMLElement} element
 * @private
 */
function updatePreviewPanel(element) {
  const panel = document.querySelector('.websuddhi-preview-panel');
  if (!panel || !element) {
    if (panel) panel.style.display = 'none';
    return;
  }

  let targetElement = element;
  if (state.pickModeShiftHeld && element.parentElement && element.parentElement !== document.body) {
    targetElement = element.parentElement;
    clearHighlights();
    targetElement.classList.add('websuddhi-pick-highlight');
  }

  const selector = state.pickModeCtrlHeld
    ? getSpecificSelector(targetElement)
    : getUniqueSelector(targetElement);

  let matchCount = 0;
  try { matchCount = document.querySelectorAll(selector).length; } catch (_) { matchCount = 1; }

  const tagName = targetElement.tagName.toLowerCase();
  const rect = targetElement.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  const id = targetElement.id || '';
  const classes = typeof targetElement.className === 'string'
    ? targetElement.className.trim().split(/\s+/).filter((c) => c && !c.startsWith('websuddhi')).slice(0, 5)
    : [];

  // Update content
  const sel = panel.querySelector('.websuddhi-preview-selector');
  if (sel) {
    sel.textContent = selector.length > 100 ? selector.substring(0, 100) + '...' : selector;
    sel.title = selector;
  }

  const tag = panel.querySelector('.websuddhi-preview-tag');
  if (tag) tag.textContent = tagName;

  const matches = panel.querySelector('.websuddhi-preview-matches');
  if (matches) {
    matches.textContent = matchCount + ' match' + (matchCount !== 1 ? 'es' : '');
    matches.className = 'websuddhi-preview-matches';
    if (matchCount > 10) matches.classList.add('danger');
    else if (matchCount > 5) matches.classList.add('warning');
  }

  const dims = panel.querySelector('.websuddhi-preview-dimensions');
  if (dims) dims.textContent = w + ' x ' + h + 'px';

  const idEl = panel.querySelector('.websuddhi-preview-id');
  if (idEl) { idEl.textContent = id ? '#' + id : ''; idEl.style.display = id ? 'inline' : 'none'; }

  const clsEl = panel.querySelector('.websuddhi-preview-classes');
  if (clsEl) {
    if (classes.length) { clsEl.textContent = '.' + classes.join(' .'); clsEl.style.display = 'inline'; }
    else clsEl.style.display = 'none';
  }

  const warn = panel.querySelector('.websuddhi-preview-warning');
  if (warn) {
    if (matchCount > 5) {
      warn.textContent = 'Warning: This will block ' + matchCount + ' elements';
      warn.style.display = 'flex';
    } else {
      warn.style.display = 'none';
    }
  }

  // Position
  positionPreviewPanel(panel, rect);
  panel.style.display = 'block';
}

/** @private */
function positionPreviewPanel(panel, elementRect) {
  panel.classList.remove('position-top');
  const panelHeight = panel.offsetHeight || 150;
  const vh = window.innerHeight;
  if (elementRect.bottom > vh / 2 && vh - elementRect.bottom < panelHeight + 40) {
    panel.classList.add('position-top');
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

/** @private */
function addPickListeners() {
  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);
  document.addEventListener('click', handlePickClick, true);
  document.addEventListener('contextmenu', handlePickClick, true);
  document.addEventListener('keydown', handlePickKeyDown, true);
  document.addEventListener('keyup', handlePickKeyUp, true);
}

/** @private */
function removePickListeners() {
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout', handleMouseOut, true);
  document.removeEventListener('click', handlePickClick, true);
  document.removeEventListener('contextmenu', handlePickClick, true);
  document.removeEventListener('keydown', handlePickKeyDown, true);
  document.removeEventListener('keyup', handlePickKeyUp, true);
}

/** @private */
function handleMouseOver(e) {
  if (!state.pickMode) return;
  e.stopPropagation();

  if (isOurUI(e.target) || e.target === document.body || e.target === document.documentElement) return;

  clearHighlights();
  state.hoveredElement = e.target;
  state.hoveredElement.classList.add('websuddhi-pick-highlight');
  updatePreviewPanel(e.target);
}

/** @private */
function handleMouseOut(e) {
  if (!state.pickMode) return;
  if (e.target === state.hoveredElement) {
    e.target.classList.remove('websuddhi-pick-highlight');
    state.hoveredElement = null;
  }
}

/** @private */
function handlePickClick(e) {
  if (!state.pickMode) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  let target = e.target;
  if (state.pickModeShiftHeld && target.parentElement && target.parentElement !== document.body) {
    target = target.parentElement;
  }

  const selector = state.pickModeCtrlHeld
    ? getSpecificSelector(target)
    : getUniqueSelector(target);

  showConfirmDialog(selector, target);
}

/** @private */
function handlePickKeyDown(e) {
  if (!state.pickMode) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    stopPickMode();
    return;
  }

  if (e.key === 'Shift' && !state.pickModeShiftHeld) {
    state.pickModeShiftHeld = true;
    if (state.hoveredElement) updatePreviewPanel(state.hoveredElement);
  }

  if ((e.key === 'Control' || e.key === 'Meta') && !state.pickModeCtrlHeld) {
    state.pickModeCtrlHeld = true;
    if (state.hoveredElement) updatePreviewPanel(state.hoveredElement);
  }
}

/** @private */
function handlePickKeyUp(e) {
  if (!state.pickMode) return;

  if (e.key === 'Shift') {
    state.pickModeShiftHeld = false;
    if (state.hoveredElement) {
      clearHighlights();
      state.hoveredElement.classList.add('websuddhi-pick-highlight');
      updatePreviewPanel(state.hoveredElement);
    }
  }

  if (e.key === 'Control' || e.key === 'Meta') {
    state.pickModeCtrlHeld = false;
    if (state.hoveredElement) updatePreviewPanel(state.hoveredElement);
  }
}

// ============================================
// CONFIRM DIALOG
// ============================================

/**
 * Show a confirmation dialog for blocking an element.
 * @param {string} selector - CSS selector.
 * @param {HTMLElement} element - Target element.
 * @private
 */
function showConfirmDialog(selector, _element) {
  const existing = document.querySelector('.websuddhi-pick-dialog');
  if (existing) existing.remove();

  removePickListeners();
  document.body.classList.remove('websuddhi-pick-mode');
  clearHighlights();
  removePreviewPanel();

  const dialog = document.createElement('div');
  dialog.className = 'websuddhi-pick-dialog';
  dialog.style.cssText =
    'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;' +
    'z-index:2147483647!important;display:flex!important;align-items:center!important;' +
    'justify-content:center!important;pointer-events:auto!important;cursor:default!important;';

  const content = document.createElement('div');
  content.className = 'websuddhi-pick-content';
  content.style.cssText = 'pointer-events:auto!important;';

  const titleEl = document.createElement('div');
  titleEl.className = 'websuddhi-pick-title';
  titleEl.textContent = 'Block this element?';
  content.appendChild(titleEl);

  const selectorEl = document.createElement('code');
  selectorEl.className = 'websuddhi-pick-selector';
  selectorEl.textContent = selector;
  content.appendChild(selectorEl);

  const btns = document.createElement('div');
  btns.className = 'websuddhi-pick-buttons';
  btns.style.cssText = 'pointer-events:auto!important;';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'websuddhi-btn confirm';
  confirmBtn.textContent = 'Block';
  confirmBtn.style.cssText = 'pointer-events:auto!important;cursor:pointer!important;';
  btns.appendChild(confirmBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'websuddhi-btn cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'pointer-events:auto!important;cursor:pointer!important;';
  btns.appendChild(cancelBtn);

  content.appendChild(btns);
  dialog.appendChild(content);
  document.body.appendChild(dialog);
  confirmBtn.focus();

  const closeDialog = () => { if (dialog.parentNode) dialog.remove(); };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
      document.removeEventListener('keydown', onKeyDown);
      resumePickMode();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const resumePickMode = () => {
    document.removeEventListener('keydown', onKeyDown);
    document.body.classList.add('websuddhi-pick-mode');
    addPickListeners();
    createPreviewPanel();
  };

  confirmBtn.addEventListener('click', async () => {
    try {
      if (state.blockedSelectors.size >= 500) {
        showToast('Rule limit reached (500). Remove old rules first.');
        closeDialog();
        stopPickMode();
        return;
      }
      state.blockedSelectors.set(selector, {
        url: window.location.hostname,
        date: Date.now(),
        source: 'pick',
      });
      blockSelector(selector);
      // Persist via background (single writer) to avoid cross-tab race
      try { await sendMessage({ type: 'ADD_SELECTOR', selector }); } catch (_) {
        // Fallback: save directly if background unreachable
        await saveSelectors();
      }
      showToast('Element blocked — ' + selector);
    } catch (err) {
      showToast('Failed to block element');
    }
    closeDialog();
    stopPickMode();
  });

  cancelBtn.addEventListener('click', () => {
    closeDialog();
    resumePickMode();
  });
}

// ============================================
// HELPERS
// ============================================

// saveSelectors imported from state.js

/**
 * Check if an element is part of our extension's UI.
 * @param {HTMLElement} el
 * @returns {boolean}
 * @private
 */
function isOurUI(el) {
  if (!el) return false;
  return (
    el.classList.contains('websuddhi-pick-preview') ||
    el.closest('.websuddhi-pick-preview') ||
    el.classList.contains('websuddhi-preview-panel') ||
    el.closest('.websuddhi-preview-panel') ||
    el.classList.contains('websuddhi-pick-dialog') ||
    el.closest('.websuddhi-pick-dialog') ||
    el.classList.contains('websuddhi-toast')
  );
}
