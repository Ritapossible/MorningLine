import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkAt, checkOffset, isDue } from "../src/schedule.ts";

const SEED = `0x${"11".repeat(32)}` as const;
const DAY = 86_400n;
const GRACE = 172_800n;

describe("checkOffset", () => {
  it("always lands inside the day", () => {
    for (let day = 0n; day < 50n; day++) {
      const o = checkOffset(SEED, 1n, day, DAY);
      assert.ok(o >= 0n && o < DAY, `offset ${o} outside [0, ${DAY})`);
    }
  });

  it("is deterministic for the same inputs", () => {
    assert.equal(checkOffset(SEED, 7n, 3n, DAY), checkOffset(SEED, 7n, 3n, DAY));
  });

  it("differs across days, deals and seeds", () => {
    const base = checkOffset(SEED, 1n, 1n, DAY);
    assert.notEqual(base, checkOffset(SEED, 1n, 2n, DAY));
    assert.notEqual(base, checkOffset(SEED, 2n, 1n, DAY));
    assert.notEqual(base, checkOffset(`0x${"22".repeat(32)}`, 1n, 1n, DAY));
  });

  it("spreads across the day rather than clustering", () => {
    const buckets = new Set<bigint>();
    for (let day = 0n; day < 40n; day++) {
      buckets.add(checkOffset(SEED, 1n, day, DAY) / (DAY / 8n));
    }
    assert.ok(buckets.size >= 5, `offsets clustered into ${buckets.size} of 8 buckets`);
  });

  it("works with the 180 second demo day", () => {
    const o = checkOffset(SEED, 1n, 0n, 180n);
    assert.ok(o >= 0n && o < 180n);
  });
});

describe("isDue", () => {
  const opens = 1_000_000n;
  const closes = opens + DAY + GRACE;

  it("is not due before the check minute", () => {
    const due = checkAt(SEED, 1n, 0n, opens, DAY);
    assert.equal(isDue(due - 1n, due, closes), false);
  });

  it("is due at the check minute", () => {
    const due = checkAt(SEED, 1n, 0n, opens, DAY);
    assert.equal(isDue(due, due, closes), true);
  });

  it("stays due through the grace period, so an outage can be caught up", () => {
    const due = checkAt(SEED, 1n, 0n, opens, DAY);
    assert.equal(isDue(closes - 1n, due, closes), true);
  });

  it("is not due once the window has closed", () => {
    const due = checkAt(SEED, 1n, 0n, opens, DAY);
    assert.equal(isDue(closes, due, closes), false);
  });
});
