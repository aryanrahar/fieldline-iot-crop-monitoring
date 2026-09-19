import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { calculateMetrics, trend } from "./lib/metrics.mjs";
import { clientIp, readJson, requestId, resolveCorsOrigin, securityHeaders, sendJson } from "./lib/http.mjs";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function safeEqual(left, right) {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function positiveInt(value, fallback, max) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function validTimestamp(value) {
  return !value || !Number.isNaN(Date.parse(value));
}

function dashboardPayload(store, { deviceId, limit = 120, before, after } = {}) {
  const readings = store.list({ deviceId, limit, before, after });
  const current = readings.at(-1) || null;
  return {
    current,
    metrics: current ? calculateMetrics(current) : null,
    trends: {
      soilMoisture: trend(readings, "soilMoisture"),
      temperature: trend(readings, "temperature"),
      humidity: trend(readings, "humidity")
    },
    readings
  };
}

function routeName(method, pathname) {
  if (pathname.includes("/readings")) return `${method} /readings`;
  if (pathname.includes("/dashboard")) return `${method} /dashboard`;
  if (pathname.includes("/devices")) return `${method} /devices`;
  if (pathname.includes("/stream")) return `${method} /stream`;
  if (["/health", "/ready", "/metrics"].includes(pathname)) return `${method} ${pathname}`;
  return `${method} other`;
}

function serveStatic(response, pathname, staticDir) {
  if (!staticDir || !fs.existsSync(staticDir)) return false;
  const requested = pathname === "/" ? "/index.html" : pathname;
  const root = path.resolve(staticDir);
  const resolved = path.resolve(root, `.${requested}`);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  let file = resolved;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(staticDir, "index.html");
  if (!fs.existsSync(file)) return false;
  const extension = path.extname(file).toLowerCase();
  const isIndex = path.basename(file) === "index.html";
  response.writeHead(200, {
    ...securityHeaders({ isStatic: true }),
    "content-type": mimeTypes[extension] || "application/octet-stream",
    "cache-control": isIndex ? "no-cache" : "public, max-age=31536000, immutable"
  });
  fs.createReadStream(file).pipe(response);
  return true;
}

export function createApp({
  config,
  store,
  logger,
  metricsRegistry,
  integrationQueue,
  streamHub,
  ingestLimiter,
  readLimiter,
  staticDir = ""
}) {
  return async function app(request, response) {
    const started = performance.now();
    const id = requestId(request);
    let status = 500;
    let route = "unknown";
    try {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      route = routeName(request.method, url.pathname);
      const origin = String(request.headers.origin || "");
      const corsOrigin = resolveCorsOrigin(origin, config.corsOrigins);

      if (origin && config.corsOrigins.length && !corsOrigin) {
        status = 403;
        return sendJson(response, status, { error: "origin_not_allowed", requestId: id }, { id });
      }

      if (request.method === "OPTIONS") {
        status = 204;
        return sendJson(response, status, {}, {
          id,
          corsOrigin,
          headers: {
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "content-type,x-device-key,x-request-id",
            "access-control-max-age": "600"
          }
        });
      }

      if (request.method === "GET" && url.pathname === "/health") {
        status = 200;
        return sendJson(response, status, { status: "ok", uptimeSeconds: Math.floor(process.uptime()) }, { id, corsOrigin });
      }

      if (request.method === "GET" && url.pathname === "/ready") {
        const ready = store.loaded;
        status = ready ? 200 : 503;
        return sendJson(response, status, {
          status: ready ? "ready" : "not_ready",
          readings: store.size,
          integrationQueueDepth: integrationQueue.depth,
          streams: streamHub.size
        }, { id, corsOrigin });
      }

      if (request.method === "GET" && url.pathname === "/metrics") {
        status = 200;
        metricsRegistry.set("fieldline_readings_stored", store.size);
        metricsRegistry.set("fieldline_stream_clients", streamHub.size);
        metricsRegistry.set("fieldline_integration_queue_depth", integrationQueue.depth);
        response.writeHead(200, {
          ...securityHeaders(),
          "content-type": "text/plain; version=0.0.4; charset=utf-8",
          "cache-control": "no-store",
          "x-request-id": id
        });
        response.end(metricsRegistry.render());
        return;
      }

      const isApi = url.pathname.startsWith("/api/");
      if (isApi) {
        const limiter = request.method === "POST" ? ingestLimiter : readLimiter;
        const rate = limiter.check(clientIp(request));
        const rateHeaders = {
          "x-ratelimit-limit": String(rate.limit),
          "x-ratelimit-remaining": String(rate.remaining),
          "x-ratelimit-reset": String(Math.ceil(rate.resetAt / 1000))
        };
        if (!rate.allowed) {
          status = 429;
          return sendJson(response, status, { error: "rate_limit_exceeded", requestId: id }, { id, corsOrigin, headers: rateHeaders });
        }

        const versioned = url.pathname.startsWith("/api/v1/") ? url.pathname : url.pathname.replace("/api/", "/api/v1/");

        if (request.method === "GET" && versioned === "/api/v1/health") {
          status = 200;
          return sendJson(response, status, { status: "ok", readings: store.size }, { id, corsOrigin, headers: rateHeaders });
        }

        if (request.method === "GET" && versioned === "/api/v1/devices") {
          status = 200;
          return sendJson(response, status, { devices: store.devices() }, { id, corsOrigin, headers: rateHeaders });
        }

        if (request.method === "GET" && versioned === "/api/v1/dashboard") {
          const before = url.searchParams.get("before") || "";
          const after = url.searchParams.get("after") || "";
          if (!validTimestamp(before) || !validTimestamp(after)) {
            status = 400;
            return sendJson(response, status, { error: "before/after must be valid ISO-8601 timestamps", requestId: id }, { id, corsOrigin, headers: rateHeaders });
          }
          status = 200;
          return sendJson(response, status, dashboardPayload(store, {
            deviceId: url.searchParams.get("deviceId") || undefined,
            limit: positiveInt(url.searchParams.get("limit"), 120, 500),
            before: before || undefined,
            after: after || undefined
          }), { id, corsOrigin, headers: rateHeaders });
        }

        if (request.method === "GET" && versioned === "/api/v1/readings") {
          const before = url.searchParams.get("before") || "";
          const after = url.searchParams.get("after") || "";
          if (!validTimestamp(before) || !validTimestamp(after)) {
            status = 400;
            return sendJson(response, status, { error: "before/after must be valid ISO-8601 timestamps", requestId: id }, { id, corsOrigin, headers: rateHeaders });
          }
          const readings = store.list({
            deviceId: url.searchParams.get("deviceId") || undefined,
            limit: positiveInt(url.searchParams.get("limit"), 100, 500),
            before: before || undefined,
            after: after || undefined
          });
          status = 200;
          return sendJson(response, status, { count: readings.length, readings }, { id, corsOrigin, headers: rateHeaders });
        }

        if (request.method === "GET" && versioned === "/api/v1/stream") {
          status = 200;
          response.writeHead(200, {
            ...securityHeaders(),
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-accel-buffering": "no",
            "x-request-id": id,
            ...(corsOrigin ? { "access-control-allow-origin": corsOrigin, vary: "Origin" } : {})
          });
          response.write(`event: connected\ndata: ${JSON.stringify({ requestId: id })}\n\n`);
          const unsubscribe = streamHub.subscribe(response, url.searchParams.get("deviceId") || "");
          request.on("close", unsubscribe);
          return;
        }

        if (request.method === "POST" && versioned === "/api/v1/readings") {
          if (config.deviceApiKey) {
            const provided = String(request.headers["x-device-key"] || "");
            if (!safeEqual(provided, config.deviceApiKey)) {
              status = 401;
              return sendJson(response, status, { error: "invalid_device_key", requestId: id }, { id, corsOrigin, headers: rateHeaders });
            }
          }
          const { validateReading, normalizeReading } = await import("./lib/validation.mjs");
          const raw = await readJson(request, config.maxBodyBytes);
          const validation = validateReading(raw);
          if (!validation.valid) {
            status = 422;
            return sendJson(response, status, { ...validation, requestId: id }, { id, corsOrigin, headers: rateHeaders });
          }
          const reading = normalizeReading(raw);
          const readingMetrics = calculateMetrics(reading);
          store.add(reading);
          const queued = integrationQueue.enqueue(reading, readingMetrics);
          streamHub.publish("reading", { reading, metrics: readingMetrics });
          metricsRegistry.inc("fieldline_readings_ingested_total", { source: "api" });
          metricsRegistry.set("fieldline_readings_stored", store.size);
          status = 201;
          return sendJson(response, status, {
            accepted: true,
            reading,
            metrics: readingMetrics,
            integrations: { queued },
            requestId: id
          }, { id, corsOrigin, headers: rateHeaders });
        }

        status = 404;
        return sendJson(response, status, { error: "route_not_found", requestId: id }, { id, corsOrigin, headers: rateHeaders });
      }

      if (request.method === "GET" && serveStatic(response, url.pathname, staticDir)) {
        status = 200;
        return;
      }

      status = 404;
      return sendJson(response, status, { error: "route_not_found", requestId: id }, { id });
    } catch (error) {
      status = error.statusCode || 500;
      const clientSafe = status < 500 ? error.message : "internal server error";
      if (status >= 500) logger.error("Unhandled request error", { requestId: id, error: error.message, stack: error.stack });
      return sendJson(response, status, { error: clientSafe, requestId: id }, { id });
    } finally {
      const durationMs = Math.round((performance.now() - started) * 100) / 100;
      metricsRegistry.inc("fieldline_http_requests_total", { route, status });
      metricsRegistry.inc("fieldline_http_request_duration_ms_total", { route }, durationMs);
      logger.info("request", {
        requestId: id,
        method: request.method,
        path: request.url,
        status,
        durationMs
      });
    }
  };
}
