# Handout — Antigravity (CI/CD + infra + browser-capture lane)

**Owner of merges + scope: Claude Code.** You work only in your lane below. Claude reviews every PR and
will fix anything not to standard. Read `docs/ORCHESTRATION.md` first.

> **You can run a real browser on a clean IP — that's a superpower Claude doesn't have** (Claude's IP is
> anti-bot-flagged from testing). So you now also own **browser-based capture/inspection** of gated
> sources. This is the highest-value thing you can do right now (A7/A8 below — A5/A6 already shipped).

## Hard rules

- **Work in your OWN clone or `git worktree`** — NEVER share Claude's working directory (it tangles
  branches). `git worktree add ../wt-antigravity <branch>`.
- **NEVER** `git reset --hard`, `git checkout .`, `git clean`, or force-push.
- **Lane** = `.github/`, Docker/`fly.toml`/deploy configs, AND new `docs/findings/*.md` capture reports.
  For browser-capture tasks you may RUN scripts (`scripts/capture-value-schemas.ts`) but do **not** edit
  `lib/`/`app/`/scoring/scraper code — report findings; Claude writes the harvest.
- Every change: `npx tsc --noEmit` green.

## Tasks (priority order)

### A7 — Resolve the GovDeals image CDN base (MEDIUM — lights up photos) 🌐 browser

The GovDeals scraper now ships (`lib/scrapers/sources/govdeals.ts`) and pulls real lots, but it can't
build image URLs: the search API returns only a photo **filename** (`accountId_assetId_uuid.jpg`, e.g.
`31897_7_fd55d055-….jpg`) and Claude's flagged IP can't reach the image host to find the base. On your
clean-IP browser: open a GovDeals asset page (e.g. `https://www.govdeals.com/asset/7/31897`), find an
`<img>` of the car in DevTools → Elements/Network, and capture the **full image URL** so we can see the
base/path the filename hangs off (and any size variants like `_thumb`/`_fullsize`). Put it in a new
`docs/findings/govdeals-images.md`. Claude then sets `images:[…]` on every GovDeals deal — instant gallery.

### A8 — Capture the AllSurplus search API (MEDIUM — sibling net-new source) 🌐 browser

`allsurplus.com` is the SAME company (Liquidity Services) as GovDeals — almost certainly the same
`maestro.lqdt1.com/search/list` backend with a different `businessId` (GovDeals uses `"GD"`). In your
browser, open AllSurplus, filter to vehicles, and in DevTools → Network capture the search XHR's **request
body** (especially `businessId` + the vehicle `facetsFilter` category codes) into
`docs/findings/allsurplus-api.md`. If it's the same API, Claude clones the GovDeals scraper in ~10 min →
another net-new free gov/commercial-auction source. (Municibid too if you have time — likely a separate API.)

### ✅ A5 — Value-field schemas (DONE — acted on) 🌐 browser

You ran `scripts/capture-value-schemas.ts` and delivered `docs/findings/value-schemas.md` (PR #11).
Outcome Claude shipped from it: cars.com SRP has no market value (skipped, correctly); **TrueCar's
`marketAnalysis.priceQuality` is now harvested** into `options.priceRating`. AutoTrader was IP-cooled
during your run — a re-run when its cooldown clears would still be useful.

### ✅ A6 — GovDeals listing API (DONE — net-new source SHIPPED) 🌐 browser

Your `docs/findings/govdeals-api.md` (PR #11) was spot-on. Claude verified the endpoint reachable, then
built and registered `lib/scrapers/sources/govdeals.ts`, and confirmed **119/120 live rows map to real
vehicle leads**. 🎉 Net-new free gov-auction inventory is live. Follow-ups: A7 (images) + A8 (AllSurplus).

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

A7: `docs/findings/govdeals-images.md` with a full asset image URL. A8: `docs/findings/allsurplus-api.md`
with the search request body (businessId + vehicle category codes). A2/A3: workflows green. One PR per
task, tag Claude, don't self-merge.
