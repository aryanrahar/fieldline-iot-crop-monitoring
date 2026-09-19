# API Reference

Base path: `/api/v1`

## Authentication

When `DEVICE_API_KEY` is configured, telemetry producers must send:

```http
X-Device-Key: <configured value>
```

The dashboard read endpoints are public in the portfolio build. Do not expose sensitive field data without adding user authentication.

## POST `/readings`

Accepts one telemetry sample.

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

Successful response: `201 Created` with the normalized reading, derived crop metrics, and integration queue status.

Common errors: `401`, `413`, `415`, `422`, `429`.

## GET `/dashboard`

Query parameters:

- `deviceId` — optional exact device filter.
- `limit` — 1–500, defaults to 120.
- `before` — optional ISO-8601 exclusive upper timestamp.
- `after` — optional ISO-8601 inclusive lower timestamp.

Returns the current reading, crop metrics, window deltas, and history.

## GET `/readings`

Same filters as `/dashboard`. Returns `{ count, readings }`.

## GET `/devices`

Returns the latest observed state for every device in the bounded repository.

## GET `/stream`

Server-Sent Events endpoint. Optional `deviceId` filter. Events:

- `connected`
- `reading`

## Operational endpoints

- `/health` — liveness.
- `/ready` — readiness and queue/store state.
- `/metrics` — Prometheus text exposition.
