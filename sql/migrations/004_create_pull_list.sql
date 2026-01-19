-- Migration 004: Create pull_list_items table
-- User state for wines marked for pulling
-- Depends on: 001_create_wines

CREATE TABLE IF NOT EXISTS pull_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Wine reference
    wine_id TEXT NOT NULL REFERENCES wines(ct_wine_id) ON DELETE CASCADE,

    -- Quantity to pull
    quantity INTEGER DEFAULT 1,

    -- Optional: Multi-user support
    user_id UUID,

    -- Notes
    notes TEXT,

    -- Timestamps
    added_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure same wine isn't added twice per user
    UNIQUE(wine_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pull_list_wine ON pull_list_items(wine_id);
CREATE INDEX IF NOT EXISTS idx_pull_list_user ON pull_list_items(user_id);
