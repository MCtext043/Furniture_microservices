export class ResourceManager {
  constructor() {
    this.resources = new Map();
  }

  acquire(key, factory) {
    let entry = this.resources.get(key);
    if (!entry) {
      entry = { value: factory(), references: 0 };
      this.resources.set(key, entry);
    }
    entry.references += 1;
    return entry.value;
  }

  release(key) {
    const entry = this.resources.get(key);
    if (!entry) return;
    entry.references -= 1;
    if (entry.references > 0) return;
    this.disposeValue(entry.value);
    this.resources.delete(key);
  }

  disposeValue(value) {
    const visited = new Set();
    value?.traverse?.((node) => {
      if (node.geometry && !node.geometry.userData?.sharedResource && !visited.has(node.geometry)) {
        visited.add(node.geometry);
        node.geometry.dispose?.();
      }
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials.filter(Boolean)) {
        if (material.userData?.sharedFurnitureMaterial || material.userData?.sharedResource) continue;
        if (visited.has(material)) continue;
        visited.add(material);
        for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "envMap"]) {
          if (material[key] && !visited.has(material[key])) {
            visited.add(material[key]);
            material[key].dispose?.();
          }
        }
        material.dispose?.();
      }
    });
    value?.dispose?.();
  }

  dispose() {
    for (const entry of this.resources.values()) this.disposeValue(entry.value);
    this.resources.clear();
  }
}
