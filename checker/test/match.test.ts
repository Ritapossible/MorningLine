import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { linePresent, normalize, normalizeLines, repoImagePaths } from "../src/match.ts";

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

describe("repoImagePaths", () => {
  it("resolves markdown and HTML images relative to the pinned file", () => {
    assert.deepEqual(repoImagePaths("![a](logo.png) <img src='./img/b.svg' width=72>", "docs/README.md"), [
      "docs/logo.png",
      "docs/img/b.svg",
    ]);
  });
  it("treats a leading slash as the repository root", () => {
    assert.deepEqual(repoImagePaths("![a](/assets/logo.png)", "docs/README.md"), ["assets/logo.png"]);
  });
  it("follows .. within the repository", () => {
    assert.deepEqual(repoImagePaths("![a](../logo.png)", "docs/README.md"), ["logo.png"]);
  });
  it("rejects a path that climbs out of the repository", () => {
    assert.equal(repoImagePaths("![a](../../logo.png)", "docs/README.md"), null);
  });
  it("ignores images on other hosts, data URLs and anchors", () => {
    assert.deepEqual(
      repoImagePaths('![a](https://x.example/a.png) ![b](//cdn.example/b.png) ![c](data:image/png;base64,AA) <img src="#top">', "README.md"),
      [],
    );
  });
  it("drops query strings and decodes escapes", () => {
    assert.deepEqual(repoImagePaths("![a](my%20logo.png?raw=true)", "README.md"), ["my logo.png"]);
  });
  it("lists each image once, and nothing for a plain line", () => {
    assert.deepEqual(repoImagePaths("![a](l.png) ![b](l.png)", "README.md"), ["l.png"]);
    assert.deepEqual(repoImagePaths("Sponsored by Acme", "README.md"), []);
  });
});
