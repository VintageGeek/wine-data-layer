-- RLS Policies: Authenticated Access Only
-- Run this to replace public read policies with authenticated-only access

-- ===========================================
-- Drop existing public read policies
-- ===========================================
DROP POLICY IF EXISTS "wines_public_read" ON wines;
DROP POLICY IF EXISTS "wines_service_write" ON wines;
DROP POLICY IF EXISTS "enrichments_public_read" ON wine_enrichments;
DROP POLICY IF EXISTS "enrichments_service_write" ON wine_enrichments;
DROP POLICY IF EXISTS "bottles_public_read" ON bottles;
DROP POLICY IF EXISTS "bottles_service_write" ON bottles;
DROP POLICY IF EXISTS "pull_list_public_select" ON pull_list_items;
DROP POLICY IF EXISTS "pull_list_public_insert" ON pull_list_items;
DROP POLICY IF EXISTS "pull_list_public_update" ON pull_list_items;
DROP POLICY IF EXISTS "pull_list_public_delete" ON pull_list_items;
DROP POLICY IF EXISTS "settings_public_read" ON app_settings;
DROP POLICY IF EXISTS "settings_authenticated_write" ON app_settings;

-- ===========================================
-- wines: Authenticated read, service write
-- ===========================================
CREATE POLICY "wines_authenticated_read" ON wines
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "wines_service_write" ON wines
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "wines_service_update" ON wines
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "wines_service_delete" ON wines
    FOR DELETE USING (auth.role() = 'service_role');

-- ===========================================
-- wine_enrichments: Authenticated read, service write
-- ===========================================
CREATE POLICY "enrichments_authenticated_read" ON wine_enrichments
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "enrichments_service_write" ON wine_enrichments
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "enrichments_service_update" ON wine_enrichments
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "enrichments_service_delete" ON wine_enrichments
    FOR DELETE USING (auth.role() = 'service_role');

-- ===========================================
-- bottles: Authenticated read, service write
-- ===========================================
CREATE POLICY "bottles_authenticated_read" ON bottles
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "bottles_service_write" ON bottles
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "bottles_service_update" ON bottles
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "bottles_service_delete" ON bottles
    FOR DELETE USING (auth.role() = 'service_role');

-- ===========================================
-- pull_list_items: Authenticated read/write
-- ===========================================
CREATE POLICY "pull_list_authenticated_select" ON pull_list_items
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "pull_list_authenticated_insert" ON pull_list_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "pull_list_authenticated_update" ON pull_list_items
    FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "pull_list_authenticated_delete" ON pull_list_items
    FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ===========================================
-- app_settings: Authenticated read/write
-- ===========================================
CREATE POLICY "settings_authenticated_read" ON app_settings
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "settings_authenticated_write" ON app_settings
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "settings_authenticated_update" ON app_settings
    FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "settings_authenticated_delete" ON app_settings
    FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
