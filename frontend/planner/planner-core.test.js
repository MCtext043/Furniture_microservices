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
