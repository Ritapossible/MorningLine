// One deal-day, decided: present or missing, the commit that was read, and a hash of the file.
import { keccak256, toBytes } from "viem";
import { linePresent, repoImagePaths } from "./match.ts";
import { fileExistsAtCommit, isWellFormedRepo, readFileAtCommit, resolveCommit } from "./github.ts";

export const ZERO_SHA = `0x${"00".repeat(20)}` as const;
export const ZERO_HASH = `0x${"00".repeat(32)}` as const;

export type Spec = { repo: string; branch: string; path: string; line: string };
export type Decision = {
  present: boolean;
  sha: `0x${string}`;
  /// keccak256 of the file's text as GitHub served it at `sha`, or zero if there was no file.
  /// Recorded on chain, so the evidence survives the repository: anyone holding a copy of the
  /// file can show it is the one that was read.
  fileHash: `0x${string}`;
  reason: string;
};

/// Decide one deal-day.
///
/// Throws only when GitHub could not be read (the caller retries next loop). Everything that
/// means the pinned spec no longer holds is a missing day, reported with whatever commit we
/// managed to resolve. A missing day may carry the zero sha and hash; the contract requires both
/// only when `present` is true.
export async function decide(
  spec: Spec,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Decision> {
  if (!isWellFormedRepo(spec.repo)) {
    return { present: false, sha: ZERO_SHA, fileHash: ZERO_HASH, reason: "repo is not owner/name" };
  }

  const commit = await resolveCommit(spec.repo, spec.branch, token, fetchImpl);
  if (commit === null) {
    return { present: false, sha: ZERO_SHA, fileHash: ZERO_HASH, reason: "repo or branch not found" };
  }

  const contents = await readFileAtCommit(spec.repo, spec.path, commit.shaHex, token, fetchImpl);
  if (contents === null) {
    return { present: false, sha: commit.sha, fileHash: ZERO_HASH, reason: "file not found at commit" };
  }
  const fileHash = keccak256(toBytes(contents));

  if (!linePresent(contents, spec.line)) {
    return { present: false, sha: commit.sha, fileHash, reason: "line not in file" };
  }

  // An image the line shows from the repo must be in the same commit.
  const images = repoImagePaths(spec.line, spec.path);
  if (images === null) {
    return { present: false, sha: commit.sha, fileHash, reason: "line points at an image outside the repo" };
  }
  for (const image of images) {
    if (!(await fileExistsAtCommit(spec.repo, image, commit.shaHex, token, fetchImpl))) {
      return { present: false, sha: commit.sha, fileHash, reason: `image ${image} not in the repo at this commit` };
    }
  }

  return { present: true, sha: commit.sha, fileHash, reason: images.length > 0 ? "line and images found" : "line found" };
}
