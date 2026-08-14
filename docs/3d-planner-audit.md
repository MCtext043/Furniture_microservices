# 3D planner technical audit

## Previous architecture and findings

The production planner is the vanilla frontend served by `gateway_service`; `frontend-react` is an unfinished, unreferenced build and is not a second production planner. Planner state, DOM handlers, Three.js lifecycle, furniture branching, BOM, exports and persistence were concentrated in `frontend/app.js` and `frontend/textures3d.js`.

Critical findings:

- every save appended every placement with `POST`, creating duplicates;
- client-supplied `user_id` was trusted and project reads/writes lacked owner checks;
- no stable placement identity, scene schema version or concurrency revision existed;
- rendering used repeated type conditionals and linear scene lookups;
- geometry/material ownership was implicit, making safe GPU disposal difficult;
- selection differed between 3D, plan and list; undo/redo and rotated collision checks were absent;
- errors during placement synchronization were swallowed by an empty `catch`.

## Current data flow

The object picker creates a legacy-compatible view model. `migrateLegacyObject()` normalizes it into schema v2. `FurnitureRegistry` resolves behavior and delegates geometry creation. The scene map updates only added, removed or signature-changed groups. `RenderScheduler` coalesces invalidations into one animation frame. `SceneSerializer` sends one revision-guarded `PUT /planner/projects/{id}/scene` transaction.

## Scene schema v2

```json
{
  "id": "stable-client-uuid",
  "definitionId": "kitchen.base_cabinet.v1",
  "definitionVersion": 1,
  "type": "kitchen.base_cabinet",
  "configuration": { "width": 600, "depth": 560, "height": 850 },
  "transform": { "x": 1000, "y": 0, "z": 600, "rotationY": 0 },
  "appearance": { "materialId": "mdf_matte", "customColor": null },
  "rendererMode": "parametric",
  "modelAssetKey": null,
  "modelVersion": null
}
```

Migration is non-destructive: legacy flat fields are normalized in the browser; migration `010_planner_scene_v2` backfills database `client_id` as `legacy-{id}` and adds JSONB configuration/appearance plus scene revision fields. Old furniture endpoints remain available during compatibility rollout.

## Adding a furniture definition

Create one module under `frontend/planner/furniture/definitions/` and register an object containing `type`, `definitionId`, defaults, constraints, schema, validation, `getBounds`, `buildGeometry`, and `buildBom`. Add focused tests to `planner-core.test.js`. Geometry, bounds and production output must consume the same configuration; do not add new conditionals to `app.js`.

Kitchen definitions include base, wall, tall, drawer, sink, oven, corner, open shelf, filler, end panel and island modules. `KitchenRun` produces a real continuous countertop part. `wardrobe.system` supports sections containing shelves, drawers and rails, door modes and mirror facade material, with automatic BOM.

## GLB asset workflow

Upload a compressed `.glb` through `POST /assets/upload` with an object key such as `models/chairs/model.glb`, or request a presigned upload using `/assets/presign-put`. Store the key and immutable `model_version` on the placement. Retrieval uses `/assets/objects/{object_key}`. Parametric furniture remains the production default. GLTF/Draco/KTX2 runtime loading is the next integration step; the persistence schema already supports `parametric`, `gltf` and `hybrid` records without breaking old scenes.

## Verification and performance

Automated checks:

- 8 planner core unit tests: registry, migration, serialization, scheduling, history, OBB collision, kitchen run and wardrobe BOM;
- 8 planner backend tests: legacy API plus atomic upsert/removal, duplicate rejection and revision conflict;
- browser smoke tests: WebGL creation, add object, and add/undo/redo with zero page errors.

Headless Chromium at 1280×900 (DPR 1), measured 2026-08-15:

| Objects | Initial build | Transform | Camera interaction | Calls | Geometries | Textures | Triangles |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 152 ms | 1.50 ms | ~56 FPS | 149 | 39 | 38 | 17,402 |
| 40 | 339 ms | 1.00 ms | ~61 FPS | 569 | 39 | 38 | 69,482 |
| 100 | 761 ms | 2.60 ms | ~58 FPS | 1,409 | 39 | 38 | 173,642 |

After 20 add/remove cycles, renderer memory changed by -3 geometries and -3 textures, demonstrating no monotonic GPU resource growth in this scenario. Use `?plannerDebug=1` on localhost to display live renderer counters.

Known limitation: draw calls still scale with detailed mesh count. Large scenes remain interactive because shadows and continuous idle rendering are disabled adaptively, but mesh batching/instancing is recommended for the next optimization pass.
