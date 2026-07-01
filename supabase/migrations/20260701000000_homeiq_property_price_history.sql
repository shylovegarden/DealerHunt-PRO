-- HomeIQ price-drop detection. Housing had no price history (cars does), so the scorer's price-cut signal
-- only fired when a SOURCE tagged a reduction — we never detected drops ourselves. This adds a DB-side
-- trigger that, whenever a harvest changes a property's price, records the change + stamps drop metadata on
-- the row. A price cut (and its velocity) is one of the strongest motivation signals. Additive + safe: the
-- new columns are nullable/defaulted (instant on Postgres 11+), the trigger only acts when price actually
-- changes, and the history table is append-only.

alter table public.properties
  add column if not exists prev_price numeric(14, 2),
  add column if not exists price_changed_at timestamptz,
  add column if not exists price_drops int default 0;

create table if not exists public.housing_property_price_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties (id) on delete cascade,
  source_listing_id text,
  old_price numeric(14, 2),
  new_price numeric(14, 2),
  changed_at timestamptz default now()
);
create index if not exists idx_housing_price_hist_property
  on public.housing_property_price_history (property_id, changed_at desc);

-- Non-sensitive aggregate price data — public read, service-role write (mirrors properties).
alter table public.housing_property_price_history enable row level security;
drop policy if exists read_housing_price_hist on public.housing_property_price_history;
create policy read_housing_price_hist on public.housing_property_price_history
  for select using (true);

-- BEFORE UPDATE: stamp drop metadata on the row + append a history row, only when the price truly changes.
create or replace function public.track_property_price_change()
returns trigger language plpgsql as $$
begin
  if NEW.price is not null
     and OLD.price is not null
     and NEW.price is distinct from OLD.price then
    NEW.prev_price := OLD.price;
    NEW.price_changed_at := now();
    NEW.price_drops := coalesce(OLD.price_drops, 0)
                     + case when NEW.price < OLD.price then 1 else 0 end;
    insert into public.housing_property_price_history
      (property_id, source_listing_id, old_price, new_price)
      values (NEW.id, NEW.source_listing_id, OLD.price, NEW.price);
  end if;
  return NEW;
end $$;

drop trigger if exists properties_price_change on public.properties;
create trigger properties_price_change
  before update on public.properties
  for each row execute function public.track_property_price_change();
