/** Procedural PBR textures for 3D planner (kitchen-constructor style). */
(function () {
  const materialCache = new Map();

  function canvasLuminance(data, size, x, y) {
    const i = (y * size + x) * 4;
    return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
  }

  function normalMapFromCanvas(sourceCanvas, strength) {
    const size = sourceCanvas.width;
    const src = sourceCanvas.getContext("2d").getImageData(0, 0, size, size);
    const out = new ImageData(size, size);
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const l = canvasLuminance(src.data, size, x - 1, y);
        const r = canvasLuminance(src.data, size, x + 1, y);
        const u = canvasLuminance(src.data, size, x, y - 1);
        const d = canvasLuminance(src.data, size, x, y + 1);
        const nx = (l - r) * strength;
        const ny = (u - d) * strength;
        const nz = 1;
        const len = Math.hypot(nx, ny, nz) || 1;
        const idx = (y * size + x) * 4;
        out.data[idx] = ((nx / len) * 0.5 + 0.5) * 255;
        out.data[idx + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        out.data[idx + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        out.data[idx + 3] = 255;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.getContext("2d").putImageData(out, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function drawWood(ctx, size, pal) {
    ctx.fillStyle = pal.base;
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      const wave = Math.sin(y * 0.028) * 10 + Math.sin(y * 0.011 + 1.3) * 16;
      ctx.strokeStyle = y % 28 < 14 ? pal.grain : pal.highlight;
      ctx.globalAlpha = 0.28 + (y % 19) / 45;
      ctx.lineWidth = 0.8 + (y % 7) * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 24) {
        ctx.lineTo(x, y + wave + Math.sin((x + y) * 0.018) * 4);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 10; i++) {
      const kx = (size * (0.12 + i * 0.09)) % size;
      const ky = (size * (0.18 + i * 0.13)) % size;
      const grad = ctx.createRadialGradient(kx, ky, 1, kx, ky, 34);
      grad.addColorStop(0, "rgba(25,15,8,0.4)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(kx - 36, ky - 36, 72, 72);
    }
  }

  function drawProcedural(type, variant, ctx, size) {
    const woodPalette = {
      wood_dark_oak: { base: "#5c3d2e", grain: "#3d2819", highlight: "#8b5a3c" },
      wood_oak: { base: "#c4956a", grain: "#9a7048", highlight: "#e8c9a0" },
      default: { base: "#9b6b43", grain: "#6b4423", highlight: "#c49a6c" },
    };

    if (type === "wood") {
      drawWood(ctx, size, woodPalette[variant] || woodPalette.default);
    } else if (type === "mdf") {
      ctx.fillStyle = "#ece8e2";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 12000; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.018})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
      }
    } else if (type === "laminate") {
      ctx.fillStyle = "#a8adb5";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 3) {
        ctx.strokeStyle = y % 9 === 0 ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.04)";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
    } else if (type === "stone") {
      ctx.fillStyle = "#cfc4b8";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 8 + Math.random() * 40;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(255,255,255,0.15)");
        g.addColorStop(1, "rgba(80,70,60,0.08)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === "metal") {
      ctx.fillStyle = "#8b9199";
      ctx.fillRect(0, 0, size, size);
      for (let i = -size; i < size * 2; i += 5) {
        ctx.strokeStyle = `rgba(255,255,255,${0.06 + (i % 10) / 100})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + size, size);
        ctx.stroke();
      }
    } else if (type === "board") {
      const light = variant === "board_white" ? "#f7f8fa" : "#3d4248";
      const dark = variant === "board_white" ? "#e2e5ea" : "#2a2e33";
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i <= 20; i++) {
        ctx.strokeStyle = i % 5 === 0 ? dark : "rgba(0,0,0,0.06)";
        ctx.lineWidth = i % 5 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(0, i * (size / 20));
        ctx.lineTo(size, i * (size / 20));
        ctx.stroke();
      }
    } else if (type === "fabric") {
      ctx.fillStyle = variant === "fabric_gray" ? "#6b7280" : "#64748b";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 3) {
        for (let x = 0; x < size; x += 3) {
          ctx.fillStyle = (x + y) % 6 === 0 ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.05)";
          ctx.fillRect(x, y, 2, 2);
        }
      }
    } else if (type === "floor") {
      const plankW = size / 10;
      for (let col = 0; col < 10; col++) {
        ctx.fillStyle = col % 2 ? "#a8845f" : "#c9a67a";
        ctx.fillRect(col * plankW, 0, plankW - 3, size);
        const offset = col % 2 ? plankW / 2 : 0;
        for (let y = offset; y < size; y += plankW * 1.8) {
          ctx.strokeStyle = "rgba(40,25,10,0.2)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(col * plankW, y);
          ctx.lineTo((col + 1) * plankW - 3, y);
          ctx.stroke();
        }
      }
    } else if (type === "wall") {
      ctx.fillStyle = "#f7f3ec";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 14000; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.022})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
      }
    } else {
      ctx.fillStyle = "#64748b";
      ctx.fillRect(0, 0, size, size);
    }
  }

  function getMaterialMaps(type, variant) {
    if (!window.THREE) return null;
    const key = `${type}:${variant || "default"}`;
    if (materialCache.has(key)) return materialCache.get(key);

    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    drawProcedural(type, variant, canvas.getContext("2d"), size);

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(type === "floor" ? 6 : 2.5, type === "floor" ? 6 : 2.5);
    map.anisotropy = 16;
    if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;

    const normalMap = normalMapFromCanvas(canvas, type === "metal" ? 2 : 5);
    normalMap.repeat.copy(map.repeat);

    const bundle = {
      map,
      normalMap,
      roughness: type === "metal" ? 0.35 : type === "mdf" ? 0.88 : type === "stone" ? 0.42 : 0.72,
      metalness: type === "metal" ? 0.62 : 0.04,
    };
    materialCache.set(key, bundle);
    return bundle;
  }

  function createSurfaceMaterial(type, variant, colorHex) {
    const maps = getMaterialMaps(type, variant);
    if (!maps) return new THREE.MeshStandardMaterial({ color: colorHex });
    return new THREE.MeshStandardMaterial({
      map: maps.map,
      normalMap: maps.normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      color: colorHex,
      roughness: maps.roughness,
      metalness: maps.metalness,
    });
  }

  window.Texture3D = {
    getMaterialMaps,
    getTextureByType(type, variant) {
      return getMaterialMaps(type, variant)?.map || null;
    },
    createSurfaceMaterial,
  };
})();
