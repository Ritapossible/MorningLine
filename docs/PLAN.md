# Plan

**Deadline: Monday 9 November 2026, 22:00 UTC.** The submission is a live URL. A missing URL
is the only thing that sinks the entry; an imperfect feature does not.

## Definition of done
- [ ] A stranger can open the live URL, get LINE from the faucet, open a deal against a line
      in a public repo, and watch days settle on a public deal page.
- [ ] The demo deployment shows present → paid, missing → refunded, silent → reclaimed.
- [ ] Contract tests green in CI; contracts verified on Basescan.
- [ ] The "not promised" panel is on every deal page.
- [ ] Submission filled in early on Sunday 8 Nov, then only edited.

## Schedule
| Day | Deliverable | Status |
|---|---|---|
| Tue 3 | Repo, docs, `MorningLine.sol`, `LineToken.sol`, 24 tests (unit, fuzz, invariants), mutation check | done |
| Wed 4 | Deploy script; Base Sepolia deployment (production settings + demo settings); CI | done; Basescan verification still needs an Etherscan API key |
| Thu 5 | Checker: log scan, GitHub read, matching, report; runs against our own repo on Sepolia | written, 33 unit tests green; the live run waits on the deployment |
| Fri 6 | Web app: `/new`, `/deal/[id]`, faucet, "check now" | |
| Sat 7 | Base mainnet deployment, $1 deals, live URL, checker hosted | |
| Sun 8 | Demo video, README polish, submit early | |
| Mon 9 | Buffer only: fixes and submission edits, no new features | |

## Cut list (in this order, if time runs short)
1. "Check now" preview on `/new`
2. `/maintainers` page
3. Pseudo-random check minute (check at the start of each window instead)
4. Gas sponsorship (users pay their own few cents of gas)
5. Mainnet (Base Sepolia only, said plainly on the page)

**Never cut:** reclaim, the invariant tests, the "not promised" panel.

## Demo script (60 seconds, demo deployment)
1. Open a $3, 3-day deal against a sponsor line in our own repo; spend 3 LINE.
2. Day 1: present → $1 to the maintainer. Click the commit: the line is in the file.
3. Delete the line and push. Day 2: missing → $1 back. Click the new commit: the line is gone.
4. Stop the checker. After the grace period the sponsor reclaims day 3.

## Steps only the owner can do
- Create a Coinbase Developer Platform account (RPC + optional Paymaster keys).
- Fund the deployer and checker addresses with a little Base ETH (and Sepolia ETH from a faucet).
- Put keys only in Vercel and the checker host's environment settings.
- Ask Vibestarter to enable GitHub for Claude Code on the sponsored workspace.

## To verify before relying on it
- USDC addresses on Base and Base Sepolia (Circle docs).
- That "Morning Line" is not taken by another Base or Vibestarter project.
