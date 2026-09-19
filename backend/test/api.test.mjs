import assert from "node:assert/strict";
import test from "node:test";
import { createRuntime } from "../server.mjs";

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

function config(overrides = {}) {
  return {
    env: "test",
    host: "127.0.0.1",
    port: 8080,
    logLevel: "error",
    corsOrigins: ["http://localhost:5173"],
    deviceApiKey: "test-device-secret",
    dataFile: "",
    storeCapacity: 100,
    maxBodyBytes: 65536,
    ingestRateLimitPerMinute: 50,
    readRateLimitPerMinute: 100,
    demoMode: false,
    demoIntervalMs: 5000,
    integrationRetries: 0,
    integrationQueueSize: 50,
    firebaseDatabaseUrl: "",
    firebaseAuthToken: "",
    blynkServer: "https://blynk.cloud",
    blynkAuthToken: "",
    ...overrides
  };
}

async function withServer(callback, overrides = {}) {
  const runtime = createRuntime({ config: config(overrides), logger: silentLogger, staticDir: "" });
  await new Promise(resolve => runtime.server.listen(0, "127.0.0.1", resolve));
  const { port } = runtime.server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => runtime.server.close(resolve));
  }
}

const validReading = {
  deviceId: "field-01",
  timestamp: "2026-09-19T10:00:00.000Z",
  sensors: { soilMoisture: 44, temperature: 28, humidity: 61, battery: 87 },
  gps: { latitude: 29.9695, longitude: 76.8783 }
};

test("liveness and readiness endpoints report service state", async () => {
  await withServer(async base => {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");

    const ready = await fetch(`${base}/ready`);
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).status, "ready");
  });
});

test("ingestion requires device authentication when configured", async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/api/v1/readings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validReading)
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "invalid_device_key");
  });
});

test("valid ingestion updates dashboard and device inventory", async () => {
  await withServer(async base => {
    const ingest = await fetch(`${base}/api/v1/readings`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-key": "test-device-secret" },
      body: JSON.stringify(validReading)
    });
    assert.equal(ingest.status, 201);
    const accepted = await ingest.json();
    assert.equal(accepted.accepted, true);
    assert.equal(accepted.metrics.irrigation.action, "hold");
    assert.ok(accepted.requestId);

    const dashboard = await fetch(`${base}/api/v1/dashboard?deviceId=field-01`);
    assert.equal(dashboard.status, 200);
    const payload = await dashboard.json();
    assert.equal(payload.current.deviceId, "field-01");
    assert.equal(payload.readings.length, 1);

    const devices = await fetch(`${base}/api/v1/devices`);
    assert.equal((await devices.json()).devices[0].deviceId, "field-01");
  });
});

test("API rejects malformed content and exposes Prometheus metrics", async () => {
  await withServer(async base => {
    const invalid = await fetch(`${base}/api/v1/readings`, {
      method: "POST",
      headers: { "content-type": "text/plain", "x-device-key": "test-device-secret" },
      body: "not-json"
    });
    assert.equal(invalid.status, 415);

    const metrics = await fetch(`${base}/metrics`);
    assert.equal(metrics.status, 200);
    const body = await metrics.text();
    assert.match(body, /fieldline_uptime_seconds/);
    assert.match(body, /fieldline_http_requests_total/);
  });
});

test("legacy API aliases remain compatible", async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "ok");
  });
});
