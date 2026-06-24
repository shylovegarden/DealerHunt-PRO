-- 20260624020000_retention_fixes.sql
-- Fixes three missing retention policies:
--   1. price_history table grows forever — add 90-day cleanup
--   2. Remove redundant/conflicting cleanup-dead-deals cron job
--   3. Mark deals inactive immediately when not seen in latest scrape (function only — called by pipeline)

-- ─── 1. price_history retention ──────────────────────────────────────────────
-- Keep only the last 90 days of price observations per deal.
-- The pipeline writes a row on every scrape hit, so this can get large fast.
-- ON DELETE CASCADE on the FK already handles cleanup when the parent deal is deleted,
-- but between creation and 60-day hard-delete, rows pile up.

SELECT cron.unschedule('cleanup-price-history') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-price-history'
);

SELECT cron.schedule(
  'cleanup-price-history',
  '30 2 * * *',  -- 2:30 AM nightly, right after cleanup-expired-deals
  $$
    DELETE FROM public.price_history
    WHERE observed_at < NOW() - INTERVAL '90 days';
  $$
);

-- ─── 2. Remove the redundant cleanup-dead-deals cron job ─────────────────────
-- cleanup-expired-deals (2 AM) already does soft + hard delete using last_seen_at.
-- cleanup-dead-deals (4 AM) does a second hard delete using updated_at with 30-day window.
-- They overlap and use different columns, making retention policy confusing.
-- The 2 AM job is more correct (uses last_seen_at = "when scraper last saw this").
-- Unschedule the redundant 4 AM job.

SELECT cron.unschedule('cleanup-dead-deals') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-dead-deals'
);

-- ─── 3. Function: mark_deals_unseen ──────────────────────────────────────────
-- Called by the pipeline after each source run with the set of source_deal_ids
-- that WERE seen in this run. Marks everything else from that source as inactive
-- immediately rather than waiting 30 days.
--
-- Usage (from pipeline.ts after upsert):
--   SELECT mark_deals_unseen('copart', ARRAY['id1','id2',...]);
--
-- This collapses the 30-day stale window to near-zero for fast-moving sources
-- like Copart where lots sell within hours.

CREATE OR REPLACE FUNCTION public.mark_deals_unseen(
  p_source text,
  p_seen_ids text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.deals
  SET
    active = false,
    updated_at = NOW()
  WHERE
    source = p_source
    AND active = true
    AND last_seen_at < NOW() - INTERVAL '2 hours'  -- grace: don't deactivate things just scraped
    AND (
      p_seen_ids IS NULL
      OR array_length(p_seen_ids, 1) = 0
      OR source_deal_id != ALL(p_seen_ids)
    )
    -- Never auto-deactivate saved or watchlisted deals
    AND id NOT IN (SELECT deal_id FROM public.saved_cars WHERE deal_id IS NOT NULL)
    AND id NOT IN (SELECT deal_id FROM public.watchlist WHERE deal_id IS NOT NULL);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_deals_unseen(text, text[]) TO service_role;

-- ─── 4. Consolidate the cleanup-expired-deals job with correct windows ────────
-- Redefine clearly so the policy is unambiguous:
--   30 days no activity → active = false (soft delete)
--   60 days inactive    → hard delete (unless saved/watchlisted)

SELECT cron.unschedule('cleanup-expired-deals') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-deals'
);

SELECT cron.schedule(
  'cleanup-expired-deals',
  '0 2 * * *',
  $$
    -- Soft delete: not seen in 30 days, not saved
    UPDATE public.deals
    SET active = false, updated_at = NOW()
    WHERE
      active = true
      AND last_seen_at < NOW() - INTERVAL '30 days'
      AND id NOT IN (SELECT deal_id FROM public.saved_cars  WHERE deal_id IS NOT NULL)
      AND id NOT IN (SELECT deal_id FROM public.watchlist   WHERE deal_id IS NOT NULL);

    -- Hard delete: inactive for 60 days, not saved
    DELETE FROM public.deals
    WHERE
      active = false
      AND last_seen_at < NOW() - INTERVAL '60 days'
      AND id NOT IN (SELECT deal_id FROM public.saved_cars  WHERE deal_id IS NOT NULL)
      AND id NOT IN (SELECT deal_id FROM public.watchlist   WHERE deal_id IS NOT NULL);

    -- Prune vin_price_history older than 180 days
    DELETE FROM public.vin_price_history
    WHERE recorded_at < NOW() - INTERVAL '180 days';

    -- Prune source_url_cache expired entries
    DELETE FROM public.source_url_cache
    WHERE expires_at < NOW();
  $$
);

COMMENT ON FUNCTION public.mark_deals_unseen IS
  'Call after each source scrape with the IDs seen in that run. Immediately deactivates '
  'deals from that source that were not seen, rather than waiting 30 days. '
  'Skips deals saved or watchlisted by any user.';
