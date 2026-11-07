import type { Metadata } from "next";
import Link from "next/link";
import { NotPromised } from "../../components/NotPromised";
import {
  addressUrl,
  chain,
  IS_DEMO,
  LINE,
  MORNINGLINE,
  USDC,
  USDC_IS_FAUCET,
  CHECKER,
} from "../../lib/contracts";

export const metadata: Metadata = {
  title: "Docs · Morning Line",
  description:
    "How Morning Line works: opening a deal, the daily check, timing, money, contracts, the deal API and how to verify a day yourself.",
};

const REPO = "https://github.com/Ritapossible/MorningLine";

const SECTIONS = [
  ["overview", "Overview"],
  ["lifecycle", "How a deal runs"],
  ["sponsors", "For sponsors"],
  ["maintainers", "For maintainers"],
  ["check", "The daily check"],
  ["timing", "Timing"],
  ["money", "Money and fuel"],
  ["verify", "Verify a day yourself"],
  ["contracts", "Contracts"],
  ["api", "Deal API"],
  ["limits", "Limits"],
  ["source", "Source and security"],
] as const;

function Addr({ a }: { a: string }) {
  return (
    <a href={addressUrl(a)} target="_blank" rel="noreferrer">
      <code>{a}</code>
    </a>
  );
}

export default function Docs() {
  return (
    <>
      <h1>Docs</h1>
      <p className="lede">
        Everything Morning Line does, in the order you meet it. The contract is the source of truth;
        this page describes it and links to it.
      </p>

      <div className="docs" style={{ marginTop: 40 }}>
        <nav className="docs-nav" aria-label="On this page">
          <p>On this page</p>
          <ol>
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="docs-body">
          <section id="overview">
            <h2>Overview</h2>
            <p>
              Morning Line is an escrow on Base for one sponsor line in a GitHub repository. A
              sponsor locks USDC for a number of days. Once a day a checker reads the pinned file at
              the latest commit of the pinned branch and looks for the exact line. Each day the line
              is there, that day&apos;s USDC goes to the maintainer. Each day it is missing, that
              day&apos;s USDC goes back to the sponsor. Every result records the commit hash it
              read, so anyone can open that commit and see the file.
            </p>
            <p>
              The contract has no owner, no admin and no upgrade path. Nobody, including the people
              who built it, can move a deal&apos;s money anywhere except to the maintainer or back
              to the sponsor.
            </p>
            <p className="small">
              Not affiliated with GitHub or Base. Sponsor lines should be disclosed as sponsorships.
              Nothing here is financial advice.
            </p>
            {IS_DEMO ? (
              <p className="notice good">
                This site runs the demo deployment on {chain.name}: a day lasts 3 minutes, the grace
                period is 2 minutes, and the tokens are worthless faucet tokens.
              </p>
            ) : null}
          </section>

          <section id="lifecycle">
            <h2>How a deal runs</h2>
            <ol>
              <li>
                <b>Opened.</b> The sponsor pins a repo, a branch, a file and one exact line, names
                the maintainer&apos;s address and the checker, and sets a price per day and a number
                of days. All the USDC and one LINE per day are transferred into the contract in the
                same transaction.
              </li>
              <li>
                <b>Checked.</b> Each day has a report window. Inside it the checker reads the file
                once and calls <code>report(dealId, day, present, commitSha)</code>.
              </li>
              <li>
                <b>Settled.</b> Present sends that day&apos;s USDC to the maintainer. Missing sends
                it back to the sponsor. Either way one LINE is spent and the commit hash is emitted
                in a <code>DayReported</code> event.
              </li>
              <li>
                <b>Reclaimed.</b> A day nobody reported can be taken back by the sponsor once its
                window has closed, with <code>reclaim(dealId, days)</code>. Its LINE comes back too.
              </li>
            </ol>
            <p>
              Each day is decided on its own and settles exactly once. Nothing is held to the end.
            </p>
          </section>

          <section id="sponsors">
            <h2>For sponsors</h2>
            <ol>
              <li>
                Open <Link href="/new">Open a deal</Link> and paste the repository, as{" "}
                <code>owner/name</code> or its GitHub URL. Leave the branch blank for the default
                branch. The file defaults to <code>README.md</code>.
              </li>
              <li>
                Click the exact line you are paying for. The page reads the file from GitHub and
                shows whether the line is there today.
              </li>
              <li>
                Enter the maintainer&apos;s address, the price per day in USDC and the number of
                days, from 1 to 366. Day 1 begins one minute after you open the deal.
              </li>
              <li>
                Sign in. An existing wallet works; so does email or Google, which creates a wallet
                for you. That wallet needs a little ETH on {chain.name} for gas, a fraction of a
                cent per step, and the page says so if it has none.
              </li>
              <li>
                Approve USDC and LINE, then open the deal.
                {USDC_IS_FAUCET
                  ? " On this deployment both come from free faucets, one drip a day each, with buttons on the same page."
                  : ""}
              </li>
              <li>
                Send the deal link to the maintainer. The deal page is public and needs no wallet.
              </li>
            </ol>
            <p>
              Write the line exactly as the maintainer should paste it. Matching is literal, so a
              line the maintainer reformats counts as missing.
            </p>
          </section>

          <section id="maintainers">
            <h2>For maintainers</h2>
            <ul>
              <li>Share an address on Base. No account, no sign-in, no fee and no gas.</li>
              <li>
                Add the sponsor&apos;s line to the pinned file, on the pinned branch, exactly as
                written.
              </li>
              <li>
                Each day the line is there when the check runs, that day&apos;s USDC arrives in your
                wallet. The checker pays the gas.
              </li>
              <li>
                Remove the line and the following days go back to the sponsor. Put it back and it
                earns again from the next check. Days already paid stay paid.
              </li>
            </ul>
          </section>

          <section id="check">
            <h2>The daily check</h2>
            <h3>What is read</h3>
            <p>
              The checker asks GitHub for the latest commit of the pinned branch, then reads the
              pinned file at that commit. The same file is served to everyone, so GitHub cannot show
              the checker one README and visitors another.
            </p>
            <h3>What counts as present</h3>
            <ul>
              <li>Some whole line of the file equals the pinned line.</li>
              <li>
                Line endings are normalised (CRLF and CR become LF) and trailing spaces and tabs are
                ignored. Nothing else is.
              </li>
              <li>
                A substring never counts: the line inside a longer line, or the line split across
                two, is missing.
              </li>
              <li>A pinned line that is empty or only whitespace never matches.</li>
            </ul>
            <p>
              The site&apos;s presence preview runs the same code as the checker. CI fails if the
              two copies ever differ.
            </p>
            <h3>When</h3>
            <p>
              Inside each day, at an offset derived from a private seed, the deal and the day. The
              maintainer cannot predict the minute, so adding the line only around a known check
              time does not work.
            </p>
          </section>

          <section id="timing">
            <h2>Timing</h2>
            <p>
              A deal starts at <code>start</code>. Day <code>d</code> (counting from 0) has a report
              window of{" "}
              <code>[start + d × dayLength, start + (d + 1) × dayLength + reportGrace)</code>. Once
              the window closes, the sponsor can reclaim the day if nobody reported it.
            </p>
            <div className="docs-scroll">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Deployment</th>
                    <th>dayLength</th>
                    <th>reportGrace</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Production</td>
                    <td>24 hours</td>
                    <td>48 hours</td>
                  </tr>
                  <tr>
                    <td>Demo</td>
                    <td>180 seconds</td>
                    <td>120 seconds</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Both values are fixed in the contract at deployment and cannot change. A deal can
              start up to 365 days ahead and run for up to 366 days.
            </p>
          </section>

          <section id="money">
            <h2>Money and fuel</h2>
            <ul>
              <li>
                <b>USDC</b> is the money. The sponsor locks price per day × days. There is no fee in
                USDC: every unit goes to the maintainer or back to the sponsor.
              </li>
              <li>
                <b>LINE</b> is the fuel. Each check spends 1 LINE, which is burned to{" "}
                <code>0x…dEaD</code>. The sponsor locks one LINE per day when opening. No fuel, no
                check, no payout. A reclaimed day returns its LINE.
              </li>
              <li>
                LINE has no owner and is never sold. Anyone can take 30 LINE a day from its faucet.
                {USDC_IS_FAUCET
                  ? " On this testnet deployment, demo USDC works the same way, 100 a day."
                  : ""}
              </li>
            </ul>
          </section>

          <section id="verify">
            <h2>Verify a day yourself</h2>
            <ol>
              <li>
                On a deal page, click a settled day. It opens the commit the checker read, on
                GitHub. Open the pinned file at that commit and search for the line.
              </li>
              <li>
                The day also links to its transaction on the block explorer. Its{" "}
                <code>DayReported</code> event holds the same commit hash, and whether the line was
                found.
              </li>
              <li>
                Compare the commit with the branch history. The hash proves what that commit
                contains, not that it was the commit visitors saw that day (see{" "}
                <a href="#limits">Limits</a>).
              </li>
            </ol>
            <p>Or read the contract directly:</p>
            <pre>
              <code>{`import { createPublicClient, http } from "viem";
import { ${chain.id === 8453 ? "base" : "baseSepolia"} } from "viem/chains";

const client = createPublicClient({ chain: ${chain.id === 8453 ? "base" : "baseSepolia"}, transport: http() });
const status = await client.readContract({
  address: "${MORNINGLINE}",
  abi: [{ type: "function", name: "dayStatus", stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [{ type: "uint8" }] }],
  functionName: "dayStatus",
  args: [1n, 0n], // deal 1, day 0
});
// 0 open, 1 paid, 2 refunded or reclaimed`}</code>
            </pre>
          </section>

          <section id="contracts">
            <h2>Contracts</h2>
            <p>This site talks to these addresses on {chain.name}.</p>
            <div className="docs-scroll">
              <table className="docs-table">
                <tbody>
                  <tr>
                    <th>MorningLine{IS_DEMO ? " (demo settings)" : ""}</th>
                    <td>
                      <Addr a={MORNINGLINE} />
                    </td>
                  </tr>
                  <tr>
                    <th>LINE fuel</th>
                    <td>
                      <Addr a={LINE} />
                    </td>
                  </tr>
                  <tr>
                    <th>{USDC_IS_FAUCET ? "Demo USDC" : "USDC"}</th>
                    <td>
                      <Addr a={USDC} />
                    </td>
                  </tr>
                  <tr>
                    <th>Checker</th>
                    <td>
                      <Addr a={CHECKER} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h3>Functions</h3>
            <div className="docs-scroll">
              <table className="docs-table">
                <tbody>
                  <tr>
                    <td>
                      <code>openDeal(payee, checker, dailyAmount, dayCount, start, spec)</code>
                    </td>
                    <td>Locks the USDC and fuel and emits the spec</td>
                  </tr>
                  <tr>
                    <td>
                      <code>report(dealId, day, present, commitSha)</code>
                    </td>
                    <td>Checker only, inside the day&apos;s window</td>
                  </tr>
                  <tr>
                    <td>
                      <code>reclaim(dealId, days)</code>
                    </td>
                    <td>Sponsor only, after the window closes</td>
                  </tr>
                  <tr>
                    <td>
                      <code>getDeal(dealId)</code>, <code>dayStatus(dealId, day)</code>,{" "}
                      <code>dayWindow(dealId, day)</code>, <code>dealCount()</code>
                    </td>
                    <td>Views</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h3>Events</h3>
            <ul>
              <li>
                <code>DealOpened</code> and <code>DealSpec(dealId, repo, branch, path, line)</code>{" "}
                when a deal is opened
              </li>
              <li>
                <code>DayReported(dealId, day, present, commitSha)</code> when a day is checked
              </li>
              <li>
                <code>DayReclaimed(dealId, day)</code> when a day is taken back
              </li>
            </ul>
          </section>

          <section id="api">
            <h2>Deal API</h2>
            <p>
              <code>GET /api/deal/[id]</code> returns a deal&apos;s spec and the evidence for every
              settled day. The deal page uses it; so can you.
            </p>
            <pre>
              <code>{`{
  "dealId": "1",
  "spec": { "repo": "owner/name", "branch": "main", "path": "README.md", "line": "…" },
  "reports": [
    { "day": 0, "present": true, "sha": "0xd606…", "tx": "0xb06d…" },
    { "day": 1, "present": null, "sha": null, "tx": "0x…" }
  ],
  "openedBlock": "54346255",
  "truncated": false
}`}</code>
            </pre>
            <p>
              <code>present: null</code> marks a reclaimed day. <code>truncated</code> is true only
              if the RPC failed to return an event; the day colours on the deal page come from
              contract state and are complete either way.
            </p>
            <p>
              The endpoint does not scan logs over wide ranges, which public RPCs refuse. It
              binary-searches contract state for the block the deal was opened in and the block each
              day was settled in, then reads the logs of those single blocks. It works for deals of
              any age on an RPC that serves historical state.
            </p>
          </section>

          <section id="limits">
            <h2>Limits</h2>
            <p>Shown on every deal page as well.</p>
            <NotPromised />
          </section>

          <section id="source">
            <h2>Source and security</h2>
            <ul>
              <li>
                <a href={REPO} target="_blank" rel="noreferrer">
                  Source on GitHub
                </a>
                , MIT licensed
              </li>
              <li>
                <a href={`${REPO}/blob/main/docs/SECURITY.md`} target="_blank" rel="noreferrer">
                  Trust and threat model
                </a>
              </li>
              <li>
                <a href={`${REPO}/blob/main/docs/ARCHITECTURE.md`} target="_blank" rel="noreferrer">
                  Architecture
                </a>{" "}
                and{" "}
                <a href={`${REPO}/blob/main/docs/DECISIONS.md`} target="_blank" rel="noreferrer">
                  decisions
                </a>
              </li>
            </ul>
          </section>
        </article>
      </div>
    </>
  );
}
