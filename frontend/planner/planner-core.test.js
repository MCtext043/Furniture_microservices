import test from "node:test";
import assert from "node:assert/strict";
import { FurnitureRegistry } from "./furniture/FurnitureRegistry.js";
import { migrateLegacyObject, migrateScene, toLegacyObject } from "./persistence/migrations.js";
import { serializeScene } from "./persistence/SceneSerializer.js";
import { RenderScheduler } from "./core/RenderScheduler.js";
import { HistoryManager } from "./interaction/HistoryManager.js";
import { intersectsOriented } from "./interaction/CollisionController.js";
import { registerBuiltInFurniture } from "./furniture/definitions/index.js";
import { KitchenRun } from "./furniture/definitions/kitchen.js";
import { ModelAssetLoader } from "./furniture/ModelAssetLoader.js";
import { applyTranslationDelta, clampPlacementToRoom, coordinateDeltaForAxis, getRotatedFootprint, snapPlacement3D } from "./interaction/Transform3D.js";
import { HARD_FURNITURE_CATEGORIES, HARD_FURNITURE_LIBRARY } from "./catalog/HardFurnitureCatalog.js";
import { CostQuoteController } from "./pricing/CostQuoteController.js";

test("FurnitureRegistry rejects duplicates and delegates behavior", () => {
  const registry = new FurnitureRegistry();
  const definition = { type: "test", buildGeometry: () => "mesh", buildBom: () => ({ parts: [] }), getBounds: () => ({ width: 1 }) };
  registry.register(definition);
  assert.equal(registry.buildGeometry({ type: "test" }), "mesh");
  assert.throws(() => registry.register(definition), /already registered/);
});

test("legacy placement migration round-trips stable identity and transform", () => {
  const legacy = { id: "client-1", type: "cabinet", width: 600, depth: 560, height: 850, x: 12, z: 34, rotationY: 90, texture: "wood_oak" };
  const placement = migrateLegacyObject(legacy);
  assert.equal(placement.definitionId, "storage.cabinet.v1");
  assert.deepEqual({ x: placement.transform.x, z: placement.transform.z, rotationY: placement.transform.rotationY }, { x: 12, z: 34, rotationY: 90 });
  assert.equal(toLegacyObject(placement).id, "client-1");
});

test("server scene reload preserves client identity, construction and finishes", () => {
  const source = { id: "client-stable", type: "cabinet", name: "Модуль", width: 600, depth: 560, height: 850, x: 1200, y: 100, z: 800,
    section: "kitchen", variant: "k-base-hinged", drawers: 0, handles: 2, texture: "mdf_film_matte", milling: true, countertopType: "quartz" };
  const payload = serializeScene({ roomConfig: { width: 4000, length: 3000, height: 2700 }, objects: [source] });
  const loaded = toLegacyObject(migrateLegacyObject({ ...payload.placements[0], id: 42 }));
  for (const key of ["id", "variant", "section", "drawers", "handles", "texture", "milling", "countertopType"]) {
    assert.equal(loaded[key], source[key], key);
  }
});

test("quote controller rejects stale results after a scene changes or empties", async () => {
  const requests = [];
  const quotes = new CostQuoteController((key) => new Promise((resolve) => requests.push({ key, resolve })));
  const first = quotes.begin("old");
  const oldRequest = quotes.request("old");
  const second = quotes.begin("new");
  const newRequest = quotes.request("new");
  await Promise.resolve();
  requests[1].resolve({ total_sheets: 2 });
  await newRequest;
  requests[0].resolve({ total_sheets: 9 });
  await oldRequest;
  assert.equal(quotes.isCurrent(first), false);
  assert.equal(quotes.isCurrent(second), true);
  assert.equal(quotes.get("new").total_sheets, 2);
  assert.equal(quotes.get("unrelated"), null);
  quotes.begin("empty");
  assert.equal(quotes.isCurrent(second), false);
});

test("quote requests deduplicate and recover after failures", async () => {
  let calls = 0;
  const quotes = new CostQuoteController(async () => { calls += 1; if (calls === 1) throw new Error("offline"); return { total_sheets: 3 }; });
  await assert.rejects(quotes.request("scene"), /offline/);
  const [a, b] = await Promise.all([quotes.request("scene"), quotes.request("scene")]);
  assert.deepEqual(a, b);
  assert.equal(calls, 2);
});

test("scene serializer emits schema v2 atomic payload", () => {
  const payload = serializeScene({ revision: 3, roomConfig: { width: 4000, length: 3000, height: 2700 }, roomFinish: { floor: "oak" }, objects: [{ id: "a", type: "cabinet", name: "A", width: 600, depth: 500, height: 800 }] });
  assert.equal(payload.schema_version, 2);
  assert.equal(payload.expected_revision, 3);
  assert.equal(payload.placements[0].client_id, "a");
  assert.equal(migrateScene({ revision: 4, placements: payload.placements }).revision, 4);
});

test("RenderScheduler coalesces rapid updates into one frame", () => {
  let callback;
  let renders = 0;
  const scheduler = new RenderScheduler((reasons) => { renders += 1; assert.deepEqual(reasons, ["move", "selection"]); }, (fn) => { callback = fn; return 1; }, () => {});
  scheduler.request("move"); scheduler.request("selection");
  assert.equal(renders, 0);
  callback();
  assert.equal(renders, 1);
});

test("HistoryManager restores and reapplies snapshots", () => {
  let state; const history = new HistoryManager((next) => { state = next; });
  history.record({ x: 0 }, { x: 10 }, "move"); assert.equal(history.undo(), true); assert.equal(state.x, 0);
  assert.equal(history.redo(), true); assert.equal(state.x, 10);
});

test("oriented collision uses SAT for arbitrary rotations", () => {
  const a = { x: 0, z: 0, width: 100, depth: 40, rotationY: 45 };
  assert.equal(intersectsOriented(a, { x: 30, z: 0, width: 80, depth: 30, rotationY: -20 }), true);
  assert.equal(intersectsOriented(a, { x: 300, z: 0, width: 80, depth: 30, rotationY: -20 }), false);
});

test("collision detection allows objects to be stacked at different elevations", () => {
  const floor = { x: 0, y: 0, z: 0, width: 1000, depth: 600, height: 700, rotationY: 0 };
  const wall = { x: 0, y: 900, z: 0, width: 1000, depth: 600, height: 500, rotationY: 0 };
  assert.equal(intersectsOriented(floor, wall), false);
  assert.equal(intersectsOriented(floor, { ...wall, y: 600 }), true);
});

test("kitchen modules build production parts and a continuous countertop", () => {
  const registry=registerBuiltInFurniture(new FurnitureRegistry()); const definition=registry.require("kitchen.base_cabinet");
  const placement={type:"kitchen.base_cabinet",configuration:{...definition.defaults}};
  assert.ok(definition.buildBom(placement).parts.some(p=>p.id==="outer-side"||p.id==="side"));
  const run=new KitchenRun([placement,{...placement,configuration:{...placement.configuration,width:800}}]);
  assert.equal(run.buildProduction().parts[0].dimensions.width,1400);
});

test("wardrobe validates section widths and builds module BOM", () => {
  const registry=registerBuiltInFurniture(new FurnitureRegistry()); const definition=registry.require("wardrobe.system");
  const configuration={...definition.defaults,width:1600,sections:[{width:800,modules:[{type:"shelves",count:5}]},{width:800,modules:[{type:"drawers",count:3},{type:"rail",height:1100}]}]};
  assert.equal(definition.validateConfiguration(configuration).valid,true);
  const parts=definition.buildBom({configuration}).parts;
  assert.ok(parts.some(p=>p.role==="rail")); assert.ok(parts.some(p=>p.id.includes("drawer")));
});

test("ModelAssetLoader caches by asset key and version", async () => {
  let requests=0; const source={clone:()=>({instance:true}),traverse:()=>{}};
  const loader=new ModelAssetLoader({fetchAsset:async()=>{requests++;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}},parse:async()=>source});
  assert.equal((await loader.load("models/chair.glb",2)).instance,true); await loader.load("models/chair.glb",2);
  assert.equal(requests,1); loader.clear();
});

test("3D translation keeps furniture fully inside the room on every axis", () => {
  const room = { width: 4000, length: 3000, height: 2700 };
  const item = { width: 1200, depth: 600, height: 2100, x: 2000, y: 0, z: 1500, rotationY: 90 };
  const moved = applyTranslationDelta(item, { x: 5000, y: 4000, z: -5000 }, room);
  const footprint = getRotatedFootprint(moved);
  assert.equal(moved.x, room.width - footprint.width / 2);
  assert.equal(moved.y, room.height - item.height);
  assert.equal(moved.z, footprint.depth / 2);
});

test("3D translation supports axis and plane movement without changing untouched coordinates", () => {
  const room = { width: 6000, length: 5000, height: 2800 };
  const item = { width: 800, depth: 500, height: 700, x: 2000, y: 100, z: 2200, rotationY: 0 };
  assert.deepEqual(
    applyTranslationDelta(item, { x: 250, y: 0, z: 0 }, room),
    { ...item, x: 2250 }
  );
  assert.deepEqual(
    applyTranslationDelta(item, { x: 0, y: 350, z: -400 }, room),
    { ...item, y: 450, z: 1800 }
  );
});

test("axis gizmo converts a drag to exactly one world coordinate", () => {
  const drag = { x: 175, y: -240, z: 320 };
  assert.deepEqual(coordinateDeltaForAxis("x", drag), { x: 175, y: 0, z: 0 });
  assert.deepEqual(coordinateDeltaForAxis("y", drag), { x: 0, y: -240, z: 0 });
  assert.deepEqual(coordinateDeltaForAxis("z", drag), { x: 0, y: 0, z: 320 });
});

test("clampPlacementToRoom handles rotated footprints and invalid persisted values", () => {
  const room = { width: 3000, length: 2500, height: 2400 };
  const item = { width: 1000, depth: 400, height: 600, x: Number.NaN, y: -100, z: Infinity, rotationY: 90 };
  assert.deepEqual(clampPlacementToRoom(item, room), {
    ...item,
    x: 200,
    y: 0,
    z: 500,
  });
});

test("magnetic placement snaps adjacent faces on X, Y and Z axes", () => {
  const room = { width: 5000, length: 4000, height: 2800 };
  const anchor = { id: "anchor", x: 2000, y: 0, z: 1800, width: 600, depth: 600, height: 850, rotationY: 0 };
  const base = { id: "moving", x: 1335, y: 0, z: 1800, width: 600, depth: 600, height: 850, rotationY: 0 };

  const alongX = snapPlacement3D(base, [anchor], room, { axis: "x", threshold: 80 });
  assert.equal(alongX.placement.x, 1400);
  assert.equal(alongX.snapped, true);

  const above = snapPlacement3D({ ...base, x: 2000, y: 815 }, [anchor], room, { axis: "y", threshold: 80 });
  assert.equal(above.placement.y, 850);

  const alongZ = snapPlacement3D({ ...base, x: 2000, z: 1135 }, [anchor], room, { axis: "z", threshold: 80 });
  assert.equal(alongZ.placement.z, 1200);
});

test("magnetic placement ignores furniture outside the other two projections", () => {
  const room = { width: 5000, length: 4000, height: 2800 };
  const moving = { id: "moving", x: 1335, y: 0, z: 400, width: 600, depth: 600, height: 850, rotationY: 0 };
  const farOnZ = { id: "anchor", x: 2000, y: 0, z: 2500, width: 600, depth: 600, height: 850, rotationY: 0 };
  const result = snapPlacement3D(moving, [farOnZ], room, { axis: "x", threshold: 80 });
  assert.equal(result.placement.x, moving.x);
  assert.equal(result.snapped, false);
});

test("magnetic placement snaps to room boundaries on every axis", () => {
  const room = { width: 5000, length: 4000, height: 2800 };
  const item = { id: "moving", x: 335, y: 35, z: 3650, width: 600, depth: 600, height: 850, rotationY: 0 };
  assert.equal(snapPlacement3D(item, [], room, { axis: "x", threshold: 80 }).placement.x, 300);
  assert.equal(snapPlacement3D(item, [], room, { axis: "y", threshold: 80 }).placement.y, 0);
  assert.equal(snapPlacement3D(item, [], room, { axis: "z", threshold: 80 }).placement.z, 3700);
});

test("hard furniture library contains real kinds inside the original picker categories", () => {
  const originalCategories = new Set(["living", "kitchen", "wardrobe", "bathroom", "bedroom", "office"]);
  assert.deepEqual(new Set(HARD_FURNITURE_CATEGORIES.map(([id]) => id)), originalCategories);
  assert.ok(HARD_FURNITURE_LIBRARY.length >= 45);
  assert.ok(new Set(HARD_FURNITURE_LIBRARY.map((item) => item.id)).size === HARD_FURNITURE_LIBRARY.length);
  assert.equal(new Set(HARD_FURNITURE_LIBRARY.map((item) => item.name)).size, HARD_FURNITURE_LIBRARY.length);
  assert.equal(new Set(HARD_FURNITURE_LIBRARY.map((item) => item.variant)).size, HARD_FURNITURE_LIBRARY.length);
  assert.ok(HARD_FURNITURE_LIBRARY.every((item) => originalCategories.has(item.category)));
  assert.ok(HARD_FURNITURE_LIBRARY.every((item) => !/\d+\s*мм$/i.test(item.name)), "Sizes must not masquerade as furniture kinds");
  const supported = new Set(registerBuiltInFurniture(new FurnitureRegistry()).list().map((definition) => definition.type));
  HARD_FURNITURE_LIBRARY.forEach((item) => {
    assert.ok(supported.has(item.type), `Unsupported planner type: ${item.type}`);
    assert.ok(item.width > 0 && item.depth > 0 && item.height > 0);
  });
});
