-- Migration 006: Create database views
-- Depends on: 001, 002, 003

-- ===========================================
-- v_wines_full: Joined wine + enrichment data
-- ===========================================
CREATE OR REPLACE VIEW v_wines_full AS
SELECT
    -- Core identity
    w.ct_wine_id AS id,
    w.wine_name,
    w.vintage,
    w.producer,
    w.sort_producer,
    w.varietal,
    w.master_varietal,
    w.designation,
    w.vineyard,

    -- Geographic
    w.region,
    w.country,
    w.appellation,
    w.locale,
    w.sub_region,

    -- Classification
    w.type,
    w.color,
    w.category,

    -- Inventory
    w.bottle_size,
    w.quantity,
    w.location,
    w.bin,
    w.barcode,

    -- Valuation
    w.price,
    w.valuation,
    w.currency,
    w.exchange_rate,
    w.native_price,
    w.native_price_currency,
    w.store_name,
    w.purchase_date,

    -- Drink window
    w.drink_date_min,
    w.drink_date_max,

    -- Notes
    w.personal_note,
    w.my_score,

    -- Community data
    w.ct_score,
    w.ct_notes_count,
    w.personal_notes_count,

    -- Critic scores
    w.critic_scores,

    -- Enrichment: tasting_notes object
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


-- ===========================================
-- v_wines_pending_enrichment: In-stock wines needing AI enrichment
-- ===========================================
CREATE OR REPLACE VIEW v_wines_pending_enrichment AS
SELECT w.*
FROM wines w
LEFT JOIN wine_enrichments e ON w.ct_wine_id = e.wine_id
WHERE w.quantity > 0
  AND (e.wine_id IS NULL
       OR e.enrichment_status = 'pending'
       OR e.enrichment_status = 'failed');


-- ===========================================
-- v_wines_with_high_scores: Notable critic scores
-- ===========================================
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


-- ===========================================
-- v_bottles_in_stock: Current inventory (if using bottles table)
-- ===========================================
CREATE OR REPLACE VIEW v_bottles_in_stock AS
SELECT * FROM bottles WHERE bottle_state = 1;


-- ===========================================
-- v_bottles_consumed: Consumption history (if using bottles table)
-- ===========================================
CREATE OR REPLACE VIEW v_bottles_consumed AS
SELECT * FROM bottles WHERE bottle_state = 0;


-- ===========================================
-- v_collection_stats: Dashboard statistics
-- ===========================================
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


-- ===========================================
-- v_bottles_needing_review: Data anomalies requiring attention
-- ===========================================
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
