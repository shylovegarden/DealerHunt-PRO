# Handout — Antigravity (CI/CD + infra + browser-capture lane)

**Owner of merges + scope: Claude Code.** You work only in your lane below. Claude reviews every PR and
will fix anything not to standard. Read `docs/ORCHESTRATION.md` first.

> **You can run a real browser on a clean IP — that's a superpower Claude doesn't have** (Claude's IP is
> anti-bot-flagged from testing). So you now also own **browser-based capture/inspection** of gated
> sources. This is the highest-value thing you can do right now (A5/A6 below).

## Hard rules

- **Work in your OWN clone or `git worktree`** — NEVER share Claude's working directory (it tangles
  branches). `git worktree add ../wt-antigravity <branch>`.
- **NEVER** `git reset --hard`, `git checkout .`, `git clean`, or force-push.
- **Lane** = `.github/`, Docker/`fly.toml`/deploy configs, AND new `docs/findings/*.md` capture reports.
  For A5/A6 you may RUN scripts (`scripts/capture-value-schemas.ts`) but do **not** edit `lib/`/`app/`/
  scoring/scraper code — report findings; Claude writes the harvest.
- Every change: `npx tsc --noEmit` green.

## Tasks (priority order)

### A5 — Capture value-field schemas (HIGHEST — unblocks accuracy) 🌐 browser

Claude can't inspect these sources (flagged IP); you can. Run, on your clean-IP browser machine:

```
npx tsx scripts/capture-value-schemas.ts
```

It loads cars.com / TrueCar / AutoTrader, finds the embedded third-party market value (KBB/IMV/market-
average), and prints the real field names + paths. **Paste the FULL output into a new
`docs/findings/value-schemas.md`** and open a PR. Claude reads it and writes the precise market-value
harvest (grows the valuation knowledge base — directly improves GO/PASS accuracy). If a source is blocked
even for you, say so in the file.

### A6 — Capture the GovDeals listing API (HIGH — net-new free source) 🌐 browser

GovDeals is a PUBLIC gov-auction site (Angular SPA, Liquidity Services). In your browser: open
`https://www.govdeals.com/vehicles-cars-trucks`, open DevTools → Network, filter XHR, and find the call
that returns the vehicle results (look for `api`/`search`/`asset`/`lqdt`). Capture into a new
`docs/findings/govdeals-api.md`: the request **URL + method + key headers** and a **trimmed sample of the
JSON response** (one listing object). Claude wires the scraper → net-new free inventory like PublicSurplus.

### A2 — Accuracy regression gate (HIGH)

Add `.github/workflows/accuracy.yml`, scheduled weekly + `workflow_dispatch`:

```
npm ci
npx tsx scripts/valuation-backtest.ts | tee /tmp/acc.txt
```

Parse the printed `MAPE: X%`; if MAPE > 15, exit non-zero. Needs the Supabase secrets. Don't modify the
script — Claude owns it.

### A3 — Headed-scrape CI secrets + green run (MEDIUM)

`.github/workflows/scrape.yml` is wired (real Chrome + xvfb + `ENABLE_HEADED_SCRAPERS=1`). Add the repo
secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SCRAPE_SECRET`, AI keys), confirm a manual `workflow_dispatch` saves deals, and **resolve the GitHub
Actions billing** (blocking scheduled runs).

### ✅ Done (don't redo)

- **A1 — CI quality gate**: Claude shipped `.github/workflows/ci.yml` (caught that `next lint` was dead
  in Next 16 + 3 hidden errors; fixed). tsc + lint + 265 tests run on every push.
- **A4 — dependabot**: you shipped it, reviewed, to standard.

## Definition of done

A5: `docs/findings/value-schemas.md` with the real fields. A6: `docs/findings/govdeals-api.md` with the
endpoint + sample. A2/A3: workflows green. One PR per task, tag Claude, don't self-merge.
