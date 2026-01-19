# Session History (Archived)

> Historical session logs from wine-data-layer development. For current status, see `PROGRESS.md`.

---

## 2026-01-18 - Initial Setup (Session 1)
**Focus:** Documentation and planning

- Analyzed existing data structures (wine_collection.json, cellartracker_raw.html)
- Created documentation suite (DATA_MODEL.md, API_REQUIREMENTS.md, etc.)
- Set up folder structure, SQL migrations (001-006), RLS policies
- Added bottles table for bottle-level tracking

**Key Insights:** CT uses CSV API (xlquery.asp), InStock=0 for consumed bottles, BottleState 1=In-Stock/0=Consumed

---

## 2026-01-18 - Data Analysis (Session 2)
**Focus:** Live data pull, source comparison, gotcha analysis

- Pulled live CT data: 425 wines (List), 2,373 bottles (Bottles)
- Confirmed Table=Bottles as primary (has consumption history), Table=List for critic scores
- Identified gotchas: 804 consumed wines missing critic scores, latin-1 encoding, M/D/YYYY dates
- Created GOTCHAS.md, DATA_SOURCE_COMPARISON.md, DASHBOARD_INTEGRATION.md

**Stats:** 878 in stock, 1,495 consumed, 1,229 unique wines

---

## 2026-01-19 - Supabase Setup & CT Sync (Session 3)
**Focus:** Complete Phase 1, 2, 3

- Created Supabase project: https://jxidqettmqneswsuevoc.supabase.co
- Ran all migrations (5 tables, 7 views), configured RLS
- Built and deployed Edge Function: `sync-cellartracker`
- First sync: 1,229 wines, 2,373 bottles
- Set up GitHub repo: https://github.com/VintageGeek/wine-data-layer

---

## 2026-01-19 - Enrichment Migration & Sync Validation (Session 4)
**Focus:** Phase 3.5 enrichment migration, Phase 2.5 sync validation

- Migrated 425 enrichments from wine_collection.json to Supabase
- Created sync_results table for sync history + validation
- Added 6 validation checks to sync function
- Added admin UI to settings.html for sync status

---

## 2026-01-19 - Phase 2.5 Completion (Session 5)
**Focus:** Complete sync validation

- Fixed validation pagination bug (was only checking first 1000 rows)
- Fixed orphan_bottles false positive
- Added anon-read RLS policy for sync_results
- All 6 validation checks pass correctly

---

## 2026-01-19 - Supabase Auth (Session 6)
**Focus:** Replace hardcoded credentials with Supabase Auth

- Implemented Supabase Auth email/password login
- Added TOTP MFA enrollment/verification (later removed as overkill)
- User account: sendmewine@outlook.com

---

## 2026-01-19 - Phase 4 Complete (Session 7)
**Focus:** Complete Firebase → Supabase migration

- Created dedicated login.html
- Migrated index.html, mobile.html to Supabase (wine data, pull list, demo mode)
- Removed all Firebase dependencies
- Deployed to production
- Verified all 425 in-stock wines already enriched (0 pending)

**Data Sources:** v_wines_full (Supabase), pull_list_items table, app_settings table

---

## 2026-01-19 - Bin Capacity Validation (Session 8)
**Focus:** Column-specific bin capacity rules

- Added cellar storage rules config
- Updated sync validation: A,B,C,F,G,H=6, D,I=4, E,J=2 bottles
- Added bin warning indicators to dashboard
- Removed MFA (overkill for personal project)
- Simplified login to email/password only

---

## 2026-01-19 - Overcapacity & Bin Features (Session 9)
**Focus:** Bin location display, overcapacity filtering, pull list improvements

- Fixed sync function auth (added apikey header)
- Added clickable overcapacity banner to index.html and mobile.html
- Added Bin column to wine table (sortable)
- Fixed location/bin display from bottles table
- Pull list shows correct bin with natural sort (A9 < A10)
- Updated CLAUDE.md with deployment pitfalls
