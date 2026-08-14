export class PlannerDiagnostics {
  constructor(renderer, enabled = /localhost|127\.0\.0\.1/.test(location.hostname) && new URLSearchParams(location.search).has("plannerDebug")) {
    this.renderer=renderer; this.enabled=enabled;
    if(enabled){this.element=document.createElement("pre");this.element.className="planner-diagnostics";this.element.setAttribute("aria-label","3D renderer diagnostics");document.body.appendChild(this.element)}
  }
  update(extra={}){if(!this.enabled)return;const {memory,render}=this.renderer.info;this.element.textContent=[`draw calls: ${render.calls}`,`triangles: ${render.triangles}`,`geometries: ${memory.geometries}`,`textures: ${memory.textures}`,...Object.entries(extra).map(([k,v])=>`${k}: ${v}`)].join("\n")}
  dispose(){this.element?.remove();this.element=null}
}
