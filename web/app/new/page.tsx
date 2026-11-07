"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { decodeEventLog, parseUnits } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  CHAIN_ID,
  IS_DEMO,
  LINE,
  CHECKER,
  CHECKER_RETIRED,
  MORNINGLINE,
  USDC,
  USDC_IS_FAUCET,
  erc20Abi,
  faucetAbi,
  morningLineAbi,
} from "../../lib/contracts";
import { defaultBranch, fileAtCommit, GitHubError, latestCommit, parseRepo } from "../../lib/github";
import { linePresent, normalize, normalizeLines } from "../../lib/match";
import { Wallet } from "../../components/Wallet";
import { useWrite } from "../../lib/useWrite";
import { PRIVY_APP_ID } from "../../lib/auth";
import { usd } from "../../lib/format";

/// The contract rejects a start that is already in the past, and the transaction needs time to
/// mine, so day 0 always begins a minute out.
const START_BUFFER = 60n;


export default function NewDeal() {
  const router = useRouter();
  const { address, isConnected, chainId } = useAccount();
  const { write, sponsored } = useWrite();
  // A wallet made by email sign-in starts empty, and every step below costs a little gas.
  const { data: gas } = useBalance({ address, query: { enabled: Boolean(address) } });
  const noGas = gas !== undefined && gas.value === 0n && !sponsored;
  const publicClient = usePublicClient();

  const [repoInput, setRepoInput] = useState("");
  const [branch, setBranch] = useState("");
  const [path, setPath] = useState("README.md");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [repo, setRepo] = useState("");
  const [sha, setSha] = useState("");
  const [lines, setLines] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  const [payee, setPayee] = useState("");
  const [price, setPrice] = useState("1");
  const [days, setDays] = useState("3");

  const [busy, setBusy] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [openHash, setOpenHash] = useState<`0x${string}` | undefined>();

  // A maintainer's sponsor link (/maintainers) pre-fills this form: repo, branch, file, their
  // address, price, days, and the line they have already added. The file is then read and that
  // line selected, so the sponsor only reviews and signs. Nothing is trusted blindly: the line
  // is selected only if it is really in the file right now.
  const [fromLink, setFromLink] = useState(false);
  const [autoLoad, setAutoLoad] = useState(false);
  const wantLine = useRef<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("repo");
    if (!r) return;
    setRepoInput(r);
    if (q.get("branch")) setBranch(q.get("branch") ?? "");
    if (q.get("path")) setPath(q.get("path") ?? "README.md");
    if (q.get("payee")) setPayee(q.get("payee") ?? "");
    if (q.get("price")) setPrice(q.get("price") ?? "1");
    if (q.get("days")) setDays(q.get("days") ?? "3");
    wantLine.current = q.get("line");
    setFromLink(true);
    setAutoLoad(true);
  }, []);

  const specLine = picked !== null && lines ? (lines[picked] ?? "") : "";
  const dayCount = Math.max(1, Math.min(366, Number(days) || 1));
  const dailyAmount = useMemo(() => {
    try {
      return parseUnits(price || "0", 6);
    } catch {
      return 0n;
    }
  }, [price]);
  const totalUsdc = dailyAmount * BigInt(dayCount);

  const { data: fuelPerCheck } = useReadContract({
    address: MORNINGLINE,
    abi: morningLineAbi,
    functionName: "fuelPerCheck",
  });
  const totalFuel = (fuelPerCheck ?? 0n) * BigInt(dayCount);

  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: USDC, abi: erc20Abi, functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: lineBalance, refetch: refetchLine } = useReadContract({
    address: LINE, abi: erc20Abi, functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: usdcAllowance, refetch: refetchUsdcAllow } = useReadContract({
    address: USDC, abi: erc20Abi, functionName: "allowance",
    args: address ? [address, MORNINGLINE] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: lineAllowance, refetch: refetchLineAllow } = useReadContract({
    address: LINE, abi: erc20Abi, functionName: "allowance",
    args: address ? [address, MORNINGLINE] : undefined,
    query: { enabled: Boolean(address) },
  });

  useWaitForTransactionReceipt({ hash: openHash });

  async function load() {
    setLoadError(null);
    setLines(null);
    setPicked(null);
    const parsed = parseRepo(repoInput);
    if (parsed === null) {
      setLoadError("That does not look like a GitHub repo. Try owner/name or the repo URL.");
      return;
    }
    setLoading(true);
    try {
      const b = branch.trim() === "" ? await defaultBranch(parsed) : branch.trim();
      const head = await latestCommit(parsed, b);
      const body = await fileAtCommit(parsed, path.trim(), head);
      if (body === null) {
        setLoadError(`There is no ${path.trim()} at the latest commit of ${b}.`);
        setLoading(false);
        return;
      }
      setRepo(parsed);
      setBranch(b);
      setSha(head);
      const fileLines = normalizeLines(body);
      setLines(fileLines);
      if (wantLine.current !== null) {
        const want = normalize(wantLine.current);
        const i = fileLines.findIndex((l) => l === want && l.trim() !== "");
        if (i >= 0) setPicked(i);
        else setLoadError("The line in this link is not in the file right now. Pick the line below.");
        wantLine.current = null;
      }
    } catch (e) {
      setLoadError(e instanceof GitHubError ? e.message : "Could not read that repo.");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!autoLoad || repoInput === "") return;
    setAutoLoad(false);
    void load();
    // load reads the fields set by the link; run it once they are in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, repoInput]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setTxError(null);
    try {
      await fn();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setTxError(m.split("\n")[0] ?? m);
    }
    setBusy(null);
  }

  async function drip(token: `0x${string}`, after: () => void) {
    const hash = await write({ address: token, abi: faucetAbi, functionName: "drip" });
    await publicClient?.waitForTransactionReceipt({ hash });
    after();
  }

  async function approve(token: `0x${string}`, amount: bigint, after: () => void) {
    const hash = await write({
      address: token, abi: erc20Abi, functionName: "approve", args: [MORNINGLINE, amount],
    });
    await publicClient?.waitForTransactionReceipt({ hash });
    after();
  }

  async function openDeal() {
    if (!publicClient) throw new Error("No RPC connection.");
    const now = (await publicClient.getBlock()).timestamp;
    const start = now + START_BUFFER;

    const hash = await write({
      address: MORNINGLINE,
      abi: morningLineAbi,
      functionName: "openDeal",
      args: [
        payee.trim() as `0x${string}`,
        CHECKER,
        dailyAmount,
        dayCount,
        Number(start),
        { repo, branch, path: path.trim(), line: specLine },
      ],
    });
    setOpenHash(hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: morningLineAbi, topics: log.topics, data: log.data });
        if (ev.eventName === "DealSpec") {
          router.push(`/deal/${(ev.args as { dealId: bigint }).dealId}`);
          return;
        }
      } catch {
        // not one of ours
      }
    }
    router.push("/");
  }

  const wrongChain = isConnected && chainId !== CHAIN_ID;
  const payeeOk = /^0x[0-9a-fA-F]{40}$/.test(payee.trim());
  const ready = repo !== "" && specLine !== "" && payeeOk && dailyAmount > 0n && dayCount >= 1;
  const needUsdc = (usdcAllowance ?? 0n) < totalUsdc;
  const needLine = (lineAllowance ?? 0n) < totalFuel;
  const shortUsdc = (usdcBalance ?? 0n) < totalUsdc;
  const shortLine = (lineBalance ?? 0n) < totalFuel;

  return (
    <>
      <h1>Open a deal</h1>
      <p className="lede">
        Pin a repo, a branch, a file and one exact line. From then on, each day that line is in
        the file pays the maintainer, and each day it is not refunds you.
      </p>

      {fromLink ? (
        <p className="notice good" style={{ marginTop: 16 }}>
          Filled in from a maintainer&apos;s sponsor link. Check the line and the terms, then sign.
        </p>
      ) : null}

      <div className="signin-row">
        <span className="small">
          {isConnected ? "Signed in. You sign once the steps below are filled in." : "You will need to sign in to pay, at step 4. You can do it now."}
        </span>
        <Wallet />
      </div>

      {/* ---------------------------------------------------------- step 1 */}
      <section className="card" style={{ marginTop: 24 }}>
        <h3>1. The file to watch</h3>
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
            <span>Branch <span className="hint">(blank for the default)</span></span>
            <input type="text" placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </label>
          <label className="field">
            <span>File</span>
            <input type="text" value={path} onChange={(e) => setPath(e.target.value)} />
          </label>
        </div>
        <div className="row">
          <button onClick={load} disabled={loading || repoInput.trim() === ""}>
            {loading ? "Reading GitHub" : "Read the file"}
          </button>
          {sha !== "" ? (
            <span className="small mono">at {sha.slice(0, 7)}</span>
          ) : null}
        </div>
        {loadError ? <p className="notice warn" style={{ marginTop: 12 }}>{loadError}</p> : null}
      </section>

      {/* ---------------------------------------------------------- step 2 */}
      {lines ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>2. Click the exact line</h3>
          <p className="small">
            Matching is literal, not approximate, so the line is chosen from the file rather than
            typed. Trailing spaces are ignored; everything else must match byte for byte.
          </p>
          <div className="filebox">
            {lines.map((l, i) => (
              <button
                key={i}
                className={`fileline${picked === i ? " picked" : ""}${l.trim() === "" ? " blank" : ""}`}
                onClick={() => setPicked(i)}
                disabled={l.trim() === ""}
                title={l.trim() === "" ? "A blank line can never match" : "Pin this line"}
              >
                <span className="n">{i + 1}</span>
                <span className="t">{l === "" ? " " : l}</span>
              </button>
            ))}
          </div>
          {picked !== null ? (
            <div style={{ marginTop: 14 }}>
              <h3>Pinned line</h3>
              <div className="chosen">{specLine}</div>
              <p className="small" style={{ marginTop: 8 }}>
                {linePresent(lines.join("\n"), specLine)
                  ? "Present in the file right now."
                  : "Not present, which should not happen: reload the file."}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ---------------------------------------------------------- step 3 */}
      {picked !== null ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>3. Terms</h3>
          <label className="field">
            <span>Maintainer address <span className="hint">(who gets paid for a day that holds)</span></span>
            <input type="text" placeholder="0x" value={payee} onChange={(e) => setPayee(e.target.value)} />
          </label>
          {payee.trim() !== "" && !payeeOk ? (
            <p className="notice warn">That is not a 20 byte address.</p>
          ) : null}
          <div className="grid-2">
            <label className="field">
              <span>Price per day <span className="hint">(USDC)</span></span>
              <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="field">
              <span>Days <span className="hint">(1 to 366)</span></span>
              <input type="number" min={1} max={366} value={days} onChange={(e) => setDays(e.target.value)} />
            </label>
          </div>
          <dl className="kv" style={{ marginTop: 6 }}>
            <dt>Locked now</dt>
            <dd>{usd(totalUsdc)} USDC and {dayCount} LINE</dd>
            <dt>Most the maintainer can earn</dt>
            <dd>{usd(totalUsdc)} USDC</dd>
            <dt>Checker</dt>
            <dd>{CHECKER}</dd>
          </dl>
          <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
            Every day is either paid to the maintainer or returned to you. Nothing is kept by
            anyone else, and the fuel for a day nobody checks comes back with the refund. The
            checker is fixed here and cannot be you or the maintainer: a deal where one side
            checks its own line proves nothing.
          </p>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- step 4 */}
      {ready ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>4. Sign</h3>

          {CHECKER_RETIRED ? (
            <p className="notice warn">
              Opening deals is paused while the checker is replaced. A deal opened now would name a
              checker that is no longer running, so nobody would report its days. Existing deals
              are not affected.
            </p>
          ) : !isConnected || wrongChain ? (
            <>
              <p className="small">
                {!isConnected
                  ? PRIVY_APP_ID
                    ? "Signing needs a wallet. Sign in with email or Google and one is made for you, or use your own."
                    : "Signing needs a wallet on Base, such as Coinbase Wallet or MetaMask."
                  : "Your wallet is on another network."}
              </p>
              <Wallet />
            </>
          ) : (
            <>
              {noGas ? (
                <p className="notice warn" style={{ marginBottom: 16 }}>
                  This wallet has no ETH for gas yet. Each step below costs a fraction of a cent.
                  Send a little {IS_DEMO ? "Base Sepolia ETH (free from any Base Sepolia faucet)" : "ETH on Base"} to{" "}
                  <span className="mono">{address}</span>, then continue.
                </p>
              ) : null}
              {IS_DEMO && (shortUsdc || shortLine) ? (
                <div className="row" style={{ marginBottom: 14 }}>
                  {shortUsdc && USDC_IS_FAUCET ? (
                    <button
                      disabled={busy !== null}
                      onClick={() => run("usdc-drip", () => drip(USDC, () => void refetchUsdc()))}
                    >
                      {busy === "usdc-drip" ? "Dripping" : "Get demo USDC"}
                    </button>
                  ) : null}
                  {shortLine ? (
                    <button
                      disabled={busy !== null}
                      onClick={() => run("line-drip", () => drip(LINE, () => void refetchLine()))}
                    >
                      {busy === "line-drip" ? "Dripping" : "Get LINE fuel"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {shortUsdc && !USDC_IS_FAUCET ? (
                <p className="notice warn">
                  You hold {usd(usdcBalance ?? 0n)} USDC and this deal locks {usd(totalUsdc)}.
                </p>
              ) : null}

              <div className="row">
                <button
                  disabled={busy !== null || !needUsdc || shortUsdc}
                  onClick={() => run("usdc", () => approve(USDC, totalUsdc, () => void refetchUsdcAllow()))}
                >
                  {busy === "usdc" ? "Approving" : needUsdc ? "Approve USDC" : "USDC approved"}
                </button>
                <button
                  disabled={busy !== null || !needLine || shortLine}
                  onClick={() => run("line", () => approve(LINE, totalFuel, () => void refetchLineAllow()))}
                >
                  {busy === "line" ? "Approving" : needLine ? "Approve LINE" : "LINE approved"}
                </button>
                <button
                  className="primary"
                  disabled={busy !== null || needUsdc || needLine || shortUsdc || shortLine}
                  onClick={() => run("open", openDeal)}
                >
                  {busy === "open" ? "Opening" : "Open the deal"}
                </button>
              </div>

              <p className="small" style={{ marginTop: 12, marginBottom: 0 }}>
                Day 1 begins a minute from signing, so the transaction has time to land.
              </p>
            </>
          )}

          {txError ? <p className="notice warn" style={{ marginTop: 12 }}>{txError}</p> : null}
        </section>
      ) : (
        <section className="card" style={{ marginTop: 18 }}>
          <h3>4. Sign</h3>
          <p className="small" style={{ marginBottom: 0 }}>
            {lines === null
              ? "Read the file in step 1 first."
              : picked === null
                ? "Click the line you are paying for in step 2."
                : "Enter the maintainer's address, a price and a number of days in step 3."}{" "}
            Then you approve the tokens and open the deal here.
          </p>
        </section>
      )}
    </>
  );
}
