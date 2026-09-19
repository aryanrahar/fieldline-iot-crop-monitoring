# Changelog

## 2.0.0 — Industry-ready portfolio upgrade

### Architecture
- Introduced versioned `/api/v1` routes while retaining legacy aliases.
- Added a repository boundary with optional append-only JSONL persistence.
- Added Server-Sent Events for live dashboard updates.
- Moved Firebase/Blynk calls off the ingestion critical path into a bounded retry queue.
- Consolidated frontend and backend into one production container and same-origin deployment.

### Reliability and security
- Added device-key authentication, rate limiting, strict request size/media-type validation, CORS allowlisting, security headers, request IDs, structured JSON logging, and graceful shutdown.
- Added `/health`, `/ready`, and Prometheus-compatible `/metrics` endpoints.
- Added deterministic demo telemetry for public portfolio deployments without physical hardware.

### Product/UI
- Reworked the dashboard into a responsive product-style interface with live connection state, loading/error/empty states, device selection, component-score visibility, accessible semantics, alerts, and CSV export.
- Removed external font dependencies and decorative effects that were unnecessary for the product.

### Engineering workflow
- Added API integration, persistence, validation, rate-limit, and domain tests.
- Added multi-stage Docker build, Docker Compose persistence/simulator setup, Render blueprint, `.dockerignore`, GitHub Actions CI, architecture docs, API docs, security notes, interview guide, and resume bullets.
