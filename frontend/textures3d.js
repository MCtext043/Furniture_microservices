/** Material and furniture helpers for the 3D planner. */
(function () {
  const proceduralBundleCache = new Map();
  const externalBundleCache = new Map();
  const warnedMissingBundles = new Set();
  const panelGeometryCache = new Map();
  const PBR_ASSET_BASE = "./frontend-assets/textures";
  const TEXTURE_SIZE = 1024;
  const DEV_MODE = typeof window !== "undefined" && /localhost|127\.0\.0\.1/i.test(window.location.hostname);

  const FILE_TEXTURE_LIBRARY = {
    wood_dark_oak: { material: "wood", dir: "wood/dark-oak", files: { map: "basecolor.png" }, realWidthMm: 1250, realHeightMm: 1250, thicknessMm: 18 },
    wood_oak: { material: "wood", dir: "wood/light-oak", files: { map: "basecolor.png" }, realWidthMm: 1250, realHeightMm: 1250, thicknessMm: 18 },
    board_black: { material: "board", dir: "board/black-board", files: { map: "basecolor.png" }, realWidthMm: 1250, realHeightMm: 1250, thicknessMm: 18 },
    board_white: { material: "board", dir: "board/white-board", files: { map: "basecolor-v2.png" }, realWidthMm: 700, realHeightMm: 700, roughness: 0.7, normalScale: 0.16, thicknessMm: 18 },
    fabric_gray: { material: "fabric", dir: "fabric/gray-weave", files: { map: "basecolor.png" }, realWidthMm: 1250, realHeightMm: 1250, thicknessMm: 30 },
    metal_graphite: { material: "metal", dir: "metal/graphite-brush", files: { map: "basecolor.png" }, realWidthMm: 1250, realHeightMm: 1250, thicknessMm: 2 },
    mdf_matte: { material: "mdf", dir: "mdf/matte-soft", files: { map: "basecolor-v2.png" }, realWidthMm: 800, realHeightMm: 800, roughness: 0.82, normalScale: 0.12, thicknessMm: 18 },
    laminate_grey: { material: "laminate", dir: "laminate/gray-laminate", files: { map: "basecolor-v2.png" }, realWidthMm: 1100, realHeightMm: 1100, roughness: 0.5, normalScale: 0.28, clearcoat: 0.1, thicknessMm: 18 },
    countertop: { material: "stone", dir: "stone/countertop-sand", files: { map: "basecolor-v2.png" }, realWidthMm: 1000, realHeightMm: 1000, roughness: 0.44, normalScale: 0.2, thicknessMm: 38 },
    "wood:default": { material: "wood", dir: "wood/light-oak", files: { map: "basecolor.png" }, realWidthMm: 1250, realHeightMm: 1250, thicknessMm: 18 },
    "board:default": { material: "board", dir: "board/white-board", files: { map: "basecolor.png" }, realWidthMm: 1250, realHeightMm: 1250, thicknessMm: 18 },
    "fabric:default": { material: "fabric", dir: "fabric/gray-weave", files: { map: "basecolor.png" }, realWidthMm: 1250, realHeightMm: 1250, thicknessMm: 30 },
    "metal:default": { material: "metal", dir: "metal/graphite-brush", files: { map: "basecolor.png" }, realWidthMm: 1250, realHeightMm: 1250, thicknessMm: 2 },
    "stone:default": { material: "stone", dir: "stone/countertop-sand", realWidthMm: 1600, realHeightMm: 1600, thicknessMm: 38 },
    "mdf:default": { material: "mdf", dir: "mdf/matte-soft", realWidthMm: 1200, realHeightMm: 2800, thicknessMm: 18 },
    "laminate:default": { material: "laminate", dir: "laminate/gray-laminate", realWidthMm: 1200, realHeightMm: 2800, thicknessMm: 18 },
    "floor:default": { material: "floor", dir: "room/oak-floor", realWidthMm: 1800, realHeightMm: 1800, thicknessMm: 60 },
    "wall:default": { material: "wall", dir: "room/plaster-wall", realWidthMm: 2400, realHeightMm: 2400, thicknessMm: 50 },
  };

  function rand(x, y, seed = 0) {
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  function fibrousNoise(x, y, seed = 0) {
    return (
      rand(x * 0.35, y * 0.35, seed) * 0.55 +
      rand(x * 0.8 + 17, y * 0.8 + 11, seed + 1) * 0.3 +
      rand(x * 1.7 + 29, y * 1.7 + 7, seed + 2) * 0.15
    );
  }

  function canvasLuminance(data, size, x, y) {
    const i = (y * size + x) * 4;
    return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
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

  function configureMapTexture(texture, isColorMap) {
    if (!texture) return;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 1;
    if ("colorSpace" in texture) {
      texture.colorSpace = isColorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    } else if (isColorMap && "encoding" in texture && THREE.sRGBEncoding) {
      texture.encoding = THREE.sRGBEncoding;
    }
  }

  function applyTextureTransform(texture, transform) {
    if (!texture) return null;
    const clone = texture.clone();
    clone.needsUpdate = true;
    clone.repeat.copy(transform.repeat);
    clone.rotation = transform.rotation;
    clone.center.set(0.5, 0.5);
    clone.offset.copy(transform.offset);
    clone.anisotropy = transform.anisotropy;
    return clone;
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
    configureMapTexture(tex, false);
    return tex;
  }

  function scalarMapFromCanvas(sourceCanvas, sampler) {
    const size = sourceCanvas.width;
    const src = sourceCanvas.getContext("2d").getImageData(0, 0, size, size);
    const out = new ImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const lum = canvasLuminance(src.data, size, x, y);
        const value = clamp(sampler(lum, x, y), 0, 1);
        const v = Math.round(value * 255);
        out.data[idx] = v;
        out.data[idx + 1] = v;
        out.data[idx + 2] = v;
        out.data[idx + 3] = 255;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.getContext("2d").putImageData(out, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    configureMapTexture(tex, false);
    return tex;
  }

  function copyUvToUv2(geometry) {
    if (!geometry?.attributes?.uv || geometry.attributes.uv2) return;
    geometry.setAttribute("uv2", geometry.attributes.uv.clone());
  }

  function normalizeGeometryUvs(geometry) {
    const uv = geometry?.attributes?.uv;
    if (!uv) return;
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      minU = Math.min(minU, uv.getX(i));
      minV = Math.min(minV, uv.getY(i));
      maxU = Math.max(maxU, uv.getX(i));
      maxV = Math.max(maxV, uv.getY(i));
    }
    const spanU = Math.max(maxU - minU, 0.0001);
    const spanV = Math.max(maxV - minV, 0.0001);
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (uv.getX(i) - minU) / spanU, (uv.getY(i) - minV) / spanV);
    }
    uv.needsUpdate = true;
  }

  function loadTexture(url, isColorMap) {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        url,
        (texture) => {
          configureMapTexture(texture, isColorMap);
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  function externalLibraryKey(type, variant) {
    return FILE_TEXTURE_LIBRARY[variant] ? variant : `${type}:${variant || "default"}`;
  }

  function warnMissingBundle(type, variant) {
    const key = `${type}:${variant || "default"}`;
    if (!DEV_MODE || warnedMissingBundles.has(key)) return;
    warnedMissingBundles.add(key);
    console.warn(`[materials] PBR bundle not found: ${type}/${variant || "default"}; procedural fallback used`);
  }

  async function loadExternalBundle(type, variant) {
    const libKey = externalLibraryKey(type, variant);
    const meta = FILE_TEXTURE_LIBRARY[libKey];
    if (!meta || !window.THREE) return null;
    if (externalBundleCache.has(libKey)) return externalBundleCache.get(libKey);

    const bundlePromise = (async () => {
      const bundle = { meta, source: "external", textures: {} };
      let foundAny = false;

      for (const [key, fileName] of Object.entries(meta.files || {})) {
        const url = `${PBR_ASSET_BASE}/${meta.dir}/${fileName}`;
        try {
          const texture = await loadTexture(url, key === "map");
          bundle.textures[key] = texture;
          foundAny = true;
        } catch {
          // Ignore and keep fallback texture for this map.
        }
      }

      if (!foundAny) {
        warnMissingBundle(type, variant);
        return null;
      }
      return bundle;
    })();

    externalBundleCache.set(libKey, bundlePromise);
    return bundlePromise;
  }

  function drawWood(ctx, size, pal) {
    ctx.fillStyle = pal.base;
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) {
      const band = fibrousNoise(y * 0.02, y * 0.003, 3);
      const wave = Math.sin(y * 0.024) * 14 + Math.sin(y * 0.009 + 1.3) * 22 + (band - 0.5) * 26;
      ctx.strokeStyle = band > 0.57 ? pal.grain : pal.highlight;
      ctx.globalAlpha = 0.16 + band * 0.28;
      ctx.lineWidth = 0.7 + band * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 18) {
        const knotPull = Math.sin((x + y) * 0.015) * 5 + (fibrousNoise(x * 0.015, y * 0.02, 9) - 0.5) * 8;
        ctx.lineTo(x, y + wave + knotPull);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 12; i++) {
      const kx = (size * (0.12 + i * 0.071)) % size;
      const ky = (size * (0.18 + i * 0.113)) % size;
      const rx = 22 + (i % 4) * 8;
      const grad = ctx.createRadialGradient(kx, ky, 1, kx, ky, rx);
      grad.addColorStop(0, "rgba(25,15,8,0.38)");
      grad.addColorStop(0.4, "rgba(55,32,15,0.14)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(kx - rx - 6, ky - rx - 6, rx * 2 + 12, rx * 2 + 12);
    }
    for (let i = 0; i < 6500; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const alpha = Math.random() * 0.03;
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(20,10,5,${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function drawProcedural(type, variant, ctx, size) {
    const woodPalette = {
      wood_dark_oak: { base: "#6a4630", grain: "#4e3321", highlight: "#946447" },
      wood_oak: { base: "#caa07b", grain: "#9c7654", highlight: "#ead0ae" },
      default: { base: "#a37650", grain: "#6f4a2e", highlight: "#cf9d72" },
    };

    if (type === "wood") {
      drawWood(ctx, size, woodPalette[variant] || woodPalette.default);
    } else if (type === "mdf") {
      ctx.fillStyle = "#ece8e2";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 12000; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.016})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
      }
    } else if (type === "laminate") {
      ctx.fillStyle = "#a8adb5";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 4) {
        ctx.strokeStyle = y % 10 === 0 ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.035)";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
    } else if (type === "stone") {
      ctx.fillStyle = "#d6cdc2";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 8 + Math.random() * 52;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(255,255,255,0.15)");
        g.addColorStop(0.45, "rgba(155,140,125,0.08)");
        g.addColorStop(1, "rgba(80,70,60,0.06)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === "metal") {
      ctx.fillStyle = "#8b9199";
      ctx.fillRect(0, 0, size, size);
      for (let i = -size; i < size * 2; i += 5) {
        ctx.strokeStyle = `rgba(255,255,255,${0.04 + ((i / 5) % 10) / 125})`;
        ctx.lineWidth = 1;
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
      for (let i = 0; i <= 18; i++) {
        ctx.strokeStyle = i % 5 === 0 ? dark : "rgba(0,0,0,0.05)";
        ctx.lineWidth = i % 5 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(0, i * (size / 18));
        ctx.lineTo(size, i * (size / 18));
        ctx.stroke();
      }
    } else if (type === "fabric") {
      ctx.fillStyle = variant === "fabric_gray" ? "#6b7280" : "#64748b";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 4) {
        for (let x = 0; x < size; x += 4) {
          const noise = fibrousNoise(x * 0.12, y * 0.12, 21);
          ctx.fillStyle = noise > 0.52 ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.05)";
          ctx.fillRect(x, y, 2, 2);
        }
      }
    } else if (type === "floor") {
      const plankW = size / 10;
      for (let col = 0; col < 10; col++) {
        ctx.fillStyle = col % 2 ? "#a8845f" : "#c9a67a";
        ctx.fillRect(col * plankW, 0, plankW - 3, size);
      }
    } else if (type === "wall") {
      ctx.fillStyle = "#f7f3ec";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.016})`;
        ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
      }
    } else {
      ctx.fillStyle = "#64748b";
      ctx.fillRect(0, 0, size, size);
    }
  }

  function getMaterialDefinition(type, variant) {
    const libKey = externalLibraryKey(type, variant);
    const meta = FILE_TEXTURE_LIBRARY[libKey] || FILE_TEXTURE_LIBRARY[`${type}:default`] || {
      material: type,
      realWidthMm: 900,
      realHeightMm: 900,
      thicknessMm: 18,
    };
    return {
      id: variant || "default",
      type,
      realWidthMm: meta.realWidthMm || 900,
      realHeightMm: meta.realHeightMm || 900,
      roughness: meta.roughness ?? (type === "metal" ? 0.32 : type === "wood" ? 0.56 : type === "fabric" ? 0.88 : 0.68),
      metalness: meta.metalness ?? (type === "metal" ? 0.86 : 0),
      normalScale: meta.normalScale ?? (type === "wood" ? 0.35 : 0.22),
      clearcoat: meta.clearcoat ?? 0,
      thicknessMm: meta.thicknessMm || 18,
      edgeThicknessMm: meta.edgeThicknessMm || 1,
    };
  }

  function getProceduralBundle(type, variant) {
    const key = `${type}:${variant || "default"}`;
    if (proceduralBundleCache.has(key)) return proceduralBundleCache.get(key);

    const size = TEXTURE_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    drawProcedural(type, variant, canvas.getContext("2d", { willReadFrequently: true }), size);

    const map = new THREE.CanvasTexture(canvas);
    configureMapTexture(map, true);

    const normalMap = normalMapFromCanvas(canvas, type === "metal" ? 2.1 : type === "fabric" ? 2.8 : 3.4);
    const roughnessMap = scalarMapFromCanvas(canvas, (lum, x, y) => {
      if (type === "metal") return 0.18 + lum * 0.22 + rand(x * 0.04, y * 0.04, 51) * 0.05;
      if (type === "stone") return 0.48 + (1 - lum) * 0.18;
      if (type === "fabric") return 0.8 + rand(x * 0.06, y * 0.06, 13) * 0.12;
      if (type === "board") return 0.46 + (1 - lum) * 0.12;
      if (type === "laminate") return 0.38 + (1 - lum) * 0.1;
      if (type === "wood") return 0.48 + (1 - lum) * 0.18;
      return 0.62 + (1 - lum) * 0.12;
    });
    const aoMap = scalarMapFromCanvas(canvas, (lum) => 0.62 + (1 - lum) * 0.2);

    const bundle = {
      source: "procedural",
      textures: { map, normalMap, roughnessMap, aoMap },
      definition: getMaterialDefinition(type, variant),
      roughness: type === "metal" ? 0.3 : type === "mdf" ? 0.84 : type === "stone" ? 0.52 : type === "fabric" ? 0.9 : 0.64,
      metalness: type === "metal" ? 0.74 : 0,
      clearcoat: type === "laminate" || type === "board" ? 0.12 : 0,
      clearcoatRoughness: type === "laminate" ? 0.3 : 0.5,
      normalScale: type === "metal" ? 0.42 : type === "fabric" ? 0.25 : type === "wood" ? 0.35 : 0.22,
    };
    proceduralBundleCache.set(key, bundle);
    return bundle;
  }

  function getAnisotropy() {
    const renderer = window.__room3dRenderer;
    if (!renderer?.capabilities?.getMaxAnisotropy) return 8;
    return Math.max(1, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  }

  function buildTextureTransform(widthMm, heightMm, definition, orientation) {
    const repeatX = clamp(widthMm / Math.max(definition.realWidthMm, 1), 0.25, 24);
    const repeatY = clamp(heightMm / Math.max(definition.realHeightMm, 1), 0.25, 24);
    const horizontalGrain = orientation === "horizontal";
    return {
      repeat: new THREE.Vector2(horizontalGrain ? repeatY : repeatX, horizontalGrain ? repeatX : repeatY),
      rotation: horizontalGrain ? Math.PI / 2 : 0,
      offset: new THREE.Vector2(0, 0),
      anisotropy: getAnisotropy(),
    };
  }

  function materialColor(type, colorHex, hasColorTexture) {
    if (hasColorTexture) return 0xffffff;
    if (colorHex != null) return colorHex;
    if (type === "metal") return 0x9ca3af;
    if (type === "wood") return 0xb78963;
    return 0xe5e7eb;
  }

  function applyBundleToMaterial(material, bundle, transform, type) {
    const textures = bundle.textures || {};
    material.map = applyTextureTransform(textures.map, transform);
    material.normalMap = applyTextureTransform(textures.normalMap, transform);
    material.roughnessMap = applyTextureTransform(textures.roughnessMap, transform);
    material.aoMap = applyTextureTransform(textures.aoMap, transform);
    material.metalnessMap = applyTextureTransform(textures.metalnessMap, transform);
    material.normalScale = new THREE.Vector2(bundle.normalScale || 0.35, bundle.normalScale || 0.35);
    material.roughness = bundle.roughness;
    material.metalness = bundle.metalness;
    material.clearcoat = bundle.clearcoat || 0;
    material.clearcoatRoughness = bundle.clearcoatRoughness || 0.5;
    material.aoMapIntensity = type === "wall" ? 0.15 : 0.55;
    material.userData.materialSource = bundle.source;
    material.needsUpdate = true;
  }

  function createSurfaceMaterial(type, variant, colorHex, options = {}) {
    if (!window.THREE) return null;
    const definition = getMaterialDefinition(type, variant);
    const widthMm = options.widthMm || definition.realWidthMm;
    const heightMm = options.heightMm || definition.realHeightMm;
    const transform = buildTextureTransform(widthMm, heightMm, definition, options.orientation || "horizontal");
    const procedural = getProceduralBundle(type, variant);
    const MaterialCtor = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
    const material = new MaterialCtor({
      color: materialColor(type, colorHex, true),
      roughness: procedural.roughness,
      metalness: procedural.metalness,
      clearcoat: procedural.clearcoat,
      clearcoatRoughness: procedural.clearcoatRoughness,
    });

    material.userData.materialDefinition = definition;
    applyBundleToMaterial(material, procedural, transform, type);

    loadExternalBundle(type, variant).then((external) => {
      if (!external) return;
      const enriched = {
        ...procedural,
        ...external,
        textures: { ...procedural.textures, ...external.textures },
        source: "external",
        definition,
        roughness: type === "wood" ? 0.48 : definition.roughness,
        metalness: definition.metalness,
        normalScale: definition.normalScale,
        clearcoat: definition.clearcoat,
      };
      applyBundleToMaterial(material, enriched, transform, type);
    });

    return material;
  }

  function prepareGeometry(geometry) {
    copyUvToUv2(geometry);
    return geometry;
  }

  function cloneMaterialTone(material, scalar = 1) {
    const clone = material.clone();
    clone.userData = { ...(material.userData || {}) };
    if (clone.color) clone.color.multiplyScalar(clamp(scalar, 0.92, 1.06));
    return clone;
  }

  function createRoundedPanelGeometry(width, height, depth, radiusMm) {
    const radius = clamp(radiusMm, 0, Math.min(width, height, depth) * 0.1);
    const key = [width, height, depth, radius].join(":");
    if (panelGeometryCache.has(key)) return panelGeometryCache.get(key);
    if (!radius || !THREE.ExtrudeGeometry) {
      const simple = prepareGeometry(new THREE.BoxGeometry(width, height, depth));
      panelGeometryCache.set(key, simple);
      return simple;
    }
    const shape = new THREE.Shape();
    roundRect(shape, -width / 2, -height / 2, width, height, radius);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: radius * 0.45,
      bevelThickness: radius * 0.45,
      curveSegments: 3,
    });
    geometry.translate(0, 0, -depth / 2);
    normalizeGeometryUvs(geometry);
    prepareGeometry(geometry);
    panelGeometryCache.set(key, geometry);
    return geometry;
  }

  function panelMesh(width, height, depth, material, options = {}) {
    const geometry = createRoundedPanelGeometry(width, height, depth, options.radiusMm || 1.6);
    return new THREE.Mesh(geometry, material);
  }

  function bodyLuminance(bodyMat) {
    const color = bodyMat?.color || new THREE.Color(0xcccccc);
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  }

  function createMetalHandleMaterial(bodyMat) {
    const darkHandles = bodyLuminance(bodyMat) > 0.52;
    return new THREE.MeshStandardMaterial({
      color: darkHandles ? 0x23272e : 0xe5e7eb,
      metalness: 0.95,
      roughness: darkHandles ? 0.28 : 0.34,
    });
  }

  function resolveFurnitureMaterials(item, w, h, d, input) {
    if (input?.body) return input;
    const body = input;
    const bodyMat = body;
    const facadeMat = cloneMaterialTone(bodyMat, 1);
    const interiorMat = cloneMaterialTone(bodyMat, 1);
    const backMat = createSurfaceMaterial("board", "board_white", 0xffffff, {
      widthMm: w,
      heightMm: h,
      orientation: "vertical",
    });
    const edgeMat = cloneMaterialTone(bodyMat, 1);
    const countertopMat = item.type === "table"
      ? createSurfaceMaterial("wood", item.texture || "wood_oak", 0xffffff, { widthMm: w, heightMm: d, orientation: "horizontal" })
      : facadeMat;
    const handles = createMetalHandleMaterial(bodyMat);
    return {
      body: bodyMat,
      facade: facadeMat,
      edge: edgeMat,
      back: backMat,
      countertop: countertopMat,
      handles,
      interior: interiorMat,
    };
  }

  function addHandleBar(group, x, y, z, vertical, material) {
    const handle = panelMesh(vertical ? 12 : 110, vertical ? 110 : 12, 14, material, { radiusMm: 1 });
    handle.position.set(x, y, z);
    group.add(handle);
  }

  function addPanel(group, width, height, depth, material, x, y, z, radiusMm = 1.5) {
    const mesh = panelMesh(Math.max(width, 1), Math.max(height, 1), Math.max(depth, 1), material, { radiusMm });
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  function finishFurnitureGroup(group, w, h, d) {
    group.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return group;
  }

  function buildWardrobeGroup(item, w, h, d, materials) {
    const group = new THREE.Group();
    const panelTh = clamp(materials.body?.userData?.materialDefinition?.thicknessMm || 18, 16, 22);
    const kickH = clamp(h * 0.045, 30, 110);
    const innerW = w - panelTh * 2;
    const bodyH = h - kickH;
    const frontZ = d / 2 + panelTh * 0.42;
    const facadeDepth = Math.max(16, panelTh * 0.72);
    const gap = 4;

    addPanel(group, w - panelTh * 1.5, kickH, panelTh * 1.4, materials.body, 0, kickH / 2, d / 2 - panelTh * 1.8, 1);
    addPanel(group, panelTh, bodyH, d, materials.body, -w / 2 + panelTh / 2, kickH + bodyH / 2, 0);
    addPanel(group, panelTh, bodyH, d, materials.body, w / 2 - panelTh / 2, kickH + bodyH / 2, 0);
    addPanel(group, innerW, panelTh, d, materials.body, 0, h - panelTh / 2, 0);
    addPanel(group, innerW, panelTh, d, materials.body, 0, kickH + panelTh / 2, 0);
    addPanel(group, innerW, bodyH - panelTh * 1.5, 7, materials.back, 0, kickH + bodyH / 2, -d / 2 + 5, 0.6);

    const lowerDoorH = clamp(bodyH * 0.2, 60, 480);
    const drawerH = clamp(bodyH * 0.105, 42, 230);
    const topDoorBottom = kickH + lowerDoorH + drawerH * 2 + gap * 3;
    const topDoorH = Math.max(70, h - panelTh - topDoorBottom - gap);
    const doorW = (w - panelTh * 1.2 - gap) / 2;

    [-1, 1].forEach((side) => {
      const x = side * (doorW / 2 + gap / 2);
      addPanel(group, doorW, topDoorH, facadeDepth, materials.facade, x, topDoorBottom + topDoorH / 2, frontZ, 1.4);
      addHandleBar(group, side * 28, topDoorBottom + topDoorH * 0.45, frontZ + facadeDepth * 0.9, true, materials.handles);

      addPanel(group, doorW, lowerDoorH, facadeDepth, materials.facade, x, kickH + lowerDoorH / 2, frontZ, 1.4);
      addHandleBar(group, side * 28, kickH + lowerDoorH * 0.62, frontZ + facadeDepth * 0.9, true, materials.handles);
    });

    for (let i = 0; i < 2; i++) {
      const y = kickH + lowerDoorH + gap * (i + 1) + drawerH * (i + 0.5);
      addPanel(group, w - panelTh * 1.2, drawerH - gap, facadeDepth, materials.facade, 0, y, frontZ, 1.4);
      addHandleBar(group, 0, y, frontZ + facadeDepth * 0.9, false, materials.handles);
    }

    const shelfY = topDoorBottom + topDoorH * 0.55;
    addPanel(group, innerW, panelTh, d - panelTh * 2, materials.interior, 0, shelfY, -panelTh * 0.2, 1.2);
    addPanel(group, panelTh, topDoorH, d - panelTh * 2, materials.interior, 0, topDoorBottom + topDoorH / 2, -panelTh * 0.2, 1.2);
    return finishFurnitureGroup(group, w, h, d);
  }

  function buildSofaGroup(item, w, h, d, materials) {
    const group = new THREE.Group();
    const legH = clamp(h * 0.09, 35, 95);
    const armW = clamp(w * 0.095, 90, 190);
    const seatY = clamp(h * 0.38, 130, 440);
    const seatH = clamp(h * 0.12, 50, 150);
    const baseH = Math.max(55, seatY - seatH / 2 - legH);
    const cushionCount = w > 1900 ? 3 : 2;
    const gap = 14;
    const innerW = w - armW * 2 - gap * 2;
    const cushionW = (innerW - gap * (cushionCount - 1)) / cushionCount;
    const upholsteryDark = cloneMaterialTone(materials.facade, 0.96);

    addPanel(group, w - armW * 0.7, baseH, d * 0.78, upholsteryDark, 0, legH + baseH / 2, d * 0.04, 8);
    addPanel(group, armW, seatY + seatH * 0.45, d * 0.86, materials.body, -w / 2 + armW / 2, legH + (seatY + seatH * 0.45) / 2, 0, 16);
    addPanel(group, armW, seatY + seatH * 0.45, d * 0.86, materials.body, w / 2 - armW / 2, legH + (seatY + seatH * 0.45) / 2, 0, 16);

    for (let i = 0; i < cushionCount; i++) {
      const x = -innerW / 2 + cushionW / 2 + i * (cushionW + gap);
      addPanel(group, cushionW, seatH, d * 0.58, materials.facade, x, seatY, d * 0.08, 18);
      const backH = Math.max(100, h - seatY - seatH * 0.25);
      const back = addPanel(group, cushionW, backH, clamp(d * 0.16, 120, 190), materials.facade, x, seatY + backH / 2 + seatH * 0.18, -d * 0.31, 22);
      back.rotation.x = -0.08;
    }

    const footSize = clamp(Math.min(w, d) * 0.035, 35, 60);
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
      addPanel(group, footSize, legH, footSize, materials.handles, sx * (w / 2 - armW * 0.72), legH / 2, sz * (d * 0.31), 2);
    }));
    return finishFurnitureGroup(group, w, h, d);
  }

  function buildTableGroup(item, w, h, d, materialSet) {
    const group = new THREE.Group();
    const topTh = (materialSet.countertop?.userData?.materialDefinition?.thicknessMm || 38);
    const topThickness = clamp(topTh, 28, 44);
    const legH = h - topThickness;
    const legSize = clamp(Math.min(w, d) * 0.06, 34, 68);
    const inset = legSize * 1.15;
    const apronH = clamp(h * 0.07, 52, 84);

    const top = panelMesh(w, topThickness, d, materialSet.countertop, { radiusMm: 2 });
    top.position.y = h - topThickness / 2;
    group.add(top);

    const apronY = h - topThickness - apronH / 2 - 24;
    [
      [w - inset * 1.4, apronH, 20, 0, apronY, -d / 2 + inset],
      [w - inset * 1.4, apronH, 20, 0, apronY, d / 2 - inset],
      [20, apronH, d - inset * 1.4, -w / 2 + inset, apronY, 0],
      [20, apronH, d - inset * 1.4, w / 2 - inset, apronY, 0],
    ].forEach(([pw, ph, pd, px, py, pz]) => {
      const apron = panelMesh(pw, ph, pd, materialSet.body, { radiusMm: 1.4 });
      apron.position.set(px, py, pz);
      group.add(apron);
    });

    [
      [-w / 2 + inset, legH / 2, -d / 2 + inset],
      [w / 2 - inset, legH / 2, -d / 2 + inset],
      [-w / 2 + inset, legH / 2, d / 2 - inset],
      [w / 2 - inset, legH / 2, d / 2 - inset],
    ].forEach(([x, y, z]) => {
      const leg = panelMesh(legSize, legH, legSize, materialSet.handles, { radiusMm: 1 });
      leg.position.set(x, y, z);
      group.add(leg);
    });

    return finishFurnitureGroup(group, w, h, d);
  }

  function buildFurnitureGroup(item, w, h, d, materialsInput) {
    const materialSet = resolveFurnitureMaterials(item, w, h, d, materialsInput);
    if (item.type === "wardrobe") {
      return buildWardrobeGroup(item, w, h, d, materialSet);
    }
    if (item.type === "sofa") {
      return buildSofaGroup(item, w, h, d, materialSet);
    }
    if (item.type === "table") {
      return buildTableGroup(item, w, h, d, materialSet);
    }

    const group = new THREE.Group();
    const bodyDef = materialSet.body?.userData?.materialDefinition || { thicknessMm: 18 };
    const panelTh = clamp(bodyDef.thicknessMm || 18, 16, 22);
    const edgeTh = clamp(bodyDef.edgeThicknessMm || 1, 1, 2);
    const backTh = item.type === "wardrobe" ? 8 : 6;
    const kickH = item.type === "wardrobe" ? 0 : 90;
    const bodyH = h - kickH;
    const innerW = Math.max(140, w - panelTh * 2);
    const innerD = Math.max(180, d - panelTh - 24);
    const facadeGap = item.type === "wardrobe" ? 3 : 2.5;
    const facadeOffset = panelTh * 0.42;

    if (kickH > 0) {
      const kick = panelMesh(w - panelTh * 1.3, kickH, Math.max(24, panelTh), materialSet.body, { radiusMm: 1.2 });
      kick.position.set(0, kickH / 2, d / 2 - panelTh * 1.35);
      group.add(kick);
    }

    const sideLeft = panelMesh(panelTh, bodyH, d, materialSet.body, { radiusMm: 1.5 });
    sideLeft.position.set(-w / 2 + panelTh / 2, kickH + bodyH / 2, 0);
    group.add(sideLeft);

    const sideRight = panelMesh(panelTh, bodyH, d, materialSet.body, { radiusMm: 1.5 });
    sideRight.position.set(w / 2 - panelTh / 2, kickH + bodyH / 2, 0);
    group.add(sideRight);

    const top = panelMesh(innerW, panelTh, d, materialSet.body, { radiusMm: 1.5 });
    top.position.set(0, h - panelTh / 2, 0);
    group.add(top);

    const bottom = panelMesh(innerW, panelTh, d, materialSet.body, { radiusMm: 1.5 });
    bottom.position.set(0, kickH + panelTh / 2, 0);
    group.add(bottom);

    const back = panelMesh(innerW, Math.max(120, bodyH - panelTh * 1.4), backTh, materialSet.back, { radiusMm: 0.8 });
    back.position.set(0, kickH + bodyH / 2, -d / 2 + backTh / 2 + 2);
    group.add(back);

    if (item.type === "shelf" || item.type === "wardrobe") {
      const shelfCount = item.type === "wardrobe" ? 3 : 4;
      for (let i = 1; i <= shelfCount; i++) {
        const y = kickH + panelTh + ((bodyH - panelTh * 2) / (shelfCount + 1)) * i;
        const shelf = panelMesh(innerW, panelTh * 0.9, innerD, materialSet.interior, { radiusMm: 1.4 });
        shelf.position.set(0, y, panelTh * 0.12);
        group.add(shelf);
      }
      if (item.type === "shelf" && innerW > 650) {
        const dividerH = bodyH - panelTh * 2;
        [-1, 1].forEach((side) => {
          const divider = panelMesh(panelTh * 0.9, dividerH * 0.46, innerD, materialSet.interior, { radiusMm: 1.2 });
          divider.position.set(side * innerW * 0.22, kickH + panelTh + dividerH * (side < 0 ? 0.25 : 0.72), panelTh * 0.12);
          group.add(divider);
        });
      }
    }

    const drawerCount = Number(item.drawers) || (item.type === "cabinet" ? 2 : 0);
    if (drawerCount > 0) {
      const gap = clamp(panelTh * 0.16, 2, 4);
      const fullGap = gap * (drawerCount + 1);
      const drawerH = (bodyH - fullGap) / drawerCount;
      for (let i = 0; i < drawerCount; i++) {
        const y = kickH + gap + drawerH / 2 + i * (drawerH + gap);
        const front = panelMesh(w - panelTh * 0.8, drawerH - gap, Math.max(18, panelTh * 0.7), materialSet.facade, { radiusMm: 1.4 });
        front.position.set(0, y, d / 2 + facadeOffset);
        group.add(front);

        const drawerBox = panelMesh(innerW - 12, Math.max(58, drawerH * 0.72), innerD * 0.88, materialSet.interior, { radiusMm: 1.2 });
        drawerBox.position.set(0, y, -panelTh * 0.08);
        group.add(drawerBox);

        addHandleBar(group, 0, y, d / 2 + panelTh * 0.92, false, materialSet.handles);
      }
    }

    if (item.type === "wardrobe") {
      const doorGap = facadeGap;
      const doorW = (w - panelTh * 2 - doorGap) / 2;
      [-1, 1].forEach((side) => {
        const door = panelMesh(doorW, bodyH - panelTh * 0.8, Math.max(16, panelTh * 0.65), materialSet.facade, { radiusMm: 1.4 });
        door.position.set(side * (doorW / 2 + doorGap / 2), kickH + bodyH / 2, d / 2 + facadeOffset);
        group.add(door);
        addHandleBar(group, side * (doorW / 2 - 28), kickH + bodyH / 2, d / 2 + panelTh * 0.96, true, materialSet.handles);
      });
    } else if (item.type === "cabinet" && drawerCount === 0) {
      const door = panelMesh(w - panelTh * 0.7, bodyH - panelTh * 0.8, Math.max(16, panelTh * 0.65), materialSet.facade, { radiusMm: 1.4 });
      door.position.set(0, kickH + bodyH / 2, d / 2 + facadeOffset);
      group.add(door);
      addHandleBar(group, 0, kickH + bodyH * 0.62, d / 2 + panelTh * 0.96, false, materialSet.handles);
    }

    if (edgeTh > 0.8) {
      const edgeTop = panelMesh(innerW, edgeTh, 6, materialSet.edge, { radiusMm: 0.6 });
      edgeTop.position.set(0, h - edgeTh / 2, d / 2 + 2);
      group.add(edgeTop);
    }

    if (item.type === "cabinet") {
      const capThickness = clamp(panelTh * 1.45, 24, 34);
      const cap = panelMesh(w + 18, capThickness, d + 14, materialSet.countertop, { radiusMm: 2 });
      cap.position.set(0, h - capThickness / 2 + 3, 0);
      group.add(cap);
    }

    group.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    return group;
  }

  window.Texture3D = {
    getMaterialDefinition,
    getMaterialMaps(type, variant) {
      return getProceduralBundle(type, variant)?.textures || null;
    },
    getTextureByType(type, variant) {
      return getProceduralBundle(type, variant)?.textures?.map || null;
    },
    createSurfaceMaterial,
    prepareGeometry,
    buildFurnitureGroup,
    cloneMaterialTone,
  };
})();
