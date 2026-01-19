"""Migrate enrichment data from wine_collection.json to Supabase."""

import json
import os
import time
from datetime import datetime
from dotenv import load_dotenv


def transform_wine_to_enrichment(wine: dict) -> dict:
    """Transform a wine dict from JSON to enrichment table format."""
    wine_id = wine.get("id")
    tasting = wine.get("tasting_notes", {}) or {}

    # Parse timestamp
    aug_ts = wine.get("_augmentation_timestamp")
    enriched_at = None
    if aug_ts:
        try:
            enriched_at = datetime.fromisoformat(aug_ts.replace("Z", "+00:00")).isoformat()
        except (ValueError, AttributeError):
            pass

    # Map status
    status = wine.get("_augmentation_status", "pending")

    return {
        "wine_id": wine_id,
        "tasting_appearance": tasting.get("appearance"),
        "tasting_nose": tasting.get("nose"),
        "tasting_palate": tasting.get("palate"),
        "tasting_finish": tasting.get("finish"),
        "tasting_overall": tasting.get("overall"),
        "aroma_descriptors": wine.get("aroma_descriptors", []),
        "flavor_descriptors": wine.get("flavor_descriptors", []),
        "food_pairings": wine.get("food_pairings"),
        "characteristics": wine.get("characteristics"),
        "aging_potential": wine.get("aging_potential"),
        "drink_from_year": wine.get("drink_from_year"),
        "drink_by_year": wine.get("drink_by_year"),
        "serving_suggestions": wine.get("serving_suggestions"),
        "enrichment_status": status,
        "enriched_at": enriched_at,
        "model_version": "gemini-1.5-pro",
    }


def filter_and_transform(wines: list, valid_ids: set) -> tuple[list, list]:
    """Filter wines by valid IDs and transform to enrichments.

    Returns: (enrichments, skipped_ids)
    """
    enrichments = []
    skipped = []

    for wine in wines:
        wine_id = wine.get("id")
        if wine_id not in valid_ids:
            skipped.append(wine_id)
            continue
        enrichments.append(transform_wine_to_enrichment(wine))

    return enrichments, skipped


def run_migration():
    """Main migration function - connects to Supabase and migrates data."""
    from supabase import create_client

    load_dotenv()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
        exit(1)

    supabase = create_client(url, key)

    # Load source data
    json_path = os.path.join(os.path.dirname(__file__), "..", "data", "backups", "wine_collection.json")

    print(f"Loading {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    wines = data.get("wines", [])
    print(f"Found {len(wines)} wines in JSON")

    # Get existing wine IDs from database (paginate to get all)
    print("Fetching existing wine IDs from database...")
    valid_ids = set()
    offset = 0
    page_size = 1000

    while True:
        result = supabase.table("wines").select("ct_wine_id").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        for row in result.data:
            valid_ids.add(row["ct_wine_id"])
        if len(result.data) < page_size:
            break
        offset += page_size

    print(f"Found {len(valid_ids)} wines in database")

    # Transform and filter
    enrichments, skipped = filter_and_transform(wines, valid_ids)

    print(f"\nPrepared {len(enrichments)} enrichments for upsert")
    if skipped:
        print(f"Skipped {len(skipped)} wines (not in database): {skipped[:5]}{'...' if len(skipped) > 5 else ''}")

    # Upsert in batches with retry
    batch_size = 100
    max_retries = 3
    total_upserted = 0

    for i in range(0, len(enrichments), batch_size):
        batch = enrichments[i:i + batch_size]
        for attempt in range(max_retries):
            try:
                supabase.table("wine_enrichments").upsert(batch).execute()
                total_upserted += len(batch)
                print(f"  Upserted batch {i // batch_size + 1}: {len(batch)} rows")
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"  Retry {attempt + 1} for batch {i // batch_size + 1}...")
                    time.sleep(2)
                else:
                    print(f"  ERROR on batch {i // batch_size + 1}: {e}")
                    exit(1)

    # Verify final count
    result = supabase.table("wine_enrichments").select("*", count="exact").limit(0).execute()
    final_count = result.count

    print(f"\n{'='*40}")
    print(f"Migration complete!")
    print(f"  Rows upserted: {total_upserted}")
    print(f"  Final table count: {final_count}")
    print(f"  Skipped (no match): {len(skipped)}")

    if final_count == len(enrichments):
        print(f"\n[OK] Expected {len(enrichments)}, got {final_count}")
    else:
        print(f"\n[WARN] Expected {len(enrichments)}, got {final_count}")


if __name__ == "__main__":
    run_migration()
