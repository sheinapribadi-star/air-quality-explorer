import Chart from 'chart.js/auto';

export const INK = '#2b2622';
export const MUTED = '#8a7f74';
export const GRID = 'rgba(43,38,34,0.07)';

Chart.defaults.font.family = '"DM Sans", system-ui, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.color = MUTED;

// Vertical "now" marker.
const nowLine = {
  id: 'nowLine',
  afterDatasetsDraw(chart, _args, opts) {
    if (opts?.t == null) return;
    const x = chart.scales.x.getPixelForValue(opts.t);
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(43,38,34,0.45)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = INK;
    ctx.font = '600 10px "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('now', x + 4, top + 10);
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'right';
    ctx.fillText('past 7 days', x - 6, top + 10);
    ctx.textAlign = 'left';
    ctx.fillText('forecast', x + 28, top + 10);
    ctx.restore();
  },
};

// Horizontal guide lines (e.g., EPA PM2.5 breakpoints) drawn behind the data.
const guides = {
  id: 'guides',
  beforeDatasetsDraw(chart, _args, opts) {
    if (!opts?.lines?.length) return;
    const y = chart.scales.y;
    const { left, right, top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    for (const g of opts.lines) {
      const py = y.getPixelForValue(g.v);
      if (py < top || py > bottom) continue;
      ctx.strokeStyle = g.color || 'rgba(200,100,59,0.35)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = g.color || 'rgba(200,100,59,0.8)';
      ctx.font = '500 9.5px "DM Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(g.label, right - 4, py - 4);
    }
    ctx.restore();
  },
};

Chart.register(nowLine, guides);

export function timeAxis(timeZone, { compact = false, min, max } = {}) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: compact ? undefined : 'short', day: compact ? undefined : 'numeric' });
  const full = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' });
  const hourOf = (v) => Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(v));
  return {
    type: 'linear',
    min,
    max,
    grid: { color: GRID, drawTicks: false },
    border: { display: false },
    ticks: {
      padding: 8,
      maxRotation: 0,
      autoSkip: false,
      // Put a tick at each local midnight.
      callback: (v) => day.format(v),
    },
    afterBuildTicks(axis) {
      const ticks = [];
      const start = axis.min - (axis.min % 3600000);
      let i = 0;
      for (let t = start; t <= axis.max; t += 3600000) {
        if (hourOf(t) === 12) { if (!compact || i % 2 === 0) ticks.push({ value: t }); i++; }
      }
      axis.ticks = ticks;
    },
    _fmtFull: (v) => full.format(v),
  };
}

export function lineChart(canvas, { datasets, timeZone, now, yTitle, guides: g = [], compact = false, log = false }) {
  const xs = datasets.flatMap((d) => d.data.map((p) => p.x));
  const x = timeAxis(timeZone, { compact, min: Math.min(...xs), max: Math.max(...xs) });
  return new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 450 },
      interaction: { mode: 'index', intersect: false },
      parsing: false,
      normalized: true,
      elements: { point: { radius: 0, hoverRadius: 4 }, line: { tension: 0.3, borderWidth: 2 } },
      scales: {
        x,
        y: {
          type: log ? 'logarithmic' : 'linear',
          beginAtZero: !log,
          grid: { color: GRID, drawTicks: false },
          border: { display: false },
          ticks: log
            ? { padding: 6, autoSkip: false, callback: (v) => ([1, 2, 5, 10, 20, 50, 100, 200, 500].includes(v) ? v : null) }
            : { padding: 6, maxTicksLimit: 5 },
          title: { display: !!yTitle, text: yTitle, color: MUTED, font: { size: 10 } },
        },
      },
      plugins: {
        legend: { display: false },
        nowLine: { t: now },
        guides: { lines: g },
        tooltip: {
          backgroundColor: '#fffdf9',
          titleColor: INK,
          bodyColor: INK,
          borderColor: 'rgba(43,38,34,0.12)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10,
          boxPadding: 4,
          usePointStyle: true,
          filter: (item) => !item.dataset.hideInTooltip,
          callbacks: {
            title: (items) => (items.length ? x._fmtFull(items[0].parsed.x) : ''),
            label: (item) => ` ${item.dataset.label}: ${item.parsed.y == null ? '—' : Math.round(item.parsed.y * 10) / 10}`,
          },
        },
      },
    },
  });
}

export { Chart };
