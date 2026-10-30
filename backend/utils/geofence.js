function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; 
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function checkGeofence(officeLocation, lat, lng) {
  const { lat: officeLat, lng: officeLng, radiusMeters } = officeLocation || {};
  if (officeLat == null || officeLng == null || !radiusMeters) {
    return { configured: false };
  }
  const distance = distanceMeters(officeLat, officeLng, lat, lng);
  return { configured: true, withinRadius: distance <= radiusMeters, distanceMeters: Math.round(distance) };
}

module.exports = { distanceMeters, checkGeofence };