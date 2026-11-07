// The checker's own report on itself, read from its /health endpoint on the server so the
// browser never makes a cross-site request, and cached briefly so visitors do not each wake it.
// Everything here is public: the checker's address, chain, and when it last ran.
import { NextResponse } from "next/server";
import { CHECKER, CHAIN_ID } from "../../../lib/contracts";

export const revalidate = 10;

const HEALTH_URL = process.env.CHECKER_HEALTH_URL || "https://morningline-checker.onrender.com/health";

type Health = {
  checker: string | null;
  chainId: number | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  reportsSent: number;
};

export async function GET() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(8000), next: { revalidate: 10 } });
    if (!res.ok) return NextResponse.json({ reachable: false });
    const h = (await res.json()) as Health;
    return NextResponse.json({
      reachable: true,
      lastSuccessAt: h.lastSuccessAt,
      failing: h.lastError !== null,
      reportsSent: h.reportsSent,
      // The host might run a different key or chain from the one this site opens deals against.
      matches:
        h.checker !== null &&
        h.checker.toLowerCase() === CHECKER.toLowerCase() &&
        (h.chainId === null || h.chainId === CHAIN_ID),
    });
  } catch {
    return NextResponse.json({ reachable: false });
  }
}
