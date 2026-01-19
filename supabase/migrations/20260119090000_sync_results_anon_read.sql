-- Allow anonymous users to read sync_results
-- This enables the settings.html page to display sync status without Supabase auth

-- Drop existing policy if it exists (to make idempotent)
DROP POLICY IF EXISTS "sync_results_anon_read" ON sync_results;

-- Create policy allowing anon to read sync_results
CREATE POLICY "sync_results_anon_read" ON sync_results
    FOR SELECT TO anon USING (true);
