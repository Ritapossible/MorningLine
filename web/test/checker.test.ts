import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyChecker } from "../lib/checker.ts";

const PUBLISHED = "0x84c85b69a52EA047C168cDcA87496C884531343C";
const BUYER = "0xAAAAaaaAAAAaAAaAAAaaAAAaAAAAaAaAaAaAAaAA";
const PAYEE = "0xBbBBBBbbBBbbBBBbBBBbbbBBbbBbbbbBBBbBBBbB";
const THIRD = "0xCcCCCcCCCCcCCCCCcCCcCcCCCCCCCcCcccCCcCcC";

describe("classifyChecker", () => {
  it("accepts the published checker", () => {
    assert.equal(classifyChecker(PUBLISHED, BUYER, PAYEE, PUBLISHED), "published");
  });

  it("flags a checker that is the maintainer", () => {
    assert.equal(classifyChecker(PAYEE, BUYER, PAYEE, PUBLISHED), "payee");
  });

  it("flags a checker that is the sponsor", () => {
    assert.equal(classifyChecker(BUYER, BUYER, PAYEE, PUBLISHED), "buyer");
  });

  it("recognises a checker this site ran before", () => {
    const OLD = "0x1111111111111111111111111111111111111111";
    assert.equal(classifyChecker(OLD, BUYER, PAYEE, PUBLISHED, [OLD.toUpperCase().replace("0X", "0x")]), "retired");
    assert.equal(classifyChecker(OLD, BUYER, PAYEE, PUBLISHED), "unfamiliar");
  });

  it("still reports self dealing by a retired checker", () => {
    assert.equal(classifyChecker(BUYER, BUYER, PAYEE, PUBLISHED, [BUYER]), "buyer");
  });

  it("notes a checker nobody here runs", () => {
    assert.equal(classifyChecker(THIRD, BUYER, PAYEE, PUBLISHED), "unfamiliar");
  });

  it("ignores address casing, which differs between wallets and explorers", () => {
    assert.equal(classifyChecker(PAYEE.toLowerCase(), BUYER, PAYEE.toUpperCase().replace("0X", "0x"), PUBLISHED), "payee");
    assert.equal(classifyChecker(PUBLISHED.toLowerCase(), BUYER, PAYEE, PUBLISHED), "published");
  });

  it("reports self dealing even when the self dealer is also the published checker", () => {
    // Our own checker should never be a payee, but if a deal names it as one, the conflict is
    // the thing worth saying, not the fact that we recognise the address.
    assert.equal(classifyChecker(PUBLISHED, BUYER, PUBLISHED, PUBLISHED), "payee");
    assert.equal(classifyChecker(PUBLISHED, PUBLISHED, PAYEE, PUBLISHED), "buyer");
  });

  it("treats a deal where the sponsor is also the maintainer as self dealing", () => {
    assert.equal(classifyChecker(BUYER, BUYER, BUYER, PUBLISHED), "payee");
  });
});
