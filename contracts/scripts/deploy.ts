// Deploys two MorningLine instances: production settings (1 day days, 48 h grace, 1 day of
// cancel notice) and demo settings (180 s days, 120 s grace, 1 day of notice). Settings are
// immutable, so the demo is its own deployment (DECISIONS D12).
//
// LINE and the USDC stand-in are reused from deployments/<network>.json when it has them, so
// balances and wallet entries survive a new MorningLine version; set FRESH_TOKENS=1 to deploy
// new ones. The previous MorningLine addresses are kept in the record's history.
//
//   npx hardhat run scripts/deploy.ts --network baseSepolia
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { network } from "hardhat";

const DEAD = "0x000000000000000000000000000000000000dEaD" as const;
const ONE_LINE = 10n ** 18n; // fuelPerCheck: 1 LINE, 18 decimals

const PRODUCTION = { dayLength: 86_400n, reportGrace: 172_800n, cancelNotice: 1n };
const DEMO = { dayLength: 180n, reportGrace: 120n, cancelNotice: 1n };

// Verified against Circle's docs before deploying. Base Sepolia uses DemoUSDC instead, so a
// stranger can open a deal without waiting on an external faucet.
const USDC: Record<string, `0x${string}`> = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

async function main() {
  const connection = await network.connect();
  const { viem, networkName } = connection;

  const publicClient = await viem.getPublicClient();
  const [wallet] = await viem.getWalletClients();
  const deployer = wallet.account.address;
  const balance = await publicClient.getBalance({ address: deployer });

  console.log(`network   ${networkName} (chain ${publicClient.chain.id})`);
  console.log(`deployer  ${deployer}`);
  console.log(`balance   ${balance} wei`);
  if (balance === 0n) throw new Error("Deployer has no ETH for gas. Fund it and run again.");

  const path = `deployments/${networkName}.json`;
  const previous = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
  const reuse = previous !== undefined && process.env.FRESH_TOKENS !== "1";

  // USDC: the real token on mainnet, a faucet stand-in everywhere else.
  let usdc = USDC[networkName];
  let demoUsdc: string | undefined;
  if (usdc === undefined && reuse && previous.demoUsdc) {
    usdc = previous.demoUsdc;
    demoUsdc = previous.demoUsdc;
    console.log(`DemoUSDC  ${usdc} (reused)`);
  } else if (usdc === undefined) {
    const d = await viem.deployContract("DemoUSDC");
    usdc = d.address;
    demoUsdc = d.address;
    console.log(`DemoUSDC  ${d.address}`);
  } else {
    console.log(`USDC      ${usdc} (real)`);
  }

  let lineAddress: `0x${string}`;
  if (reuse && previous.line) {
    lineAddress = previous.line;
    console.log(`LINE      ${lineAddress} (reused)`);
  } else {
    lineAddress = (await viem.deployContract("LineToken")).address;
    console.log(`LINE      ${lineAddress}`);
  }

  const production = await viem.deployContract("MorningLine", [
    usdc, lineAddress, ONE_LINE, DEAD, PRODUCTION.dayLength, PRODUCTION.reportGrace, PRODUCTION.cancelNotice,
  ]);
  console.log(`MorningLine (production)  ${production.address}`);

  const demo = await viem.deployContract("MorningLine", [
    usdc, lineAddress, ONE_LINE, DEAD, DEMO.dayLength, DEMO.reportGrace, DEMO.cancelNotice,
  ]);
  console.log(`MorningLine (demo)        ${demo.address}`);

  // Read the settings back from chain, so the record states what is deployed, not what was meant.
  const startBlock = await publicClient.getBlockNumber();
  for (const [name, c, want] of [["production", production, PRODUCTION], ["demo", demo, DEMO]] as const) {
    const [dl, rg, cn, v] = await Promise.all([
      c.read.dayLength(), c.read.reportGrace(), c.read.cancelNotice(), c.read.VERSION(),
    ]);
    if (dl !== want.dayLength || rg !== want.reportGrace || cn !== want.cancelNotice || v !== 2n) {
      throw new Error(`${name} settings on chain do not match: ${dl} ${rg} ${cn} v${v}`);
    }
  }
  console.log(`settings read back from chain and match; start block ${startBlock}`);

  const record = {
    network: networkName,
    chainId: publicClient.chain.id,
    deployedAt: new Date().toISOString(),
    deployer,
    usdc,
    demoUsdc,
    line: lineAddress,
    version: 2,
    startBlock: Number(startBlock),
    morningLine: {
      production: { address: production.address, ...numbers(PRODUCTION) },
      demo: { address: demo.address, ...numbers(DEMO) },
    },
    history: [
      ...(previous?.history ?? []),
      ...(previous?.morningLine
        ? [{ version: previous.version ?? 1, deployedAt: previous.deployedAt, morningLine: previous.morningLine }]
        : []),
    ],
    fuelPerCheck: ONE_LINE.toString(),
    fuelSink: DEAD,
  };

  if (!existsSync("deployments")) mkdirSync("deployments");
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
  console.log(`\nwrote ${path}`);
  console.log(`verify with: npx hardhat verify --network ${networkName} <address> <args...>`);

  await connection.close();
}

function numbers(s: { dayLength: bigint; reportGrace: bigint; cancelNotice: bigint }) {
  return { dayLength: Number(s.dayLength), reportGrace: Number(s.reportGrace), cancelNotice: Number(s.cancelNotice) };
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
