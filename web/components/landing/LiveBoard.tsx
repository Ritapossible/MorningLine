"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { MORNINGLINE, morningLineAbi } from "../../lib/contracts";
import { usd } from "../../lib/format";

const SHOWN = 4;

type Spec = { repo: string; branch: string; path: string; line: string } | null;

/// The newest deals on this deployment, read straight from the contract. The repo name comes
/// from the deal's DealSpec event via /api/deal/[id], the same source the deal page uses.
export function LiveBoard() {
  const { data: count, isLoading } = useReadContract({
    address: MORNINGLINE,
    abi: morningLineAbi,
    functionName: "dealCount",
  });

  const total = count === undefined ? 0 : Number(count);
  const ids = Array.from({ length: Math.min(SHOWN, total) }, (_, i) => BigInt(total - i));

  const { data: deals } = useReadContracts({
    contracts: ids.map((id) => ({
      address: MORNINGLINE,
      abi: morningLineAbi,
      functionName: "getDeal" as const,
      args: [id] as const,
    })),
    query: { enabled: ids.length > 0 },
  });

  const [specs, setSpecs] = useState<Record<string, Spec>>({});
  const key = ids.join(",");
  useEffect(() => {
    if (key === "") return;
    let alive = true;
    for (const id of key.split(",")) {
      fetch(`/api/deal/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (alive && j) setSpecs((s) => ({ ...s, [id]: (j as { spec: Spec }).spec }));
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [key]);

  if (isLoading) {
    return <div className="board-empty">Reading the contract…</div>;
  }

  if (total === 0) {
    return (
      <div className="board-empty">
        <b>No public deals yet</b>
        <p>Be the first: open a deal and it shows up here as soon as it is funded.</p>
        <Link href="/new" className="pill light">
          Open a deal
        </Link>
      </div>
    );
  }

  return (
    <ul className="board-list">
      {ids.map((id, i) => {
        const d = deals?.[i]?.result;
        const spec = specs[id.toString()];
        const settled = d ? Number(d.settled) : 0;
        const dayCount = d ? Number(d.dayCount) : 0;
        return (
          <li key={id.toString()}>
            <Link href={`/deal/${id}`} className="board-row">
              <span className="board-id mono">#{id.toString()}</span>
              <span className="board-repo">
                <b>{spec ? spec.repo : `Deal #${id.toString()}`}</b>
                <span className="mono">
                  {spec ? `${spec.branch} · ${spec.path}` : spec === null ? "open for the pinned line" : "reading spec…"}
                </span>
              </span>
              <span className="board-money">
                <b>{d ? `$${usd(d.dailyAmount)}` : "…"}</b>
                <span>a day</span>
              </span>
              <span className="board-progress" aria-label={`${settled} of ${dayCount} days settled`}>
                <span style={{ width: dayCount ? `${(settled / dayCount) * 100}%` : "0%" }} />
              </span>
              <span className="board-days mono">
                {settled}/{dayCount} settled
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
