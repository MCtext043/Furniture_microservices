import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SPREADSHEET_PRICING, estimateSpreadsheetPrices } from "./SpreadsheetPricing.js";

test("matches the workbook example for all four variants", () => {
  const result = estimateSpreadsheetPrices({
    procurementCost: 33125,
    quantities: { facade1M2: 1.1, facade2M2: 4.2, facade3M2: 0, hinges: 28, guides: 4, countertop: 1.5, backsplash: 1.5 },
  });
  assert.deepEqual(result.map((item) => item.price), [113770, 154866.6, 195258.6, 260905.8]);
  assert.deepEqual(result.map((item) => item.assemblyCost), [21760, 40790, 60590, 92770]);
});

test("uses fixed packaging and delivery for every variant", () => {
  const result = estimateSpreadsheetPrices({ procurementCost: 0, quantities: {} });
  assert.deepEqual(result.map((item) => item.price), [4000, 4080, 4080, 4080]);
  assert.equal(DEFAULT_SPREADSHEET_PRICING.packaging, 1000);
  assert.equal(DEFAULT_SPREADSHEET_PRICING.delivery, 3000);
});

test("unknown 3D quantities contribute zero instead of inventing values", () => {
  const result = estimateSpreadsheetPrices({ procurementCost: 1000, quantities: { facade1M2: 2 } });
  assert.equal(result[0].assemblyCost, 2400);
  assert.ok(result.every((item) => Number.isFinite(item.price)));
});
