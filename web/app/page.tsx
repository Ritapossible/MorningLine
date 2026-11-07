import Link from "next/link";
import { addressUrl, chain, IS_DEMO, MORNINGLINE } from "../lib/contracts";
import { NotPromised } from "../components/NotPromised";
import { StampArt, FloatChip, Icon } from "../components/landing/StampArt";
import { DealCardMock } from "../components/landing/DealCardMock";
import { LiveBoard } from "../components/landing/LiveBoard";
import { CheckerStatus } from "../components/CheckerStatus";
import { PriceCalc } from "../components/landing/PriceCalc";

const GRACE = IS_DEMO ? "2 minutes on this demo deployment" : "48 hours";

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Who holds the money?",
    a: (
      <>
        The MorningLine contract on {chain.name}. It has no owner, no admin and no upgrade path.
        Each day's USDC can only go two ways: to the maintainer if the line was there, or back to
        the sponsor if it was not.
      </>
    ),
  },
  {
    q: "What if the maintainer never adds the line?",
    a: <>Every day is checked and found missing, so every day goes back to the sponsor.</>,
  },
  {
    q: "What if they remove it early?",
    a: (
      <>
        Days already paid stay paid. From the next check on, each missing day goes back to the
        sponsor. Put the line back and it starts earning again the next day. Nothing is held until
        the end, so there is nothing to game.
      </>
    ),
  },
  {
    q: "What if the checker goes quiet?",
    a: (
      <>
        Any day nobody reports can be reclaimed by the sponsor {GRACE} after it ends. Silence never
        strands money.
      </>
    ),
  },
  {
    q: "Does the maintainer need crypto?",
    a: (
      <>
        Only an address on Base to receive USDC. No sign-up, no fee and no gas: payouts are sent by
        the daily check.
      </>
    ),
  },
  {
    q: "What does a check actually prove?",
    a: (
      <>
        Each report puts the commit hash on chain. A commit's contents never change, so anyone can
        open it and see whether the line was in the file. It does not prove that commit was the one
        visitors saw that day; see the limits above.
      </>
    ),
  },
];

export default function Home() {
  return (
    <>
      {/* ------------------------------------------------------------------ hero */}
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-status">
            <i className="cell live" aria-hidden="true" />
            Escrow for README sponsorships, live on {chain.name}
          </p>

          <h1 className="display">
            Sponsor lines,
            <br />
            paid by the day
          </h1>

          <p className="hero-lede">
            The sponsor locks USDC on Base. Each day the line is in the README, that day goes to the
            maintainer. Each day it is gone, that day goes back. No line, no pay.
          </p>

          <div className="hero-ctas">
            <Link href="/new" className="pill primary">
              Open a deal <span aria-hidden="true">→</span>
            </Link>
            <Link href="#maintainers" className="pill">
              I'm a maintainer
            </Link>
          </div>
        </div>

        <div className="hero-art">
          <StampArt label="$30" caption={chain.name} />
          <DealCardMock />
        </div>
      </section>


      {/* -------------------------------------------------------------- live board */}
      <section className="block">
        <h2 className="section-title">
          Real deals,
          <br />
          <span className="soft">with the money already in escrow</span>
        </h2>
        <p className="section-lede">
          Every deal is funded before the first check runs. Watch days settle one at a time, each
          with the commit it was read from.
        </p>

        <div className="board">
          <div className="board-bar">
            <CheckerStatus />
            <a href={addressUrl(MORNINGLINE)} target="_blank" rel="noreferrer">
              Contract ↗
            </a>
          </div>
          <div className="board-body">
            <LiveBoard />
          </div>
          <div className="board-clock">
            <h3>The deal clock</h3>
            <ol>
              <li>
                <i className="cell" aria-hidden="true" />
                <span>
                  <b>Funded.</b> The sponsor locks USDC for every day, plus one LINE per day as
                  fuel. The exact line, file and branch are pinned.
                </span>
              </li>
              <li>
                <i className="cell due" aria-hidden="true" />
                <span>
                  <b>Checked daily.</b> At a minute the maintainer cannot predict, the checker reads
                  the pinned file at the latest commit.
                </span>
              </li>
              <li>
                <i className="cell paid" aria-hidden="true" />
                <span>
                  <b>Settled.</b> Present pays the maintainer that day. Missing sends that day back.
                  The commit hash goes on chain either way.
                </span>
              </li>
              <li>
                <i className="cell reclaimed" aria-hidden="true" />
                <span>
                  <b>Silent days.</b> A day nobody reports is reclaimable by the sponsor {GRACE}{" "}
                  after it ends.
                </span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section className="block" id="how">
        <p className="eyebrow">How it works</p>
        <h2 className="section-title">
          Three steps,
          <br />
          <span className="soft">one day at a time</span>
        </h2>

        <div className="steps">
          <article className="step">
            <StampArt label="Locked" caption="Base" tone="dusk">
              <FloatChip
                icon={Icon.send}
                title="Deal opened for octo/sdk"
                sub="30.00 USDC in escrow"
              />
            </StampArt>
            <div className="step-head">
              <span className="step-n">1</span>
              <h3>Locked</h3>
              <span className="step-tag">
                <i className="cell" aria-hidden="true" />
                Funded
              </span>
            </div>
            <p>
              Paste the repo, pick the exact line from the file, set a price per day and a number of
              days. The USDC and the fuel are locked before anything else happens.
            </p>
          </article>

          <article className="step">
            <StampArt label="Checked" caption="GitHub" tone="dawn">
              <FloatChip
                icon={Icon.commit}
                title="Line present"
                sub="main · commit 3f2a1c9"
                status="Present"
              />
            </StampArt>
            <div className="step-head">
              <span className="step-n">2</span>
              <h3>Checked</h3>
              <span className="step-tag">
                <i className="cell due" aria-hidden="true" />
                Daily
              </span>
            </div>
            <p>
              Once a day the checker reads the pinned file at the latest commit of the pinned branch
              and looks for the whole line, byte for byte. Same file for everyone: GitHub cannot
              show the checker one README and visitors another.
            </p>
          </article>

          <article className="step">
            <StampArt label="Paid" caption="USDC" tone="lapse">
              <FloatChip
                icon={Icon.wallet}
                title="Sent to the maintainer"
                sub="+1.00 USDC · day 28"
                status="Paid"
              />
            </StampArt>
            <div className="step-head">
              <span className="step-n">3</span>
              <h3>Paid</h3>
              <span className="step-tag">
                <i className="cell paid" aria-hidden="true" />
                Per day
              </span>
            </div>
            <p>
              The line was there: that day's USDC goes to the maintainer, automatically. It was
              gone: that day goes back to the sponsor. Every day is decided on its own.
            </p>
          </article>
        </div>
      </section>

      {/* ------------------------------------------------------- proof, not promises */}
      <section className="block">
        <p className="eyebrow">Proof, not promises</p>
        <h2 className="section-title">
          Every day ends with
          <br />
          <span className="soft">a commit anyone can open</span>
        </h2>

        <div className="tiles">
          <div className="tile">
            <span className="tile-icon">{Icon.eye}</span>
            <h3>Watched for you</h3>
            <p>
              Checked once a day at a minute the maintainer cannot predict, against the exact line
              you pinned.
            </p>
          </div>
          <div className="tile">
            <span className="tile-icon">{Icon.lock}</span>
            <h3>No middleman with a key</h3>
            <p>
              The contract can only pay the maintainer or refund the sponsor. No owner, no admin, no
              upgrade, and no dispute desk deciding who wins.
            </p>
          </div>
          <div className="tile">
            <span className="tile-icon">{Icon.commit}</span>
            <h3>Evidence anyone can open</h3>
            <p>
              Each result carries the commit hash it read. Click it and see the file exactly as the
              checker did.
            </p>
          </div>
          <div className="tile">
            <span className="tile-icon">{Icon.clock}</span>
            <h3>Silence never strands money</h3>
            <p>A day nobody reports goes back to the sponsor {GRACE} after it ends.</p>
          </div>
        </div>

        <div className="receipt">
          <div className="receipt-head">
            <b>Receipt</b>
            <span>Example deal 7</span>
          </div>
          <dl>
            <dt>From</dt>
            <dd>acme</dd>
            <dt>To</dt>
            <dd>maintainer.base.eth</dd>
            <dt>Format</dt>
            <dd>README line, 30 days</dd>
            <dt>Fuel</dt>
            <dd>30 LINE</dd>
            <dt>Back to sponsor</dt>
            <dd>$2.00</dd>
            <dt>Paid to the maintainer</dt>
            <dd className="big">$26.00</dd>
          </dl>
          <div className="receipt-file mono">
            <span className="dim">octo/sdk · main · README.md · 3f2a1c9</span>
            <br />
            Sponsored by [Acme](https://acme.xyz)
          </div>
          <p className="small" style={{ margin: "12px 0 0" }}>
            Two days are still to come. Illustrative numbers, not a real deal.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- pricing */}
      <section className="block" id="pricing">
        <p className="eyebrow">Pricing</p>
        <h2 className="section-title">
          The maintainer gets
          <br />
          <span className="soft">every day they earn</span>
        </h2>
        <p className="section-lede">
          No fee in USDC. Each daily check spends one LINE, the app's fuel token. No fuel, no check,
          no payout.
        </p>
        <PriceCalc />
      </section>

      {/* ------------------------------------------------------------ maintainers */}
      <section className="block" id="maintainers">
        <p className="eyebrow">For maintainers</p>
        <h2 className="section-title">
          Sell a sponsor slot
          <br />
          <span className="soft">without chasing invoices</span>
        </h2>
        <ol className="plain-steps">
          <li>
            <b>Share an address on Base.</b> That is all the setup there is. No account, no fee, no
            gas.
          </li>
          <li>
            <b>Add the sponsor's line to your README</b> on the branch you both agree on, exactly as
            written.
          </li>
          <li>
            <b>Send the sponsor the deal link.</b> Each day the line is there, that day's USDC
            arrives in your wallet.
          </li>
        </ol>
      </section>

      {/* ----------------------------------------------------------------- limits */}
      <section className="block" id="limits">
        <p className="eyebrow">Said before anyone asks</p>
        <NotPromised />
      </section>

      {/* -------------------------------------------------------------------- FAQ */}
      <section className="block" id="faq">
        <p className="eyebrow">FAQ</p>
        <h2 className="section-title">Common questions</h2>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <span className="faq-plus" aria-hidden="true" />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------- closing */}
      <section className="closing">
        <h2 className="display small-display">
          No line,
          <br />
          <span className="soft">no pay</span>
        </h2>
        <p className="hero-lede center">
          Lock a sponsorship against a line in any public README, or share your address and sell
          one. Every day's result is on chain.
        </p>
        <div className="hero-ctas center">
          <Link href="/new" className="pill primary">
            Open a deal <span aria-hidden="true">→</span>
          </Link>
          <Link href="/docs" className="pill">
            Read the docs
          </Link>
        </div>
      </section>
    </>
  );
}
