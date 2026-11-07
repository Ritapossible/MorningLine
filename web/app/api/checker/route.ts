// The checker's own report on itself, read from its /health endpoint on the server so the
// browser never makes a cross-site request, and cached briefly so visitors do not each wake it.
// Everything here is public: the checker's address, chain, and when it last ran.
import { NextResponse } from "next/server";
import { CHECKER, CHAIN_ID, MORNINGLINE } from "../../../lib/contracts";

// Fetched live on each request, never served from a static cache: a stale copy made the first
// visitor after a quiet spell see "has not run for 20 min" while the checker was fine. A short
// in-memory cache keeps a burst of visitors from each calling the checker.
export const dynamic = "force-dynamic";
let memo: { at: number; body: unknown } | null = null;

const HEALTH_URL = process.env.CHECKER_HEALTH_URL || "https://morningline-checker.onrender.com/health";

const NO_STORE = { "Cache-Control": "no-store" };

type Health = {
  checker: string | null;
  chainId: number | null;
  contract?: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  reportsSent: number;
};

export async function GET() {
  if (memo && Date.now() - memo.at < 10_000) return NextResponse.json(memo.body, { headers: NO_STORE });
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return NextResponse.json({ reachable: false }, { headers: NO_STORE });
    const h = (await res.json()) as Health;
    const body = {
      reachable: true,
      lastSuccessAt: h.lastSuccessAt,
      failing: h.lastError !== null,
      reportsSent: h.reportsSent,
      // The host might run a different key or chain from the one this site opens deals against.
      matches:
        h.checker !== null &&
        h.checker.toLowerCase() === CHECKER.toLowerCase() &&
        (h.chainId === null || h.chainId === CHAIN_ID) &&
        (h.contract == null || h.contract.toLowerCase() === MORNINGLINE.toLowerCase()),
    };
    memo = { at: Date.now(), body };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ reachable: false }, { headers: NO_STORE });
  }
}
