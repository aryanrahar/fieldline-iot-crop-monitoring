const finiteBetween = (value, min, max) => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;

export function validateReading(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { valid: false, errors: ["JSON object required"] };
  if (!raw.deviceId || !/^[a-zA-Z0-9_-]{3,64}$/.test(raw.deviceId)) errors.push("deviceId must be 3-64 safe characters");
  if (!raw.timestamp || Number.isNaN(Date.parse(raw.timestamp))) errors.push("timestamp must be ISO-8601");
  else if (Date.parse(raw.timestamp) > Date.now() + 5 * 60_000) errors.push("timestamp cannot be more than 5 minutes in the future");

  const sensors = raw.sensors || {};
  if (!finiteBetween(sensors.soilMoisture, 0, 100)) errors.push("soilMoisture must be 0-100");
  if (!finiteBetween(sensors.temperature, -40, 85)) errors.push("temperature must be -40 to 85°C");
  if (!finiteBetween(sensors.humidity, 0, 100)) errors.push("humidity must be 0-100");
  if (sensors.battery !== undefined && !finiteBetween(sensors.battery, 0, 100)) errors.push("battery must be 0-100");
  if (raw.gps) {
    if (typeof raw.gps !== "object" || Array.isArray(raw.gps)) errors.push("gps must be an object");
    else {
      if (!finiteBetween(raw.gps.latitude, -90, 90)) errors.push("latitude must be -90 to 90");
      if (!finiteBetween(raw.gps.longitude, -180, 180)) errors.push("longitude must be -180 to 180");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function normalizeReading(raw) {
  return {
    deviceId: raw.deviceId,
    timestamp: new Date(raw.timestamp).toISOString(),
    sensors: {
      soilMoisture: Number(raw.sensors.soilMoisture),
      temperature: Number(raw.sensors.temperature),
      humidity: Number(raw.sensors.humidity),
      battery: Number(raw.sensors.battery ?? 100)
    },
    gps: raw.gps ? { latitude: Number(raw.gps.latitude), longitude: Number(raw.gps.longitude) } : null
  };
}
