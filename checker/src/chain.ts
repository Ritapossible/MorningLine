// Everything the checker knows comes from the contract's logs and state. There is no database.
import type { Address, PublicClient, WalletClient } from "viem";
import { decodeEventLog, getAddress } from "viem";
import { DayStatus, morningLineAbi } from "./abi.ts";
import type { Spec } from "./check.ts";

/// Public RPC endpoints cap eth_getLogs hard: Base's public Sepolia endpoint allows a 200 block
/// range and answers 413 above it. Default inside that; a paid endpoint can raise it.
export const DEFAULT_LOG_CHUNK = 200n;

export type Deal = {
  dealId: bigint;
  checker: Address;
  dayCount: number;
  start: bigint;
  spec: Spec | undefined;
  settled: Set<number>;
};

/// Accumulated deal state plus how far the log scan has got.
export type Scanner = { deals: Map<string, Deal>; cursor: bigint; chunk: bigint };

export function newScanner(startBlock: bigint, chunk: bigint = DEFAULT_LOG_CHUNK): Scanner {
  return { deals: new Map(), cursor: startBlock, chunk };
}

/// Read the logs between the cursor and `toBlock`, folding them into the deal set.
///
/// Only new blocks are read, so a long-lived process does not replay the whole history every
/// loop. The cursor advances one chunk at a time and only after that chunk succeeded, so a
/// failed request is simply retried next loop with nothing skipped. A restart rescans from
/// START_BLOCK and reaches the same state, it just costs more requests once.
export async function scan(
  s: Scanner,
  client: PublicClient,
  address: Address,
  toBlock: bigint,
): Promise<Map<string, Deal>> {
  while (s.cursor <= toBlock) {
    const last = s.cursor + s.chunk - 1n;
    const end = last > toBlock ? toBlock : last;
    const logs = await client.getLogs({ address, fromBlock: s.cursor, toBlock: end });

    for (const log of logs) {
      const parsed = tryDecode(log);
      if (parsed === null) continue;
      apply(s.deals, parsed);
    }
    s.cursor = end + 1n;
  }
  return s.deals;
}

type Decoded =
  | { kind: "opened"; dealId: bigint; checker: Address; dayCount: number; start: bigint }
  | { kind: "spec"; dealId: bigint; spec: Spec }
  | { kind: "settled"; dealId: bigint; day: number };

function tryDecode(log: { topics: readonly `0x${string}`[]; data: `0x${string}` }): Decoded | null {
  let ev;
  try {
    ev = decodeEventLog({ abi: morningLineAbi, topics: log.topics as never, data: log.data });
  } catch {
    return null; // an event we do not care about
  }

  if (ev.eventName === "DealOpened") {
    const a = ev.args as { dealId: bigint; checker: Address; dayCount: number; start: number };
    return {
      kind: "opened",
      dealId: a.dealId,
      checker: getAddress(a.checker),
      dayCount: Number(a.dayCount),
      start: BigInt(a.start),
    };
  }
  if (ev.eventName === "DealSpec") {
    const a = ev.args as { dealId: bigint; repo: string; branch: string; path: string; line: string };
    return { kind: "spec", dealId: a.dealId, spec: { repo: a.repo, branch: a.branch, path: a.path, line: a.line } };
  }
  if (ev.eventName === "DayReported" || ev.eventName === "DayReclaimed") {
    const a = ev.args as { dealId: bigint; day: bigint };
    return { kind: "settled", dealId: a.dealId, day: Number(a.day) };
  }
  return null;
}

function apply(deals: Map<string, Deal>, d: Decoded): void {
  const id = d.dealId.toString();
  if (d.kind === "opened") {
    const existing = deals.get(id);
    deals.set(id, {
      dealId: d.dealId,
      checker: d.checker,
      dayCount: d.dayCount,
      start: d.start,
      spec: existing?.spec,
      settled: existing?.settled ?? new Set<number>(),
    });
    return;
  }
  const deal = deals.get(id);
  if (deal === undefined) return;
  if (d.kind === "spec") deal.spec = d.spec;
  else deal.settled.add(d.day);
}

/// Days of this deal that are still open and whose report window has not closed.
export function openDays(
  deal: Deal,
  now: bigint,
  dayLength: bigint,
  reportGrace: bigint,
): { day: number; opens: bigint; closes: bigint }[] {
  const out: { day: number; opens: bigint; closes: bigint }[] = [];
  for (let day = 0; day < deal.dayCount; day++) {
    if (deal.settled.has(day)) continue;
    const opens = deal.start + BigInt(day) * dayLength;
    const closes = opens + dayLength + reportGrace;
    if (now >= opens && now < closes) out.push({ day, opens, closes });
  }
  return out;
}

/// Read the day's status straight from state. Reports are idempotent retries, so this is checked
/// immediately before sending: a day settled since the log scan must not be reported again.
export async function isStillOpen(
  client: PublicClient,
  address: Address,
  dealId: bigint,
  day: number,
): Promise<boolean> {
  const status = await client.readContract({
    address,
    abi: morningLineAbi,
    functionName: "dayStatus",
    args: [dealId, BigInt(day)],
  });
  return Number(status) === DayStatus.Open;
}

export async function sendReport(
  wallet: WalletClient,
  client: PublicClient,
  address: Address,
  dealId: bigint,
  day: number,
  present: boolean,
  sha: `0x${string}`,
): Promise<`0x${string}`> {
  const account = wallet.account;
  if (account === undefined) throw new Error("wallet has no account");

  const { request } = await client.simulateContract({
    account,
    address,
    abi: morningLineAbi,
    functionName: "report",
    args: [dealId, BigInt(day), present, sha],
  });
  return await wallet.writeContract(request);
}
