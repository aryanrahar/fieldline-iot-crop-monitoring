import assert from "node:assert/strict";
import test from "node:test";
import { calculateMetrics, trend } from "../lib/metrics.mjs";

const reading = sensors => ({ deviceId: "field-1", timestamp: new Date().toISOString(), sensors });

test("healthy field produces a high score and no irrigation", () => {
  const result = calculateMetrics(reading({ soilMoisture: 55, temperature: 25, humidity: 60, battery: 95 }));
  assert.ok(result.cropHealth >= 95);
  assert.equal(result.irrigation.action, "hold");
  assert.deepEqual(result.alerts, []);
});

test("critically dry soil triggers irrigation and alert", () => {
  const result = calculateMetrics(reading({ soilMoisture: 9, temperature: 30, humidity: 42, battery: 70 }));
  assert.equal(result.irrigation.urgency, "critical");
  assert.ok(result.alerts.some(alert => alert.type === "dry-soil"));
});

test("trend returns field delta", () => {
  const items = [reading({ soilMoisture: 30 }), reading({ soilMoisture: 37.256 })];
  assert.equal(trend(items, "soilMoisture"), 7.26);
});

