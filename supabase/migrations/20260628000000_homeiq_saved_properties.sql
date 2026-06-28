-- HomeIQ saved-leads pipeline — the housing twin of `saved_cars`. A user saves a property and tracks it
-- through a flip pipeline (new → contacted → analyzing → offer → contract → closed/dead). A denormalized
-- snapshot keeps the saved view intact even if the source listing is later pruned. RLS: each user sees
-- and edits only their own. Additive + non-breaking.

CREATE TABLE IF NOT EXISTS saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_listing_id TEXT NOT NULL,         -- = properties.source_listing_id
  snapshot JSONB,                            -- denormalized property at save time
  status TEXT DEFAULT 'new',                 -- new | contacted | analyzing | offer | contract | closed | dead
  notes TEXT,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, property_listing_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_properties_user ON saved_properties (user_id, saved_at DESC);

CREATE OR REPLACE FUNCTION touch_saved_properties_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saved_properties_updated_at ON saved_properties;
CREATE TRIGGER trg_saved_properties_updated_at
  BEFORE UPDATE ON saved_properties
  FOR EACH ROW EXECUTE FUNCTION touch_saved_properties_updated_at();

ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own saved_properties select" ON saved_properties;
CREATE POLICY "own saved_properties select" ON saved_properties FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own saved_properties insert" ON saved_properties;
CREATE POLICY "own saved_properties insert" ON saved_properties FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own saved_properties update" ON saved_properties;
CREATE POLICY "own saved_properties update" ON saved_properties FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own saved_properties delete" ON saved_properties;
CREATE POLICY "own saved_properties delete" ON saved_properties FOR DELETE USING (auth.uid() = user_id);
