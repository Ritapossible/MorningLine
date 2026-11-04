# Morning Line

**Sponsor a GitHub README and pay only for the days your line stays up.**

Crypto can escrow anything that happens on-chain, but almost nothing that happens off it.
Morning Line pays for an off-chain deliverable, a sponsor line in a GitHub README, one
verified day at a time, with evidence anyone can open.

- The sponsor locks USDC on Base for a number of days.
- Once a day, Morning Line reads the pinned file at the latest commit of the repo's pinned
  branch and looks for the exact sponsor line.
- Each day the line is there, that day's USDC goes to the maintainer. Each day it is missing,
  that day's USDC goes back to the sponsor.
- Every check records the commit SHA on Base, so anyone can open that commit and see the file.
- Every check spends one unit of the app token (LINE). No token, no check, no payout.
- If the checker goes quiet, the sponsor reclaims every unchecked day 48 hours after it ends.

Built for Vibestarter's Vibeathon 02 (build window 2-9 Nov 2026).

## Status

| Part | State |
|---|---|
| `MorningLine.sol` escrow + `LineToken.sol` fuel | written, 24 tests passing (unit, fuzz, stateful invariants) |
| Deploy script, Base networks, `DemoUSDC` faucet | written, green in CI |
| Checker worker | 42 unit tests passing, and confirmed end to end on Base Sepolia: present paid, missing refunded, silence reclaimed |
| Web app | planned |
| Base Sepolia deployment | live, see below; not yet verified on Basescan |
| Base mainnet deployment | planned |

### Base Sepolia (chain 84532)

| Contract | Address |
|---|---|
| MorningLine, production settings (1 day days, 48 h grace) | `0x53a2861c4fbc29f17885b7c3616fbcc4365ad4b3` |
| MorningLine, demo settings (180 s days, 120 s grace) | `0xcae6005f50ada8c55e6785998aaeb22242aabdbe` |
| LINE fuel | `0x11bd55d6ef883cfd73e346034b6d90d84f2d1ff9` |
| DemoUSDC faucet | `0xb997cef9a60b8d6f2f3e9dbc42a769dd4fcc2632` |

Both MorningLine instances point at the same LINE and DemoUSDC, spend 1 LINE per check, and
burn spent fuel to `0x...dEaD`. Settings were read back from chain after deployment and match
`docs/ARCHITECTURE.md`. Everything here is testnet: DemoUSDC is worth nothing.

## What it promises, and what it does not

**Promised by the contract:**
- Each day of a deal is either paid to the maintainer or refunded to the sponsor, exactly once.
- No admin, owner or upgrade can move a deal's money. The checker can only choose, per day,
  between paying the maintainer and refunding the sponsor.
- A day nobody reports goes back to the sponsor after the grace period.

**Not promised (shown on every deal page):**
- The SHA proves what that commit contains. It does not prove that commit was the one
  visitors saw that day: the checker chooses which SHA to report, and anyone can compare it
  with the repo's public history.
- The check is the exact raw line in one pinned file on one pinned branch. A logo hosted
  elsewhere can disappear while the line stays; a remote image is not covered.
- Matching is literal text, not meaning.
- If the repo is deleted, its evidence goes with it.

Full trust and threat model: [docs/SECURITY.md](docs/SECURITY.md).

## Already on the market

| Product | What it does | What it does not do |
|---|---|---|
| [Stamped](https://stamped.cash/) | Escrow for sponsored X posts on Robinhood Chain, paid in full once the post has stayed up | READMEs; per-day payment; evidence anyone can open |
| [Payd](https://paydai-five.vercel.app/) | The same idea on X Layer | Same |
| [SponsorGit](https://sponsorgit.com/maintainers.html) | Sells a README line for a weekly fee | No escrow; the line is not checked |
| Polar, GitHub Sponsors | Take sponsorship money | Neither pays only for the days the line stays up |

## Repo layout

```
contracts/   Solidity (Hardhat 3): MorningLine.sol, LineToken.sol, DemoUSDC.sol, tests
             scripts/deploy.ts deploys production and demo settings
checker/     daily GitHub check -> report() on Base
web/         (planned) open a deal, public deal pages
docs/        PLAN, ARCHITECTURE, SECURITY, DECISIONS
```

## Run the tests

```bash
cd contracts
npm ci
npm test        # hardhat test solidity: unit, fuzz and invariant tests
```

Hardhat 3 needs Node 22.13 or later.

```bash
cd checker
npm ci
npm run typecheck
npm test        # matching, scheduling and decision tests, no network needed
```

## License

MIT. See [LICENSE](LICENSE).
