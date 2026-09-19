# Resume-ready project description

**Fieldline — IoT Crop Monitoring & Irrigation Decision Platform**

**Tech stack:** Node.js 22, React 19, Vite, Server-Sent Events, Docker, Firebase Realtime Database, Blynk IoT, ESP32, GitHub Actions

- Built a versioned Node.js telemetry API and responsive React dashboard for ESP32 crop sensors, with validated ingestion, interpretable crop-health scoring, irrigation alerts, device filtering, historical trends, and CSV export.
- Added real-time Server-Sent Events, bounded JSONL persistence, a non-blocking retry queue for Firebase/Blynk mirroring, request IDs, structured logs, rate limiting, device-key authentication, and Prometheus-compatible health/metrics endpoints.
- Containerized the application as a single multi-stage Docker deployment, added deterministic demo telemetry, automated tests and GitHub Actions CI, and documented scaling tradeoffs without introducing unnecessary distributed infrastructure.

No throughput or latency metrics are claimed because they have not yet been benchmarked under a defined load test.
