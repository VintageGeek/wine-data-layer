// Supabase Edge Function: sync-cellartracker
// Pulls wine data from CellarTracker and upserts to Supabase

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CELLARTRACKER_URL = "https://www.cellartracker.com/xlquery.asp";

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

// Parse CSV (handles quoted fields with commas)
function parseCSV(text: string): Record<string, string>[] {
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

function parseCSVLine(line: string): string[] {
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
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

// Parse numeric value
function parseNumber(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

// Parse integer value
function parseInt2(val: string): number | null {
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
function mapWineRecord(ctRecord: Record<string, string>): Record<string, unknown> {
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
function mapBottleRecord(ctRecord: Record<string, string>): Record<string, unknown> {
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

// Main handler
Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const wineIdsFromBottles = new Set(bottles.map(b => b.wine_id as string));
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

    const result = {
      success: true,
      synced_at: new Date().toISOString(),
      wines_upserted: winesUpserted,
      bottles_upserted: bottlesUpserted,
      totals: {
        wines: totalWines,
        bottles: totalBottles,
        in_stock: inStockBottles,
        consumed: (totalBottles ?? 0) - (inStockBottles ?? 0),
      },
    };

    console.log("Sync complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Sync error:", error);
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
});
