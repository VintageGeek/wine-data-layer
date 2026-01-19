-- Migration 003: Create bottles table (OPTIONAL)
-- Bottle-level tracking from CellarTracker Table=Bottles
-- Only run this if you need individual bottle history
-- Depends on: 001_create_wines

CREATE TABLE IF NOT EXISTS bottles (
    -- ===========================================
    -- PRIMARY KEY
    -- ===========================================
    -- CellarTracker "Barcode" field is actually an internal bottle ID
    -- (10-digit numeric, auto-generated, unique per bottle)
    -- NOT a physical UPC barcode - safe to use as PK
    ct_bottle_id TEXT PRIMARY KEY,

    -- ===========================================
    -- WINE REFERENCE
    -- ===========================================
    wine_id TEXT NOT NULL REFERENCES wines(ct_wine_id) ON DELETE CASCADE,

    -- ===========================================
    -- BOTTLE STATUS
    -- ===========================================
    -- BottleState from CellarTracker: 1 = In-Stock, 0 = Consumed/Lost
    bottle_state INTEGER NOT NULL DEFAULT 1,
    status TEXT GENERATED ALWAYS AS (
        CASE bottle_state
            WHEN 1 THEN 'in_stock'
            WHEN 0 THEN 'consumed'
            ELSE 'unknown'
        END
    ) STORED,

    -- ===========================================
    -- BOTTLE-SPECIFIC DETAILS
    -- ===========================================
    barcode TEXT,
    location TEXT,
    bin TEXT,
    bottle_size TEXT DEFAULT '750ml',

    -- Purchase info
    price DECIMAL(10,2),
    store_name TEXT,
    purchase_date DATE,

    -- Consumption tracking
    consumed_date DATE,
    consumed_note TEXT,

    -- ===========================================
    -- METADATA
    -- ===========================================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bottles_wine ON bottles(wine_id);
CREATE INDEX IF NOT EXISTS idx_bottles_state ON bottles(bottle_state);
CREATE INDEX IF NOT EXISTS idx_bottles_location ON bottles(location);
CREATE INDEX IF NOT EXISTS idx_bottles_barcode ON bottles(barcode);

-- Updated_at trigger
CREATE TRIGGER update_bottles_updated_at
    BEFORE UPDATE ON bottles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
