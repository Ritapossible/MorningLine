# Hosting the checker

The checker is a small Node process. Every `POLL_INTERVAL_MS` it reads new deals from the
contract, checks GitHub for every day that is due, and calls `report()` with its own key. It
keeps no state, so restarting it is always safe. If it stops, no money is stuck: every day nobody
reports becomes reclaimable by the sponsor once its window closes.

It must run all the time. A demo day lasts 3 minutes and its report window 5, so a checker that
sleeps for even a few minutes lets days lapse.

## What you need first

| Variable | What it is | Where it comes from |
|---|---|---|
| `CHECKER_PRIVATE_KEY` | The key that signs reports. **Secret.** | The wallet whose address is `NEXT_PUBLIC_CHECKER_ADDRESS` in Vercel (`0x84c8…343C`). It needs a little ETH on the chain for gas, nothing else. |
| `CHECK_SEED` | 32 random bytes that make the check minute unpredictable. **Secret.** Keep the same value forever. | `openssl rand -hex 32`, then put `0x` in front. |
| `GITHUB_TOKEN` | Read-only access to public repos, for a higher rate limit. **Secret.** | GitHub > Settings > Developer settings > Fine-grained tokens > Generate. Repository access: *Public repositories*. No permissions. |
| `RPC_URL` | A Base RPC endpoint. | `https://sepolia.base.org` works; a free Alchemy or Coinbase Developer Platform endpoint is more reliable. |
| `MORNINGLINE_ADDRESS` | The contract to watch. | Same as `NEXT_PUBLIC_MORNINGLINE_ADDRESS` in Vercel. |
| `START_BLOCK` | First block to read. Deals opened before it are ignored. | A recent block; `55572000` for the demo deployment. |
| `POLL_INTERVAL_MS` | How often to look. | `20000` for the demo deployment, `600000` for 24-hour days. |

If the checker key is lost, make a new wallet, fund it, use its key here and set its address as
`NEXT_PUBLIC_CHECKER_ADDRESS` in Vercel. New deals use the new checker; old deals keep the one
they were opened with, because a deal's checker can never change.

Never commit any of these, never paste them in chat or an issue, and never log them. The checker
itself never prints them.

## Option A: Render, free, with a keep-alive ping

A free Render web service sleeps after 15 minutes without a request. The checker serves
`/health`, so a free uptime monitor pinging it every 5 minutes keeps it awake.

1. Sign in at render.com with GitHub and allow access to the `MorningLine` repository.
2. **New > Blueprint**, pick the repository. Render reads `render.yaml` from the repo root and
   proposes one web service, `morningline-checker`.
3. It asks for the three secrets: paste `CHECKER_PRIVATE_KEY`, `CHECK_SEED` and `GITHUB_TOKEN`.
   Everything else is filled in from `render.yaml`.
4. **Apply**. The first build runs `npm ci` in `checker/` and starts `npm start`.
5. Open the service's **Logs**. A healthy start prints:
   ```
   health on :10000/health
   checker 0x84c8…343C on chain 84532
   contract 0xcae6…abdbe  fromBlock 55572000  every 20000ms  ...
   dayLength 180s  reportGrace 120s
   ```
   The address on the second line must be the checker address in Vercel.
6. Open `https://<your-service>.onrender.com/health`. It shows `lastSuccessAt` updating every
   20 seconds and `lastError: null`.
7. At uptimerobot.com (free): **New monitor > HTTP(s)**, URL
   `https://<your-service>.onrender.com/health`, interval 5 minutes. This keeps the service
   awake and emails you if it goes down.

## Option B: Railway, always on

Railway does not sleep services, so no keep-alive is needed. New accounts get trial credit;
after that it costs a few dollars a month.

1. railway.com > **New Project > Deploy from GitHub repo**, pick `MorningLine`.
2. In the service's **Settings**, set **Root Directory** to `checker`. Build command
   `npm ci`, start command `npm start`.
3. **Variables**: add every variable from the table above, plus `NODE_VERSION=22`.
4. **Settings > Networking > Generate Domain** to reach `/health`.
5. Check the logs and `/health` as in steps 5 and 6 above.

## Checking it end to end

1. Open a small deal on the site against a line that is in a README.
2. Within a few minutes (demo) the deal page fills in day 1 as paid, with a commit link.
3. `/health` shows `reportsSent` going up.

## When something is wrong

| Symptom | Cause |
|---|---|
| `CHECKER_PRIVATE_KEY is not set` (or another variable) | The variable is missing or empty in the host. |
| Days on new deals lapse instead of being paid | The checker is asleep (add the keep-alive), `POLL_INTERVAL_MS` is too long for the deployment, or the deal was opened before `START_BLOCK`. |
| `NotChecker` in the logs | The key's address is not the deal's checker: it does not match `NEXT_PUBLIC_CHECKER_ADDRESS`. |
| `insufficient funds` | The checker wallet is out of ETH for gas. |
| GitHub `403` or rate limit | Set `GITHUB_TOKEN`. |
| `413` or range errors from the RPC | Lower `LOG_CHUNK_BLOCKS`, or use a better RPC. |

For mainnet, run a second service with the mainnet contract, `RPC_URL`, a mainnet-funded key,
its own `CHECK_SEED`, and `POLL_INTERVAL_MS=600000`.
