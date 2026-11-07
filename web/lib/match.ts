// The matching rule (DECISIONS D8). Present means some whole line of the pinned file equals the
// spec line exactly, after newline and trailing-whitespace normalization. Substrings never count,
// so a sponsor line inside a longer line or a code fence does not match by accident.
//
// Pure and dependency free on purpose: this is the rule that decides where a day's money goes, so
// it is the part that must be easiest to read and to test.

/// CRLF and CR become LF; trailing spaces and tabs are stripped from the end of the string.
export function normalize(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/[ \t]+$/, "");
}

/// Split into lines, each normalized. A trailing newline does not add an empty final line.
export function normalizeLines(contents: string): string[] {
  const unified = contents.replace(/\r\n?/g, "\n");
  const lines = unified.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.map((l) => l.replace(/[ \t]+$/, ""));
}

/// True when the file contains the spec line as a whole line.
///
/// A spec line that is empty or only whitespace never matches: the contract allows any 1..512
/// byte string, and a blank spec would otherwise match every blank line in the file and pay out
/// for nothing.
export function linePresent(fileContents: string, specLine: string): boolean {
  const want = normalize(specLine);
  if (want.trim() === "") return false;
  return normalizeLines(fileContents).includes(want);
}

/// Images the sponsor line shows from the repository itself, as repo paths, or null if the line
/// points at an image path that can never exist (one that climbs out of the repository).
///
/// A repo image is part of the evidence: the same commit that holds the line must hold the
/// image, so a logo deleted from the repo counts as missing even if the line stays. Images on
/// other hosts are not covered: another server can show the checker one picture and visitors
/// another, which no commit can settle. Relative paths resolve from the pinned file's folder, a
/// leading "/" from the repository root, as GitHub renders them.
export function repoImagePaths(specLine: string, filePath: string): string[] | null {
  const refs: string[] = [];
  for (const m of specLine.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g)) {
    if (m[1] !== undefined) refs.push(m[1]);
  }
  for (const m of specLine.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    if (m[1] !== undefined) refs.push(m[1]);
  }

  const dir = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")).split("/") : [];
  const out: string[] = [];
  for (const raw of refs) {
    const ref = raw.trim();
    // Another host, a protocol-relative URL, inline data or an in-page anchor: not in the repo.
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//") || ref.startsWith("#")) continue;
    let path = ref.split(/[?#]/)[0] ?? "";
    try {
      path = decodeURIComponent(path);
    } catch {
      return null;
    }
    const parts = path.startsWith("/") ? [] : [...dir];
    for (const seg of path.split("/")) {
      if (seg === "" || seg === ".") continue;
      if (seg === "..") {
        if (parts.length === 0) return null;
        parts.pop();
      } else {
        parts.push(seg);
      }
    }
    if (parts.length === 0) return null;
    const resolved = parts.join("/");
    if (!out.includes(resolved)) out.push(resolved);
  }
  return out;
}
