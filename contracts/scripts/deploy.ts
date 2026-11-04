// Deploys LINE fuel and two MorningLine instances: production settings (1 day days, 48 h grace)
// and demo settings (180 s days, 120 s grace). Settings are immutable, so the demo is its own
// deployment (DECISIONS D12). Writes addresses to deployments/<network>.json.
//
//   npx hardhat run scripts/deploy.ts --network baseSepolia
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { network } from "hardhat";

const DEAD = "0x000000000000000000000000000000000000dEaD" as const;
const ONE_LINE = 10n ** 18n; // fuelPerCheck: 1 LINE, 18 decimals

const PRODUCTION = { dayLength: 86_400n, reportGrace: 172_800n };
const DEMO = { dayLength: 180n, reportGrace: 120n };

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

  // USDC: the real token on mainnet, a faucet stand-in everywhere else.
  let usdc = USDC[networkName];
  let demoUsdc: string | undefined;
  if (usdc === undefined) {
    const d = await viem.deployContract("DemoUSDC");
    usdc = d.address;
    demoUsdc = d.address;
    console.log(`DemoUSDC  ${d.address}`);
  } else {
    console.log(`USDC      ${usdc} (real)`);
  }

  const line = await viem.deployContract("LineToken");
  console.log(`LINE      ${line.address}`);

  const production = await viem.deployContract("MorningLine", [
    usdc, line.address, ONE_LINE, DEAD, PRODUCTION.dayLength, PRODUCTION.reportGrace,
  ]);
  console.log(`MorningLine (production)  ${production.address}`);

  const demo = await viem.deployContract("MorningLine", [
    usdc, line.address, ONE_LINE, DEAD, DEMO.dayLength, DEMO.reportGrace,
  ]);
  console.log(`MorningLine (demo)        ${demo.address}`);

  const record = {
    network: networkName,
    chainId: publicClient.chain.id,
    deployedAt: new Date().toISOString(),
    deployer,
    usdc,
    demoUsdc,
    line: line.address,
    morningLine: {
      production: { address: production.address, ...numbers(PRODUCTION) },
      demo: { address: demo.address, ...numbers(DEMO) },
    },
    fuelPerCheck: ONE_LINE.toString(),
    fuelSink: DEAD,
  };

  if (!existsSync("deployments")) mkdirSync("deployments");
  const path = `deployments/${networkName}.json`;
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
  console.log(`\nwrote ${path}`);
  console.log(`verify with: npx hardhat verify --network ${networkName} <address> <args...>`);

  await connection.close();
}

function numbers(s: { dayLength: bigint; reportGrace: bigint }) {
  return { dayLength: Number(s.dayLength), reportGrace: Number(s.reportGrace) };
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
