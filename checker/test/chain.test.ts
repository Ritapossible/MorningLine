import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Address, PublicClient } from "viem";
import { DEFAULT_LOG_CHUNK, newScanner, openDays, scan } from "../src/chain.ts";

const ADDRESS = "0x000000000000000000000000000000000000beef" as Address;

/// Stands in for an RPC that rejects ranges wider than `limit`, the way Base's public Sepolia
/// endpoint answers 413 above 200 blocks.
function fakeClient(limit: bigint, failAt?: bigint) {
  const calls: { from: bigint; to: bigint }[] = [];
  const client = {
    getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      if (toBlock - fromBlock + 1n > limit) {
        throw new Error(`eth_getLogs is limited to a ${limit} range`);
      }
      if (failAt !== undefined && fromBlock === failAt) throw new Error("transient RPC failure");
      calls.push({ from: fromBlock, to: toBlock });
      return [];
    },
  } as unknown as PublicClient;
  return { client, calls };
}

describe("scan", () => {
  it("never asks for more blocks than the chunk allows", async () => {
    const { client, calls } = fakeClient(200n);
    const s = newScanner(1_000n, DEFAULT_LOG_CHUNK);
    await scan(s, client, ADDRESS, 1_999n);
    for (const c of calls) {
      assert.ok(c.to - c.from + 1n <= 200n, `range ${c.from}..${c.to} exceeds the cap`);
    }
  });

  it("covers the whole span with no gaps and no overlap", async () => {
    const { client, calls } = fakeClient(200n);
    const s = newScanner(1_000n, 200n);
    await scan(s, client, ADDRESS, 1_999n);
    assert.equal(calls[0]?.from, 1_000n);
    assert.equal(calls[calls.length - 1]?.to, 1_999n);
    for (let i = 1; i < calls.length; i++) {
      assert.equal(calls[i]!.from, calls[i - 1]!.to + 1n, "gap or overlap between chunks");
    }
  });

  it("does not re-read old blocks on the next loop", async () => {
    const { client, calls } = fakeClient(200n);
    const s = newScanner(1_000n, 200n);
    await scan(s, client, ADDRESS, 1_199n);
    const afterFirst = calls.length;
    await scan(s, client, ADDRESS, 1_399n);
    assert.equal(calls.length, afterFirst + 1, "second loop should read one new chunk only");
    assert.equal(calls[afterFirst]?.from, 1_200n);
  });

  it("does nothing when no new blocks have arrived", async () => {
    const { client, calls } = fakeClient(200n);
    const s = newScanner(1_000n, 200n);
    await scan(s, client, ADDRESS, 1_099n);
    const afterFirst = calls.length;
    await scan(s, client, ADDRESS, 1_099n);
    assert.equal(calls.length, afterFirst);
  });

  it("leaves the cursor on a failed chunk so nothing is skipped", async () => {
    const { client } = fakeClient(200n, 1_200n);
    const s = newScanner(1_000n, 200n);
    await assert.rejects(() => scan(s, client, ADDRESS, 1_399n));
    assert.equal(s.cursor, 1_200n, "cursor must not advance past the chunk that failed");
  });
});

describe("openDays", () => {
  const deal = {
    dealId: 1n,
    checker: ADDRESS,
    dayCount: 3,
    start: 1_000n,
    spec: undefined,
    settled: new Set<number>(),
  };

  it("offers only days whose window is open", () => {
    // 180s days, 120s grace: day 0 is [1000, 1300), day 1 is [1180, 1480).
    const days = openDays({ ...deal }, 1_200n, 180n, 120n).map((d) => d.day);
    assert.deepEqual(days, [0, 1]);
  });

  it("skips days already settled", () => {
    const d = { ...deal, settled: new Set([0]) };
    assert.deepEqual(openDays(d, 1_200n, 180n, 120n).map((x) => x.day), [1]);
  });

  it("offers nothing before the deal starts", () => {
    assert.deepEqual(openDays({ ...deal }, 999n, 180n, 120n), []);
  });

  it("offers nothing once every window has closed", () => {
    assert.deepEqual(openDays({ ...deal }, 99_999n, 180n, 120n), []);
  });
});
