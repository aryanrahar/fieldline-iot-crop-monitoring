function labelsToString(labels = {}) {
  const entries = Object.entries(labels);
  if (!entries.length) return "";
  return `{${entries.map(([key, value]) => `${key}="${String(value).replaceAll('"', '\\"')}"`).join(",")}}`;
}

export class MetricsRegistry {
  constructor() {
    this.startedAt = Date.now();
    this.counters = new Map();
    this.gauges = new Map();
  }

  inc(name, labels = {}, value = 1) {
    const key = `${name}${labelsToString(labels)}`;
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  set(name, value, labels = {}) {
    this.gauges.set(`${name}${labelsToString(labels)}`, Number(value));
  }

  render() {
    const lines = [
      "# HELP fieldline_uptime_seconds Process uptime in seconds.",
      "# TYPE fieldline_uptime_seconds gauge",
      `fieldline_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`
    ];
    for (const [key, value] of this.counters) lines.push(`${key} ${value}`);
    for (const [key, value] of this.gauges) lines.push(`${key} ${value}`);
    return `${lines.join("\n")}\n`;
  }
}
