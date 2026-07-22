/** Screen-stable CAD-style dimension annotations for the 3D planner. */
(function () {
  if (!window.THREE) {
    console.warn("[dimensions] Three.js unavailable; 3D dimensions initialization skipped");
    return;
  }
  const DEFAULT_CONFIG = {
    targetFontSizePx: 23,
    minFontSizePx: 19,
    maxFontSizePx: 27,
    fullDetailDistance: 7000,
    compactDistance: 12000,
    hideDistance: 18000,
    fadeRange: 2500,
    lineColor: 0x263238,
    theme: "dark",
  };

  const tempWorld = new THREE.Vector3();
  const tempCameraLocal = new THREE.Vector3();

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatDimension(valueMm, unit = "mm", precision = 0) {
    const value = Number(valueMm) || 0;
    let converted = value;
    let suffix = "мм";
    let digits = precision;
    if (unit === "auto") {
      if (Math.abs(value) >= 1000) {
        converted = value / 1000;
        suffix = "м";
        digits = Math.max(precision, 2);
      }
    } else if (unit === "cm") {
      converted = value / 10;
      suffix = "см";
    } else if (unit === "m") {
      converted = value / 1000;
      suffix = "м";
    }
    const formatted = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(converted);
    return `${formatted}\u00a0${suffix}`;
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  class DimensionLabel {
    constructor(text, theme = "dark") {
      this.canvas = document.createElement("canvas");
      this.context = this.canvas.getContext("2d");
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.generateMipmaps = false;
      if ("colorSpace" in this.texture && THREE.SRGBColorSpace) this.texture.colorSpace = THREE.SRGBColorSpace;
      this.material = new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      this.sprite = new THREE.Sprite(this.material);
      this.sprite.renderOrder = 1000;
      this.sprite.userData.isDimensionAnnotation = true;
      this.text = "";
      this.theme = theme;
      this.aspectRatio = 4;
      this.update(text, theme);
    }

    update(text, theme = this.theme) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (text === this.text && theme === this.theme && dpr === this.dpr) return;
      this.text = text;
      this.theme = theme;
      this.dpr = dpr;
      const fontSize = 22;
      const font = `600 ${fontSize}px "Segoe UI", sans-serif`;
      this.context.font = font;
      const logicalWidth = Math.ceil(this.context.measureText(text).width + 34);
      const logicalHeight = 40;
      this.canvas.width = Math.ceil(logicalWidth * dpr);
      this.canvas.height = Math.ceil(logicalHeight * dpr);
      const ctx = this.canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
      ctx.shadowColor = "rgba(0,0,0,0.24)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
      roundedRect(ctx, 3, 3, logicalWidth - 6, logicalHeight - 7, 9);
      ctx.fillStyle = theme === "light" ? "rgba(250,250,248,0.94)" : "rgba(28,34,38,0.92)";
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = theme === "light" ? "rgba(30,40,45,0.22)" : "rgba(255,255,255,0.24)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = theme === "light" ? "#182126" : "#f7fafb";
      ctx.fillText(text, logicalWidth / 2, logicalHeight / 2 - 1);
      this.aspectRatio = logicalWidth / logicalHeight;
      this.texture.needsUpdate = true;
    }

    setOpacity(opacity) {
      this.material.opacity = opacity;
      this.sprite.visible = opacity > 0.01;
    }

    dispose() {
      this.texture.dispose();
      this.material.dispose();
    }
  }

  function createLineSegments(color) {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const line = new THREE.LineSegments(geometry, material);
    line.renderOrder = 998;
    line.userData.isDimensionAnnotation = true;
    return line;
  }

  function setSegments(line, segments) {
    const values = new Float32Array(segments.length * 6);
    segments.forEach((segment, index) => {
      values.set(segment, index * 6);
    });
    line.geometry.setAttribute("position", new THREE.BufferAttribute(values, 3));
    line.geometry.computeBoundingSphere();
  }

  class DimensionAnnotation {
    constructor(axis, valueMm, dimensions, config) {
      this.axis = axis;
      this.valueMm = valueMm;
      this.dimensions = dimensions;
      this.config = config;
      this.group = new THREE.Group();
      this.group.userData.isDimensionAnnotation = true;
      this.group.userData.dimensionAxis = axis;
      this.mainLine = createLineSegments(config.lineColor);
      this.detailLines = createLineSegments(config.lineColor);
      this.label = new DimensionLabel(formatDimension(valueMm), config.theme);
      this.group.add(this.mainLine, this.detailLines, this.label.sprite);
      this.side = 1;
      this.layout(1);
    }

    layout(side) {
      this.side = side;
      const { width: w, height: h, depth: d } = this.dimensions;
      const offset = clamp(Math.max(w, h, d) * 0.075, 90, 230);
      const extension = clamp(offset * 0.28, 24, 60);
      const tick = clamp(Math.min(w, h, d) * 0.025, 14, 32);
      let main;
      let detail;
      if (this.axis === "width") {
        const z = d / 2 + offset;
        const y = Math.max(24, Math.min(h * 0.035, 70));
        main = [[-w / 2, y, z, w / 2, y, z]];
        detail = [
          [-w / 2, y, d / 2, -w / 2, y, z + extension],
          [w / 2, y, d / 2, w / 2, y, z + extension],
          [-w / 2, y - tick, z, -w / 2, y + tick, z],
          [w / 2, y - tick, z, w / 2, y + tick, z],
        ];
        this.label.sprite.position.set(0, y, z + extension * 0.65);
      } else if (this.axis === "height") {
        const x = side * (w / 2 + offset);
        const z = d / 2;
        main = [[x, 0, z, x, h, z]];
        detail = [
          [side * w / 2, 0, z, x + side * extension, 0, z],
          [side * w / 2, h, z, x + side * extension, h, z],
          [x - tick, 0, z, x + tick, 0, z],
          [x - tick, h, z, x + tick, h, z],
        ];
        this.label.sprite.position.set(x + side * extension * 0.65, h / 2, z);
      } else {
        const x = -side * (w / 2 + offset);
        const y = h + clamp(offset * 0.38, 45, 90);
        main = [[x, y, -d / 2, x, y, d / 2]];
        detail = [
          [-side * w / 2, h, -d / 2, x - side * extension, y, -d / 2],
          [-side * w / 2, h, d / 2, x - side * extension, y, d / 2],
          [x - tick, y, -d / 2, x + tick, y, -d / 2],
          [x - tick, y, d / 2, x + tick, y, d / 2],
        ];
        this.label.sprite.position.set(x - side * extension * 0.65, y, 0);
      }
      setSegments(this.mainLine, main);
      setSegments(this.detailLines, detail);
    }

    setDisplay(opacity, fullDetail, showLine) {
      this.mainLine.material.opacity = showLine ? opacity : 0;
      this.mainLine.visible = showLine && opacity > 0.01;
      this.detailLines.material.opacity = fullDetail ? opacity : 0;
      this.detailLines.visible = fullDetail && opacity > 0.01;
      this.label.setOpacity(opacity);
    }

    dispose() {
      this.mainLine.geometry.dispose();
      this.mainLine.material.dispose();
      this.detailLines.geometry.dispose();
      this.detailLines.material.dispose();
      this.label.dispose();
    }
  }

  class DimensionManager {
    constructor(camera, renderer, options = {}) {
      this.camera = camera;
      this.renderer = renderer;
      this.config = { ...DEFAULT_CONFIG, ...options };
      this.entries = new Map();
      this.selected = null;
      this.visible = true;
    }

    attach(object, dimensions) {
      this.detach(object);
      const annotations = [
        new DimensionAnnotation("width", dimensions.width, dimensions, this.config),
        new DimensionAnnotation("height", dimensions.height, dimensions, this.config),
        new DimensionAnnotation("depth", dimensions.depth, dimensions, this.config),
      ];
      annotations.forEach((annotation) => object.add(annotation.group));
      this.entries.set(object, { object, dimensions, annotations, side: 1 });
      this.applyVisibility();
    }

    detach(object) {
      const entry = this.entries.get(object);
      if (!entry) return;
      entry.annotations.forEach((annotation) => {
        object.remove(annotation.group);
        annotation.dispose();
      });
      this.entries.delete(object);
      if (this.selected === object) this.selected = null;
    }

    updateObject(object, dimensions) {
      const wasSelected = this.selected === object;
      this.detach(object);
      this.attach(object, dimensions);
      if (wasSelected) this.setSelected(object);
    }

    clear() {
      Array.from(this.entries.keys()).forEach((object) => this.detach(object));
    }

    setSelected(object) {
      this.selected = object || null;
      this.applyVisibility();
    }

    setVisible(visible) {
      this.visible = Boolean(visible);
      this.applyVisibility();
    }

    applyVisibility() {
      this.entries.forEach((entry) => {
        entry.annotations.forEach((annotation) => {
          annotation.group.visible = this.visible && entry.object === this.selected;
        });
      });
    }

    update(camera = this.camera, renderer = this.renderer) {
      if (!this.visible || !this.selected) return;
      const entry = this.entries.get(this.selected);
      if (!entry) return;
      tempCameraLocal.copy(camera.position);
      entry.object.worldToLocal(tempCameraLocal);
      const preferredSide = tempCameraLocal.x >= 0 ? 1 : -1;
      const threshold = Math.max(entry.dimensions.width * 0.08, 100);
      if (preferredSide !== entry.side && Math.abs(tempCameraLocal.x) > threshold) {
        entry.side = preferredSide;
        entry.annotations.forEach((annotation) => {
          if (annotation.axis !== "width") annotation.layout(entry.side);
        });
      }

      entry.object.getWorldPosition(tempWorld);
      const distance = camera.position.distanceTo(tempWorld);
      const { fullDetailDistance, compactDistance, hideDistance, fadeRange } = this.config;
      let opacity = 1;
      if (distance > hideDistance - fadeRange) opacity = clamp((hideDistance - distance) / fadeRange, 0, 1);
      const fullDetail = distance < fullDetailDistance;
      const showLine = distance < compactDistance;
      entry.annotations.forEach((annotation) => {
        annotation.setDisplay(opacity, fullDetail, showLine);
        annotation.label.update(formatDimension(annotation.valueMm), this.config.theme);
        annotation.label.sprite.getWorldPosition(tempWorld);
        const labelDistance = camera.position.distanceTo(tempWorld);
        let worldUnitsPerPixel;
        if (camera.isOrthographicCamera) {
          worldUnitsPerPixel = (camera.top - camera.bottom) / Math.max(renderer.domElement.clientHeight, 1) / camera.zoom;
        } else {
          const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * labelDistance;
          worldUnitsPerPixel = visibleHeight / Math.max(renderer.domElement.clientHeight, 1);
        }
        const targetPx = clamp(this.config.targetFontSizePx, this.config.minFontSizePx, this.config.maxFontSizePx);
        const labelHeight = targetPx * worldUnitsPerPixel;
        annotation.label.sprite.scale.set(labelHeight * annotation.label.aspectRatio, labelHeight, 1);
      });
    }

    dispose() {
      this.clear();
      this.selected = null;
    }
  }

  window.Dimension3D = { DimensionManager, formatDimension, DEFAULT_CONFIG };
})();
