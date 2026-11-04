// The spec strings and the commit hashes live in events, not in storage, so they need a log
// scan. That belongs on the server: public RPC endpoints cap eth_getLogs ranges (Base's public
// Sepolia endpoint allows 200 blocks), and the browser should not make hundreds of requests.
//
// The scan is bounded by the deal itself, not by the deployment block: a deal's logs all fall
// between the block that opened it and now, and `start` is known from storage. Turning that
// time span into a block span needs the chain's block rate, which is measured rather than
// assumed, because it differs by an order of magnitude between Base networks.
import { NextResponse } from "next/server";
import { createPublicClient, http, parseAbiItem } from "viem";
import { base, baseSepolia } from "viem/chains";
import { CHAIN_ID, MORNINGLINE, morningLineAbi } from "../../../../lib/contracts";

export const revalidate = 5;

const chain = CHAIN_ID === base.id ? base : baseSepolia;
const CHUNK = BigInt(process.env.LOG_CHUNK_BLOCKS ?? "200");
/// A ceiling so one request cannot fan out indefinitely on a long deal.
const MAX_REQUESTS = 60n;
/// Slack for the gap between opening a deal and its first day beginning.
const MARGIN_SECONDS = 180n;

const client = createPublicClient({ chain, transport: http(process.env.RPC_URL) });

const SPEC = parseAbiItem(
  "event DealSpec(uint256 indexed dealId, string repo, string branch, string path, string line)",
);
const REPORTED = parseAbiItem(
  "event DayReported(uint256 indexed dealId, uint256 indexed day, bool present, bytes20 commitSha)",
);
const RECLAIMED = parseAbiItem("event DayReclaimed(uint256 indexed dealId, uint256 indexed day)");

type Report = { day: number; present: boolean | null; sha: string | null; tx: string };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let dealId: bigint;
  try {
    dealId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "bad deal id" }, { status: 400 });
  }

  const deal = await client.readContract({
    address: MORNINGLINE, abi: morningLineAbi, functionName: "getDeal", args: [dealId],
  });
  if (deal.buyer === "0x0000000000000000000000000000000000000000") {
    return NextResponse.json({ error: "no such deal" }, { status: 404 });
  }

  const latest = await client.getBlockNumber();
  const perSecond = await blocksPerSecond(latest);

  const head = await client.getBlock({ blockNumber: latest });
  const since = head.timestamp > BigInt(deal.start) ? head.timestamp - BigInt(deal.start) : 0n;
  const span = (since + MARGIN_SECONDS) * perSecond;

  const reach = CHUNK * MAX_REQUESTS;
  const truncated = span > reach;
  const window = truncated ? reach : span;
  const from = latest > window ? latest - window : 0n;

  const ranges: [bigint, bigint][] = [];
  for (let s = from; s <= latest; s += CHUNK) {
    const e = s + CHUNK - 1n > latest ? latest : s + CHUNK - 1n;
    ranges.push([s, e]);
  }

  let spec: { repo: string; branch: string; path: string; line: string } | null = null;
  const reports: Report[] = [];

  for (const [a, b] of ranges) {
    if (spec === null) {
      const logs = await client.getLogs({
        address: MORNINGLINE, event: SPEC, args: { dealId }, fromBlock: a, toBlock: b,
      });
      const hit = logs[0];
      if (hit?.args.repo !== undefined && hit.args.branch !== undefined &&
          hit.args.path !== undefined && hit.args.line !== undefined) {
        spec = { repo: hit.args.repo, branch: hit.args.branch, path: hit.args.path, line: hit.args.line };
      }
    }

    const reported = await client.getLogs({
      address: MORNINGLINE, event: REPORTED, args: { dealId }, fromBlock: a, toBlock: b,
    });
    for (const l of reported) {
      if (l.args.day === undefined) continue;
      reports.push({
        day: Number(l.args.day),
        present: l.args.present ?? false,
        sha: l.args.commitSha ?? null,
        tx: l.transactionHash ?? "",
      });
    }

    const reclaimed = await client.getLogs({
      address: MORNINGLINE, event: RECLAIMED, args: { dealId }, fromBlock: a, toBlock: b,
    });
    for (const l of reclaimed) {
      if (l.args.day === undefined) continue;
      reports.push({ day: Number(l.args.day), present: null, sha: null, tx: l.transactionHash ?? "" });
    }
  }

  return NextResponse.json({
    dealId: dealId.toString(),
    spec,
    reports,
    scannedFrom: from.toString(),
    blocksPerSecond: perSecond.toString(),
    /// True when the deal is older than this endpoint can scan in one request. Raise
    /// LOG_CHUNK_BLOCKS with an RPC that allows wider ranges.
    truncated,
  });
}

/// Blocks per second, measured over a recent sample. Base mainnet produces a block every two
/// seconds; Base Sepolia produces five a second. Assuming either one breaks the other.
async function blocksPerSecond(latest: bigint): Promise<bigint> {
  const back = latest > 5_000n ? 5_000n : latest;
  if (back === 0n) return 1n;
  const [now, then] = await Promise.all([
    client.getBlock({ blockNumber: latest }),
    client.getBlock({ blockNumber: latest - back }),
  ]);
  const seconds = now.timestamp - then.timestamp;
  if (seconds <= 0n) return 1n;
  // Round up, so the estimated window always reaches far enough back.
  return (back + seconds - 1n) / seconds;
}
