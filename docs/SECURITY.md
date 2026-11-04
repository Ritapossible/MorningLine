# Security

## Trust model in one table

| Party | Trusted for | Cannot do |
|---|---|---|
| Contract | holding funds, enforcing day windows and the two destinations | anything not in its code: there is no owner, admin or upgrade |
| Checker (per deal) | reporting present or missing, and which commit it read | send money to itself or anyone but that deal's payee and buyer; settle a day twice; act outside a day's window |
| Buyer | choosing the payee, checker, line and price | take back a day that was already reported; reclaim before a window closes |
| Payee (maintainer) | keeping the line up | get paid for a day reported missing or never reported |
| GitHub | serving the same file to everyone at a given commit | (out of our control: availability, repo deletion) |

## Threats and what bounds them

| Threat | Bound |
|---|---|
| Checker key stolen | The thief can only mis-report open days of deals that use that checker: pay the payee or refund the buyer. Neither destination is the thief (unless the thief is also a payee). Loss is at most the unsettled days of those deals, and it is visible on chain per day. |
| Checker lies (says present while missing, or the reverse) | Each report names a commit SHA; anyone can open it and compare with the repo's public history. Detection, not prevention: there is no dispute mechanism (see DECISIONS D3). |
| Checker goes offline | Every unreported day is reclaimable by the buyer `reportGrace` after it ends. No money can be stuck by silence. |
| Maintainer removes the line after a check | Costs them the following days only; days already reported stay reported. The check minute is unpredictable. |
| Maintainer shows a different README to the checker (cloaking) | Not possible on GitHub for a given commit: the same commit serves the same file to everyone. The remaining gap is *which* commit the checker reports. |
| Line kept, but the logo it points to (hosted elsewhere) removed | Not covered. The check is the raw line only. Stated on every deal page. |
| Reentrancy via token callbacks | `nonReentrant` on every state-changing function; state is updated before transfers. USDC and LINE have no callbacks anyway. |
| Fee-on-transfer or rebasing token configured | Deposits are checked by balance delta and revert if short. Rebasing tokens are out of scope: the deployment uses USDC. |
| USDC blacklists the payee | That day's report reverts; after the window the buyer reclaims it. |
| USDC blacklists the buyer | Refunds and reclaims to that buyer revert; those funds stay in the contract. Accepted: Circle's blacklist is outside our control. |
| Buyer names themselves or the payee as the deal's checker | The contract allows it: the checker is chosen at open and only the zero address is rejected (D4). A checker that is the payee can report its own line present and take the whole escrow; a checker that is the buyer can report a line missing on days it was up and refund itself, leaving the maintainer unpaid. Since the buyer picks the checker, the second is the likelier one and it harms the side that had no say. Bounded, not prevented: deals opened through the web app always use the published checker, and a deal page says plainly when the checker is the buyer, the payee, or simply unfamiliar, so nobody reads a self dealt deal as a checked one. A maintainer should read that panel before adding the line. |
| Spec too large (gas griefing) | Each spec field is limited to 512 bytes. |
| Integer overflow | Solidity 0.8 checked arithmetic; `dailyAmount` is uint128 and `dayCount` at most 366, so totals fit in uint256. |

## What we say publicly (and never more)
- The contract guarantees where each day's money can go. It does not guarantee the checker
  is honest; it makes a dishonest report visible and bounded.
- The SHA proves what a commit contains, not that it was the commit visitors saw that day.
- Only the exact raw line in the pinned file is checked.

## Keys and secrets
- The checker key lives only in the checker host's environment. It holds a little ETH for
  gas and nothing else. It is never committed, pasted into chat, or logged.
- The GitHub token is read-only (public repos). The CDP/RPC keys live in Vercel and the
  checker host environment.
- The deployer key deploys and then has no power: the contracts have no owner functions.
- `.env*` files are git-ignored; review `git diff --cached` before every commit.

## Before mainnet
- [ ] All tests green, including invariants, in CI.
- [ ] USDC address verified against Circle's docs; LINE address recorded.
- [ ] Contracts verified on Basescan; bytecode matches the tagged commit.
- [ ] Deals capped small in the UI during the hackathon (e.g. $50 total per deal). The
      contract is unaudited.
- [ ] Demo deployment clearly labelled, separate from production.

## Reporting a problem
Open a GitHub issue without exploit details and ask for a private contact, or message the
maintainer on X (@ChinazaRitaA).
