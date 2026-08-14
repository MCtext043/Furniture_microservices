export const CURRENT_SCENE_SCHEMA_VERSION = 2;

const definitionByLegacyType = {
  cabinet: "storage.cabinet.v1", wardrobe: "wardrobe.system.v1", wardrobe_sliding: "wardrobe.system.v1",
  wardrobe_corner: "wardrobe.system.v1", shelf: "storage.shelf.v1", table: "furniture.table.v1",
};

export function migrateLegacyObject(item) {
  const type = item.type || item.furniture_type || "cabinet";
  return {
    id: String(item.id || item.client_id || crypto.randomUUID()),
    definitionId: item.definitionId || item.definition_id || definitionByLegacyType[type] || `${type}.v1`,
    definitionVersion: Number(item.definitionVersion || item.definition_version) || 1,
    type,
    name: item.name || type,
    configuration: {
      width: Number(item.configuration?.width ?? item.configuration_json?.width ?? item.width) || 600,
      depth: Number(item.configuration?.depth ?? item.configuration_json?.depth ?? item.depth) || 500,
      height: Number(item.configuration?.height ?? item.configuration_json?.height ?? item.height) || 800,
      drawerCount: Number(item.configuration?.drawerCount ?? item.configuration_json?.drawers ?? item.drawers) || 0,
      handleCount: Number(item.configuration?.handleCount ?? item.configuration_json?.handles ?? item.handles) || 0,
      ...(item.configuration_json || {}), ...(item.configuration || {}),
    },
    transform: {
      x: Number(item.transform?.x ?? item.x) || 0, y: Number(item.transform?.y ?? item.y) || 0,
      z: Number(item.transform?.z ?? item.z) || 0, rotationY: Number(item.transform?.rotationY ?? item.rotation_y ?? item.rotationY) || 0,
    },
    appearance: {
      materialId: item.appearance?.materialId || item.appearance_json?.texture || item.texture || "wood_oak",
      customColor: item.appearance?.customColor || item.appearance_json?.customColor || item.custom_color || item.customColor || null,
      ...(item.appearance_json || {}), ...(item.appearance || {}),
    },
    rendererMode: item.rendererMode || item.renderer_mode || "parametric",
    modelAssetKey: item.modelAssetKey || item.model_asset_key || null,
    modelVersion: item.modelVersion || item.model_version || null,
  };
}

export function toLegacyObject(placement) {
  return {
    id: placement.id, type: placement.type, name: placement.name,
    width: placement.configuration.width, depth: placement.configuration.depth, height: placement.configuration.height,
    drawers: placement.configuration.drawerCount ?? placement.configuration.drawers ?? 0,
    handles: placement.configuration.handleCount ?? placement.configuration.handles ?? 0,
    x: placement.transform.x, y: placement.transform.y, z: placement.transform.z, rotationY: placement.transform.rotationY,
    texture: placement.appearance.materialId || placement.appearance.texture || "wood_oak",
    customColor: placement.appearance.customColor || "",
    definitionId: placement.definitionId, definitionVersion: placement.definitionVersion,
    rendererMode: placement.rendererMode, modelAssetKey: placement.modelAssetKey, modelVersion: placement.modelVersion,
  };
}

export function migrateScene(scene) {
  const placements = (scene?.placements || scene?.objects3d || []).map(migrateLegacyObject);
  return { schemaVersion: CURRENT_SCENE_SCHEMA_VERSION, revision: Number(scene?.revision) || 0, room: scene?.room || null, placements };
}
