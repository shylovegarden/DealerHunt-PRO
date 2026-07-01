-- HomeIQ live pricing — per-ZIP aggregates computed from OUR live harvest, so valuation LEARNS from the
-- data we ingest instead of only a periodic static snapshot. `psf_*` = median SOLD $/sqft (the ARV input,
-- fresher than the committed zip-ppsf snapshot); the `active_*` columns = market temperature (for users,
-- never ARV). One row per ZIP, upserted by the pricing job.

create table if not exists public.zip_live_psf (
  zip text primary key,
  psf_all numeric,            -- median sold $/sqft, all residential
  psf_single_family numeric,
  psf_multi_family numeric,
  psf_condo numeric,
  sold_comps integer,         -- # of sold comps behind psf_all (trust gate)
  active_count integer,       -- active listings in the ZIP (market temperature)
  median_dom integer,         -- median days-on-market of active listings
  list_psf numeric,           -- median ASKING $/sqft (context only — not ARV)
  updated_at timestamptz default now()
);

-- Read-only to clients (the map is loaded server-side); writes are service-role.
alter table public.zip_live_psf enable row level security;
drop policy if exists zip_live_psf_read on public.zip_live_psf;
create policy zip_live_psf_read on public.zip_live_psf for select using (true);
