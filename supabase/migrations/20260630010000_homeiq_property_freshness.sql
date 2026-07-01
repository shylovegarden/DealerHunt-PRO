-- HomeIQ freshness: homes never expired (active was write-once-true, no last_seen) so sold/delisted
-- listings accumulated forever and inflated every count. Mirror the cars lifecycle: track last_seen_at,
-- and a reconcile (run each harvest) marks anything unseen for 21 days inactive. Additive + safe — existing
-- rows seed last_seen_at = now(), so nothing prunes for 21 days while the harvest re-stamps live listings.

alter table public.properties
  add column if not exists last_seen_at timestamptz default now();

-- Backfill nulls to the best signal we have (scraped_at), else now().
update public.properties
  set last_seen_at = coalesce(scraped_at, now())
  where last_seen_at is null;

-- Prune lookups: "active rows last seen before X".
create index if not exists idx_properties_last_seen
  on public.properties (active, last_seen_at);
