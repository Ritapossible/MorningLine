# Morning Line: project memory

Read this first in every session. Keep it short and true; update it when a decision changes.

## What we are building
Per-day escrow for a sponsor line in a GitHub README, on Base. The sponsor locks USDC and LINE
fuel; once a day the checker reads the pinned file at the latest commit of the pinned branch;
present pays the maintainer that day, missing refunds the sponsor that day; silent days are
reclaimable 48 h after they end. One job. Details: `docs/ARCHITECTURE.md`.

## Hard deadline
Vibeathon 02 build window closes **Mon 9 Nov 2026, 22:00 UTC**. The submission is a live URL.
Follow `docs/PLAN.md`; when behind, use its cut list. Do not add features outside the plan.

## Scope lock (decided, do not reopen without the owner)
- Venue: GitHub files only. No web pages, no X posts.
- No disputes, no juries, no Wayback, no multi-region fetching, no TEEs, no AI in the
  pay/refund path (`docs/DECISIONS.md` D2, D3, D10).
- No owner, admin, proxy or upgrade in the contracts (D5). The checker is fixed per deal (D4).

## Contract rules that every change must keep (tests in `contracts/test/`)
1. Fully backed: balance == sum of unsettled days (USDC) and unsettled fuel (LINE).
2. Each day settles exactly once.
3. Only the deal's checker inside the window, or the buyer's reclaim after it, settles a day.
4. Every report spends exactly `fuelPerCheck`.
5. Deal USDC goes only to that deal's payee or buyer.
A change to `MorningLine.sol` without a test for its new behavior is not done. Run
`cd contracts && npm test` before every commit.

## Claims: say exactly this, never more
- The SHA proves what that commit contains, not that it was the commit visitors saw that day.
- Only the exact raw line in the pinned file counts; remote images are not covered.
- Matching is literal, not meaning. The checker is trusted for which commit it reads;
  a lie is visible and bounded, not prevented.
- Name Stamped, Payd, SponsorGit, Polar and GitHub Sponsors as prior art.

## Security
- Never commit, paste or log keys. Secrets live only in Vercel and the checker host's
  environment. `.env*` is git-ignored. Check `git diff --cached` before committing.
- Never run wallet or money steps for the owner; never ask for keys in chat.

## Conventions
- Commits authored as `Ritapossible <egwuaturita95@gmail.com>`.
- Default branch `main`.
- Plain, specific writing in docs and UI; no em dashes.
- Toolchain: Node 22, Hardhat 3 (Solidity tests via forge-std), solc 0.8.28, viem.
