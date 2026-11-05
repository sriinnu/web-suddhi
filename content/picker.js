// WebSuddhi - element picker (pick mode, zap, preview panel, confirm dialog).
//
// Not a manifest content script. ad-blocker.js asks the background for it
// (LOAD_PICKER) the first time the user starts picking, and the background
// injects it into that one frame. Pages where nobody picks never parse it.
// Core state and helpers come from self.__wsCore, which is set by ad-blocker.js
// in the extension's isolated world, so the page cannot see it.

(function () {
  'use strict';

  if (self.__wsPicker) return;
  const core = self.__wsCore;
  if (!core) return;

  const {
    state, blockSelector, hideElement, saveSelectors, sendMessage,
    showToast, removeToast, getUniqueSelector, logError
  } = core;

  // ============================================
  // PICK MODE - Select & Save Elements
  // ============================================
  // Pointer events we intercept in the capture phase so nothing leaks through to
  // the page (or to an ad inside a cross-origin iframe).
  const PICK_POINTER_EVENTS = ['pointerdown', 'mousedown', 'mouseup', 'click', 'auxclick', 'contextmenu'];

  function startPickMode(opts = {}) {
    // Only run pick mode in the top/main frame to avoid conflicts with iframes.
    if (window !== window.top) {
      return;
    }

    state.pickMode = true;
    state.pickZapDefault = !!opts.zapDefault;
    state.zapMode = !!opts.zapDefault; // legacy alias
    state.pickAltHeld = false;
    state.pickCtrlHeld = false;
    state.pickZapHeld = false;
    state.pickFrameMode = false;
    state.pickCommitting = false;
    state.hoveredElement = null;
    document.body.classList.add('websuddhi-pick-mode');
    if (opts.zapDefault) document.body.classList.add('websuddhi-zap-mode');

    // Ensure document has focus for keyboard events
    window.focus();
    if (document.body) {
      document.body.focus();
    }

    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';

    createPreviewPanel();
    addPickListeners(); // also installs the full-viewport hit-shield overlay

    showToast(opts.zapDefault
      ? 'Zap: click to remove instantly. Alt = frame/element · Esc to exit.'
      : 'Pick: click to block. Alt = frame/element · Shift = quick-kill · Esc cancel.');
  }

  function stopPickMode() {
    state.pickMode = false;
    state.zapMode = false;
    state.pickZapDefault = false;
    state.pickAltHeld = false;
    state.pickCtrlHeld = false;
    state.pickZapHeld = false;
    state.pickFrameMode = false;
    state.pickCommitting = false;
    state.hoveredElement = null;
    document.body.classList.remove('websuddhi-pick-mode');
    document.body.classList.remove('websuddhi-zap-mode');

    removePickListeners(); // also removes the overlay

    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    clearHighlights();
    removePreviewPanel();
    removeToast();

    // Clean up any leftover dialog
    const dialog = document.querySelector('.websuddhi-pick-dialog');
    if (dialog) dialog.remove();

    const preview = document.querySelector('.websuddhi-pick-preview');
    if (preview) preview.remove();
  }

  // ============================================
  // PICK OVERLAY — the fix for cross-origin iframe click-leak.
  // A full-viewport transparent layer sits above ALL page content (including
  // iframes), so pointer events land in the top document instead of routing
  // into a child frame. We resolve what's underneath with elementFromPoint.
  // ============================================
  function createPickOverlay() {
    removePickOverlay();
    const ov = document.createElement('div');
    ov.className = 'websuddhi-pick-overlay';
    ov.style.cssText =
      'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;' +
      'width:100vw!important;height:100vh!important;margin:0!important;padding:0!important;' +
      'background:transparent!important;z-index:2147483646!important;cursor:crosshair!important;';
    (document.documentElement || document.body).appendChild(ov);
    state.pickOverlay = ov;
    return ov;
  }

  function removePickOverlay() {
    if (state.pickOverlay && state.pickOverlay.parentNode) state.pickOverlay.remove();
    state.pickOverlay = null;
    document.querySelectorAll('.websuddhi-pick-overlay').forEach((e) => e.remove());
  }

  // Resolve the page element under a viewport point, seeing *through* our overlay
  // and ignoring our own UI.
  function pickTargetAt(x, y) {
    const ov = state.pickOverlay;
    const had = ov ? ov.style.getPropertyValue('pointer-events') : '';
    if (ov) ov.style.setProperty('pointer-events', 'none', 'important');
    let el = null;
    try { el = document.elementFromPoint(x, y); } catch (e) { el = null; }
    if (ov) {
      if (had) ov.style.setProperty('pointer-events', had, 'important');
      else ov.style.removeProperty('pointer-events');
    }
    if (!el) return null;
    if (el.classList && el.classList.contains('websuddhi-pick-overlay')) return null;
    if (el.closest && (el.closest('.websuddhi-preview-panel') ||
        el.closest('.websuddhi-pick-dialog') ||
        el.closest('.websuddhi-toast') ||
        el.closest('.websuddhi-pick-preview'))) return null;
    return el;
  }

  // Decide whether a raw hit becomes an element pick or a whole-frame pick.
  // Default: iframe -> frame mode, everything else -> element mode. Alt flips.
  function resolvePickTarget(rawEl) {
    if (!rawEl) return null;
    const isIframe = rawEl.tagName === 'IFRAME';
    let frameMode = isIframe;
    if (state.pickAltHeld) frameMode = !frameMode;
    let element = rawEl;
    if (!frameMode && isIframe) {
      // element mode forced onto an iframe (via Alt): target its container instead.
      element = rawEl.parentElement || rawEl;
    } else if (frameMode && !isIframe) {
      // frame mode forced onto non-iframe (via Alt): climb to the nearest iframe.
      const f = rawEl.closest && rawEl.closest('iframe');
      if (f) element = f;
      else frameMode = false;
    }
    return { element, frameMode };
  }

  // ============================================
  // ELEMENT PREVIEW PANEL
  // ============================================
  function createPreviewPanel() {
    // Remove existing panel if any
    removePreviewPanel();

    const panel = document.createElement('div');
    panel.className = 'websuddhi-preview-panel';
    panel.innerHTML = `
      <div class="websuddhi-preview-header">Element Preview</div>
      <div class="websuddhi-preview-selector"></div>
      <div class="websuddhi-preview-info">
        <span class="websuddhi-preview-tag"></span>
        <span class="websuddhi-preview-matches"></span>
        <span class="websuddhi-preview-dimensions"></span>
      </div>
      <div class="websuddhi-preview-details">
        <span class="websuddhi-preview-id"></span>
        <span class="websuddhi-preview-classes"></span>
      </div>
      <div class="websuddhi-preview-warning" style="display: none;"></div>
      <div class="websuddhi-preview-hint">
        Click to block <kbd>Esc</kbd> cancel <kbd>Alt</kbd> frame/element <kbd>Shift</kbd> quick-kill <kbd>Ctrl</kbd> specific
      </div>
    `;
    panel.style.display = 'none';
    document.body.appendChild(panel);
    return panel;
  }

  function removePreviewPanel() {
    const panel = document.querySelector('.websuddhi-preview-panel');
    if (panel) panel.remove();
  }

  function updatePreviewPanel(element, frameMode) {
    const panel = document.querySelector('.websuddhi-preview-panel');
    if (!panel || !element) {
      if (panel) panel.style.display = 'none';
      return;
    }

    const targetElement = element;

    // Frame mode: we collapse the whole iframe rather than picking a selector.
    let selector;
    if (frameMode) {
      let host = '';
      const src = targetElement.getAttribute && (targetElement.getAttribute('src') || targetElement.getAttribute('data-src') || '');
      try { if (src) host = new URL(src, window.location.href).hostname; } catch (e) { host = ''; }
      selector = host ? 'frame: ' + host : 'frame (whole iframe)';
    } else {
      // Generate selector based on modifiers
      selector = state.pickCtrlHeld
        ? getSpecificSelector(targetElement)
        : getUniqueSelector(targetElement);
    }

    // Count matching elements
    let matchCount = 0;
    try {
      matchCount = document.querySelectorAll(selector).length;
    } catch (e) {
      matchCount = 1;
    }

    // Get element info
    const tagName = targetElement.tagName.toLowerCase();
    const rect = targetElement.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    const id = targetElement.id || '';
    const classes = (typeof targetElement.className === 'string')
      ? targetElement.className.trim().split(/\s+/).filter(c => c && !c.startsWith('websuddhi')).slice(0, 5)
      : [];

    // Update panel content
    const selectorEl = panel.querySelector('.websuddhi-preview-selector');
    const tagEl = panel.querySelector('.websuddhi-preview-tag');
    const matchesEl = panel.querySelector('.websuddhi-preview-matches');
    const dimensionsEl = panel.querySelector('.websuddhi-preview-dimensions');
    const idEl = panel.querySelector('.websuddhi-preview-id');
    const classesEl = panel.querySelector('.websuddhi-preview-classes');
    const warningEl = panel.querySelector('.websuddhi-preview-warning');

    if (selectorEl) {
      // Truncate long selectors for display
      const displaySelector = selector.length > 100 ? selector.substring(0, 100) + '...' : selector;
      selectorEl.textContent = displaySelector;
      selectorEl.title = selector;
    }

    if (tagEl) {
      tagEl.textContent = tagName;
    }

    if (matchesEl) {
      matchesEl.textContent = matchCount + ' match' + (matchCount !== 1 ? 'es' : '');
      matchesEl.className = 'websuddhi-preview-matches';
      if (matchCount > 10) {
        matchesEl.classList.add('danger');
      } else if (matchCount > 5) {
        matchesEl.classList.add('warning');
      }
    }

    if (dimensionsEl) {
      dimensionsEl.textContent = width + ' x ' + height + 'px';
    }

    if (idEl) {
      idEl.textContent = id ? '#' + id : '';
      idEl.style.display = id ? 'inline' : 'none';
    }

    if (classesEl) {
      if (classes.length > 0) {
        classesEl.textContent = '.' + classes.join(' .');
        classesEl.style.display = 'inline';
      } else {
        classesEl.style.display = 'none';
      }
    }

    // Show warning if many elements match
    if (warningEl) {
      if (matchCount > 5) {
        warningEl.textContent = 'Warning: This will block ' + matchCount + ' element' + (matchCount !== 1 ? 's' : '');
        warningEl.style.display = 'flex';
      } else {
        warningEl.style.display = 'none';
      }
    }

    // Position panel to avoid overlapping with hovered element
    positionPreviewPanel(panel, rect);

    panel.style.display = 'block';
  }

  function positionPreviewPanel(panel, elementRect) {
    // Reset position classes
    panel.classList.remove('position-top');

    const panelHeight = panel.offsetHeight || 150;
    const viewportHeight = window.innerHeight;
    const bottomSpace = viewportHeight - elementRect.bottom;

    // If element is in the bottom half of the screen, show panel at top
    if (elementRect.bottom > viewportHeight / 2 && bottomSpace < panelHeight + 40) {
      panel.classList.add('position-top');
    }
  }

  function getSpecificSelector(element) {
    // Generate a more specific selector including nth-child
    if (!element || element === document.body) return 'body';

    const path = [];
    let el = element;
    let depth = 0;

    while (el && el !== document.documentElement && depth < 4) {
      let selector = el.tagName.toLowerCase();

      // Add ID if present
      if (el.id) {
        selector += '#' + CSS.escape(el.id);
        path.unshift(selector);
        break;
      }

      // Add classes (limit to 2)
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\s+/)
          .filter(c => c && !c.startsWith('websuddhi'))
          .slice(0, 2);
        if (classes.length > 0) {
          selector += '.' + classes.map(c => CSS.escape(c)).join('.');
        }
      }

      // Add nth-child for specificity
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(el) + 1;
        selector += ':nth-child(' + index + ')';
      }

      path.unshift(selector);
      el = el.parentElement;
      depth++;
    }

    return path.join(' > ');
  }

  // Re-run hover resolution at the last pointer position (after a modifier change).
  function refreshPickHover() {
    if (!state.pickMode) return;
    const raw = pickTargetAt(state.pickLastX, state.pickLastY);
    const resolved = resolvePickTarget(raw);
    clearHighlights();
    if (!resolved || !resolved.element) {
      state.hoveredElement = null;
      state.pickFrameMode = false;
      updatePreviewPanel(null);
      return;
    }
    state.hoveredElement = resolved.element;
    state.pickFrameMode = resolved.frameMode;
    resolved.element.classList.add('websuddhi-pick-highlight');
    if (resolved.frameMode) resolved.element.classList.add('websuddhi-pick-frame');
    updatePreviewPanel(resolved.element, resolved.frameMode);
  }

  // Keyboard handlers for pick mode modifiers
  function handlePickKeyDown(e) {
    if (!state.pickMode) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      stopPickMode();
      return;
    }

    let changed = false;
    if (e.key === 'Alt' && !state.pickAltHeld) { state.pickAltHeld = true; changed = true; }
    if (e.key === 'Shift' && !state.pickZapHeld) { state.pickZapHeld = true; }
    if ((e.key === 'Control' || e.key === 'Meta') && !state.pickCtrlHeld) { state.pickCtrlHeld = true; changed = true; }
    // Alt would otherwise trigger browser menus / lose focus while picking.
    if (e.key === 'Alt') { e.preventDefault(); }
    if (changed) refreshPickHover();
  }

  function handlePickKeyUp(e) {
    if (!state.pickMode) return;

    let changed = false;
    if (e.key === 'Alt') { state.pickAltHeld = false; changed = true; e.preventDefault(); }
    if (e.key === 'Shift') { state.pickZapHeld = false; }
    if (e.key === 'Control' || e.key === 'Meta') { state.pickCtrlHeld = false; changed = true; }
    if (changed) refreshPickHover();
  }

  // ============================================
  // ZAP — now a thin alias: a pick session that skips the confirm dialog.
  // Kept so existing entry points (keyboard shortcut, legacy menu) still work.
  // ============================================
  function startZapMode() {
    startPickMode({ zapDefault: true });
  }

  function stopZapMode() {
    stopPickMode();
  }

  // ============================================
  // POINTER ENGINE — hover tracking + commit (pick or quick-kill)
  // ============================================
  function handlePickPointerMove(e) {
    if (!state.pickMode) return;
    state.pickLastX = e.clientX;
    state.pickLastY = e.clientY;
    refreshPickHover();
  }

  // Swallow every pointer event in the capture phase so nothing reaches the page
  // or an ad inside a cross-origin iframe. Commit on click (left) or contextmenu (right).
  function handlePickPointer(e) {
    if (!state.pickMode) return;
    // Let clicks on our own dialog/panel through.
    if (e.target && e.target.closest && (
      e.target.closest('.websuddhi-pick-dialog') ||
      e.target.closest('.websuddhi-preview-panel'))) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (e.type === 'click' || e.type === 'contextmenu') {
      if (typeof e.clientX === 'number') { state.pickLastX = e.clientX; state.pickLastY = e.clientY; }
      commitPick();
    }
  }

  // Act on the currently-resolved target: collapse a frame, or block/hide an element.
  function commitPick() {
    if (state.pickCommitting) return;
    const raw = pickTargetAt(state.pickLastX, state.pickLastY);
    const resolved = resolvePickTarget(raw);
    if (!resolved || !resolved.element) return;
    state.pickCommitting = true;

    const el = resolved.element;
    const frameMode = resolved.frameMode;
    const quick = state.pickZapDefault || state.pickZapHeld;

    if (frameMode) {
      let domain = '';
      const src = (el.getAttribute && (el.getAttribute('src') || el.getAttribute('data-src'))) || '';
      try { if (src) domain = new URL(src, window.location.href).hostname; } catch (e) { domain = ''; }
      hideElement(el); // instant DOM teardown (works on every browser)
      if (!quick && domain) {
        // Persist a real frame block so it stays dead across reloads/navigation.
        sendMessage({ type: 'SET_FRAME_RULE', frameDomain: domain, rule: 'blocked', persist: true }).catch(() => {});
        showToast('Frame blocked: ' + domain);
      } else {
        showToast(domain ? 'Frame removed: ' + domain : 'Frame removed');
      }
      stopPickMode();
      return;
    }

    const selector = state.pickCtrlHeld ? getSpecificSelector(el) : getUniqueSelector(el);
    if (quick) {
      hideElement(el, selector, { userRule: true });
      showToast('Element removed (not saved)');
      stopPickMode();
    } else {
      state.pickCommitting = false; // dialog drives the next step
      showConfirmDialog(selector, el);
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.websuddhi-pick-highlight').forEach(el => {
      el.classList.remove('websuddhi-pick-highlight');
      el.classList.remove('websuddhi-pick-frame');
    });
  }

  // ============================================
  // LISTENERS — all capture-phase on the document; the overlay is the hit-shield
  // that forces events to land in the top document (even over cross-origin frames).
  // ============================================
  function removePickListeners() {
    document.removeEventListener('pointermove', handlePickPointerMove, true);
    document.removeEventListener('keydown', handlePickKeyDown, true);
    document.removeEventListener('keyup', handlePickKeyUp, true);
    PICK_POINTER_EVENTS.forEach((t) => document.removeEventListener(t, handlePickPointer, true));
    removePickOverlay();
  }

  function addPickListeners() {
    createPickOverlay();
    document.addEventListener('pointermove', handlePickPointerMove, true);
    document.addEventListener('keydown', handlePickKeyDown, true);
    document.addEventListener('keyup', handlePickKeyUp, true);
    PICK_POINTER_EVENTS.forEach((t) => document.addEventListener(t, handlePickPointer, true));
  }

  function showConfirmDialog(selector, element) {
    // Remove existing dialog
    const existingDialog = document.querySelector('.websuddhi-pick-dialog');
    if (existingDialog) existingDialog.remove();

    // Fully remove all capture-phase listeners so nothing intercepts dialog clicks
    removePickListeners();
    document.body.classList.remove('websuddhi-pick-mode');
    clearHighlights();
    removePreviewPanel();

    const dialog = document.createElement('div');
    dialog.className = 'websuddhi-pick-dialog';
    dialog.style.cssText = 'position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;z-index:2147483647!important;display:flex!important;align-items:center!important;justify-content:center!important;pointer-events:auto!important;cursor:default!important;';

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

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'websuddhi-pick-buttons';
    buttonsDiv.style.cssText = 'pointer-events:auto!important;';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'websuddhi-btn confirm';
    confirmBtn.textContent = 'Block';
    confirmBtn.style.cssText = 'pointer-events:auto!important;cursor:pointer!important;';
    buttonsDiv.appendChild(confirmBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'websuddhi-btn cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'pointer-events:auto!important;cursor:pointer!important;';
    buttonsDiv.appendChild(cancelBtn);

    content.appendChild(buttonsDiv);
    dialog.appendChild(content);
    document.body.appendChild(dialog);

    // Focus the confirm button so keyboard works immediately
    confirmBtn.focus();

    function closeDialog() {
      if (dialog.parentNode) dialog.remove();
    }

    // Escape key closes dialog (simple, no capture needed)
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
        document.removeEventListener('keydown', onKeyDown);
        resumePickMode();
      }
    }
    document.addEventListener('keydown', onKeyDown);

    function resumePickMode() {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.add('websuddhi-pick-mode');
      addPickListeners();
      createPreviewPanel();
    }

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
          date: Date.now()
        });
        await saveSelectors();
        blockSelector(selector, { userRule: true });
        if (element && !element.hasAttribute('data-websuddhi-blocked')) {
          hideElement(element, selector, { userRule: true });
        }
        try { await sendMessage({ type: 'ADD_SELECTOR', selector }); } catch (e) {}
        closeDialog();
        document.removeEventListener('keydown', onKeyDown);
        stopPickMode();
        showToast('Element blocked and rule saved');
      } catch (err) {
        logError('Failed to add selector:', err);
      }
    });

    cancelBtn.addEventListener('click', () => {
      closeDialog();
      resumePickMode();
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        closeDialog();
        resumePickMode();
      }
    });
  }

  self.__wsPicker = { startPickMode, stopPickMode, startZapMode, stopZapMode };
})();
