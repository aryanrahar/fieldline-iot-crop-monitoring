import React, { useMemo, useState } from "react";
import MetricCard from "./components/MetricCard.jsx";
import { useTelemetry } from "./hooks/useTelemetry.js";

function formatTime(timestamp) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(timestamp));
}

function downloadCsv(readings) {
  if (!readings.length) return;
  const rows = [
    ["timestamp", "deviceId", "soilMoisture", "temperature", "humidity", "battery", "latitude", "longitude"],
    ...readings.map(item => [
      item.timestamp,
      item.deviceId,
      item.sensors.soilMoisture,
      item.sensors.temperature,
      item.sensors.humidity,
      item.sensors.battery,
      item.gps?.latitude ?? "",
      item.gps?.longitude ?? ""
    ])
  ];
  const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `fieldline-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function Skeleton() {
  return <div className="skeleton-grid" aria-label="Loading dashboard"><div /><div /><div /></div>;
}

export default function App() {
  const [deviceId, setDeviceId] = useState("");
  const { data, devices, status, error, refresh } = useTelemetry(deviceId);
  const current = data.current;
  const metrics = data.metrics;
  const series = useMemo(() => ({
    soil: data.readings.map(item => item.sensors.soilMoisture),
    temperature: data.readings.map(item => item.sensors.temperature),
    humidity: data.readings.map(item => item.sensors.humidity)
  }), [data.readings]);

  const statusLabel = status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting" : status === "loading" ? "Connecting" : "Unavailable";

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="brand">FIELDLINE</div>
          <p>IoT crop telemetry and irrigation decision support</p>
        </div>
        <div className="toolbar">
          <label>
            <span className="sr-only">Select device</span>
            <select value={deviceId} onChange={event => setDeviceId(event.target.value)}>
              <option value="">All devices</option>
              {devices.map(device => <option value={device.deviceId} key={device.deviceId}>{device.deviceId}</option>)}
            </select>
          </label>
          <button type="button" className="secondary" onClick={() => downloadCsv(data.readings)} disabled={!data.readings.length}>Export CSV</button>
          <div className={`status status-${status}`} role="status" aria-live="polite"><span />{statusLabel}</div>
        </div>
      </header>

      {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={refresh}>Retry</button></div>}

      <section className="page-heading">
        <div>
          <span className="eyebrow">Field operations dashboard</span>
          <h1>Crop health at a glance</h1>
          <p>Validated sensor telemetry, transparent scoring, threshold alerts, and live field updates.</p>
        </div>
        <div className="last-update"><span>Last telemetry</span><strong>{formatTime(current?.timestamp)}</strong></div>
      </section>

      {status === "loading" && !current ? <Skeleton /> : !current ? (
        <section className="empty-state card">
          <strong>No telemetry yet</strong>
          <p>Connect the ESP32 device, start the simulator, or enable demo mode on the server.</p>
          <button type="button" onClick={refresh}>Check again</button>
        </section>
      ) : (
        <>
          <section className="summary-grid">
            <article className="health-card card">
              <div>
                <span className="eyebrow">Crop health index</span>
                <div className="health-score">{metrics?.cropHealth ?? "—"}<small>/100</small></div>
                <p>Interpretable score weighted across soil, temperature, humidity, and device battery.</p>
              </div>
              <div className="score-bars" aria-label="Health component scores">
                {Object.entries(metrics?.componentScores || {}).map(([name, score]) => (
                  <div className="score-row" key={name}>
                    <span>{name}</span><progress value={score} max="100" aria-label={`${name} score ${score} out of 100`} /><strong>{score}</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className="decision-card card">
              <span className="eyebrow">Irrigation recommendation</span>
              <strong className={`decision decision-${metrics?.irrigation.action || "hold"}`}>{metrics?.irrigation.action?.toUpperCase() || "WAIT"}</strong>
              <p>{metrics?.irrigation.reason}</p>
              <div className="decision-meta"><span>Urgency</span><b>{metrics?.irrigation.urgency || "none"}</b></div>
            </article>
          </section>

          <section className="metric-grid" aria-label="Environmental metrics">
            <MetricCard label="Soil moisture" value={current.sensors.soilMoisture} unit="%" trend={data.trends.soilMoisture} values={series.soil} tone="green" />
            <MetricCard label="Temperature" value={current.sensors.temperature} unit="°C" trend={data.trends.temperature} values={series.temperature} tone="orange" />
            <MetricCard label="Humidity" value={current.sensors.humidity} unit="%" trend={data.trends.humidity} values={series.humidity} tone="blue" />
          </section>

          <section className="detail-grid">
            <article className="card panel">
              <div className="panel-title"><div><span className="eyebrow">Active alerts</span><h2>Field conditions</h2></div><span className="count-badge">{metrics?.alerts.length || 0}</span></div>
              {metrics?.alerts.length ? (
                <div className="alert-list">{metrics.alerts.map(alert => (
                  <div className={`alert severity-${alert.severity}`} key={alert.type}><div><strong>{alert.type.replaceAll("-", " ")}</strong><p>{alert.message}</p></div><span>{alert.severity}</span></div>
                ))}</div>
              ) : <div className="good-state"><span>✓</span><div><strong>No active threshold alerts</strong><p>Current sensor values are inside configured operating bounds.</p></div></div>}
            </article>

            <article className="card panel">
              <div className="panel-title"><div><span className="eyebrow">Edge device</span><h2>Telemetry source</h2></div></div>
              <dl className="device-list">
                <div><dt>Device ID</dt><dd>{current.deviceId}</dd></div>
                <div><dt>Battery</dt><dd>{current.sensors.battery}%</dd></div>
                <div><dt>Coordinates</dt><dd>{current.gps ? `${current.gps.latitude.toFixed(4)}, ${current.gps.longitude.toFixed(4)}` : "Not reported"}</dd></div>
                <div><dt>Samples in window</dt><dd>{data.readings.length}</dd></div>
              </dl>
            </article>
          </section>
        </>
      )}
      <footer><span>Fieldline telemetry console</span><span>API v1 · SSE live updates · threshold-based decisions</span></footer>
    </main>
  );
}
