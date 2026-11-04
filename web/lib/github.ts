// Browser-side GitHub reads. The deal page and the composer both read exactly what the checker
// will read: the pinned file at the latest commit of the pinned branch. Unauthenticated calls
// are limited to 60 an hour per IP, which is plenty for one person filling in a form.

const API = "https://api.github.com";

export class GitHubError extends Error {}

/// Accepts a browser URL, an SSH-ish path or a bare owner/name, and returns "owner/name".
export function parseRepo(input: string): string | null {
  const s = input.trim().replace(/\.git$/, "").replace(/\/+$/, "");
  if (s === "") return null;

  const url = s.match(/github\.com[/:]([^/]+)\/([^/#?]+)/i);
  if (url) return `${url[1]}/${url[2]}`;

  const bare = s.match(/^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/);
  if (bare) return `${bare[1]}/${bare[2]}`;

  return null;
}

async function get(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Accept: accept, "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (res.status === 403 || res.status === 429) {
    throw new GitHubError("GitHub rate limit reached. Wait a minute and try again.");
  }
  return res;
}

export async function defaultBranch(repo: string): Promise<string> {
  const res = await get(`${API}/repos/${repo}`, "application/vnd.github+json");
  if (res.status === 404) throw new GitHubError("No public repo at that address.");
  if (!res.ok) throw new GitHubError(`GitHub returned ${res.status}.`);
  const body = (await res.json()) as { default_branch?: string };
  return body.default_branch ?? "main";
}

export async function latestCommit(repo: string, branch: string): Promise<string> {
  const res = await get(`${API}/repos/${repo}/commits/${encodeURIComponent(branch)}`, "application/vnd.github+json");
  if (res.status === 404) throw new GitHubError(`No branch called ${branch}.`);
  if (!res.ok) throw new GitHubError(`GitHub returned ${res.status}.`);
  const body = (await res.json()) as { sha?: string };
  if (typeof body.sha !== "string") throw new GitHubError("GitHub returned no commit.");
  return body.sha;
}

/// The raw file at an exact commit. Null means it is not there, which is a missing day.
export async function fileAtCommit(repo: string, path: string, ref: string): Promise<string | null> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const res = await get(`${API}/repos/${repo}/contents/${encoded}?ref=${ref}`, "application/vnd.github.raw");
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubError(`GitHub returned ${res.status}.`);
  return await res.text();
}

export const commitUrl = (repo: string, sha: string) => `https://github.com/${repo}/commit/${sha}`;
export const blobUrl = (repo: string, sha: string, path: string) =>
  `https://github.com/${repo}/blob/${sha}/${path}`;
