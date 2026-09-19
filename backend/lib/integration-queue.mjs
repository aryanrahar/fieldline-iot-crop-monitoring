import { syncExternalServices } from "./integrations.mjs";

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export class IntegrationQueue {
  constructor({ config, logger, metrics, maxSize = 500, retries = 2 }) {
    this.config = config;
    this.logger = logger;
    this.metrics = metrics;
    this.maxSize = maxSize;
    this.retries = retries;
    this.queue = [];
    this.running = false;
  }

  enqueue(reading, readingMetrics) {
    if (this.queue.length >= this.maxSize) {
      this.metrics?.inc("fieldline_integration_jobs_dropped_total");
      this.logger?.warn("Integration queue full; dropping mirror job", { deviceId: reading.deviceId });
      return false;
    }
    this.queue.push({ reading, readingMetrics });
    this.metrics?.set("fieldline_integration_queue_depth", this.queue.length);
    void this.#drain();
    return true;
  }

  async #drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const job = this.queue.shift();
        this.metrics?.set("fieldline_integration_queue_depth", this.queue.length);
        let attempt = 0;
        while (attempt <= this.retries) {
          try {
            const results = await syncExternalServices(job.reading, job.readingMetrics, this.config);
            for (const result of results) {
              this.metrics?.inc("fieldline_integration_jobs_total", { service: result.service, status: result.ok ? "ok" : "error" });
              if (!result.ok) this.logger?.warn("External integration failed", { deviceId: job.reading.deviceId, ...result });
            }
            break;
          } catch (error) {
            attempt += 1;
            if (attempt > this.retries) {
              this.metrics?.inc("fieldline_integration_jobs_total", { service: "unknown", status: "error" });
              this.logger?.error("Integration job exhausted retries", { error: error.message, deviceId: job.reading.deviceId });
              break;
            }
            await sleep(250 * 2 ** (attempt - 1));
          }
        }
      }
    } finally {
      this.running = false;
    }
  }

  get depth() {
    return this.queue.length;
  }
}
