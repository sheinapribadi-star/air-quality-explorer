// EPA US AQI categories. `color` is a slightly softened version of the official AirNow color (`epa`),
// same hue order so the scale stays instantly recognizable. + PM2.5 breakpoints (2024 NAAQS update).
export const CATEGORIES = [
  { max: 50, key: 'good', label: 'Good', color: '#4fb648', epa: '#00e400', soft: '#7bc96f', ink: '#1f3d1a',
    note: 'Air quality is satisfactory and poses little or no risk. A great time to be outside.',
    activity: 'Go for it: run, climb, bike, open the windows.' },
  { max: 100, key: 'moderate', label: 'Moderate', color: '#f2d33c', epa: '#ffff00', soft: '#f2cf4a', ink: '#4a3b00',
    note: 'Acceptable for most people. Unusually sensitive people may notice symptoms with long or heavy exertion outdoors.',
    activity: 'Fine for most activity. If you\u2019re very sensitive, take it a little easier.' },
  { max: 150, key: 'usg', label: 'Unhealthy for Sensitive Groups', color: '#f28a2e', epa: '#ff7e00', soft: '#f0954a', ink: '#4d2400',
    note: 'People with heart or lung disease, older adults, children, and teens may experience health effects. Most people are fine.',
    activity: 'Sensitive groups: shorten or move intense workouts indoors.' },
  { max: 200, key: 'unhealthy', label: 'Unhealthy', color: '#e0453a', epa: '#ff0000', soft: '#e0574f', ink: '#fff',
    note: 'Some members of the general public may experience health effects; sensitive groups may experience more serious effects.',
    activity: 'Everyone: reduce prolonged or heavy exertion outdoors. Consider a mask (N95).' },
  { max: 300, key: 'very-unhealthy', label: 'Very Unhealthy', color: '#8f4a9b', epa: '#8f3f97', soft: '#9b5aa3', ink: '#fff',
    note: 'Health alert: the risk of health effects is increased for everyone.',
    activity: 'Avoid outdoor exertion. Run an air purifier and keep windows closed.' },
  { max: Infinity, key: 'hazardous', label: 'Hazardous', color: '#7e2236', epa: '#7e0023', soft: '#8a2a3f', ink: '#fff',
    note: 'Health warning of emergency conditions: everyone is more likely to be affected.',
    activity: 'Stay indoors with filtered air. Follow local public-health guidance.' },
];

export function category(aqi) {
  if (aqi == null || Number.isNaN(aqi)) return null;
  return CATEGORIES.find((c) => aqi <= c.max);
}

// PM2.5 (24h, µg/m³) thresholds used for chart guide bands.
export const PM25_BREAKS = [
  { v: 9.0, label: 'Good \u2264 9' },
  { v: 35.4, label: 'Moderate \u2264 35.4' },
  { v: 55.4, label: 'USG \u2264 55.4' },
];
