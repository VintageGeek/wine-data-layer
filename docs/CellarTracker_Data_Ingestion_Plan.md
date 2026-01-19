# Specification: CellarTracker Full Historical Data Sync

## 1. Project Overview
This module is responsible for programmatically extracting the entire wine history (In-Stock, Consumed, and Lost) from a user's CellarTracker account and preparing the data for ingestion into Supabase. 

## 2. Requirements
- **Language/Environment:** Node.js or Python (as per project standards).
- **Authentication:** Use environment variables for `CELLARTRACKER_USER` and `CELLARTRACKER_PASSWORD`.
- **Data Completeness:** Must include "Consumed" and "Lost" bottles, not just current inventory.
- **Resilience:** Handle potential legacy XML/CSV format quirks and timeouts.

## 3. Data Extraction (CellarTracker Legacy API)

### Connection Details
The "API" is a legacy XML/CSV query interface. To retrieve the full dataset including consumed/lost items, the agent must perform a GET request to the following endpoint:

- **Endpoint:** `https://www.cellartracker.com/xlquery.asp`
- **Required Parameters:**
    - `User`: From environment.
    - `Password`: From environment.
    - `Format`: `csv` (recommended for easier parsing) or `xml`.
    - `Table`: `Bottles` (Mandatory for bottle-level history) or `List` (for wine-level).
    - `InStock`: `0` (Critical to ensure non-active inventory is included).

### Logic Logic
1.  **Full Snapshot:** Since CellarTracker does not support delta pulls, the agent must fetch the entire historical CSV on every sync.
2.  **State Mapping:** - In the `Table=Bottles` export, identify the `BottleState` or `Status` column.
    - Status `1` = In-Stock.
    - Status `0` = Consumed/Lost.

## 4. Supabase Integration (Claude Code Handoff)

**Task for AI Agent:**
Implement the logic to bridge the extracted CellarTracker CSV data with our Supabase backend. 

### Instructions:
1.  **Schema Design:** - Verify if the existing `wines` or `inventory` tables in Supabase match the CellarTracker export headers.
    - Ensure there is a unique constraint on `WineID` or `BottleID` to prevent duplicates.
2.  **Upsert Strategy:** - Implement a `upsert` (update-on-conflict) operation. 
    - If a `BottleID` exists, update its status (e.g., if it moved from "In-Stock" to "Consumed").
    - If a `BottleID` is new, create the record.
3.  **Client Implementation:**
    - Use `@supabase/supabase-js` (if Node) or `supabase-py` (if Python).
    - Batch the upserts (e.g., chunks of 100-200) to optimize performance for the 400+ wine collection.

## 5. Security & Constraints
- **Do Not Log Credentials:** Ensure the request URL (containing the password) is never logged to stdout or saved in any `.log` files.
- **Rate Limiting:** Implement a basic cooldown if the sync is triggered frequently.