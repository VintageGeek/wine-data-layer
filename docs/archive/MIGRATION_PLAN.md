# Wine Data Layer Migration Plan

## Executive Summary

Migrate from Firebase Realtime Database + static JSON files to Supabase, separating CellarTracker source data from AI-enriched content. This enables independent update cycles, proper data relationships, and scalable API access.

---

## Current State Analysis

### Data Sources
| Source | Format | Update Frequency | Purpose |
|--------|--------|------------------|---------|
| CellarTracker API | HTML table export | On-demand (manual) | Wine inventory, locations, valuations |
| Gemini Enrichment | Merged JSON | One-time per wine | Tasting notes, pairings, characteristics |
| Firebase RTDB | JSON | Real-time | Pull list state, settings |

### Current File Structure
```
wine_collection.json (2.3MB, 425 wines)
├── metadata: { created_at, version, total_wines, total_bottles }
└── wines[]: Combined CellarTracker + Enrichment data
```

### Data Field Classification

**CellarTracker Fields (source of truth):**
- `id` - CellarTracker iWine ID
- `wine_name`, `vintage`, `producer`, `varietal`
- `region`, `country`, `appellation`, `locale`, `sub_region`
- `type`, `color`, `category`, `bottle_size`
- `quantity`, `price`, `valuation`, `currency`
- `purchase_date`, `location`, `bin`
- `designation`, `vineyard`
- `drink_date_min`, `drink_date_max`
- `cellartracker_notes`

**Enrichment Fields (AI-generated, cached):**
- `tasting_notes`: { appearance, nose, palate, finish, overall }
- `aroma_descriptors`: []
- `flavor_descriptors`: []
- `food_pairings`: [{ dish, reason }]
- `characteristics`: { body, sweetness, acidity, tannin, alcohol, complexity }
- `aging_potential`
- `drink_from_year`, `drink_by_year`
- `serving_suggestions`: { temperature, decanting, glassware }
- `_augmentation_status`, `_augmentation_timestamp`

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Supabase Project                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  wines          │    │  wine_enrichments               │ │
│  │  (CellarTracker)│◄──►│  (Gemini AI data)               │ │
│  │  PK: ct_wine_id │    │  FK: wine_id → wines.ct_wine_id │ │
│  └────────┬────────┘    └─────────────────────────────────┘ │
│           │                                                  │
│  ┌────────▼────────┐    ┌─────────────────────────────────┐ │
│  │  pull_list      │    │  app_settings                   │ │
│  │  (user state)   │    │  (demo mode, etc.)              │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Edge Functions (optional)                            │   │
│  │  - CellarTracker sync endpoint                        │   │
│  │  - Enrichment trigger                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
           │
           │ Supabase JS Client
           ▼
┌─────────────────────────────────────────────────────────────┐
│  Dashboard App (existing)                                    │
│  - public/index.html (desktop)                               │
│  - public/mobile.html (mobile)                               │
│  - public/settings.html (admin)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Supabase Setup & Schema Design
**Goal:** Create database structure and migrate existing data

### Tasks
1. Create Supabase project
2. Design and create database tables (see DATA_MODEL.md)
3. Create migration scripts to split wine_collection.json into tables
4. Run initial data import
5. Verify data integrity

### Deliverables
- [ ] Supabase project created
- [ ] Tables created with proper relationships
- [ ] Data migration scripts (Python)
- [ ] Initial data loaded
- [ ] Row-level security policies defined

### Success Criteria
- All 425 wines imported to `wines` table
- All enrichment data imported to `wine_enrichments` table
- Foreign key relationships working
- Data matches original JSON file

---

## Phase 2: API Layer Implementation
**Goal:** Create REST/RPC endpoints for dashboard consumption

### Tasks
1. Enable Row Level Security (RLS) with read-only public access
2. Create database views for joined wine + enrichment data
3. Create API for pull_list CRUD operations
4. Create API for settings management
5. Test API endpoints

### Deliverables
- [ ] `v_wines_full` view (wines + enrichments joined)
- [ ] Pull list API (read/write)
- [ ] Settings API (read/write with auth)
- [ ] API documentation

### Success Criteria
- API returns same data structure as current JSON
- Pull list persists correctly
- Settings sync works

---

## Phase 3: Dashboard Migration
**Goal:** Update dashboard to use Supabase instead of static JSON

### Tasks
1. Add Supabase JS client to dashboard
2. Replace `fetch('/wine_collection.json')` with Supabase query
3. Migrate pull list from Firebase RTDB to Supabase
4. Migrate settings from Firebase RTDB to Supabase
5. Test on dev environment
6. Deploy to production

### Deliverables
- [ ] Updated index.html with Supabase integration
- [ ] Updated mobile.html with Supabase integration
- [ ] Updated settings.html with Supabase integration
- [ ] Firebase RTDB decommissioned

### Success Criteria
- Dashboard loads wine data from Supabase
- Pull list syncs in real-time
- Demo mode toggle works
- No Firebase dependencies remain

---

## Phase 4: Data Pipeline Automation
**Goal:** Automate CellarTracker sync and enrichment updates

### Tasks
1. Create CellarTracker HTML parser (Python script or Edge Function)
2. Create sync endpoint/script to update wines table
3. Create enrichment trigger for new wines
4. Set up scheduled sync (optional)

### Deliverables
- [ ] CellarTracker parser script
- [ ] Sync script/endpoint
- [ ] Enrichment pipeline for new wines
- [ ] Documentation for manual sync process

### Success Criteria
- New CellarTracker export can be synced to database
- Unchanged wines preserve their enrichment data
- New wines can be flagged for enrichment

---

## Phase 5: Enhanced Features (Future)
**Goal:** Leverage relational database capabilities

### Potential Features
- Multiple user support with separate pull lists
- Wine consumption history tracking
- Cellar location management
- Enrichment versioning (re-run AI with new models)
- Search and filter via database queries
- Analytics and reporting

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Keep JSON backup, test in dev first |
| API rate limits | Implement caching, optimize queries |
| Dashboard downtime | Run parallel systems during transition |
| Enrichment data mismatch | Use wine_id as stable foreign key |

---

## Timeline Overview

| Phase | Dependency | Status |
|-------|------------|--------|
| Phase 1: Setup & Schema | None | Not Started |
| Phase 2: API Layer | Phase 1 | Not Started |
| Phase 3: Dashboard Migration | Phase 2 | Not Started |
| Phase 4: Data Pipeline | Phase 1 | Not Started |
| Phase 5: Enhanced Features | Phase 3-4 | Future |

---

## Files in This Repository

- `MIGRATION_PLAN.md` - This document
- `DATA_MODEL.md` - Database schema and table definitions
- `API_REQUIREMENTS.md` - API endpoints and specifications
- `cellartracker_raw.html` - Latest CellarTracker export
- `wine_collection.json` - Current merged dataset (backup)
