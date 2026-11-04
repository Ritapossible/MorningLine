// Addresses and ABIs. Defaults point at the demo deployment on Base Sepolia so the app works
// with no configuration; Vercel overrides them per environment.
import { base, baseSepolia } from "wagmi/chains";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
export const chain = CHAIN_ID === base.id ? base : baseSepolia;

export const MORNINGLINE = (process.env.NEXT_PUBLIC_MORNINGLINE_ADDRESS ??
  "0xcae6005f50ada8c55e6785998aaeb22242aabdbe") as `0x${string}`;
export const LINE = (process.env.NEXT_PUBLIC_LINE_ADDRESS ??
  "0x11bd55d6ef883cfd73e346034b6d90d84f2d1ff9") as `0x${string}`;
export const USDC = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0xb997cef9a60b8d6f2f3e9dbc42a769dd4fcc2632") as `0x${string}`;

/// True when this deployment uses short days for demonstration. Shown on every page: a deal
/// here settles in minutes, not days, and the money is worth nothing.
export const IS_DEMO = (process.env.NEXT_PUBLIC_IS_DEMO ?? "true") === "true";

/// Whether the configured USDC is our own faucet token rather than real USDC.
export const USDC_IS_FAUCET = (process.env.NEXT_PUBLIC_USDC_IS_FAUCET ?? "true") === "true";

export const explorer = chain.blockExplorers?.default.url ?? "https://sepolia.basescan.org";
export const txUrl = (hash: string) => `${explorer}/tx/${hash}`;
export const addressUrl = (a: string) => `${explorer}/address/${a}`;

export const morningLineAbi = [
  {
    type: "function",
    name: "openDeal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "payee", type: "address" },
      { name: "checker", type: "address" },
      { name: "dailyAmount", type: "uint128" },
      { name: "dayCount", type: "uint16" },
      { name: "start", type: "uint40" },
      {
        name: "spec",
        type: "tuple",
        components: [
          { name: "repo", type: "string" },
          { name: "branch", type: "string" },
          { name: "path", type: "string" },
          { name: "line", type: "string" },
        ],
      },
    ],
    outputs: [{ name: "dealId", type: "uint256" }],
  },
  {
    type: "function",
    name: "reclaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dealId", type: "uint256" },
      { name: "dayList", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getDeal",
    stateMutability: "view",
    inputs: [{ name: "dealId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "buyer", type: "address" },
          { name: "start", type: "uint40" },
          { name: "dayCount", type: "uint16" },
          { name: "settled", type: "uint16" },
          { name: "payee", type: "address" },
          { name: "checker", type: "address" },
          { name: "dailyAmount", type: "uint128" },
          { name: "specHash", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "dayStatus",
    stateMutability: "view",
    inputs: [
      { name: "dealId", type: "uint256" },
      { name: "day", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "dayWindow",
    stateMutability: "view",
    inputs: [
      { name: "dealId", type: "uint256" },
      { name: "day", type: "uint256" },
    ],
    outputs: [
      { name: "opens", type: "uint256" },
      { name: "closes", type: "uint256" },
    ],
  },
  { type: "function", name: "dealCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "dayLength", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "reportGrace", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "fuelPerCheck", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "event",
    name: "DealSpec",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true },
      { name: "repo", type: "string", indexed: false },
      { name: "branch", type: "string", indexed: false },
      { name: "path", type: "string", indexed: false },
      { name: "line", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DayReported",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true },
      { name: "day", type: "uint256", indexed: true },
      { name: "present", type: "bool", indexed: false },
      { name: "commitSha", type: "bytes20", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DayReclaimed",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true },
      { name: "day", type: "uint256", indexed: true },
    ],
  },
] as const;

export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

export const faucetAbi = [
  { type: "function", name: "drip", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "nextDripAt", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

export const DayStatus = { Open: 0, Paid: 1, Refunded: 2 } as const;
