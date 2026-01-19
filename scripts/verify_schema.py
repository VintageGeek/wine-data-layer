"""Verify Supabase schema was created correctly."""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
    exit(1)

supabase = create_client(url, key)

print("Testing Supabase connection...")
print(f"URL: {url}\n")

# Test each table
tables = ["wines", "wine_enrichments", "bottles", "pull_list_items", "app_settings"]

print("Tables:")
for table in tables:
    try:
        result = supabase.table(table).select("*", count="exact").limit(0).execute()
        print(f"  [OK] {table} (count: {result.count})")
    except Exception as e:
        print(f"  [FAIL] {table} - ERROR: {e}")

# Test views
views = ["v_wines_full", "v_wines_pending_enrichment", "v_collection_stats"]

print("\nViews:")
for view in views:
    try:
        result = supabase.table(view).select("*").limit(1).execute()
        print(f"  [OK] {view}")
    except Exception as e:
        print(f"  [FAIL] {view} - ERROR: {e}")

print("\n[OK] Schema verification complete!")
