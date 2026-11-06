# Decisions

Each entry: what we chose, why, and what we gave up.

### D1 - Settle one day at a time (2026-11-03)
**Why:** all-or-nothing escrow (Stamped's model) lets a maintainer keep the line up until the
final check and remove it after. Per-day settlement removes the incentive: removing the line
early only forfeits the remaining days. **Cost:** one transaction per day per deal; cheap on
Base.

### D2 - GitHub READMEs, not arbitrary web pages (2026-11-03)
**Why:** a web page can show the checker one thing and visitors another (cloaking). GitHub
serves the same file at a given commit to everyone, and a commit's contents never change, so
the evidence (a SHA) can be opened by anyone. **Cost:** a narrower market. **Limit kept in
the open:** the checker still chooses which SHA to report.

### D3 - No dispute mechanism (2026-11-03)
**Why:** if the buyer can dispute a good day, the maintainer is never safely paid; if we decide
disputes, we are the judge. The commit SHA is the evidence, the 48-hour reclaim covers
silence, and a lying checker is visible on chain. **Cost:** a dishonest checker is detected,
not prevented. Future: 2-of-3 independent checkers.

### D4 - The checker is fixed per deal, chosen by the buyer (2026-11-03)
**Why:** no global admin who can swap the checker for live deals. **Cost:** a lost checker key
cannot be rotated for existing deals; their days become reclaimable instead.

### D5 - No owner, no proxy, immutable settings (2026-11-03)
**Why:** nobody can change the rules under an open deal. **Cost:** every change is a new
deployment.

### D6 - The app token is fuel, spent per check (2026-11-03)
**Why:** Vibestarter asks that the token does a job the first time the app is used. Every
check sends one LINE to the sink; without LINE a deal cannot be opened. Holding LINE does
nothing. For the hackathon LINE has a free daily faucet and is never sold; a raise would point
the next deployment at the project's own token. **Cost:** an extra approval when opening.

### D7 - Reject fee-on-transfer tokens (2026-11-03)
**Why:** every deal must be fully backed (invariant 1). Deposits are checked by balance delta.

### D8 - Whole-line, literal match after newline and trailing-space normalization (2026-11-03)
**Why:** predictable for both sides and easy to explain; substring matches could pass by
accident inside a longer line or a code block. **Cost:** a reformatted line counts as missing.

### D9 - Commit SHA as bytes20 (2026-11-03)
**Why:** GitHub uses SHA-1 object IDs (20 bytes). A present report must carry a non-zero SHA.

### D10 - Cut: Wayback snapshots, multi-region fetches (2026-11-03)
**Why:** Save Page Now is rate-limited and can fail, and money cannot depend on it; two regions
are still our servers. Cloaking is addressed by D2 instead.

### D11 - Hardhat 3 for contracts and Solidity tests (2026-11-03)
**Why:** Foundry's installer script could not run in the build environment; Hardhat 3 installs
from npm and runs Foundry-style Solidity tests (forge-std, fuzzing, invariants) natively.

### D12 - A separate demo deployment with 180-second days (2026-11-03)
**Why:** the demo must show present, missing and reclaim in a minute. `dayLength` is immutable,
so the demo is its own deployment, labelled "demo" everywhere in the UI.

### D13 - A faucet USDC for every deployment except mainnet (2026-11-04)
**Why:** the definition of done is that a stranger can open a deal from the live URL. On Base
Sepolia that needs test USDC, and Circle's faucet is an external, rate-limited dependency sitting
in the middle of the demo path. `DemoUSDC` is a 6-decimal ERC20 with a daily drip and no owner,
the same shape as the LINE faucet. Mainnet uses real USDC and never sees this contract.
**Cost:** one more contract to deploy and verify, and a deal on Sepolia is denominated in a token
that is worth nothing. The UI labels it.

### D14 - The deal page finds events by searching state, not by scanning logs (2026-11-06)
**Why:** the public Base endpoint caps `eth_getLogs` at about 200 blocks, and Base Sepolia makes
five blocks a second, so a backward scan with a sane request budget reached about 40 minutes
into the past. Older deals showed no repo and no evidence links. Contract state answers "when"
without logs: `dealCount` only grows, and a day leaves `Open` exactly once, so a binary search
over block numbers finds the opening block and each settlement block in about 25 reads each.
The logs are then read from those single blocks. Each search step for every day goes in one
batched JSON-RPC request, and settled results are cached, since they cannot change.
**Cost:** the RPC must serve historical state (Base's public endpoints do; a pruned node would
not). A cold request for a long deal takes a few seconds.

### D15 - Privy for sign-in, a wallet only where something is signed (2026-11-06)
**Why:** two things need a wallet, opening a deal and reclaiming days; reading a deal and being
a maintainer never do. The header no longer asks everyone to connect. Sign-in appears on the
step that signs. Privy lets a sponsor who has never held crypto sign in with email or Google and
get an embedded wallet, which matters for the people this is for and for judges trying the live
URL. It sits behind `NEXT_PUBLIC_PRIVY_APP_ID`; unset, the app uses the plain wagmi connectors,
and Privy's WagmiProvider keeps every wagmi hook unchanged either way. The hackathon rules name
no restriction on SDKs or auth providers.
**Cost:** an embedded wallet starts with no ETH, so the first transaction needs a few cents of
gas sent to it; the signing step says so. Gas sponsorship through Privy is the follow-up. The
dependency tree grows (WalletConnect, Reown), adding client-side advisories, see SECURITY.md.
`web/.npmrc` relaxes peer resolution for an optional peer (`permissionless`) that is never used.
