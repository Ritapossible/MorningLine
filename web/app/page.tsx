import Link from "next/link";
import { chain, IS_DEMO } from "../lib/contracts";

/// A still version of the day strip, used only to explain the idea.
function SampleStrip() {
  const cells: { n: number; cls: string; t: string }[] = [
    { n: 1, cls: "paid", t: "line present, maintainer paid" },
    { n: 2, cls: "paid", t: "line present, maintainer paid" },
    { n: 3, cls: "refunded", t: "line removed, sponsor refunded" },
    { n: 4, cls: "paid", t: "line back, maintainer paid" },
    { n: 5, cls: "reclaimed", t: "nobody checked, sponsor reclaimed" },
    { n: 6, cls: "due", t: "open now" },
    { n: 7, cls: "waiting", t: "not started" },
  ];
  return (
    <div className="strip" aria-hidden="true">
      {cells.map((c) => (
        <span key={c.n} className={`day ${c.cls}`} title={c.t}>
          {c.n}
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <h1>Pay for the days your line stays up.</h1>
      <p className="lede">
        Crypto can escrow almost anything that happens on chain and almost nothing that happens
        off it. Morning Line escrows one off-chain deliverable, a sponsor line in a GitHub
        README, and settles it one verified day at a time on {chain.name}.
      </p>

      <section className="card" style={{ marginTop: 28 }}>
        <h3>A seven day deal, as the sponsor sees it</h3>
        <SampleStrip />
        <p className="small" style={{ marginTop: 14, marginBottom: 0 }}>
          Amber days were paid to the maintainer. Blue days found no line and went back to the
          sponsor. Violet is a day nobody checked in time, so the sponsor took it back. Nothing
          is averaged and nothing is held hostage: each day is decided on its own.
        </p>
      </section>

      <section style={{ marginTop: 34 }}>
        <h2>How a day is decided</h2>
        <ol style={{ paddingLeft: 20, maxWidth: "62ch" }}>
          <li style={{ marginBottom: 8 }}>
            The sponsor locks USDC for a number of days, and one unit of LINE per day as fuel.
            The exact line, file and branch are pinned when the deal opens.
          </li>
          <li style={{ marginBottom: 8 }}>
            Once a day, at a minute the maintainer cannot predict, the checker reads the pinned
            file at the latest commit of the pinned branch.
          </li>
          <li style={{ marginBottom: 8 }}>
            Present pays the maintainer that day. Missing refunds the sponsor that day. Either
            way the commit hash goes on chain, so anyone can open it and look.
          </li>
          <li>
            If the checker goes quiet, every unchecked day is reclaimable by the sponsor once
            its window closes. Silence can never strand money.
          </li>
        </ol>
      </section>

      <section style={{ marginTop: 30 }}>
        <h2>Why per day</h2>
        <p style={{ maxWidth: "62ch" }}>
          Escrow that pays in full at the end rewards a maintainer for keeping the line up until
          the final check and removing it afterwards. Paying per day removes the incentive:
          taking the line down early only forfeits the days that follow, and putting it back
          starts earning again the next morning.
        </p>
      </section>

      <div className="row" style={{ marginTop: 30 }}>
        <Link href="/new">
          <button className="primary">Open a deal</button>
        </Link>
        <a className="small" href="https://github.com/Ritapossible/MorningLine/blob/main/docs/SECURITY.md">
          Trust and threat model
        </a>
      </div>

      {IS_DEMO ? (
        <p className="notice good" style={{ marginTop: 26 }}>
          This is the demo deployment. Days last 180 seconds instead of 24 hours and the grace
          period is 120 seconds, so a deal plays out in minutes. The USDC here is a faucet token
          worth nothing.
        </p>
      ) : null}
    </>
  );
}
