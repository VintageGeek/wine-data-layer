# Wine Data Layer - Progress Tracker

> **Last Updated:** 2026-01-19 (Session 7)
> **Current Phase:** Phase 5 - Enrichment Pipeline
> **Overall Status:** 🟢 Phase 4 Complete, Phase 5 Not Started

---

## Quick Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 0: Planning & Documentation | 🟢 Complete | 100% |
| Phase 1: Supabase Setup & Schema | 🟢 Complete | 100% |
| Phase 2: CellarTracker Extraction | 🟢 Complete | 100% |
| Phase 2.5: Sync Validation & Testing | 🟢 Complete | 100% |
| Phase 3: Data Migration | 🟢 Complete | 100% |
| Phase 3.5: Enrichment Data Migration | 🟢 Complete | 100% |
| Phase 4: Dashboard Integration | 🟢 Complete | 100% |
| Phase 5: Enrichment Pipeline | ⚪ Not Started | 0% |

---

## Plan Documentation Standard

Each phase includes a **Plan** section (created before implementation) with:
- **Problem Statement**: What and why
- **Tasks**: Checkbox list
- **Field/Data Mapping**: If applicable
- **Edge Cases**: Known gotchas
- **Success Criteria**: How to verify done
- **Unresolved Questions**: Blockers needing answers

Plans stay in this file alongside status. Review plan before approving implementation.

---

## Phase 0: Planning & Documentation ✅

### Completed Tasks
- [x] Analyze existing wine_collection.json structure
- [x] Analyze CellarTracker raw HTML export format
- [x] Create MIGRATION_PLAN.md with phased approach
- [x] Create DATA_MODEL.md with complete schema (all 67 CT fields)
- [x] Create API_REQUIREMENTS.md with Supabase integration patterns
- [x] Review CellarTracker_Data_Ingestion_Plan.md
- [x] Set up CLAUDE.md with engineering guidelines
- [x] Create proper folder structure
- [x] Create PROGRESS.md tracker
- [x] Add bottles table for bottle-level tracking
- [x] Create SQL migrations (001-006)
- [x] Create RLS policies
- [x] Create field_mappings.json config
- [x] Create .env.example and .gitignore
- [x] Pull live data from CellarTracker xlquery.asp API
- [x] Compare data sources (HTML vs CSV List vs CSV Bottles)
- [x] Document data source recommendation (Table=Bottles primary)
- [x] Analyze gotchas and edge cases
- [x] Create GOTCHAS.md documentation

### Key Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | Supabase (PostgreSQL) | Real-time sync, RLS, Firebase-like DX |
| CT API Format | CSV via xlquery.asp | Easier parsing than XML |
| Critic Scores | JSONB column | Flexibility for 31 score sources |
| Sync Strategy | Full snapshot + upsert | CT doesn't support delta |
| Primary Data Source | Table=Bottles | Has consumption history (BottleState) |
| Secondary Data Source | Table=List | For critic scores (WA, WS, etc.) |
| Bottle ID | CT "Barcode" field | 10-digit auto-generated, 100% unique |
| Encoding | latin-1 → UTF-8 | CT exports use Windows-1252 |

### Data Source Analysis
| Source | Use For |
|--------|---------|
| Table=Bottles&InStock=0 | Primary - all bottle history with consumption |
| Table=List | Critic scores (not in bottles export) |
| HTML export | Discard - subset with no history |

### Known Gotchas (see docs/GOTCHAS.md)
- 804 consumed wines have no critic scores (not in Table=List)
- 231 wines have French/German accents (latin-1 encoding)
- Dates are M/D/YYYY format (not ISO)
- Vintage "1001" = Non-Vintage
- Location "none" = ANOMALY requiring review (1 bottle)

---

## Phase 1: Supabase Setup & Schema ✅

### Tasks
- [x] Create Supabase project
- [x] Configure environment variables
- [x] Run `wines` table migration
- [x] Run `wine_enrichments` table migration
- [x] Run `bottles` table migration
- [x] Run `pull_list_items` table migration
- [x] Run `app_settings` table migration
- [x] Create `v_wines_full` view
- [x] Create `v_wines_pending_enrichment` view
- [x] Create `v_collection_stats` view
- [x] Configure Row Level Security policies
- [x] Test table creation and relationships
- [x] Document Supabase project URL and keys location

### Completed
- **Supabase Project:** https://jxidqettmqneswsuevoc.supabase.co
- **Credentials:** Stored in `.env` (gitignored)
- **All 5 tables created:** wines, wine_enrichments, bottles, pull_list_items, app_settings
- **All 7 views created:** v_wines_full, v_wines_pending_enrichment, v_wines_with_high_scores, v_bottles_in_stock, v_bottles_consumed, v_collection_stats, v_bottles_needing_review
- **RLS enabled:** Authenticated read required, service_role write for core tables
- **Security hardened:** Anonymous users blocked from all data (protects valuations)
- **Auth user created:** For dashboard access
- **Dashboard updated:** Login required to view data
- **Verification scripts:** `scripts/verify_schema.py`, `scripts/validate_security.py`

---

## Phase 2: CellarTracker Extraction ✅

### Tasks
- [x] Set up Supabase CLI locally (via npx)
- [x] Create Edge Function `sync-cellartracker`
- [x] Implement xlquery.asp API client (TypeScript)
- [x] Handle CSV parsing with proper encoding (windows-1252)
- [x] Map CT fields to database schema
- [x] Pull Table=Bottles (primary - has consumption history)
- [x] Pull Table=List (for critic scores)
- [x] Implement upsert logic (wines + bottles tables)
- [x] Store CT credentials in Supabase secrets
- [x] Deploy and test function
- [ ] Test from dashboard settings page (Phase 4)

### Completed
- **Edge Function:** `sync-cellartracker` deployed
- **Endpoint:** `POST https://jxidqettmqneswsuevoc.supabase.co/functions/v1/sync-cellartracker`
- **First sync results:** 1,229 wines, 2,373 bottles (878 in stock, 1,495 consumed)
- **Handles:** Latin-1 encoding, consumed wines missing from List, batch upserts

### Architecture
```
Dashboard Settings Page
        ↓ HTTP POST
Supabase Edge Function (sync-cellartracker)
        ↓
CellarTracker xlquery.asp API
        ↓ CSV response
Parse & Transform
        ↓
Upsert to wines/bottles tables
        ↓
Return { success, counts }
```

### API Details
```
Endpoint: https://www.cellartracker.com/xlquery.asp
Parameters:
  - User: (from Supabase secrets)
  - Password: (from Supabase secrets)
  - Format: csv
  - Table: Bottles (primary) + List (critic scores)
  - InStock: 0 (include consumed/lost)
```

### Blockers
- None currently

---

## Phase 2.5: Sync Validation & Testing ✅

### Problem Statement
CT sync runs but no automated validation. Need:
1. Post-sync data integrity checks
2. Test results visible in dashboard
3. Flag anomalies for user attention

### Tasks
- [x] Create `sync_results` table to store sync history + validation
- [x] Add validation step to sync Edge Function (or create separate function)
- [x] Create `validate-sync` Edge Function for on-demand validation (deferred - not needed)
- [x] Add admin UI to dashboard settings.html showing:
  - Last sync timestamp + status
  - Validation results (pass/fail counts)
  - Anomaly list (clickable)
- [x] Write unit tests for CT sync helper functions (TypeScript/Deno)
- [x] Fix validation pagination bug (>1000 rows)
- [x] Add anon-read RLS policy for sync_results
- [x] Test sync + validation end-to-end

### Validation Checks
| Check | Query | Severity |
|-------|-------|----------|
| Wine count matches | wines.count > 0 | Critical |
| Bottle count matches | bottles.count > 0 | Critical |
| Orphan bottles | bottles without matching wine | Error |
| Location anomalies | location = 'none' or NULL | Warning |
| Bin overcapacity | bin has > 6 bottles (in-stock) | Warning |
| Encoding issues | wine_name contains replacement char | Warning |
| Missing enrichments | in-stock wines without enrichment | Warning (deferred) |

### Data Model Addition
```sql
CREATE TABLE sync_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    synced_at TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL, -- 'cellartracker'
    status TEXT NOT NULL, -- 'success', 'partial', 'failed'
    wines_synced INTEGER,
    bottles_synced INTEGER,
    validation JSONB, -- {checks: [{name, status, count, details}]}
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Dashboard UI (settings.html)
```
┌─────────────────────────────────────┐
│ Sync Status                         │
├─────────────────────────────────────┤
│ Last Sync: 2026-01-19 10:30 AM ✅   │
│ Wines: 1,229 | Bottles: 2,373       │
├─────────────────────────────────────┤
│ Validation                          │
│ ✅ Wine count OK                    │
│ ✅ Bottle count OK                  │
│ ⚠️ 1 location anomaly               │
│ ⚠️ 804 wines missing enrichment     │
└─────────────────────────────────────┘
```

### Decisions
- ✅ Store validation in `sync_results` table (single table)
- ✅ Run validation inside sync function (always runs)

### Unresolved Questions
- Include enrichment check? (deferred - decide later)

### Blockers
- None

---

## Phase 3: Data Migration ✅

### Completed via Phase 2 Sync
Data migration was completed automatically by running the CT sync Edge Function.
No separate migration needed - fresh data pulled directly from CellarTracker.

### Final Data Counts
| Metric | Count |
|--------|-------|
| Total wines | 1,229 |
| Total bottles | 2,373 |
| In stock | 878 |
| Consumed | 1,495 |

### Notes
- Original wine_collection.json had 425 wines (only in-stock)
- CT sync pulled complete history including all consumed wines
- Enrichments migrated in Phase 3.5

---

## Phase 3.5: Enrichment Data Migration ✅

### Problem Statement
The CT sync (Phase 2) pulled wine data from CellarTracker, but the **Gemini-generated enrichment data** from `wine_collection.json` was never migrated to the `wine_enrichments` table.

**Final State:**
| Table | Rows | Status |
|-------|------|--------|
| `wines` | 1,229 | ✅ Populated from CT |
| `wine_enrichments` | 425 | ✅ Migrated from JSON |

**Source Data:**
- File: `data/backups/wine_collection.json`
- Contains: 425 wines with full enrichment data
- Generated by: Gemini AI (prior to this project)

### Tasks
- [x] Create migration script `scripts/migrate_enrichments.py`
- [x] Parse `wine_collection.json` and extract enrichment fields
- [x] Map JSON fields to `wine_enrichments` table schema
- [x] Validate wine IDs exist in `wines` table before insert
- [x] Upsert enrichment data to Supabase
- [x] Verify row count (expect 425 rows)
- [x] Spot-check data integrity (tasting notes, pairings)

### Field Mapping

| JSON Field | Database Column | Type |
|------------|-----------------|------|
| `id` | `wine_id` (FK) | TEXT |
| `tasting_notes.appearance` | `tasting_appearance` | TEXT |
| `tasting_notes.nose` | `tasting_nose` | TEXT |
| `tasting_notes.palate` | `tasting_palate` | TEXT |
| `tasting_notes.finish` | `tasting_finish` | TEXT |
| `tasting_notes.overall` | `tasting_overall` | TEXT |
| `aroma_descriptors` | `aroma_descriptors` | TEXT[] |
| `flavor_descriptors` | `flavor_descriptors` | TEXT[] |
| `food_pairings` | `food_pairings` | JSONB |
| `characteristics` | `characteristics` | JSONB |
| `aging_potential` | `aging_potential` | TEXT |
| `drink_from_year` | `drink_from_year` | TEXT |
| `drink_by_year` | `drink_by_year` | TEXT |
| `serving_suggestions` | `serving_suggestions` | JSONB |
| `_augmentation_status` | `enrichment_status` | TEXT |
| `_augmentation_timestamp` | `enriched_at` | TIMESTAMPTZ |
| (hardcoded) | `model_version` | TEXT ("gemini-1.5-pro") |

### Edge Cases to Handle

1. **Wine ID mismatch**: JSON `id` must exist in `wines.ct_wine_id`
   - Expected: All 425 should match (they were in-stock during JSON creation)
   - Action: Log any mismatches, skip those records

2. **Missing enrichment fields**: Some wines may have partial data
   - Action: Allow NULLs for optional fields

3. **Duplicate runs**: Script must be idempotent
   - Action: Use UPSERT with `ON CONFLICT (wine_id) DO UPDATE`

4. **Timestamp parsing**: `_augmentation_timestamp` is ISO format
   - Example: `"2026-01-13T23:09:04.005821"`
   - Action: Parse as TIMESTAMPTZ

### Success Criteria
- [x] `wine_enrichments` table has 425 rows
- [x] All `wine_id` values have matching `wines.ct_wine_id`
- [x] `v_wines_full` view returns enrichment data joined with wine data
- [ ] Dashboard can display tasting notes for enriched wines (Phase 4)

### Unresolved Questions
- None

### Blockers
- None (Phase 3 complete, source data available)

---

## Phase 4: Dashboard Integration ✅

### Tasks
- [x] Add Supabase JS client to dashboard (settings.html)
- [x] Implement Supabase Auth + TOTP MFA (settings.html)
- [x] Update index.html data loading (static JSON → Supabase)
- [x] Update mobile.html data loading (static JSON → Supabase)
- [x] Migrate pull list from Firebase RTDB → Supabase
- [x] Migrate settings from Firebase RTDB → Supabase (demo mode)
- [x] Implement real-time subscriptions (demo mode)
- [x] Create dedicated login.html with MFA support
- [x] Add navigation links between pages
- [x] Test on dev environment
- [x] Deploy to production
- [x] Decommission Firebase dependencies (removed from all files)

### Files to Modify
- `C:\Users\mikep\Desktop\dashboard\public\index.html` - Wine data + pull list
- `C:\Users\mikep\Desktop\dashboard\public\mobile.html` - Wine data + pull list
- `C:\Users\mikep\Desktop\dashboard\public\settings.html` - ✅ Auth complete

### Blockers
- None

---

## Phase 5: Enrichment Pipeline ⚪

### Requirements
- **Only enrich in-stock wines** (quantity > 0)
- Consumed/lost wines do NOT need enrichment
- Query: `SELECT * FROM wines WHERE quantity > 0 AND ct_wine_id NOT IN (SELECT wine_id FROM wine_enrichments)`

### Tasks
- [ ] Create enrichment script framework
- [ ] Integrate Gemini API client
- [ ] Implement batch enrichment logic
- [ ] Add enrichment status tracking
- [ ] Create trigger for new wines (in-stock only)
- [ ] Test with sample wines
- [ ] Document enrichment prompts and versioning

### Blockers
- None (Phase 4 complete)

---

## Session Log

### 2026-01-18 - Initial Setup (Session 1)
**Session Focus:** Documentation and planning

**Completed:**
- Analyzed existing data structures (wine_collection.json, cellartracker_raw.html)
- Created comprehensive documentation suite
- Identified gap: DATA_MODEL.md was missing 43 CellarTracker fields
- Updated DATA_MODEL.md with all 67 fields including critic scores
- Reviewed CellarTracker_Data_Ingestion_Plan.md for API details
- Created CLAUDE.md with engineering guidelines
- Created PROGRESS.md tracker
- Set up proper folder structure:
  - Created docs/, src/, sql/, data/, config/, tests/, scripts/ folders
  - Moved documentation to docs/
  - Moved data files to data/raw/ and data/backups/
  - Created SQL migrations (001-006)
  - Created RLS policies
  - Created field_mappings.json config
  - Created .env.example and .gitignore
- Added `bottles` table to DATA_MODEL.md for bottle-level tracking
- Updated ERD to show data source mappings

**Key Insights:**
- CellarTracker uses CSV API (xlquery.asp), not HTML scraping
- InStock=0 parameter is critical for consumed/lost bottles
- BottleState column: 1=In-Stock, 0=Consumed/Lost
- Full snapshot sync required (no delta support)
- Table=Bottles for bottle-level, Table=List for wine-level

**Files Created This Session:**
- `CLAUDE.md` - AI agent instructions
- `PROGRESS.md` - This file
- `.env.example` - Environment template
- `.gitignore` - Git ignore rules
- `config/field_mappings.json` - CT → DB column mappings
- `sql/migrations/001_create_wines.sql`
- `sql/migrations/002_create_enrichments.sql`
- `sql/migrations/003_create_bottles.sql`
- `sql/migrations/004_create_pull_list.sql`
- `sql/migrations/005_create_settings.sql`
- `sql/migrations/006_create_views.sql`
- `sql/policies/rls_policies.sql`
- `sql/seeds/initial_settings.sql`

**Next Session Should:**
1. Create Supabase project
2. Run migrations in Supabase SQL editor
3. Test table creation and RLS policies
4. Start building CellarTracker extractor in src/extractors/cellartracker/

### 2026-01-18 - Data Analysis & Integration Docs (Session 2)
**Session Focus:** Live data pull, source comparison, gotcha analysis, cross-project docs

**Completed:**
- Pulled live data from CellarTracker xlquery.asp API
  - Table=List: 425 wines, 66 columns (wine-level)
  - Table=Bottles: 2,373 bottles, 36 columns (bottle-level with history)
- Analyzed and compared data sources (HTML vs CSV List vs CSV Bottles)
- Discovered HTML file is useless (no consumption history)
- Confirmed Table=Bottles is primary source (has BottleState, ConsumptionDate)
- Confirmed Table=List needed for critic scores (not in Bottles export)
- Verified barcode uniqueness: 2,373 unique (safe as PK)
- Identified gotchas:
  - 804 consumed wines have no critic scores (need to cache on first sync)
  - 231 wines with accents (latin-1 encoding)
  - Date format M/D/YYYY (not ISO)
  - Vintage "1001" = NV
  - Location "none" = anomaly for review (1 bottle)
- Created GOTCHAS.md documentation
- Created DATA_SOURCE_COMPARISON.md
- Created DASHBOARD_INTEGRATION.md (interface contract for dashboard)
- Updated dashboard CLAUDE.md with data layer reference
- Added v_bottles_needing_review view for anomalies
- Clarified: CT "Barcode" is internal bottle ID, not physical UPC

**Live Data Stats:**
- In stock: 878 bottles
- Consumed: 1,495 bottles
- Unique wines ever: 1,229
- Consumption is ACTIVE (latest: 2026-01-03)

**Files Created This Session:**
- `docs/DATA_SOURCE_COMPARISON.md`
- `docs/GOTCHAS.md`
- `docs/DASHBOARD_INTEGRATION.md`
- `data/raw/cellartracker_list.csv` (live pull)
- `data/raw/cellartracker_bottles.csv` (live pull)

**Files Updated This Session:**
- `CLAUDE.md` - Added cross-project communication section
- `sql/migrations/003_create_bottles.sql` - Clarified barcode is CT internal ID
- `sql/migrations/006_create_views.sql` - Added v_bottles_needing_review
- `config/field_mappings.json` - Fixed Barcode mapping
- `C:\Users\mikep\Desktop\dashboard\CLAUDE.md` - Added data layer reference

**Next Session Should:**
1. ~~Create Supabase project~~ Done
2. ~~Run migrations~~ Done
3. ~~Build CT extractor~~ Done
4. Phase 4: Dashboard integration

### 2026-01-19 - Enrichment Migration & Sync Validation (Session 4)
**Session Focus:** Phase 3.5 enrichment migration, Phase 2.5 sync validation

**Completed:**
- Phase 3.5: Migrated 425 enrichments from wine_collection.json to Supabase
- Created `scripts/migrate_enrichments.py` with testable functions
- Added 21 unit tests for migration (`tests/test_migrate_enrichments.py`)
- Phase 2.5: Created `sync_results` table for sync history + validation
- Updated `sync-cellartracker` Edge Function with 6 validation checks:
  - wine_count, bottle_count (critical)
  - orphan_bottles (error)
  - location_anomalies, bin_overcapacity, encoding_issues (warning)
- Added 23 Deno unit tests for CT sync helpers
- Added admin UI to dashboard `settings.html` showing sync status + validation

**Key Files Created/Modified:**
- `scripts/migrate_enrichments.py` - Enrichment migration (refactored for testing)
- `tests/test_migrate_enrichments.py` - 21 tests
- `sql/migrations/007_create_sync_results.sql` - Sync results table
- `supabase/migrations/20260119000000_create_sync_results.sql` - Same for CLI
- `supabase/functions/sync-cellartracker/index.ts` - Added validation
- `supabase/functions/sync-cellartracker/index.test.ts` - 23 Deno tests
- `C:\Users\mikep\Desktop\dashboard\public\settings.html` - Sync status UI

**Not Yet Tested:**
- Full sync with validation storage (interrupted)
- Settings page sync status display in browser

**Note:** settings.html has placeholder auth credentials `[USERNAME_HERE]`/`[PASSWORD_HERE]`

**Next Session Should:**
1. ~~Test sync + validation end-to-end~~ Done
2. ~~Verify settings.html displays sync status~~ Done
3. ~~Update PROGRESS.md Phase 2.5 tasks to complete~~ Done
4. Begin Phase 4: Dashboard Integration

### 2026-01-19 - Phase 2.5 Completion (Session 5)
**Session Focus:** Complete Phase 2.5 sync validation

**Completed:**
- Tested sync + validation end-to-end
- Fixed validation pagination bug (was only checking first 1000 rows)
- Fixed orphan_bottles false positive (was reporting 106, actually 0)
- Added anon-read RLS policy for sync_results table
- Verified settings.html can fetch sync status via anon key
- Deployed updated sync-cellartracker Edge Function
- All 6 validation checks now pass correctly:
  - wine_count: 1,229 (pass)
  - bottle_count: 2,373 (pass)
  - orphan_bottles: 0 (pass)
  - location_anomalies: 1 (warning)
  - bin_overcapacity: 2 (warning - Yellow box 29, Champagne box 2)
  - encoding_issues: 0 (pass)

**Key Files Modified:**
- `supabase/functions/sync-cellartracker/index.ts` - Fixed pagination in validation
- `sql/migrations/007_create_sync_results.sql` - Added anon-read policy
- `supabase/migrations/20260119090000_sync_results_anon_read.sql` - Deployed policy

**Next Session Should:**
1. ~~Begin Phase 4: Dashboard Integration~~ Started (auth done)

### 2026-01-19 - Supabase Auth + MFA (Session 6)
**Session Focus:** Replace hardcoded credentials with Supabase Auth + TOTP MFA

**Completed:**
- Removed hardcoded credentials from settings.html
- Implemented Supabase Auth email/password login
- Added TOTP MFA enrollment flow (QR code + manual secret fallback)
- Added TOTP MFA verification flow
- Auto-cleanup of orphaned MFA factors on enrollment errors
- Deployed and tested on Firebase dev instance

**Auth Flow:**
```
Email/Password → Check MFA factors →
  If none: Show QR enrollment → Verify code → Settings
  If enrolled: Show TOTP input → Verify code → Settings
```

**Key Files Modified:**
- `C:\Users\mikep\Desktop\dashboard\public\settings.html` - Full Supabase Auth + MFA

**User Account:**
- Email: sendmewine@outlook.com
- MFA: TOTP enabled

**Next Session Should:**
1. ~~Continue Phase 4: Migrate wine data loading to Supabase~~ Done
2. ~~Migrate pull list from Firebase RTDB to Supabase~~ Done
3. ~~Deploy to production when ready~~ Done

---

### 2026-01-19 - Phase 4 Complete (Session 7)
**Session Focus:** Complete Firebase → Supabase migration for dashboard

**Completed:**
- Created dedicated `login.html` with full MFA support
- Migrated `index.html` to Supabase (wine data, pull list, demo mode)
- Migrated `mobile.html` to Supabase (same changes)
- Simplified `settings.html` (removed embedded login forms)
- Added navigation links (settings gear in headers, back links)
- Removed all Firebase dependencies from all files
- Added sync confirmation dialog
- Fixed auth redirect bugs (missing redirect params)
- Fixed back link to return to mobile when coming from mobile
- Deployed to production
- Updated `v_wines_pending_enrichment` view to filter in-stock only
- Verified all 425 in-stock wines already have enrichment (0 pending)
- Updated Phase 5 requirements: only in-stock wines need enrichment
- Used Python + Supabase Management API to run SQL updates

**Key Files Created/Modified:**
- `login.html` - New dedicated login page with MFA
- `index.html` - Full Supabase migration
- `mobile.html` - Full Supabase migration
- `settings.html` - Simplified, Supabase-only
- `sql/migrations/006_create_views.sql` - Updated view filter

**Data Sources Now:**
- Wine data: `v_wines_full` view (Supabase)
- Pull list: `pull_list_items` table (Supabase)
- Demo mode: `app_settings` table (Supabase)
- Auth: Supabase Auth + TOTP MFA

**Enrichment Status:**
- In-stock wines: 425
- Enriched wines: 425
- Pending enrichment: 0 (all current wines covered)
- Phase 5 only needed for future wines from CT sync

**Documentation:**
- Added README.md to both repos
- Updated CLAUDE.md with session learnings (auth patterns, pitfalls)

**Next Session Should:**
1. Phase 5: Build Gemini enrichment pipeline for new wines (when needed)

---

### 2026-01-19 - Supabase Setup & CT Sync (Session 3)
**Session Focus:** Complete Phase 1, 2, 3

**Completed:**
- Created Supabase project: https://jxidqettmqneswsuevoc.supabase.co
- Ran all migrations (5 tables, 7 views)
- Configured RLS for authenticated-only access (protects valuations)
- Created auth user for dashboard login
- Stored CT credentials as Supabase secrets
- Built and deployed Edge Function: `sync-cellartracker`
- First sync: 1,229 wines, 2,373 bottles (878 in stock, 1,495 consumed)
- Set up GitHub repo: https://github.com/VintageGeek/wine-data-layer

**Key Files Created:**
- `supabase/functions/sync-cellartracker/index.ts` - CT sync Edge Function
- `scripts/verify_schema.py` - Schema verification
- `scripts/validate_security.py` - RLS security validation
- `sql/run_all_migrations.sql` - Combined migration script
- `sql/policies/rls_authenticated.sql` - Auth-required policies

**Architecture Decisions:**
- ADR-006: Supabase Edge Functions for CT sync (TypeScript)
- ADR-007: Separate enrichment from sync (LLM calls need different approach)
- ADR-008: Authenticated access only (protects wine valuations)

**Credentials Stored:**
- `.env` - Local dev (Supabase keys, CT creds, CLI token)
- Supabase Secrets - CT credentials for Edge Function

**Sync Endpoint:**
```
POST https://jxidqettmqneswsuevoc.supabase.co/functions/v1/sync-cellartracker
```

**Next Session Should:**
1. Phase 4: Update dashboard to use Supabase
2. Add sync button to dashboard settings page
3. Test authenticated data access

---

## Architecture Decisions Record (ADR)

### ADR-001: Separate wines and enrichments tables
**Status:** Accepted
**Context:** Need to update CellarTracker data without losing AI enrichments
**Decision:** Two tables with 1:1 relationship via ct_wine_id
**Consequences:** Slightly more complex queries, but clean data separation

### ADR-002: JSONB for critic scores
**Status:** Accepted
**Context:** 31 different critic score columns from CellarTracker
**Decision:** Store as single JSONB column `critic_scores`
**Consequences:** Flexible, queryable with GIN index, avoids wide table

### ADR-003: CSV over XML for CellarTracker extraction
**Status:** Accepted
**Context:** CellarTracker API supports both CSV and XML
**Decision:** Use CSV format
**Consequences:** Simpler parsing, better encoding handling

### ADR-004: Bottle-level vs Wine-level tracking
**Status:** Accepted
**Context:** CT offers Table=Bottles (bottle-level) or Table=List (wine-level)
**Decision:** Use BOTH - Table=Bottles as primary (has consumption history), Table=List for critic scores
**Consequences:**
- Bottles table tracks individual bottle state and consumption
- Wines table gets critic scores from List export
- Need to join on iWine/ct_wine_id
- Consumed wines may lack critic scores if not cached on first sync

### ADR-005: CT "Barcode" as bottle primary key
**Status:** Accepted
**Context:** Need unique identifier for bottles table
**Decision:** Use CT "Barcode" field (actually an internal 10-digit ID, not physical UPC)
**Consequences:**
- 100% unique across 2,373 bottles (verified)
- Auto-generated by CellarTracker
- Safe to use as primary key (ct_bottle_id)

### ADR-006: Supabase Edge Functions for CT Sync
**Status:** Accepted
**Context:** Need to run CT extractor from dashboard, not locally
**Decision:** Use Supabase Edge Functions (TypeScript/Deno)
**Consequences:**
- Dashboard can trigger sync via HTTP call
- CT credentials stored in Supabase secrets
- Fast execution (~10-30 seconds)
- Free tier sufficient (500K invocations/month)
- Trade-off: TypeScript instead of Python

### ADR-007: Separate Enrichment from Sync
**Status:** Accepted
**Context:** LLM enrichment requires 400+ API calls, too slow for single function
**Decision:** Decouple enrichment from CT sync
- CT Sync: Supabase Edge Function (instant)
- Enrichment: GitHub Actions cron or manual batched triggers
**Consequences:**
- CT sync stays fast and simple
- Enrichment can run in background without timeouts
- Stays on Supabase free tier (pg_cron requires Pro)

### ADR-008: Authenticated Access Only
**Status:** Accepted
**Context:** Wine valuations are sensitive, dashboard is public internet
**Decision:** Require Supabase Auth for all data access
**Consequences:**
- Anonymous users see nothing
- Single user account for owner
- Dashboard updated with login flow
- RLS policies enforce authentication

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CT API changes/deprecation | Low | High | Document fallback to HTML scraping |
| Data loss during migration | Low | High | Keep JSON backups, test in dev first |
| Firebase → Supabase real-time differences | Medium | Medium | Test thoroughly, document behavior changes |
| Enrichment API costs | Medium | Low | Batch processing, cache results |

---

## How to Update This File

When starting a new session:
1. Read this file first to understand current state
2. Update "Last Updated" date
3. Check current phase and blockers
4. Add session entry to Session Log
5. Update task checkboxes as work progresses
6. Document any new decisions in ADR section
