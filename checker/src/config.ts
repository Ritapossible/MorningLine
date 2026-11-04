// Configuration comes from the environment only. Nothing here is ever logged.
import { isHex } from "viem";

export type Config = {
  rpcUrl: string;
  checkerPrivateKey: `0x${string}`;
  morningLineAddress: `0x${string}`;
  startBlock: bigint;
  githubToken: string | undefined;
  checkSeed: `0x${string}`;
  pollIntervalMs: number;
  healthPort: number;
};

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") throw new Error(`${name} is not set`);
  return v;
}

export function loadConfig(): Config {
  const key = required("CHECKER_PRIVATE_KEY");
  if (!isHex(key) || key.length !== 66) {
    throw new Error("CHECKER_PRIVATE_KEY must be 0x followed by 64 hex characters");
  }

  const address = required("MORNINGLINE_ADDRESS");
  if (!isHex(address) || address.length !== 42) {
    throw new Error("MORNINGLINE_ADDRESS must be a 20 byte hex address");
  }

  const seed = required("CHECK_SEED");
  if (!isHex(seed) || seed.length !== 66) {
    throw new Error("CHECK_SEED must be 0x followed by 64 hex characters");
  }

  const token = process.env.GITHUB_TOKEN;

  return {
    rpcUrl: required("RPC_URL"),
    checkerPrivateKey: key,
    morningLineAddress: address,
    startBlock: BigInt(process.env.START_BLOCK ?? "0"),
    githubToken: token === "" ? undefined : token,
    checkSeed: seed,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? "600000"),
    healthPort: Number(process.env.HEALTH_PORT ?? "8080"),
  };
}

/// Safe to log: no key material, no token.
export function describe(c: Config): string {
  return [
    `contract ${c.morningLineAddress}`,
    `fromBlock ${c.startBlock}`,
    `every ${c.pollIntervalMs}ms`,
    `github ${c.githubToken === undefined ? "anonymous" : "token"}`,
  ].join("  ");
}
