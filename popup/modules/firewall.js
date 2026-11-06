// WebSuddhi popup: Firewall tab: hosts on this page by request type.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global api, applyFrameRule, currentTab, getActiveHostname, hostCategory, sendToBackground,
   setText, showToast, tabConnections */
/* exported blockFrame, fwLayer, fwPending, loadFirewall, renderFirewall, resetFirewall,
   saveFirewall, setFirewallCell, setFirewallScope */

// ---- Firewall matrix: hosts on this page × request types ----
const FW_COLS = [['script', 'Script'], ['frame', 'Frame'], ['xhr', 'XHR'], ['image', 'Image']];
let fwRules = {};
// Rules saved for every site (stored under the '*' site key).
let fwGlobal = {};
// Where staged changes go: 'site' or 'all'.
let fwScope = 'site';
const fwPending = new Map();
const fwKey = (host, type) => host + '\n' + type;

async function fetchFirewallRules(site) {
  try {
    const resp = await sendToBackground({ type: 'GET_FIREWALL_RULES', site });
    return resp && resp.success && resp.rules ? resp.rules : {};
  } catch (e) {
    return {};
  }
}

async function loadFirewall() {
  const site = getActiveHostname();
  if (!site) return;
  fwRules = await fetchFirewallRules(site);
  fwGlobal = await fetchFirewallRules('*');
  renderFirewall();
}

function fwSaved(host, type) {
  return (fwRules[host] && fwRules[host][type]) || null;
}

function fwGlobalSaved(host, type) {
  return (fwGlobal[host] && fwGlobal[host][type]) || null;
}

// Saved value in the scope that staged changes write to.
function fwScopeSaved(host, type) {
  return fwScope === 'all' ? fwGlobalSaved(host, type) : fwSaved(host, type);
}

// The user's own value for a cell, site over everywhere, with staged edits.
// Returns { value, global } where global marks an everywhere rule.
function fwLayer(host, type, firstParty) {
  const k = fwKey(host, type);
  const staged = fwPending.has(k);
  const site = staged && fwScope === 'site' ? fwPending.get(k) : fwSaved(host, type);
  if (site) return { value: site, global: false };
  // Everywhere rules never apply on the host's own site.
  if (firstParty) return { value: null, global: false };
  const all = staged && fwScope === 'all' ? fwPending.get(k) : fwGlobalSaved(host, type);
  return { value: all || null, global: !!all };
}

// What the filter lists did to this host, as far as we saw.
function fwListDecision(h) {
  if (!h || !h.count) return null;
  if (!h.blocked) return 'allow';
  return h.blocked >= h.count ? 'block' : null;
}

function fwCell(host, type, label, eff, mine, dirty, global) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cell';
  if (eff) b.dataset.e = eff;
  b.dataset.mine = mine ? '1' : '0';
  if (global) b.dataset.g = '1';
  if (dirty) b.dataset.dirty = '1';
  const whose = mine ? (global ? ', your rule on every site' : ', your rule') : ', from filter lists';
  b.setAttribute('aria-label', host + ' ' + label + ': ' + (eff || 'mixed') + whose);
  return b;
}

// Flip a cell in the current scope: a rule there is removed, otherwise the
// opposite of what the cell shows is staged.
function fwToggle(host, type, eff) {
  const k = fwKey(host, type);
  const saved = fwScopeSaved(host, type);
  const current = fwPending.has(k) ? fwPending.get(k) : saved;
  const next = current ? null : (eff === 'block' ? 'allow' : 'block');
  if (next === saved) fwPending.delete(k);
  else fwPending.set(k, next);
  renderFirewall();
}

function renderFirewall() {
  const body = document.getElementById('firewallBody');
  if (!body) return;
  body.textContent = '';
  const hosts = (tabConnections && tabConnections.hosts ? tabConnections.hosts : []).slice();
  // Hosts with a site rule stay listed even when this load did not contact them.
  for (const host of Object.keys(fwRules)) {
    if (host !== '*' && !hosts.some((h) => h.host === host)) hosts.push({ host, firstParty: false, count: 0, blocked: 0, types: {} });
  }
  const groups = [
    ['This site', hosts.filter((h) => h.firstParty)],
    ['Other sites', hosts.filter((h) => !h.firstParty).slice(0, 30)]
  ];

  for (const [label, rows] of groups) {
    if (!rows.length) continue;
    const gtr = document.createElement('tr');
    gtr.className = 'grp';
    const gtd = document.createElement('td');
    gtd.colSpan = 6;
    gtd.textContent = label;
    gtr.appendChild(gtd);
    body.appendChild(gtr);

    for (const h of rows) {
      const tr = document.createElement('tr');
      const head = document.createElement('td');
      head.className = 'h';
      const name = document.createElement('div');
      name.textContent = h.host;
      name.title = h.host + (h.ips && h.ips.length ? '\n' + h.ips.join(', ') : '');
      const sub = document.createElement('small');
      const cat = hostCategory.get(h.host);
      let seenText = 'not seen this load';
      if (h.count && h.blocked >= h.count) seenText = h.blocked + ' blocked';
      else if (h.count && h.blocked) seenText = h.count + ' req, ' + h.blocked + ' blocked';
      else if (h.count) seenText = h.count + (h.count === 1 ? ' request' : ' requests');
      sub.textContent = [cat ? cat.toLowerCase() : (h.firstParty ? 'the page' : ''), seenText].filter(Boolean).join(' · ');
      head.append(name, sub);
      tr.appendChild(head);

      const list = fwListDecision(h);
      const allOwn = fwLayer(h.host, '*', h.firstParty);
      const allEff = allOwn.value || list;
      const all = fwCell(h.host, '*', 'all types', allEff, !!allOwn.value, fwPending.has(fwKey(h.host, '*')), allOwn.global);
      if (h.firstParty) {
        all.disabled = true;
        all.title = 'The page itself cannot be blocked here. Use Strict.';
      } else {
        all.addEventListener('click', () => fwToggle(h.host, '*', allEff));
      }
      const allTd = document.createElement('td');
      allTd.appendChild(all);
      tr.appendChild(allTd);

      for (const [type, colLabel] of FW_COLS) {
        // Same order as the background: site cells, then everywhere cells, then lists.
        const own = fwLayer(h.host, type, h.firstParty);
        const src = own.value ? own : allOwn;
        const eff = src.value || list;
        const c = fwCell(h.host, type, colLabel, eff, !!src.value, fwPending.has(fwKey(h.host, type)), src.global);
        c.addEventListener('click', () => fwToggle(h.host, type, eff));
        const td = document.createElement('td');
        td.appendChild(c);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
  }

  const third = hosts.filter((h) => !h.firstParty).length;
  setText('firewallTabCount', String(third));
  const any = hosts.length > 0;
  const table = document.getElementById('firewallTable');
  if (table) table.hidden = !any;
  const key = document.getElementById('firewallKey');
  if (key) key.hidden = !any;
  const empty = document.getElementById('firewallEmpty');
  if (empty) empty.hidden = any;
  const foot = document.getElementById('firewallFoot');
  if (foot) foot.hidden = Object.keys(fwRules).length === 0;

  const n = fwPending.size;
  const commit = document.getElementById('firewallCommit');
  if (commit) commit.hidden = n === 0;
  setText('firewallChanges', n + (n === 1 ? ' change' : ' changes'));
  const scope = document.getElementById('firewallScope');
  if (scope) {
    scope.value = fwScope;
    if (scope.options[0]) scope.options[0].textContent = 'on ' + (getActiveHostname() || 'this site');
  }
}

function setFirewallScope(value) {
  fwScope = value === 'all' ? 'all' : 'site';
  renderFirewall();
}

async function saveFirewall() {
  const host0 = getActiveHostname();
  if (!host0 || fwPending.size === 0) return;
  const global = fwScope === 'all';
  const site = global ? '*' : host0;
  let failed = 0;
  for (const [k, action] of fwPending) {
    const [host, type] = k.split('\n');
    try {
      const resp = await sendToBackground({ type: 'SET_FIREWALL_RULE', site, host, requestType: type, action });
      if (resp && resp.success) {
        if (global) fwGlobal = resp.rules || fwGlobal;
        else fwRules = resp.rules || fwRules;
      } else failed++;
    } catch (e) {
      failed++;
    }
  }
  fwPending.clear();
  renderFirewall();
  if (failed) {
    showToast(failed + ' rule' + (failed === 1 ? '' : 's') + ' could not be saved');
    return;
  }
  showToast('Saved. Reloading the page.');
  try { await api.tabs.reload(currentTab.id); } catch (e) { /* tab may be gone */ }
}

async function resetFirewall() {
  const site = getActiveHostname();
  if (!site) return;
  try {
    await sendToBackground({ type: 'RESET_FIREWALL_SITE', site });
  } catch (e) {
    showToast('Could not clear the rules');
    return;
  }
  fwPending.clear();
  fwRules = {};
  renderFirewall();
  showToast('Your rules for ' + site + ' are cleared. Reload to apply.');
}

// Save one firewall cell right away (used by the Frames tab).
async function setFirewallCell(host, type, action) {
  const site = getActiveHostname();
  if (!site) return false;
  try {
    const resp = await sendToBackground({ type: 'SET_FIREWALL_RULE', site, host, requestType: type, action });
    if (!resp || !resp.success) return false;
    fwRules = resp.rules || fwRules;
    renderFirewall();
    return true;
  } catch (e) {
    return false;
  }
}

async function blockFrame(frame) {
  if (frame.source === 'network') return setFirewallCell(frame.domain, 'frame', 'block');
  return applyFrameRule(frame.domain, 'blocked');
}
