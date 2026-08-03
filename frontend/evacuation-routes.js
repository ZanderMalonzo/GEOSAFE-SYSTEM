/** Official Bayanan evacuation safe havens (Muntinlupa) */
const EVACUATION_HAVENS = [
  {
    id: 1,
    name: 'Bayanan Baywalk Covered Court',
    lat: 14.4094644,
    lng: 121.0486196,
    mapsUrl:
      'https://www.google.com/maps/place/Bayanan+baywalk+covered+court/@14.4094644,121.0486196,17z',
  },
  {
    id: 2,
    name: 'Bayanan Elementary School - Unit 1',
    lat: 14.4117681,
    lng: 121.0517064,
    mapsUrl:
      'https://www.google.com/maps/place/Bayanan+Elementary+School+-+Unit+1/@14.4117681,121.0517064,17z',
  },
];

const BAYANAN_CENTER = { lat: 14.4106, lng: 121.0502 };

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

/** Midpoint bend for visible path on map */
function routeWaypoints(fromLat, fromLng, toLat, toLng) {
  return [
    [fromLat, fromLng],
    [(fromLat + toLat) / 2 + 0.0015, (fromLng + toLng) / 2 - 0.002],
    [toLat, toLng],
  ];
}

function drawEvacuationOnMap(map, userLat, userLng, haven, layerGroup) {
  const user = L.circleMarker([userLat, userLng], {
    radius: 10,
    color: '#e53e3e',
    fillColor: '#e53e3e',
    fillOpacity: 1,
  }).bindPopup('You are here');
  const dest = L.circleMarker([haven.lat, haven.lng], {
    radius: 10,
    color: '#48bb78',
    fillColor: '#48bb78',
    fillOpacity: 1,
  }).bindPopup(`<strong>${haven.name}</strong><br>Evacuation safe haven`);
  const line = L.polyline(routeWaypoints(userLat, userLng, haven.lat, haven.lng), {
    color: '#48bb78',
    weight: 5,
    dashArray: '10 10',
  });
  layerGroup.addLayer(user);
  layerGroup.addLayer(dest);
  layerGroup.addLayer(line);
  return layerGroup;
}

function drawAllHavens(map, layerGroup) {
  EVACUATION_HAVENS.forEach((h, i) => {
    const m = L.circleMarker([h.lat, h.lng], {
      radius: 8,
      color: '#48bb78',
      fillColor: '#48bb78',
      fillOpacity: 0.85,
    }).bindPopup(`<strong>Route ${i + 1}</strong><br>${h.name}`);
    layerGroup.addLayer(m);
  });
}

function fitMapToRoute(map, userLat, userLng, haven) {
  const bounds = L.latLngBounds([
    [userLat, userLng],
    [haven.lat, haven.lng],
  ]);
  map.fitBounds(bounds.pad(0.2));
}

function openGoogleMapsDirections(haven, userLat, userLng) {
  const dest = `${haven.lat},${haven.lng}`;
  const origin = userLat != null ? `&origin=${userLat},${userLng}` : '';
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}&travelmode=walking`,
    '_blank',
    'noopener'
  );
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
      return `Arrive at ${road.replace(' — ', '') || 'destination'}`;
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

/** Walking directions along real roads (OSRM — free, no API key) */
async function fetchWalkingRoute(fromLat, fromLng, toLat, toLng) {
  const url =
    `https://router.project-osrm.org/route/v1/foot/${fromLng},${fromLat};${toLng},${toLat}` +
    '?overview=full&geometries=geojson&steps=true&alternatives=false';

  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(data.message || 'Could not calculate walking route');
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
}

function drawNavigationRoute(map, userLat, userLng, haven, routeData, layerGroup) {
  const user = L.circleMarker([userLat, userLng], {
    radius: 11,
    color: '#3b82f6',
    fillColor: '#3b82f6',
    fillOpacity: 1,
    weight: 2,
  }).bindPopup('You are here');

  const dest = L.circleMarker([haven.lat, haven.lng], {
    radius: 11,
    color: '#48bb78',
    fillColor: '#48bb78',
    fillOpacity: 1,
  }).bindPopup(`<strong>${haven.name}</strong><br>Evacuation safe haven`);

  const latlngs = routeData?.coordinates?.length
    ? routeData.coordinates
    : routeWaypoints(userLat, userLng, haven.lat, haven.lng);

  const line = L.polyline(latlngs, {
    color: '#48bb78',
    weight: 6,
    opacity: 0.9,
  });

  layerGroup.addLayer(line);
  layerGroup.addLayer(user);
  layerGroup.addLayer(dest);
  return { userMarker: user, routeLine: line };
}

function fitMapToPath(map, latlngs) {
  if (latlngs?.length) {
    map.fitBounds(L.latLngBounds(latlngs).pad(0.15));
  }
}

function remainingToDestination(userLat, userLng, haven) {
  return haversineKm(userLat, userLng, haven.lat, haven.lng) * 1000;
}
