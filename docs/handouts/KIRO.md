# Handout — Kiro (QA / tests / data-quality lane)

**Owner of merges + scope: Claude Code.** Bounded, verifiable work only. Claude reviews + fixes. Read
`docs/ORCHESTRATION.md` first.

## Hard rules

- **NEVER** `git reset --hard`, `git checkout .`, `git clean`, or force-push.
- **Lane = NEW files only**: `lib/**/*.test.ts` (new tests), `scripts/qa-*.ts` (new read-only audit
  scripts). For the copy task you may edit ONLY the exact files named in K3.
- **Do NOT touch** scoring logic, scrapers, pipeline, `smart-fetch.ts`, `deal-analyzer.ts`,
  `market-value.ts`, `condition-value.ts`, `baseline-value.ts`, API routes, or anything Claude is
  actively editing. If unsure, it's out of lane.
- Every change: `npx tsc --noEmit` green, `npm test` green.

## Tasks (in priority order)

### K1 — Unit tests for the new valuation primitives (HIGH)

These are PURE functions — perfect for objective tests. Add tests (new `.test.ts` files) asserting
behavior, NOT implementation:

- `lib/scoring/condition-value.ts` → `mileageMultiplier`: more miles than the reference → lower
  multiplier (monotonic); missing mileage on an old car → < 1.0 (assumes wear); clamps to [0.4, 1.22].
- `lib/sources/source-meta.ts` → `sourceMeta`/`buyTerms`: copart → channel "salvage" + "Max bid";
  carvana → "retail" + "Buy under"; craigslist → "Max offer"; unknown source → fallback, no throw.
- `lib/valuation/confidence.ts` → `valueConfidence`: comps+soldAnchored → "high"; market → "fair";
  null → "estimate".
  Run `npm test` — all green. ~30–50 assertions total.

### K2 — Data-quality audit script (HIGH, read-only)

Add `scripts/qa-data-quality.ts` (mirror the env-loading in `scripts/valuation-backtest.ts`). Read-only
query of `deals`; print counts + samples of: (a) junk model strings (ALL CAPS gibberish like
"F-150 ETREMELY", >25 chars, or containing digits-only tokens), (b) non-automotive makes (not in a
known-make list), (c) impossible years (<1960 or >next year), (d) deals with `ask_price` but no
make/model. Output a summary report. **Do not modify any data** — this is a findings report Claude uses
to harden the pipeline.

### K3 — Empty-state + microcopy pass (MEDIUM, bounded)

ONLY these files, copy/empty-states only (no logic, no data shape changes):

- `app/(dashboard)/saved/page.tsx`, `app/(dashboard)/alerts/page.tsx`, `app/(dashboard)/searches/page.tsx`
  For each: when the list is empty, show a friendly, on-brand empty state (icon + one-line value prop +
  a primary CTA button to `/discover`). Match the existing design tokens (`var(--t1..t5)`, `var(--s0..s3)`,
  `glass-panel`, `var(--r2)`). Screenshot before/after in the PR.

## Definition of done

- K1: new test files, `npm test` green. K2: `npx tsx scripts/qa-data-quality.ts` prints a clean report.
- K3: empty states render, tokens match, no console errors. One PR per task, tag Claude, don't merge.
