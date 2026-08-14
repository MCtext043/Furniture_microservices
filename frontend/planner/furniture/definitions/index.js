import { registerKitchenDefinitions } from "./kitchen.js";
import { registerWardrobeDefinition } from "./wardrobe.js";

const TYPES = [
  ["cabinet", "Cabinet", "storage"], ["shelf", "Shelf", "storage"], ["table", "Table", "table"], ["sofa", "Sofa", "seating"],
  ["armchair", "Armchair", "seating"], ["chair", "Chair", "seating"], ["bed", "Bed", "bedroom"], ["bath_vanity", "Vanity", "bathroom"],
  ["bathroom_sink", "Sink", "bathroom"], ["bathroom_bathtub", "Bathtub", "bathroom"], ["bathroom_shower", "Shower", "bathroom"],
  ["bathroom_toilet", "Toilet", "bathroom"], ["bathroom_mirror", "Mirror", "bathroom"], ["appliance_fridge", "Fridge", "appliance"],
  ["appliance_washer", "Washer", "appliance"], ["appliance_dishwasher", "Dishwasher", "appliance"], ["appliance_microwave", "Microwave", "appliance"],
  ["appliance_hood", "Hood", "appliance"], ["appliance_hood_builtin", "Built-in hood", "appliance"], ["appliance_stove_gas", "Gas stove", "appliance"],
  ["appliance_stove_electric", "Electric stove", "appliance"], ["appliance_oven", "Oven", "appliance"],
];

const bounds = ({ configuration }) => ({ width: configuration.width, depth: configuration.depth, height: configuration.height });
const validate = (configuration) => {
  const errors = ["width", "depth", "height"].filter((key) => !Number.isFinite(Number(configuration[key])) || Number(configuration[key]) <= 0).map((key) => `${key} must be positive`);
  return { valid: errors.length === 0, errors };
};
const genericBom = (placement) => ({ parts: [{ id: "body", role: "envelope", dimensions: bounds(placement), materialId: "body", edgeBanding: {}, drilling: [] }], assembly: [] });

export function registerBuiltInFurniture(registry) {
  for (const [type, title, category] of TYPES) registry.register({
    type, definitionId: `${type}.v1`, title, category, defaults: { width: 600, depth: 500, height: 800 },
    constraints: { width: [80, 6000], depth: [20, 4000], height: [80, 4000] }, schema: { width: "number", depth: "number", height: "number" },
    validateConfiguration: validate, getBounds: bounds, buildBom: genericBom,
    buildGeometry(placement, context) { return context.buildLegacy(placement); },
  });
  registerKitchenDefinitions(registry);
  registerWardrobeDefinition(registry);
  return registry;
}
