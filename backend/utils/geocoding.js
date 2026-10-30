const logger = require('./logger');
async function geocodeAddress(address) {
  if (!address || typeof address !== 'string' || !address.trim()) {
    return null;
  }
  const clean = address.trim();
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean)}&limit=1`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TelegramAttendanceSystem/1.0',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
  } catch (err) {
    logger.warn(`[geocoding] Failed to geocode address "${clean}": ${err.message}`);
  }
  return null;
}
async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TelegramAttendanceSystem/1.0',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.display_name || null;
  } catch (err) {
    logger.warn(`[geocoding] Failed to reverse geocode coords (${lat}, ${lng}): ${err.message}`);
  }
  return null;
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
};
