# Wine Data Layer - Progress Tracker

> **Last Updated:** 2026-01-19
> **Current Phase:** Phase 5 - Enrichment Pipeline (Not Started)
> **Status:** 🟢 Phases 0-4 Complete

---

## Quick Status

| Phase | Status |
|-------|--------|
| Phase 0-4: Planning → Dashboard Integration | 🟢 Complete |
| Phase 5: Enrichment Pipeline | ⚪ Not Started |

---

## Current Infrastructure

**Supabase Project:** https://jxidqettmqneswsuevoc.supabase.co

**Tables:** wines, wine_enrichments, bottles, pull_list_items, app_settings, sync_results

**Views:** v_wines_full, v_wines_pending_enrichment, v_bottles_in_stock, v_bottles_consumed, v_collection_stats

**Edge Function:** `sync-cellartracker` - Syncs from CellarTracker API
```
POST https://jxidqettmqneswsuevoc.supabase.co/functions/v1/sync-cellartracker
Headers: Authorization: Bearer <jwt>, apikey: <anon_key>
```

**Dashboard:** https://wine-explorer-puller.web.app (Firebase Hosting)

**Data Counts:** 1,229 wines, 2,373 bottles (878 in stock), 425 enriched

---

## Phase 5: Enrichment Pipeline

**Requirement:** Only enrich in-stock wines (quantity > 0). Consumed wines don't need enrichment.

**Status:** All 425 current in-stock wines are already enriched. Pipeline only needed for future wines added via CT sync.

### Tasks
- [ ] Create enrichment script framework
- [ ] Integrate Gemini API client
- [ ] Implement batch enrichment logic
- [ ] Add enrichment status tracking
- [ ] Create trigger for new wines (in-stock only)
- [ ] Test with sample wines
- [ ] Document enrichment prompts and versioning

---

## Architecture Decisions (ADR)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Separate wines/enrichments tables | Clean data separation, CT updates don't lose AI data |
| 2 | JSONB for critic scores | Flexibility for 31 score sources |
| 3 | CSV over XML for CT | Simpler parsing |
| 4 | Both Bottles + List tables | Bottles for history, List for critic scores |
| 5 | CT "Barcode" as bottle PK | 100% unique internal ID |
| 6 | Edge Functions for CT sync | Dashboard can trigger, fast execution |
| 7 | Separate enrichment from sync | LLM calls too slow for single function |
| 8 | Authenticated access only | Protects wine valuations |

---

## Key References

| Doc | Purpose |
|-----|---------|
| `CLAUDE.md` | AI instructions, coding standards, Supabase patterns |
| `docs/DATA_MODEL.md` | Database schema reference |
| `docs/GOTCHAS.md` | Edge cases and data quirks |
| `docs/DASHBOARD_INTEGRATION.md` | Dashboard interface contract |
| `docs/SESSION_HISTORY.md` | Archived session logs |

---

## Gotchas (Quick Reference)

- CT encoding: latin-1 (Windows-1252)
- CT dates: M/D/YYYY format
- Vintage "1001" = Non-Vintage
- 804 consumed wines missing critic scores
- Location "none" = anomaly (1 bottle)
- Bin capacities: A,B,C,F,G,H=6 | D,I=4 | E,J=2
