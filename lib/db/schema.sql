-- DealerHunt Supabase Schema Definition
-- Enables PostGIS for geographic searches and pg_trgm for fast text searching

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Dealers Table (Independent Dealers, Auctions, Salvage Yards)
CREATE TABLE IF NOT EXISTS public.dealers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('auction', 'independent', 'salvage', 'repo', 'private')),
    state VARCHAR(2) NOT NULL,
    city TEXT NOT NULL,
    zip_code VARCHAR(10),
    website TEXT,
    phone TEXT,
    coordinates geometry(Point, 4326), -- PostGIS point for radius searches
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Listings Table (Vehicles & Parts)
CREATE TABLE IF NOT EXISTS public.listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES public.dealers(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL, -- e.g., 'copart', 'car_part', 'ae_miami'
    listing_type TEXT NOT NULL CHECK (listing_type IN ('vehicle', 'part')),
    
    -- Vehicle Specifics
    vin TEXT,
    year INTEGER,
    make TEXT,
    model TEXT,
    trim TEXT,
    mileage INTEGER,
    title_status TEXT,
    damage_type TEXT,
    
    -- Part Specifics
    part_type TEXT,
    part_condition TEXT,
    
    -- Common Details
    description TEXT,
    price_ask NUMERIC(10, 2),
    price_mmr NUMERIC(10, 2), -- Estimated retail/MMR
    profit_score NUMERIC(5, 2),
    url TEXT NOT NULL,
    image_url TEXT,
    
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'removed')),
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Price History (Time-Series tracking for MMR and Listing drops)
CREATE TABLE IF NOT EXISTS public.price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Scraper Orchestration Runs
CREATE TABLE IF NOT EXISTS public.scraper_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    items_found INTEGER DEFAULT 0,
    error_log TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 6. Indexes for Performance
-- Geo index for finding dealers near a lat/lng
CREATE INDEX IF NOT EXISTS dealers_geo_idx ON public.dealers USING GIST (coordinates);

-- Trigram index for ultra-fast full-text search on vehicle/part descriptions
CREATE INDEX IF NOT EXISTS listings_search_idx ON public.listings USING GIN (make gin_trgm_ops, model gin_trgm_ops, description gin_trgm_ops);

-- Time-series indexes
CREATE INDEX IF NOT EXISTS price_history_time_idx ON public.price_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS listings_status_idx ON public.listings(status, last_seen_at DESC);

-- 7. RLS (Row Level Security) Policies
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow authenticated read access on dealers" ON public.dealers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access on listings" ON public.listings FOR SELECT TO authenticated USING (true);

-- System service role can do everything (used by Next.js edge API / python scrapers)
-- Supabase automatically allows the service_role to bypass RLS.

-- 8. PostGIS Proximity Function
CREATE OR REPLACE FUNCTION get_dealers_within_radius(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_miles DOUBLE PRECISION
)
RETURNS SETOF public.dealers AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.dealers
    WHERE ST_DWithin(
        coordinates,
        ST_SetSRID(ST_MakePoint(lng, lat), 4326),
        radius_miles * 1609.34 -- Convert miles to meters
    );
END;
$$ LANGUAGE plpgsql;
