// The checker: once per interval, settle every deal-day that is due.
//
// It holds no state of its own. Every loop rebuilds what it needs from the contract's logs and
// GitHub, so restarting it is always safe. If it stays down, no money is stuck: every unreported
// day becomes reclaimable by the buyer once its window closes.
import type { Chain, PublicClient, WalletClient } from "viem";
import { createPublicClient, createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { createServer } from "node:http";
import { morningLineAbi } from "./abi.ts";
import { isStillOpen, newScanner, openDays, scan, sendReport } from "./chain.ts";
import type { Scanner } from "./chain.ts";
import { decide } from "./check.ts";
import { describe, loadConfig } from "./config.ts";
import { LookupFailed } from "./github.ts";
import { checkAt, isDue } from "./schedule.ts";

const health = {
  /// The address reports are sent from. Public; lets anyone confirm the right key is running.
  checker: null as string | null,
  chainId: null as number | null,
  /// The MorningLine contract it settles. Public.
  contract: null as string | null,
  startedAt: new Date().toISOString(),
  lastRunAt: null as string | null,
  lastSuccessAt: null as string | null,
  lastError: null as string | null,
  reportsSent: 0,
};

async function loop(config: ReturnType<typeof loadConfig>): Promise<void> {
  const account = privateKeyToAccount(config.checkerPrivateKey);
  const address = getAddress(config.morningLineAddress);

  const transport = http(config.rpcUrl);
  const probe = createPublicClient({ transport });
  const chainId = await probe.getChainId();
  const chain: Chain = chainId === base.id ? base : baseSepolia;

  const client = createPublicClient({ chain, transport });
  const wallet = createWalletClient({ account, chain, transport });

  const [dayLength, reportGrace] = await Promise.all([
    client.readContract({ address, abi: morningLineAbi, functionName: "dayLength" }),
    client.readContract({ address, abi: morningLineAbi, functionName: "reportGrace" }),
  ]);

  console.log(`checker ${account.address} on chain ${chainId}`);
  health.checker = account.address;
  health.contract = address;
  health.chainId = chainId;
  console.log(describe(config));
  console.log(`dayLength ${dayLength}s  reportGrace ${reportGrace}s`);

  // Created once: the cursor survives between loops so only new blocks are read.
  const scanner = newScanner(config.startBlock, config.logChunkBlocks);

  for (;;) {
    health.lastRunAt = new Date().toISOString();
    try {
      await runOnce(client, wallet, address, account.address, config, scanner, dayLength, reportGrace);
      health.lastSuccessAt = new Date().toISOString();
      health.lastError = null;
    } catch (err) {
      health.lastError = err instanceof Error ? err.message : String(err);
      console.error("loop failed:", health.lastError);
    }
    await sleep(config.pollIntervalMs);
  }
}

async function runOnce(
  client: PublicClient,
  wallet: WalletClient,
  address: `0x${string}`,
  checker: `0x${string}`,
  config: ReturnType<typeof loadConfig>,
  scanner: Scanner,
  dayLength: bigint,
  reportGrace: bigint,
): Promise<void> {
  const block = await client.getBlock();
  const now = block.timestamp;
  const deals = await scan(scanner, client, address, block.number);

  const mine = [...deals.values()].filter((d) => d.checker === getAddress(checker));

  for (const deal of mine) {
    if (deal.spec === undefined) continue; // DealSpec not seen yet; nothing to check against

    for (const { day, opens, closes } of openDays(deal, now, dayLength, reportGrace)) {
      const due = checkAt(config.checkSeed, deal.dealId, BigInt(day), opens, dayLength);
      if (!isDue(now, due, closes)) continue;

      let decision;
      try {
        decision = await decide(deal.spec, config.githubToken, fetch);
      } catch (err) {
        // Could not look. Do not settle on a guess; try again next loop.
        if (err instanceof LookupFailed) {
          console.warn(`deal ${deal.dealId} day ${day}: ${err.message}, retrying next loop`);
          continue;
        }
        throw err;
      }

      // The log scan may be a few seconds stale; confirm against state before spending gas.
      if (!(await isStillOpen(client, address, deal.dealId, day))) continue;

      const tx = await sendReport(
        wallet, client, address, deal.dealId, day, decision.present, decision.sha, decision.fileHash,
      );
      health.reportsSent += 1;
      console.log(
        `deal ${deal.dealId} day ${day}: ${decision.present ? "present" : "missing"} ` +
          `(${decision.reason}) sha ${decision.sha} file ${decision.fileHash} tx ${tx}`,
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function startHealthServer(port: number): void {
  createServer((req, res) => {
    if (req.url !== "/health") {
      res.writeHead(404).end();
      return;
    }
    // Stale if the last success is older than two intervals: the page shows silence.
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(health, null, 2));
  }).listen(port, () => console.log(`health on :${port}/health`));
}

const config = loadConfig();
startHealthServer(config.healthPort);
loop(config).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
