-- DealerHunt Database Schema
-- Real database structure for production use

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- User profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'manager', 'user')),
  tier_id TEXT NOT NULL DEFAULT 'starter' CHECK (tier_id IN ('starter', 'professional', 'business', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('active', 'suspended', 'trialing', 'canceled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  preferences JSONB DEFAULT '{
    "notifications": true,
    "emailAlerts": true,
    "smsAlerts": false,
    "theme": "auto",
    "timezone": "America/New_York",
    "currency": "USD"
  }'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL CHECK (tier_id IN ('starter', 'professional', 'business', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  billing TEXT NOT NULL DEFAULT 'monthly' CHECK (billing IN ('monthly', 'yearly')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  vehicles_this_month INTEGER DEFAULT 0,
  searches_today INTEGER DEFAULT 0,
  arbitrage_reports_this_month INTEGER DEFAULT 0,
  teardown_analyses_this_month INTEGER DEFAULT 0,
  dealer_contacts_this_month INTEGER DEFAULT 0,
  api_calls_this_month INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Vehicle listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('auction', 'marketplace', 'dealer', 'parts')),
  title TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  year INTEGER,
  make TEXT,
  model TEXT,
  vin TEXT,
  mileage INTEGER,
  location TEXT,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  auction_end TIMESTAMP WITH TIME ZONE,
  bid_count INTEGER,
  seller TEXT,
  seller_type TEXT CHECK (seller_type IN ('dealer', 'auction', 'private')),
  condition TEXT CHECK (condition IN ('clean', 'salvage', 'rebuilt', 'parts')),
  transport_cost NUMERIC,
  repair_estimate NUMERIC,
  profit_score NUMERIC,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dealers table
CREATE TABLE IF NOT EXISTS dealers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('independent', 'auction', 'franchise', 'salvage', 'wholesale', 'parts')),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  coordinates POINT NOT NULL, -- PostGIS point for location
  phone TEXT,
  email TEXT,
  website TEXT,
  total_listings INTEGER DEFAULT 0,
  avg_price NUMERIC,
  price_range NUMRANGE,
  popular_makes TEXT[] DEFAULT '{}',
  update_frequency TEXT,
  rating NUMERIC CHECK (rating >= 1 AND rating <= 5),
  reviews INTEGER DEFAULT 0,
  years_in_business INTEGER,
  accreditations TEXT[] DEFAULT '{}',
  license TEXT,
  established DATE,
  employees INTEGER,
  specialties TEXT[] DEFAULT '{}',
  services TEXT[] DEFAULT '{}',
  sources TEXT[] DEFAULT '{}',
  transport_available BOOLEAN DEFAULT FALSE,
  financing_available BOOLEAN DEFAULT FALSE,
  inspection_available BOOLEAN DEFAULT FALSE,
  deal_score NUMERIC CHECK (deal_score >= 0 AND deal_score <= 100),
  profit_potential NUMERIC,
  reliability_score NUMERIC CHECK (reliability_score >= 0 AND reliability_score <= 100),
  responsiveness_score NUMERIC CHECK (responsiveness_score >= 0 AND responsiveness_score <= 100),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parts analysis table
CREATE TABLE IF NOT EXISTS parts_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  vehicle_info JSONB NOT NULL,
  parts JSONB NOT NULL,
  summary JSONB NOT NULL,
  recommendations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Geographic arbitrage opportunities table
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  source_region JSONB NOT NULL,
  target_region JSONB NOT NULL,
  arbitrage JSONB NOT NULL,
  market_factors JSONB NOT NULL,
  recommendations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  alert_threshold NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('price_drop', 'new_listing', 'auction_ending', 'arbitrage_opportunity')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scraper runs table
CREATE TABLE IF NOT EXISTS scraper_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  listings_found INTEGER DEFAULT 0,
  listings_saved INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  date DATE NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(listing_id, date, source)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(tier_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON usage_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_make_model ON listings(make, model);
CREATE INDEX IF NOT EXISTS idx_listings_scraped_at ON listings(scraped_at);
CREATE INDEX IF NOT EXISTS idx_dealers_state ON dealers(state);
CREATE INDEX IF NOT EXISTS idx_dealers_type ON dealers(type);
CREATE INDEX IF NOT EXISTS idx_dealers_coordinates ON dealers USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_source ON scraper_runs(source);
CREATE INDEX IF NOT EXISTS idx_price_history_listing ON price_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage" ON usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON usage_tracking FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own watchlist" ON watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own watchlist" ON watchlist FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own alerts" ON alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON alerts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own parts analyses" ON parts_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own parts analyses" ON parts_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own arbitrage opportunities" ON arbitrage_opportunities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own arbitrage opportunities" ON arbitrage_opportunities FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Public access for listings and dealers (read-only)
CREATE POLICY "Anyone can view listings" ON listings FOR SELECT USING (true);
CREATE POLICY "Anyone can view dealers" ON dealers FOR SELECT USING (true);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usage_tracking_updated_at BEFORE UPDATE ON usage_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dealers_updated_at BEFORE UPDATE ON dealers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parts_analyses_updated_at BEFORE UPDATE ON parts_analyses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_arbitrage_opportunities_updated_at BEFORE UPDATE ON arbitrage_opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_watchlist_updated_at BEFORE UPDATE ON watchlist FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create daily usage tracking
CREATE OR REPLACE FUNCTION get_or_create_usage_tracking(user_uuid UUID)
RETURNS usage_tracking AS $$
DECLARE
    tracking_record usage_tracking;
BEGIN
    SELECT * INTO tracking_record 
    FROM usage_tracking 
    WHERE user_id = user_uuid AND date = CURRENT_DATE;
    
    IF NOT FOUND THEN
        INSERT INTO usage_tracking (user_id, date)
        VALUES (user_uuid, CURRENT_DATE)
        RETURNING * INTO tracking_record;
    END IF;
    
    RETURN tracking_record;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(
    user_uuid UUID,
    usage_type TEXT
) RETURNS VOID AS $$
DECLARE
    tracking_record usage_tracking;
BEGIN
    tracking_record := get_or_create_usage_tracking(user_uuid);
    
    CASE usage_type
        WHEN 'search' THEN
            UPDATE usage_tracking 
            SET searches_today = searches_today + 1 
            WHERE id = tracking_record.id;
        WHEN 'arbitrage' THEN
            UPDATE usage_tracking 
            SET arbitrage_reports_this_month = arbitrage_reports_this_month + 1 
            WHERE id = tracking_record.id;
        WHEN 'teardown' THEN
            UPDATE usage_tracking 
            SET teardown_analyses_this_month = teardown_analyses_this_month + 1 
            WHERE id = tracking_record.id;
        WHEN 'contact' THEN
            UPDATE usage_tracking 
            SET dealer_contacts_this_month = dealer_contacts_this_month + 1 
            WHERE id = tracking_record.id;
        WHEN 'api' THEN
            UPDATE usage_tracking 
            SET api_calls_this_month = api_calls_this_month + 1 
            WHERE id = tracking_record.id;
    END CASE;
END;
$$ LANGUAGE plpgsql;
