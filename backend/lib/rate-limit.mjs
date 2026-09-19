export class FixedWindowRateLimiter {
  constructor({ limit, windowMs = 60000, clock = () => Date.now() }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
    this.entries = new Map();
  }

  check(key) {
    const now = this.clock();
    let entry = this.entries.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.entries.set(key, entry);
    }
    entry.count += 1;
    return {
      allowed: entry.count <= this.limit,
      limit: this.limit,
      remaining: Math.max(0, this.limit - entry.count),
      resetAt: entry.resetAt
    };
  }

  prune() {
    const now = this.clock();
    for (const [key, entry] of this.entries) {
      if (now >= entry.resetAt) this.entries.delete(key);
    }
  }
}
