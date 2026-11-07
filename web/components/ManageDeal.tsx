"use client";

// What each party can change about a running deal. A deal can change length, never terms:
// - the sponsor can cancel: days already started run, plus the deployment's notice period;
// - the maintainer can release: days already started run;
// - the sponsor can extend at the same price while the deal is running.
// Every action says, before it is signed, exactly which days stay and what money moves.
import { useState } from "react";
import { usePublicClient, useReadContract } from "wagmi";
import { LINE, USDC, erc20Abi, morningLineAbi } from "../lib/contracts";
import { usd } from "../lib/format";
import { useWrite } from "../lib/useWrite";
import { Wallet } from "./Wallet";

type Deal = {
  buyer: string;
  payee: string;
  start: number;
  dayCount: number;
  dailyAmount: bigint;
};

export function ManageDeal({
  contract,
  dealId,
  deal,
  address,
  daysStarted,
  cancelNotice,
  dayLength,
  fuelPerCheck,
  now,
  onDone,
}: {
  contract: `0x${string}`;
  dealId: bigint;
  deal: Deal;
  address: string | undefined;
  daysStarted: number;
  cancelNotice: number;
  dayLength: bigint;
  fuelPerCheck: bigint;
  now: bigint;
  onDone: () => Promise<unknown>;
}) {
  const publicClient = usePublicClient();
  const { write } = useWrite();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "release" | null>(null);
  const [extra, setExtra] = useState("7");

  const me = address?.toLowerCase();
  const isBuyer = me !== undefined && me === deal.buyer.toLowerCase();
  const isPayee = me !== undefined && me === deal.payee.toLowerCase();
  const ends = BigInt(deal.start) + BigInt(deal.dayCount) * dayLength;
  const running = now < ends;

  const extraDays = Math.max(0, Math.min(366 - deal.dayCount, Math.floor(Number(extra) || 0)));
  const extendUsdc = deal.dailyAmount * BigInt(extraDays);
  const extendFuel = fuelPerCheck * BigInt(extraDays);

  const { data: usdcAllow, refetch: refetchUsdc } = useReadContract({
    address: USDC, abi: erc20Abi, functionName: "allowance",
    args: address ? [address as `0x${string}`, contract] : undefined,
    query: { enabled: isBuyer },
  });
  const { data: lineAllow, refetch: refetchLine } = useReadContract({
    address: LINE, abi: erc20Abi, functionName: "allowance",
    args: address ? [address as `0x${string}`, contract] : undefined,
    query: { enabled: isBuyer },
  });
  const needUsdc = (usdcAllow ?? 0n) < extendUsdc;
  const needLine = (lineAllow ?? 0n) < extendFuel;

  async function send(label: string, w: Parameters<typeof write>[0], after?: () => Promise<unknown>) {
    setBusy(label);
    setErr(null);
    try {
      const hash = await write(w);
      await publicClient?.waitForTransactionReceipt({ hash });
      await (after ? after() : onDone());
      setConfirm(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m.split("\n")[0] ?? m);
    }
    setBusy(null);
  }

  if (!isBuyer && !isPayee) {
    return (
      <section className="card" style={{ marginTop: 18 }}>
        <h3>Manage this deal</h3>
        {address === undefined ? (
          <>
            <p className="small">
              The sponsor can cancel with notice or add days; the maintainer can end the deal
              early. Sign in with the wallet that opened or is paid by this deal.
            </p>
            <Wallet />
          </>
        ) : (
          <p className="small" style={{ marginBottom: 0 }}>
            Only the sponsor and the maintainer can change this deal, and this wallet is neither.
          </p>
        )}
      </section>
    );
  }

  // Days that stay after each action, and what goes back to the sponsor.
  const keepAfterCancel = Math.min(deal.dayCount, daysStarted + cancelNotice);
  const cutByCancel = deal.dayCount - keepAfterCancel;
  const keepAfterRelease = Math.min(deal.dayCount, daysStarted);
  const cutByRelease = deal.dayCount - keepAfterRelease;
  const noticeText = cancelNotice === 1 ? "1 day of notice" : `${cancelNotice} days of notice`;

  return (
    <section className="card" style={{ marginTop: 18 }}>
      <h3>Manage this deal</h3>
      <p className="small">
        A deal can change length, never terms: the line, the price and the maintainer stay as
        opened. To change those, cancel and open a new deal.
      </p>

      {isBuyer ? (
        <div className="manage-block">
          <h4>Cancel</h4>
          {cutByCancel > 0 ? (
            <>
              <p className="small">
                Days 1 to {keepAfterCancel} stay: {daysStarted} already started, plus {noticeText} for
                the maintainer. The other {cutByCancel} {cutByCancel === 1 ? "day comes" : "days come"} back
                to you now: {usd(deal.dailyAmount * BigInt(cutByCancel))} USDC and {cutByCancel} LINE.
              </p>
              {confirm === "cancel" ? (
                <div className="row">
                  <button
                    className="danger"
                    disabled={busy !== null}
                    onClick={() =>
                      send("cancel", { address: contract, abi: morningLineAbi, functionName: "cancel", args: [dealId] })
                    }
                  >
                    {busy === "cancel" ? "Cancelling" : `Yes, end after day ${keepAfterCancel}`}
                  </button>
                  <button disabled={busy !== null} onClick={() => setConfirm(null)}>
                    Keep the deal
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirm("cancel")}>Cancel the deal</button>
              )}
            </>
          ) : (
            <p className="small" style={{ marginBottom: 0 }}>
              Nothing left to cancel: every remaining day has started or is inside the notice period.
            </p>
          )}
        </div>
      ) : null}

      {isBuyer ? (
        <div className="manage-block">
          <h4>Add days</h4>
          {running && deal.dayCount < 366 ? (
            <>
              <div className="row">
                <input
                  type="number"
                  min={1}
                  max={366 - deal.dayCount}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  style={{ width: 120 }}
                  aria-label="Days to add"
                />
                <span className="small">
                  more {extraDays === 1 ? "day" : "days"} at {usd(deal.dailyAmount)} USDC: locks{" "}
                  {usd(extendUsdc)} USDC and {extraDays} LINE
                </span>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button
                  disabled={busy !== null || extraDays === 0 || !needUsdc}
                  onClick={() =>
                    send("usdc", { address: USDC, abi: erc20Abi, functionName: "approve", args: [contract, extendUsdc] }, refetchUsdc)
                  }
                >
                  {busy === "usdc" ? "Approving" : needUsdc ? "Approve USDC" : "USDC approved"}
                </button>
                <button
                  disabled={busy !== null || extraDays === 0 || !needLine}
                  onClick={() =>
                    send("line", { address: LINE, abi: erc20Abi, functionName: "approve", args: [contract, extendFuel] }, refetchLine)
                  }
                >
                  {busy === "line" ? "Approving" : needLine ? "Approve LINE" : "LINE approved"}
                </button>
                <button
                  className="primary"
                  disabled={busy !== null || extraDays === 0 || needUsdc || needLine}
                  onClick={() =>
                    send("extend", {
                      address: contract, abi: morningLineAbi, functionName: "extend", args: [dealId, extraDays],
                    })
                  }
                >
                  {busy === "extend" ? "Adding" : `Add ${extraDays} ${extraDays === 1 ? "day" : "days"}`}
                </button>
              </div>
            </>
          ) : (
            <p className="small" style={{ marginBottom: 0 }}>
              {running ? "This deal is at the 366-day limit." : "The last day has ended. Open a new deal to keep going."}
            </p>
          )}
        </div>
      ) : null}

      {isPayee ? (
        <div className="manage-block">
          <h4>End the deal early</h4>
          {cutByRelease > 0 ? (
            <>
              <p className="small">
                {keepAfterRelease === 0
                  ? "No day has started yet, so"
                  : `Days 1 to ${keepAfterRelease} have started and still settle as usual;`}{" "}
                the other {cutByRelease} {cutByRelease === 1 ? "day goes" : "days go"} back to the
                sponsor now, {usd(deal.dailyAmount * BigInt(cutByRelease))} USDC.{" "}
                {keepAfterRelease === 0
                  ? "You can remove the line straight away."
                  : `Keep the line up until day ${keepAfterRelease} ends to be paid for it.`}
              </p>
              {confirm === "release" ? (
                <div className="row">
                  <button
                    className="danger"
                    disabled={busy !== null}
                    onClick={() =>
                      send("release", { address: contract, abi: morningLineAbi, functionName: "release", args: [dealId] })
                    }
                  >
                    {busy === "release" ? "Ending" : "Yes, end the deal"}
                  </button>
                  <button disabled={busy !== null} onClick={() => setConfirm(null)}>
                    Keep the deal
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirm("release")}>End the deal early</button>
              )}
            </>
          ) : (
            <p className="small" style={{ marginBottom: 0 }}>Every day of this deal has started.</p>
          )}
        </div>
      ) : null}

      {err ? (
        <p className="notice warn" style={{ marginTop: 12 }}>
          {err}
        </p>
      ) : null}
    </section>
  );
}
