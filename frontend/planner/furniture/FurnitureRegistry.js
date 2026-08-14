export class FurnitureRegistry {
  #definitions = new Map();

  register(definition) {
    if (!definition?.type) throw new TypeError("Furniture definition requires a type");
    if (this.#definitions.has(definition.type)) throw new Error(`Furniture type already registered: ${definition.type}`);
    for (const method of ["buildGeometry", "buildBom", "getBounds"]) {
      if (typeof definition[method] !== "function") throw new TypeError(`${definition.type} requires ${method}()`);
    }
    const normalized = Object.freeze({ version: 1, defaults: {}, constraints: {}, schema: {}, ...definition });
    this.#definitions.set(normalized.type, normalized);
    return normalized;
  }

  get(type) {
    return this.#definitions.get(type) || null;
  }

  require(type) {
    const definition = this.get(type);
    if (!definition) throw new Error(`Unknown furniture type: ${type}`);
    return definition;
  }

  list() {
    return [...this.#definitions.values()];
  }

  validate(type, configuration) {
    const definition = this.require(type);
    return definition.validateConfiguration?.(configuration) ?? { valid: true, errors: [] };
  }

  buildGeometry(placement, context) {
    return this.require(placement.type).buildGeometry(placement, context);
  }

  buildBom(placement) {
    return this.require(placement.type).buildBom(placement);
  }

  getBounds(placement) {
    return this.require(placement.type).getBounds(placement);
  }
}
