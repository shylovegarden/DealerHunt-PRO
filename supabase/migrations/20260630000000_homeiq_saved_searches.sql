-- HomeIQ instant deal alerts: saved searches + a per-user feed inbox (the dedup key powers "notify only
-- on a genuinely NEW matching property"). Mirrors the cars user_saved_searches / user_feed_inbox pattern,
-- with housing criteria. Additive; existing tables untouched.

create table if not exists public.housing_saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- criteria (all optional — null = "any")
  state text,
  city text,
  zip text,
  property_type text,
  source text,
  min_price numeric,
  max_price numeric,
  min_beds numeric,
  min_lead_score numeric,         -- only alert at/above this score
  tier text,                       -- 'hot' | 'warm' | null (any)
  notify_email boolean default true,
  notify_sms boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  last_run_at timestamptz
);

create index if not exists idx_housing_searches_active
  on public.housing_saved_searches (is_active) where is_active;
create index if not exists idx_housing_searches_user
  on public.housing_saved_searches (user_id, created_at desc);

create table if not exists public.housing_feed_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  search_id uuid references public.housing_saved_searches (id) on delete cascade,
  property_listing_id text not null,   -- = properties.source_listing_id
  status text default 'unread',         -- unread | read | saved | dismissed
  created_at timestamptz default now(),
  unique (user_id, property_listing_id)  -- the "new match only" dedup key
);
create index if not exists idx_housing_inbox_user
  on public.housing_feed_inbox (user_id, created_at desc);

-- RLS: each user sees only their own rows.
alter table public.housing_saved_searches enable row level security;
alter table public.housing_feed_inbox enable row level security;

drop policy if exists own_housing_searches on public.housing_saved_searches;
create policy own_housing_searches on public.housing_saved_searches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_housing_inbox on public.housing_feed_inbox;
create policy own_housing_inbox on public.housing_feed_inbox
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
