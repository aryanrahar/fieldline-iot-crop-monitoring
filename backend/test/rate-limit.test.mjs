import assert from "node:assert/strict";
import test from "node:test";
import { FixedWindowRateLimiter } from "../lib/rate-limit.mjs";

test("rate limiter rejects requests above the configured window", () => {
  let now = 0;
  const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 1000, clock: () => now });
  assert.equal(limiter.check("client").allowed, true);
  assert.equal(limiter.check("client").allowed, true);
  assert.equal(limiter.check("client").allowed, false);
  now = 1001;
  assert.equal(limiter.check("client").allowed, true);
});
