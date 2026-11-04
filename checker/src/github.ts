// Reading the pinned file from GitHub. Everything that means "the pinned spec no longer holds"
// resolves to missing, not an error (ARCHITECTURE, "Failure handling"). Anything that means "we
// could not look" throws, so the caller skips the day and retries next loop.

export class LookupFailed extends Error {}

const API = "https://api.github.com";

export type Resolved = { sha: `0x${string}`; shaHex: string };

function headers(token: string | undefined): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "morningline-checker",
  };
  if (token !== undefined && token !== "") h.Authorization = `Bearer ${token}`;
  return h;
}

/// Latest commit of `branch`. Null means the repo or branch is gone: that is a missing day.
/// Throws when GitHub could not answer, so the day is retried rather than settled on a guess.
export async function resolveCommit(
  repo: string,
  branch: string,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<Resolved | null> {
  const url = `${API}/repos/${repo}/commits/${encodeURIComponent(branch)}`;
  const res = await fetchImpl(url, { headers: headers(token) });

  if (res.status === 404) return null; // repo private, deleted, or branch renamed
  if (res.status === 403 || res.status === 429) throw new LookupFailed("rate limited");
  if (!res.ok) throw new LookupFailed(`commits returned ${res.status}`);

  const body = (await res.json()) as { sha?: string };
  const sha = body.sha;
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new LookupFailed("commits returned no usable sha");
  }
  return { sha: `0x${sha}` as `0x${string}`, shaHex: sha };
}

/// The raw file at an exact commit. Null means the file is not there: a missing day.
export async function readFileAtCommit(
  repo: string,
  path: string,
  sha: string,
  token: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `${API}/repos/${repo}/contents/${encodedPath}?ref=${sha}`;
  const res = await fetchImpl(url, {
    headers: { ...headers(token), Accept: "application/vnd.github.raw" },
  });

  if (res.status === 404) return null; // file moved or deleted at this commit
  if (res.status === 403 || res.status === 429) throw new LookupFailed("rate limited");
  if (!res.ok) throw new LookupFailed(`contents returned ${res.status}`);

  return await res.text();
}

/// "owner/name", as stored in the spec. Rejects anything else so a malformed spec cannot be
/// turned into a request for some other path on the API.
export function isWellFormedRepo(repo: string): boolean {
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo);
}
