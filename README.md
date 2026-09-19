# Fieldline — IoT Crop Monitoring & Irrigation Decision Platform

Fieldline is a production-oriented IoT telemetry project for crop monitoring. It accepts ESP32 sensor readings, validates and stores them, calculates an interpretable crop-health score and irrigation recommendation, streams live updates to a React dashboard, and can mirror accepted telemetry to Firebase Realtime Database and Blynk.

The project is intentionally **not** built as a collection of buzzwords. It uses one Node.js service, one React client, Server-Sent Events, Docker, and an optional lightweight local persistence layer because those components fit the actual problem. The architecture documents the point at which PostgreSQL, a durable queue, or shared pub/sub would become justified.

> Public demo URL will be added after deployment. A deterministic `DEMO_MODE` is included so the deployed dashboard remains useful without physical hardware.

## Why this project exists

A basic crop-monitoring demo often stops at “read a sensor and draw a chart.” Fieldline treats the same idea as an engineering system:

- validate untrusted device telemetry at the boundary;
- keep third-party integrations off the ingestion critical path;
- expose live updates without unnecessary WebSocket complexity;
- separate liveness, readiness, and operational metrics;
- protect writes with device authentication and rate limits;
- provide a clean public demo even when an ESP32 is not connected;
- document failure modes and the next realistic scaling step.

## Features

### Telemetry and domain logic

- ESP32/simulator ingestion for soil moisture, temperature, humidity, battery, GPS, device ID, and timestamp.
- Strict range validation and normalization.
- Interpretable crop-health scoring with component scores.
- Rule-based irrigation recommendations and alert generation.
- Device inventory, filtered historical windows, and current-state dashboard payloads.
- Optional append-only JSONL persistence for restart-safe local demonstrations.

### Real-time product experience

- Server-Sent Events (SSE) for live browser updates.
- Automatic SSE reconnect plus periodic HTTP fallback refresh.
- Responsive React dashboard with loading, empty, reconnecting, and error states.
- Device selection, historical sparklines, active alert states, component-score visibility, and CSV export.
- Accessible semantic controls, focus states, reduced-motion support, and mobile layouts.

### Reliability, security, and observability

- Optional `X-Device-Key` authentication for telemetry producers.
- Per-IP ingestion/read rate limiting.
- Request size limits and JSON-only write endpoints.
- Origin allowlist for cross-origin browser clients.
- Security headers and restrictive Content Security Policy in the production app.
- Structured JSON request logs with request IDs and request timing.
- `/health`, `/ready`, and Prometheus-compatible `/metrics` endpoints.
- Bounded background integration queue with retry/backoff for Firebase/Blynk.
- Graceful SIGTERM/SIGINT shutdown.

### Engineering workflow

- Node built-in unit/integration tests.
- Multi-stage production Docker image.
- Docker Compose setup with persistent local volume and simulator.
- Render deployment blueprint.
- GitHub Actions CI that checks backend syntax, runs tests, builds the React app, and builds the Docker image.
- Architecture, API, security, interview, and resume documentation.

## Architecture

```mermaid
flowchart LR
    ESP[ESP32] -->|HTTPS + device key| API[Node.js API v1]
    SIM[Simulator] -->|HTTPS + device key| API
    DEMO[Demo feed] --> API
    API --> VAL[Validation + scoring]
    VAL --> STORE[Reading repository]
    STORE --> JSONL[(Optional JSONL)]
    VAL --> SSE[SSE stream]
    SSE --> UI[React dashboard]
    VAL --> Q[Background integration queue]
    Q --> FB[Firebase]
    Q --> BL[Blynk]
    API --> OPS[/health /ready /metrics]
```

Detailed design and tradeoffs: [`docs/architecture.md`](docs/architecture.md)

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js 22, native HTTP server |
| Frontend | React 19, Vite 7 |
| Real-time | Server-Sent Events |
| Edge/IoT | ESP32, DHT22, capacitive soil sensor, TinyGPSPlus |
| Persistence | Bounded in-memory repository + optional JSONL |
| Integrations | Firebase Realtime Database, Blynk IoT |
| Containerization | Docker, Docker Compose |
| CI | GitHub Actions |
| Deployment target | Render Docker web service |

## Repository structure

```text
.
├── backend/
│   ├── app.mjs                 # HTTP routing and API behavior
│   ├── config.mjs              # environment configuration
│   ├── server.mjs              # runtime wiring and lifecycle
│   ├── lib/
│   │   ├── demo.mjs            # deterministic demo telemetry
│   │   ├── http.mjs            # HTTP/security helpers
│   │   ├── integration-queue.mjs
│   │   ├── integrations.mjs
│   │   ├── logger.mjs
│   │   ├── metrics.mjs         # crop/domain metrics
│   │   ├── observability.mjs   # Prometheus exposition
│   │   ├── rate-limit.mjs
│   │   ├── store.mjs
│   │   ├── stream.mjs
│   │   └── validation.mjs
│   └── test/
├── frontend/
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── api.js
│       └── App.jsx
├── firmware/
├── simulator/
├── docs/
├── .github/workflows/ci.yml
├── Dockerfile
├── docker-compose.yml
└── render.yaml
```

## Quick start

### Requirements

- Node.js 22+
- npm 10+

### 1. Install

```bash
npm install
```

### 2. Configure

PowerShell:

```powershell
Copy-Item .env.example .env
```

For local development you can leave `DEVICE_API_KEY` empty. Before a public deployment, set it to a long random secret through the hosting platform; do not commit it.

### 3. Start the API

PowerShell:

```powershell
$env:CORS_ORIGINS="http://localhost:5173"
$env:DATA_FILE="./data/readings.jsonl"
npm run api
```

### 4. Start the dashboard

In another terminal:

```powershell
npm --workspace frontend run dev
```

Open `http://localhost:5173`.

### 5. Generate telemetry

In another terminal:

```powershell
npm run simulate
```

If you configured `DEVICE_API_KEY`, also set the same value in the simulator terminal:

```powershell
$env:DEVICE_API_KEY="your-local-device-key"
npm run simulate
```

## Public demo mode

For a public recruiter-facing deployment without hardware:

```powershell
$env:DEMO_MODE="true"
$env:DEMO_INTERVAL_MS="5000"
npm run api
```

The server seeds a deterministic history and emits new realistic telemetry. This is explicitly demo data and is not presented as real field measurements.

## API

Versioned base path: `/api/v1`

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/readings` | Ingest validated telemetry |
| `GET` | `/api/v1/readings` | Retrieve filtered telemetry history |
| `GET` | `/api/v1/dashboard` | Current state, trends, metrics, history |
| `GET` | `/api/v1/devices` | Latest state per device |
| `GET` | `/api/v1/stream` | SSE live-update channel |
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness and queue/store state |
| `GET` | `/metrics` | Prometheus-compatible metrics |

Full API details: [`docs/api.md`](docs/api.md)

Example telemetry:

```json
{
  "deviceId": "nitkkr-field-01",
  "timestamp": "2026-09-19T10:00:00Z",
  "sensors": {
    "soilMoisture": 44.2,
    "temperature": 28.1,
    "humidity": 63,
    "battery": 91
  },
  "gps": {
    "latitude": 29.9695,
    "longitude": 76.8783
  }
}
```

## Testing

```bash
npm test
npm run test:coverage
npm run check
```

The suite covers domain scoring, validation, future-timestamp rejection, repository persistence/filtering/capacity, rate limiting, authentication, ingestion, dashboard reads, device inventory, operational endpoints, Prometheus output, and legacy API compatibility.

## Docker

### Single production image

```bash
docker build -t fieldline .
docker run --rm -p 8080:8080 -e DEMO_MODE=true fieldline
```

Open `http://localhost:8080`. The Node service serves both the API and the production React build.

### Full local stack with simulator

PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open `http://localhost:8080`.

Docker Compose mounts a named volume for `DATA_FILE` and runs the telemetry simulator as a separate service.

## Deployment

### Recommended: Render

Render is appropriate for this project because it can build the included Dockerfile, run one web service, expose an HTTPS URL, configure environment variables securely, and use `/health` for service health checks. The architecture does not need separate frontend/backend hosting in production.

A `render.yaml` blueprint is included.

For a portfolio demo set:

```text
NODE_ENV=production
DEMO_MODE=true
DEVICE_API_KEY=<generate a long secret in Render>
```

Do **not** paste Firebase, Blynk, Wi-Fi, or device secrets into source code or the README. Add them through Render's environment settings only if you need those integrations.

After deployment, verify:

```text
https://<your-service>.onrender.com/health
https://<your-service>.onrender.com/ready
https://<your-service>.onrender.com/metrics
```

Then open the root URL and confirm live demo readings continue to update.

## CI/CD

`.github/workflows/ci.yml` runs on pushes to `main` and pull requests. It:

1. installs exact top-level dependency versions declared by the repository;
2. runs syntax checks and backend tests;
3. builds the React production bundle;
4. separately verifies that the production Docker image builds.

Actual production deployment is intentionally not automatic until hosting secrets and the deployment target are configured.

## Security

See [`SECURITY.md`](SECURITY.md).

Important boundaries:

- `.env`, JSONL telemetry data, logs, IDE files, build output, and `node_modules` are ignored.
- The public portfolio dashboard is read-only, while writes can require `X-Device-Key`.
- A real multi-user agricultural deployment should add authenticated user accounts/authorization before exposing private location data.
- A shared device key is a portfolio-safe baseline, not the final credential model for a large device fleet.

## Performance and scalability

The current design deliberately targets a single small deployment. It avoids unnecessary distributed infrastructure.

The first justified scaling changes would be:

1. PostgreSQL/TimescaleDB with an index on `(device_id, timestamp)` for durable history.
2. A durable outbox/queue if Firebase/Blynk mirroring becomes business-critical.
3. Shared pub/sub only when multiple API replicas need to fan out live events.
4. Retention/downsampling when historical telemetry becomes large.

No throughput or latency claims are included because a repeatable load benchmark has not yet been run.

## Engineering decisions

- **SSE over WebSockets:** the dashboard only needs server-to-browser updates.
- **Rules over unverified ML:** crop recommendations remain explainable until calibrated training data exists.
- **Repository abstraction over immediate database complexity:** keeps local setup simple while preserving a clean migration path.
- **Background integration queue:** external APIs cannot hold the telemetry ingestion path hostage.
- **Single production container:** simplest reliable public deployment for the current scale.

## Interview preparation

Truthful architecture/scalability/security answers based on the actual implementation are in [`docs/interview-guide.md`](docs/interview-guide.md).

## Resume description

Resume-ready bullets are in [`docs/resume-bullets.md`](docs/resume-bullets.md).

## Known limitations / future work

- Replace shared ingestion key with per-device credentials and rotation.
- Replace JSONL with PostgreSQL/TimescaleDB before horizontal scaling.
- Add a durable integration outbox if mirror delivery guarantees become important.
- Calibrate crop thresholds by crop/soil type using validated agronomic data.
- Add authenticated user roles if the dashboard moves beyond a public portfolio demo.
- Add a repeatable load-test profile before making performance claims.

## License

MIT © 2026 Aryan Rahar
