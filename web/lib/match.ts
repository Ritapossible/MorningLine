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
