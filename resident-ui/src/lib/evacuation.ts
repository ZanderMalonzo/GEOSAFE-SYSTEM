export type EvacuationHaven = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  mapsUrl: string;
};

export const EVACUATION_HAVENS: EvacuationHaven[] = [
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

export const BAYANAN_CENTER = { lat: 14.4106, lng: 121.0502 };

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getNearestHaven(userLat: number, userLng: number) {
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

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function openGoogleMapsDirections(
  haven: EvacuationHaven,
  userLat?: number,
  userLng?: number
) {
  const dest = `${haven.lat},${haven.lng}`;
  const origin = userLat != null && userLng != null ? `&origin=${userLat},${userLng}` : '';
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}&travelmode=walking`,
    '_blank',
    'noopener'
  );
}
