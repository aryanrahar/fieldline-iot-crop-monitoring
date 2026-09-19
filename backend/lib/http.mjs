import crypto from "node:crypto";

const baseSecurityHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cross-origin-resource-policy": "same-origin"
};

export function requestId(request) {
  const incoming = request.headers["x-request-id"];
  return typeof incoming === "string" && /^[a-zA-Z0-9._:-]{1,80}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
}

export function securityHeaders({ isStatic = false } = {}) {
  return {
    ...baseSecurityHeaders,
    ...(isStatic
      ? {
          "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        }
      : {})
  };
}

export function resolveCorsOrigin(requestOrigin, allowedOrigins) {
  if (!requestOrigin) return "";
  if (allowedOrigins.includes("*")) return "*";
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : "";
}

export function sendJson(response, status, payload, { id, corsOrigin = "", headers = {} } = {}) {
  response.writeHead(status, {
    ...securityHeaders(),
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-request-id": id || "",
    ...(corsOrigin ? { "access-control-allow-origin": corsOrigin, vary: "Origin" } : {}),
    ...headers
  });
  response.end(status === 204 ? "" : JSON.stringify(payload));
}

export async function readJson(request, maxBytes = 65536) {
  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    const error = new Error("content-type must be application/json");
    error.statusCode = 415;
    throw error;
  }

  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > maxBytes) {
      const error = new Error("payload too large");
      error.statusCode = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body || "{}");
  } catch {
    const error = new Error("invalid JSON payload");
    error.statusCode = 400;
    throw error;
  }
}

export function clientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return request.socket.remoteAddress || "unknown";
}
