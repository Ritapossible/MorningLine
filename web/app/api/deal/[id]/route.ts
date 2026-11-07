// The spec strings and the commit hashes live in events, not in storage, so they come from
// logs. Public RPC endpoints cap eth_getLogs ranges (Base's public Sepolia endpoint allows
// about 200 blocks), so a deal more than a few minutes old cannot be found by scanning
// backwards from the head.
//
// Instead, find the exact blocks first, using contract state, then read logs from those
// single blocks:
//
// - The deal was opened in the first block where dealCount >= id. dealCount only grows, so a
//   binary search over block numbers finds it in about 25 reads.
// - A day was settled in the first block where dayStatus(id, day) != Open. A day leaves Open
//   once and never returns, so the same search finds that block too.
//
// Each search step for every day goes out in one batched JSON-RPC request. What is settled
// can never change, so found blocks and logs are cached for the life of the server instance.
// This needs an RPC that serves historical state; Base's public endpoints do.
import { NextResponse } from "next/server";
import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  createPublicClient,
  http,
  parseAbiItem,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { CHAIN_ID, DayStatus, MORNINGLINE, morningLineAbi } from "../../../../lib/contracts";

export const revalidate = 5;

const chain = CHAIN_ID === base.id ? base : baseSepolia;

const client = createPublicClient({
  chain,
  transport: http(process.env.RPC_URL, { batch: { batchSize: 100, wait: 10 } }),
});

/// Where to start searching. Any block at or before the deployment works; a hint past the
/// deployment is detected and ignored.
const START_HINT = BigInt(process.env.NEXT_PUBLIC_START_BLOCK ?? "55642039");

const SPEC = parseAbiItem(
  "event DealSpec(uint256 indexed dealId, string repo, string branch, string path, string line)",
);
const REPORTED = parseAbiItem(
  "event DayReported(uint256 indexed dealId, uint256 indexed day, bool present, bytes20 commitSha, bytes32 fileHash)",
);
const RECLAIMED = parseAbiItem("event DayReclaimed(uint256 indexed dealId, uint256 indexed day)");

type Spec = { repo: string; branch: string; path: string; line: string };
type Report = {
  day: number;
  present: boolean | null;
  sha: string | null;
  /// keccak256 of the file text the checker read; null for a reclaimed day.
  fileHash: string | null;
  tx: string;
};

/// Settled facts, keyed by `${address}:${dealId}` and `${address}:${dealId}:${day}`.
const openedAt = new Map<string, bigint>();
const specCache = new Map<string, Spec>();
const reportCache = new Map<string, Report>();

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let dealId: bigint;
  try {
    dealId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "bad deal id" }, { status: 400 });
  }
  if (dealId <= 0n) return NextResponse.json({ error: "bad deal id" }, { status: 400 });

  const latest = await client.getBlockNumber();
  const deal = await client.readContract({
    address: MORNINGLINE, abi: morningLineAbi, functionName: "getDeal", args: [dealId],
    blockNumber: latest,
  });
  if (deal.buyer === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({ error: "no such deal" }, { status: 404 });
  }

  const key = `${MORNINGLINE}:${dealId}`;
  let incomplete = false;

  // 1. The block the deal was opened in, and its spec.
  let opened = openedAt.get(key);
  if (opened === undefined) {
    opened = await openingBlock(dealId, latest);
    openedAt.set(key, opened);
  }

  let spec = specCache.get(key) ?? null;
  if (spec === null) {
    const logs = await client.getLogs({
      address: MORNINGLINE, event: SPEC, args: { dealId }, fromBlock: opened, toBlock: opened,
    });
    const a = logs[0]?.args;
    if (a?.repo !== undefined && a.branch !== undefined && a.path !== undefined && a.line !== undefined) {
      spec = { repo: a.repo, branch: a.branch, path: a.path, line: a.line };
      specCache.set(key, spec);
    } else {
      incomplete = true;
    }
  }

  // 2. Which days are settled now, and the block each one was settled in.
  const days = Array.from({ length: Number(deal.dayCount) }, (_, d) => d);
  const statuses = await Promise.all(
    days.map((d) =>
      client.readContract({
        address: MORNINGLINE, abi: morningLineAbi, functionName: "dayStatus",
        args: [dealId, BigInt(d)], blockNumber: latest,
      }),
    ),
  );
  const settled = days.filter((d) => statuses[d] !== DayStatus.Open);
  const missing = settled.filter((d) => !reportCache.has(`${key}:${d}`));

  if (missing.length > 0) {
    const blocks = await settlementBlocks(dealId, missing, opened, latest);
    const byBlock = new Map<bigint, number[]>();
    missing.forEach((d, i) => byBlock.set(blocks[i], [...(byBlock.get(blocks[i]) ?? []), d]));

    await Promise.all(
      [...byBlock.keys()].map(async (b) => {
        const [reported, reclaimed] = await Promise.all([
          client.getLogs({ address: MORNINGLINE, event: REPORTED, args: { dealId }, fromBlock: b, toBlock: b }),
          client.getLogs({ address: MORNINGLINE, event: RECLAIMED, args: { dealId }, fromBlock: b, toBlock: b }),
        ]);
        for (const l of reported) {
          if (l.args.day === undefined) continue;
          reportCache.set(`${key}:${Number(l.args.day)}`, {
            day: Number(l.args.day),
            present: l.args.present ?? false,
            sha: l.args.commitSha ?? null,
            fileHash: l.args.fileHash ?? null,
            tx: l.transactionHash ?? "",
          });
        }
        for (const l of reclaimed) {
          if (l.args.day === undefined) continue;
          reportCache.set(`${key}:${Number(l.args.day)}`, {
            day: Number(l.args.day), present: null, sha: null, fileHash: null, tx: l.transactionHash ?? "",
          });
        }
      }),
    );
  }

  const reports: Report[] = [];
  for (const d of settled) {
    const r = reportCache.get(`${key}:${d}`);
    if (r) reports.push(r);
    else incomplete = true;
  }

  return NextResponse.json({
    dealId: dealId.toString(),
    spec,
    reports,
    openedBlock: opened.toString(),
    /// True only if the spec or a settled day's log could not be read. The day colours come
    /// from contract state and are complete either way.
    truncated: incomplete,
  });
}

/// The first block where dealCount >= dealId. Before deployment the call reverts, which
/// counts as zero deals.
async function openingBlock(dealId: bigint, latest: bigint): Promise<bigint> {
  const countAt = (b: bigint) =>
    client
      .readContract({ address: MORNINGLINE, abi: morningLineAbi, functionName: "dealCount", blockNumber: b })
      .catch(ifReverted(0n));

  let lo = 0n;
  if (START_HINT > 0n && START_HINT < latest && (await countAt(START_HINT)) < dealId) lo = START_HINT;
  let hi = latest; // getDeal at `latest` found the deal, so dealCount(latest) >= dealId.
  // The answer is in (lo, hi].
  while (hi - lo > 1n) {
    const mid = (lo + hi) / 2n;
    if ((await countAt(mid)) >= dealId) hi = mid;
    else lo = mid;
  }
  return hi;
}

/// For each day, the first block where its status is no longer Open. All days are searched in
/// lockstep, so each step is one batched request however many days there are. The search
/// starts one block before the deal existed, where dayStatus reverts, which counts as Open.
async function settlementBlocks(
  dealId: bigint, days: number[], opened: bigint, latest: bigint,
): Promise<bigint[]> {
  const lo = days.map(() => opened - 1n);
  const hi = days.map(() => latest);
  for (;;) {
    const active = days.map((_, i) => i).filter((i) => hi[i] - lo[i] > 1n);
    if (active.length === 0) break;
    const mids = active.map((i) => (lo[i] + hi[i]) / 2n);
    const results = await Promise.all(
      active.map((i, j) =>
        client
          .readContract({
            address: MORNINGLINE, abi: morningLineAbi, functionName: "dayStatus",
            args: [dealId, BigInt(days[i])], blockNumber: mids[j],
          })
          .catch(ifReverted<number>(DayStatus.Open)),
      ),
    );
    active.forEach((i, j) => {
      if (results[j] !== DayStatus.Open) hi[i] = mids[j];
      else lo[i] = mids[j];
    });
  }
  return hi;
}

/// A revert, or empty data from a block before the contract was deployed, means "no such deal
/// at that block". Anything else, like a rate limit, is rethrown
/// rather than read as an answer, because a wrong answer would send the search the wrong way.
function ifReverted<T>(value: T) {
  return (e: unknown): T => {
    if (e instanceof BaseError && e.walk((x) => x instanceof ContractFunctionRevertedError || x instanceof ContractFunctionZeroDataError)) return value;
    throw e;
  };
}
