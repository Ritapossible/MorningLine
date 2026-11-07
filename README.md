# Morning Line

**Per-day escrow for sponsor lines in GitHub READMEs, on Base.**

A sponsor locks USDC for a number of days. Each day the sponsor line is in the repository's
README, that day's USDC goes to the maintainer. Each day it is missing, that day's USDC goes back
to the sponsor. Every result is recorded on chain with the commit it was read from, so anyone can
check it.

[Live app](https://morning-line-phi.vercel.app) · [Docs](https://morning-line-phi.vercel.app/docs) · [Security model](docs/SECURITY.md)

---

## Contents

- [How it works](#how-it-works)
- [Guarantees and limits](#guarantees-and-limits)
- [Architecture](#architecture)
- [Deployments](#deployments)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Deploying](#deploying)
- [Project status](#project-status)
- [Security](#security)
- [License](#license)

## How it works

1. **Open a deal.** The sponsor picks a public repository, a branch, a file (usually
   `README.md`) and the exact line to pay for, then sets a price per day, a number of days and
   the maintainer's address. The USDC for every day, plus one LINE per day as fuel, is locked in
   the contract in the same transaction.
2. **Check daily.** Once a day, at a time the maintainer cannot predict, the checker reads the
   pinned file at the latest commit of the pinned branch and looks for the whole line.
3. **Settle each day on its own.** Present sends that day's USDC to the maintainer; missing sends
   it back to the sponsor. Either way the commit hash goes on chain and one LINE is burned.
4. **Silence is never final.** A day nobody reports becomes reclaimable by the sponsor once its
   report window closes (48 hours after the day ends in production).

The maintainer needs only an address on Base: no account, no fee and no gas.

## Guarantees and limits

**Enforced by the contract**

- Each day of a deal settles exactly once: paid to the maintainer or refunded to the sponsor.
- No owner, admin or upgrade path can move a deal's money. The checker can only choose, per
  day, between those two outcomes.
- A day nobody reports goes back to the sponsor after the grace period.

**Not promised** (also shown on every deal page)

- A commit hash proves what that commit contains, not that it was the commit visitors saw that
  day. The checker chooses which commit to report; anyone can compare it with the public history.
- Only the exact raw line in the pinned file counts. A remotely hosted image is not covered.
- Matching is literal text, not meaning. A reformatted line counts as missing.
- There is no dispute mechanism. A dishonest checker is visible and bounded, not prevented.
- If the repository is deleted, its evidence goes with it.

## Architecture

| Component | Path | Role |
|---|---|---|
| Contracts | `contracts/` | `MorningLine.sol` holds escrow and settles days; `LineToken.sol` is the fuel token. Solidity, Hardhat 3. |
| Checker | `checker/` | Node service that reads GitHub and calls `report()`. Stateless; safe to restart. |
| Web app | `web/` | Next.js app to open deals, view any deal publicly, and read the docs. |
| Docs | `docs/` | Plan, architecture, security model, decision log, hosting guide. |

The matching rule lives in `checker/src/match.ts` and is copied byte for byte to
`web/lib/match.ts`, so the deal page's presence preview runs the same code that moves money. CI
fails if the two copies differ.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Deployments

### Base Sepolia (chain ID 84532)

| Contract | Address |
|---|---|
| MorningLine, production settings (24 h days, 48 h grace) | `0x53a2861c4fbc29f17885b7c3616fbcc4365ad4b3` |
| MorningLine, demo settings (180 s days, 120 s grace) | `0xcae6005f50ada8c55e6785998aaeb22242aabdbe` |
| LINE (fuel) | `0x11bd55d6ef883cfd73e346034b6d90d84f2d1ff9` |
| Demo USDC (faucet) | `0xb997cef9a60b8d6f2f3e9dbc42a769dd4fcc2632` |
| Checker | `0xf0A44A43F5CE37236806CBF19a03fd300B540CE2` |

The live app uses the demo settings so a full deal plays out in minutes. Both instances spend
1 LINE per check and burn spent fuel to `0x…dEaD`. Testnet tokens have no value.

## Getting started

### Prerequisites

- Node.js 22.13 or later
- npm

### Contracts

```bash
cd contracts
npm ci
npm test          # unit, fuzz and invariant tests
```

### Checker

```bash
cd checker
npm ci
npm run typecheck
npm test          # matching, scheduling and decision tests; no network needed
```

### Web app

```bash
cd web
npm ci
npm run dev       # http://localhost:3000
```

The app runs with no configuration; its defaults point at the demo deployment on Base Sepolia.

## Configuration

Copy the example file in each package and fill it in. Never commit the result; `.env*` files are
ignored.

| Package | File | Notes |
|---|---|---|
| Web | `web/.env.example` | Contract addresses, RPC, and optional Privy sign-in (`NEXT_PUBLIC_PRIVY_APP_ID`) and gas sponsorship (`NEXT_PUBLIC_PRIVY_SPONSOR_GAS`). |
| Checker | `checker/.env.example` | RPC, checker key, contract address, start block, check seed, GitHub token, poll interval. |

## Deploying

**Web app (Vercel).** Import the repository, set **Root Directory** to `web`, keep the detected
build settings, and add the variables from `web/.env.example`. `NEXT_PUBLIC_` values are fixed at
build time, so redeploy after changing them.

**Checker (Render or Railway).** The checker must run continuously. `render.yaml` describes it as
a Render Blueprint; [docs/HOSTING.md](docs/HOSTING.md) covers the variables, creating a checker
wallet, keeping the service awake, and troubleshooting.

## Project status

| Area | State |
|---|---|
| Contracts | 24 tests passing (unit, fuzz, stateful invariants) |
| Checker | 42 tests passing; running against the demo deployment |
| Web app | Live: open a deal, public deal pages, docs, live checker status |
| Base Sepolia | Deployed; contracts not yet verified on Basescan |
| Base mainnet | Planned |

The contracts are unaudited. Use testnet deployments only.

## Security

The trust model, threat analysis and pre-mainnet checklist are in
[docs/SECURITY.md](docs/SECURITY.md), along with how to report a vulnerability. Keep exploit
details out of public issues.

## License

MIT. See [LICENSE](LICENSE).
