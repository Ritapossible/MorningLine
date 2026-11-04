import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decide, ZERO_SHA } from "../src/check.ts";
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
}): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/commits/")) {
      const status = opts.commitStatus ?? 200;
      if (status !== 200) return new Response("", { status });
      return new Response(JSON.stringify({ sha: opts.sha ?? SHA }), { status: 200 });
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
});
