# Wine Data Layer

Data extraction, transformation, and storage layer for wine collection management. Extracts data from CellarTracker, enriches via Gemini AI, and stores in Supabase.

## Architecture

```
CellarTracker API → Supabase Edge Function → PostgreSQL
                                                ↓
                              Dashboard (wine-dashboard repo)
```

## Features

- **CellarTracker Sync**: Pull wine inventory via xlquery.asp API
- **Bottle-level Tracking**: Individual bottle history with consumption dates
- **AI Enrichment**: Gemini-generated tasting notes and food pairings
- **Supabase Backend**: PostgreSQL with RLS, real-time subscriptions
- **Validation**: Post-sync data integrity checks

## Database Schema

| Table | Purpose |
|-------|---------|
| `wines` | Wine catalog (1,229 wines) |
| `wine_enrichments` | AI-generated tasting notes (425 enriched) |
| `bottles` | Individual bottle tracking (2,373 bottles) |
| `pull_list_items` | Wines marked to pull from cellar |
| `app_settings` | Key-value config (demo mode, etc.) |
| `sync_results` | Sync history with validation |

## Setup

1. Clone and install:
```bash
git clone https://github.com/VintageGeek/wine-data-layer.git
cd wine-data-layer
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

2. Configure `.env`:
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_ACCESS_TOKEN=sbp_...
CELLARTRACKER_USER=your_username
CELLARTRACKER_PASSWORD=your_password
```

3. Run migrations in Supabase SQL Editor (see `sql/migrations/`)

## Sync Endpoint

```bash
POST https://jxidqettmqneswsuevoc.supabase.co/functions/v1/sync-cellartracker
Authorization: Bearer <access_token>
```

## Project Structure

```
wine-data-layer/
├── sql/migrations/      # Database schema
├── sql/policies/        # RLS policies
├── supabase/functions/  # Edge Functions (CT sync)
├── scripts/             # Python utilities
├── tests/               # Test suites
├── docs/                # Documentation
├── CLAUDE.md            # AI agent instructions
└── PROGRESS.md          # Development tracker
```

## Related

- **Dashboard**: [wine-dashboard](https://github.com/VintageGeek/wine-dashboard)
- **Live App**: https://wine-explorer-puller.web.app
