# Security Notes

## Secrets

Never commit `.env`, Firebase credentials, Blynk tokens, Wi-Fi passwords, or device keys. Use `.env.example` only as a template and configure real values in the deployment platform's secret/environment settings.

## Current controls

- Optional device-key authentication on telemetry ingestion.
- Input validation and request-size limits.
- Per-IP rate limiting.
- Strict cross-origin allowlist when a separate frontend origin is configured.
- Security headers and a restrictive Content Security Policy on production static assets.
- Bounded background integration queue.

## Known limitations

The portfolio deployment intentionally keeps read-only dashboard endpoints public. A real deployment containing sensitive location or farm data should add user authentication and authorization. A shared device key should be replaced by per-device credentials with rotation and revocation.

## Reporting

If this repository is made public, report security issues privately to the repository owner rather than opening an issue containing credentials or exploit details.
