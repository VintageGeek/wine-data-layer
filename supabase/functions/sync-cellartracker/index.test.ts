// Tests for sync-cellartracker helper functions
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  parseCSV,
  parseCSVLine,
  parseDate,
  parseNumber,
  parseInt2,
  mapWineRecord,
  mapBottleRecord,
} from "./index.ts";

Deno.test("parseCSVLine - simple fields", () => {
  const result = parseCSVLine("a,b,c");
  assertEquals(result, ["a", "b", "c"]);
});

Deno.test("parseCSVLine - quoted fields with commas", () => {
  const result = parseCSVLine('a,"b,c",d');
  assertEquals(result, ["a", "b,c", "d"]);
});

Deno.test("parseCSVLine - escaped quotes", () => {
  const result = parseCSVLine('a,"b""c",d');
  assertEquals(result, ["a", 'b"c', "d"]);
});

Deno.test("parseCSVLine - trims whitespace", () => {
  const result = parseCSVLine("  a  ,  b  ,  c  ");
  assertEquals(result, ["a", "b", "c"]);
});

Deno.test("parseCSV - parses header and rows", () => {
  const csv = "col1,col2\nval1,val2\nval3,val4";
  const result = parseCSV(csv);
  assertEquals(result.length, 2);
  assertEquals(result[0], { col1: "val1", col2: "val2" });
  assertEquals(result[1], { col1: "val3", col2: "val4" });
});

Deno.test("parseCSV - handles empty input", () => {
  assertEquals(parseCSV(""), []);
  assertEquals(parseCSV("header"), []);
});

Deno.test("parseCSV - skips rows with wrong column count", () => {
  const csv = "a,b,c\n1,2,3\n4,5\n6,7,8";
  const result = parseCSV(csv);
  assertEquals(result.length, 2);
});

Deno.test("parseDate - converts M/D/YYYY to ISO", () => {
  assertEquals(parseDate("1/5/2025"), "2025-01-05");
  assertEquals(parseDate("12/25/2025"), "2025-12-25");
});

Deno.test("parseDate - handles empty/null", () => {
  assertEquals(parseDate(""), null);
  assertEquals(parseDate("   "), null);
});

Deno.test("parseDate - handles invalid format", () => {
  assertEquals(parseDate("2025-01-05"), null);
  assertEquals(parseDate("not-a-date"), null);
});

Deno.test("parseNumber - parses floats", () => {
  assertEquals(parseNumber("123.45"), 123.45);
  assertEquals(parseNumber("0"), 0);
});

Deno.test("parseNumber - handles empty/invalid", () => {
  assertEquals(parseNumber(""), null);
  assertEquals(parseNumber("   "), null);
  assertEquals(parseNumber("abc"), null);
});

Deno.test("parseInt2 - parses integers", () => {
  assertEquals(parseInt2("123"), 123);
  assertEquals(parseInt2("0"), 0);
});

Deno.test("parseInt2 - handles empty/invalid", () => {
  assertEquals(parseInt2(""), null);
  assertEquals(parseInt2("   "), null);
  assertEquals(parseInt2("abc"), null);
});

Deno.test("mapWineRecord - maps basic fields", () => {
  const ct = {
    iWine: "123",
    Wine: "Test Wine",
    Vintage: "2020",
    Producer: "Test Producer",
    Country: "France",
  };
  const result = mapWineRecord(ct);
  assertEquals(result.ct_wine_id, "123");
  assertEquals(result.wine_name, "Test Wine");
  assertEquals(result.vintage, "2020");
  assertEquals(result.producer, "Test Producer");
  assertEquals(result.country, "France");
});

Deno.test("mapWineRecord - parses numeric fields", () => {
  const ct = {
    iWine: "123",
    Price: "99.99",
    Valuation: "150.00",
    CT: "92",
    Quantity: "3",
  };
  const result = mapWineRecord(ct);
  assertEquals(result.price, 99.99);
  assertEquals(result.valuation, 150.00);
  assertEquals(result.ct_score, 92);
  assertEquals(result.quantity, 3);
});

Deno.test("mapWineRecord - parses dates", () => {
  const ct = {
    iWine: "123",
    PurchaseDate: "6/15/2023",
  };
  const result = mapWineRecord(ct);
  assertEquals(result.purchase_date, "2023-06-15");
});

Deno.test("mapWineRecord - collects critic scores", () => {
  const ct = {
    iWine: "123",
    WA: "95",
    WS: "93",
    JS: "",
  };
  const result = mapWineRecord(ct);
  assertEquals(result.critic_scores, { WA: 95, WS: 93 });
});

Deno.test("mapWineRecord - handles empty critic scores", () => {
  const ct = { iWine: "123" };
  const result = mapWineRecord(ct);
  assertEquals(result.critic_scores, undefined);
});

Deno.test("mapWineRecord - sets last_sync_at", () => {
  const ct = { iWine: "123" };
  const result = mapWineRecord(ct);
  assertEquals(typeof result.last_sync_at, "string");
});

Deno.test("mapBottleRecord - maps basic fields", () => {
  const ct = {
    Barcode: "1234567890",
    iWine: "123",
    Location: "Cellar A",
    Bin: "B5",
  };
  const result = mapBottleRecord(ct);
  assertEquals(result.ct_bottle_id, "1234567890");
  assertEquals(result.wine_id, "123");
  assertEquals(result.location, "Cellar A");
  assertEquals(result.bin, "B5");
});

Deno.test("mapBottleRecord - parses bottle_state", () => {
  const inStock = { Barcode: "1", iWine: "1", BottleState: "1" };
  const consumed = { Barcode: "2", iWine: "1", BottleState: "0" };
  assertEquals(mapBottleRecord(inStock).bottle_state, 1);
  assertEquals(mapBottleRecord(consumed).bottle_state, 0);
});

Deno.test("mapBottleRecord - parses dates", () => {
  const ct = {
    Barcode: "1",
    iWine: "1",
    PurchaseDate: "3/10/2022",
    ConsumeDate: "1/5/2025",
  };
  const result = mapBottleRecord(ct);
  assertEquals(result.purchase_date, "2022-03-10");
  assertEquals(result.consumed_date, "2025-01-05");
});
