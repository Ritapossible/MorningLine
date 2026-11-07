import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { keccak256, toBytes } from "viem";
import { decide, ZERO_HASH, ZERO_SHA } from "../src/check.ts";
import { LookupFailed } from "../src/github.ts";

const SHA = "a".repeat(40);
const LINE = "Sponsored by Acme.";
const SPEC = { repo: "Ritapossible/MorningLine", branch: "main", path: "README.md", line: LINE };

/// A fetch that answers the two endpoints decide() uses.
function fakeFetch(opts: {
  commitStatus?: number;
  sha?: string;
  fileStatus?: number;
  body?: string;
  /// Repo files other than the pinned one that exist at the commit (images).
  images?: string[];
}): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/commits/")) {
      const status = opts.commitStatus ?? 200;
      if (status !== 200) return new Response("", { status });
      return new Response(JSON.stringify({ sha: opts.sha ?? SHA }), { status: 200 });
    }
    if (url.includes("/contents/") && !url.includes("/contents/README.md")) {
      const path = decodeURIComponent(url.split("/contents/")[1]?.split("?")[0] ?? "");
      if (!(opts.images ?? []).includes(path)) return new Response("", { status: 404 });
      return new Response(JSON.stringify({ type: "file", path }), { status: 200 });
    }
    if (url.includes("/contents/")) {
      const status = opts.fileStatus ?? 200;
      if (status !== 200) return new Response("", { status });
      return new Response(opts.body ?? "", { status: 200 });
    }
    throw new Error(`unexpected url ${url}`);
  }) as unknown as typeof fetch;
}

describe("decide", () => {
  it("pays when the line is a whole line in the file", async () => {
    const d = await decide(SPEC, undefined, fakeFetch({ body: `# Hi\n\n${LINE}\n` }));
    assert.equal(d.present, true);
    assert.equal(d.sha, `0x${SHA}`);
  });

  it("refunds when the line is gone, and still names the commit it read", async () => {
    const d = await decide(SPEC, undefined, fakeFetch({ body: "# Hi\n" }));
    assert.equal(d.present, false);
    assert.equal(d.sha, `0x${SHA}`, "evidence should point at the commit that lacked the line");
  });

  it("refunds when the branch or repo is gone", async () => {
    const d = await decide(SPEC, undefined, fakeFetch({ commitStatus: 404 }));
    assert.equal(d.present, false);
    assert.equal(d.sha, ZERO_SHA);
  });

  it("refunds when the file moved, keeping the resolved commit", async () => {
    const d = await decide(SPEC, undefined, fakeFetch({ fileStatus: 404 }));
    assert.equal(d.present, false);
    assert.equal(d.sha, `0x${SHA}`);
  });

  it("refuses a malformed repo without calling GitHub", async () => {
    const never = (() => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch;
    const d = await decide({ ...SPEC, repo: "../../etc/passwd" }, undefined, never);
    assert.equal(d.present, false);
    assert.equal(d.sha, ZERO_SHA);
  });

  it("throws on rate limiting, so the day is retried rather than settled", async () => {
    await assert.rejects(
      () => decide(SPEC, undefined, fakeFetch({ commitStatus: 403 })),
      LookupFailed,
    );
  });

  it("throws when GitHub is down, rather than reporting missing", async () => {
    await assert.rejects(
      () => decide(SPEC, undefined, fakeFetch({ commitStatus: 500 })),
      LookupFailed,
    );
  });

  it("never reports present with a zero sha (the contract would revert)", async () => {
    const d = await decide(SPEC, undefined, fakeFetch({ body: `${LINE}\n` }));
    if (d.present) assert.notEqual(d.sha, ZERO_SHA);
  });

  it("records a hash of the file it read, and zero when there was no file", async () => {
    const body = `# Hi\n\n${LINE}\n`;
    const d = await decide(SPEC, undefined, fakeFetch({ body }));
    assert.equal(d.fileHash, keccak256(toBytes(body)));
    const gone = await decide(SPEC, undefined, fakeFetch({ fileStatus: 404 }));
    assert.equal(gone.fileHash, ZERO_HASH);
  });

  it("keeps the file hash on a missing day, so the refund has evidence too", async () => {
    const body = "# Hi\n";
    const d = await decide(SPEC, undefined, fakeFetch({ body }));
    assert.equal(d.present, false);
    assert.equal(d.fileHash, keccak256(toBytes(body)));
  });

  it("pays a line with a repo image only while the image is in the same commit", async () => {
    const line = "![Acme](docs/acme.png) Sponsored by Acme";
    const spec = { ...SPEC, line };
    const body = `${line}\n`;
    const there = await decide(spec, undefined, fakeFetch({ body, images: ["docs/acme.png"] }));
    assert.equal(there.present, true);
    const gone = await decide(spec, undefined, fakeFetch({ body, images: [] }));
    assert.equal(gone.present, false);
    assert.match(gone.reason, /docs\/acme\.png/);
  });

  it("does not try to cover images on other hosts", async () => {
    const line = '<img src="https://cdn.example/acme.png"> Sponsored by Acme';
    const d = await decide({ ...SPEC, line }, undefined, fakeFetch({ body: `${line}\n` }));
    assert.equal(d.present, true);
  });
});
