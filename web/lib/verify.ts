// Independent checks of what the checker reported, run in the visitor's browser against GitHub.
// The contract cannot see GitHub, so the checker is trusted for which commit it read. These
// checks make that trust cheap to audit: every reported commit is tested, not just available
// for someone to test.
//
// - In history: the commit is an ancestor of (or equal to) the pinned branch's current head, so
//   it really was on that branch, not on some other branch or fork.
// - File matches: the file at that commit hashes to the fileHash recorded on chain, so the file
//   the checker says it read is exactly the one anyone can open.
import { keccak256, toBytes } from "viem";

export type Verdict = {
  /// true: on the branch's history. false: not on it. null: could not tell (rate limit, error).
  inHistory: boolean | null;
  /// true / false as above; null when there is nothing to compare (no hash) or no answer.
  fileMatches: boolean | null;
};

const API = "https://api.github.com";
const ZERO_HASH = `0x${"00".repeat(32)}`;
const cache = new Map<string, Promise<Verdict>>();

export function verifyReport(
  repo: string,
  branch: string,
  path: string,
  sha: string,
  fileHash: string | null,
): Promise<Verdict> {
  const shaHex = sha.replace(/^0x/, "").toLowerCase();
  const key = `${repo}|${branch}|${path}|${shaHex}|${fileHash ?? ""}`;
  let p = cache.get(key);
  if (!p) {
    p = run(repo, branch, path, shaHex, fileHash);
    cache.set(key, p);
  }
  return p;
}

async function run(repo: string, branch: string, path: string, shaHex: string, fileHash: string | null): Promise<Verdict> {
  const [inHistory, fileMatches] = await Promise.all([
    onBranch(repo, branch, shaHex),
    sameFile(repo, path, shaHex, fileHash),
  ]);
  return { inHistory, fileMatches };
}

async function onBranch(repo: string, branch: string, shaHex: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${API}/repos/${repo}/compare/${shaHex}...${encodeURIComponent(branch)}`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (res.status === 404) return false; // the commit is not in this repository at all
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: string };
    if (body.status === "identical" || body.status === "ahead") return true;
    if (body.status === "behind" || body.status === "diverged") return false;
    return null;
  } catch {
    return null;
  }
}

async function sameFile(repo: string, path: string, shaHex: string, fileHash: string | null): Promise<boolean | null> {
  if (fileHash === null || fileHash.toLowerCase() === ZERO_HASH) return null;
  try {
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/${shaHex}/${encoded}`);
    if (!res.ok) return null;
    const text = await res.text();
    return keccak256(toBytes(text)).toLowerCase() === fileHash.toLowerCase();
  } catch {
    return null;
  }
}
