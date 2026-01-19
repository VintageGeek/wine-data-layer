-- Migration 001: Create wines table
-- CellarTracker source data (Table=List)
-- Run this first before other migrations

CREATE TABLE IF NOT EXISTS wines (
    -- ===========================================
    -- PRIMARY KEY
    -- ===========================================
    ct_wine_id TEXT PRIMARY KEY,

    -- ===========================================
    -- CORE WINE IDENTITY
    -- ===========================================
    wine_name TEXT NOT NULL,
    vintage TEXT,
    producer TEXT,
    sort_producer TEXT,
    varietal TEXT,
    master_varietal TEXT,
    designation TEXT,
    vineyard TEXT,

    -- ===========================================
    -- GEOGRAPHIC INFORMATION
    -- ===========================================
    country TEXT,
    region TEXT,
    sub_region TEXT,
    appellation TEXT,
    locale TEXT,

    -- ===========================================
    -- WINE CLASSIFICATION
    -- ===========================================
    type TEXT,
    color TEXT,
    category TEXT,

    -- ===========================================
    -- INVENTORY & CELLAR DETAILS
    -- ===========================================
    quantity INTEGER DEFAULT 0,
    bottle_size TEXT DEFAULT '750ml',
    location TEXT,
    bin TEXT,
    barcode TEXT,

    -- ===========================================
    -- PURCHASE & VALUATION
    -- ===========================================
    price DECIMAL(10,2),
    valuation DECIMAL(10,2),
    currency TEXT DEFAULT 'USD',
    exchange_rate DECIMAL(10,6),
    native_price DECIMAL(10,2),
    native_price_currency TEXT,
    store_name TEXT,
    purchase_date DATE,

    -- ===========================================
    -- DRINK WINDOW
    -- ===========================================
    drink_date_min TEXT,
    drink_date_max TEXT,

    -- ===========================================
    -- USER NOTES
    -- ===========================================
    personal_note TEXT,
    my_score TEXT,

    -- ===========================================
    -- CELLARTRACKER COMMUNITY DATA
    -- ===========================================
    ct_score DECIMAL(4,1),
    ct_notes_count INTEGER,
    personal_notes_count INTEGER,

    -- ===========================================
    -- CRITIC SCORES (JSONB)
    -- ===========================================
    critic_scores JSONB DEFAULT '{}',

    -- ===========================================
    -- METADATA
    -- ===========================================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ
);

-- Indexes for common queries
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

-- GIN index for JSONB critic scores
CREATE INDEX IF NOT EXISTS idx_wines_critic_scores ON wines USING GIN (critic_scores);

-- Updated_at trigger
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
