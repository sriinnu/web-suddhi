/**
 * @module options/charts
 * @description Chart rendering for the options statistics page.
 * Includes bar charts, pie charts, and trend line charts.
 * All rendering uses safe DOM APIs (no innerHTML).
 *
 * @version 2.1.0
 */
'use strict';

import { clearElement, formatNumber } from './dom.js';

// ============================================
// CONSTANTS
// ============================================

/** Colour map for category pie chart slices. */
const CATEGORY_COLORS = {
  ads: '#ef4444',
  trackers: '#f59e0b',
  annoyances: '#8b5cf6',
  paywall: '#ec4899',
  other: '#6b7280',
};

// ============================================
// BAR CHART
// ============================================

/**
 * Render a horizontal bar chart into a container.
 *
 * @param {HTMLElement|null} container
 * @param {Object<string,number|object>} data - Key-value map (domain → count).
 * @param {number} [limit=10]  - Max number of bars.
 * @param {boolean} [isSiteData=false] - If true, values may be `{ network, cosmetic }`.
 */
export function renderBarChart(container, data, limit = 10, isSiteData = false) {
  if (!container) return;
  clearElement(container);

  let entries;
  if (isSiteData) {
    entries = Object.entries(data)
      .map(([key, val]) => [key, typeof val === 'number' ? val : ((val?.network || 0) + (val?.cosmetic || 0))])
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  } else {
    entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, limit);
  }

  if (entries.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-chart';
    emptyDiv.textContent = 'No data yet';
    container.appendChild(emptyDiv);
    return;
  }

  const maxVal = entries[0][1] || 1;

  for (const [label, value] of entries) {
    const row = document.createElement('div');
    row.className = 'bar-row';

    const pct = Math.round((value / maxVal) * 100);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'bar-label';
    labelSpan.textContent = label;

    const trackDiv = document.createElement('div');
    trackDiv.className = 'bar-track';
    const fillDiv = document.createElement('div');
    fillDiv.className = 'bar-fill';
    fillDiv.style.width = pct + '%';
    trackDiv.appendChild(fillDiv);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'bar-value';
    valueSpan.textContent = formatNumber(value);

    row.appendChild(labelSpan);
    row.appendChild(trackDiv);
    row.appendChild(valueSpan);
    container.appendChild(row);
  }
}

// ============================================
// PIE CHART
// ============================================

/**
 * Render a donut/pie chart with legend.
 *
 * @param {HTMLElement|null} container
 * @param {Object<string,number>} byCategory
 */
export function renderPieChart(container, byCategory) {
  if (!container) return;
  clearElement(container);

  const entries = Object.entries(byCategory || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-chart';
    emptyDiv.textContent = 'No data yet';
    container.appendChild(emptyDiv);
    return;
  }

  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const slices = entries.map(([label, value]) => {
    const pct = value / total;
    const start = cumulative;
    cumulative += pct;
    return {
      label,
      value,
      percent: Math.round(pct * 100),
      dashArray: pct * circumference,
      dashOffset: (1 - start) * circumference,
      color: CATEGORY_COLORS[label] || CATEGORY_COLORS.other,
    };
  });

  // SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('pie-svg');
  svg.setAttribute('viewBox', '0 0 120 120');

  for (const s of slices) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.classList.add('pie-slice');
    circle.setAttribute('cx', '60');
    circle.setAttribute('cy', '60');
    circle.setAttribute('r', String(radius));
    circle.setAttribute('stroke', s.color);
    circle.setAttribute('stroke-dasharray', `${s.dashArray} ${circumference}`);
    circle.setAttribute('stroke-dashoffset', String(-s.dashOffset));
    svg.appendChild(circle);
  }

  // Legend
  const legend = document.createElement('div');
  legend.className = 'pie-legend';
  for (const s of slices) {
    const item = document.createElement('div');
    item.className = 'pie-legend-item';

    const color = document.createElement('span');
    color.className = 'pie-legend-color';
    color.style.backgroundColor = s.color;

    const label = document.createElement('span');
    label.className = 'pie-legend-label';
    label.textContent = s.label.charAt(0).toUpperCase() + s.label.slice(1);

    const val = document.createElement('span');
    val.className = 'pie-legend-value';
    val.textContent = s.percent + '%';

    item.appendChild(color);
    item.appendChild(label);
    item.appendChild(val);
    legend.appendChild(item);
  }

  const wrap = document.createElement('div');
  wrap.className = 'pie-container';
  wrap.appendChild(svg);
  wrap.appendChild(legend);
  container.appendChild(wrap);
}

// ============================================
// TREND CHART
// ============================================

/**
 * Extract the total blocked count from a history entry (handles multiple shapes).
 * @param {object} entry
 * @returns {number}
 */
function getHistoryTotal(entry) {
  if (!entry) return 0;
  if (typeof entry.blocked === 'number') return entry.blocked;
  if (typeof entry.total === 'number') return entry.total;
  return (entry.network ?? entry.networkBlocked ?? 0) + (entry.cosmetic ?? entry.cosmeticBlocked ?? 0);
}

/**
 * Render a 7-day trend line chart.
 *
 * @param {HTMLElement|null} container
 * @param {Array} history
 */
export function renderTrendChart(container, history) {
  if (!container) return;
  clearElement(container);

  if (!history || history.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-chart';
    emptyDiv.textContent = 'No data yet';
    container.appendChild(emptyDiv);
    return;
  }

  const last7 = history.slice(-7);
  const maxVal = Math.max(...last7.map(getHistoryTotal), 1);

  const width = 300;
  const height = 120;
  const pad = 10;

  const points = last7.map((d, i) => {
    const x = last7.length === 1 ? width / 2 : pad + (i / (last7.length - 1)) * (width - 2 * pad);
    const y = height - pad - (getHistoryTotal(d) / maxVal) * (height - 2 * pad);
    return { x, y, date: d.date || d.day || d.timestamp };
  });

  const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1].x},${height - pad} L${points[0].x},${height - pad} Z`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('trend-svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');

  // Area fill
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.classList.add('trend-area');
  area.setAttribute('d', areaPath);
  svg.appendChild(area);

  // Line
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.classList.add('trend-line');
  line.setAttribute('d', linePath);
  svg.appendChild(line);

  // Dots
  for (const p of points) {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.classList.add('trend-dot');
    dot.setAttribute('cx', String(p.x));
    dot.setAttribute('cy', String(p.y));
    dot.setAttribute('r', '4');
    svg.appendChild(dot);
  }

  // Date labels
  const labels = document.createElement('div');
  labels.className = 'trend-labels';
  for (const d of last7) {
    const date = new Date(d.date || d.day || d.timestamp || Date.now());
    const label = document.createElement('span');
    label.className = 'trend-label';
    label.textContent = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('en-US', { weekday: 'short' });
    labels.appendChild(label);
  }

  container.appendChild(svg);
  container.appendChild(labels);
}
