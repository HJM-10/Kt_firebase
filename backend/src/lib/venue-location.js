// A coordinate pair is updated atomically. Never infer a precise pin from a name.
function venueLocation(body) {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  const result = {};
  if (body.address !== undefined) {
    if (body.address !== null && (typeof body.address !== 'string' || body.address.trim().length > 500)) fail('Address must contain at most 500 characters');
    result.address = body.address?.trim() || null;
  }
  if (body.latitude !== undefined || body.longitude !== undefined) {
    const { latitude, longitude } = body;
    if (latitude === null && longitude === null) return { ...result, latitude: null, longitude: null };
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) fail('Choose both a valid latitude (-90 to 90) and longitude (-180 to 180), or clear both');
    Object.assign(result, { latitude, longitude });
  }
  return result;
}
module.exports = { venueLocation };
