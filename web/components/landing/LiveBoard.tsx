"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { MORNINGLINE, PREVIOUS_MORNINGLINE, morningLineAbi } from "../../lib/contracts";
import { usd } from "../../lib/format";

type Spec = { repo: string; branch: string; path: string; line: string } | null;
type Report = { present: boolean | null };
/// What the board knows about a deal from its events: the spec and how each settled day went.
type Info = { spec: Spec; paid: number; refunded: number; reclaimed: number };

/// The newest deals on this deployment, read straight from the contract. The repo name comes
/// from the deal's DealSpec event via /api/deal/[id], the same source the deal page uses.
export function LiveBoard() {
  return (
    <>
      <DealList contract={MORNINGLINE} base="/deal" api="" shown={4} emptyCta />
      <p className="board-sub">On the first contract, from before deals could be cancelled</p>
      <DealList contract={PREVIOUS_MORNINGLINE} base="/deal/v1" api="?v=1" shown={6} />
    </>
  );
}

function DealList({
  contract,
  base,
  api,
  shown,
  emptyCta = false,
}: {
  contract: `0x${string}`;
  base: string;
  api: string;
  shown: number;
  emptyCta?: boolean;
}) {
  const { data: count, isLoading } = useReadContract({
    address: contract,
    abi: morningLineAbi,
    functionName: "dealCount",
  });

  const total = count === undefined ? 0 : Number(count);
  const ids = Array.from({ length: Math.min(shown, total) }, (_, i) => BigInt(total - i));

  const { data: deals } = useReadContracts({
    contracts: ids.map((id) => ({
      address: contract,
      abi: morningLineAbi,
      functionName: "getDeal" as const,
      args: [id] as const,
    })),
    query: { enabled: ids.length > 0 },
  });

  const [infos, setInfos] = useState<Record<string, Info>>({});
  const key = ids.join(",");
  useEffect(() => {
    if (key === "") return;
    let alive = true;
    for (const id of key.split(",")) {
      fetch(`/api/deal/${id}${api}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!alive || !j) return;
          const { spec, reports } = j as { spec: Spec; reports: Report[] };
          setInfos((s) => ({
            ...s,
            [id]: {
              spec,
              paid: reports.filter((x) => x.present === true).length,
              refunded: reports.filter((x) => x.present === false).length,
              reclaimed: reports.filter((x) => x.present === null).length,
            },
          }));
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [key, api]);

  if (isLoading) {
    return <div className="board-empty">Reading the contract…</div>;
  }

  if (total === 0 && !emptyCta) return null;
  if (total === 0) {
    return (
      <div className="board-empty">
        <b>No deals on the new contract yet</b>
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
        const info = infos[id.toString()];
        const spec = info === undefined ? undefined : info.spec;
        const outcome = info
          ? [
              info.paid ? `${info.paid} paid` : "",
              info.refunded ? `${info.refunded} refunded` : "",
              info.reclaimed ? `${info.reclaimed} reclaimed` : "",
            ].filter(Boolean)
          : [];
        const settled = d ? Number(d.settled) : 0;
        const dayCount = d ? Number(d.dayCount) : 0;
        return (
          <li key={id.toString()}>
            <Link href={`${base}/${id}`} className="board-row">
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
                {outcome.length > 0 ? `${outcome.join(" · ")} of ${dayCount}` : `${settled}/${dayCount} settled`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
