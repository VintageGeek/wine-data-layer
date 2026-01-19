-- Migration 002: Create wine_enrichments table
-- AI-generated content from Gemini
-- Depends on: 001_create_wines

CREATE TABLE IF NOT EXISTS wine_enrichments (
    -- Foreign Key to wines table
    wine_id TEXT PRIMARY KEY REFERENCES wines(ct_wine_id) ON DELETE CASCADE,

    -- Tasting Notes
    tasting_appearance TEXT,
    tasting_nose TEXT,
    tasting_palate TEXT,
    tasting_finish TEXT,
    tasting_overall TEXT,

    -- Descriptors (arrays)
    aroma_descriptors TEXT[],
    flavor_descriptors TEXT[],

    -- Food Pairings (JSONB array)
    -- Format: [{"dish": "...", "reason": "..."}]
    food_pairings JSONB,

    -- Characteristics (JSONB object)
    -- Format: {"body": "Medium", "sweetness": "Dry", ...}
    characteristics JSONB,

    -- Aging Information
    aging_potential TEXT,
    drink_from_year TEXT,
    drink_by_year TEXT,

    -- Serving Suggestions (JSONB object)
    serving_suggestions JSONB,

    -- Enrichment Metadata
    enrichment_status TEXT DEFAULT 'pending',
    enriched_at TIMESTAMPTZ,
    model_version TEXT,
    model_prompt_version TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding un-enriched wines
CREATE INDEX IF NOT EXISTS idx_enrichments_status ON wine_enrichments(enrichment_status);

-- Updated_at trigger
CREATE TRIGGER update_enrichments_updated_at
    BEFORE UPDATE ON wine_enrichments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
