# Wine Data Layer - Progress Tracker

> **Last Updated:** 2026-01-18
> **Current Phase:** Phase 2 - CellarTracker Extraction
> **Overall Status:** 🟡 In Progress

---

## Quick Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 0: Planning & Documentation | 🟢 Complete | 100% |
| Phase 1: Supabase Setup & Schema | 🟢 Complete | 100% |
| Phase 2: CellarTracker Extraction | 🟡 In Progress | 0% |
| Phase 3: Data Migration | ⚪ Not Started | 0% |
| Phase 4: Dashboard Integration | ⚪ Not Started | 0% |
| Phase 5: Enrichment Pipeline | ⚪ Not Started | 0% |

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

## Phase 2: CellarTracker Extraction 🟡

### Tasks
- [ ] Set up Supabase CLI locally
- [ ] Create Edge Function `sync-cellartracker`
- [ ] Implement xlquery.asp API client (TypeScript)
- [ ] Handle CSV parsing with proper encoding (latin-1)
- [ ] Map CT fields to database schema
- [ ] Pull Table=Bottles (primary - has consumption history)
- [ ] Pull Table=List (for critic scores)
- [ ] Implement upsert logic (wines + bottles tables)
- [ ] Store CT credentials in Supabase secrets
- [ ] Add sync status tracking
- [ ] Test end-to-end from dashboard
- [ ] Create extractor documentation

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

## Phase 3: Data Migration ⚪

### Tasks
- [ ] Create initial data loader script
- [ ] Implement batch upsert (100-200 records/batch)
- [ ] Migrate wines table from wine_collection.json
- [ ] Migrate enrichments from wine_collection.json
- [ ] Validate data integrity (counts match)
- [ ] Test conflict resolution (upsert on ct_wine_id)
- [ ] Document migration process

### Data Counts to Verify
| Source | Expected |
|--------|----------|
| Total wines | 425 |
| Total bottles | 878 |
| Enriched wines | 425 (all have augmentation) |

### Blockers
- Depends on: Phase 1 (tables exist), Phase 2 (extractor working)

---

## Phase 4: Dashboard Integration ⚪

### Tasks
- [ ] Add Supabase JS client to dashboard
- [ ] Update index.html data loading
- [ ] Update mobile.html data loading
- [ ] Migrate pull list from Firebase RTDB
- [ ] Migrate settings from Firebase RTDB
- [ ] Implement real-time subscriptions
- [ ] Test on dev environment
- [ ] Deploy to production
- [ ] Decommission Firebase dependencies

### Files to Modify
- `C:\Users\mikep\Desktop\dashboard\public\index.html`
- `C:\Users\mikep\Desktop\dashboard\public\mobile.html`
- `C:\Users\mikep\Desktop\dashboard\public\settings.html`

### Blockers
- Depends on: Phase 1-3 complete

---

## Phase 5: Enrichment Pipeline ⚪

### Tasks
- [ ] Create enrichment script framework
- [ ] Integrate Gemini API client
- [ ] Implement batch enrichment logic
- [ ] Add enrichment status tracking
- [ ] Create trigger for new wines
- [ ] Test with sample wines
- [ ] Document enrichment prompts and versioning

### Blockers
- Depends on: Phase 3 (wines in database)

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
1. Create Supabase project
2. Run migrations in order (001-006)
3. Apply RLS policies
4. Load initial data from CSVs
5. Test queries against v_wines_full view

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
