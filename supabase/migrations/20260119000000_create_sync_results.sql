-- Migration 007: Create sync_results table
-- Stores sync history and validation results

CREATE TABLE IF NOT EXISTS sync_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    synced_at TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL DEFAULT 'cellartracker',
    status TEXT NOT NULL, -- 'success', 'partial', 'failed'
    wines_synced INTEGER,
    bottles_synced INTEGER,
    validation JSONB, -- {checks: [{name, status, count, details}]}
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying latest sync
CREATE INDEX IF NOT EXISTS idx_sync_results_synced_at ON sync_results(synced_at DESC);

-- RLS policies
ALTER TABLE sync_results ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read sync results
CREATE POLICY "Authenticated read sync_results" ON sync_results
    FOR SELECT TO authenticated USING (true);

-- Only service role can write
CREATE POLICY "Service write sync_results" ON sync_results
    FOR ALL TO service_role USING (true);
