# Handout — Antigravity (CI/CD + infra lane)

**Owner of merges + scope: Claude Code.** You work only in your lane below. Claude reviews every PR and
will fix anything not to standard. Read `docs/ORCHESTRATION.md` first.

## Hard rules

- **Work in your OWN clone or `git worktree`** — NEVER share Claude's working directory. Branch collisions in a shared checkout have tangled commits onto the wrong branch. Clone the repo separately or `git worktree add ../wt-<you> <branch>`.

- **NEVER** run `git reset --hard`, `git checkout .`, `git clean`, or force-push. (These wiped work
  twice.) Commit your own work on a branch; Claude merges.
- **Lane = `.github/`, `Dockerfile*`, `docker-compose.yml`, `fly.toml`, deploy/infra configs ONLY.**
  Do **NOT** edit `lib/`, `app/`, `components/`, `scripts/`, or any scoring/scraper/pipeline code.
- Every change: `npx tsc --noEmit` must stay green; don't break the build.

## Tasks (in priority order)

### A1 — CI quality gate (HIGH) ✅ biggest value

> ⚠️ Claude: do A1 + A2 BEFORE low-priority tasks. A4 (dependabot) shipped first — A1 (the CI gate) is what actually protects the repo. Prioritize it.

There is currently **no CI that runs tsc/lint/tests** — only scrape workflows. Add
`.github/workflows/ci.yml` that on every push + PR runs, in one job:

```
npm ci
npx tsc --noEmit
npm run lint
npm test            # vitest run
```

Fail the build on any error. This is the single most valuable thing you can add — it stops
regressions from any agent (including Claude) reaching main.

### A2 — Accuracy regression gate (HIGH)

Add `.github/workflows/accuracy.yml`, scheduled weekly (and on `workflow_dispatch`):

```
npm ci
npx tsx scripts/valuation-backtest.ts | tee /tmp/acc.txt
```

Parse the printed `MAPE: X%`. If MAPE > 15, exit non-zero (fail). This guards the valuation moat from
silent regressions. Needs the Supabase secrets (below). Do NOT modify the script itself — Claude owns it.

### A3 — Finish + verify the headed-scrape CI (MEDIUM)

`.github/workflows/scrape.yml` already installs real Chrome + xvfb and runs under `xvfb-run` with
`ENABLE_HEADED_SCRAPERS=1` (Claude wired it). Your job: make it actually green.

- Add the GitHub **repo secrets**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SCRAPE_SECRET` (new — used to guard `/api/scrape`), and the existing AI keys.
- Confirm a manual `workflow_dispatch` run completes and saves deals; fix any env/install breakage.
- **The GitHub Actions billing issue is yours to resolve** (it's blocking scheduled runs).

### A4 — Dependabot + npm audit (LOW)

Add `.github/dependabot.yml` (weekly npm updates, grouped) and a CI step `npm audit --omit=dev` that
warns (does not fail) on high-severity advisories.

## Definition of done

- `ci.yml` green on a test PR; `accuracy.yml` runs and reports a MAPE; `scrape.yml` completes a manual
  dispatch with deals saved; secrets set. Open a PR per task, tag Claude, don't merge yourself.
