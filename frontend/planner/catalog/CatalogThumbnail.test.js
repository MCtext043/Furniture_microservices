import test from "node:test";
import assert from "node:assert/strict";
import { catalogThumbnailKind, catalogThumbnailSvg } from "./CatalogThumbnail.js";

test("catalog thumbnails choose an understandable isometric object", () => {
  assert.equal(catalogThumbnailKind({ name: "Гардероб Family" }), "wardrobe");
  assert.equal(catalogThumbnailKind({ name: "Обеденный стол" }), "table");
  assert.equal(catalogThumbnailKind({ name: "Кухня Nord" }), "cabinet");
});

test("catalog thumbnail is inline SVG and accessible", () => {
  const svg = catalogThumbnailSvg({ name: "Кухня <Nord>" });
  assert.match(svg, /^<svg/);
  assert.match(svg, /role="img"/);
  assert.match(svg, /Кухня &lt;Nord&gt;/);
  assert.match(svg, /path/);
});
