import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ReadingStore } from "../lib/store.mjs";

const reading = (deviceId, timestamp, soil = 50) => ({
  deviceId,
  timestamp,
  sensors: { soilMoisture: soil, temperature: 25, humidity: 60, battery: 90 },
  gps: null
});

test("store persists readings and reloads them", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fieldline-store-"));
  const file = path.join(directory, "readings.jsonl");
  const first = new ReadingStore({ capacity: 10, dataFile: file });
  first.add(reading("field-a", "2026-09-19T10:00:00.000Z"));
  first.add(reading("field-b", "2026-09-19T10:05:00.000Z", 44));

  const second = new ReadingStore({ capacity: 10, dataFile: file });
  assert.equal(second.size, 2);
  assert.equal(second.latest("field-b").sensors.soilMoisture, 44);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("store applies device and time filters", () => {
  const store = new ReadingStore({ capacity: 10 });
  store.add(reading("field-a", "2026-09-19T10:00:00.000Z"));
  store.add(reading("field-b", "2026-09-19T10:05:00.000Z"));
  store.add(reading("field-a", "2026-09-19T10:10:00.000Z"));

  const result = store.list({
    deviceId: "field-a",
    after: "2026-09-19T10:01:00.000Z",
    limit: 10
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].timestamp, "2026-09-19T10:10:00.000Z");
});

test("store respects bounded in-memory capacity", () => {
  const store = new ReadingStore({ capacity: 2 });
  store.add(reading("field-a", "2026-09-19T10:00:00.000Z"));
  store.add(reading("field-a", "2026-09-19T10:05:00.000Z"));
  store.add(reading("field-a", "2026-09-19T10:10:00.000Z"));
  assert.equal(store.size, 2);
  assert.equal(store.readings[0].timestamp, "2026-09-19T10:05:00.000Z");
});
