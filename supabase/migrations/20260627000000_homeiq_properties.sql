-- HomeIQ — the housing vertical's listings table. Mirrors `deals` (the cars vertical) but holds the
-- housing entity. Additive + non-breaking: nothing about the cars app changes. Scored leads are stored
-- so the dashboard reads instantly instead of re-harvesting on every load. Public gov listing data →
-- readable by anyone; writes go through the service role (bypasses RLS), exactly like `deals`.

CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provenance.
  source TEXT NOT NULL,                       -- gov_auction | hud | fsbo | foreclosure | ...
  source_listing_id TEXT,
  source_url TEXT,

  -- Identity.
  title TEXT,
  property_type TEXT,                         -- single_family | multi_family | condo | townhouse | land | ...
  description TEXT,

  -- Location (the spine of the vertical).
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  lat FLOAT8,
  lng FLOAT8,

  -- Money + structure.
  price NUMERIC(14,2),
  beds INT,
  baths NUMERIC(4,1),
  sqft INT,
  lot_size_acres NUMERIC(12,3),
  year_built INT,

  images TEXT[],

  -- Auction / seller context.
  seller TEXT,
  seller_type TEXT,                           -- gov | bank | owner | agent | auction
  auction_end TIMESTAMPTZ,
  bid_count INT,

  -- Lead intelligence (lib/housing/lead-score.ts).
  lead_score INT,
  lead_tier TEXT,                             -- hot | warm | standard
  signals JSONB DEFAULT '{}'::jsonb,

  active BOOLEAN DEFAULT TRUE,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (source, source_listing_id)
);

-- Hot-leads feed (score desc), state browse, source filter — the dashboard's three access paths.
CREATE INDEX IF NOT EXISTS idx_properties_score   ON properties (lead_score DESC NULLS LAST) WHERE active;
CREATE INDEX IF NOT EXISTS idx_properties_state   ON properties (state) WHERE active;
CREATE INDEX IF NOT EXISTS idx_properties_tier    ON properties (lead_tier) WHERE active;
CREATE INDEX IF NOT EXISTS idx_properties_source  ON properties (source);

-- updated_at touch.
CREATE OR REPLACE FUNCTION touch_properties_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_properties_updated_at ON properties;
CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION touch_properties_updated_at();

-- RLS: public listing data is readable by anyone; only the service role writes (it bypasses RLS).
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "properties readable by all" ON properties;
CREATE POLICY "properties readable by all" ON properties FOR SELECT USING (true);
