#!/usr/bin/env node
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    continuous: { type: "boolean" },
    count: { type: "string", default: "40" },
    interval: { type: "string", default: "2000" }
  }
});

const apiUrl = (process.env.API_URL || "http://localhost:8080").replace(/\/$/, "");
const deviceApiKey = process.env.DEVICE_API_KEY || "";
let soil = 64;

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const jitter = amplitude => (Math.random() - 0.5) * amplitude;

function createReading(index) {
  soil = Math.max(6, soil - 0.65 + jitter(1.6));
  if (index > 0 && index % 30 === 0) soil = 74;
  const hour = new Date().getHours();
  return {
    deviceId: "nitkkr-field-01",
    timestamp: new Date().toISOString(),
    sensors: {
      soilMoisture: Number(soil.toFixed(1)),
      temperature: Number((25 + Math.sin((hour / 24) * Math.PI * 2) * 7 + jitter(1.2)).toFixed(1)),
      humidity: Number((62 - Math.sin((hour / 24) * Math.PI * 2) * 14 + jitter(2)).toFixed(1)),
      battery: Number(Math.max(15, 96 - index * 0.08).toFixed(1))
    },
    gps: { latitude: 29.9695, longitude: 76.8783 }
  };
}

async function postWithRetry(reading, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}/api/v1/readings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(deviceApiKey ? { "x-device-key": deviceApiKey } : {})
        },
        body: JSON.stringify(reading),
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error(`API returned ${response.status}: ${await response.text()}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(300 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function sendReading(index) {
  const reading = createReading(index);
  const result = await postWithRetry(reading);
  console.log(`${reading.timestamp} soil=${reading.sensors.soilMoisture}% health=${result.metrics.cropHealth} irrigation=${result.metrics.irrigation.action}`);
}

let index = 0;
do {
  await sendReading(index++);
  await sleep(values.continuous ? Math.max(500, Number(values.interval) || 2000) : 80);
} while (values.continuous || index < Number(values.count));
