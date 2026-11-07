"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { MORNINGLINE, morningLineAbi } from "../../lib/contracts";
import { usd } from "../../lib/format";
import { defaultBranch, fileAtCommit, GitHubError, latestCommit, parseRepo } from "../../lib/github";
import { linePresent } from "../../lib/match";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
/// How many of the newest deals "Your deals" looks through.
const SCAN = 200;

export function MaintainerTools() {
  return (
    <>
      <SponsorLink />
      <YourDeals />
    </>
  );
}

/// Builds a /new link with everything but the payment filled in, after checking the line is in
/// the file right now, so the sponsor never opens a deal against a line that is not there.
function SponsorLink() {
  const { address } = useAccount();
  const [repoInput, setRepoInput] = useState("");
  const [branch, setBranch] = useState("");
  const [path, setPath] = useState("README.md");
  const [line, setLine] = useState("");
  const [payee, setPayee] = useState("");
  const [price, setPrice] = useState("1");
  const [days, setDays] = useState("30");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const payeeValue = payee.trim() === "" && address ? address : payee.trim();

  async function make() {
    setError(null);
    setLink(null);
    setCopied(false);
    const repo = parseRepo(repoInput);
    if (repo === null) return setError("That does not look like a GitHub repo. Try owner/name or the repo URL.");
    if (line.trim() === "") return setError("Paste the sponsor line exactly as it is in your README.");
    if (!ADDRESS.test(payeeValue)) return setError("Enter the address on Base that should be paid.");
    if (!(Number(price) > 0)) return setError("Enter a price per day above zero.");
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 366) return setError("Days must be a whole number from 1 to 366.");

    setChecking(true);
    try {
      const b = branch.trim() === "" ? await defaultBranch(repo) : branch.trim();
      const head = await latestCommit(repo, b);
      const body = await fileAtCommit(repo, path.trim(), head);
      if (body === null) {
        setError(`There is no ${path.trim()} on ${b}.`);
      } else if (!linePresent(body, line)) {
        setError(
          `That line is not in ${path.trim()} on ${b} right now. Add it exactly as written, commit, then try again.`,
        );
      } else {
        const q = new URLSearchParams({
          repo,
          branch: b,
          path: path.trim(),
          line,
          payee: payeeValue,
          price: price.trim(),
          days: String(d),
        });
        setLink(`${window.location.origin}/new?${q.toString()}`);
      }
    } catch (e) {
      setError(e instanceof GitHubError ? e.message : "Could not read that repo.");
    }
    setChecking(false);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: 18 }} id="link">
      <h3>Make a sponsor link</h3>
      <label className="field">
        <span>Repository</span>
        <input
          type="text"
          placeholder="owner/name, or the GitHub URL"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
        />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>
            Branch <span className="hint">(blank for the default)</span>
          </span>
          <input type="text" placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} />
        </label>
        <label className="field">
          <span>File</span>
          <input type="text" value={path} onChange={(e) => setPath(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>
          Sponsor line <span className="hint">(already in the file, exactly as written)</span>
        </span>
        <input
          type="text"
          className="mono"
          placeholder="Sponsored by [Acme](https://acme.xyz)"
          value={line}
          onChange={(e) => setLine(e.target.value)}
        />
      </label>
      <label className="field">
        <span>
          Your address on Base <span className="hint">(where each paid day goes)</span>
        </span>
        <input
          type="text"
          placeholder={address ?? "0x"}
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
        />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>
            Price per day <span className="hint">(USDC)</span>
          </span>
          <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="field">
          <span>
            Days <span className="hint">(1 to 366)</span>
          </span>
          <input type="number" min={1} max={366} value={days} onChange={(e) => setDays(e.target.value)} />
        </label>
      </div>
      <button className="primary" onClick={make} disabled={checking}>
        {checking ? "Checking your README" : "Check the line and make the link"}
      </button>
      {error ? (
        <p className="notice warn" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
      {link ? (
        <div style={{ marginTop: 16 }}>
          <p className="notice good">The line is in your README. Send this link to your sponsor.</p>
          <div className="chosen" style={{ marginTop: 8, wordBreak: "break-all" }}>
            {link}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
            <a href={link} target="_blank" rel="noreferrer" className="small">
              Preview what your sponsor sees ↗
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/// Every deal paying an address, read straight from the contract.
function YourDeals() {
  const { address } = useAccount();
  const [input, setInput] = useState("");
  const who = (input.trim() === "" && address ? address : input.trim()).toLowerCase();
  const valid = ADDRESS.test(who);

  const { data: count } = useReadContract({ address: MORNINGLINE, abi: morningLineAbi, functionName: "dealCount" });
  const total = count === undefined ? 0 : Number(count);
  const ids = useMemo(
    () => Array.from({ length: Math.min(SCAN, total) }, (_, i) => BigInt(total - i)),
    [total],
  );
  const { data: deals, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: MORNINGLINE,
      abi: morningLineAbi,
      functionName: "getDeal" as const,
      args: [id] as const,
    })),
    query: { enabled: valid && ids.length > 0 },
  });

  const mine = valid
    ? ids
        .map((id, i) => ({ id, d: deals?.[i]?.result }))
        .filter((x) => x.d !== undefined && x.d.payee.toLowerCase() === who)
    : [];

  return (
    <section className="card" style={{ marginTop: 18 }} id="deals">
      <h3>Your deals</h3>
      <label className="field">
        <span>Your address on Base</span>
        <input type="text" placeholder={address ?? "0x"} value={input} onChange={(e) => setInput(e.target.value)} />
      </label>
      {!valid ? (
        <p className="small" style={{ marginBottom: 0 }}>
          Enter the address you are paid at to see every deal paying it.
        </p>
      ) : isLoading ? (
        <p className="small" style={{ marginBottom: 0 }}>
          Reading the contract…
        </p>
      ) : mine.length === 0 ? (
        <p className="small" style={{ marginBottom: 0 }}>
          No deals pay this address yet.
        </p>
      ) : (
        <dl className="kv">
          {mine.map(({ id, d }) =>
            d ? (
              <div key={id.toString()} style={{ display: "contents" }}>
                <dt>
                  <Link href={`/deal/${id}`}>Deal {id.toString()}</Link>
                </dt>
                <dd>
                  ${usd(d.dailyAmount)} a day · {d.settled} of {d.dayCount} days settled
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      )}
    </section>
  );
}
