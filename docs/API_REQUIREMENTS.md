# Wine Data Layer - API Requirements

## Overview

This document defines the API endpoints and integration patterns for the wine collection system using Supabase. The API design prioritizes compatibility with the existing dashboard while enabling future enhancements.

---

## Supabase Client Configuration

### JavaScript Client Setup

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://[PROJECT_REF].supabase.co'
const supabaseAnonKey = '[ANON_KEY]'

const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Environment Variables

```
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_KEY]  # Server-side only
```

---

## API Endpoints

### 1. Wine Collection APIs

#### GET All Wines (with enrichments)

Replaces: `fetch('/wine_collection.json')`

```javascript
// Full collection with all enrichment data
const { data, error } = await supabase
    .from('v_wines_full')
    .select('*')
    .order('producer', { ascending: true })

// Response format matches current JSON structure
```

**Response Structure:**
```json
{
    "id": "4551101",
    "wine_name": "Antica Terra Pinot Noir Ceras",
    "vintage": "2021",
    "producer": "Antica Terra",
    "varietal": "Pinot Noir",
    "region": "Oregon",
    "country": "USA",
    "tasting_notes": {
        "appearance": "...",
        "nose": "...",
        "palate": "...",
        "finish": "...",
        "overall": "..."
    },
    "aroma_descriptors": ["Sour Cherry", "Forest Floor", ...],
    "flavor_descriptors": [...],
    "food_pairings": [{"dish": "...", "reason": "..."}],
    "characteristics": {"body": "Medium", ...},
    ...
}
```

#### GET Single Wine

```javascript
const { data, error } = await supabase
    .from('v_wines_full')
    .select('*')
    .eq('id', wineId)
    .single()
```

#### GET Wines with Filters

```javascript
// Filter by country
const { data, error } = await supabase
    .from('v_wines_full')
    .select('*')
    .eq('country', 'France')

// Filter by type and region
const { data, error } = await supabase
    .from('v_wines_full')
    .select('*')
    .eq('type', 'Red')
    .eq('region', 'Burgundy')

// Search by wine name or producer
const { data, error } = await supabase
    .from('v_wines_full')
    .select('*')
    .or(`wine_name.ilike.%${query}%,producer.ilike.%${query}%`)
```

#### GET Collection Metadata

```javascript
// Get counts for filters
const { count: totalWines } = await supabase
    .from('wines')
    .select('*', { count: 'exact', head: true })

// Get total bottle count
const { data } = await supabase
    .from('wines')
    .select('quantity')

const totalBottles = data.reduce((sum, w) => sum + w.quantity, 0)
```

---

### 2. Pull List APIs

#### GET Pull List

Replaces: Firebase RTDB read

```javascript
const { data, error } = await supabase
    .from('pull_list_items')
    .select(`
        id,
        wine_id,
        quantity,
        notes,
        added_at,
        wines (
            wine_name,
            vintage,
            producer,
            location,
            bin
        )
    `)
    .order('added_at', { ascending: false })
```

#### ADD to Pull List

Replaces: Firebase RTDB write

```javascript
const { data, error } = await supabase
    .from('pull_list_items')
    .upsert({
        wine_id: wineId,
        quantity: qty,
        notes: ''
    }, {
        onConflict: 'wine_id,user_id'
    })
    .select()
```

#### UPDATE Pull List Quantity

```javascript
const { data, error } = await supabase
    .from('pull_list_items')
    .update({ quantity: newQty })
    .eq('wine_id', wineId)
    .select()
```

#### REMOVE from Pull List

```javascript
const { error } = await supabase
    .from('pull_list_items')
    .delete()
    .eq('wine_id', wineId)
```

#### CLEAR Pull List

```javascript
const { error } = await supabase
    .from('pull_list_items')
    .delete()
    .neq('id', '')  // Delete all
```

#### Real-time Pull List Updates

Replaces: Firebase onValue listener

```javascript
const channel = supabase
    .channel('pull-list-changes')
    .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pull_list_items' },
        (payload) => {
            console.log('Pull list changed:', payload)
            // Refresh UI
        }
    )
    .subscribe()
```

---

### 3. Settings APIs

#### GET Settings

```javascript
const { data, error } = await supabase
    .from('app_settings')
    .select('*')

// Convert to object
const settings = Object.fromEntries(
    data.map(row => [row.key, row.value])
)
```

#### GET Demo Mode

```javascript
const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'demoMode')
    .single()

const demoMode = data?.value === true
```

#### UPDATE Setting

```javascript
const { error } = await supabase
    .from('app_settings')
    .upsert({
        key: 'demoMode',
        value: true,
        updated_at: new Date().toISOString()
    })
```

#### Real-time Settings Updates

```javascript
const channel = supabase
    .channel('settings-changes')
    .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        (payload) => {
            if (payload.new.key === 'demoMode') {
                toggleDemoMode(payload.new.value)
            }
        }
    )
    .subscribe()
```

---

### 4. Data Management APIs (Admin)

These APIs are for data pipeline operations, not dashboard use.

#### GET Wines Pending Enrichment

```javascript
const { data, error } = await supabase
    .from('v_wines_pending_enrichment')
    .select('*')
```

#### UPSERT Wine (CellarTracker Sync)

```javascript
const { error } = await supabase
    .from('wines')
    .upsert({
        ct_wine_id: wine.id,
        wine_name: wine.wine_name,
        vintage: wine.vintage,
        // ... other fields
        last_sync_at: new Date().toISOString()
    }, {
        onConflict: 'ct_wine_id'
    })
```

#### UPSERT Enrichment Data

```javascript
const { error } = await supabase
    .from('wine_enrichments')
    .upsert({
        wine_id: wineId,
        tasting_appearance: enrichment.tasting_notes.appearance,
        tasting_nose: enrichment.tasting_notes.nose,
        // ... other fields
        enrichment_status: 'completed',
        enriched_at: new Date().toISOString(),
        model_version: 'gemini-1.5-pro'
    })
```

#### BATCH Sync Wines

```javascript
// For syncing multiple wines from CellarTracker
const { error } = await supabase
    .from('wines')
    .upsert(winesArray, { onConflict: 'ct_wine_id' })
```

---

## Dashboard Integration Guide

### Migration Steps for index.html / mobile.html

#### Step 1: Add Supabase Client

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
    const supabase = supabase.createClient(
        'https://[PROJECT_REF].supabase.co',
        '[ANON_KEY]'
    );
</script>
```

#### Step 2: Replace Data Loading

**Before (Firebase/JSON):**
```javascript
async function loadWineData() {
    const response = await fetch('/wine_collection.json');
    const data = await response.json();
    wineData = data.wines;
}
```

**After (Supabase):**
```javascript
async function loadWineData() {
    const { data, error } = await supabase
        .from('v_wines_full')
        .select('*');

    if (error) {
        console.error('Error loading wines:', error);
        return;
    }

    wineData = data;
}
```

#### Step 3: Replace Pull List Sync

**Before (Firebase RTDB):**
```javascript
// Read
const pullListRef = ref(database, 'pullList');
onValue(pullListRef, (snapshot) => {
    markedForRemoval = snapshot.val() || {};
});

// Write
set(ref(database, 'pullList'), markedForRemoval);
```

**After (Supabase):**
```javascript
// Initial read
async function loadPullList() {
    const { data } = await supabase
        .from('pull_list_items')
        .select('wine_id, quantity');

    markedForRemoval = Object.fromEntries(
        data.map(item => [item.wine_id, item.quantity])
    );
}

// Real-time subscription
supabase
    .channel('pull-list')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pull_list_items' },
        () => loadPullList()
    )
    .subscribe();

// Write
async function savePullList(wineId, quantity) {
    if (quantity > 0) {
        await supabase
            .from('pull_list_items')
            .upsert({ wine_id: wineId, quantity });
    } else {
        await supabase
            .from('pull_list_items')
            .delete()
            .eq('wine_id', wineId);
    }
}
```

---

## Error Handling

### Standard Error Response

```javascript
const { data, error } = await supabase.from('wines').select('*')

if (error) {
    console.error('Database error:', error.message)
    // Show user-friendly error
    showToast('Failed to load wines. Please try again.')
    return
}
```

### Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `PGRST116` | No rows found | Handle empty state |
| `23505` | Unique constraint violation | Item already exists |
| `42501` | Permission denied | Check RLS policies |

---

## Performance Considerations

### 1. Use Select Projection

Only fetch fields you need:

```javascript
// Instead of select('*')
const { data } = await supabase
    .from('wines')
    .select('id, wine_name, producer, location, bin')
```

### 2. Pagination for Large Datasets

```javascript
const pageSize = 50
const { data } = await supabase
    .from('v_wines_full')
    .select('*')
    .range(page * pageSize, (page + 1) * pageSize - 1)
```

### 3. Client-Side Caching

```javascript
// Cache wine data locally
const CACHE_KEY = 'wine_collection'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getWines() {
    const cached = localStorage.getItem(CACHE_KEY)
    const cacheTime = localStorage.getItem(CACHE_KEY + '_time')

    if (cached && cacheTime && Date.now() - cacheTime < CACHE_TTL) {
        return JSON.parse(cached)
    }

    const { data } = await supabase.from('v_wines_full').select('*')
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    localStorage.setItem(CACHE_KEY + '_time', Date.now())

    return data
}
```

---

## Security Notes

1. **Anon Key**: Safe to expose in client-side code (RLS protects data)
2. **Service Role Key**: Server-side only, never in browser
3. **RLS Policies**: Ensure read-only public access for wines
4. **Settings Write**: Consider requiring authentication for demo mode toggle

---

## Testing Checklist

- [ ] All wines load correctly from `v_wines_full`
- [ ] Wine filters work (country, region, type, etc.)
- [ ] Pull list add/remove/update works
- [ ] Pull list real-time sync works across tabs/devices
- [ ] Demo mode toggle persists
- [ ] Error states handled gracefully
- [ ] Performance acceptable with 425+ wines
