-- ===========================================
-- Wine Data Layer - Combined Migrations
-- Run this in Supabase SQL Editor
-- ===========================================

-- Migration 001: Create wines table
CREATE TABLE IF NOT EXISTS wines (
    ct_wine_id TEXT PRIMARY KEY,
    wine_name TEXT NOT NULL,
    vintage TEXT,
    producer TEXT,
    sort_producer TEXT,
    varietal TEXT,
    master_varietal TEXT,
    designation TEXT,
    vineyard TEXT,
    country TEXT,
    region TEXT,
    sub_region TEXT,
    appellation TEXT,
    locale TEXT,
    type TEXT,
    color TEXT,
    category TEXT,
    quantity INTEGER DEFAULT 0,
    bottle_size TEXT DEFAULT '750ml',
    location TEXT,
    bin TEXT,
    barcode TEXT,
    price DECIMAL(10,2),
    valuation DECIMAL(10,2),
    currency TEXT DEFAULT 'USD',
    exchange_rate DECIMAL(10,6),
    native_price DECIMAL(10,2),
    native_price_currency TEXT,
    store_name TEXT,
    purchase_date DATE,
    drink_date_min TEXT,
    drink_date_max TEXT,
    personal_note TEXT,
    my_score TEXT,
    ct_score DECIMAL(4,1),
    ct_notes_count INTEGER,
    personal_notes_count INTEGER,
    critic_scores JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wines_country ON wines(country);
CREATE INDEX IF NOT EXISTS idx_wines_region ON wines(region);
CREATE INDEX IF NOT EXISTS idx_wines_producer ON wines(producer);
CREATE INDEX IF NOT EXISTS idx_wines_varietal ON wines(varietal);
CREATE INDEX IF NOT EXISTS idx_wines_master_varietal ON wines(master_varietal);
CREATE INDEX IF NOT EXISTS idx_wines_vintage ON wines(vintage);
CREATE INDEX IF NOT EXISTS idx_wines_type ON wines(type);
CREATE INDEX IF NOT EXISTS idx_wines_location ON wines(location);
CREATE INDEX IF NOT EXISTS idx_wines_ct_score ON wines(ct_score);
CREATE INDEX IF NOT EXISTS idx_wines_barcode ON wines(barcode);
CREATE INDEX IF NOT EXISTS idx_wines_critic_scores ON wines USING GIN (critic_scores);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wines_updated_at
    BEFORE UPDATE ON wines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Migration 002: Create wine_enrichments table
CREATE TABLE IF NOT EXISTS wine_enrichments (
    wine_id TEXT PRIMARY KEY REFERENCES wines(ct_wine_id) ON DELETE CASCADE,
    tasting_appearance TEXT,
    tasting_nose TEXT,
    tasting_palate TEXT,
    tasting_finish TEXT,
    tasting_overall TEXT,
    aroma_descriptors TEXT[],
    flavor_descriptors TEXT[],
    food_pairings JSONB,
    characteristics JSONB,
    aging_potential TEXT,
    drink_from_year TEXT,
    drink_by_year TEXT,
    serving_suggestions JSONB,
    enrichment_status TEXT DEFAULT 'pending',
    enriched_at TIMESTAMPTZ,
    model_version TEXT,
    model_prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrichments_status ON wine_enrichments(enrichment_status);

CREATE TRIGGER update_enrichments_updated_at
    BEFORE UPDATE ON wine_enrichments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Migration 003: Create bottles table
CREATE TABLE IF NOT EXISTS bottles (
    ct_bottle_id TEXT PRIMARY KEY,
    wine_id TEXT NOT NULL REFERENCES wines(ct_wine_id) ON DELETE CASCADE,
    bottle_state INTEGER NOT NULL DEFAULT 1,
    status TEXT GENERATED ALWAYS AS (
        CASE bottle_state
            WHEN 1 THEN 'in_stock'
            WHEN 0 THEN 'consumed'
            ELSE 'unknown'
        END
    ) STORED,
    barcode TEXT,
    location TEXT,
    bin TEXT,
    bottle_size TEXT DEFAULT '750ml',
    price DECIMAL(10,2),
    store_name TEXT,
    purchase_date DATE,
    consumed_date DATE,
    consumed_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bottles_wine ON bottles(wine_id);
CREATE INDEX IF NOT EXISTS idx_bottles_state ON bottles(bottle_state);
CREATE INDEX IF NOT EXISTS idx_bottles_location ON bottles(location);
CREATE INDEX IF NOT EXISTS idx_bottles_barcode ON bottles(barcode);

CREATE TRIGGER update_bottles_updated_at
    BEFORE UPDATE ON bottles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Migration 004: Create pull_list_items table
CREATE TABLE IF NOT EXISTS pull_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wine_id TEXT NOT NULL REFERENCES wines(ct_wine_id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    user_id UUID,
    notes TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wine_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pull_list_wine ON pull_list_items(wine_id);
CREATE INDEX IF NOT EXISTS idx_pull_list_user ON pull_list_items(user_id);


-- Migration 005: Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Migration 006: Create views
CREATE OR REPLACE VIEW v_wines_full AS
SELECT
    w.ct_wine_id AS id,
    w.wine_name,
    w.vintage,
    w.producer,
    w.sort_producer,
    w.varietal,
    w.master_varietal,
    w.designation,
    w.vineyard,
    w.region,
    w.country,
    w.appellation,
    w.locale,
    w.sub_region,
    w.type,
    w.color,
    w.category,
    w.bottle_size,
    w.quantity,
    w.location,
    w.bin,
    w.barcode,
    w.price,
    w.valuation,
    w.currency,
    w.exchange_rate,
    w.native_price,
    w.native_price_currency,
    w.store_name,
    w.purchase_date,
    w.drink_date_min,
    w.drink_date_max,
    w.personal_note,
    w.my_score,
    w.ct_score,
    w.ct_notes_count,
    w.personal_notes_count,
    w.critic_scores,
    JSONB_BUILD_OBJECT(
        'appearance', e.tasting_appearance,
        'nose', e.tasting_nose,
        'palate', e.tasting_palate,
        'finish', e.tasting_finish,
        'overall', e.tasting_overall
    ) AS tasting_notes,
    e.aroma_descriptors,
    e.flavor_descriptors,
    e.food_pairings,
    e.characteristics,
    e.aging_potential,
    e.drink_from_year,
    e.drink_by_year,
    e.serving_suggestions,
    e.enrichment_status AS "_augmentation_status",
    e.enriched_at AS "_augmentation_timestamp"
FROM wines w
LEFT JOIN wine_enrichments e ON w.ct_wine_id = e.wine_id;

CREATE OR REPLACE VIEW v_wines_pending_enrichment AS
SELECT w.*
FROM wines w
LEFT JOIN wine_enrichments e ON w.ct_wine_id = e.wine_id
WHERE e.wine_id IS NULL
   OR e.enrichment_status = 'pending'
   OR e.enrichment_status = 'failed';

CREATE OR REPLACE VIEW v_wines_with_high_scores AS
SELECT
    w.ct_wine_id,
    w.wine_name,
    w.vintage,
    w.producer,
    w.ct_score,
    w.critic_scores,
    (w.critic_scores->>'WA')::numeric AS wa_score,
    (w.critic_scores->>'WS')::numeric AS ws_score,
    (w.critic_scores->>'JS')::numeric AS js_score,
    (w.critic_scores->>'AG')::numeric AS ag_score
FROM wines w
WHERE w.ct_score >= 90
   OR (w.critic_scores->>'WA')::numeric >= 90
   OR (w.critic_scores->>'WS')::numeric >= 90;

CREATE OR REPLACE VIEW v_bottles_in_stock AS
SELECT * FROM bottles WHERE bottle_state = 1;

CREATE OR REPLACE VIEW v_bottles_consumed AS
SELECT * FROM bottles WHERE bottle_state = 0;

CREATE OR REPLACE VIEW v_collection_stats AS
SELECT
    COUNT(*) AS total_wines,
    SUM(quantity) AS total_bottles,
    SUM(valuation * quantity) AS total_value,
    COUNT(DISTINCT country) AS countries,
    COUNT(DISTINCT producer) AS producers,
    COUNT(DISTINCT varietal) AS varietals
FROM wines
WHERE quantity > 0;

CREATE OR REPLACE VIEW v_bottles_needing_review AS
SELECT
    b.*,
    w.wine_name,
    w.vintage,
    w.producer,
    CASE
        WHEN b.location = 'none' THEN 'Invalid location'
        WHEN b.location IS NULL OR b.location = '' THEN 'Missing location'
        ELSE 'Unknown issue'
    END AS issue_type
FROM bottles b
JOIN wines w ON b.wine_id = w.ct_wine_id
WHERE b.bottle_state = 1
  AND (b.location = 'none' OR b.location IS NULL OR b.location = '');


-- ===========================================
-- Row Level Security Policies
-- ===========================================

ALTER TABLE wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE wine_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- wines: Public read, service write
CREATE POLICY "wines_public_read" ON wines
    FOR SELECT USING (true);

CREATE POLICY "wines_service_write" ON wines
    FOR ALL USING (auth.role() = 'service_role');

-- wine_enrichments: Public read, service write
CREATE POLICY "enrichments_public_read" ON wine_enrichments
    FOR SELECT USING (true);

CREATE POLICY "enrichments_service_write" ON wine_enrichments
    FOR ALL USING (auth.role() = 'service_role');

-- bottles: Public read, service write
CREATE POLICY "bottles_public_read" ON bottles
    FOR SELECT USING (true);

CREATE POLICY "bottles_service_write" ON bottles
    FOR ALL USING (auth.role() = 'service_role');

-- pull_list_items: Public read/write (single user mode)
CREATE POLICY "pull_list_public_select" ON pull_list_items
    FOR SELECT USING (true);

CREATE POLICY "pull_list_public_insert" ON pull_list_items
    FOR INSERT WITH CHECK (true);

CREATE POLICY "pull_list_public_update" ON pull_list_items
    FOR UPDATE USING (true);

CREATE POLICY "pull_list_public_delete" ON pull_list_items
    FOR DELETE USING (true);

-- app_settings: Public read, authenticated write
CREATE POLICY "settings_public_read" ON app_settings
    FOR SELECT USING (true);

CREATE POLICY "settings_authenticated_write" ON app_settings
    FOR ALL USING (auth.role() = 'authenticated');
