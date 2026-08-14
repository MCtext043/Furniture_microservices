import { CURRENT_SCENE_SCHEMA_VERSION, migrateLegacyObject } from "./migrations.js";

export function serializeScene({ revision = 0, roomConfig, roomFinish, objects, bomJson = null }) {
  return {
    schema_version: CURRENT_SCENE_SCHEMA_VERSION,
    expected_revision: revision,
    room: { width: roomConfig.width, length: roomConfig.length, height: roomConfig.height, finish: roomFinish || {} },
    placements: objects.map((raw) => {
      const item = migrateLegacyObject(raw);
      return {
        client_id: item.id, definition_id: item.definitionId, definition_version: item.definitionVersion,
        name: item.name, width: item.configuration.width, depth: item.configuration.depth, height: item.configuration.height,
        x: item.transform.x, y: item.transform.y, z: item.transform.z, rotation_y: item.transform.rotationY,
        furniture_type: item.type, texture: item.appearance.materialId, custom_color: item.appearance.customColor || "",
        drawers: item.configuration.drawerCount ?? item.configuration.drawers ?? 0,
        handles: item.configuration.handleCount ?? item.configuration.handles ?? 0,
        configuration_json: item.configuration, appearance_json: item.appearance, renderer_mode: item.rendererMode,
        model_asset_key: item.modelAssetKey, model_version: item.modelVersion,
      };
    }),
    bom_json: bomJson,
  };
}
