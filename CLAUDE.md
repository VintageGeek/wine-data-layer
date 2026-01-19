# CLAUDE.md

This file provides guidance to Claude Code when working with the wine-data-layer project.
## Interactions

- in all interactions and commit messages, be extremely concise and sacrifice for the sake of concision. when embarking on a new phase that has not be planned out, create a plan first and document it for review. Store plan references where it makes sense.

## Plans

- Store all phase plans in `PROGRESS.md` (see "Plan Documentation Standard" section)
- At the end of each plan, list unresolved questions if any. Be extremely concise.

## Coding
- Ensure you are following all instructions in your context for design principles and best practices.

## Test Cases
- Ensure you are creating test cases for your implementations.  Lookup testing best practices for the type of project(s) you are working on and ensure they pass. TDD is preferred.  Understand test case coverage and let the user know where the coverage is not worh the effort (diminishing returns)

## Python
- Always run Python commands and tests through the virtual environment

---

## Project Overview

**Wine Data Layer** - A data extraction, transformation, and storage layer for wine collection management. Extracts data from CellarTracker, enriches it via Gemini AI, and stores in Supabase for consumption by the dashboard app.

### Related Projects
- **Dashboard App:** `C:\Users\mikep\Desktop\dashboard` - Frontend consuming this data layer
- **Firebase (legacy):** Being replaced by Supabase

---

## Critical: Progress Tracking

**ALWAYS read `PROGRESS.md` at the start of each session.** This file contains:
- Current phase and status
- Completed vs pending tasks
- Blockers and dependencies
- Session log with context from previous work
- Architecture decisions (ADRs)

**ALWAYS update `PROGRESS.md` when:**
- Starting a new task (check the box as in_progress)
- Completing a task (check the box as complete)
- Encountering a blocker (add to Blockers section)
- Making an architecture decision (add to ADR section)
- Ending a session (add session summary to Session Log)

---

## Folder Structure

```
wine-data-layer/
├── CLAUDE.md                      # AI agent instructions (this file)
├── PROGRESS.md                    # Progress tracker - READ FIRST
├── .env.example                   # Environment variable template
├── .gitignore                     # Git ignore rules
│
├── docs/                          # Documentation
│   ├── MIGRATION_PLAN.md          # Phased migration roadmap
│   ├── DATA_MODEL.md              # Database schema and SQL
│   ├── API_REQUIREMENTS.md        # Supabase API patterns
│   └── CellarTracker_Data_Ingestion_Plan.md  # CT API spec
│
├── src/                           # Source code
│   ├── extractors/                # Data extraction modules
│   │   └── cellartracker/         # CellarTracker API client
│   │       ├── client.py          # API client
│   │       ├── parser.py          # CSV/XML parsing
│   │       └── mapper.py          # Field mapping
│   │
│   ├── transformers/              # Data transformation
│   │   ├── normalize.py           # Data normalization
│   │   └── validate.py            # Data validation
│   │
│   ├── loaders/                   # Database loaders
│   │   └── supabase/              # Supabase integration
│   │       ├── client.py          # Supabase client wrapper
│   │       ├── wines.py           # Wines table operations
│   │       └── enrichments.py     # Enrichments table operations
│   │
│   └── enrichment/                # AI enrichment
│       ├── gemini_client.py       # Gemini API client
│       ├── prompts.py             # Enrichment prompts
│       └── processor.py           # Batch processing
│
├── sql/                           # Database SQL
│   ├── migrations/                # Schema migrations (numbered)
│   │   ├── 001_create_wines.sql
│   │   ├── 002_create_enrichments.sql
│   │   ├── 003_create_pull_list.sql
│   │   ├── 004_create_settings.sql
│   │   └── 005_create_views.sql
│   │
│   ├── policies/                  # RLS policies
│   │   └── rls_policies.sql
│   │
│   └── seeds/                     # Seed data
│       └── initial_settings.sql
│
├── data/                          # Data files (GITIGNORED)
│   ├── raw/                       # Raw exports from CellarTracker
│   │   └── cellartracker_export_YYYY-MM-DD.csv
│   │
│   ├── processed/                 # Transformed data ready for loading
│   │
│   └── backups/                   # JSON backups
│       └── wine_collection.json   # Current merged dataset
│
├── config/                        # Configuration
│   └── field_mappings.json        # CT field → DB column mappings
│
├── tests/                         # Test files
│   ├── test_extractor.py
│   ├── test_transformer.py
│   └── test_loader.py
│
└── scripts/                       # Utility scripts
    ├── sync.py                    # Full sync orchestration
    ├── migrate.py                 # Run SQL migrations
    └── validate_data.py           # Data integrity checks
```

---

## Phased Implementation Approach

Follow this order strictly. Each phase depends on the previous.

### Phase 0: Planning ✅
- Documentation complete
- Schema designed
- API patterns defined

### Phase 1: Supabase Foundation
- Create Supabase project
- Run all migrations in order
- Configure RLS policies
- Test with manual data

### Phase 2: CellarTracker Extraction
- Build extractor using xlquery.asp API
- Use CSV format (Format=csv)
- Include consumed/lost (InStock=0)
- Handle BottleState mapping

### Phase 3: Initial Data Migration
- Load existing wine_collection.json
- Split into wines + enrichments tables
- Validate counts and relationships

### Phase 4: Dashboard Integration
- Add Supabase client to dashboard
- Replace Firebase RTDB calls
- Test real-time sync
- Deploy and validate

### Phase 5: Enrichment Pipeline
- Build Gemini enrichment flow
- Process new/unenriched wines
- Track model versions

---

## Supabase Best Practices

### Schema Design
```sql
-- Always use TEXT for IDs from external systems
ct_wine_id TEXT PRIMARY KEY  -- Not INTEGER

-- Use TIMESTAMPTZ for all timestamps
created_at TIMESTAMPTZ DEFAULT NOW()

-- Use JSONB for flexible nested data
critic_scores JSONB DEFAULT '{}'

-- Add GIN indexes for JSONB columns you query
CREATE INDEX idx_critic_scores ON wines USING GIN (critic_scores);
```

### Upsert Pattern (Critical for CT sync)
```javascript
// Always use onConflict for idempotent syncs
const { error } = await supabase
  .from('wines')
  .upsert(wineData, {
    onConflict: 'ct_wine_id',
    ignoreDuplicates: false  // Update existing records
  })
```

### Batch Operations
```javascript
// Batch upserts in chunks of 100-200
const BATCH_SIZE = 100;
for (let i = 0; i < wines.length; i += BATCH_SIZE) {
  const batch = wines.slice(i, i + BATCH_SIZE);
  await supabase.from('wines').upsert(batch);
}
```

### Real-Time Subscriptions
```javascript
// Subscribe to changes (replaces Firebase onValue)
const channel = supabase
  .channel('changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'pull_list_items' },
    (payload) => handleChange(payload)
  )
  .subscribe()
```

### Row Level Security
```sql
-- Enable RLS on all tables
ALTER TABLE wines ENABLE ROW LEVEL SECURITY;

-- Public read, restricted write
CREATE POLICY "Public read" ON wines FOR SELECT USING (true);
CREATE POLICY "Service write" ON wines FOR ALL
  USING (auth.role() = 'service_role');
```

### Firebase to Supabase Migration Notes
| Firebase | Supabase | Notes |
|----------|----------|-------|
| `ref(db, 'path')` | `supabase.from('table')` | Table-based, not path-based |
| `onValue()` | `.subscribe()` | Use postgres_changes channel |
| `set()` | `.upsert()` | Prefer upsert over insert |
| `push()` | `.insert()` | Supabase generates UUIDs |
| `update()` | `.update().eq()` | Must specify row filter |
| Database rules | RLS policies | SQL-based, more powerful |

### Dashboard Auth Patterns
```javascript
// CORRECT: Auth check with redirect param
async function checkAuthAndInit() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname.split('/').pop());
        return;
    }
    // Now load data...
}

// CORRECT: Dynamic back link based on referrer
const referrer = document.referrer;
if (referrer.includes('mobile.html')) {
    document.getElementById('backLink').href = 'mobile.html';
}

// CORRECT: Container starts hidden, show after auth
// HTML: <div class="container" id="mainContainer">  (NO "show" class)
// JS: document.getElementById('mainContainer').classList.add('show');
```

---

## Engineering Principles

### Code Organization
- **Single Responsibility:** Each module does one thing well
- **Dependency Injection:** Pass clients as parameters, don't hardcode
- **Configuration over Code:** Use env vars and config files

### Error Handling
```python
# Always handle specific errors
try:
    response = supabase.from('wines').select('*').execute()
except APIError as e:
    if e.code == '42501':  # Permission denied
        logger.error("RLS policy blocked access")
    raise

# Never swallow errors silently
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    raise  # Re-raise after logging
```

### Security
```python
# NEVER log credentials
url = f"https://cellartracker.com/xlquery.asp?User={user}&Password=***"
logger.info(f"Fetching from: {url}")  # Password hidden

# Use environment variables
CELLARTRACKER_USER = os.environ['CELLARTRACKER_USER']
CELLARTRACKER_PASSWORD = os.environ['CELLARTRACKER_PASSWORD']
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
```

### Data Integrity
```python
# Validate before loading
def validate_wine(wine: dict) -> bool:
    required = ['ct_wine_id', 'wine_name']
    return all(wine.get(field) for field in required)

# Count verification after migration
expected_count = len(source_data)
actual_count = supabase.from('wines').select('*', count='exact').execute().count
assert expected_count == actual_count, "Data count mismatch!"
```

### Idempotency
```python
# All operations should be safe to retry
# Use upsert with unique constraints
# Store sync timestamps to track state
```

---

## CellarTracker API Reference

### Endpoint
```
https://www.cellartracker.com/xlquery.asp
```

### Parameters
| Param | Value | Description |
|-------|-------|-------------|
| User | env var | CellarTracker username |
| Password | env var | CellarTracker password |
| Format | `csv` or `xml` | Use CSV for easier parsing |
| Table | `Bottles` or `List` | Bottles = bottle-level, List = wine-level |
| InStock | `0` or `1` | 0 = include consumed/lost (IMPORTANT) |

### BottleState Mapping
| Status | Meaning |
|--------|---------|
| 1 | In-Stock (active inventory) |
| 0 | Consumed or Lost |

### Example Request
```python
import requests

params = {
    'User': os.environ['CELLARTRACKER_USER'],
    'Password': os.environ['CELLARTRACKER_PASSWORD'],
    'Format': 'csv',
    'Table': 'List',  # or 'Bottles' for bottle-level
    'InStock': '0'    # Include consumed/lost
}

response = requests.get(
    'https://www.cellartracker.com/xlquery.asp',
    params=params
)
```

---

## Environment Variables

Create `.env` file (gitignored) with:

```bash
# CellarTracker credentials
CELLARTRACKER_USER=your_username
CELLARTRACKER_PASSWORD=your_password

# Supabase configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...  # For client-side
SUPABASE_SERVICE_KEY=eyJ...  # For server-side (NEVER expose)

# Gemini API (for enrichment)
GEMINI_API_KEY=your_gemini_key

# Environment
ENVIRONMENT=development  # or production
```

---

## Commands

```bash
# Run full CellarTracker sync
python scripts/sync.py

# Run specific migration
python scripts/migrate.py --migration 001_create_wines

# Validate data integrity
python scripts/validate_data.py

# Run tests
pytest tests/
```

---

## Key Files Reference

| File | Purpose | When to Read |
|------|---------|--------------|
| `PROGRESS.md` | Current status | START OF EVERY SESSION |
| `docs/DATA_MODEL.md` | Database schema | When writing SQL or queries |
| `docs/API_REQUIREMENTS.md` | Supabase patterns | When integrating with dashboard |
| `docs/DASHBOARD_INTEGRATION.md` | Dashboard contract | **SHARE WITH DASHBOARD CLAUDE** |
| `docs/GOTCHAS.md` | Edge cases & anomalies | When handling data quirks |
| `docs/CellarTracker_Data_Ingestion_Plan.md` | CT API details | When building extractor |
| `config/field_mappings.json` | CT → DB mappings | When parsing CT data |

---

## Cross-Project Communication

### Dashboard Project Location
```
C:\Users\mikep\Desktop\dashboard
```

### Interface Contract
The file `docs/DASHBOARD_INTEGRATION.md` defines the contract between this data layer and the dashboard. It includes:
- Breaking changes the dashboard must handle
- New Supabase API patterns (replacing Firebase)
- New fields and features available
- Migration checklist for dashboard

**When making changes that affect the dashboard API surface, update `docs/DASHBOARD_INTEGRATION.md`.**

---

## Common Pitfalls

### Data Layer
1. **Forgetting InStock=0** - Will miss consumed/lost bottles
2. **Using HTML instead of CSV API** - HTML is for display, use xlquery.asp
3. **Not batching upserts** - Will timeout with 400+ wines
4. **Logging passwords** - Security risk, mask in all logs
5. **Ignoring RLS** - Tables will appear empty without policies
6. **Not reading PROGRESS.md** - Will lose context between sessions
7. **Views not filtering in-stock** - Always add `quantity > 0` for user-facing queries (consumed wines don't need enrichment)

### Dashboard Integration
8. **Missing redirect params** - When redirecting to login, ALWAYS include `?redirect=currentPage.html` or user ends up at wrong page after login
9. **Login form flash** - Don't show login containers by default; start hidden (`display: none`), show only after auth check fails
10. **Hardcoded back links** - Use `document.referrer` to dynamically set back links when user could come from multiple pages
11. **Leftover SDK imports** - When removing Firebase/Supabase, check for leftover `<script>` tags AND all JS code using the old SDK

### Supabase Operations
12. **Supabase CLI doesn't run raw SQL** - Use Python + Supabase Management API instead:
```python
import requests
response = requests.post(
    f'https://api.supabase.com/v1/projects/{project_ref}/database/query',
    headers={'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'},
    json={'query': sql}
)
```
13. **Python venv on Windows** - Don't use `source .venv/Scripts/activate` in bash; use `python` directly if it's in PATH
14. **Supabase CLI auth** - CLI requires `SUPABASE_ACCESS_TOKEN`. Source .env first: `set -a && source .env && set +a && npx supabase ...`
15. **Edge Function auth** - Calling Edge Functions requires BOTH `Authorization: Bearer <jwt>` AND `apikey: <anon_key>` headers

### Deployment Workflow (CRITICAL)
16. **Always deploy to dev first** - Never deploy directly to production
17. **Ask before deploying to prod** - Get explicit user approval after dev is verified
