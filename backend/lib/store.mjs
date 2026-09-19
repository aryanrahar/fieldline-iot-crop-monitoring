import fs from "node:fs";
import path from "node:path";

export class ReadingStore {
  constructor({ capacity = 5000, dataFile = "", logger = null } = {}) {
    this.capacity = capacity;
    this.dataFile = dataFile;
    this.logger = logger;
    this.readings = [];
    this.loaded = false;
    this.#load();
  }

  #load() {
    if (!this.dataFile) {
      this.loaded = true;
      return;
    }
    try {
      if (!fs.existsSync(this.dataFile)) {
        fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
        this.loaded = true;
        return;
      }
      const lines = fs.readFileSync(this.dataFile, "utf8").split(/\r?\n/).filter(Boolean);
      const parsed = [];
      for (const line of lines.slice(-this.capacity)) {
        try {
          parsed.push(JSON.parse(line));
        } catch {
          this.logger?.warn("Skipping malformed persisted telemetry line");
        }
      }
      this.readings = parsed;
      this.loaded = true;
      this.logger?.info("Loaded persisted telemetry", { readings: this.readings.length, dataFile: this.dataFile });
    } catch (error) {
      this.loaded = false;
      this.logger?.error("Failed to load persisted telemetry", { error: error.message, dataFile: this.dataFile });
    }
  }

  add(reading) {
    this.readings.push(reading);
    if (this.readings.length > this.capacity) {
      this.readings.splice(0, this.readings.length - this.capacity);
    }
    if (this.dataFile) {
      fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
      fs.appendFileSync(this.dataFile, `${JSON.stringify(reading)}\n`, "utf8");
    }
    return reading;
  }

  list({ deviceId, limit = 120, before, after } = {}) {
    const beforeMs = before ? Date.parse(before) : Infinity;
    const afterMs = after ? Date.parse(after) : -Infinity;
    return this.readings
      .filter(reading => !deviceId || reading.deviceId === deviceId)
      .filter(reading => {
        const timestamp = Date.parse(reading.timestamp);
        return timestamp < beforeMs && timestamp >= afterMs;
      })
      .slice(-limit);
  }

  latest(deviceId) {
    return this.list({ deviceId, limit: 1 }).at(-1) || null;
  }

  devices() {
    const latestByDevice = new Map();
    for (const reading of this.readings) latestByDevice.set(reading.deviceId, reading);
    return [...latestByDevice.values()].map(reading => ({
      deviceId: reading.deviceId,
      lastSeen: reading.timestamp,
      gps: reading.gps,
      battery: reading.sensors.battery
    }));
  }

  get size() {
    return this.readings.length;
  }
}
