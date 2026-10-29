export function hasPin(venue) {
  return typeof venue?.latitude === 'number' && Number.isFinite(venue.latitude) && Math.abs(venue.latitude) <= 90 && typeof venue?.longitude === 'number' && Number.isFinite(venue.longitude) && Math.abs(venue.longitude) <= 180;
}
export function directionsUrl(venue) {
  if (!hasPin(venue)) return null;
  const query = new URLSearchParams({ api: '1', destination: `${venue.latitude},${venue.longitude}`, dir_action: 'navigate' });
  // Omitting origin lets Google Maps request the device's current position.
  return `https://www.google.com/maps/dir/?${query}`;
}
export function locationPayload(form) {
  const latitude = String(form.latitude ?? '').trim(), longitude = String(form.longitude ?? '').trim();
  if (!latitude && !longitude) return { address: form.address?.trim() || null, latitude: null, longitude: null };
  const point = { latitude: latitude ? Number(latitude) : NaN, longitude: longitude ? Number(longitude) : NaN };
  if (!hasPin(point)) throw new Error('Enter both valid coordinates, or clear the location pin.');
  return { ...point, address: form.address?.trim() || null };
}
