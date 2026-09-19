# Changelog

## 2.0.0

### Backend
- Added versioned `/api/v1` routes while retaining legacy route aliases.
- Added telemetry validation, normalization, device-key authentication, rate limiting, and request-size controls.
- Added a bounded reading repository with optional append-only JSONL persistence.
- Added Server-Sent Events for live dashboard updates.
- Moved Firebase and Blynk mirroring to a bounded background queue with retry and exponential backoff.
- Added structured request logging, request IDs, graceful shutdown, and operational endpoints.

### Frontend
- Added live connection state with SSE reconnect and HTTP fallback.
- Added device filtering, historical sparklines, crop-health component scores, irrigation state, alerts, and CSV export.
- Added loading, empty, error, and reconnecting states.
- Improved keyboard accessibility, responsive layouts, and reduced-motion support.

### Operations
- Added `/health`, `/ready`, and Prometheus-compatible `/metrics` endpoints.
- Added multi-stage Docker builds and Docker Compose support.
- Added Render deployment configuration.
- Added GitHub Actions CI for checks, tests, frontend build, and Docker build.
- Added API, architecture, and security documentation.
