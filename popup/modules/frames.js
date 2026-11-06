// WebSuddhi popup: Frames tab: live frame census plus frames stopped before they loaded.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global blockFrame, currentTab, elements, fwLayer, hostCategory, sendToBackground,
   setFirewallCell, showToast, tabConnections */
/* exported applyFrameRule, killAllHogs, loadFrameCensus */

// ============================================
// FRAMES PANEL — driven by the live per-tab census (GET_TAB_CENSUS)
// ============================================
const CATEGORY_LABELS = {
  ad: 'Ads', analytics: 'Analytics', 'session-replay': 'Session replay',
  payment: 'Payments', captcha: 'Captcha', auth: 'Sign-in', embed: 'Embeds',
  social: 'Social', other: 'Other'
};

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  if (n >= 1024) return Math.round(n / 1024) + ' KB';
  return n + ' B';
}

async function loadFrameCensus() {
  if (!elements.framesSection || !currentTab) return;
  let census = null;
  try {
    const resp = await sendToBackground({ type: 'GET_TAB_CENSUS', tabId: currentTab.id });
    census = resp && resp.census;
  } catch (e) { census = null; }

  const frames = ((census && Array.isArray(census.frames)) ? census.frames : []).concat(networkOnlyFrames(census));
  if (elements.framesTabCount) elements.framesTabCount.textContent = String(frames.length);
  if (elements.framesEmpty) elements.framesEmpty.hidden = frames.length > 0;
  if (frames.length === 0) {
    elements.framesSection.style.display = 'none';
    return;
  }
  elements.framesSection.style.display = 'block';
  const counts = Object.assign({}, (census && census.counts) || {});
  counts.blocked = frames.filter((f) => f.action === 'block').length;
  renderCensus({ frames, counts });
}

// Frames the filter lists stopped never load, so they never report to the
// census. The connection log still saw their requests; list those too.
function networkOnlyFrames(census) {
  const known = new Set(((census && census.frames) || []).map((f) => f.domain));
  const hosts = (tabConnections && tabConnections.hosts) || [];
  const out = [];
  for (const h of hosts) {
    const n = (h.types && h.types.frame) || 0;
    if (!n || h.firstParty || known.has(h.host)) continue;
    const own = fwLayer(h.host, 'frame', false).value || fwLayer(h.host, '*', false).value;
    const listBlocked = h.blocked > 0 && h.blocked >= h.count;
    out.push({
      domain: h.host,
      url: h.host,
      category: (hostCategory.get(h.host) || 'other').toLowerCase(),
      action: own ? own : (listBlocked ? 'block' : 'allow'),
      bytes: 0,
      source: 'network',
      note: own ? 'Your firewall rule' : (listBlocked ? 'Stopped before it loaded' : n + (n === 1 ? ' frame request' : ' frame requests'))
    });
  }
  return out;
}

function renderCensus(census) {
  const frames = census.frames.slice();
  const counts = census.counts || {};

  if (elements.framesCount) elements.framesCount.textContent = String(frames.length);
  if (elements.framesSummary) {
    const blocked = counts.blocked || 0;
    const flagged = counts.flagged || 0;
    const parts = [];
    if (blocked) parts.push(blocked + ' blocked');
    if (flagged) parts.push(flagged + ' flagged');
    elements.framesSummary.textContent = parts.join(' · ');
  }

  // --- Pinned resource hogs (heavy frames, any category) ---
  const hogs = frames.filter((f) => f.isHeavy);
  if (elements.framesHogs && elements.framesHogsList) {
    if (hogs.length) {
      elements.framesHogs.style.display = 'block';
      if (elements.framesHogsCount) elements.framesHogsCount.textContent = String(hogs.length);
      renderFrameRows(elements.framesHogsList, hogs.slice().sort(byWeightDesc));
    } else {
      elements.framesHogs.style.display = 'none';
    }
  }

  // --- Grouped by category, groups sorted by aggregate weight ---
  if (!elements.framesList) return;
  while (elements.framesList.firstChild) elements.framesList.removeChild(elements.framesList.firstChild);

  const groups = new Map();
  for (const f of frames) {
    const key = f.category || 'other';
    if (!groups.has(key)) groups.set(key, { frames: [], bytes: 0 });
    const g = groups.get(key);
    g.frames.push(f);
    g.bytes += Number(f.bytes) || 0;
  }
  const ordered = Array.from(groups.entries()).sort((a, b) => b[1].bytes - a[1].bytes);

  for (const [category, g] of ordered) {
    const groupEl = document.createElement('div');
    groupEl.className = 'frame-group';

    const head = document.createElement('div');
    head.className = 'frame-group-head';

    const label = document.createElement('span');
    label.className = 'frame-group-label';
    label.textContent = (CATEGORY_LABELS[category] || category) + ' (' + g.frames.length + ')';
    head.appendChild(label);

    const cost = document.createElement('span');
    cost.className = 'frame-group-cost';
    cost.textContent = formatBytes(g.bytes);
    head.appendChild(cost);

    // Block-all for non-protected groups.
    const blockable = g.frames.filter((f) => !f.isProtected);
    if (blockable.length) {
      const blockAll = document.createElement('button');
      blockAll.className = 'frame-group-blockall';
      blockAll.textContent = 'Block all';
      blockAll.addEventListener('click', async () => {
        for (const f of blockable) await blockFrame(f);
        await loadFrameCensus();
      });
      head.appendChild(blockAll);
    }

    groupEl.appendChild(head);

    const rows = document.createElement('div');
    rows.className = 'frame-list';
    renderFrameRows(rows, g.frames.slice().sort(byWeightDesc));
    groupEl.appendChild(rows);

    elements.framesList.appendChild(groupEl);
  }
}

function byWeightDesc(a, b) {
  return (Number(b.bytes) || 0) - (Number(a.bytes) || 0);
}

// Render a flat list of frame rows into a container.
function renderFrameRows(container, frames) {
  while (container.firstChild) container.removeChild(container.firstChild);
  for (const f of frames) {
    container.appendChild(buildFrameRow(f));
  }
}

function buildFrameRow(frame) {
  const blocked = frame.action === 'block';
  const item = document.createElement('div');
  item.className = 'frame-item' + (blocked ? ' blocked' : '') + (frame.isHeavy ? ' heavy' : '');

  const main = document.createElement('div');
  main.className = 'frame-main';

  const host = document.createElement('span');
  host.className = 'frame-host';
  host.textContent = frame.domain;
  host.title = frame.url || frame.domain;
  main.appendChild(host);

  const meta = document.createElement('div');
  meta.className = 'frame-meta';

  const tag = document.createElement('span');
  tag.className = 'frame-tag cat-' + (frame.category || 'other');
  tag.textContent = CATEGORY_LABELS[frame.category] || frame.category || 'Other';
  meta.appendChild(tag);

  if (frame.isProtected) {
    const prot = document.createElement('span');
    prot.className = 'frame-tag protected';
    prot.textContent = 'Protected';
    meta.appendChild(prot);
  }

  if (frame.note) {
    const note = document.createElement('span');
    note.className = 'frame-size';
    note.textContent = frame.note;
    meta.appendChild(note);
  }

  if (frame.isHeavy) {
    const heavy = document.createElement('span');
    heavy.className = 'frame-heat';
    heavy.textContent = '⚡ ' + formatBytes(frame.bytes) + ' (est.)';
    meta.appendChild(heavy);
  } else if (frame.bytes) {
    const size = document.createElement('span');
    size.className = 'frame-size';
    size.textContent = formatBytes(frame.bytes) + ' (est.)';
    meta.appendChild(size);
  }

  main.appendChild(meta);
  item.appendChild(main);

  // Allow/Block toggle — protected frames can't be auto-blocked but can be paused/blocked manually.
  const btn = document.createElement('button');
  btn.className = 'frame-toggle ' + (blocked ? 'is-blocked' : 'is-allowed');
  btn.textContent = blocked ? 'Allow' : 'Block';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    if (frame.source === 'network') {
      // Never loaded, so a frame rule cannot reach it; a firewall cell can.
      await setFirewallCell(frame.domain, 'frame', blocked ? 'allow' : 'block');
      showToast((blocked ? 'Allowed' : 'Blocked') + ' frames from ' + frame.domain + '. Reload to apply.');
    } else {
      await applyFrameRule(frame.domain, blocked ? 'allowed' : 'blocked');
    }
    await loadFrameCensus();
  });
  item.appendChild(btn);

  return item;
}

// Persist a per-frame rule (this-site, persisted) and apply it.
async function applyFrameRule(frameDomain, rule) {
  try {
    await sendToBackground({
      type: 'SET_FRAME_RULE',
      tabId: currentTab.id,
      frameDomain,
      rule,
      persist: true
    });
  } catch (e) {
    showToast('Failed to update frame');
  }
}

// Kill every resource hog at once.
async function killAllHogs() {
  try {
    const resp = await sendToBackground({ type: 'GET_TAB_CENSUS', tabId: currentTab.id });
    const frames = (resp && resp.census && resp.census.frames) || [];
    const hogs = frames.filter((f) => f.isHeavy && !f.isProtected);
    for (const f of hogs) await applyFrameRule(f.domain, 'blocked');
    showToast('Blocked ' + hogs.length + ' resource hog' + (hogs.length === 1 ? '' : 's'));
    await loadFrameCensus();
  } catch (e) {
    showToast('Failed to kill hogs');
  }
}
