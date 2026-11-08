# Morning Line

**Per-day escrow for sponsor lines in GitHub READMEs, on Base.**

A sponsor locks USDC for a number of days. Each day the sponsor line is in the repository's
README, that day's USDC goes to the maintainer. Each day it is missing, that day's USDC goes back
to the sponsor. Every result is recorded on chain with the commit it was read from, so anyone can
check it.

[Live app](https://morning-line-phi.vercel.app) · [Live demo deal](https://morning-line-phi.vercel.app/deal/1) · [Docs](https://morning-line-phi.vercel.app/docs) · [Security model](docs/SECURITY.md)

---

## Contents

- [Why it is needed](#why-it-is-needed)
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

## Why it is needed

README sponsorships run on trust. Morning Line replaces the trust with a contract and a commit.

| | Today | With Morning Line |
|---|---|---|
| **Payment** | The sponsor pays a month up front and hopes the line stays up. | The money is locked before day one and released one day at a time. |
| **Getting paid** | The maintainer sends an invoice and waits. | Each day the line is up pays the maintainer automatically. |
| **Line removed** | If it comes down on day 9, nobody refunds days 9 to 30. | Every day it is gone goes back to the sponsor. |
| **Proof** | Neither side can show which days the line was really there. | Every day names the commit it was read from, so anyone can check it. |
| **Middleman** | Someone has to hold the money or chase it. | No one holds the money but the contract. |

### Why now

Paying for one day at a time only works when moving a dollar costs almost nothing. Stablecoins on
Base settle in seconds for a fraction of a cent, so a daily payout now costs less than the invoice
it replaces. And GitHub is where developer tools find their users: as small teams and AI agents
ship more of them, a line in a popular README is shelf space worth paying for, and worth proving.

## How it works

1. **Open a deal.** The sponsor picks a public repository, a branch, a file (usually
   `README.md`) and the exact line to pay for, then sets a price per day, a number of days and
   the maintainer's address. The USDC for every day, plus one LINE per day as fuel, is locked in
   the contract in the same transaction.
2. **Check daily.** Once a day, at a time the maintainer cannot predict, the checker reads the
   pinned file at the latest commit of the pinned branch and looks for the whole line.
3. **Settle each day on its own.** Present sends that day's USDC to the maintainer; missing sends
   it back to the sponsor. Either way the commit hash and a hash of the file go on chain and one
   LINE is burned.
4. **Silence is never final.** A day nobody reports becomes reclaimable by the sponsor once its
   report window closes (48 hours after the day ends in production).
5. **Change the length, never the terms.** The sponsor can cancel, which keeps the days already
   started plus one day of notice for the maintainer, or add days at the same price. The
   maintainer can end the deal early. Removed days are refunded at once.

The maintainer needs only an address on Base: no account, no fee and no gas.

## Guarantees and limits

**Enforced by the contract**

- Each day of a deal settles exactly once: paid to the maintainer or refunded to the sponsor.
- No owner, admin or upgrade path can move a deal's money. The checker can only choose, per
  day, between those two outcomes.
- A day nobody reports goes back to the sponsor after the grace period.
- Cancelling or ending early never removes a day that has started, and a sponsor's cancel always
  leaves the maintainer a day of notice.

**Not promised** (also shown on every deal page)

- The checker chooses which commit to read. The deal page checks every reported commit is in the
  branch's history and that the file matches the hash on chain, but it cannot yet prove the
  commit was the branch head at that minute.
- The exact line in the pinned file counts, plus any image the line shows from the repository
  itself. Images hosted elsewhere are not covered.
- Matching is literal text, not meaning. A reformatted line counts as missing.
- There is no dispute mechanism. A dishonest checker is visible and bounded, not prevented.
- If the repository is deleted, its commit links stop working; each day's file hash stays on
  chain.

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
| MorningLine v2, production settings (24 h days, 48 h grace, 1 day cancel notice) | `0xf007cc0f987253c94f33a6612dc776a120afc5a5` |
| MorningLine v2, demo settings (3 min days, 2 min grace, 1 day cancel notice) | `0xe3b293d5b4eb9a07fd0e3c8b9fda57f7124babef` |
| LINE (fuel) | `0x11bd55d6ef883cfd73e346034b6d90d84f2d1ff9` |
| Demo USDC (faucet) | `0xb997cef9a60b8d6f2f3e9dbc42a769dd4fcc2632` |
| Checker | `0xf0A44A43F5CE37236806CBF19a03fd300B540CE2` |

The v2 contracts, LINE and Demo USDC are verified on
[Sourcify](https://sourcify.dev/server/repo-ui/84532/0xe3b293d5b4eb9a07fd0e3c8b9fda57f7124babef)
(full match) and [Blockscout](https://base-sepolia.blockscout.com/address/0xe3b293d5b4eb9a07fd0e3c8b9fda57f7124babef#code).
[contracts/verify/](contracts/verify/README.md) has the files and steps for Basescan.

The live app uses the demo settings so a full deal plays out in minutes: on the demo, a "day"
lasts 3 minutes. The production contract runs the same code with 24-hour days. The v1 contracts
(`0x53a2…b4b3` and `0xcae6…bdbe`), from before deals could be cancelled or extended, still hold
the first test deals; the demo one is shown at `/deal/v1/<id>` on the live app. Every instance
spends 1 LINE per check and burns spent fuel to `0x…dEaD`. Testnet tokens have no value.

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
| Contracts | v2: 40 tests passing (unit, fuzz, stateful invariants) |
| Checker | 55 tests passing; running against the v2 demo deployment |
| Web app | Live: open a deal, public deal pages, docs, live checker status |
| Base Sepolia | v2 deployed; verified on Sourcify (full match) and Blockscout; Basescan upload prepared in `contracts/verify/` |
| Base mainnet | Planned |

The contracts are unaudited. Use testnet deployments only.

## Security

The trust model, threat analysis and pre-mainnet checklist are in
[docs/SECURITY.md](docs/SECURITY.md), along with how to report a vulnerability. Keep exploit
details out of public issues.

## License

MIT. See [LICENSE](LICENSE).
