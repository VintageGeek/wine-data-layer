# Wine Data Layer - Data Model Requirements

## Overview

This document defines the Supabase database schema for the wine collection system. The design separates CellarTracker source data from AI-enriched content to enable independent update cycles.

---

## Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                       │
│  ┌──────────────────────┐         ┌──────────────────────────────────────┐           │
│  │       wines          │         │        wine_enrichments              │           │
│  ├──────────────────────┤         ├──────────────────────────────────────┤           │
│  │ ct_wine_id (PK)      │◄───────►│ wine_id (FK)                         │           │
│  │ wine_name            │    1:1  │ tasting_appearance                   │           │
│  │ vintage              │         │ tasting_nose                         │           │
│  │ producer             │         │ tasting_palate                       │           │
│  │ varietal             │         │ tasting_finish                       │           │
│  │ master_varietal      │         │ tasting_overall                      │           │
│  │ region, country      │         │ aroma_descriptors[]                  │           │
│  │ critic_scores (JSONB)│         │ flavor_descriptors[]                 │           │
│  │ ct_score, ct_notes   │         │ food_pairings (JSONB)                │           │
│  │ quantity (aggregate) │         │ characteristics (JSONB)              │           │
│  │ ...                  │         │ aging_potential                      │           │
│  │ updated_at           │         │ serving_suggestions (JSONB)          │           │
│  └──────────┬───────────┘         │ enriched_at                          │           │
│             │                     │ model_version                        │           │
│             │                     └──────────────────────────────────────┘           │
│             │                                                                         │
│             │ 1:N (optional)                                                          │
│             │                                                                         │
│  ┌──────────▼───────────┐         ┌──────────────────────────────────────┐           │
│  │      bottles         │         │        app_settings                  │           │
│  ├──────────────────────┤         ├──────────────────────────────────────┤           │
│  │ ct_bottle_id (PK)    │         │ key (PK)                             │           │
│  │ wine_id (FK)         │         │ value (JSONB)                        │           │
│  │ bottle_state         │         │ updated_at                           │           │
│  │ (1=in, 0=consumed)   │         └──────────────────────────────────────┘           │
│  │ barcode, location    │                                                             │
│  │ consumed_date        │                                                             │
│  └──────────────────────┘                                                             │
│                                                                                       │
│  ┌──────────────────────┐                                                             │
│  │   pull_list_items    │  Note: bottles table is OPTIONAL                           │
│  ├──────────────────────┤  Use only if you need bottle-level history.                │
│  │ id (PK)              │  Otherwise, wines.quantity tracks counts.                  │
│  │ wine_id (FK → wines) │                                                             │
│  │ quantity             │  Data Sources:                                              │
│  │ added_at             │  - wines: CellarTracker Table=List                         │
│  │ user_id (optional)   │  - bottles: CellarTracker Table=Bottles                    │
│  └──────────────────────┘  - enrichments: Gemini AI                                  │
│                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Source Mapping

| Table | CellarTracker API | Notes |
|-------|-------------------|-------|
| `wines` | `Table=List&InStock=0` | Wine-level aggregates, all history |
| `bottles` | `Table=Bottles&InStock=0` | Individual bottle tracking |
| `wine_enrichments` | N/A (Gemini AI) | AI-generated content |
| `pull_list_items` | N/A (app state) | User selection state |
| `app_settings` | N/A (app state) | Application configuration |

---

## Table Definitions

### 1. `wines` (CellarTracker Source Data)

Primary table containing wine inventory data synced from CellarTracker. Includes ALL 67 fields from CellarTracker export.

```sql
CREATE TABLE wines (
    -- ===========================================
    -- PRIMARY KEY
    -- ===========================================
    ct_wine_id TEXT PRIMARY KEY,  -- CellarTracker iWine ID

    -- ===========================================
    -- CORE WINE IDENTITY
    -- ===========================================
    wine_name TEXT NOT NULL,      -- "Wine" column
    vintage TEXT,                 -- "2021", "NV", or "1001" for non-vintage
    producer TEXT,
    sort_producer TEXT,           -- Sortable producer name (e.g., "Drouhin, Joseph")
    varietal TEXT,
    master_varietal TEXT,         -- Parent varietal category
    designation TEXT,
    vineyard TEXT,

    -- ===========================================
    -- GEOGRAPHIC INFORMATION
    -- ===========================================
    country TEXT,
    region TEXT,
    sub_region TEXT,
    appellation TEXT,
    locale TEXT,                  -- Full path: "France, Burgundy, Côte de Nuits"

    -- ===========================================
    -- WINE CLASSIFICATION
    -- ===========================================
    type TEXT,                    -- "Red", "White", "Rosé", "Sparkling", "Dessert"
    color TEXT,
    category TEXT,                -- "Dry", "Sweet", etc.

    -- ===========================================
    -- INVENTORY & CELLAR DETAILS
    -- ===========================================
    quantity INTEGER DEFAULT 0,
    bottle_size TEXT DEFAULT '750ml',  -- "Size" column
    location TEXT,                -- Cellar location code
    bin TEXT,                     -- Bin/shelf location
    barcode TEXT,                 -- Bottle barcode

    -- ===========================================
    -- PURCHASE & VALUATION
    -- ===========================================
    price DECIMAL(10,2),          -- Purchase price in account currency
    valuation DECIMAL(10,2),      -- Current market valuation
    currency TEXT DEFAULT 'USD',  -- Account currency
    exchange_rate DECIMAL(10,6),  -- Exchange rate at time of sync
    native_price DECIMAL(10,2),   -- Original purchase price
    native_price_currency TEXT,   -- Original purchase currency
    store_name TEXT,              -- Where purchased
    purchase_date DATE,

    -- ===========================================
    -- DRINK WINDOW (from CellarTracker)
    -- ===========================================
    drink_date_min TEXT,          -- "Begin" - Year as text
    drink_date_max TEXT,          -- "End" - Year as text

    -- ===========================================
    -- USER NOTES
    -- ===========================================
    personal_note TEXT,           -- "Note" - User's personal notes on this bottle
    my_score TEXT,                -- "MY" - User's personal score

    -- ===========================================
    -- CELLARTRACKER COMMUNITY DATA
    -- ===========================================
    ct_score DECIMAL(4,1),        -- "CT" - CellarTracker community score
    ct_notes_count INTEGER,       -- "CNotes" - Number of community tasting notes
    personal_notes_count INTEGER, -- "PNotes" - Number of personal notes

    -- ===========================================
    -- CRITIC SCORES (JSONB for flexibility)
    -- ===========================================
    -- Stores all professional critic scores in one column
    -- Format: {"WA": "95", "WS": "93", "JR": "17.5", ...}
    critic_scores JSONB DEFAULT '{}',

    -- ===========================================
    -- METADATA
    -- ===========================================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ      -- Last CellarTracker sync time
);

-- Indexes for common queries
CREATE INDEX idx_wines_country ON wines(country);
CREATE INDEX idx_wines_region ON wines(region);
CREATE INDEX idx_wines_producer ON wines(producer);
CREATE INDEX idx_wines_varietal ON wines(varietal);
CREATE INDEX idx_wines_master_varietal ON wines(master_varietal);
CREATE INDEX idx_wines_vintage ON wines(vintage);
CREATE INDEX idx_wines_type ON wines(type);
CREATE INDEX idx_wines_location ON wines(location);
CREATE INDEX idx_wines_ct_score ON wines(ct_score);
CREATE INDEX idx_wines_barcode ON wines(barcode);

-- GIN index for searching within critic_scores JSONB
CREATE INDEX idx_wines_critic_scores ON wines USING GIN (critic_scores);
```

#### Critic Scores Reference

The `critic_scores` JSONB column stores scores from 31 professional critics/publications:

| Code | Critic/Publication |
|------|-------------------|
| WA | Wine Advocate (Robert Parker) |
| WS | Wine Spectator |
| IWC | International Wine Cellar (Stephen Tanzer) |
| BH | Burghound (Allen Meadows) |
| AG | Antonio Galloni (Vinous) |
| WE | Wine Enthusiast |
| JR | Jancis Robinson |
| RH | Richard Hemming |
| JG | Jeff Garneau |
| GV | Gambero Rosso / Veronelli |
| JK | James Kirkpatrick |
| LD | Larry Davis |
| CW | Connoisseurs' Guide |
| WFW | Wine & Food Week |
| PR | PinotReport |
| SJ | Stuart Jacobson |
| WD | Wine Doctor |
| RR | Roberto Rogness |
| JH | James Halliday |
| MFW | My Fine Wines |
| WWR | World Wine Review |
| IWR | Italian Wine Review |
| CHG | Chianti Gang |
| TT | Tannic Trio |
| TWF | The Wine Front |
| DR | Decanter |
| FP | Falstaff Points |
| JM | Jean-Marc |
| PG | Paul Gregutt |
| WAL | Wine Align |
| JS | James Suckling |

### 2. `wine_enrichments` (AI-Generated Content)

Stores AI-enriched content for each wine, separate from source data.

```sql
CREATE TABLE wine_enrichments (
    -- Foreign Key to wines table
    wine_id TEXT PRIMARY KEY REFERENCES wines(ct_wine_id) ON DELETE CASCADE,

    -- Tasting Notes (expanded from nested object)
    tasting_appearance TEXT,
    tasting_nose TEXT,
    tasting_palate TEXT,
    tasting_finish TEXT,
    tasting_overall TEXT,

    -- Descriptors (arrays)
    aroma_descriptors TEXT[],
    flavor_descriptors TEXT[],

    -- Food Pairings (array of objects)
    -- Format: [{"dish": "...", "reason": "..."}]
    food_pairings JSONB,

    -- Characteristics (object)
    -- Format: {"body": "Medium", "sweetness": "Dry", ...}
    characteristics JSONB,

    -- Aging Information
    aging_potential TEXT,
    drink_from_year TEXT,
    drink_by_year TEXT,

    -- Serving Suggestions (object)
    -- Format: {"temperature": "...", "decanting": "...", "glassware": "..."}
    serving_suggestions JSONB,

    -- Enrichment Metadata
    enrichment_status TEXT DEFAULT 'pending',  -- pending, completed, failed
    enriched_at TIMESTAMPTZ,
    model_version TEXT,  -- e.g., "gemini-1.5-pro"
    model_prompt_version TEXT,  -- Track prompt iterations

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding un-enriched wines
CREATE INDEX idx_enrichments_status ON wine_enrichments(enrichment_status);
```

### 3. `bottles` (Bottle-Level Inventory)

Tracks individual bottles for granular history. Use `Table=Bottles` from CellarTracker API.

> **Note:** This table is optional. If you only need wine-level aggregates, use `Table=List`
> from CellarTracker and skip this table. The `wines.quantity` field tracks bottle count.

```sql
CREATE TABLE bottles (
    -- ===========================================
    -- PRIMARY KEY
    -- ===========================================
    ct_bottle_id TEXT PRIMARY KEY,  -- CellarTracker Bottle ID (from Barcode or BottleID)

    -- ===========================================
    -- WINE REFERENCE
    -- ===========================================
    wine_id TEXT NOT NULL REFERENCES wines(ct_wine_id) ON DELETE CASCADE,

    -- ===========================================
    -- BOTTLE STATUS (Critical for history)
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

    -- Purchase info (may differ per bottle)
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
CREATE INDEX idx_bottles_wine ON bottles(wine_id);
CREATE INDEX idx_bottles_state ON bottles(bottle_state);
CREATE INDEX idx_bottles_location ON bottles(location);
CREATE INDEX idx_bottles_barcode ON bottles(barcode);

-- View for in-stock bottles only
CREATE OR REPLACE VIEW v_bottles_in_stock AS
SELECT * FROM bottles WHERE bottle_state = 1;

-- View for consumed bottles (history)
CREATE OR REPLACE VIEW v_bottles_consumed AS
SELECT * FROM bottles WHERE bottle_state = 0;
```

#### When to Use Bottles Table

| Use Case | Table | CT API Parameter |
|----------|-------|------------------|
| Current inventory counts | `wines` | `Table=List` |
| Individual bottle tracking | `bottles` | `Table=Bottles` |
| Consumption history | `bottles` | `Table=Bottles&InStock=0` |
| Pull list | `wines` | N/A (app state) |

### 4. `pull_list_items` (User State)

Tracks wines marked for pulling from the cellar.

```sql
CREATE TABLE pull_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Wine reference
    wine_id TEXT NOT NULL REFERENCES wines(ct_wine_id) ON DELETE CASCADE,

    -- Quantity to pull (may be less than total quantity)
    quantity INTEGER DEFAULT 1,

    -- Optional: Multi-user support for future
    user_id UUID,  -- NULL = shared pull list

    -- Notes about why pulling this wine
    notes TEXT,

    -- Timestamps
    added_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure same wine isn't added twice (per user)
    UNIQUE(wine_id, user_id)
);

CREATE INDEX idx_pull_list_wine ON pull_list_items(wine_id);
CREATE INDEX idx_pull_list_user ON pull_list_items(user_id);
```

### 4. `app_settings` (Application Configuration)

Key-value store for application settings.

```sql
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial settings
INSERT INTO app_settings (key, value) VALUES
    ('demoMode', 'false'),
    ('lastPullListUpdate', '"2026-01-18T00:00:00Z"');
```

---

## Views

### `v_wines_full` (Joined Wine + Enrichment Data)

Provides the same structure as the current `wine_collection.json` for backward compatibility.

```sql
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

    -- Nested tasting_notes object (reconstructed)
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
```

### `v_wines_pending_enrichment`

Helper view to find wines that need enrichment.

```sql
CREATE OR REPLACE VIEW v_wines_pending_enrichment AS
SELECT w.*
FROM wines w
LEFT JOIN wine_enrichments e ON w.ct_wine_id = e.wine_id
WHERE e.wine_id IS NULL
   OR e.enrichment_status = 'pending'
   OR e.enrichment_status = 'failed';
```

### `v_wines_with_high_scores`

Find wines with notable critic scores.

```sql
CREATE OR REPLACE VIEW v_wines_with_high_scores AS
SELECT
    w.ct_wine_id,
    w.wine_name,
    w.vintage,
    w.producer,
    w.ct_score,
    w.critic_scores,
    -- Extract individual scores for filtering
    (w.critic_scores->>'WA')::numeric AS wa_score,
    (w.critic_scores->>'WS')::numeric AS ws_score,
    (w.critic_scores->>'JS')::numeric AS js_score,
    (w.critic_scores->>'AG')::numeric AS ag_score
FROM wines w
WHERE w.ct_score >= 90
   OR (w.critic_scores->>'WA')::numeric >= 90
   OR (w.critic_scores->>'WS')::numeric >= 90;
```

---

## Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE wine_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Public read access for wines and enrichments
CREATE POLICY "Public read access" ON wines FOR SELECT USING (true);
CREATE POLICY "Public read access" ON wine_enrichments FOR SELECT USING (true);

-- Pull list: public read/write (single user mode)
CREATE POLICY "Public read access" ON pull_list_items FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON pull_list_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access" ON pull_list_items FOR UPDATE USING (true);
CREATE POLICY "Public delete access" ON pull_list_items FOR DELETE USING (true);

-- Settings: public read, authenticated write
CREATE POLICY "Public read access" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated write" ON app_settings FOR ALL USING (auth.role() = 'authenticated');
```

---

## Data Migration Mapping

### From CellarTracker HTML Export to `wines` table:

| CellarTracker Column | Database Column | Notes |
|---------------------|-----------------|-------|
| `iWine` | `ct_wine_id` | Primary key |
| `Wine` | `wine_name` | |
| `Vintage` | `vintage` | |
| `Producer` | `producer` | |
| `SortProducer` | `sort_producer` | For alphabetical sorting |
| `Varietal` | `varietal` | |
| `MasterVarietal` | `master_varietal` | Parent category |
| `Designation` | `designation` | |
| `Vineyard` | `vineyard` | |
| `Country` | `country` | |
| `Region` | `region` | |
| `SubRegion` | `sub_region` | |
| `Appellation` | `appellation` | |
| `Locale` | `locale` | Full geographic path |
| `Type` | `type` | Red, White, etc. |
| `Color` | `color` | |
| `Category` | `category` | Dry, Sweet, etc. |
| `Size` | `bottle_size` | |
| `Location` | `location` | |
| `Bin` | `bin` | |
| `Barcode` | `barcode` | |
| `Price` | `price` | |
| `Valuation` | `valuation` | |
| `Currency` | `currency` | |
| `ExchangeRate` | `exchange_rate` | |
| `NativePrice` | `native_price` | |
| `NativePriceCurrency` | `native_price_currency` | |
| `StoreName` | `store_name` | |
| `PurchaseDate` | `purchase_date` | |
| `Begin` | `drink_date_min` | |
| `End` | `drink_date_max` | |
| `Note` | `personal_note` | |
| `MY` | `my_score` | User's personal score |
| `CT` | `ct_score` | Community score |
| `CNotes` | `ct_notes_count` | |
| `PNotes` | `personal_notes_count` | |
| `WA,WS,IWC,BH,...` | `critic_scores` | All 31 scores as JSONB |

### Critic Scores Transformation

```python
# Example: Convert individual score columns to JSONB
critic_columns = ['WA', 'WS', 'IWC', 'BH', 'AG', 'WE', 'JR', 'RH', 'JG', 'GV',
                  'JK', 'LD', 'CW', 'WFW', 'PR', 'SJ', 'WD', 'RR', 'JH', 'MFW',
                  'WWR', 'IWR', 'CHG', 'TT', 'TWF', 'DR', 'FP', 'JM', 'PG', 'WAL', 'JS']

def build_critic_scores(row):
    scores = {}
    for col in critic_columns:
        if row.get(col) and row[col].strip():
            scores[col] = row[col].strip()
    return json.dumps(scores)
```

### From `wine_collection.json` to `wine_enrichments` table:

| JSON Field | Database Column |
|------------|-----------------|
| `id` | `wine_id` |
| `tasting_notes.appearance` | `tasting_appearance` |
| `tasting_notes.nose` | `tasting_nose` |
| `tasting_notes.palate` | `tasting_palate` |
| `tasting_notes.finish` | `tasting_finish` |
| `tasting_notes.overall` | `tasting_overall` |
| `aroma_descriptors` | `aroma_descriptors` |
| `flavor_descriptors` | `flavor_descriptors` |
| `food_pairings` | `food_pairings` |
| `characteristics` | `characteristics` |
| `aging_potential` | `aging_potential` |
| `drink_from_year` | `drink_from_year` |
| `drink_by_year` | `drink_by_year` |
| `serving_suggestions` | `serving_suggestions` |
| `_augmentation_status` | `enrichment_status` |
| `_augmentation_timestamp` | `enriched_at` |

---

## Constraints & Validation

### wines table:
- `quantity >= 0`
- `vintage` should be 4-digit year, "NV", or empty
- `type` should be one of: Red, White, Rosé, Sparkling, Dessert, Fortified
- `ct_score` should be between 0 and 100

### wine_enrichments table:
- `enrichment_status` should be one of: pending, completed, failed
- `characteristics.body` should be: Light, Medium-Light, Medium, Medium-Full, Full
- `characteristics.sweetness` should be: Dry, Off-Dry, Medium-Sweet, Sweet

---

## Example Queries

### Get wines with high Robert Parker scores:
```sql
SELECT wine_name, vintage, producer, critic_scores->>'WA' as parker_score
FROM wines
WHERE (critic_scores->>'WA')::numeric >= 95
ORDER BY (critic_scores->>'WA')::numeric DESC;
```

### Get wines with any score above 95:
```sql
SELECT wine_name, vintage, critic_scores
FROM wines
WHERE EXISTS (
    SELECT 1 FROM jsonb_each_text(critic_scores)
    WHERE value ~ '^\d+\.?\d*$' AND value::numeric >= 95
);
```

### Compare CellarTracker community score to critic scores:
```sql
SELECT
    wine_name,
    ct_score,
    critic_scores->>'WA' as parker,
    critic_scores->>'WS' as spectator,
    critic_scores->>'JS' as suckling
FROM wines
WHERE ct_score IS NOT NULL
ORDER BY ct_score DESC;
```

---

## Future Considerations

1. **Consumption History**: Track when wines are consumed with `wine_consumption` table.

2. **Location Management**: Expand `location` and `bin` into proper `cellar_locations` table for visual cellar mapping.

3. **User Management**: Add proper `users` table and link `pull_list_items` to users for multi-user support.

4. **Score Normalization**: Create a view that normalizes all critic scores to 100-point scale (Jancis Robinson uses 20-point, for example).
