# Interview Questions and Truthful Answers

## Why did you use Server-Sent Events instead of WebSockets?

The dashboard only needs server-to-browser telemetry notifications. SSE fits that direction, works over normal HTTP, and has native browser reconnection. WebSockets would be justified if the dashboard needed bidirectional device control or high-frequency duplex communication.

## Why is there no Kafka or Redis?

The current workload is a small IoT portfolio application. Adding distributed infrastructure would make setup and operations harder without solving a measured bottleneck. The code has boundaries around persistence, live delivery, and background integrations so those components can be replaced if scale requires it.

## How do you prevent Firebase/Blynk latency from slowing ingestion?

The ingestion path validates, stores, calculates local metrics, and enqueues third-party mirroring. A bounded background queue performs the external requests with retry/backoff, so an external outage does not hold open every device request.

## What happens if that in-memory queue crashes?

Queued mirror jobs can be lost. That is an explicit tradeoff for a lightweight deployment. If mirroring becomes business-critical, I would implement a transactional outbox in the primary database or use a durable queue.

## How is telemetry authenticated?

The current server can require a shared `X-Device-Key` from an environment variable. It is enough to prevent anonymous writes in a demo deployment, but a real device fleet should use unique credentials per device, rotation, revocation, and ideally mutual TLS or signed device tokens.

## Why JSONL persistence?

It provides restart persistence locally without adding a database dependency and keeps the project reproducible. It is append-friendly for low-rate telemetry. It is not designed for horizontal scaling or large analytical queries; PostgreSQL/TimescaleDB would be the next step.

## How would you move to PostgreSQL?

Keep the HTTP and domain layers unchanged and replace `ReadingStore` with a repository backed by PostgreSQL. I would index `(device_id, timestamp DESC)`, batch inserts where useful, add retention/downsampling, and use connection pooling.

## How do you protect the API?

The backend uses input range validation, a body-size limit, JSON-only ingestion, optional device-key authentication, per-IP rate limiting, strict CORS allowlisting for cross-origin browser requests, security headers, and secrets from environment variables.

## How are failures observable?

Requests receive IDs and generate structured logs with status and duration. `/health` and `/ready` separate liveness from readiness, and `/metrics` exposes request, ingestion, queue, storage, and stream gauges/counters in Prometheus format.

## What is the crop-health score?

It is deliberately an interpretable rules-based score, not an ML claim. Soil moisture has the highest weight, followed by temperature, humidity, and device battery. The thresholds and weights are explicit in code and should be calibrated with agronomic data before real automated irrigation.

## What would you measure before scaling?

Ingestion rate, request latency, queue depth/failure rate, active SSE clients, historical query latency, storage growth, and third-party integration latency. I would change architecture only after those measurements show a real constraint.
