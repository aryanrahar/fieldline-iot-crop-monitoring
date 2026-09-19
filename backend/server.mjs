#!/usr/bin/env node
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createApp } from "./app.mjs";
import { loadConfig } from "./config.mjs";
import { startDemoFeed } from "./lib/demo.mjs";
import { IntegrationQueue } from "./lib/integration-queue.mjs";
import { createLogger } from "./lib/logger.mjs";
import { MetricsRegistry } from "./lib/observability.mjs";
import { FixedWindowRateLimiter } from "./lib/rate-limit.mjs";
import { ReadingStore } from "./lib/store.mjs";
import { StreamHub } from "./lib/stream.mjs";

export function createRuntime(overrides = {}) {
  const config = overrides.config || loadConfig();
  const logger = overrides.logger || createLogger({ level: config.logLevel });
  const metricsRegistry = overrides.metricsRegistry || new MetricsRegistry();
  const store = overrides.store || new ReadingStore({
    capacity: config.storeCapacity,
    dataFile: config.dataFile,
    logger
  });
  const streamHub = overrides.streamHub || new StreamHub();
  const integrationQueue = overrides.integrationQueue || new IntegrationQueue({
    config,
    logger,
    metrics: metricsRegistry,
    maxSize: config.integrationQueueSize,
    retries: config.integrationRetries
  });
  const ingestLimiter = overrides.ingestLimiter || new FixedWindowRateLimiter({ limit: config.ingestRateLimitPerMinute });
  const readLimiter = overrides.readLimiter || new FixedWindowRateLimiter({ limit: config.readRateLimitPerMinute });
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const staticDir = overrides.staticDir ?? path.resolve(__dirname, "../frontend/dist");
  const app = createApp({ config, store, logger, metricsRegistry, integrationQueue, streamHub, ingestLimiter, readLimiter, staticDir });
  const server = http.createServer(app);
  return { config, logger, metricsRegistry, store, streamHub, integrationQueue, server };
}

export function startServer(overrides = {}) {
  const runtime = createRuntime(overrides);
  const stopDemo = runtime.config.demoMode
    ? startDemoFeed({
        store: runtime.store,
        streamHub: runtime.streamHub,
        integrationQueue: runtime.integrationQueue,
        metricsRegistry: runtime.metricsRegistry,
        intervalMs: runtime.config.demoIntervalMs,
        logger: runtime.logger
      })
    : () => {};

  const heartbeat = setInterval(() => runtime.streamHub.heartbeat(), 15000);
  heartbeat.unref?.();

  runtime.server.listen(runtime.config.port, runtime.config.host, () => {
    runtime.logger.info("Fieldline API listening", {
      host: runtime.config.host,
      port: runtime.config.port,
      demoMode: runtime.config.demoMode,
      persistence: Boolean(runtime.config.dataFile)
    });
  });

  const shutdown = signal => {
    runtime.logger.info("Graceful shutdown requested", { signal });
    clearInterval(heartbeat);
    stopDemo();
    runtime.server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return runtime;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) startServer();
