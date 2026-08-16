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
      'https://www.google.com/maps/place/Bayanan+baywalk+covered+court/@14.4094644,121.0486196,17z',
  },
  {
    id: 2,
    name: 'Bayanan Elementary School - Unit 1',
    tag: 'Secondary Safe Haven (Inland)',
    lat: 14.4117681,
    lng: 121.0517064,
    capacity: '500 Persons',
    mapsUrl:
      'https://www.google.com/maps/place/Bayanan+Elementary+School+-+Unit+1/@14.4117681,121.0517064,17z',
  },
  {
    id: 3,
    name: 'Pedro E. Diaz High School',
    tag: 'High Ground Evacuation Haven',
    lat: 14.4145200,
    lng: 121.0468000,
    capacity: '600 Persons',
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=Pedro+E+Diaz+High+School+Muntinlupa',
  },
  {
    id: 4,
    name: 'Barangay Bayanan Multi-Purpose Hall',
    tag: 'Command & Medical Relief Post',
    lat: 14.4082000,
    lng: 121.0498000,
    capacity: '200 Persons',
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=Barangay+Bayanan+Hall+Muntinlupa',
  },
];

const BAYANAN_CENTER = { lat: 14.4106, lng: 121.0502 };

// Dynamic Tile Helper for Crisp Light & Dark Mode Maps
function getMapTileUrl() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
}

function setupMapTileLayer(map) {
  if (!map) return null;
  const tileLayer = L.tileLayer(getMapTileUrl(), {
    maxZoom: 19,
    subdomains: 'abcd',
  }).addTo(map);

  // Auto-switch on theme change
  const observer = new MutationObserver(() => {
    tileLayer.setUrl(getMapTileUrl());
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
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
        <div style="background:#2E7D32; color:white; font-size:18px; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2.5px solid white; box-shadow:0 3px 8px rgba(0,0,0,0.35);">
          🛡️
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
