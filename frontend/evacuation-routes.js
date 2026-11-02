/** Official Bayanan evacuation safe havens (Muntinlupa) */
const EVACUATION_HAVENS = [
  {
    id: 1,
    name: 'Bayanan Baywalk Covered Court',
    tag: 'Primary Safe Haven (Lakeshore)',
    lat: 14.4094644,
    lng: 121.0486196,
    capacity: '350 Persons',
    mapsUrl:
      'https://www.openstreetmap.org/?mlat=14.4094644&mlon=121.0486196#map=18/14.4094644/121.0486196',
  },
  {
    id: 2,
    name: 'Bayanan Elementary School - Unit 1',
    tag: 'Secondary Safe Haven (Inland)',
    lat: 14.4117681,
    lng: 121.0517064,
    capacity: '500 Persons',
    mapsUrl:
      'https://www.openstreetmap.org/?mlat=14.4117681&mlon=121.0517064#map=18/14.4117681/121.0517064',
  },
  {
    id: 3,
    name: 'Pedro E. Diaz High School',
    tag: 'High Ground Evacuation Haven',
    lat: 14.4145200,
    lng: 121.0468000,
    capacity: '600 Persons',
    mapsUrl:
      'https://www.openstreetmap.org/?mlat=14.4145200&mlon=121.0468000#map=18/14.4145200/121.0468000',
  },
  {
    id: 4,
    name: 'Barangay Bayanan Multi-Purpose Hall',
    tag: 'Command & Medical Relief Post',
    lat: 14.4082000,
    lng: 121.0498000,
    capacity: '200 Persons',
    mapsUrl:
      'https://www.openstreetmap.org/?mlat=14.4082000&mlon=121.0498000#map=18/14.4082000/121.0498000',
  },
];

const BAYANAN_CENTER = { lat: 14.4106, lng: 121.0502 };

// Standard OpenStreetMap Tile Layer (100% Free, Zero API Keys Required)
function getMapTileUrl() {
  return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
}

function setupMapTileLayer(map) {
  if (!map) return null;
  const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
  }).addTo(map);
  return tileLayer;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearestHaven(userLat, userLng) {
  let nearest = EVACUATION_HAVENS[0];
  let minKm = Infinity;
  for (const h of EVACUATION_HAVENS) {
    const d = haversineKm(userLat, userLng, h.lat, h.lng);
    if (d < minKm) {
      minKm = d;
      nearest = h;
    }
  }
  return { haven: nearest, distanceKm: minKm };
}

function getHavenById(id) {
  return EVACUATION_HAVENS.find((h) => h.id === id) || EVACUATION_HAVENS[0];
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds) {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

function formatOsrmStep(step) {
  const m = step.maneuver || {};
  const road = step.name ? ` — ${step.name}` : '';
  const mod = m.modifier ? ` ${m.modifier}` : '';
  switch (m.type) {
    case 'depart':
      return `Head${mod}${road}`;
    case 'arrive':
      return `Arrive at ${road.replace(' — ', '') || 'Safe Haven'}`;
    case 'turn':
      return `Turn${mod}${road}`;
    case 'new name':
      return `Continue${road}`;
    case 'continue':
      return `Continue${road}`;
    case 'roundabout':
      return `Take roundabout${mod}${road}`;
    default:
      return `Continue${road}`;
  }
}

/** Walking directions along real road networks (OSRM with fallback) */
async function fetchWalkingRoute(fromLat, fromLng, toLat, toLng) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const url =
      `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}` +
      '?overview=full&geometries=geojson&steps=true&alternatives=false';

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error('OSRM route unavailable');
    }

    const route = data.routes[0];
    const leg = route.legs[0];
    const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const steps = (leg.steps || []).map((s) => ({
      instruction: formatOsrmStep(s),
      distanceM: s.distance,
      durationSec: s.duration,
    }));

    return {
      distanceM: route.distance,
      durationSec: route.duration,
      coordinates,
      steps,
    };
  } catch (err) {
    // Clean Direct Polyline Fallback without artificial bends
    const straightDist = haversineKm(fromLat, fromLng, toLat, toLng) * 1000;
    return {
      distanceM: straightDist,
      durationSec: Math.round(straightDist / 1.1), // ~4 km/h walking speed
      coordinates: [
        [fromLat, fromLng],
        [toLat, toLng],
      ],
      steps: [
        { instruction: 'Head directly towards designated safe evacuation zone', distanceM: straightDist, durationSec: Math.round(straightDist / 1.1) },
        { instruction: 'Arrive at Evacuation Safe Haven', distanceM: 0, durationSec: 0 }
      ],
    };
  }
}

// Custom Marker Icons
function createUserIcon() {
  return L.divIcon({
    className: 'gmap-user-beacon',
    html: `
      <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
        <div style="position:absolute; width:34px; height:34px; border-radius:50%; background:rgba(26,115,232,0.3); animation:pulse 2s infinite ease-out;"></div>
        <div style="width:16px; height:16px; border-radius:50%; background:#1A73E8; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.4); z-index:2;"></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createHavenIcon(haven) {
  return L.divIcon({
    className: 'gmap-haven-pin',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform:translateY(-8px);">
        <div style="background:#15803D; color:white; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2.5px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.35);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div style="background:white; color:#1B5E20; font-size:10px; font-weight:800; padding:2px 6px; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.25); white-space:nowrap; margin-top:2px; border:1px solid #C8E6C9;">
          ${escapeHtml ? escapeHtml(haven.name) : haven.name}
        </div>
      </div>
    `,
    iconSize: [40, 56],
    iconAnchor: [20, 28],
  });
}

function drawNavigationRoute(map, userLat, userLng, haven, routeData, layerGroup) {
  const userMarker = L.marker([userLat, userLng], { icon: createUserIcon() })
    .bindPopup('<strong>Your Current GPS Location</strong>');

  const havenMarker = L.marker([haven.lat, haven.lng], { icon: createHavenIcon(haven) })
    .bindPopup(`<strong>${haven.name}</strong><br><span style="color:#2E7D32; font-weight:700;">● Designated Safe Haven</span>`);

  const latlngs = routeData?.coordinates?.length
    ? routeData.coordinates
    : [[userLat, userLng], [haven.lat, haven.lng]];

  // Dual-tone path (border casing + glowing core)
  const lineCasing = L.polyline(latlngs, {
    color: '#1565C0',
    weight: 7,
    opacity: 0.35,
  });

  const lineCore = L.polyline(latlngs, {
    color: '#2E7D32',
    weight: 4,
    opacity: 0.95,
  });

  layerGroup.addLayer(lineCasing);
  layerGroup.addLayer(lineCore);
  layerGroup.addLayer(userMarker);
  layerGroup.addLayer(havenMarker);

  return { userMarker, havenMarker, routeLine: lineCore, lineCasing };
}

function fitMapToPath(map, latlngs) {
  if (latlngs?.length) {
    map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
  }
}

function remainingToDestination(userLat, userLng, haven) {
  return haversineKm(userLat, userLng, haven.lat, haven.lng) * 1000;
}

/**
 * Open-source Reverse Geocoder using OpenStreetMap Nominatim API (Zero API Keys required)
 */
async function reverseGeocodeOSM(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { 'Accept-Language': 'en' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const parts = [
      addr.road || addr.pedestrian || addr.footway || addr.suburb || addr.neighbourhood,
      addr.village || addr.quarter || addr.city_district || 'Barangay Bayanan',
      addr.city || 'Muntinlupa'
    ].filter(Boolean);
    return parts.join(', ') || data.display_name;
  } catch {
    return null;
  }
}

/**
 * Open-source Walking Directions using OpenStreetMap Web Engine (Zero API Keys required)
 */
function openOpenStreetMapDirections(haven, userLat, userLng) {
  if (!haven) return;
  const destLat = haven.lat || 14.4094644;
  const destLng = haven.lng || 121.0486196;
  let url = `https://www.openstreetmap.org/?mlat=${destLat}&mlon=${destLng}#map=18/${destLat}/${destLng}`;
  if (userLat && userLng) {
    url = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${userLat}%2C${userLng}%3B${destLat}%2C${destLng}`;
  }
  window.open(url, '_blank');
}

// Open-source Map Directions
function openExternalMapDirections(haven, userLat, userLng) {
  openOpenStreetMapDirections(haven, userLat, userLng);
}

// Compatibility Alias
function openGoogleMapsDirections(haven, userLat, userLng) {
  openOpenStreetMapDirections(haven, userLat, userLng);
}

