#!/bin/bash
# Free local scraper runner for DealerHunt — $0, no GitHub Actions, no paid services.
# Rotates Craigslist shards across the country and writes fresh deals to Supabase. Runs on your
# residential IP, so detail pages aren't blocked → you actually get VINs + images.
#
# Schedule it with launchd: see scripts/com.dealerhunt.scrape.plist (every 30 min).
# Run once by hand to test:  bash scripts/scrape-local.sh
set -euo pipefail

# Resolve project root (this script lives in <root>/scripts).
cd "$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

SHARDS="${CL_SHARDS:-8}"
STATE="${TMPDIR:-/tmp}/dhp-scrape-shard"
SHARD="$(cat "$STATE" 2>/dev/null || echo 0)"
NEXT="$(( (SHARD + 1) % SHARDS ))"
echo "$NEXT" > "$STATE"

LOG="${TMPDIR:-/tmp}/dhp-scrape.log"
echo "[$(date '+%F %T')] start shard ${SHARD}/${SHARDS}" >> "$LOG"
SCRAPE_SOURCES=craigslist CL_SHARDS="$SHARDS" CL_SHARD="$SHARD" \
  npm run scrape:ci >> "$LOG" 2>&1
echo "[$(date '+%F %T')] done" >> "$LOG"
