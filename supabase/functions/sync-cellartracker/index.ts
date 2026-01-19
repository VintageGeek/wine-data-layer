// Supabase Edge Function: sync-cellartracker
// Pulls wine data from CellarTracker, upserts to Supabase, validates data

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const CELLARTRACKER_URL = "https://www.cellartracker.com/xlquery.asp";

// Bin capacity rules based on cellar storage layout
// Grid shelving: Columns A-E (left section) and F-J (right section), rows 1-19
// Overflow storage: Boxes above shelving (any bin not matching [A-J][1-19])
const GRID_CAPACITIES: Record<string, number> = {
  A: 6, B: 6, C: 6, D: 4, E: 2,
  F: 6, G: 6, H: 6, I: 4, J: 2,
};
const OVERFLOW_BOX_CAPACITY = 12;
// Storage names with no capacity limit (collections of multiple containers)
const NO_LIMIT_STORAGE = ["yellow box"];

// Check if bin is grid shelving (pattern: [A-J][1-19])
export function isGridBin(bin: string): boolean {
  if (!bin || bin.length < 2) return false;
  const match = bin.match(/^([A-Ja-j])(\d+)$/);
  if (!match) return false;
  const row = parseInt(match[2], 10);
  return row >= 1 && row <= 19;
}

// Get bin capacity from bin name
// Grid bins (A1-J19): column-specific capacity (6/4/2)
// No-limit storage: unlimited (returns 999)
// Overflow boxes (anything else): 12 bottles max
export function getBinCapacity(bin: string): number {
  if (!bin) return OVERFLOW_BOX_CAPACITY;
  if (NO_LIMIT_STORAGE.includes(bin.toLowerCase())) return 999;
  if (isGridBin(bin)) {
    const column = bin.charAt(0).toUpperCase();
    return GRID_CAPACITIES[column] ?? 6;
  }
  return OVERFLOW_BOX_CAPACITY;
}

// Field mappings: CellarTracker CSV -> Database columns
const WINE_FIELD_MAP: Record<string, string> = {
  iWine: "ct_wine_id",
  Wine: "wine_name",
  Vintage: "vintage",
  Producer: "producer",
  SortProducer: "sort_producer",
  Varietal: "varietal",
  MasterVarietal: "master_varietal",
  Designation: "designation",
  Vineyard: "vineyard",
  Country: "country",
  Region: "region",
  SubRegion: "sub_region",
  Appellation: "appellation",
  Locale: "locale",
  Type: "type",
  Color: "color",
  Category: "category",
  Size: "bottle_size",
  Location: "location",
  Bin: "bin",
  Price: "price",
  Valuation: "valuation",
  Currency: "currency",
  ExchangeRate: "exchange_rate",
  NativePrice: "native_price",
  NativePriceCurrency: "native_price_currency",
  StoreName: "store_name",
  PurchaseDate: "purchase_date",
  BeginConsume: "drink_date_min",
  EndConsume: "drink_date_max",
  Note: "personal_note",
  MY: "my_score",
  CT: "ct_score",
  CNotes: "ct_notes_count",
  PNotes: "personal_notes_count",
};

const BOTTLE_FIELD_MAP: Record<string, string> = {
  Barcode: "ct_bottle_id",
  iWine: "wine_id",
  BottleState: "bottle_state",
  Location: "location",
  Bin: "bin",
  Size: "bottle_size",
  Price: "price",
  StoreName: "store_name",
  PurchaseDate: "purchase_date",
  ConsumeDate: "consumed_date",
  ConsumeNote: "consumed_note",
};

// Critic score columns from CT
const CRITIC_SCORE_COLUMNS = [
  "WA", "WS", "IWC", "BH", "AG", "WE", "JR", "RH", "JG", "GV",
  "JK", "LD", "CW", "WFW", "PR", "SJ", "WD", "RR", "JH", "MFW",
  "WWR", "IWR", "CHG", "TT", "TWF", "DR", "FP", "JM", "PG", "WAL", "JS"
];

// Validation check types
interface ValidationCheck {
  name: string;
  status: "pass" | "fail" | "warning";
  severity: "critical" | "error" | "warning";
  count?: number;
  details?: string[];
}

// Parse CSV (handles quoted fields with commas)
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const record: Record<string, string> = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx];
      });
      records.push(record);
    }
  }
  return records;
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Convert CT date format (M/D/YYYY) to ISO format
export function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

// Parse numeric value
export function parseNumber(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

// Parse integer value
export function parseInt2(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}

// Fetch data from CellarTracker
async function fetchCellarTracker(
  user: string,
  password: string,
  table: "List" | "Bottles"
): Promise<string> {
  const params = new URLSearchParams({
    User: user,
    Password: password,
    Format: "csv",
    Table: table,
    InStock: "0", // Include consumed/lost
  });

  const response = await fetch(`${CELLARTRACKER_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`CellarTracker API error: ${response.status}`);
  }

  // CT returns latin-1 encoded data
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder("windows-1252");
  return decoder.decode(buffer);
}

// Map wine record from CT to database format
export function mapWineRecord(ctRecord: Record<string, string>): Record<string, unknown> {
  const wine: Record<string, unknown> = {};

  // Map standard fields
  for (const [ctField, dbField] of Object.entries(WINE_FIELD_MAP)) {
    if (ctRecord[ctField] !== undefined) {
      const value = ctRecord[ctField];

      // Handle special field types
      if (dbField === "ct_wine_id") {
        wine[dbField] = value;
      } else if (["price", "valuation", "exchange_rate", "native_price", "ct_score"].includes(dbField)) {
        wine[dbField] = parseNumber(value);
      } else if (["ct_notes_count", "personal_notes_count", "quantity"].includes(dbField)) {
        wine[dbField] = parseInt2(value);
      } else if (dbField === "purchase_date") {
        wine[dbField] = parseDate(value);
      } else {
        wine[dbField] = value || null;
      }
    }
  }

  // Handle quantity from CT's Quantity field
  if (ctRecord["Quantity"] !== undefined) {
    wine["quantity"] = parseInt2(ctRecord["Quantity"]);
  }

  // Collect critic scores into JSONB
  const criticScores: Record<string, number> = {};
  for (const col of CRITIC_SCORE_COLUMNS) {
    if (ctRecord[col] && ctRecord[col].trim() !== "") {
      const score = parseNumber(ctRecord[col]);
      if (score !== null) {
        criticScores[col] = score;
      }
    }
  }
  if (Object.keys(criticScores).length > 0) {
    wine["critic_scores"] = criticScores;
  }

  wine["last_sync_at"] = new Date().toISOString();

  return wine;
}

// Map bottle record from CT to database format
export function mapBottleRecord(ctRecord: Record<string, string>): Record<string, unknown> {
  const bottle: Record<string, unknown> = {};

  for (const [ctField, dbField] of Object.entries(BOTTLE_FIELD_MAP)) {
    if (ctRecord[ctField] !== undefined) {
      const value = ctRecord[ctField];

      if (dbField === "ct_bottle_id" || dbField === "wine_id") {
        bottle[dbField] = value;
      } else if (dbField === "bottle_state") {
        bottle[dbField] = parseInt2(value) ?? 1;
      } else if (dbField === "price") {
        bottle[dbField] = parseNumber(value);
      } else if (["purchase_date", "consumed_date"].includes(dbField)) {
        bottle[dbField] = parseDate(value);
      } else {
        bottle[dbField] = value || null;
      }
    }
  }

  bottle["last_sync_at"] = new Date().toISOString();

  return bottle;
}

// Run validation checks after sync
async function runValidation(supabase: SupabaseClient): Promise<ValidationCheck[]> {
  const checks: ValidationCheck[] = [];

  // 1. Wine count > 0
  const { count: wineCount } = await supabase
    .from("wines")
    .select("*", { count: "exact", head: true });

  checks.push({
    name: "wine_count",
    status: (wineCount ?? 0) > 0 ? "pass" : "fail",
    severity: "critical",
    count: wineCount ?? 0,
  });

  // 2. Bottle count > 0
  const { count: bottleCount } = await supabase
    .from("bottles")
    .select("*", { count: "exact", head: true });

  checks.push({
    name: "bottle_count",
    status: (bottleCount ?? 0) > 0 ? "pass" : "fail",
    severity: "critical",
    count: bottleCount ?? 0,
  });

  // 3. Orphan bottles (bottles without matching wine)
  // Fetch all wine IDs with pagination (to handle >1000 rows)
  const allWineIds = new Set<string>();
  let wineOffset = 0;
  while (true) {
    const { data: winesBatch } = await supabase
      .from("wines")
      .select("ct_wine_id")
      .range(wineOffset, wineOffset + 999);
    if (!winesBatch || winesBatch.length === 0) break;
    for (const w of winesBatch) {
      allWineIds.add(w.ct_wine_id);
    }
    if (winesBatch.length < 1000) break;
    wineOffset += 1000;
  }

  // Fetch all bottle wine_ids with pagination
  const orphans: { wine_id: string }[] = [];
  let bottleOffset = 0;
  while (true) {
    const { data: bottlesBatch } = await supabase
      .from("bottles")
      .select("wine_id")
      .range(bottleOffset, bottleOffset + 999);
    if (!bottlesBatch || bottlesBatch.length === 0) break;
    for (const b of bottlesBatch) {
      if (!allWineIds.has(b.wine_id)) {
        orphans.push(b);
      }
    }
    if (bottlesBatch.length < 1000) break;
    bottleOffset += 1000;
  }

  checks.push({
    name: "orphan_bottles",
    status: orphans.length === 0 ? "pass" : "fail",
    severity: "error",
    count: orphans.length,
    details: orphans.length > 0 ? orphans.slice(0, 5).map(b => b.wine_id) : undefined,
  });

  // 4. Location anomalies (in-stock bottles with location = 'none' or empty)
  const { data: locationIssues } = await supabase
    .from("bottles")
    .select("ct_bottle_id, location")
    .eq("bottle_state", 1)
    .or("location.eq.none,location.is.null,location.eq.");

  checks.push({
    name: "location_anomalies",
    status: (locationIssues?.length ?? 0) === 0 ? "pass" : "warning",
    severity: "warning",
    count: locationIssues?.length ?? 0,
  });

  // 5. Bin overcapacity (bins exceeding column-specific capacity)
  // Capacities: A,B,C,F,G,H = 6 | D,I = 4 | E,J = 2
  // Fetch all in-stock bottles with pagination
  const binCounts = new Map<string, { count: number; capacity: number }>();
  let binOffset = 0;
  while (true) {
    const { data: binBatch } = await supabase
      .from("bottles")
      .select("location, bin")
      .eq("bottle_state", 1)
      .range(binOffset, binOffset + 999);
    if (!binBatch || binBatch.length === 0) break;
    for (const bottle of binBatch) {
      if (bottle.location && bottle.bin) {
        const key = `${bottle.location}:${bottle.bin}`;
        const existing = binCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          binCounts.set(key, { count: 1, capacity: getBinCapacity(bottle.bin) });
        }
      }
    }
    if (binBatch.length < 1000) break;
    binOffset += 1000;
  }

  const overcapacityBins = Array.from(binCounts.entries())
    .filter(([_, data]) => data.count > data.capacity)
    .map(([bin, data]) => `${bin} (${data.count}/${data.capacity})`);

  checks.push({
    name: "bin_overcapacity",
    status: overcapacityBins.length === 0 ? "pass" : "warning",
    severity: "warning",
    count: overcapacityBins.length,
    details: overcapacityBins.length > 0 ? overcapacityBins.slice(0, 10) : undefined,
  });

  // 6. Encoding issues (wine names with replacement character)
  const { data: encodingIssues } = await supabase
    .from("wines")
    .select("ct_wine_id, wine_name")
    .like("wine_name", "%�%");

  checks.push({
    name: "encoding_issues",
    status: (encodingIssues?.length ?? 0) === 0 ? "pass" : "warning",
    severity: "warning",
    count: encodingIssues?.length ?? 0,
    details: encodingIssues?.slice(0, 5).map(w => w.wine_name),
  });

  return checks;
}

// Main handler function (exported for testing)
export async function handleRequest(req: Request): Promise<Response> {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const syncedAt = new Date().toISOString();
  let supabase: SupabaseClient | null = null;

  try {
    // Get credentials from secrets
    const ctUser = Deno.env.get("CELLARTRACKER_USER");
    const ctPassword = Deno.env.get("CELLARTRACKER_PASSWORD");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ctUser || !ctPassword) {
      throw new Error("CellarTracker credentials not configured");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    // Create Supabase client with service role
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Fetching wine list from CellarTracker...");

    // Fetch wine list (for critic scores and wine-level data)
    const listCsv = await fetchCellarTracker(ctUser, ctPassword, "List");
    const listRecords = parseCSV(listCsv);
    console.log(`Parsed ${listRecords.length} wines from List`);

    // Fetch bottles (for bottle-level data with consumption history)
    console.log("Fetching bottles from CellarTracker...");
    const bottlesCsv = await fetchCellarTracker(ctUser, ctPassword, "Bottles");
    const bottleRecords = parseCSV(bottlesCsv);
    console.log(`Parsed ${bottleRecords.length} bottles`);

    // Map wine records
    const wines = listRecords.map(mapWineRecord).filter(w => w.ct_wine_id);

    // Map bottle records
    const bottles = bottleRecords.map(mapBottleRecord).filter(b => b.ct_bottle_id && b.wine_id);

    // Get unique wine IDs from bottles (for wines not in List but have bottles)
    const wineIdsFromList = new Set(wines.map(w => w.ct_wine_id as string));

    // Create minimal wine records for any wines in bottles but not in list
    // (consumed wines may drop off the List export)
    const bottlesByWine = new Map<string, Record<string, unknown>[]>();
    for (const bottle of bottleRecords) {
      const wineId = bottle.iWine;
      if (wineId && !wineIdsFromList.has(wineId)) {
        if (!bottlesByWine.has(wineId)) {
          bottlesByWine.set(wineId, []);
        }
        bottlesByWine.get(wineId)!.push(bottle);
      }
    }

    // Create wine records from bottle data for missing wines
    for (const [wineId, wineBottles] of bottlesByWine) {
      const firstBottle = wineBottles[0] as Record<string, string>;
      const wineFromBottle: Record<string, unknown> = {
        ct_wine_id: wineId,
        wine_name: firstBottle.Wine || "Unknown",
        vintage: firstBottle.Vintage || null,
        producer: firstBottle.Producer || null,
        varietal: firstBottle.Varietal || null,
        country: firstBottle.Country || null,
        region: firstBottle.Region || null,
        type: firstBottle.Type || null,
        color: firstBottle.Color || null,
        quantity: 0, // Consumed wines have 0 quantity
        last_sync_at: new Date().toISOString(),
      };
      wines.push(wineFromBottle);
    }

    console.log(`Upserting ${wines.length} wines...`);

    // Upsert wines in batches
    const BATCH_SIZE = 100;
    let winesUpserted = 0;

    for (let i = 0; i < wines.length; i += BATCH_SIZE) {
      const batch = wines.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("wines")
        .upsert(batch, { onConflict: "ct_wine_id" });

      if (error) {
        console.error(`Wine batch error:`, error);
        throw new Error(`Failed to upsert wines: ${error.message}`);
      }
      winesUpserted += batch.length;
    }

    console.log(`Upserting ${bottles.length} bottles...`);

    // Upsert bottles in batches
    let bottlesUpserted = 0;

    for (let i = 0; i < bottles.length; i += BATCH_SIZE) {
      const batch = bottles.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("bottles")
        .upsert(batch, { onConflict: "ct_bottle_id" });

      if (error) {
        console.error(`Bottle batch error:`, error);
        throw new Error(`Failed to upsert bottles: ${error.message}`);
      }
      bottlesUpserted += batch.length;
    }

    // Run validation checks
    console.log("Running validation checks...");
    const validationChecks = await runValidation(supabase);

    // Determine overall status
    const hasCriticalFail = validationChecks.some(c => c.severity === "critical" && c.status === "fail");
    const hasError = validationChecks.some(c => c.severity === "error" && c.status === "fail");
    const overallStatus = hasCriticalFail ? "failed" : hasError ? "partial" : "success";

    // Get final counts
    const { count: totalWines } = await supabase
      .from("wines")
      .select("*", { count: "exact", head: true });

    const { count: totalBottles } = await supabase
      .from("bottles")
      .select("*", { count: "exact", head: true });

    const { count: inStockBottles } = await supabase
      .from("bottles")
      .select("*", { count: "exact", head: true })
      .eq("bottle_state", 1);

    // Store sync result
    const { error: insertError } = await supabase.from("sync_results").insert({
      synced_at: syncedAt,
      source: "cellartracker",
      status: overallStatus,
      wines_synced: winesUpserted,
      bottles_synced: bottlesUpserted,
      validation: { checks: validationChecks },
    });

    if (insertError) {
      console.error("Failed to store sync result:", insertError);
    }

    const result = {
      success: true,
      synced_at: syncedAt,
      status: overallStatus,
      wines_upserted: winesUpserted,
      bottles_upserted: bottlesUpserted,
      totals: {
        wines: totalWines,
        bottles: totalBottles,
        in_stock: inStockBottles,
        consumed: (totalBottles ?? 0) - (inStockBottles ?? 0),
      },
      validation: validationChecks,
    };

    console.log("Sync complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Sync error:", error);

    // Store failed sync result
    if (supabase) {
      try {
        await supabase.from("sync_results").insert({
          synced_at: syncedAt,
          source: "cellartracker",
          status: "failed",
          wines_synced: 0,
          bottles_synced: 0,
          error_message: error instanceof Error ? error.message : "Unknown error",
        });
      } catch (insertErr) {
        console.error("Failed to store error result:", insertErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

// Start server when run directly (not when imported for tests)
if (import.meta.main) {
  Deno.serve(handleRequest);
}
