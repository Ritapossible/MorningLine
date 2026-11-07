// Only the parts of MorningLine the checker uses.
export const morningLineAbi = [
  {
    type: "event",
    name: "DealOpened",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "checker", type: "address", indexed: false },
      { name: "dailyAmount", type: "uint128", indexed: false },
      { name: "dayCount", type: "uint16", indexed: false },
      { name: "start", type: "uint40", indexed: false },
      { name: "specHash", type: "bytes32", indexed: false },
    ],
  },
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
      { name: "fileHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DealShortened",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true },
      { name: "by", type: "address", indexed: true },
      { name: "oldDayCount", type: "uint16", indexed: false },
      { name: "newDayCount", type: "uint16", indexed: false },
      { name: "refunded", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DealExtended",
    inputs: [
      { name: "dealId", type: "uint256", indexed: true },
      { name: "oldDayCount", type: "uint16", indexed: false },
      { name: "newDayCount", type: "uint16", indexed: false },
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
  {
    type: "function",
    name: "report",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dealId", type: "uint256" },
      { name: "day", type: "uint256" },
      { name: "present", type: "bool" },
      { name: "commitSha", type: "bytes20" },
      { name: "fileHash", type: "bytes32" },
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
  { type: "function", name: "dayLength", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "reportGrace", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

/// Mirrors the contract's DayStatus enum.
export const DayStatus = { Open: 0, Paid: 1, Refunded: 2 } as const;
