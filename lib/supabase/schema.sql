-- DEALERS
CREATE TABLE dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dealership_name TEXT,
  license_number TEXT,
  home_state TEXT NOT NULL,
  home_city TEXT,
  home_zip TEXT,
  phone TEXT,
  email TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'scout' CHECK (plan IN ('scout','pro','elite')),
  default_auction_fee DECIMAL DEFAULT 450,
  default_recon_cost DECIMAL DEFAULT 500,
  default_daily_floor_rate DECIMAL DEFAULT 35,
  default_selling_fee DECIMAL DEFAULT 299,
  target_profit DECIMAL DEFAULT 3500,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VEHICLES (scraped from all 60+ sources)
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_category TEXT, -- 'salvage','wholesale','private','retail','repo','parts'
  external_id TEXT NOT NULL,
  vin TEXT,
  year INT,
  make TEXT,
  model TEXT,
  trim TEXT,
  body_style TEXT,
  odometer INT,
  damage_type TEXT,
  title_type TEXT DEFAULT 'clean',
  condition TEXT,
  current_bid DECIMAL,
  buy_now_price DECIMAL,
  asking_price DECIMAL,
  market_value DECIMAL,
  estimated_repair DECIMAL DEFAULT 0,
  estimated_profit DECIMAL,
  profit_score INT DEFAULT 0 CHECK (profit_score BETWEEN 0 AND 100),
  verdict TEXT CHECK (verdict IN ('go','hold','pass')),
  location_city TEXT,
  location_state TEXT,
  location_zip TEXT,
  lat DECIMAL,
  lng DECIMAL,
  sale_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  images TEXT[] DEFAULT '{}',
  listing_url TEXT NOT NULL,
  raw_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_id)
);

-- INVENTORY (units dealer has purchased)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  vin TEXT NOT NULL,
  year INT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  color TEXT,
  odometer INT,
  condition TEXT DEFAULT 'good',
  photos TEXT[] DEFAULT '{}',
  notes TEXT,
  -- Cost ledger
  purchase_price DECIMAL NOT NULL DEFAULT 0,
  auction_fee DECIMAL DEFAULT 0,
  transport_cost DECIMAL DEFAULT 0,
  repair_cost DECIMAL DEFAULT 0,
  recon_cost DECIMAL DEFAULT 0,
  title_fee DECIMAL DEFAULT 0,
  holding_cost DECIMAL DEFAULT 0,
  other_costs DECIMAL DEFAULT 0,
  total_cost DECIMAL GENERATED ALWAYS AS (
    purchase_price + auction_fee + transport_cost +
    repair_cost + recon_cost + title_fee + holding_cost + other_costs
  ) STORED,
  -- Pricing
  list_price DECIMAL,
  market_value DECIMAL,
  -- Lifecycle
  stage TEXT DEFAULT 'acquired' CHECK (
    stage IN ('acquired','recon','transport','listed','offer','sold','wholesale')
  ),
  floor_date TIMESTAMPTZ DEFAULT NOW(),
  daily_floor_rate DECIMAL DEFAULT 35,
  sold_date TIMESTAMPTZ,
  sold_price DECIMAL,
  -- Source
  purchased_from TEXT,
  purchased_city TEXT,
  purchased_state TEXT,
  lead_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRANSPORT BOOKINGS
CREATE TABLE transports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES dealers(id),
  carrier TEXT,
  from_city TEXT, from_state TEXT, from_zip TEXT,
  to_city TEXT,   to_state TEXT,   to_zip TEXT,
  miles INT,
  trailer_type TEXT DEFAULT 'open',
  quoted_price DECIMAL,
  booked_price DECIMAL,
  pickup_date DATE,
  estimated_delivery DATE,
  actual_delivery DATE,
  status TEXT DEFAULT 'quoted' CHECK (
    status IN ('quoted','booked','picked_up','in_transit','delivered','cancelled')
  ),
  tracking_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALERTS
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  name TEXT,
  make TEXT, model TEXT,
  year_min INT DEFAULT 2010, year_max INT DEFAULT 2030,
  max_price DECIMAL,
  min_profit DECIMAL DEFAULT 3000,
  max_odometer INT DEFAULT 150000,
  states TEXT[] DEFAULT '{}',
  sources TEXT[] DEFAULT '{}',
  damage_types TEXT[] DEFAULT '{}',
  title_types TEXT[] DEFAULT '{clean}',
  active BOOLEAN DEFAULT TRUE,
  last_triggered TIMESTAMPTZ,
  trigger_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALERT MATCHES
CREATE TABLE alert_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  dealer_id UUID REFERENCES dealers(id),
  profit_estimate DECIMAL,
  notified BOOLEAN DEFAULT FALSE,
  viewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RECON STAGES
CREATE TABLE recon_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES dealers(id),
  stage_name TEXT NOT NULL,
  shop_name TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  estimated_days INT,
  estimated_completion TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_cost DECIMAL,
  actual_cost DECIMAL,
  notes TEXT
);

-- RECON EXPENSES
CREATE TABLE recon_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES dealers(id),
  description TEXT NOT NULL,
  vendor TEXT,
  amount DECIMAL NOT NULL,
  category TEXT,
  receipt_url TEXT,
  date DATE DEFAULT CURRENT_DATE
);

-- PRIVATE SELLER LEADS
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  vehicle_description TEXT NOT NULL,
  source TEXT NOT NULL,
  listing_url TEXT,
  ask_price DECIMAL,
  market_value DECIMAL,
  estimated_margin DECIMAL,
  days_listed INT DEFAULT 0,
  outreach_status TEXT DEFAULT 'pending' CHECK (
    outreach_status IN ('pending','sent','replied','offer_made','purchased','dead')
  ),
  outreach_message TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WATCHLIST
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id),
  notes TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- SCRAPE JOBS LOG
CREATE TABLE scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  listings_found INT DEFAULT 0,
  listings_new INT DEFAULT 0,
  cost_usd DECIMAL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX ON vehicles(profit_score DESC);
CREATE INDEX ON vehicles(make, model);
CREATE INDEX ON vehicles(location_state);
CREATE INDEX ON vehicles(source, is_active);
CREATE INDEX ON vehicles(sale_date);
CREATE INDEX ON vehicles(scraped_at DESC);
CREATE INDEX ON inventory(dealer_id, stage);
CREATE INDEX ON inventory(dealer_id, floor_date);
CREATE INDEX ON alert_matches(dealer_id, notified, viewed);
CREATE INDEX ON leads(dealer_id, outreach_status);

-- RLS
ALTER TABLE dealers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory     ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE transports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE recon_stages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE recon_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist     ENABLE ROW LEVEL SECURITY;

-- Dealer sees only their own data
CREATE POLICY "own_dealer"    ON dealers       USING (user_id = auth.uid());
CREATE POLICY "own_inventory" ON inventory     USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "own_alerts"    ON alerts        USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "own_matches"   ON alert_matches USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "own_leads"     ON leads         USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "own_transport" ON transports    USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "own_recon"     ON recon_stages  USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "own_expenses"  ON recon_expenses USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "own_watchlist" ON watchlist     USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));

-- Scraped vehicles: all dealers can read
CREATE POLICY "vehicles_public_read" ON vehicles FOR SELECT USING (TRUE);

-- Auto updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_dealers_updated   BEFORE UPDATE ON dealers   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER t_inventory_updated BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-update inventory repair_cost from expenses
CREATE OR REPLACE FUNCTION sync_repair_cost() RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory SET repair_cost = (
    SELECT COALESCE(SUM(amount),0) FROM recon_expenses WHERE inventory_id = NEW.inventory_id
  ) WHERE id = NEW.inventory_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_sync_repair AFTER INSERT OR UPDATE OR DELETE ON recon_expenses
FOR EACH ROW EXECUTE FUNCTION sync_repair_cost();
