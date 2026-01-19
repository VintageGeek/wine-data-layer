# Known Gotchas & Edge Cases

## Critical Issues

### 1. Consumed Wines Missing Critic Scores

**Problem:** Table=List only returns wines with Quantity > 0. Fully consumed wines (804 of 1,229) have no critic score data available via API.

**Impact:** Cannot display WA/WS/JS scores for historical wines.

**Options:**
1. Accept missing scores for consumed wines
2. Cache critic scores permanently when wine first enters cellar
3. Check if CellarTracker has an API to query individual wine scores

**Recommendation:** Option 2 - On first sync, store critic scores in `wines` table. On subsequent syncs, only UPDATE scores if wine still has Quantity > 0, never DELETE existing scores.

```sql
-- Preserve existing critic scores for consumed wines
UPDATE wines SET
  critic_scores = COALESCE(NULLIF(new_scores, '{}'), critic_scores),
  -- other fields...
WHERE ct_wine_id = $1;
```

---

### 2. Character Encoding

**Problem:** CellarTracker exports use `latin-1` (Windows-1252), not UTF-8.

**Affected:** 231 wines with French/German characters:
- Côte de Nuits → C�te de Nuits (if parsed as UTF-8)
- Château → Ch�teau
- Müller-Thurgau → M�ller-Thurgau

**Solution:**
```python
# Always read CT files as latin-1
with open(filepath, 'r', encoding='latin-1') as f:
    data = f.read()

# Convert to UTF-8 for database storage
data_utf8 = data.encode('utf-8').decode('utf-8')
```

---

## Minor Issues

### 3. Date Format (M/D/YYYY)

**Problem:** Dates are not ISO format.
- `1/5/2025` (January 5th)
- `12/25/2025` (December 25th)

**Solution:**
```python
from datetime import datetime

def parse_ct_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%m/%d/%Y').date()
    except ValueError:
        return None
```

---

### 4. Vintage "1001" = Non-Vintage

**Problem:** CellarTracker uses vintage year "1001" to indicate NV (Non-Vintage) wines, typically Champagne.

**Solution:**
```python
def normalize_vintage(vintage):
    if vintage == '1001':
        return 'NV'
    return vintage
```

```sql
-- In views, display NV properly
CASE vintage WHEN '1001' THEN 'NV' ELSE vintage END AS display_vintage
```

---

### 5. Location "none" - DATA ANOMALY

**Problem:** Some bottles have `Location = "none"` (string literal). This is NOT normal - all bottles should have a valid cellar location.

**Count:** 1 bottle currently (Joseph Drouhin Meursault 2018)

**This is NOT the same as unassigned.** This indicates:
- Data entry error in CellarTracker
- Bottle needs to be located and updated
- Should be flagged for user review

**Solution:** Flag in UI for review, do NOT silently ignore:
```sql
-- View to find anomalies
CREATE VIEW v_bottles_needing_review AS
SELECT * FROM bottles
WHERE bottle_state = 1
  AND (location = 'none' OR location IS NULL OR location = '');
```

**UI Handling:**
- Show warning/badge on bottles with location="none"
- Add to a "Needs Attention" dashboard section
- Prompt user to update location in CellarTracker

---

## Data Quality Summary

| Check | Result |
|-------|--------|
| Total bottles | 2,373 |
| Unique barcodes | 2,373 (100% unique) |
| Empty barcodes | 0 |
| Quantity mismatches | 0 |
| Null critical fields | 0 |
| Non-standard vintages | 1 ("1001" = NV) |
| Encoding issues | 231 wines need latin-1 |
| Date format issues | 0 (consistent M/D/YYYY) |
| Location anomalies | 1 (needs review) |

---

## Sync Edge Cases

### New Wine Added
- Appears in both Table=List and Table=Bottles
- Has critic scores from Table=List
- Needs enrichment (Gemini)

### Wine Fully Consumed
- Disappears from Table=List (Quantity = 0)
- Still in Table=Bottles with BottleState = 0
- **Preserve existing critic scores!**

### Bottle Consumed (partial)
- Wine still in Table=List (Quantity reduced)
- Bottle row changes: BottleState 1 → 0, ConsumptionDate populated
- Update bottle record, not wine record

### Wine Quantity Increased (purchase)
- New bottles appear in Table=Bottles with new Barcodes
- Wine quantity in Table=List increases
- Insert new bottle records

---

## Testing Checklist

Before going live, verify:

- [ ] Latin-1 encoding handled correctly
- [ ] Dates parse correctly (M/D/YYYY)
- [ ] Vintage "1001" displays as "NV"
- [ ] Consumed wines keep their critic scores
- [ ] French/German wine names display correctly
- [ ] Location "none" handled as empty
- [ ] Bottle sizes (375ml, 750ml, 1.5L) stored correctly
