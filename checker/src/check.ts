// One deal-day, decided: present or missing, and the commit that was read.
import { linePresent } from "./match.ts";
import { isWellFormedRepo, readFileAtCommit, resolveCommit } from "./github.ts";

export const ZERO_SHA = `0x${"00".repeat(20)}` as const;

export type Spec = { repo: string; branch: string; path: string; line: string };
export type Decision = { present: boolean; sha: `0x${string}`; reason: string };

/// Decide one deal-day.
///
/// Throws only when GitHub could not be read (the caller retries next loop). Everything that
/// means the pinned spec no longer holds is a missing day, reported with whatever commit we
/// managed to resolve. A missing day may carry the zero sha; the contract only requires a
/// non-zero sha when `present` is true.
export async function decide(
  spec: Spec,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Decision> {
  if (!isWellFormedRepo(spec.repo)) {
    return { present: false, sha: ZERO_SHA, reason: "repo is not owner/name" };
  }

  const commit = await resolveCommit(spec.repo, spec.branch, token, fetchImpl);
  if (commit === null) {
    return { present: false, sha: ZERO_SHA, reason: "repo or branch not found" };
  }

  const contents = await readFileAtCommit(spec.repo, spec.path, commit.shaHex, token, fetchImpl);
  if (contents === null) {
    return { present: false, sha: commit.sha, reason: "file not found at commit" };
  }

  const present = linePresent(contents, spec.line);
  return { present, sha: commit.sha, reason: present ? "line found" : "line not in file" };
}
