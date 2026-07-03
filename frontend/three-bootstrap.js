// Three.js bootstrap for non-module scripts (textures3d.js, app.js).
// Uses import maps in HTML to resolve "three" and "three/addons/".
(async () => {
  try {
    const THREE_NS = await import("three");
    const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
    // Module namespace objects are immutable (non-extensible). Make a mutable copy for legacy scripts.
    const THREE = { ...THREE_NS, GLTFExporter };
    window.THREE = THREE;
    window.__THREE_BOOTSTRAP_OK = true;
  } catch (error) {
    window.__THREE_BOOTSTRAP_OK = false;
    window.__THREE_BOOTSTRAP_ERROR = String(error?.message || error);
  }
})();

