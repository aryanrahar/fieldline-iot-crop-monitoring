import React from "react";
import Sparkline from "./Sparkline.jsx";

export default function MetricCard({ label, value, unit, trend = 0, values = [], tone = "green" }) {
  const direction = trend > 0 ? "up" : trend < 0 ? "down" : "flat";
  return (
    <article className={`metric-card card tone-${tone}`}>
      <div className="metric-head">
        <span className="eyebrow">{label}</span>
        <span className={`trend ${direction}`}>{trend > 0 ? "+" : ""}{trend} window</span>
      </div>
      <div className="reading">{value ?? "—"}<span>{value != null ? unit : ""}</span></div>
      <Sparkline values={values} label={label} />
    </article>
  );
}
