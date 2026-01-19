# Dashboard Integration Guide

> **For:** Claude agents working on `C:\Users\mikep\Desktop\dashboard`
> **From:** Wine Data Layer (`C:\Users\mikep\Desktop\wine-data-layer`)
> **Last Updated:** 2026-01-18

---

## Overview

The data layer is migrating from Firebase/static JSON to Supabase. This document defines the interface contract between the data layer and dashboard.

**Dashboard CLAUDE.md should reference this file for data integration.**

---

## Breaking Changes

### 1. Data Source Change

| Before | After |
|--------|-------|
| `fetch('/wine_collection.json')` | `supabase.from('v_wines_full').select('*')` |
| Firebase RTDB for pull list | Supabase `pull_list_items` table |
| Firebase RTDB for settings | Supabase `app_settings` table |

### 2. Required: Add Supabase Client

```html
<!-- Add to index.html, mobile.html, settings.html -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const SUPABASE_URL = 'https://[PROJECT_REF].supabase.co';
  const SUPABASE_ANON_KEY = '[ANON_KEY]';
  const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
</script>
```

### 3. Real-Time Sync Pattern Change

**Before (Firebase):**
```javascript
import { ref, onValue } from 'firebase/database';
const pullListRef = ref(database, 'pullList');
onValue(pullListRef, (snapshot) => {
  markedForRemoval = snapshot.val() || {};
});
```

**After (Supabase):**
```javascript
// Initial load
const { data } = await supabase.from('pull_list_items').select('wine_id, quantity');
markedForRemoval = Object.fromEntries(data.map(r => [r.wine_id, r.quantity]));

// Real-time subscription
supabase
  .channel('pull-list-changes')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'pull_list_items' },
    () => loadPullList()  // Reload on any change
  )
  .subscribe();
```

---

## Data Schema Changes

### New Fields Available

| Field | Type | Description |
|-------|------|-------------|
| `sort_producer` | string | Sortable producer name ("Drouhin, Joseph") |
| `master_varietal` | string | Parent varietal category |
| `barcode` | string | CellarTracker bottle ID |
| `store_name` | string | Where purchased |
| `exchange_rate` | number | Currency exchange rate |
| `native_price` | number | Original purchase price |
| `native_price_currency` | string | Original currency |
| `personal_note` | string | User's CT notes |
| `my_score` | string | User's personal score |
| `ct_score` | number | CellarTracker community score |
| `ct_notes_count` | number | Number of community notes |
| `critic_scores` | object | All critic scores as JSON |

### Critic Scores Object

```javascript
wine.critic_scores = {
  "WA": "95",      // Wine Advocate (Robert Parker)
  "WS": "93",      // Wine Spectator
  "JS": "94",      // James Suckling
  "AG": "94+",     // Antonio Galloni (Vinous)
  "BH": "92",      // Burghound
  "JR": "17.5",    // Jancis Robinson (20-point scale)
  // ... up to 31 critics
}
```

**Display example:**
```javascript
function formatCriticScores(scores) {
  if (!scores || Object.keys(scores).length === 0) return 'No scores';
  return Object.entries(scores)
    .map(([critic, score]) => `${critic}: ${score}`)
    .join(', ');
}
```

### Unchanged Fields

These fields work exactly as before:
- `id`, `wine_name`, `vintage`, `producer`, `varietal`
- `region`, `country`, `appellation`, `locale`, `sub_region`
- `type`, `color`, `category`, `bottle_size`
- `quantity`, `price`, `valuation`, `currency`
- `location`, `bin`, `designation`, `vineyard`
- `drink_date_min`, `drink_date_max`
- `tasting_notes`, `characteristics`
- `aroma_descriptors`, `flavor_descriptors`, `food_pairings`
- `aging_potential`, `serving_suggestions`

---

## New Features Available

### 1. Consumption History (bottles table)

The data layer now tracks individual bottles and consumption:

```javascript
// Get consumption history
const { data: consumed } = await supabase
  .from('bottles')
  .select('*')
  .eq('bottle_state', 0)  // 0 = consumed
  .order('consumed_date', { ascending: false });

// Each consumed bottle has:
// - consumed_date: when consumed
// - consumption_type: "Drank from my cellar", "Gave away", etc.
// - consumption_note: user notes
```

### 2. Data Anomalies View

Bottles needing user attention (e.g., invalid location):

```javascript
const { data: issues } = await supabase
  .from('v_bottles_needing_review')
  .select('*');

// Returns bottles with:
// - issue_type: "Invalid location", "Missing location"
// - wine_name, vintage, producer for display
```

**Recommended UI:** Add a "Needs Attention" badge/section showing these anomalies.

### 3. Collection Statistics

```javascript
const { data: stats } = await supabase
  .from('v_collection_stats')
  .select('*')
  .single();

// Returns:
// - total_wines
// - total_bottles
// - total_value
// - countries (count)
// - producers (count)
// - varietals (count)
```

---

## API Reference

### Fetch All Wines (replaces JSON load)

```javascript
async function loadWineData() {
  const { data, error } = await supabase
    .from('v_wines_full')
    .select('*')
    .order('producer', { ascending: true });

  if (error) {
    console.error('Failed to load wines:', error);
    return [];
  }
  return data;
}
```

### Pull List Operations

```javascript
// Add to pull list
async function addToPullList(wineId, quantity) {
  await supabase.from('pull_list_items').upsert({
    wine_id: wineId,
    quantity: quantity
  }, { onConflict: 'wine_id,user_id' });
}

// Remove from pull list
async function removeFromPullList(wineId) {
  await supabase.from('pull_list_items')
    .delete()
    .eq('wine_id', wineId);
}

// Clear entire pull list
async function clearPullList() {
  await supabase.from('pull_list_items').delete().neq('id', '');
}
```

### Settings Operations

```javascript
// Get demo mode
async function getDemoMode() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'demoMode')
    .single();
  return data?.value === true;
}

// Set demo mode
async function setDemoMode(enabled) {
  await supabase.from('app_settings').upsert({
    key: 'demoMode',
    value: enabled
  });
}
```

---

## Migration Checklist for Dashboard

When integrating with Supabase:

- [ ] Add Supabase JS client script
- [ ] Add Supabase URL and anon key (get from data layer team)
- [ ] Replace `fetch('/wine_collection.json')` with Supabase query
- [ ] Replace Firebase RTDB pull list with Supabase
- [ ] Replace Firebase RTDB settings with Supabase
- [ ] Update real-time listeners to use Supabase channels
- [ ] Test demo mode toggle
- [ ] Test pull list sync across tabs/devices
- [ ] Add "Needs Attention" section for anomalies (optional)
- [ ] Add critic scores display (optional)
- [ ] Add consumption history view (optional)
- [ ] Remove Firebase SDK imports
- [ ] Update both index.html AND mobile.html

---

## Edge Cases to Handle

### 1. Vintage "1001" = Non-Vintage
Already handled in current dashboard. No change needed.

### 2. Empty Tasting Notes
Some consumed wines may not have enrichment data:
```javascript
const hasTastingNotes = wine.tasting_notes?.appearance != null;
```

### 3. Null Critic Scores
```javascript
const hasScores = wine.critic_scores && Object.keys(wine.critic_scores).length > 0;
```

---

## Environment Configuration

Dashboard needs these values (provided by data layer):

```javascript
// Will be provided after Supabase project creation
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

**Do NOT commit these to git.** Use environment-specific config or a gitignored config file.

---

## Questions?

Refer to wine-data-layer documentation:
- `docs/API_REQUIREMENTS.md` - Full API patterns
- `docs/DATA_MODEL.md` - Complete schema
- `docs/GOTCHAS.md` - Known edge cases
- `PROGRESS.md` - Current migration status
