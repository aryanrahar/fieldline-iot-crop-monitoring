import { calculateMetrics } from "./metrics.mjs";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createDemoReading(index = 0, now = new Date()) {
  const phase = index / 8;
  const soil = clamp(58 - index * 0.18 + Math.sin(phase) * 6, 22, 78);
  const temperature = 28 + Math.sin(phase / 2) * 5;
  const humidity = 62 - Math.sin(phase / 2) * 10;
  return {
    deviceId: "nitkkr-field-01",
    timestamp: now.toISOString(),
    sensors: {
      soilMoisture: Number(soil.toFixed(1)),
      temperature: Number(temperature.toFixed(1)),
      humidity: Number(humidity.toFixed(1)),
      battery: Number(clamp(96 - index * 0.03, 45, 100).toFixed(1))
    },
    gps: { latitude: 29.9695, longitude: 76.8783 }
  };
}

export function seedDemoHistory(store, count = 48) {
  if (store.size) return;
  const start = Date.now() - count * 5 * 60_000;
  for (let index = 0; index < count; index += 1) {
    store.add(createDemoReading(index, new Date(start + index * 5 * 60_000)));
  }
}

export function startDemoFeed({ store, streamHub, integrationQueue, metricsRegistry, intervalMs = 5000, logger }) {
  seedDemoHistory(store);
  let index = store.size;
  const timer = setInterval(() => {
    const reading = createDemoReading(index++);
    const readingMetrics = calculateMetrics(reading);
    store.add(reading);
    integrationQueue?.enqueue(reading, readingMetrics);
    streamHub?.publish("reading", { reading, metrics: readingMetrics });
    metricsRegistry?.inc("fieldline_readings_ingested_total", { source: "demo" });
    metricsRegistry?.set("fieldline_readings_stored", store.size);
  }, intervalMs);
  timer.unref?.();
  logger?.info("Demo telemetry feed started", { intervalMs });
  return () => clearInterval(timer);
}
