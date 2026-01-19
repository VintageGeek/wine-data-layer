-- Row Level Security Policies
-- Run after creating all tables

-- ===========================================
-- Enable RLS on all tables
-- ===========================================
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;
ALTER TABLE wine_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;


-- ===========================================
-- wines: Public read, service write
-- ===========================================
CREATE POLICY "wines_public_read" ON wines
    FOR SELECT USING (true);

CREATE POLICY "wines_service_write" ON wines
    FOR ALL USING (auth.role() = 'service_role');


-- ===========================================
-- wine_enrichments: Public read, service write
-- ===========================================
CREATE POLICY "enrichments_public_read" ON wine_enrichments
    FOR SELECT USING (true);

CREATE POLICY "enrichments_service_write" ON wine_enrichments
    FOR ALL USING (auth.role() = 'service_role');


-- ===========================================
-- bottles: Public read, service write
-- ===========================================
CREATE POLICY "bottles_public_read" ON bottles
    FOR SELECT USING (true);

CREATE POLICY "bottles_service_write" ON bottles
    FOR ALL USING (auth.role() = 'service_role');


-- ===========================================
-- pull_list_items: Public read/write (single user mode)
-- ===========================================
CREATE POLICY "pull_list_public_select" ON pull_list_items
    FOR SELECT USING (true);

CREATE POLICY "pull_list_public_insert" ON pull_list_items
    FOR INSERT WITH CHECK (true);

CREATE POLICY "pull_list_public_update" ON pull_list_items
    FOR UPDATE USING (true);

CREATE POLICY "pull_list_public_delete" ON pull_list_items
    FOR DELETE USING (true);


-- ===========================================
-- app_settings: Public read, authenticated write
-- ===========================================
CREATE POLICY "settings_public_read" ON app_settings
    FOR SELECT USING (true);

CREATE POLICY "settings_authenticated_write" ON app_settings
    FOR ALL USING (auth.role() = 'authenticated');

-- Alternative: Allow anon key to write settings (less secure)
-- Uncomment if you need to toggle demo mode without auth
-- CREATE POLICY "settings_anon_write" ON app_settings
--     FOR ALL USING (true);
