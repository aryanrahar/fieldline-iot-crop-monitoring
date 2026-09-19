import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReading, validateReading } from "../lib/validation.mjs";

const valid = {
  deviceId: "field-01",
  timestamp: "2026-09-19T10:00:00Z",
  sensors: { soilMoisture: "42", temperature: 29, humidity: 61, battery: 84 },
  gps: { latitude: 29.9695, longitude: 76.8783 }
};

test("valid reading is normalized to numeric values", () => {
  assert.equal(validateReading(valid).valid, true);
  const reading = normalizeReading(valid);
  assert.equal(reading.sensors.soilMoisture, 42);
  assert.equal(reading.timestamp, "2026-09-19T10:00:00.000Z");
});

test("out-of-range readings are rejected", () => {
  const invalid = structuredClone(valid);
  invalid.sensors.humidity = 140;
  invalid.gps.latitude = -100;
  const result = validateReading(invalid);
  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
});

test("future timestamps are rejected to limit corrupt telemetry", () => {
  const invalid = structuredClone(valid);
  invalid.timestamp = new Date(Date.now() + 10 * 60_000).toISOString();
  const result = validateReading(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes("future")));
});
