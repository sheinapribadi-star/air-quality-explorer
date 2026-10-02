// "Model insight": a small, honest, in-browser regression.
// PM2.5_t = b0 + b1*day + b2*sin(2πh/24) + b3*cos(2πh/24) + b4*sin(4πh/24) + b5*cos(4πh/24) + ε
// fit by ordinary least squares on the last 7 days of hourly (modeled) data for one city.
import { mean } from './data.js';

function solve(A, b) {
  // Gaussian elimination with partial pivoting.
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

const feats = (h, day) => {
  const w = (2 * Math.PI * h) / 24;
  return [1, day, Math.sin(w), Math.cos(w), Math.sin(2 * w), Math.cos(2 * w)];
};

export function fitDiurnal(city) {
  const pts = city.past.filter((x) => x.pm25 != null);
  if (pts.length < 48) return null;
  const t0 = pts[0].t;
  const X = pts.map((p) => feats(p.localHour, (p.t - t0) / 864e5));
  const y = pts.map((p) => p.pm25);
  const k = X[0].length;
  const XtX = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const Xty = Array.from({ length: k }, (_, i) => X.reduce((s, r, n) => s + r[i] * y[n], 0));
  const beta = solve(XtX, Xty);
  if (!beta) return null;
  const yhat = X.map((r) => r.reduce((s, v, i) => s + v * beta[i], 0));
  const ybar = mean(y);
  const ssTot = y.reduce((s, v) => s + (v - ybar) ** 2, 0);
  const ssRes = y.reduce((s, v, i) => s + (v - yhat[i]) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  const midDay = (pts[pts.length - 1].t - t0) / 864e5 / 2;
  const curve = Array.from({ length: 24 }, (_, h) => feats(h, midDay).reduce((s, v, i) => s + v * beta[i], 0));
  const observed = Array.from({ length: 24 }, (_, h) => mean(pts.filter((p) => p.localHour === h).map((p) => p.pm25)));

  // Typical cleanest/dirtiest waking hour (6am–9pm) according to the fitted daily cycle.
  let best = 6, worst = 6;
  for (let h = 6; h <= 21; h++) {
    if (curve[h] < curve[best]) best = h;
    if (curve[h] > curve[worst]) worst = h;
  }
  return { beta, r2, curve, observed, bestHour: best, worstHour: worst, slopePerDay: beta[1], n: pts.length, amplitude: curve[worst] - curve[best] };
}

// Best upcoming waking hour from the CAMS forecast (today if enough daylight remains, otherwise tomorrow).
export function bestUpcomingHour(city) {
  const nowLocalDate = city.current.time.slice(0, 10);
  const nowHour = Number(city.current.time.slice(11, 13));
  const candidates = (date) => city.future.filter((x) => x.localDate === date && x.localHour >= 6 && x.localHour <= 21 && x.pm25 != null);
  let when = 'today';
  let c = candidates(nowLocalDate);
  if (c.length < 3 || nowHour >= 19) {
    const tomorrow = city.future.find((x) => x.localDate > nowLocalDate);
    if (tomorrow) { c = candidates(tomorrow.localDate); when = 'tomorrow'; }
  }
  if (!c.length) return null;
  const best = c.reduce((a, b) => (b.pm25 < a.pm25 ? b : a));
  const worst = c.reduce((a, b) => (b.pm25 > a.pm25 ? b : a));
  return { when, best, worst, window: c };
}

export const fmtHour = (h) => {
  const hh = ((h + 11) % 12) + 1;
  return `${hh} ${h < 12 ? 'AM' : 'PM'}`;
};
