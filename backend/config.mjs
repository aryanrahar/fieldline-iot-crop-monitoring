import path from "node:path";

function intEnv(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  const value = raw == null || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function boolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function csvEnv(name) {
  return (process.env[name] || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

export function loadConfig() {
  const dataFile = process.env.DATA_FILE?.trim();
  return {
    env: process.env.NODE_ENV || "development",
    host: process.env.HOST || "0.0.0.0",
    port: intEnv("PORT", 8080, { min: 1, max: 65535 }),
    logLevel: process.env.LOG_LEVEL || "info",
    corsOrigins: csvEnv("CORS_ORIGINS"),
    deviceApiKey: process.env.DEVICE_API_KEY || "",
    dataFile: dataFile ? path.resolve(dataFile) : "",
    storeCapacity: intEnv("STORE_CAPACITY", 5000, { min: 100, max: 100000 }),
    maxBodyBytes: intEnv("MAX_BODY_BYTES", 65536, { min: 1024, max: 1048576 }),
    ingestRateLimitPerMinute: intEnv("INGEST_RATE_LIMIT_PER_MINUTE", 180, { min: 1, max: 10000 }),
    readRateLimitPerMinute: intEnv("READ_RATE_LIMIT_PER_MINUTE", 1200, { min: 1, max: 100000 }),
    demoMode: boolEnv("DEMO_MODE", false),
    demoIntervalMs: intEnv("DEMO_INTERVAL_MS", 5000, { min: 1000, max: 60000 }),
    integrationRetries: intEnv("INTEGRATION_RETRIES", 2, { min: 0, max: 5 }),
    integrationQueueSize: intEnv("INTEGRATION_QUEUE_SIZE", 500, { min: 10, max: 10000 }),
    firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL || "",
    firebaseAuthToken: process.env.FIREBASE_AUTH_TOKEN || "",
    blynkServer: process.env.BLYNK_SERVER || "https://blynk.cloud",
    blynkAuthToken: process.env.BLYNK_AUTH_TOKEN || ""
  };
}
