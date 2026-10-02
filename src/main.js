import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/700.css';
import 'leaflet/dist/leaflet.css';
import './style.css';

import L from 'leaflet';
import { REGIONS } from './cities.js';
import { CATEGORIES, category, PM25_BREAKS } from './aqi.js';
import { loadAll, mean, valid } from './data.js';
import { lineChart, Chart, GRID, MUTED, INK } from './charts.js';
import { fitDiurnal, bestUpcomingHour, fmtHour } from './insight.js';

const $ = (s, el = document) => el.querySelector(s);
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : (Math.round(v * 10 ** d) / 10 ** d).toFixed(d));
const METRICS = {
  pm25: { label: 'PM2.5', unit: 'µg/m³', key: 'pm25' },
  aqi: { label: 'US AQI', unit: '', key: 'aqi' },
  pm10: { label: 'PM10', unit: 'µg/m³', key: 'pm10' },
};
const COLOR_A = '#c8643b';
const COLOR_B = '#3f7a83';

const state = { cities: [], byId: {}, selected: null, panelMetric: 'pm25', cmpMetric: 'pm25', charts: {}, markers: {} };
const params = new URLSearchParams(location.search);

// ---------------- Map ----------------
const map = L.map('map', { zoomControl: false, zoomSnap: 0.25, attributionControl: true, worldCopyJump: true, scrollWheelZoom: false });
L.control.zoom({ position: 'bottomright' }).addTo(map);
// Standard OpenStreetMap raster tiles: free, no key (fine for a low-traffic portfolio app; see
// https://operations.osmfoundation.org/policies/tiles/). Muted with a CSS filter in style.css.
// CARTO basemaps now require an API key, so they're not used here.
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);
map.on('focus', () => map.scrollWheelZoom.enable());
map.on('blur', () => map.scrollWheelZoom.disable());

const legend = L.control({ position: 'bottomleft' });
legend.onAdd = () => {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = `<div class="legend-title">US AQI</div>` + CATEGORIES.map((c, i) => {
    const lo = i === 0 ? 0 : CATEGORIES[i - 1].max + 1;
    const range = c.max === Infinity ? `${lo}+` : `${lo}–${c.max}`;
    const short = c.key === 'usg' ? 'Sensitive groups' : c.label;
    return `<div class="legend-row"><span class="legend-swatch" style="background:${c.color}"></span><span>${short}</span><span class="legend-range">${range}</span></div>`;
  }).join('') + `<div class="legend-bar">${CATEGORIES.map((c) => `<span style="background:${c.color}"></span>`).join('')}</div><div class="legend-ticks"><span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300+</span></div>`;
  return div;
};
legend.addTo(map);

function setRegion(key) {
  const r = REGIONS[key];
  document.querySelectorAll('#regions button').forEach((b) => b.classList.toggle('on', b.dataset.r === key));
  if (r.bounds) map.fitBounds(r.bounds, { paddingTopLeft: [20, 64], paddingBottomRight: [20, 20] });
  else map.setView(r.center, r.zoom);
}

$('#regions').innerHTML = Object.entries(REGIONS).map(([k, r]) => `<button type="button" data-r="${k}">${r.label}</button>`).join('');
$('#regions').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setRegion(b.dataset.r); });
setRegion(params.get('region') || 'bay');

function renderMarkers() {
  Object.values(state.markers).forEach((m) => m.remove());
  state.markers = {};
  for (const c of state.cities) {
    const cat = category(c.current.aqi);
    const icon = L.divIcon({
      className: 'pin-wrap',
      html: `<div class="pin ${state.selected === c.id ? 'sel' : ''}" style="--c:${cat?.color || '#ccc'};--ink:${cat?.ink === '#fff' ? '#fff' : '#2b2622'}"><span>${c.current.aqi ?? '?'}</span></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const m = L.marker([c.lat, c.lon], { icon, title: c.name, keyboard: true, riseOnHover: true })
      .bindTooltip(`<strong>${c.name}</strong><br>${cat?.label ?? ''} · PM2.5 ${fmt(c.current.pm25)} µg/m³`, { direction: 'top', offset: [0, -16], className: 'tip' })
      .on('click', () => selectCity(c.id))
      .addTo(map);
    state.markers[c.id] = m;
  }
}

// ---------------- Panel ----------------
function destroy(name) { state.charts[name]?.destroy(); delete state.charts[name]; }

function renderOverview() {
  destroy('city'); destroy('diurnal');
  const sorted = [...state.cities].sort((a, b) => (a.current.aqi ?? 999) - (b.current.aqi ?? 999));
  const good = state.cities.filter((c) => (c.current.aqi ?? 999) <= 50).length;
  const bay = state.cities.filter((c) => c.region === 'bay');
  const bayAvg = mean(valid(bay.map((c) => c.current), 'pm25'));
  $('#panel').innerHTML = `
    <div class="panel-head">
      <div class="eyebrow">Right now</div>
      <h2>How&rsquo;s the air?</h2>
      <p class="muted small">${good} of ${state.cities.length} cities are in the <em>Good</em> range. Bay Area average PM2.5: <strong>${fmt(bayAvg)} µg/m³</strong>. Tap a city on the map or below.</p>
    </div>
    <ol class="rank">
      ${sorted.map((c) => {
        const cat = category(c.current.aqi);
        return `<li><button type="button" data-id="${c.id}">
          <span class="rank-dot" style="background:${cat?.color}"></span>
          <span class="rank-name">${c.name}${c.note ? `<span class="tag">${c.note}</span>` : ''}</span>
          <span class="rank-cat">${cat?.key === 'usg' ? 'Sensitive' : cat?.label ?? ''}</span>
          <span class="rank-aqi">${c.current.aqi ?? '—'}</span>
        </button></li>`;
      }).join('')}
    </ol>`;
  $('#panel').querySelectorAll('.rank button').forEach((b) => b.addEventListener('click', () => selectCity(b.dataset.id)));
}

function localNow(c) {
  return new Intl.DateTimeFormat('en-US', { timeZone: c.tz, weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date());
}

function cityDatasets(c, metricKey, colorLine, label, { fillPast = true } = {}) {
  const pts = (arr) => arr.map((h) => ({ x: h.t, y: h[metricKey] }));
  const past = pts(c.past);
  const fut = pts(c.past.length ? [c.past[c.past.length - 1], ...c.future] : c.future);
  return [
    { label, data: past, borderColor: colorLine, backgroundColor: hexA(colorLine, 0.12), fill: fillPast ? 'origin' : false },
    { label: `${label} (forecast)`, data: fut, borderColor: colorLine, borderDash: [5, 4], backgroundColor: hexA(colorLine, 0.05), fill: fillPast ? 'origin' : false },
  ];
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function renderCity(c) {
  destroy('city'); destroy('diurnal');
  const cat = category(c.current.aqi);
  const fit = fitDiurnal(c);
  const up = bestUpcomingHour(c);
  const pastMean = mean(valid(c.past, 'pm25'));
  const futMean = mean(valid(c.future, 'pm25'));
  const change = (futMean - pastMean) / pastMean;

  let insightHtml = '<p class="muted small">Not enough data to fit a model for this city.</p>';
  if (fit && up) {
    const trendWord = Math.abs(fit.slopePerDay) < 0.15 ? 'roughly flat' : fit.slopePerDay > 0 ? 'creeping up' : 'easing down';
    const weak = fit.r2 < 0.25;
    insightHtml = `
      <div class="best">
        <div class="best-time">
          <span class="best-label">Best hour to get outside ${up.when}</span>
          <span class="best-hour">${fmtHour(up.best.localHour)}</span>
          <span class="best-sub">${fmt(up.best.pm25)} µg/m³ forecast · worst ${fmtHour(up.worst.localHour)} (${fmt(up.worst.pm25)})</span>
        </div>
        <div class="best-strip" aria-hidden="true">
          ${up.window.map((h) => {
            const hc = category(h.aqi);
            const isBest = h.t === up.best.t;
            return `<span class="${isBest ? 'b' : ''}" title="${fmtHour(h.localHour)}: ${fmt(h.pm25)} µg/m³" style="--h:${up.worst.pm25 - up.best.pm25 < 0.05 ? 50 : 18 + (82 * (h.pm25 - up.best.pm25)) / (up.worst.pm25 - up.best.pm25)}%;--c:${hc?.soft || '#ccc'}"></span>`;
          }).join('')}
        </div>
        <div class="strip-axis"><span>${fmtHour(up.window[0].localHour)}</span><span>${fmtHour(up.window[up.window.length - 1].localHour)}</span></div>
      </div>
      <div class="insight-grid">
        <div class="mini">
          <div class="mini-label">Usually cleanest</div>
          <div class="mini-val">${fmtHour(fit.bestHour)}</div>
          <div class="mini-sub">dirtiest ~${fmtHour(fit.worstHour)} · swing ${fmt(fit.amplitude)} µg/m³</div>
        </div>
        <div class="mini">
          <div class="mini-label">Past-week trend</div>
          <div class="mini-val">${fit.slopePerDay > 0 ? '+' : ''}${fmt(fit.slopePerDay, 2)}<small> /day</small></div>
          <div class="mini-sub">${trendWord}; next 5 days ${change > 0 ? '+' : ''}${fmt(change * 100, 0)}% vs last week</div>
        </div>
        <div class="mini">
          <div class="mini-label">Model fit (R²)</div>
          <div class="mini-val">${fmt(fit.r2, 2)}</div>
          <div class="mini-sub">${weak ? 'weak daily pattern; take with salt' : 'hour of day explains a fair share'}</div>
        </div>
      </div>
      <div class="chart-wrap short"><canvas id="diurnalChart"></canvas></div>
      <details class="how">
        <summary>How this works</summary>
        <p>The <strong>best hour</strong> is simply the lowest PM2.5 value in the CAMS hourly forecast between 6 AM and 9 PM local time. The <strong>typical pattern</strong> comes from an ordinary least-squares fit on this city&rsquo;s last ${fit.n} hours: PM2.5 ~ day-trend + sin/cos of hour-of-day (24 h and 12 h cycles). Dots are observed hourly averages; the line is the fitted daily cycle. With one week of modeled data this is descriptive, not predictive. Weather, fires and traffic will beat it.</p>
      </details>`;
  }

  $('#panel').innerHTML = `
    <button class="back" type="button">&larr; All cities</button>
    <div class="city-head">
      <div>
        <h2>${c.name}${c.note ? ` <span class="tag">${c.note}</span>` : ''}</h2>
        <div class="muted small">${localNow(c)} · ${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°</div>
      </div>
    </div>
    <div class="now-row">
      <div class="aqi-badge" style="--c:${cat?.color};--soft:${cat?.soft};--ink:${cat?.ink === '#fff' ? '#fff' : '#2b2622'}">
        <span class="aqi-num">${c.current.aqi ?? '—'}</span>
        <span class="aqi-lbl">US AQI</span>
      </div>
      <div class="now-stats">
        <div class="cat-name">${cat?.label ?? 'Unknown'}</div>
        <div class="stat-line"><span>PM2.5</span><strong>${fmt(c.current.pm25)}</strong><span class="unit">µg/m³</span></div>
        <div class="stat-line"><span>PM10</span><strong>${fmt(c.current.pm10)}</strong><span class="unit">µg/m³</span></div>
      </div>
    </div>
    <div class="health" style="--soft:${cat?.soft}">
      <p>${cat?.note ?? ''}</p>
      <p class="activity"><strong>What to do:</strong> ${cat?.activity ?? ''}</p>
    </div>
    <div class="block">
      <div class="block-head">
        <h3>Last 7 days &middot; next 5</h3>
        <div class="seg small" id="panelMetric">
          ${Object.entries(METRICS).map(([k, m]) => `<button type="button" data-m="${k}" class="${state.panelMetric === k ? 'on' : ''}">${m.label}</button>`).join('')}
        </div>
      </div>
      <div class="chart-wrap"><canvas id="cityChart"></canvas></div>
    </div>
    <div class="block insight">
      <div class="block-head">
        <h3>Model insight</h3>
        <span class="tag soft">in-browser regression</span>
      </div>
      ${insightHtml}
    </div>
    <button class="cmp-link" type="button">Compare ${c.name} with another city &rarr;</button>`;

  $('#panel .back').addEventListener('click', () => selectCity(null));
  $('#panel .cmp-link').addEventListener('click', () => {
    $('#cmpA').value = c.id;
    if ($('#cmpB').value === c.id) $('#cmpB').value = c.id === 'berkeley' ? 'jakarta' : 'berkeley';
    renderCompare();
    $('#compare').scrollIntoView({ behavior: 'smooth' });
  });
  $('#panelMetric').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.panelMetric = b.dataset.m; renderCity(c);
  });

  const m = METRICS[state.panelMetric];
  const color = '#c8643b';
  state.charts.city = lineChart($('#cityChart'), {
    datasets: cityDatasets(c, m.key, color, m.label),
    timeZone: c.tz,
    now: c.now,
    compact: true,
    yTitle: m.unit || 'AQI',
    guides: m.key === 'pm25' ? PM25_BREAKS.map((g) => ({ ...g })) : m.key === 'aqi' ? [{ v: 50, label: 'Good ≤ 50' }, { v: 100, label: 'Moderate ≤ 100' }] : [],
  });

  if (fit) {
    const labels = Array.from({ length: 24 }, (_, h) => (h % 6 === 0 ? fmtHour(h) : ''));
    state.charts.diurnal = new Chart($('#diurnalChart'), {
      data: {
        labels,
        datasets: [
          { type: 'line', label: 'Fitted daily cycle', data: fit.curve, borderColor: INK, borderWidth: 2, pointRadius: 0, tension: 0.4 },
          { type: 'scatter', label: 'Observed hourly mean', data: fit.observed, backgroundColor: fit.observed.map((_, h) => (h === fit.bestHour ? '#3f7a83' : 'rgba(200,100,59,0.55)')), pointRadius: fit.observed.map((_, h) => (h === fit.bestHour ? 5 : 3)) },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { autoSkip: false, maxRotation: 0 } },
          y: { grid: { color: GRID }, border: { display: false }, ticks: { maxTicksLimit: 4 }, title: { display: true, text: 'µg/m³', color: MUTED, font: { size: 10 } } },
        },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, padding: 12 } },
          tooltip: { callbacks: { title: (i) => fmtHour(i[0].dataIndex), label: (i) => ` ${i.dataset.label}: ${fmt(i.parsed.y)} µg/m³` } },
        },
      },
    });
  }
}

function selectCity(id, { scroll = true } = {}) {
  state.selected = id;
  renderMarkers();
  if (!id) { renderOverview(); return; }
  const c = state.byId[id];
  renderCity(c);
  $('#panel').scrollTop = 0;
  if (scroll && window.matchMedia('(max-width: 900px)').matches) $('#panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  const u = new URL(location.href); u.searchParams.set('city', id); history.replaceState(null, '', u);
}

// ---------------- Compare ----------------
function renderCompare() {
  destroy('cmp');
  const a = state.byId[$('#cmpA').value];
  const b = state.byId[$('#cmpB').value];
  const m = METRICS[state.cmpMetric];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const chart = lineChart($('#cmpChart'), {
    log: !!state.cmpLog,
    datasets: [...cityDatasets(a, m.key, COLOR_A, a.name, { fillPast: false }), ...cityDatasets(b, m.key, COLOR_B, b.name, { fillPast: false })],
    timeZone: tz,
    now: Math.max(a.now, b.now),
    yTitle: m.unit || 'AQI',
    guides: m.key === 'pm25' ? PM25_BREAKS : m.key === 'aqi' ? [{ v: 50, label: 'Good ≤ 50' }, { v: 100, label: 'Moderate ≤ 100' }] : [],
  });
  state.charts.cmp = chart;

  const stats = (c) => {
    const past = valid(c.past, m.key);
    const fut = valid(c.future, m.key);
    return { now: c.current[m.key], avg: mean(past), peak: Math.max(...past), fut: mean(fut) };
  };
  const sa = stats(a), sb = stats(b);
  const card = (c, s, col) => `
    <div class="cmp-card" style="--col:${col}">
      <div class="cmp-name"><span class="swatch" style="background:${col}"></span>${c.name}</div>
      <div class="cmp-grid">
        <div><span>Now</span><strong>${fmt(s.now, m.key === 'aqi' ? 0 : 1)}</strong></div>
        <div><span>7-day avg</span><strong>${fmt(s.avg, m.key === 'aqi' ? 0 : 1)}</strong></div>
        <div><span>7-day peak</span><strong>${fmt(s.peak, m.key === 'aqi' ? 0 : 1)}</strong></div>
        <div><span>Forecast avg</span><strong>${fmt(s.fut, m.key === 'aqi' ? 0 : 1)}</strong></div>
      </div>
    </div>`;
  $('#cmpStats').innerHTML = card(a, sa, COLOR_A) + card(b, sb, COLOR_B);

  const ratio = sa.avg / sb.avg;
  let sentence;
  if (a.id === b.id) sentence = 'Pick two different cities to compare.';
  else if (Math.abs(ratio - 1) < 0.1) sentence = `Over the past week, <strong>${a.name}</strong> and <strong>${b.name}</strong> had about the same average ${m.label} (${fmt(sa.avg)} vs ${fmt(sb.avg)} ${m.unit}).`;
  else {
    const [hi, lo, r] = ratio > 1 ? [a, b, ratio] : [b, a, 1 / ratio];
    sentence = `Over the past week, <strong>${hi.name}</strong> averaged <strong>${fmt(r)}&times;</strong> the ${m.label} of <strong>${lo.name}</strong> (${fmt(ratio > 1 ? sa.avg : sb.avg)} vs ${fmt(ratio > 1 ? sb.avg : sa.avg)} ${m.unit}).`;
  }
  $('#cmpSummary').innerHTML = sentence;
}

function initCompare() {
  const opts = state.cities.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  $('#cmpA').innerHTML = opts; $('#cmpB').innerHTML = opts;
  $('#cmpA').value = params.get('a') || 'berkeley';
  $('#cmpB').value = params.get('b') || 'jakarta';
  $('#cmpA').addEventListener('change', renderCompare);
  $('#cmpB').addEventListener('change', renderCompare);
  $('#cmpMetric').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.cmpMetric = b.dataset.m;
    document.querySelectorAll('#cmpMetric button').forEach((x) => x.classList.toggle('on', x === b));
    renderCompare();
  });
  $('#cmpLog').addEventListener('change', (e) => { state.cmpLog = e.target.checked; renderCompare(); });
  renderCompare();
}

// ---------------- Boot ----------------
async function boot(force = false) {
  $('#updated').textContent = 'Loading live data…';
  try {
    const { cities, fetchedAt } = await loadAll({ force });
    state.cities = cities;
    state.byId = Object.fromEntries(cities.map((c) => [c.id, c]));
    const t = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(fetchedAt);
    $('#updated').innerHTML = `<span class="live"></span>Live · fetched ${t}`;
    const initial = state.selected || params.get('city');
    selectCity(initial && state.byId[initial] ? initial : null, { scroll: false });
    if (!$('#cmpA').options.length) initCompare(); else renderCompare();
  } catch (err) {
    console.error(err);
    $('#updated').textContent = 'Could not load data';
    $('#panel').innerHTML = `<div class="error"><h2>The air data didn&rsquo;t load</h2><p class="muted">${err.message}. Open-Meteo may be busy or you might be offline.</p><button class="pill btn" type="button" id="retry">Try again</button></div>`;
    $('#retry').addEventListener('click', () => boot(true));
  }
}
$('#refresh').addEventListener('click', () => boot(true));
boot();
