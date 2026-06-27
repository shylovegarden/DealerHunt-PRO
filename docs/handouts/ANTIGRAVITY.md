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

## ⚠️ CI direction change (2026-06-27) — cloud CI paused, we run LOCAL now

GitHub Actions billing is exhausted, so cloud workflows just fail instantly. **Claude moved the gate
LOCAL** (`npm run verify` + a `.husky/pre-push` hook — same tsc/lint/tests, zero Actions minutes; Kiro
owns keeping it green). So **pause A2/A3 (cloud workflows) for now** — your `infra/ci-accuracy-scrape`
branch is fine to leave open but it won't run until billing is restored; don't invest more there. Your
**highest-value lane is browser capture** (you have the clean IP + browser Claude lacks). Do A9/A10.

## Tasks (priority order)

### A9 — Capture the Municibid search API (HIGH — net-new free source) 🌐 browser

Municibid.com is another public municipal-surplus auction site (police/fleet vehicles), but a DIFFERENT
platform from GovDeals/AllSurplus (those two are now both shipped via the shared `lqdt-maestro` core).
In your browser: open Municibid, filter to autos/vehicles, DevTools → Network → XHR, and capture the
search/listing request (**URL + method + key headers + a one-listing JSON sample**, or if it's
server-rendered HTML, the card markup for one listing) into `docs/findings/municibid-api.md`. Claude
wires it like PublicSurplus → `gov_auction`. Another net-new free inventory stream.

### A10 — Verify the GovDeals/AllSurplus image URLs actually render (LOW — quick confirm) 🌐 browser

Claude built image URLs as `https://webassets.lqdt1.com/assets/photos/{accountId}/{filename}` from your
A7 capture, but can't load them (flagged IP). On your clean IP: paste a couple of constructed URLs from
live lots into a browser tab and confirm the car photo loads (and note if AllSurplus, businessId "AD",
uses the SAME `webassets` base or a different one). One line in `docs/findings/govdeals-images.md` is
enough: "confirmed renders" or the corrected base. Also: a re-run of `scripts/capture-value-schemas.ts`
when AutoTrader's IP cooldown clears would still add value (it was blocked during your A5 run).

### ✅ A7 — GovDeals image CDN (DONE — images live) 🌐 browser

Your `docs/findings/govdeals-images.md` gave the base `webassets.lqdt1.com/assets/photos/{accountId}/`.
Claude wired it into the shared maestro mapper — GovDeals + AllSurplus lots now carry galleries. (A10 is
just a quick render-confirm.)

### ✅ A8 — AllSurplus API (DONE — net-new source SHIPPED) 🌐 browser

Your `docs/findings/allsurplus-api.md` nailed it: same `maestro.lqdt1.com` API, `businessId:"AD"`,
vehicles under `t6`. Claude verified live (88 US / 30 ZAF / 2 CAN — added a US filter), built it on the
shared `lqdt-maestro` core, and registered it. 🎉 Second net-new free auction source live.

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
