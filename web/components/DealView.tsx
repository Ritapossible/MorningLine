"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useBlock, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { DayStrip, type DayCell } from "./DayStrip";
import { NotPromised } from "./NotPromised";
import { CheckerNotice } from "./CheckerNotice";
import { Wallet } from "./Wallet";
import { ManageDeal } from "./ManageDeal";
import { verifyReport, type Verdict } from "../lib/verify";
import { useWrite } from "../lib/useWrite";
import { DAY_WORDS, IS_DEMO, PREVIOUS_MORNINGLINE, addressUrl, morningLineAbi, txUrl } from "../lib/contracts";
import { blobUrl, fileAtCommit, latestCommit } from "../lib/github";
import { linePresent } from "../lib/match";
import { duration, shortAddress, timestamp, untilText, usd } from "../lib/format";

type Report = { day: number; present: boolean | null; sha: string | null; fileHash: string | null; tx: string };
type Api = {
  spec: { repo: string; branch: string; path: string; line: string } | null;
  reports: Report[];
  truncated?: boolean;
};

/// Which MorningLine a deal lives on. v2 added cancel, release, extend and file hashes; v1 deals
/// are shown read-only (reclaim still works) so their settled history stays visible.
export type DealContract = { address: `0x${string}`; version: 1 | 2 };

export function DealView({ id, contract }: { id: string; contract: DealContract }) {
  const dealId = BigInt(id);
  const ML = contract.address;
  const v2 = contract.version === 2;
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { write } = useWrite();

  const [api, setApi] = useState<Api | null>(null);
  const [live, setLive] = useState<"checking" | "present" | "missing" | "error" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: block } = useBlock({ watch: true });
  const now = block?.timestamp ?? BigInt(Math.floor(Date.now() / 1000));

  const { data: deal, refetch: refetchDeal } = useReadContract({
    address: ML, abi: morningLineAbi, functionName: "getDeal", args: [dealId],
  });
  const { data: dayLength } = useReadContract({ address: ML, abi: morningLineAbi, functionName: "dayLength" });
  const { data: reportGrace } = useReadContract({ address: ML, abi: morningLineAbi, functionName: "reportGrace" });
  const { data: cancelNotice } = useReadContract({
    address: ML, abi: morningLineAbi, functionName: "cancelNotice", query: { enabled: v2 },
  });
  const { data: fuelPerCheck } = useReadContract({ address: ML, abi: morningLineAbi, functionName: "fuelPerCheck" });
  const { data: started, refetch: refetchStarted } = useReadContract({
    address: ML, abi: morningLineAbi, functionName: "daysStarted", args: [dealId], query: { enabled: v2 },
  });

  const dayCount = deal ? Number(deal.dayCount) : 0;

  const { data: statuses, refetch: refetchStatuses } = useReadContracts({
    contracts: Array.from({ length: dayCount }, (_, d) => ({
      address: ML,
      abi: morningLineAbi,
      functionName: "dayStatus" as const,
      args: [dealId, BigInt(d)] as const,
    })),
    query: { enabled: dayCount > 0 },
  });

  useEffect(() => {
    let alive = true;
    const pull = () =>
      fetch(`/api/deal/${id}${v2 ? "" : "?v=1"}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (alive && j) setApi(j as Api); })
        .catch(() => {});
    pull();
    const t = setInterval(pull, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, [id, v2]);

  // Is the line there at this moment? Uses the same rule that settles days. Keyed on the spec's
  // content, not the object: the API is polled every 10 seconds and returns a fresh object each
  // time, which would re-read GitHub and exhaust its 60-an-hour limit for visitors.
  const specKey = api?.spec ? JSON.stringify(api.spec) : "";
  useEffect(() => {
    const spec = api?.spec;
    if (!spec) return;
    let alive = true;
    setLive("checking");
    (async () => {
      try {
        const sha = await latestCommit(spec.repo, spec.branch);
        const body = await fileAtCommit(spec.repo, spec.path, sha);
        if (!alive) return;
        setLive(body !== null && linePresent(body, spec.line) ? "present" : "missing");
      } catch {
        if (alive) setLive("error");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  // Audit every reported commit against GitHub: in the branch's history, and the file matches the
  // hash on chain. One check per distinct commit; consecutive days usually share one.
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  useEffect(() => {
    const spec = api?.spec;
    if (!spec) return;
    let alive = true;
    for (const r of api?.reports ?? []) {
      if (!r.sha || /^0x0+$/.test(r.sha)) continue;
      const key = `${r.sha}|${r.fileHash ?? ""}`;
      if (verdicts[key]) continue;
      verifyReport(spec.repo, spec.branch, spec.path, r.sha, r.fileHash).then((v) => {
        if (alive) setVerdicts((all) => ({ ...all, [key]: v }));
      });
    }
    return () => {
      alive = false;
    };
    // verdicts is only read to skip work already done
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const byDay = useMemo(() => {
    const m = new Map<number, Report>();
    for (const r of api?.reports ?? []) m.set(r.day, r);
    return m;
  }, [api]);

  const cells: DayCell[] = useMemo(() => {
    if (!deal || !dayLength || !reportGrace) return [];
    return Array.from({ length: dayCount }, (_, d) => {
      const opens = BigInt(deal.start) + BigInt(d) * dayLength;
      const closes = opens + dayLength + reportGrace;
      const status = Number(statuses?.[d]?.result ?? 0);
      const rep = byDay.get(d);

      let state: DayCell["state"];
      if (status === 1) state = "paid";
      else if (status === 2) state = rep && rep.present === null ? "reclaimed" : "refunded";
      else if (now < opens) state = "waiting";
      else if (now < closes) state = "due";
      else state = "lapsed";

      return { day: d, state, sha: rep?.sha ?? undefined, opens, closes };
    });
  }, [deal, dayLength, reportGrace, dayCount, statuses, byDay, now]);

  if (!deal || deal.buyer === "0x0000000000000000000000000000000000000000") {
    return (
      <>
        <h1>Deal {id}</h1>
        <p className="lede">
          There is no deal number {id} on {v2 ? "the current contract" : "the first contract"}.
        </p>
        {v2 ? (
          <p className="small">
            Deals opened before 7 November 2026 are on the first contract: see{" "}
            <a href={`/deal/v1/${id}`}>deal {id} there</a>.
          </p>
        ) : null}
      </>
    );
  }

  const paid = cells.filter((c) => c.state === "paid").length;
  const returned = cells.filter((c) => c.state === "refunded" || c.state === "reclaimed").length;
  const openDays = cells.filter((c) => c.state === "waiting" || c.state === "due").length;
  const lapsed = cells.filter((c) => c.state === "lapsed").map((c) => c.day);
  const isBuyer = address !== undefined && address.toLowerCase() === deal.buyer.toLowerCase();
  const spec = api?.spec;

  async function reclaim() {
    setBusy(true);
    setErr(null);
    try {
      const hash = await write({
        address: ML, abi: morningLineAbi, functionName: "reclaim",
        args: [dealId, lapsed.map((d) => BigInt(d))],
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      await Promise.all([refetchDeal(), refetchStatuses()]);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m.split("\n")[0] ?? m);
    }
    setBusy(false);
  }

  return (
    <>
      <h1 style={{ marginBottom: 6 }}>Deal {id}</h1>
      {!v2 ? (
        <p className="notice" style={{ marginBottom: 12 }}>
          On the{" "}
          <a href={addressUrl(PREVIOUS_MORNINGLINE)} target="_blank" rel="noreferrer">
            first contract
          </a>
          , from before deals could be cancelled or extended and before reports carried a file
          hash. Shown for its settled history.
        </p>
      ) : null}
      <p className="small" style={{ marginBottom: 22 }}>
        {spec ? (
          <>
            <a href={`https://github.com/${spec.repo}`} target="_blank" rel="noreferrer">{spec.repo}</a>
            {" / "}<span className="mono">{spec.branch}</span>
            {" / "}<span className="mono">{spec.path}</span>
          </>
        ) : (
          "Reading the pinned spec"
        )}
      </p>

      {spec ? (
        <section className="card">
          <h3>The line being paid for</h3>
          <div className="chosen">{spec.line}</div>
          <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
            {live === "checking" ? "Checking GitHub right now..." : null}
            {live === "present" ? "It is in the file at this moment." : null}
            {live === "missing" ? "It is not in the file at this moment." : null}
            {live === "error" ? "GitHub could not be read just now." : null}
            {live !== null && live !== "checking"
              ? " This preview uses exactly the rule that settles days, but it decides nothing: only the checker's report moves money."
              : null}
          </p>
        </section>
      ) : null}

      <CheckerNotice checker={deal.checker} buyer={deal.buyer} payee={deal.payee} />

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Days</h3>
        <p className="small" style={{ marginTop: -4 }}>
          {DAY_WORDS.charAt(0).toUpperCase() + DAY_WORDS.slice(1)}
          {IS_DEMO ? ", so a whole deal plays out in minutes. The production contract uses 24-hour days." : "."}
        </p>
        <DayStrip cells={cells} repo={spec?.repo ?? ""} now={now} />
        {api?.truncated ? (
          <p className="notice warn" style={{ marginTop: 14 }}>
            The RPC did not return every event for this deal, so some evidence links may be
            missing. Reload to try again. The day colours above come from contract state and are
            complete.
          </p>
        ) : null}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Money</h3>
        <dl className="kv">
          <dt>Price per day</dt>
          <dd>{usd(deal.dailyAmount)} USDC</dd>
          <dt>Paid to the maintainer</dt>
          <dd>{usd(deal.dailyAmount * BigInt(paid))} USDC over {paid} {paid === 1 ? "day" : "days"}</dd>
          <dt>Back to the sponsor</dt>
          <dd>{usd(deal.dailyAmount * BigInt(returned))} USDC over {returned} {returned === 1 ? "day" : "days"}</dd>
          <dt>Still to settle</dt>
          <dd>{usd(deal.dailyAmount * BigInt(openDays + lapsed.length))} USDC</dd>
        </dl>
      </section>

      {lapsed.length > 0 ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>Unchecked days</h3>
          <p style={{ marginBottom: 12 }}>
            {lapsed.length} {lapsed.length === 1 ? "day" : "days"} closed without a report. The
            sponsor can take {usd(deal.dailyAmount * BigInt(lapsed.length))} USDC back, with the
            fuel that was never spent.
          </p>
          {isBuyer ? (
            <button className="primary" onClick={reclaim} disabled={busy}>
              {busy ? "Reclaiming" : `Reclaim ${lapsed.length} ${lapsed.length === 1 ? "day" : "days"}`}
            </button>
          ) : address === undefined ? (
            <>
              <p className="small">Only the sponsor can reclaim. Sign in with the wallet that opened the deal.</p>
              <Wallet />
            </>
          ) : (
            <p className="small" style={{ marginBottom: 0 }}>
              Only the sponsor can reclaim, and this wallet did not open the deal.
            </p>
          )}
          {err ? <p className="notice warn" style={{ marginTop: 12 }}>{err}</p> : null}
        </section>
      ) : null}

      {v2 && dayLength !== undefined && cancelNotice !== undefined && fuelPerCheck !== undefined && started !== undefined ? (
        <ManageDeal
          contract={ML}
          dealId={dealId}
          deal={{
            buyer: deal.buyer,
            payee: deal.payee,
            start: Number(deal.start),
            dayCount,
            dailyAmount: deal.dailyAmount,
          }}
          address={address}
          daysStarted={Number(started)}
          cancelNotice={Number(cancelNotice)}
          dayLength={dayLength}
          fuelPerCheck={fuelPerCheck}
          now={now}
          onDone={() => Promise.all([refetchDeal(), refetchStatuses(), refetchStarted()])}
        />
      ) : null}

      <section className="card" style={{ marginTop: 18 }}>
        <h3>Terms</h3>
        <dl className="kv">
          <dt>Sponsor</dt>
          <dd><a href={addressUrl(deal.buyer)} target="_blank" rel="noreferrer">{deal.buyer}</a></dd>
          <dt>Maintainer</dt>
          <dd><a href={addressUrl(deal.payee)} target="_blank" rel="noreferrer">{deal.payee}</a></dd>
          <dt>Checker</dt>
          <dd><a href={addressUrl(deal.checker)} target="_blank" rel="noreferrer">{deal.checker}</a></dd>
          <dt>Day length</dt>
          <dd>{dayLength ? duration(dayLength) : "..."}{reportGrace ? `, ${duration(reportGrace)} grace` : ""}</dd>
          <dt>Day 1 began</dt>
          <dd>{timestamp(BigInt(deal.start))}</dd>
        </dl>
      </section>

      {api?.reports && api.reports.length > 0 ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>Evidence</h3>
          <p className="small">
            {v2 ? (
              <>
                Each report names the commit the checker read and a hash of the file. This page
                checks both against GitHub for you: the commit must be in the history of{" "}
                <span className="mono">{spec?.branch ?? "the branch"}</span>, and the file at that
                commit must match the hash recorded on chain.
              </>
            ) : (
              <>
                Each report names the commit the checker read. This page checks it against GitHub
                for you: the commit must be in the history of{" "}
                <span className="mono">{spec?.branch ?? "the branch"}</span>. The first contract did
                not record file hashes.
              </>
            )}
          </p>
          <dl className="kv">
            {[...api.reports].sort((a, b) => a.day - b.day).map((r) => (
              <div key={`${r.day}-${r.tx}`} style={{ display: "contents" }}>
                <dt>Day {r.day + 1}</dt>
                <dd>
                  {r.present === null
                    ? "reclaimed after silence"
                    : r.present
                      ? "line present"
                      : "line missing"}
                  {r.sha && spec ? (
                    <>
                      {" - "}
                      <a href={blobUrl(spec.repo, r.sha.replace(/^0x/, ""), spec.path)} target="_blank" rel="noreferrer">
                        file at {r.sha.replace(/^0x/, "").slice(0, 7)}
                      </a>
                    </>
                  ) : null}
                  {r.tx ? (
                    <>
                      {" - "}
                      <a href={txUrl(r.tx)} target="_blank" rel="noreferrer">tx {shortAddress(r.tx)}</a>
                    </>
                  ) : null}
                  {r.sha && !/^0x0+$/.test(r.sha) ? (
                    <VerdictLine verdict={verdicts[`${r.sha}|${r.fileHash ?? ""}`]} branch={spec?.branch ?? ""} />
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <NotPromised repo={spec?.repo} />

      <p className="small" style={{ marginTop: 16 }}>
        {openDays > 0 && cells.some((c) => c.state === "due")
          ? `A check is due now. The next window closes ${untilText(
              cells.find((c) => c.state === "due")?.closes ?? now, now,
            )}.`
          : null}
      </p>
    </>
  );
}

/// The browser's own check of one report, in plain words.
function VerdictLine({ verdict, branch }: { verdict: Verdict | undefined; branch: string }) {
  if (verdict === undefined) return <span className="verdict">Checking against GitHub…</span>;
  const parts: { ok: boolean | null; text: string }[] = [
    {
      ok: verdict.inHistory,
      text:
        verdict.inHistory === true
          ? `in ${branch}'s history`
          : verdict.inHistory === false
            ? `not in ${branch}'s history`
            : "history not checked (GitHub busy)",
    },
  ];
  if (verdict.fileMatches !== null) {
    parts.push({
      ok: verdict.fileMatches,
      text: verdict.fileMatches ? "file matches the hash on chain" : "file does not match the hash on chain",
    });
  }
  return (
    <span className="verdict">
      {parts.map((p, i) => (
        <span key={i} className={p.ok === false ? "bad" : p.ok === true ? "good" : ""}>
          {p.ok === true ? "✓ " : p.ok === false ? "✗ " : ""}
          {p.text}
        </span>
      ))}
    </span>
  );
}
