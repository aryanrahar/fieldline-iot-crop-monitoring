import React from "react";

export default function Sparkline({ values, label }) {
  if (values.length < 2) return <div className="empty-line">Waiting for telemetry</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * 100},${42 - ((value - min) / span) * 36}`)
    .join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 46" preserveAspectRatio="none" role="img" aria-label={`${label} trend`}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
