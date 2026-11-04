import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { linePresent, normalize, normalizeLines } from "../src/match.ts";

const LINE = "Sponsored by [Acme](https://acme.example) - we pay for the days it stays up.";

describe("normalize", () => {
  it("turns CRLF and CR into LF", () => {
    assert.equal(normalize("a\r\nb\rc"), "a\nb\nc");
  });
  it("strips trailing spaces and tabs", () => {
    assert.equal(normalize("text  \t "), "text");
  });
  it("leaves leading whitespace alone", () => {
    assert.equal(normalize("  indented"), "  indented");
  });
});

describe("normalizeLines", () => {
  it("does not invent an empty final line for a trailing newline", () => {
    assert.deepEqual(normalizeLines("a\nb\n"), ["a", "b"]);
  });
  it("keeps genuine blank lines in the middle", () => {
    assert.deepEqual(normalizeLines("a\n\nb"), ["a", "", "b"]);
  });
});

describe("linePresent", () => {
  it("finds the line as a whole line", () => {
    assert.equal(linePresent(`# Project\n\n${LINE}\n\nMore text.\n`, LINE), true);
  });

  it("finds it when the file uses CRLF", () => {
    assert.equal(linePresent(`# Project\r\n\r\n${LINE}\r\n`, LINE), true);
  });

  it("finds it despite trailing whitespace in the file", () => {
    assert.equal(linePresent(`${LINE}   \n`, LINE), true);
  });

  it("finds it as the only line, with no trailing newline", () => {
    assert.equal(linePresent(LINE, LINE), true);
  });

  it("rejects a substring inside a longer line", () => {
    assert.equal(linePresent(`Once upon a time ${LINE} and then more.\n`, LINE), false);
  });

  it("rejects a line that only differs in case", () => {
    assert.equal(linePresent(LINE.toUpperCase() + "\n", LINE), false);
  });

  it("rejects a reformatted line (D8: literal, not meaning)", () => {
    assert.equal(linePresent("Sponsored by Acme - we pay for the days it stays up.\n", LINE), false);
  });

  it("rejects an empty file", () => {
    assert.equal(linePresent("", LINE), false);
  });

  it("never matches a blank spec line, even against a file full of blanks", () => {
    assert.equal(linePresent("\n\n\n", ""), false);
    assert.equal(linePresent("\n\n\n", "   "), false);
    assert.equal(linePresent("a\n\nb", "\t"), false);
  });

  it("matches a line that is indented, only if the spec is indented the same way", () => {
    assert.equal(linePresent(`  ${LINE}\n`, LINE), false);
    assert.equal(linePresent(`  ${LINE}\n`, `  ${LINE}`), true);
  });

  it("treats a missing file (empty string) as missing, not an error", () => {
    assert.doesNotThrow(() => linePresent("", LINE));
  });
});
