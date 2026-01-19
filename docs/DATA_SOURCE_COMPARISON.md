# CellarTracker Data Source Comparison

## Summary

| Source | Records | Columns | Consumption History | Recommendation |
|--------|---------|---------|---------------------|----------------|
| **HTML file** | 878 bottles | 67 | No | Don't use |
| **CSV Table=List** | 425 wines | 66 | No | Use for wine-level aggregates |
| **CSV Table=Bottles** | 2,373 bottles | 36 | Yes | **Use for full history** |

---

## Your Data At a Glance

| Metric | Count |
|--------|-------|
| Total bottles ever tracked | 2,373 |
| Currently in stock | 878 |
| Consumed/Lost | 1,495 |
| Unique wines (ever owned) | 1,229 |
| Unique wines (in stock) | 425 |

### Consumption Breakdown
| Type | Count |
|------|-------|
| Drank from my cellar | 1,479 |
| Missing or presumed drunk | 9 |
| Restaurant purchase | 5 |
| Gave away as a gift | 1 |
| Donated | 1 |

---

## Detailed Comparison

### 1. HTML File (cellartracker_raw.html)
- **What it is:** Browser export from CellarTracker "List Wines" page
- **Records:** 878 (individual bottles, in-stock only)
- **Columns:** 67 (includes all critic scores)
- **Limitations:**
  - No BottleState column
  - No consumption dates or history
  - Only shows current inventory
  - Cannot track what was consumed/lost
- **Verdict:** ❌ **Don't use** - Missing critical history data

### 2. CSV Table=List (xlquery.asp)
- **What it is:** Wine-level aggregate data via API
- **Records:** 425 (one row per wine, not per bottle)
- **Columns:** 66 (includes critic scores, aggregated quantity)
- **Key fields:** Quantity (aggregate), all critic scores
- **Limitations:**
  - Only wines with Quantity > 0
  - No individual bottle tracking
  - No consumption history
- **Verdict:** ⚠️ **Use selectively** - Good for critic scores and aggregates

### 3. CSV Table=Bottles (xlquery.asp) ✅ RECOMMENDED
- **What it is:** Bottle-level history via API
- **Records:** 2,373 (one row per bottle ever)
- **Columns:** 36 (no critic scores, but has consumption data)
- **Key fields:**
  - `BottleState`: 1 = In Stock, 0 = Consumed/Lost
  - `ConsumptionDate`: When consumed
  - `ConsumptionType`: How consumed (drank, gift, lost, etc.)
  - `ConsumptionNote`: User notes on consumption
  - `Barcode`: Unique bottle identifier
- **Limitations:**
  - Fewer columns (no critic scores)
  - Larger dataset
- **Verdict:** ✅ **Primary data source** - Has full history you need

---

## Recommended Strategy

### Use Both CSV Sources Together

```
Table=Bottles (Primary)     Table=List (Secondary)
├── All bottle history      ├── Critic scores (WA, WS, JS, etc.)
├── BottleState tracking    ├── CT community score
├── Consumption dates       └── Aggregate valuations
├── Individual barcodes
└── Location/bin per bottle
```

### Database Design

```sql
-- wines table: Populated from Table=List
-- Contains: critic scores, CT score, aggregate data

-- bottles table: Populated from Table=Bottles
-- Contains: individual bottle history, consumption tracking
-- Links to wines via iWine (ct_wine_id)
```

### Sync Strategy

1. **Initial load:**
   - Pull `Table=List` → populate `wines` table (critic scores)
   - Pull `Table=Bottles&InStock=0` → populate `bottles` table (full history)

2. **Ongoing sync:**
   - Pull `Table=Bottles&InStock=0` regularly
   - Upsert on Barcode (bottle-level) or iWine (wine-level)
   - New bottles = additions to cellar
   - BottleState 1→0 = consumption/loss

---

## Sample Records

### In-Stock Bottle (BottleState=1)
```
Barcode: 0180102492
iWine: 4280294
Wine: Abbott Claim Chardonnay Eola - Amity Hills
Vintage: 2019
Location: SWS
BottleState: 1 (In Stock)
```

### Consumed Bottle (BottleState=0)
```
Barcode: 0069545385
iWine: 2495747
Wine: Guardian Cellars Cabernet Sauvignon Felony
Vintage: 2012
Location: Cellar (was R1)
PurchaseDate: 11/1/2015
ConsumptionDate: 9/8/2019
ConsumptionType: Drank from my cellar
BottleState: 0 (Consumed)
```

---

## Action Items

1. ✅ Use `Table=Bottles&InStock=0` as primary data source
2. ✅ Use `Table=List` to get critic scores (join on iWine)
3. ❌ Discard HTML file - it's a subset with no history
4. Update DATA_MODEL.md to reflect bottles as primary table
