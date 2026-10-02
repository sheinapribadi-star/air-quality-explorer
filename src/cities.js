// Curated list: Bay Area heavy, a few California + major U.S. metros, and Jakarta.
export const CITIES = [
  // Bay Area
  { id: 'berkeley', name: 'Berkeley', region: 'bay', lat: 37.8716, lon: -122.2727, note: 'Home base' },
  { id: 'oakland', name: 'Oakland', region: 'bay', lat: 37.8044, lon: -122.2712 },
  { id: 'san-francisco', name: 'San Francisco', region: 'bay', lat: 37.7749, lon: -122.4194 },
  { id: 'san-jose', name: 'San Jose', region: 'bay', lat: 37.3382, lon: -121.8863 },
  { id: 'fremont', name: 'Fremont', region: 'bay', lat: 37.5485, lon: -121.9886 },
  { id: 'richmond', name: 'Richmond', region: 'bay', lat: 37.9358, lon: -122.3477 },
  { id: 'palo-alto', name: 'Palo Alto', region: 'bay', lat: 37.4419, lon: -122.143 },
  { id: 'hayward', name: 'Hayward', region: 'bay', lat: 37.6688, lon: -122.0808 },
  { id: 'walnut-creek', name: 'Walnut Creek', region: 'bay', lat: 37.9101, lon: -122.0652 },
  { id: 'san-rafael', name: 'San Rafael', region: 'bay', lat: 37.9735, lon: -122.5311 },
  { id: 'vallejo', name: 'Vallejo', region: 'bay', lat: 38.1041, lon: -122.2566 },
  // California
  { id: 'sacramento', name: 'Sacramento', region: 'us', lat: 38.5816, lon: -121.4944 },
  { id: 'fresno', name: 'Fresno', region: 'us', lat: 36.7378, lon: -119.7871 },
  { id: 'los-angeles', name: 'Los Angeles', region: 'us', lat: 34.0522, lon: -118.2437 },
  // U.S.
  { id: 'seattle', name: 'Seattle', region: 'us', lat: 47.6062, lon: -122.3321 },
  { id: 'portland', name: 'Portland', region: 'us', lat: 45.5152, lon: -122.6784 },
  { id: 'phoenix', name: 'Phoenix', region: 'us', lat: 33.4484, lon: -112.074 },
  { id: 'salt-lake-city', name: 'Salt Lake City', region: 'us', lat: 40.7608, lon: -111.891 },
  { id: 'denver', name: 'Denver', region: 'us', lat: 39.7392, lon: -104.9903 },
  { id: 'houston', name: 'Houston', region: 'us', lat: 29.7604, lon: -95.3698 },
  { id: 'chicago', name: 'Chicago', region: 'us', lat: 41.8781, lon: -87.6298 },
  { id: 'atlanta', name: 'Atlanta', region: 'us', lat: 33.749, lon: -84.388 },
  { id: 'washington-dc', name: 'Washington, DC', region: 'us', lat: 38.9072, lon: -77.0369 },
  { id: 'new-york', name: 'New York', region: 'us', lat: 40.7128, lon: -74.006 },
  // Personal touch
  { id: 'jakarta', name: 'Jakarta', region: 'id', lat: -6.2088, lon: 106.8456, note: 'Hometown' },
];

export const REGIONS = {
  bay: { label: 'Bay Area', bounds: [[37.3, -122.6], [38.15, -121.85]] },
  us: { label: 'U.S.', bounds: [[25, -125], [49, -70]] },
  id: { label: 'Jakarta', center: [-6.2088, 106.8456], zoom: 10 },
  all: { label: 'World', bounds: [[-10, -128], [50, 110]] },
};
