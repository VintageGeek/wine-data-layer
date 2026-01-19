-- Seed: Initial application settings
-- Run after migrations

INSERT INTO app_settings (key, value) VALUES
    ('demoMode', 'false'),
    ('lastPullListUpdate', '"2026-01-18T00:00:00Z"'),
    ('lastCellarTrackerSync', 'null'),
    ('lastEnrichmentRun', 'null')
ON CONFLICT (key) DO NOTHING;
