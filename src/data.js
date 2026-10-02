import { CITIES } from './cities.js';

const ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const CACHE_KEY = 'aqe-cache-v1';
const CACHE_MS = 30 * 60 * 1000;

// Parse "2026-10-01T22:00" (city-local wall time) into epoch ms using the city's UTC offset.
function toEpoch(str, offsetSec) {
  const [d, t] = str.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return Date.UTC(y, m - 1, day, hh, mm) - offsetSec * 1000;
}

function shape(city, raw) {
  const off = raw.utc_offset_seconds;
  const h = raw.hourly;
  const nowEpoch = toEpoch(raw.current.time, off);
  const hours = h.time.map((t, i) => ({
    t: toEpoch(t, off),
    localHour: Number(t.slice(11, 13)),
    localDate: t.slice(0, 10),
    pm25: h.pm2_5[i],
    pm10: h.pm10[i],
    aqi: h.us_aqi[i],
  }));
  return {
    ...city,
    tz: raw.timezone,
    tzAbbr: raw.timezone_abbreviation,
    offset: off,
    now: nowEpoch,
    current: {
      time: raw.current.time,
      pm25: raw.current.pm2_5,
      pm10: raw.current.pm10,
      aqi: raw.current.us_aqi,
      aqiPm25: raw.current.us_aqi_pm2_5,
    },
    hours,
    past: hours.filter((x) => x.t <= nowEpoch),
    future: hours.filter((x) => x.t > nowEpoch),
  };
}

export async function loadAll({ force = false } = {}) {
  if (!force) {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.at < CACHE_MS) return { cities: c.raw.map((r, i) => shape(CITIES[i], r)), fetchedAt: c.at };
    } catch { /* ignore */ }
  }
  const params = new URLSearchParams({
    latitude: CITIES.map((c) => c.lat).join(','),
    longitude: CITIES.map((c) => c.lon).join(','),
    hourly: 'pm2_5,pm10,us_aqi',
    current: 'pm2_5,pm10,us_aqi,us_aqi_pm2_5',
    past_days: '7',
    forecast_days: '5',
    timezone: 'auto',
  });
  const res = await fetch(`${ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  let raw = await res.json();
  if (!Array.isArray(raw)) raw = [raw];
  const at = Date.now();
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at, raw })); } catch { /* quota */ }
  return { cities: raw.map((r, i) => shape(CITIES[i], r)), fetchedAt: at };
}

export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
export const valid = (arr, k) => arr.map((x) => x[k]).filter((v) => v != null && !Number.isNaN(v));
