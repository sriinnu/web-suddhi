// WebSuddhi popup: Activity tab: this site's part of the request log.
// Classic script; the popup scripts share one global scope (see popup.html for the order).
'use strict';
/* global elements, extractDomain, extractRequestLog, getActiveHostname, hostCategory,
   renderFirewall, renderRing, sendToBackground, sendToBackgroundWithFallback, showToast,
   tabConnections */
/* exported loadActivity, scheduleActivityRefresh */

// ============================================
// ACTIVITY: this site's part of the request log drives the ring, the
// legend and the Activity tab. The log is global, so filter by site.
// ============================================
const bareHost = (value) => String(value || '').toLowerCase().replace(/^www\./, '');

function shortTime(ts) {
  const diff = Date.now() - (Number(ts) || 0);
  if (!ts || diff < 0) return '';
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return Math.round(diff / 60_000) + ' min ago';
  if (diff < 86_400_000) return Math.round(diff / 3_600_000) + ' hr ago';
  return new Date(ts).toLocaleDateString();
}

// Counts arrive in bursts while a page loads; refresh the log at most once a second.
let activityTimer = null;
function scheduleActivityRefresh() {
  if (activityTimer) return;
  activityTimer = setTimeout(() => { activityTimer = null; loadActivity(); }, 1000);
}

async function loadActivity() {
  const host = getActiveHostname();
  let entries = [];
  try {
    const response = await sendToBackgroundWithFallback(['GET_REQUEST_LOG', 'REQUEST_LOG']);
    entries = extractRequestLog(response).filter((e) => host && bareHost(e?.site) === host);
    hostCategory.clear();
    for (const e of entries) {
      const h = e.type === 'cosmetic' ? '' : extractDomain(e.url);
      if (h && e.category && !hostCategory.has(h)) hostCategory.set(h, e.category);
    }
  } catch (e) {
    entries = [];
  }

  // Ring: counts per category.
  const byCategory = new Map();
  for (const e of entries) {
    const name = e.category && e.category !== 'Unknown' ? e.category : (e.type === 'cosmetic' ? 'Hidden' : 'Other');
    byCategory.set(name, (byCategory.get(name) || 0) + 1);
  }
  const categories = Array.from(byCategory, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  renderRing(categories);
  renderFeed(entries.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 200));
  if (tabConnections) renderFirewall();
}

// Two-letter marks for the activity groups.
const CATEGORY_MARK = {
  Advertising: 'Ad', Analytics: 'An', Social: 'So', Tracking: 'Tr', Cookie: 'Ck',
  Annoyance: 'Po', Hidden: 'Hd', Malware: 'Mw', Phishing: 'Ph', Cryptomining: 'Cm', Other: 'Ot'
};
function categoryMark(name) {
  return CATEGORY_MARK[name] || String(name || '?').slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}

function groupTitle(group) {
  const n = group.items.length;
  if (group.cosmetic) return 'Hid ' + n + (n === 1 ? ' page element' : ' page elements');
  const what = group.name === 'Other' ? '' : group.name.toLowerCase() + ' ';
  return 'Stopped ' + n + ' ' + what + (n === 1 ? 'request' : 'requests');
}

function buildFeedItem(entry) {
  const cosmetic = entry.type === 'cosmetic';
  const item = document.createElement('li');
  item.className = 'evi';
  const label = document.createElement('span');
  const target = cosmetic ? entry.selector : extractDomain(entry.url) || entry.url;
  label.textContent = target || 'unknown';
  label.title = cosmetic ? (entry.selector || '') : (entry.url || '');
  const when = document.createElement('small');
  when.textContent = shortTime(entry.timestamp);
  const allow = document.createElement('button');
  allow.type = 'button';
  allow.className = 'link';
  allow.textContent = 'Allow';
  allow.title = cosmetic ? 'Stop hiding this on this site' : 'Allow this host on every site';
  allow.addEventListener('click', async () => {
    allow.disabled = true;
    const ok = await allowActivityEntry(entry);
    if (ok) {
      item.classList.add('undone');
      allow.textContent = 'Allowed';
      showToast('Allowed. Reload the page to see it.');
    } else {
      allow.disabled = false;
    }
  });
  item.append(label, when, allow);
  return item;
}

function renderFeed(entries) {
  const feed = elements.activityFeed;
  if (!feed) return;
  while (feed.firstChild) feed.removeChild(feed.firstChild);
  if (elements.activityCount) elements.activityCount.textContent = String(entries.length);
  if (elements.activityEmpty) elements.activityEmpty.hidden = entries.length > 0;

  // One row per category, newest group first; the hosts sit under it.
  const groups = new Map();
  for (const entry of entries) {
    const cosmetic = entry.type === 'cosmetic';
    const name = entry.category && entry.category !== 'Unknown' ? entry.category : (cosmetic ? 'Hidden' : 'Other');
    const key = (cosmetic ? 'c:' : 'n:') + name;
    if (!groups.has(key)) groups.set(key, { name, cosmetic, items: [] });
    groups.get(key).items.push(entry);
  }

  for (const group of groups.values()) {
    const row = document.createElement('div');
    row.className = 'ev';

    const icon = document.createElement('span');
    icon.className = 'ic' + (group.cosmetic ? ' hid' : '');
    icon.textContent = categoryMark(group.name);
    icon.setAttribute('aria-hidden', 'true');

    const text = document.createElement('div');
    text.className = 't';
    const title = document.createElement('span');
    title.textContent = groupTitle(group);
    const meta = document.createElement('small');
    const names = Array.from(new Set(group.items.map((e) => (e.type === 'cosmetic' ? e.selector : extractDomain(e.url) || e.url)).filter(Boolean)));
    meta.textContent = names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) : '');
    meta.title = names.join('\n');
    text.append(title, meta);

    const list = document.createElement('ul');
    list.className = 'evlist';
    list.hidden = true;
    for (const entry of group.items) list.appendChild(buildFeedItem(entry));

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'link';
    more.textContent = 'Details';
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', () => {
      list.hidden = !list.hidden;
      more.setAttribute('aria-expanded', String(!list.hidden));
      more.textContent = list.hidden ? 'Details' : 'Hide';
    });

    row.append(icon, text, more);
    feed.append(row, list);
  }
}

async function allowActivityEntry(entry) {
  try {
    let resp;
    if (entry.type === 'cosmetic') {
      resp = await sendToBackground({ type: 'ALLOW_SELECTOR_ON_SITE', hostname: getActiveHostname(), selector: entry.selector });
    } else {
      resp = await sendToBackground({ type: 'UNBLOCK_REQUEST', url: entry.url });
    }
    if (resp && resp.success === false) throw new Error(resp.error || 'failed');
    return true;
  } catch (e) {
    showToast('Could not allow it');
    return false;
  }
}
