# Architecture

```
Sponsor wallet ──openDeal(USDC + LINE)──► MorningLine.sol (Base) ◄──report(day, sha, present)── Checker
                                             │ pays maintainer / refunds sponsor              │
                                             │ events: DealOpened, DealSpec,                  │ GitHub REST API
                                             │         DayReported, DayReclaimed              ▼
Web app ◄──────────── reads events and state straight from Base ───────────────   repo @ pinned branch
```

Three parts, one source of truth: the contract's state and events on Base. There is no
database. The checker and the web app both derive everything from chain data and GitHub.

## 1. Contract: `contracts/contracts/MorningLine.sol`

### Deployment settings (immutable)
| Setting | Production | Demo deployment |
|---|---|---|
| `usdc` | USDC on Base | test USDC on Base Sepolia |
| `fuelToken` | LINE (later: the project's Vibestarter token) | LINE |
| `fuelPerCheck` | 1 LINE | 1 LINE |
| `fuelSink` | `0x…dEaD` (spent fuel is gone) | same |
| `dayLength` | 1 day | 180 seconds, labelled "demo" in the UI |
| `reportGrace` | 48 hours | 120 seconds |
| `cancelNotice` | 1 day | 1 day (3 minutes) |

No owner, no admin, no proxy. A change of any setting is a new deployment.

### Deal
```
buyer, payee, checker   addresses; checker fixed at open
dailyAmount             uint128, USDC (6 decimals)
dayCount                1..366
start                   uint40, day 0 begins here (not in the past, at most 365 days ahead)
specHash                keccak256(abi.encode(repo, branch, path, line))
settled                 days already paid or refunded
```
The full spec strings are emitted in `DealSpec`; only the hash is stored.

### Day windows
For day `d`: `opens = start + d * dayLength`, `closes = opens + dayLength + reportGrace`.
- `report` is accepted in `[opens, closes)`.
- `reclaim` is accepted from `closes` onward, for days still open.

### Functions
| Function | Who | Effect |
|---|---|---|
| `openDeal(payee, checker, dailyAmount, dayCount, start, spec)` | anyone (becomes buyer) | pulls `dailyAmount * dayCount` USDC and `dayCount * fuelPerCheck` LINE; rejects tokens that deliver less than asked |
| `report(dealId, day, present, commitSha, fileHash)` | the deal's checker | sends 1 fuel to the sink, then pays the payee (present) or refunds the buyer (missing); present requires a non-zero SHA and file hash |
| `cancel(dealId)` | the deal's buyer | ends the deal after the days already started plus `cancelNotice`; refunds every later day with its fuel |
| `release(dealId)` | the deal's payee | ends the deal after the days already started; refunds every later day with its fuel |
| `extend(dealId, extraDays)` | the deal's buyer | while the last day has not ended, pulls USDC and fuel for more days at the same price |
| `reclaim(dealId, days[])` | the deal's buyer | for each listed day past its window and still open: refund its USDC and its unused fuel |
| `getDeal`, `dayStatus`, `dayWindow`, `daysStarted`, `specHashOf` | anyone | views |

### Invariants (each has a test, see `contracts/test/`)
1. **Fully backed:** the contract's USDC balance equals the sum over deals of
   `dailyAmount * (dayCount - settled)`, and its LINE balance equals
   `fuelPerCheck * (dayCount - settled)` summed. Never insolvent, never stuck.
2. **Once per day:** a day moves from Open to Paid or Refunded exactly once.
3. **Only two ways to settle:** a report by the deal's checker inside the window, or the
   buyer's reclaim after it.
4. **No check without fuel:** every report sends exactly `fuelPerCheck` to the sink.
5. **Two destinations only:** deal USDC goes to that deal's payee or buyer, nowhere else.
6. **Changing length never undoes a day:** a day can only be settled after it has started, and
   cancel and release keep every started day, so no settled day is ever removed. The fuzzer
   drives cancel, release and extend alongside reports and reclaims.

### Engineering notes
- Checks, then state, then transfers; `nonReentrant` on every state-changing function.
- `SafeERC20` everywhere; balance-delta check on deposit (fee-on-transfer tokens rejected).
- No unbounded loops: `reclaim` loops only over the caller's list, and each listed day must
  be distinct and open (a duplicate reverts), so the list is at most `dayCount` (366).
- Spec fields are 1..512 bytes each, bounding event size and gas.

## 2. Checker: `checker/` (planned)

A small TypeScript worker (Node 22, viem) with one job: for every open deal-day whose
window is open, decide present or missing and call `report`.

### Loop (every 10 minutes)
1. Read `DealOpened` / `DealSpec` / `DayReported` / `DayReclaimed` logs since deployment
   (cached block cursor) and build the set of open deal-days.
2. For each deal-day whose window is open, skip it until its check minute: a pseudo-random
   offset inside the day, `keccak256(seed, dealId, day) % dayLength`, so the maintainer
   cannot predict the check time. The seed is a private environment variable.
3. Resolve the commit: `GET /repos/{owner}/{repo}/commits/{branch}` → `sha`.
4. Read the file at that commit: `GET /repos/{owner}/{repo}/contents/{path}?ref={sha}`
   with `Accept: application/vnd.github.raw`.
5. Match (see below). Missing branch or file is **missing**, not an error.
6. Re-read `dayStatus` on chain (idempotent retries), then send `report(dealId, day, present, sha)`.

### Matching rule
- Normalize the file and the spec line: CRLF and CR become LF; strip trailing spaces and tabs.
- Present means: some whole line of the file equals the spec line exactly. Substrings do not
  count, so a sponsor line inside a code block or a longer line does not match by accident.
- Case-sensitive, byte-for-byte after normalization. No HTML rendering, no Markdown parsing.

### Failure handling
| Situation | Behavior |
|---|---|
| GitHub API down or rate-limited | do not report; retry next loop. If it lasts past the window, the buyer can reclaim. |
| Branch renamed or deleted, file moved | report missing (the pinned spec no longer holds) |
| Repo private or deleted | report missing |
| RPC or transaction failure | retry with backoff; nonce managed by viem; never double-report (status checked first) |
| Checker key out of gas | `/health` turns red; days stay reclaimable |

### Configuration (environment only, never committed)
`RPC_URL`, `CHECKER_PRIVATE_KEY`, `GITHUB_TOKEN`, `MORNINGLINE_ADDRESS`, `CHECK_SEED`,
`START_BLOCK`, `LOG_CHUNK_BLOCKS`. GitHub token: read-only public access is enough (5,000
requests per hour). Public RPC endpoints cap `eth_getLogs` ranges, and Base's public Sepolia
endpoint answers 413 above 200 blocks, so `LOG_CHUNK_BLOCKS` defaults to 200. The block cursor
lives in the process: each loop reads only new blocks, and a restart rescans from `START_BLOCK`
to reach the same state.

## 3. Web app: `web/` (planned)

Next.js, OnchainKit, wagmi and viem. Base Account first (with CDP Paymaster sponsoring gas
when configured); any wallet works.

| Page | What it does |
|---|---|
| `/new` | Repo URL → default branch filled in; file (default `README.md`); the exact line; maintainer address; price per day; number of days. "Check now" reads GitHub from the browser and shows whether the line is there today. Shows USDC and LINE totals before signing. Faucet button for LINE. |
| `/deal/[id]` | Public, no wallet needed. A strip of days: paid, refunded, waiting, or reclaimable, each linked to its commit on GitHub and its transaction on Basescan. Totals. The "not promised" panel. Reclaim button for the buyer. |
| `/maintainers` | How to sell a slot: share your address, add the line, send the deal link. |

The page shows the checker's last successful run (`/health`) so silence is visible.

`/api/deal/[id]` serves a deal's spec and evidence. It binary-searches historical contract state
for the block the deal was opened in and the block each day was settled in, then reads logs
from those single blocks, so it works for deals of any age on an RPC that caps log ranges (D14).

## 4. Hosting and environments
| Piece | Where |
|---|---|
| Contracts | Base Sepolia (development, demo deployment) and Base mainnet, verified on Basescan |
| Web app | Vercel |
| Checker | a small always-on host (e.g. Render), secrets in its environment |
| RPC | a CDP or Alchemy Base endpoint (the public endpoint is rate-limited) |

USDC addresses (verify against Circle's docs before deploying):
- Base mainnet `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Base Sepolia `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
