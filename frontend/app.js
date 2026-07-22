const APP_MODE = window.APP_MODE || "user";
const LS_API = "furniture_gateway_url";
const LS_TOKEN = "furniture_jwt";
const LS_CUSTOMER = "furniture_customer_name";

const state = {
  categories: [],
  products: [],
  activeCategory: "all",
  search: "",
  cart: [],
  roles: [],
  deliverySettings: null,
  deliveryQuote: null,
  deliveryAddress: "",
  projectId: null,
  three: null,
  cuttingParts: [],
  roomConfig: { width: 6000, length: 5000, height: 2800 },
  objects3d: [],
  drag: { active: false, id: null, startX: 0, startY: 0, baseX: 0, baseZ: 0 },
  rotate: { active: false, id: null, centerX: 0, centerY: 0, startAngle: 0, baseRotation: 0 },
  cameraDrag: { active: false, startX: 0, startY: 0 },
  lastCutResult: null,
  selectedCutJobId: null,
  crm: { orders: [], warehouse: [], procurementByOrder: {}, tab: "active" },
  userOrders: [],
  userProjects: [],
  selectedTier: "standard",
  selected3dObjectId: null,
  productPhotoUrls: {},
};

const productEditorPhotos = { existing: [], pending: [], removed: [] };

const demoCategories = ["Кухни", "Шкафы", "Гостиные", "Спальни", "Офис", "Детские"];
const demoProducts = [
  ["Кухня Nord Line", "DEMO-KITCHEN-NORD", "FurniPro", "Кухни", 184900, 4, "Полный кухонный гарнитур с матовыми фасадами", "🍽️", "linear-gradient(135deg,#bf7b45,#f1c27d)"],
  ["Кровать Loft Oak", "DEMO-BED-LOFT", "OakLab", "Спальни", 75900, 3, "Двуспальная кровать с ящиками хранения", "🛏️", "linear-gradient(135deg,#855e42,#d9b88f)"],
  ["Стол Manager Pro", "DEMO-DESK-MANAGER", "OfficeWood", "Офис", 35900, 12, "Рабочий стол с кабель-каналом", "💼", "linear-gradient(135deg,#293241,#98c1d9)"],
  ["Стеллаж Kids Castle", "DEMO-KIDS-CASTLE", "HappyRoom", "Детские", 28900, 7, "Цветной стеллаж для книг и игрушек", "🧸", "linear-gradient(135deg,#ff9a9e,#fad0c4)"],
  ["Комод Scandi 120", "DEMO-DRESSER-SCANDI", "NordHome", "Спальни", 42900, 6, "Комод с натуральной шпонированной отделкой", "🪵", "linear-gradient(135deg,#8d6e63,#d7ccc8)"],
  ["ТВ-тумба Cinema", "DEMO-TV-CINEMA", "MediaRoom", "Гостиные", 38900, 9, "Низкая тумба для гостиной с мягким закрыванием", "📺", "linear-gradient(135deg,#434343,#b7b7b7)"],
  ["Кухонный остров Chef", "DEMO-ISLAND-CHEF", "FurniPro", "Кухни", 112000, 2, "Остров с барной зоной и местом хранения", "🥘", "linear-gradient(135deg,#4b6cb7,#182848)"],
  ["Переговорный стол Team", "DEMO-TABLE-TEAM", "OfficeWood", "Офис", 58900, 4, "Большой стол для переговорной", "🤝", "linear-gradient(135deg,#134e5e,#71b280)"],
  ["Гардероб Family", "DEMO-WARD-FAMILY", "WoodLine", "Шкафы", 129900, 2, "Встроенный гардероб с индивидуальным наполнением", "👗", "linear-gradient(135deg,#42275a,#734b6d)"],
  ["Детская система Nova", "DEMO-KIDS-NOVA", "HappyRoom", "Детские", 96900, 3, "Кровать, шкаф и рабочая зона в одном стиле", "🚀", "linear-gradient(135deg,#36d1dc,#5b86e5)"],
];

const RETIRED_DEMO_SKUS = ["DEMO-SOFA-CLOUD", "DEMO-WARD-VERONA"];

const defaultCuttingParts = [
  { name: "Боковина шкафа", width: 600, height: 2200, quantity: 2, allow_rotation: true },
  { name: "Полка", width: 560, height: 400, quantity: 5, allow_rotation: true },
  { name: "Фасад", width: 480, height: 720, quantity: 4, allow_rotation: false },
  { name: "Цоколь", width: 1800, height: 120, quantity: 1, allow_rotation: true },
];

const PRICING_TIERS = [
  { key: "standard", title: "Стандарт", material: 1, hardware: 1, labor: 1 },
  { key: "comfort", title: "Комфорт", material: 1.18, hardware: 1.25, labor: 1.1 },
  { key: "premium", title: "Премиум", material: 1.42, hardware: 1.55, labor: 1.22 },
];

const TIER_MATERIAL_PROFILES = {
  standard: {
    qty: { panel: 1, edge: 1, hinges: 1, slides: 1, screws: 1 },
    specs: ["ЛДСП 16 мм", "Кромка ПВХ 0,4 мм", "Петли стандарт", "Направляющие шариковые"],
    patterns: { panel: "дсп", edge: "кромка", hinges: "петл", slides: "направляющ", screws: "саморез" },
  },
  comfort: {
    qty: { panel: 1.06, edge: 1.14, hinges: 1.35, slides: 1.45, screws: 1.1 },
    specs: ["ЛДСП 18 мм, улучшенный декор", "Кромка ПВХ 2 мм", "Петли с доводчиком", "Направляющие полного выдвижения"],
    patterns: { panel: "дсп", edge: "кромка", hinges: "петл", slides: "направляющ", screws: "саморез" },
  },
  premium: {
    qty: { panel: 1.18, edge: 1.28, hinges: 1.65, slides: 1.8, screws: 1.2 },
    specs: ["МДФ фасады / шпон", "Кромка ABS 2 мм", "Blum / Hettich", "Tandembox / Legrabox"],
    patterns: { panel: "дсп", edge: "кромка", hinges: "blum", slides: "направляющ", screws: "саморез" },
  },
};

const CRM_STATUSES = ["конструктор", "закупка", "сборка", "готова"];
const CRM_STATUS_DONE = "готова";

const typePresets = {
  wardrobe: { title: "Шкаф", color: "#8B5E3C", texture: "wood" },
  cabinet: { title: "Тумба", color: "#A67C52", texture: "wood" },
  shelf: { title: "Стеллаж", color: "#B08968", texture: "wood" },
  table: { title: "Стол", color: "#4B5563", texture: "metal" },
  sofa: { title: "Диван", color: "#64748B", texture: "fabric" },
};

const texturePresets = {
  wood_dark_oak: { title: "Темный дуб", material: "wood", color: "#6B4423" },
  wood_oak: { title: "Светлый дуб", material: "wood", color: "#B68655" },
  board_black: { title: "Черное ДСП", material: "board", color: "#222629" },
  board_white: { title: "Белое ДСП", material: "board", color: "#E8E8E4" },
  fabric_gray: { title: "Серая ткань", material: "fabric", color: "#6C757D" },
  metal_graphite: { title: "Графитовый металл", material: "metal", color: "#495057" },
  mdf_matte: { title: "МДФ матовый", material: "mdf", color: "#B8AEA2" },
  laminate_grey: { title: "Ламинат серый", material: "laminate", color: "#85898B" },
  countertop: { title: "Столешница", material: "stone", color: "#C4B5A3" },
};

function sameOriginApiBase() {
  const { protocol, hostname, port } = window.location;
  const gatewayPorts = new Set(["8080", "8001", "8002", "8000", "443", "80"]);
  if (!port || gatewayPorts.has(port)) {
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }
  return null;
}

function apiBase() {
  const onPage = sameOriginApiBase();
  if (onPage) return onPage.replace(/\/$/, "");
  const input = document.getElementById("apiBase");
  if (input?.value?.trim()) return input.value.trim().replace(/\/$/, "");
  const stored = localStorage.getItem(LS_API);
  if (stored?.trim()) return stored.trim().replace(/\/$/, "");
  return defaultApiBase().replace(/\/$/, "");
}

function defaultApiBase() {
  const { protocol, hostname, port } = window.location;
  if (!port || port === "8080" || port === "8001" || port === "8002" || port === "443") {
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }
  const host = hostname || "127.0.0.1";
  return `http://${host}:8080`;
}

function token() {
  return localStorage.getItem(LS_TOKEN) || "";
}

function setToken(value) {
  value ? localStorage.setItem(LS_TOKEN, value) : localStorage.removeItem(LS_TOKEN);
  updateAccountButton();
}

function hasRole(role) {
  return state.roles.includes("admin") || state.roles.includes(role);
}

function isAdmin() {
  return hasRole("admin");
}

function canManageCatalog() {
  return isAdmin() || hasRole("catalog:write");
}

function canRunCutting() {
  return isAdmin() || hasRole("cutting:run");
}

function cartUserId() {
  return customerName() || "guest";
}

async function refreshAuth() {
  state.roles = [];
  if (!token()) return;
  try {
    const me = await api("GET", "/auth/me", undefined, true);
    state.roles = me.roles || [];
    if (me.username) setCustomerName(me.username);
  } catch {
    setToken("");
    state.roles = [];
  }
}

function customerName() {
  return localStorage.getItem(LS_CUSTOMER) || "";
}

function setCustomerName(value) {
  value ? localStorage.setItem(LS_CUSTOMER, value) : localStorage.removeItem(LS_CUSTOMER);
  updateAccountButton();
}

function updateAccountButton() {
  const btn = document.getElementById("accountBtn");
  if (!btn) return;
  const name = customerName();
  btn.textContent = name ? `Кабинет: ${name}` : "Войти";
  const ordersTab = document.getElementById("userOrdersTabNav");
  const projectsTab = document.getElementById("userProjectsTabNav");
  if (ordersTab) ordersTab.classList.toggle("d-none", !name);
  if (projectsTab) projectsTab.classList.toggle("d-none", !name);
  if (name && APP_MODE !== "admin") {
    loadUserOrders();
    loadUserProjects();
  }
}

function money(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

function toast(message, ok = true) {
  const host = document.querySelector(".toast-container");
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${ok ? "success" : "danger"} border-0 show`;
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function formatApiError(error) {
  const raw = String(error?.message || error || "");
  if (raw.includes("Invalid credentials")) {
    return "Неверный логин или пароль. На сервере используйте admin и пароль из deploy/local.env (AUTH_BOOTSTRAP_PASSWORD).";
  }
  return raw.replace(/^"|"$/g, "");
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function makeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isLikelyCorruptText(value, { treatEmptyAsCorrupt = false } = {}) {
  if (value == null) return treatEmptyAsCorrupt;
  const s = String(value);
  if (s.trim() === "") return treatEmptyAsCorrupt;
  if (s.includes("\uFFFD")) return true;
  const q = (s.match(/\?/g) || []).length;
  if (q === 0) return false;
  const coreLen = s.replace(/\s/g, "").length;
  if (coreLen === 0) return true;
  if (q >= Math.max(2, coreLen * 0.12)) return true;
  if (q >= 1 && coreLen <= 8) return true;
  return false;
}

function isLikelyCorruptCategoryName(name) {
  return isLikelyCorruptText(name, { treatEmptyAsCorrupt: true });
}

function demoRowForSku(sku) {
  return demoProducts.find((r) => r[1] === sku) || null;
}

function displayProductTitle(p) {
  const row = demoRowForSku(p.sku);
  if (row && isLikelyCorruptText(p.name)) return row[0];
  return p.name;
}

function displayProductBrand(p) {
  const row = demoRowForSku(p.sku);
  if (row && isLikelyCorruptText(p.brand)) return row[2];
  return p.brand;
}

function displayProductDescription(p) {
  const row = demoRowForSku(p.sku);
  const desc = p.description ?? "";
  if (row && isLikelyCorruptText(desc)) return row[6];
  return desc;
}

function inferDemoCategoryLabel(categoryId, products) {
  if (categoryId == null) return null;
  const tallies = new Map();
  for (const p of products) {
    if (p.category_id !== categoryId) continue;
    const row = demoProducts.find((r) => r[1] === p.sku);
    if (!row) continue;
    const label = row[3];
    tallies.set(label, (tallies.get(label) || 0) + 1);
  }
  if (!tallies.size) return null;
  return [...tallies.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function visibleCategories() {
  return state.categories.filter((cat) => !isLikelyCorruptCategoryName(cat.name));
}

async function purgeCorruptCategories() {
  if (!canManageCatalog()) return;
  const corrupt = state.categories.filter((cat) => isLikelyCorruptCategoryName(cat.name));
  if (!corrupt.length) return;
  for (const cat of corrupt) {
    const label = inferDemoCategoryLabel(cat.id, state.products);
    let targetId = null;
    if (label) {
      try {
        targetId = await resolveCategoryIdByName(label, { reload: false });
      } catch {
        targetId = null;
      }
    }
    for (const product of state.products.filter((p) => p.category_id === cat.id)) {
      try {
        await api("PATCH", `/catalog/products/${product.id}`, { category_id: targetId }, true);
        product.category_id = targetId;
      } catch (error) {
        console.warn("Product reassign skipped:", product.id, error);
      }
    }
    try {
      await requestNoBody("DELETE", `/catalog/categories/${cat.id}`, true);
    } catch (error) {
      console.warn("Category delete skipped:", cat.id, error);
    }
  }
  state.categories = (await api("GET", "/catalog/categories")).filter((cat) => !isLikelyCorruptCategoryName(cat.name));
}

async function repairCorruptDemoProducts(products) {
  for (const p of products) {
    const row = demoRowForSku(p.sku);
    if (!row) continue;
    const [dName, , dBrand, , , , dDesc] = row;
    const patch = {};
    if (isLikelyCorruptText(p.name)) patch.name = dName;
    if (isLikelyCorruptText(p.brand)) patch.brand = dBrand;
    if (isLikelyCorruptText(p.description ?? "")) patch.description = dDesc;
    if (!Object.keys(patch).length) continue;
    try {
      await api("PATCH", `/catalog/products/${p.id}`, patch, true);
    } catch (error) {
      console.warn("Product repair skipped:", p.id, p.sku, error);
    }
  }
}

async function api(method, path, body, withAuth = false) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (withAuth && token()) headers.Authorization = `Bearer ${token()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Таймаут API (${apiBase()}). Проверьте, что Docker запущен.`);
    }
    throw new Error(`Нет связи с API ${apiBase()}: ${error.message || error}`);
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const detail = payload?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail
          ? JSON.stringify(detail)
          : text || response.statusText;
    throw new Error(message);
  }
  return payload;
}

async function validateToken() {
  if (!token()) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${apiBase()}/auth/me`, {
      headers: { Authorization: `Bearer ${token()}` },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function requestNoBody(method, path, withAuth = false) {
  const headers = { Accept: "application/json" };
  if (withAuth && token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(`${apiBase()}${path}`, { method, headers });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.detail || text);
  return payload;
}

async function autoLogin() {
  if (APP_MODE !== "admin") return;
  if (token() && (await validateToken())) {
    await refreshAuth();
    return;
  }
  setToken("");
  setCustomerName("");
  state.roles = [];
}

async function loginCustomer() {
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;
  if (!username || !password) {
    toast("Введите логин и пароль", false);
    return;
  }
  try {
    const data = await api("POST", "/auth/token", { username, password });
    setToken(data.access_token);
    setCustomerName(username);
    await refreshAuth();
    closeAccountModal();
    if (APP_MODE === "admin" && !canManageCatalog() && !canRunCutting()) {
      setToken("");
      setCustomerName("");
      state.roles = [];
      toast("Нет прав администратора. Используйте учётную запись admin.", false);
      return;
    }
    toast(`Добро пожаловать, ${username}`);
    if (APP_MODE === "admin") bootAdminPanel();
  } catch (error) {
    toast(`Не удалось войти: ${formatApiError(error)}`, false);
  }
}

async function registerCustomer() {
  const username = document.getElementById("regUser").value.trim();
  const password = document.getElementById("regPass").value;
  if (!username || password.length < 8) {
    toast("Введите имя и пароль минимум 8 символов", false);
    return;
  }
  try {
    await api("POST", "/auth/register", { username, password });
    document.getElementById("loginUser").value = username;
    document.getElementById("loginPass").value = password;
    toast("Аккаунт создан. Выполняем вход.");
    await loginCustomer();
  } catch (error) {
    toast(`Не удалось зарегистрироваться: ${error.message}`, false);
  }
}

function closeAccountModal() {
  const modal = bootstrap.Modal.getInstance(document.getElementById("accountModal"));
  if (modal) modal.hide();
}

async function removeRetiredDemoProducts() {
  let products;
  try {
    products = await api("GET", "/catalog/products?limit=100");
  } catch {
    return;
  }
  for (const p of products) {
    if (!RETIRED_DEMO_SKUS.includes(p.sku)) continue;
    try {
      await requestNoBody("DELETE", `/catalog/products/${p.id}`, true);
    } catch (error) {
      console.warn("Retired product delete skipped:", p.sku, error);
    }
  }
}

async function seedDemoData() {
  await removeRetiredDemoProducts();
  let categories = (await api("GET", "/catalog/categories")).filter((cat) => !isLikelyCorruptCategoryName(cat.name));
  let products = await api("GET", "/catalog/products?limit=100");
  if (canManageCatalog()) {
    state.categories = categories;
    state.products = products;
    await purgeCorruptCategories();
    categories = (await api("GET", "/catalog/categories")).filter((cat) => !isLikelyCorruptCategoryName(cat.name));
  }
  const byName = new Map(categories.map((c) => [c.name, c]));

  for (const name of demoCategories) {
    if (!byName.has(name)) {
      try {
        const created = await api("POST", "/catalog/categories", { name }, true);
        byName.set(name, created);
      } catch (error) {
        console.warn("Category seed skipped:", name, error);
      }
    }
  }

  products = await api("GET", "/catalog/products?limit=100");
  const existingSku = new Set(products.map((p) => p.sku));

  for (const [name, sku, brand, catName, price, stock, description] of demoProducts) {
    if (existingSku.has(sku)) continue;
    const cat = byName.get(catName);
    try {
      await api(
        "POST",
        "/catalog/products",
        {
          name,
          sku,
          brand,
          description,
          price,
          category_id: cat?.id || null,
          stock,
          is_active: true,
        },
        true
      );
    } catch (error) {
      console.warn("Product seed skipped:", sku, error);
    }
  }

  products = await api("GET", "/catalog/products?limit=100");
  await repairCorruptDemoProducts(products);
  if (canManageCatalog()) {
    await purgeCorruptCategories();
  }
}

async function loadCatalog() {
  state.categories = (await api("GET", "/catalog/categories")).filter((cat) => !isLikelyCorruptCategoryName(cat.name));
  state.products = await api("GET", "/catalog/products?limit=100&sort_by=name");
  if (canManageCatalog()) {
    await purgeCorruptCategories();
    state.categories = (await api("GET", "/catalog/categories")).filter((cat) => !isLikelyCorruptCategoryName(cat.name));
    state.products = await api("GET", "/catalog/products?limit=100&sort_by=name");
  }
  await hydrateProductPhotoUrls(state.products);
  const statP = document.getElementById("statProducts");
  const statC = document.getElementById("statCategories");
  if (statP) statP.textContent = state.products.length;
  if (statC) statC.textContent = state.categories.length;
  renderCategories();
  if (APP_MODE === "admin") renderAdminCatalogTable();
  else renderProducts();
}

function demoMeta(product) {
  const row = demoProducts.find((p) => p[1] === product.sku);
  return {
    icon: row?.[7] || "🪑",
    gradient: row?.[8] || "linear-gradient(135deg,#8d6e63,#d7ccc8)",
  };
}

function demoCategoryLabelForCategoryId(categoryId) {
  return inferDemoCategoryLabel(categoryId, state.products);
}

function categoryName(id) {
  const raw = visibleCategories().find((c) => c.id === id)?.name;
  if (raw) return raw;
  const inferred = demoCategoryLabelForCategoryId(id);
  if (inferred) return inferred;
  return "Каталог";
}

function renderCategories() {
  const host = document.getElementById("categoryPills");
  if (!host) return;
  const counts = new Map();
  state.products.forEach((p) => counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1));
  const buttons = [`<button class="btn btn-sm category-pill ${state.activeCategory === "all" ? "active" : ""}" data-cat="all">Все (${state.products.length})</button>`];
  for (const cat of visibleCategories()) {
    const count = counts.get(cat.id) || 0;
    if (!count) continue;
    buttons.push(`<button class="btn btn-sm category-pill ${state.activeCategory === String(cat.id) ? "active" : ""}" data-cat="${cat.id}">${escapeHtml(categoryName(cat.id))} (${count})</button>`);
  }
  host.innerHTML = buttons.join("");
  host.querySelectorAll("[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeCategory = btn.dataset.cat;
      renderCategories();
      renderProducts();
    });
  });
}

function filteredProducts() {
  const q = state.search.trim().toLowerCase();
  return state.products.filter((p) => {
    const catOk = state.activeCategory === "all" || String(p.category_id) === state.activeCategory;
    const qOk =
      !q ||
      `${displayProductTitle(p)} ${displayProductBrand(p)} ${displayProductDescription(p)}`
        .toLowerCase()
        .includes(q);
    return catOk && qOk;
  });
}

function renderProducts() {
  const host = document.getElementById("productGrid");
  if (!host) return;
  const products = filteredProducts();
  if (!products.length) {
    host.innerHTML = `<div class="col-12 text-center text-muted py-5">По вашему запросу ничего не найдено.</div>`;
    return;
  }
  const adminActions = APP_MODE === "admin";
  host.innerHTML = products
    .map((p) => {
      const meta = demoMeta(p);
      const imgUrl = state.productPhotoUrls[p.id];
      const art = imgUrl
        ? `<div class="product-art product-art-photo"><img src="${imgUrl}" alt="${escapeHtml(displayProductTitle(p))}"></div>`
        : `<div class="product-art" style="background:${meta.gradient}">${meta.icon}</div>`;
      const actionButtons = adminActions
        ? `<div class="btn-group">
            <button class="btn btn-outline-primary btn-sm" data-edit="${p.id}">Изменить</button>
            <button class="btn btn-outline-danger btn-sm" data-del="${p.id}">Скрыть</button>
          </div>`
        : `<div class="btn-group">
            <button class="btn btn-outline-secondary btn-sm" data-wish="${p.id}">♡</button>
            <button class="btn btn-primary btn-sm" data-cart="${p.id}">В корзину</button>
          </div>`;
      return `
        <div class="col-md-6 col-xl-4">
          <article class="card product-card h-100">
            ${art}
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between gap-2 mb-2">
                <span class="badge text-bg-light">${escapeHtml(categoryName(p.category_id))}</span>
                <span class="small text-muted">на складе: ${p.stock}</span>
              </div>
              <h5>${escapeHtml(displayProductTitle(p))}</h5>
              <div class="text-muted small mb-2">${escapeHtml(displayProductBrand(p))}</div>
              <p class="text-muted small flex-grow-1">${escapeHtml(displayProductDescription(p) || "Современное мебельное решение для дома.")}</p>
              <div class="d-flex justify-content-between align-items-center">
                <span class="price fs-5">${money(Number(p.price))}</span>
                ${actionButtons}
              </div>
            </div>
          </article>
        </div>`;
    })
    .join("");

  if (adminActions) {
    host.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => openProductEditor(Number(btn.dataset.edit))));
    host.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => deactivateProduct(Number(btn.dataset.del))));
  } else {
    host.querySelectorAll("[data-cart]").forEach((btn) => btn.addEventListener("click", () => addToCart(Number(btn.dataset.cart))));
    host.querySelectorAll("[data-wish]").forEach((btn) => btn.addEventListener("click", () => addToWishlist(Number(btn.dataset.wish))));
  }
}

async function addToCart(id) {
  if (!customerName()) {
    toast("Войдите, чтобы добавить товар в корзину", false);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("accountModal")).show();
    return;
  }
  const product = state.products.find((p) => p.id === id);
  if (!product) return;
  const existing = state.cart.find((item) => item.id === id);
  existing ? existing.qty++ : state.cart.push({ ...product, qty: 1 });
  state.deliveryQuote = null;
  renderCart();
  try {
    await api("POST", `/catalog/users/${cartUserId()}/cart/items`, { product_id: id, quantity: 1 }, true);
    toast(`${displayProductTitle(product)} добавлен в корзину`);
  } catch (error) {
    toast(`Витрина обновлена, но backend вернул: ${error.message}`, false);
  }
}

async function addToWishlist(id) {
  if (!customerName()) {
    toast("Войдите, чтобы сохранить в избранное", false);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("accountModal")).show();
    return;
  }
  const product = state.products.find((p) => p.id === id);
  try {
    await requestNoBody("POST", `/catalog/users/${cartUserId()}/wishlist/products/${id}`, true);
    toast(`${product ? displayProductTitle(product) : "Товар"} добавлен в избранное`);
  } catch (error) {
    toast(`Не удалось добавить в избранное: ${error.message}`, false);
  }
}

function cartSubtotal() {
  return state.cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
}

async function loadDeliverySettings() {
  if (APP_MODE !== "user") return;
  try {
    state.deliverySettings = await api("GET", "/catalog/delivery/settings");
  } catch {
    state.deliverySettings = { free_delivery_threshold: 3000, delivery_price_per_km: 45 };
  }
}

async function quoteDelivery() {
  const addressEl = document.getElementById("deliveryAddress");
  const address = (addressEl?.value || state.deliveryAddress || "").trim();
  if (!state.cart.length) {
    toast("Корзина пуста", false);
    return;
  }
  if (address.length < 5) {
    toast("Укажите адрес доставки (город, улица, дом)", false);
    return;
  }
  state.deliveryAddress = address;
  const subtotal = cartSubtotal();
  try {
    state.deliveryQuote = await api("POST", "/catalog/delivery/quote", { address, subtotal });
    renderCart();
    toast("Стоимость доставки рассчитана");
  } catch (error) {
    state.deliveryQuote = null;
    renderCart();
    toast(`Не удалось рассчитать доставку: ${error.message}`, false);
  }
}

async function loadDeliverySettingsAdmin() {
  if (APP_MODE !== "admin" || !canManageCatalog()) return;
  try {
    const data = await api("GET", "/catalog/settings/delivery", undefined, true);
    document.getElementById("freeDeliveryThreshold").value = data.free_delivery_threshold;
    document.getElementById("deliveryPricePerKm").value = data.delivery_price_per_km;
    document.getElementById("warehouseAddress").value = data.warehouse_address || "";
    const hint = document.getElementById("warehouseCoordsHint");
    if (hint) {
      hint.textContent = data.warehouse_lat
        ? `Координаты склада: ${data.warehouse_lat.toFixed(5)}, ${data.warehouse_lon.toFixed(5)}`
        : "Координаты склада будут определены при сохранении адреса.";
    }
  } catch (error) {
    toast(`Не удалось загрузить настройки доставки: ${error.message}`, false);
  }
}

async function saveDeliverySettingsAdmin() {
  const payload = {
    free_delivery_threshold: Number(document.getElementById("freeDeliveryThreshold").value),
    delivery_price_per_km: Number(document.getElementById("deliveryPricePerKm").value),
    warehouse_address: document.getElementById("warehouseAddress").value.trim(),
  };
  if (payload.free_delivery_threshold <= 0 || payload.warehouse_address.length < 5) {
    toast("Проверьте порог бесплатной доставки и адрес склада", false);
    return;
  }
  try {
    await api("PUT", "/catalog/settings/delivery", payload, true);
    toast("Настройки доставки сохранены");
    await loadDeliverySettingsAdmin();
  } catch (error) {
    toast(`Ошибка сохранения: ${error.message}`, false);
  }
}

function renderCart() {
  const countEl = document.getElementById("cartCount");
  if (countEl) countEl.textContent = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const host = document.getElementById("cartItems");
  if (!host) return;
  if (!state.cart.length) {
    host.innerHTML = `<div class="text-muted">Корзина пуста. Добавьте мебель из каталога.</div>`;
    state.deliveryQuote = null;
  } else {
    host.innerHTML = state.cart
      .map((item) => `
        <div class="d-flex justify-content-between gap-3">
          <div>
            <strong>${escapeHtml(displayProductTitle(item))}</strong>
            <div class="small text-muted">${item.qty} × ${money(Number(item.price))}</div>
          </div>
          <button class="btn btn-sm btn-outline-danger" data-remove="${item.id}">×</button>
        </div>`)
      .join("");
  }
  host.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.cart = state.cart.filter((item) => item.id !== Number(btn.dataset.remove));
      state.deliveryQuote = null;
      renderCart();
    });
  });

  const subtotal = cartSubtotal();
  const subtotalEl = document.getElementById("cartSubtotal");
  if (subtotalEl) subtotalEl.textContent = money(subtotal);

  const threshold = state.deliverySettings?.free_delivery_threshold ?? 3000;
  const rate = state.deliverySettings?.delivery_price_per_km ?? 45;
  const hintEl = document.getElementById("deliveryHint");
  if (hintEl) {
    hintEl.textContent = subtotal >= threshold
      ? `Доставка бесплатна — заказ от ${money(threshold)}.`
      : `Доставка ${money(rate)}/км. Бесплатно от ${money(threshold)} (ещё ${money(Math.max(threshold - subtotal, 0))}).`;
  }

  const deliveryLine = document.getElementById("cartDeliveryLine");
  const deliveryExtra = document.getElementById("cartDeliveryExtra");
  const totalEl = document.getElementById("cartTotal");
  const quote = state.deliveryQuote;

  if (deliveryLine) {
    if (!quote) {
      deliveryLine.textContent = "—";
    } else if (quote.free_delivery) {
      deliveryLine.textContent = "Бесплатно";
    } else {
      deliveryLine.textContent = money(quote.delivery_fee);
    }
  }
  if (deliveryExtra) {
    if (!quote) {
      deliveryExtra.textContent = "Укажите адрес и нажмите «Рассчитать доставку».";
    } else {
      deliveryExtra.textContent = `≈ ${quote.distance_km} км от склада · тариф ${money(quote.delivery_price_per_km)}/км`;
    }
  }
  if (totalEl) {
    totalEl.textContent = money(quote ? quote.grand_total : subtotal);
  }
}

function renderParts() {
  const host = document.getElementById("partsList");
  if (!state.cuttingParts.length) {
    host.innerHTML = `<div class="alert alert-light border small mb-0">Список деталей пуст. Добавьте хотя бы одну деталь.</div>`;
    return;
  }
  host.innerHTML = state.cuttingParts
    .map((part, index) => `
      <div class="d-flex justify-content-between align-items-center border rounded p-2 mb-2 bg-light">
        <div>
          <strong>${escapeHtml(part.name)}</strong>
          <div class="small text-muted">${part.width}×${part.height} мм</div>
          <div class="form-check form-check-inline mt-1 mb-0">
            <input class="form-check-input" type="checkbox" id="partRotate${index}" data-part-rotate="${index}" ${part.allow_rotation !== false ? "checked" : ""}>
            <label class="form-check-label small" for="partRotate${index}">Можно вращать</label>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-secondary" data-part-minus="${index}">-</button>
          <span class="badge text-bg-secondary">${part.quantity} шт.</span>
          <button class="btn btn-sm btn-outline-secondary" data-part-plus="${index}">+</button>
          <button class="btn btn-sm btn-outline-danger" data-part-remove="${index}">Удалить</button>
        </div>
      </div>`)
    .join("");

  host.querySelectorAll("[data-part-rotate]").forEach((input) =>
    input.addEventListener("change", () => {
      const idx = Number(input.dataset.partRotate);
      if (state.cuttingParts[idx]) state.cuttingParts[idx].allow_rotation = input.checked;
    })
  );

  host.querySelectorAll("[data-part-minus]").forEach((btn) =>
    btn.addEventListener("click", () => changePartQty(Number(btn.dataset.partMinus), -1))
  );
  host.querySelectorAll("[data-part-plus]").forEach((btn) =>
    btn.addEventListener("click", () => changePartQty(Number(btn.dataset.partPlus), 1))
  );
  host.querySelectorAll("[data-part-remove]").forEach((btn) =>
    btn.addEventListener("click", () => removePart(Number(btn.dataset.partRemove)))
  );
}

function normalizeAngle(deg) {
  let angle = Number(deg) || 0;
  angle %= 360;
  if (angle < 0) angle += 360;
  return angle;
}

function getObjectPlanSize(item) {
  const width = Number(item.width) || 0;
  const depth = Number(item.depth) || 0;
  const rad = (normalizeAngle(item.rotationY) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    planW: width * cos + depth * sin,
    planD: width * sin + depth * cos,
  };
}

function getObjectManufacturingSize(item) {
  return {
    width: Number(item.width),
    depth: Number(item.depth),
    height: Number(item.height),
  };
}

function clampObjectPosition(item, roomWidth, roomLength) {
  const { planW, planD } = getObjectPlanSize(item);
  item.x = Math.min(Math.max(item.x, planW / 2), roomWidth - planW / 2);
  item.z = Math.min(Math.max(item.z, planD / 2), roomLength - planD / 2);
}

function normalizePartsForCutting(parts) {
  return parts.map((part) => ({
    name: part.name,
    width: Number(part.width),
    height: Number(part.height),
    quantity: Number(part.quantity),
    allow_rotation: part.allow_rotation !== false,
  }));
}

async function optimizeCutting(customParts = null, silent = false) {
  const sourceParts = customParts || state.cuttingParts;
  if (!sourceParts.length) {
    if (!silent) toast("Добавьте детали для расчета раскроя", false);
    return null;
  }
  const sheetW = Number(document.getElementById("sheetW").value);
  const sheetH = Number(document.getElementById("sheetH").value);
  const parts = normalizePartsForCutting(sourceParts);
  const payload = {
    sheet_width: sheetW,
    sheet_height: sheetH,
    parts,
  };
  try {
    const data = await api("POST", "/cutting/optimize", payload, true);
    state.lastCutResult = data;
    state.selectedCutJobId = data.job_id || null;
    document.getElementById("cutStats").textContent = `${data.placed_count}/${data.requested_count} деталей, ${data.total_sheets} лист(ов), ${data.utilization_percent}%`;
    renderCutView(payload.sheet_width, payload.sheet_height, data.sheets || []);
    renderCutExtra(data);
    if (!silent) toast("Раскрой рассчитан");
    if (APP_MODE === "admin") renderCuttingJobs();
    return data;
  } catch (error) {
    if (!silent) toast(`Раскрой недоступен: ${error.message}`, false);
    return null;
  }
}

function renderCutView(sheetW, sheetH, sheets) {
  const view = document.getElementById("cutView");
  if (!sheets.length) {
    view.innerHTML = `<span class="text-muted">Сервис не вернул размещения.</span>`;
    return;
  }
  const scaleX = 100 / sheetW;
  const scaleY = 100 / sheetH;
  view.innerHTML = sheets
    .map((sheet) => `
      <div class="border rounded p-2 mb-2 bg-white w-100">
        <div class="small fw-semibold mb-2 d-flex justify-content-between flex-wrap gap-1">
          <span>Лист #${sheet.sheet_index + 1} · загрузка ${sheet.utilization_percent}%</span>
          <span class="text-muted">Занято: ${sheet.utilized_area ?? 0} мм² · Свободно: ${sheet.unused_area ?? 0} мм²</span>
        </div>
        <div class="position-relative w-100" style="min-height:180px; background:#fcfaf6; border:1px dashed #d8c2aa; border-radius:.5rem;">
          ${(sheet.placements || [])
            .map((p, i) => {
              const colors = ["#a16207", "#7c3aed", "#0f766e", "#be123c", "#2563eb", "#65a30d"];
              const color = colors[i % colors.length];
              const labelTop = Math.max(p.y * scaleY, 0.8);
              const rotatedMark = p.rotated ? " ↻" : "";
              return `<div title="${escapeHtml(p.name)}${p.rotated ? " (повёрнута на 90°)" : ""}" style="
                position:absolute; left:${p.x * scaleX}%; top:${p.y * scaleY}%;
                width:${Math.max(p.width * scaleX, 5)}%; height:${Math.max(p.height * scaleY, 6)}%;
                background:${color};" class="cut-rect"></div>
                <div class="cut-rect-label" style="left:${p.x * scaleX}%; top:${labelTop}%; background:${color};">${escapeHtml(p.name)}${rotatedMark}</div>`;
            })
            .join("")}
        </div>
      </div>`)
    .join("");
}

function renderCutExtra(data) {
  const host = document.getElementById("cutExtraInfo");
  const areaInfo = `Занято: ${data.total_used_area} мм² · Свободно: ${data.total_unused_area} мм².`;
  if (!data.unplaced_parts || !data.unplaced_parts.length) {
    host.textContent = `${areaInfo} Все детали размещены по листам автоматически.`;
    return;
  }
  host.innerHTML = `${areaInfo} Не размещены: ${data.unplaced_parts
    .map((p) => `${escapeHtml(p.name)} (${p.width}×${p.height}) × ${p.quantity}`)
    .join(", ")}`;
}

function addPartFromInputs() {
  const name = document.getElementById("partName").value.trim();
  const width = Number(document.getElementById("partWidth").value);
  const height = Number(document.getElementById("partHeight").value);
  const quantity = Number(document.getElementById("partQty").value);
  if (!name || width <= 0 || height <= 0 || quantity <= 0) {
    toast("Заполните название, размеры и количество детали", false);
    return;
  }
  state.cuttingParts.push({ name, width, height, quantity, allow_rotation: true });
  renderParts();
  document.getElementById("partName").value = "";
  document.getElementById("partWidth").value = "";
  document.getElementById("partHeight").value = "";
  document.getElementById("partQty").value = "1";
}

function changePartQty(index, delta) {
  const part = state.cuttingParts[index];
  if (!part) return;
  part.quantity = Math.max(1, part.quantity + delta);
  renderParts();
}

function removePart(index) {
  state.cuttingParts.splice(index, 1);
  renderParts();
}

function resetPartsToDefault() {
  state.cuttingParts = defaultCuttingParts.map((p) => ({ ...p }));
  renderParts();
  document.getElementById("cutExtraInfo").textContent = "";
}

async function createRoom() {
  if (!customerName()) {
    toast("Войдите, чтобы сохранить проект", false);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("accountModal")).show();
    return;
  }
  try {
    const project = await savePlannerProject();
    state.projectId = project.id;
    document.getElementById("plannerHint").textContent = `Проект №${project.id} сохранён: ${project.name}`;
    await syncPlannerObjectsToBackend();
    await loadUserProjects();
    toast("Проект комнаты сохранён");
  } catch (error) {
    toast(`Планировщик недоступен: ${error.message}`, false);
  }
}

async function savePlannerProject() {
  const bom = buildBomFromObjects();
  const cost = estimateProjectCost(bom);
  const tiers = estimateTierPrices(cost);
  const projectName = document.getElementById("projectName")?.value?.trim() || `Проект ${customerName()}`;
  const projectLocation = document.getElementById("projectLocation")?.value?.trim() || "Онлайн";
  const payload = {
    name: projectName,
    location: projectLocation,
    user_id: customerName(),
    room_width: state.roomConfig.width,
    room_length: state.roomConfig.length,
    room_height: state.roomConfig.height,
    price_standard: tiers.standard,
    price_comfort: tiers.comfort,
    price_premium: tiers.premium,
    bom_json: JSON.stringify(bom),
    selected_tier: state.selectedTier || "standard",
  };
  if (state.projectId) {
    return api("PATCH", `/planner/projects/${state.projectId}`, payload, true);
  }
  return api("POST", "/planner/projects", payload, true);
}

async function syncPlannerObjectsToBackend() {
  if (!state.projectId) return;
  for (const obj of state.objects3d) {
    const defaults = furnitureAccessoryDefaults(obj.type);
    try {
      await api(
        "POST",
        `/planner/projects/${state.projectId}/furniture`,
        {
          name: obj.name,
          width: obj.width,
          depth: obj.depth,
          height: obj.height,
          x: obj.x,
          y: 0,
          z: obj.z,
          rotation_y: obj.rotationY || 0,
          furniture_type: obj.type,
          texture: obj.texture || "wood_oak",
          custom_color: obj.customColor || "",
          drawers: obj.drawers ?? defaults.drawers,
          handles: obj.handles ?? defaults.handles,
        },
        true
      );
    } catch {
      // best effort sync
    }
  }
}

function createDemoObjects() {
  state.objects3d = [
    { id: makeId(), type: "wardrobe", texture: "wood_dark_oak", name: "Шкаф Verona", width: 1400, depth: 600, height: 2200, x: 5000, z: 900, rotationY: 0 },
    { id: makeId(), type: "sofa", texture: "fabric_gray", name: "Диван Soft Cloud", width: 2200, depth: 1000, height: 900, x: 1500, z: 3500, rotationY: 90 },
    { id: makeId(), type: "cabinet", texture: "board_black", name: "Остров Chef", width: 1800, depth: 800, height: 900, x: 3000, z: 2200, rotationY: 0 },
  ];
  state.selected3dObjectId = state.objects3d[0]?.id || null;
}

function addFurnitureSet() {
  createDemoObjects();
  renderObjects3dList();
  renderRoomTopView();
  renderRoom3D();
  renderBom();
  toast("Демо-комплект добавлен");
}

function getTextureByType(type, variant = "default") {
  return window.Texture3D?.getTextureByType(type, variant) || null;
}

function createSurfaceMaterial(type, variant, colorHex) {
  if (!window.THREE) return null;
  if (window.Texture3D?.createSurfaceMaterial) {
    return window.Texture3D.createSurfaceMaterial(type, variant, colorHex);
  }
  return new THREE.MeshStandardMaterial({ color: colorHex });
}

function createSurfaceMaterialForPanel(type, variant, colorHex, widthMm, heightMm, orientation = "horizontal") {
  if (!window.THREE) return null;
  if (window.Texture3D?.createSurfaceMaterial) {
    return window.Texture3D.createSurfaceMaterial(type, variant, colorHex, { widthMm, heightMm, orientation });
  }
  return new THREE.MeshStandardMaterial({ color: colorHex });
}

function prepareGeometry(geometry) {
  return window.Texture3D?.prepareGeometry ? window.Texture3D.prepareGeometry(geometry) : geometry;
}

function normalizeColorHex(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  return raw.startsWith("#") ? raw : `#${raw}`;
}

function createFurnitureMaterial(item, texturePreset) {
  if (!window.THREE) return null;
  const customColor = normalizeColorHex(item.customColor);
  if (customColor) {
    return new THREE.MeshStandardMaterial({ color: customColor, roughness: 0.72, metalness: 0.04 });
  }
  return createSurfaceMaterialForPanel(
    texturePreset.material,
    item.texture || "default",
    texturePreset.color,
    Number(item.width) || 900,
    Number(item.height) || 1800,
    "vertical"
  );
}

function createFurnitureMaterialSet(item, texturePreset) {
  const customColor = normalizeColorHex(item.customColor);
  if (customColor) {
    const selected = new THREE.MeshStandardMaterial({ color: customColor, roughness: 0.7, metalness: 0.03 });
    const caseFurniture = item.type === "wardrobe" || item.type === "cabinet";
    const body = caseFurniture
      ? new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.76, metalness: 0 })
      : selected;
    return {
      body,
      facade: selected.clone(),
      edge: body.clone(),
      back: new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.82, metalness: 0 }),
      countertop: selected.clone(),
      handles: new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.28, metalness: 0.94 }),
      interior: body.clone(),
    };
  }

  const width = Math.max(Number(item.width) || 350, 350);
  const depth = Math.max(Number(item.depth) || 350, 350);
  const height = Math.max(Number(item.height) || 350, 350);
  const selectedVertical = createSurfaceMaterialForPanel(texturePreset.material, item.texture || "default", texturePreset.color, width, height, "vertical");
  const selectedHorizontal = createSurfaceMaterialForPanel(texturePreset.material, item.texture || "default", texturePreset.color, width, depth, "horizontal");
  const caseFurniture = item.type === "wardrobe" || item.type === "cabinet";
  const neutralVariant = item.texture === "board_white" ? "mdf_matte" : "board_white";
  const neutralType = neutralVariant === "mdf_matte" ? "mdf" : "board";
  const neutralColor = neutralVariant === "mdf_matte" ? 0xb8aea2 : 0xe8e8e4;
  const neutralVertical = createSurfaceMaterialForPanel(neutralType, neutralVariant, neutralColor, width, height, "vertical");
  const neutralHorizontal = createSurfaceMaterialForPanel(neutralType, neutralVariant, neutralColor, width, depth, "horizontal");
  const body = caseFurniture ? neutralVertical : selectedVertical;
  const facade = selectedVertical;
  const interior = caseFurniture ? neutralHorizontal : selectedHorizontal;
  const edge = caseFurniture ? neutralVertical.clone() : selectedVertical.clone();
  const back = createSurfaceMaterialForPanel("board", "board_white", 0xffffff, width, height, "vertical");
  const countertop = selectedHorizontal;
  const handles = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.26, metalness: 0.96 });
  return { body, facade, edge, back, countertop, handles, interior };
}

function roomUnitToWorldX(x) {
  return x - state.roomConfig.width / 2;
}

function roomUnitToWorldZ(z) {
  return z - state.roomConfig.length / 2;
}

function resolveTexturePreset(item) {
  const base = texturePresets[item.texture] || {
    material: (typePresets[item.type] || typePresets.cabinet).texture,
    color: (typePresets[item.type] || typePresets.cabinet).color,
    title: "По типу",
  };
  if (item.customColor) return { ...base, color: item.customColor };
  return base;
}

function furnitureAccessoryDefaults(type) {
  if (type === "cabinet") return { drawers: 2, handles: 2 };
  if (type === "wardrobe") return { drawers: 0, handles: 2 };
  if (type === "shelf") return { drawers: 0, handles: 0 };
  return { drawers: 0, handles: 1 };
}

function disposeRoom3D() {
  if (!state.three) return;
  const { renderer, host, dimensionManager, resizeObserver } = state.three;
  resizeObserver?.disconnect();
  dimensionManager?.dispose();
  window.__room3dRenderer = null;
  if (renderer) {
    renderer.dispose();
    if (typeof renderer.forceContextLoss === "function") {
      renderer.forceContextLoss();
    }
  }
  host?.querySelectorAll("canvas").forEach((canvas) => canvas.remove());
  state.three = null;
}

function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function createRoom3DRenderer(width, height) {
  const attempts = [
    { antialias: true, alpha: false, failIfMajorPerformanceCaveat: false, powerPreference: "default" },
    { antialias: false, alpha: false, failIfMajorPerformanceCaveat: false, powerPreference: "default" },
    { antialias: false, alpha: false, failIfMajorPerformanceCaveat: false, powerPreference: "low-power" },
  ];
  let lastError = null;
  for (const options of attempts) {
    try {
      const renderer = new THREE.WebGLRenderer(options);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.antialias ? 2 : 1));
      renderer.setSize(width, height, false);
      return renderer;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Error creating WebGL context");
}

function initRoom3D() {
  const host = document.getElementById("room3d");
  if (!host || !window.THREE) {
    return;
  }

  const liveCanvas = state.three?.renderer?.domElement;
  if (state.three && liveCanvas && host.contains(liveCanvas)) {
    refreshRoom3DLayout();
    renderRoom3D();
    return;
  }

  if (!canUseWebGL()) {
    throw new Error("WebGL недоступен в браузере. Включите аппаратное ускорение или откройте сайт в Chrome/Edge.");
  }

  disposeRoom3D();

  const width = host.clientWidth || 640;
  const height = 360;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3efe8);

  const camera = new THREE.PerspectiveCamera(45, width / height, 1, 50000);
  camera.position.set(7000, 5500, 7500);
  camera.lookAt(0, 1000, 0);

  const renderer = createRoom3DRenderer(width, height);
  window.__room3dRenderer = renderer;
  if (THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else if (THREE.sRGBEncoding) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.querySelectorAll("canvas").forEach((canvas) => canvas.remove());
  host.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xfff7ed, 0xd7dee8, 0.55);
  scene.add(hemi);
  const light = new THREE.DirectionalLight(0xfff6eb, 1.5);
  light.position.set(4200, 9000, 4600);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.00012;
  light.shadow.normalBias = 0.015;
  light.shadow.radius = 2.6;
  scene.add(light);
  const fill = new THREE.DirectionalLight(0xe6edf7, 0.52);
  fill.position.set(-5400, 3200, -2600);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.26);
  rim.position.set(0, 4200, -6200);
  scene.add(rim);

  if (THREE.PMREMGenerator) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xf3efe8);
    envScene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const envKey = new THREE.DirectionalLight(0xffffff, 1.2);
    envKey.position.set(6, 10, 8);
    envScene.add(envKey);
    const envFill = new THREE.DirectionalLight(0xdde7f5, 0.45);
    envFill.position.set(-7, 4, -5);
    envScene.add(envFill);
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    pmrem.dispose();
  }

  const roomGroup = new THREE.Group();
  const furnitureGroup = new THREE.Group();
  scene.add(roomGroup);
  scene.add(furnitureGroup);
  const dimensionManager = window.Dimension3D?.DimensionManager
    ? new window.Dimension3D.DimensionManager(camera, renderer)
    : null;

  const orbit = {
    theta: 0.78,
    phi: 1.03,
    radius: 11000,
    target: new THREE.Vector3(0, 1000, 0),
  };
  state.three = { scene, camera, renderer, roomGroup, furnitureGroup, dimensionManager, host, orbit };
  if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => refreshRoom3DLayout());
    resizeObserver.observe(host);
    state.three.resizeObserver = resizeObserver;
  }
  init3DPointerControls(renderer.domElement);
  updateOrbitCamera();
  rebuildRoomGeometry();
  renderRoom3D();

  const animate = () => {
    if (!state.three) return;
    dimensionManager?.update(camera, renderer);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();

  window.addEventListener("resize", () => {
    refreshRoom3DLayout();
  });
}

function refreshRoom3DLayout() {
  if (!state.three) return;
  const { host, camera, renderer } = state.three;
  const height = 360;
  const width = host.clientWidth || 640;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  updateOrbitCamera();
}

function ensureRoom3D() {
  try {
    initRoom3D();
  } catch (error) {
    console.error("3D init failed:", error);
    const host = document.getElementById("room3d");
    if (host) {
      host.innerHTML = `<div class="text-warning small p-3">3D не запустился: ${escapeHtml(error.message || String(error))}<div class="mt-2 text-muted">Попробуйте: закрыть другие вкладки с 3D, включить аппаратное ускорение в браузере, обновить страницу (Ctrl+F5). План сверху остаётся доступен.</div></div>`;
    }
  }
  if (document.getElementById("roomPlan")) renderRoomTopView();
}

function updateOrbitCamera() {
  if (!state.three) return;
  const { orbit, camera } = state.three;
  const sinPhi = Math.sin(orbit.phi);
  const x = orbit.target.x + orbit.radius * sinPhi * Math.sin(orbit.theta);
  const y = orbit.target.y + orbit.radius * Math.cos(orbit.phi);
  const z = orbit.target.z + orbit.radius * sinPhi * Math.cos(orbit.theta);
  camera.position.set(x, y, z);
  camera.lookAt(orbit.target);
  updateDynamicWallVisibility();
}

function wallSideWithHysteresis(value, currentSide) {
  const enterThreshold = 0.2;
  const exitThreshold = 0.1;
  if (currentSide === 1) {
    if (value < -enterThreshold) return -1;
    return value < exitThreshold ? 0 : 1;
  }
  if (currentSide === -1) {
    if (value > enterThreshold) return 1;
    return value > -exitThreshold ? 0 : -1;
  }
  if (value > enterThreshold) return 1;
  if (value < -enterThreshold) return -1;
  return 0;
}

function updateDynamicWallVisibility() {
  if (!state.three?.walls) return;
  const { camera, orbit, walls } = state.three;
  const directionX = (camera.position.x - orbit.target.x) / Math.max(orbit.radius, 1);
  const directionZ = (camera.position.z - orbit.target.z) / Math.max(orbit.radius, 1);
  const sideState = state.three.wallSideState || { x: 0, z: 0 };
  sideState.x = wallSideWithHysteresis(directionX, sideState.x);
  sideState.z = wallSideWithHysteresis(directionZ, sideState.z);
  state.three.wallSideState = sideState;

  walls.left.visible = sideState.x !== -1;
  walls.right.visible = sideState.x !== 1;
  walls.back.visible = sideState.z !== -1;
  walls.front.visible = sideState.z !== 1;
}

function init3DPointerControls(canvas) {
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", (event) => {
    state.cameraDrag.active = true;
    state.cameraDrag.startX = event.clientX;
    state.cameraDrag.startY = event.clientY;
    state.cameraDrag.moved = false;
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.cameraDrag.active || !state.three) return;
    const dx = event.clientX - state.cameraDrag.startX;
    const dy = event.clientY - state.cameraDrag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) state.cameraDrag.moved = true;
    state.cameraDrag.startX = event.clientX;
    state.cameraDrag.startY = event.clientY;
    state.three.orbit.theta -= dx * 0.01;
    state.three.orbit.phi = Math.min(Math.max(state.three.orbit.phi + dy * 0.01, 0.22), Math.PI / 2 - 0.04);
    updateOrbitCamera();
  });
  const stopDrag = (event) => {
    if (event?.type === "pointerup" && !state.cameraDrag.moved) {
      selectFurnitureAtPointer(event, canvas);
    }
    state.cameraDrag.active = false;
    canvas.style.cursor = "grab";
  };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointerleave", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!state.three) return;
      event.preventDefault();
      state.three.orbit.radius = Math.min(Math.max(state.three.orbit.radius + event.deltaY * 10, 3000), 18000);
      updateOrbitCamera();
    },
    { passive: false }
  );
}

function selectFurnitureAtPointer(event, canvas) {
  if (!state.three) return;
  const { camera, furnitureGroup, dimensionManager } = state.three;
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(furnitureGroup.children, true)[0];
  let object = hit?.object || null;
  while (object && object.parent !== furnitureGroup) object = object.parent;
  if (!object?.userData?.objectId) {
    state.selected3dObjectId = null;
    dimensionManager?.setSelected(null);
    return;
  }
  state.selected3dObjectId = object.userData.objectId;
  dimensionManager?.setSelected(object);
}

function rebuildRoomGeometry() {
  if (!state.three) return;
  const { roomGroup } = state.three;
  roomGroup.clear();

  const { width, length, height } = state.roomConfig;
  const floor = new THREE.Mesh(
    prepareGeometry(new THREE.BoxGeometry(width, 60, length)),
    createSurfaceMaterialForPanel("floor", "default", 0xffffff, width, length, "horizontal")
  );
  floor.position.y = -30;
  floor.receiveShadow = true;
  roomGroup.add(floor);

  const wallMat = createSurfaceMaterialForPanel("wall", "default", 0xfaf7f2, width, height, "vertical");
  const createWall = (name, geometry, position) => {
    const wall = new THREE.Group();
    wall.name = name;
    wall.userData.isRoomWall = true;
    const surface = new THREE.Mesh(prepareGeometry(geometry), wallMat.clone());
    surface.position.copy(position);
    surface.receiveShadow = true;
    wall.add(surface);
    roomGroup.add(wall);
    return wall;
  };

  state.three.walls = {
    back: createWall("wall-back", new THREE.BoxGeometry(width, height, 50), new THREE.Vector3(0, height / 2, -length / 2)),
    front: createWall("wall-front", new THREE.BoxGeometry(width, height, 50), new THREE.Vector3(0, height / 2, length / 2)),
    left: createWall("wall-left", new THREE.BoxGeometry(50, height, length), new THREE.Vector3(-width / 2, height / 2, 0)),
    right: createWall("wall-right", new THREE.BoxGeometry(50, height, length), new THREE.Vector3(width / 2, height / 2, 0)),
  };
  state.three.wallSideState = { x: 0, z: 0 };
  updateDynamicWallVisibility();
}

function renderRoom3D() {
  if (!state.three) return;
  const { furnitureGroup, dimensionManager } = state.three;
  dimensionManager?.clear();
  furnitureGroup.clear();

  if (!state.objects3d.some((item) => item.id === state.selected3dObjectId)) state.selected3dObjectId = null;
  let selectedGroup = null;

  state.objects3d.forEach((item) => {
    const texturePreset = resolveTexturePreset(item);
    const w = Math.max(Number(item.width) || 350, 350);
    const d = Math.max(Number(item.depth) || 350, 350);
    const h = Math.max(Number(item.height) || 350, 350);
    const materialSet = createFurnitureMaterialSet(item, texturePreset);
    const group = window.Texture3D?.buildFurnitureGroup
      ? window.Texture3D.buildFurnitureGroup(item, w, h, d, materialSet)
      : (() => {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materialSet.body);
          mesh.position.y = h / 2;
          return mesh;
        })();
    group.position.set(roomUnitToWorldX(item.x), 0, roomUnitToWorldZ(item.z));
    group.rotation.y = ((Number(item.rotationY) || 0) * Math.PI) / 180;
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    group.userData.kind = "furniture";
    group.userData.objectId = item.id;
    furnitureGroup.add(group);
    dimensionManager?.attach(group, { width: w, height: h, depth: d });
    if (item.id === state.selected3dObjectId) selectedGroup = group;
  });
  dimensionManager?.setSelected(selectedGroup);
}

function updateFurnitureTransform(item) {
  if (!state.three || !item) return;
  const group = state.three.furnitureGroup.children.find((child) => child.userData.objectId === item.id);
  if (!group) return;
  group.position.set(roomUnitToWorldX(item.x), 0, roomUnitToWorldZ(item.z));
  group.rotation.y = ((Number(item.rotationY) || 0) * Math.PI) / 180;
  group.updateMatrixWorld(true);
}

function renderRoomTopView() {
  const host = document.getElementById("roomPlan");
  const { width, length } = state.roomConfig;
  host.style.aspectRatio = `${width} / ${length}`;
  host.style.minHeight = `${Math.max(220, Math.round((length / 1000) * 42))}px`;
  const viewW = host.clientWidth || 400;
  const viewH = host.clientHeight || 260;
  const scale = Math.min(viewW / width, viewH / length);

  host.innerHTML = state.objects3d
    .map((item) => {
      const { planW, planD } = getObjectPlanSize(item);
      const left = (item.x - planW / 2) * scale;
      const top = (item.z - planD / 2) * scale;
      const chipW = Math.max(item.width * scale, 24);
      const chipH = Math.max(item.depth * scale, 18);
      const rotation = normalizeAngle(item.rotationY);
      const texturePreset = resolveTexturePreset(item);
      const deleteBtn =
        APP_MODE === "admin"
          ? ""
          : `<button type="button" class="furniture-delete-handle" data-delete-id="${item.id}" title="Удалить">×</button>`;
      return `
        <div class="furniture-chip-wrap" style="left:${left}px; top:${top}px; width:${Math.max(planW * scale, 24)}px; height:${Math.max(planD * scale, 18)}px;">
          <div class="furniture-chip" data-drag-id="${item.id}" style="cursor:grab; left:50%; top:50%; width:${chipW}px; height:${chipH}px; background:${texturePreset.color}; transform: translate(-50%, -50%) rotate(${rotation}deg);">
            ${deleteBtn}
            <span class="furniture-chip-label">${escapeHtml(item.name)}</span>
            <button type="button" class="furniture-rotate-handle" data-rotate-id="${item.id}" title="Удерживайте и вращайте">↻</button>
          </div>
        </div>`;
    })
    .join("");

  host.querySelectorAll("[data-drag-id]").forEach((el) => {
    el.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest("[data-rotate-id], [data-delete-id]")) return;
      beginDrag(ev, el.dataset.dragId);
    });
  });
  host.querySelectorAll("[data-rotate-id]").forEach((el) => {
    el.addEventListener("pointerdown", (ev) => beginRotate(ev, el.dataset.rotateId));
  });
  host.querySelectorAll("[data-delete-id]").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      removeObject3D(el.dataset.deleteId);
    });
  });
}

function beginDrag(ev, id) {
  if (APP_MODE === "admin") return;
  if (state.rotate.active) return;
  const item = state.objects3d.find((obj) => obj.id === id);
  if (!item) return;
  state.selected3dObjectId = id;
  state.three?.dimensionManager?.setSelected(
    state.three.furnitureGroup.children.find((child) => child.userData.objectId === id) || null
  );
  state.drag.active = true;
  state.drag.id = id;
  state.drag.startX = ev.clientX;
  state.drag.startY = ev.clientY;
  state.drag.baseX = item.x;
  state.drag.baseZ = item.z;
  ev.currentTarget.setPointerCapture(ev.pointerId);
  ev.preventDefault();
}

function beginRotate(ev, id) {
  if (APP_MODE === "admin") return;
  ev.stopPropagation();
  ev.preventDefault();
  const item = state.objects3d.find((obj) => obj.id === id);
  if (!item) return;
  state.selected3dObjectId = id;
  state.three?.dimensionManager?.setSelected(
    state.three.furnitureGroup.children.find((child) => child.userData.objectId === id) || null
  );
  const host = document.getElementById("roomPlan");
  const hostRect = host.getBoundingClientRect();
  const { width, length } = state.roomConfig;
  const viewW = host.clientWidth || 400;
  const viewH = host.clientHeight || 260;
  const scale = Math.min(viewW / width, viewH / length);
  const centerX = hostRect.left + item.x * scale;
  const centerY = hostRect.top + item.z * scale;
  state.rotate.active = true;
  state.rotate.id = id;
  state.rotate.centerX = centerX;
  state.rotate.centerY = centerY;
  state.rotate.startAngle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX);
  state.rotate.baseRotation = normalizeAngle(item.rotationY);
  ev.currentTarget.setPointerCapture(ev.pointerId);
}

function handleDragMove(ev) {
  if (state.rotate.active) {
    handleRotateMove(ev);
    return;
  }
  if (!state.drag.active) return;
  const host = document.getElementById("roomPlan");
  const { width, length } = state.roomConfig;
  const viewW = host.clientWidth || 400;
  const viewH = host.clientHeight || 260;
  const scale = Math.min(viewW / width, viewH / length);

  const dx = (ev.clientX - state.drag.startX) / scale;
  const dz = (ev.clientY - state.drag.startY) / scale;
  const item = state.objects3d.find((obj) => obj.id === state.drag.id);
  if (!item) return;

  item.x = state.drag.baseX + dx;
  item.z = state.drag.baseZ + dz;
  clampObjectPosition(item, width, length);
  renderRoomTopView();
  updateFurnitureTransform(item);
}

function handleRotateMove(ev) {
  const item = state.objects3d.find((obj) => obj.id === state.rotate.id);
  if (!item) return;
  const angle = Math.atan2(ev.clientY - state.rotate.centerY, ev.clientX - state.rotate.centerX);
  const delta = ((angle - state.rotate.startAngle) * 180) / Math.PI;
  item.rotationY = Math.round(normalizeAngle(state.rotate.baseRotation + delta) * 10) / 10;
  clampObjectPosition(item, state.roomConfig.width, state.roomConfig.length);
  renderRoomTopView();
  updateFurnitureTransform(item);
}

function endDrag() {
  if (state.rotate.active) {
    state.rotate.active = false;
    state.rotate.id = null;
    renderRoomTopView();
    renderBom();
    return;
  }
  state.drag.active = false;
  state.drag.id = null;
}

function applyRoomSize() {
  const widthInput = document.getElementById("roomWidth");
  const lengthInput = document.getElementById("roomLength");
  const heightInput = document.getElementById("roomHeight");
  if (!widthInput || !lengthInput || !heightInput) return;
  const width = Number(widthInput.value);
  const length = Number(lengthInput.value);
  const height = Number(heightInput.value);
  if (width < 2000 || length < 2000 || height < 2000) {
    toast("Размеры комнаты должны быть не менее 2000 мм", false);
    return;
  }
  state.roomConfig = { width, length, height };
  for (const item of state.objects3d) {
    clampObjectPosition(item, width, length);
  }
  rebuildRoomGeometry();
  renderRoomTopView();
  renderRoom3D();
  toast("Размеры комнаты применены");
}

function addObject3DFromForm() {
  const type = document.getElementById("objType").value;
  const texture = document.getElementById("objTexture").value;
  const name = document.getElementById("objName").value.trim() || "Новый объект";
  const width = Number(document.getElementById("objW").value);
  const depth = Number(document.getElementById("objD").value);
  const height = Number(document.getElementById("objH").value);
  if (width <= 0 || depth <= 0 || height <= 0) {
    toast("Габариты объекта должны быть > 0 мм", false);
    return;
  }
  const { planW, planD } = getObjectPlanSize({ width, depth, height, rotationY: 0 });
  const defaults = furnitureAccessoryDefaults(type);
  const useCustomColor = document.getElementById("objUseCustomColor")?.checked;
  const customColor = useCustomColor ? normalizeColorHex(document.getElementById("objCustomColor")?.value) : "";
  const item = {
    id: makeId(),
    type,
    texture,
    customColor,
    drawers: defaults.drawers,
    handles: defaults.handles,
    name,
    width,
    depth,
    height,
    x: Math.min(Math.max(state.roomConfig.width * 0.5, planW / 2), state.roomConfig.width - planW / 2),
    z: Math.min(Math.max(state.roomConfig.length * 0.5, planD / 2), state.roomConfig.length - planD / 2),
    rotationY: 0,
  };
  state.objects3d.push(item);
  state.selected3dObjectId = item.id;
  renderObjects3dList();
  renderRoomTopView();
  renderRoom3D();
  toast("Объект добавлен в сцену");
}

function buildBomFromObjects() {
  const parts = [];
  const assembly = [];
  const pushPart = (name, width, height, quantity) => {
    const key = `${name}_${width}_${height}`;
    const existing = parts.find((part) => part.key === key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      parts.push({ key, name, width, height, quantity });
    }
  };

  for (const item of state.objects3d) {
    const { width: w, depth: d, height: h } = getObjectManufacturingSize(item);

    if (item.type === "wardrobe" || item.type === "shelf") {
      pushPart("Боковина", d, h, 2);
      pushPart("Крышка/дно", w, d, 2);
      pushPart("Полка", Math.max(w - 36, 100), d, Math.max(2, Math.round(h / 500)));
      pushPart("Задняя стенка", w, h, 1);
      if (item.type === "wardrobe") pushPart("Фасад дверцы", Math.round(w / 2), h, 2);
      assembly.push(`Собрать корпус "${item.name}": стяжки 8 шт, конфирматы 16 шт, петли 4 шт`);
    } else if (item.type === "table") {
      pushPart("Столешница", w, d, 1);
      pushPart("Опора", 80, h - 40, 4);
      assembly.push(`Собрать стол "${item.name}": болты 8 шт, шайбы 8 шт`);
    } else if (item.type === "cabinet") {
      pushPart("Боковина", d, h, 2);
      pushPart("Крышка/дно", w, d, 2);
      pushPart("Фасад", w, h, 1);
      assembly.push(`Собрать тумбу "${item.name}": направляющие 2 шт, ручка 1 шт`);
    } else if (item.type === "sofa") {
      pushPart("Каркас сиденья", w, d, 1);
      pushPart("Спинка", w, Math.round(h * 0.6), 1);
      assembly.push(`Собрать диван "${item.name}": уголки 6 шт, болты 12 шт`);
    }
  }

  return {
    parts: parts.map(({ key, ...rest }) => rest),
    assembly,
  };
}

function renderBom() {
  const host = document.getElementById("bomList");
  const bom = buildBomFromObjects();
  if (!bom.parts.length) {
    if (host) host.innerHTML = `<div class="text-muted">Добавьте объекты в 3D, чтобы получить детали и сборку.</div>`;
    renderCostEstimate(bom);
    return bom;
  }
  if (host) {
    host.innerHTML = `
      <div class="mb-2"><strong>Детали для изготовления:</strong></div>
      <ul class="mb-3">${bom.parts.map((part) => `<li>${escapeHtml(part.name)} — ${part.width}×${part.height} мм × ${part.quantity}</li>`).join("")}</ul>
      <div class="mb-2"><strong>Черновой список сборки:</strong></div>
      <ul>${bom.assembly.map((row) => `<li>${escapeHtml(row)}</li>`).join("")}</ul>`;
  }
  renderCostEstimate(bom);
  return bom;
}

const LDSP_PRICE_M2 = 3200;
const EDGE_PRICE_M = 180;
const LABOR_RATE = 0.38;
const OBJECT_BASE_PRICES = { wardrobe: 45000, cabinet: 18000, shelf: 12000, table: 22000, sofa: 35000 };

function estimateObjectRetailCost(item) {
  const base = OBJECT_BASE_PRICES[item.type] || 15000;
  const volumeFactor = (item.width * item.depth * item.height) / (1200 * 600 * 2100);
  return Math.round(base * Math.max(volumeFactor, 0.6));
}

function estimateProjectCost(bom) {
  let materialCost = 0;
  let edgeCost = 0;
  for (const part of bom.parts) {
    const areaM2 = (part.width * part.height * part.quantity) / 1_000_000;
    materialCost += areaM2 * LDSP_PRICE_M2;
    edgeCost += ((part.width + part.height) * 2 * part.quantity) / 1000 * EDGE_PRICE_M;
  }
  const laborCost = Math.round((materialCost + edgeCost) * LABOR_RATE);
  const furnitureCost = state.objects3d.reduce((sum, item) => sum + estimateObjectRetailCost(item), 0);
  const subtotal = Math.round(materialCost + edgeCost + laborCost + furnitureCost);
  return { materialCost: Math.round(materialCost), edgeCost: Math.round(edgeCost), laborCost, furnitureCost, total: subtotal };
}

function estimateTierPrices(cost) {
  const hardwareCost = cost.edgeCost;
  const result = {};
  for (const tier of PRICING_TIERS) {
    result[tier.key] = Math.round(
      cost.materialCost * tier.material
        + hardwareCost * tier.hardware
        + cost.laborCost * tier.labor
        + cost.furnitureCost
    );
  }
  return result;
}

function tierTitle(key) {
  return PRICING_TIERS.find((tier) => tier.key === key)?.title || key;
}

function orderSelectedPrice(order) {
  const tier = order.selected_tier || "standard";
  return order[`price_${tier}`];
}

function selectTier(key) {
  if (!PRICING_TIERS.some((tier) => tier.key === key)) return;
  state.selectedTier = key;
  renderCostEstimate();
  const hint = document.getElementById("plannerHint");
  if (hint && customerName()) {
    hint.textContent = `Выбрана комплектация «${tierTitle(key)}». Сохраните или отправьте проект в работу.`;
  }
}

function bindTierCardSelection(host) {
  if (!host || APP_MODE === "admin") return;
  host.querySelectorAll("[data-tier-select]").forEach((card) => {
    card.addEventListener("click", () => selectTier(card.dataset.tierSelect));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectTier(card.dataset.tierSelect);
      }
    });
  });
}

function renderTierCards(tiers) {
  const tierMeta = {
    standard: { badge: "bg-secondary", hint: "Базовые материалы и фурнитура" },
    comfort: { badge: "bg-primary", hint: "Улучшенные фасады и направляющие" },
    premium: { badge: "bg-warning text-dark", hint: "Премиум фурнитура и отделка" },
  };
  const selected = state.selectedTier || "standard";
  return `<div class="row g-3">${PRICING_TIERS.map((tier) => {
    const meta = tierMeta[tier.key];
    const profile = TIER_MATERIAL_PROFILES[tier.key];
    const active = tier.key === selected ? "border-primary border-2 shadow-sm" : "";
    const selectable = APP_MODE !== "admin";
    return `<div class="col-md-4">
      <div class="p-3 border rounded h-100 bg-white ${active} ${selectable ? "tier-select-card" : ""}"
        ${selectable ? `data-tier-select="${tier.key}" role="button" tabindex="0" style="cursor:pointer"` : ""}>
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="fw-semibold">${tier.title}</span>
          <span class="badge ${meta.badge}">${tier.title}</span>
        </div>
        <div class="cost-highlight">${money(tiers[tier.key])}</div>
        <div class="small text-muted mt-1">${meta.hint}</div>
        ${profile ? `<ul class="small text-muted mt-2 mb-0 ps-3">${profile.specs.map((spec) => `<li>${escapeHtml(spec)}</li>`).join("")}</ul>` : ""}
        ${tier.key === selected && selectable ? `<div class="small text-primary fw-semibold mt-2">Выбрано</div>` : ""}
      </div>
    </div>`;
  }).join("")}</div>`;
}

function renderCostEstimate(bom = null) {
  const host = document.getElementById("costEstimate");
  if (!host) return;
  const data = bom || buildBomFromObjects();
  if (!data.parts.length && !state.objects3d.length) {
    host.innerHTML = `<div class="text-muted">Добавьте мебель в комнату — здесь появится ориентировочная стоимость проекта.</div>`;
    return;
  }
  const cost = estimateProjectCost(data);
  const tiers = estimateTierPrices(cost);
  if (APP_MODE !== "admin") {
    host.innerHTML = `
      <div class="mb-2 small text-muted">Выберите комплектацию — админ получит расчёт материалов и цену по вашему выбору:</div>
      ${renderTierCards(tiers)}
      <div class="small text-muted mt-3">Точный раскрой и закупка выполняются производством после отправки проекта в работу.</div>`;
    bindTierCardSelection(host);
    return;
  }
  host.innerHTML = `
    <div class="row g-3">
      <div class="col-sm-6"><div class="p-3 bg-light rounded"><div class="small text-muted">Материалы (ЛДСП)</div><div class="fw-semibold">${money(cost.materialCost)}</div></div></div>
      <div class="col-sm-6"><div class="p-3 bg-light rounded"><div class="small text-muted">Кромка</div><div class="fw-semibold">${money(cost.edgeCost)}</div></div></div>
      <div class="col-sm-6"><div class="p-3 bg-light rounded"><div class="small text-muted">Работа</div><div class="fw-semibold">${money(cost.laborCost)}</div></div></div>
      <div class="col-sm-6"><div class="p-3 bg-light rounded"><div class="small text-muted">Мебель в проекте</div><div class="fw-semibold">${money(cost.furnitureCost)}</div></div></div>
    </div>
    <div class="mt-3">${renderTierCards(tiers)}</div>
    <div class="mt-3 p-3 border rounded bg-white">
      <div class="small text-muted">Базовая сумма (стандарт)</div>
      <div class="cost-highlight">${money(tiers.standard)}</div>
    </div>`;
}

async function ensureCategoriesLoaded() {
  if (state.categories.length) return;
  state.categories = (await api("GET", "/catalog/categories")).filter((cat) => !isLikelyCorruptCategoryName(cat.name));
}

function populateProductCategoryDatalist() {
  const list = document.getElementById("categoryNameList");
  if (!list) return;
  list.innerHTML = visibleCategories()
    .map((cat) => `<option value="${escapeHtml(cat.name)}"></option>`)
    .join("");
}

function categoryInputValue(categoryId) {
  if (!categoryId) return "";
  const cat = visibleCategories().find((c) => c.id === categoryId);
  return cat?.name || categoryName(categoryId);
}

async function resolveCategoryIdByName(name, options = { reload: true }) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Укажите категорию");
  if (isLikelyCorruptCategoryName(trimmed)) throw new Error("Некорректное название категории");
  const existing = visibleCategories().find((cat) => cat.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;
  const created = await api("POST", "/catalog/categories", { name: trimmed }, true);
  state.categories.push(created);
  state.categories.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  if (options.reload !== false) populateProductCategoryDatalist();
  return created.id;
}

function resetProductEditorPhotos() {
  productEditorPhotos.pending.forEach((item) => {
    if (item.preview?.startsWith("blob:")) URL.revokeObjectURL(item.preview);
  });
  productEditorPhotos.existing = [];
  productEditorPhotos.pending = [];
  productEditorPhotos.removed = [];
  const input = document.getElementById("editProductPhotos");
  if (input) input.value = "";
}

async function loadProductEditorPhotos(product) {
  resetProductEditorPhotos();
  if (!product?.photos?.length) {
    renderProductEditorPhotosPreview();
    return;
  }
  productEditorPhotos.existing = product.photos.map((photo) => ({
    ...photo,
    preview: assetObjectUrl(photo.object_key),
  }));
  renderProductEditorPhotosPreview();
}

function renderProductEditorPhotosPreview() {
  const host = document.getElementById("editProductPhotosPreview");
  if (!host) return;
  const items = [
    ...productEditorPhotos.existing.map((photo) => ({
      key: `existing-${photo.id}`,
      preview: photo.preview,
      remove: () => {
        productEditorPhotos.removed.push(photo.id);
        productEditorPhotos.existing = productEditorPhotos.existing.filter((row) => row.id !== photo.id);
        renderProductEditorPhotosPreview();
      },
    })),
    ...productEditorPhotos.pending.map((photo, index) => ({
      key: `pending-${index}`,
      preview: photo.preview,
      remove: () => {
        if (photo.preview?.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
        productEditorPhotos.pending.splice(index, 1);
        renderProductEditorPhotosPreview();
      },
    })),
  ];
  host.innerHTML = items.length
    ? items
        .map(
          (item) => `<div class="product-photo-thumb position-relative">
            ${item.preview ? `<img src="${item.preview}" alt="">` : `<div class="border rounded p-2 small">фото</div>`}
            <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0" data-remove-photo="${item.key}">×</button>
          </div>`
        )
        .join("")
    : `<div class="small text-muted">Фото не прикреплены</div>`;
  host.querySelectorAll("[data-remove-photo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = items.find((row) => row.key === btn.dataset.removePhoto);
      item?.remove();
    });
  });
}

function handleProductPhotosSelected(event) {
  for (const file of Array.from(event.target.files || [])) {
    productEditorPhotos.pending.push({
      file,
      preview: URL.createObjectURL(file),
    });
  }
  renderProductEditorPhotosPreview();
}

async function uploadAssetFile(file, objectKey) {
  const form = new FormData();
  form.append("object_key", objectKey);
  form.append("file", file);
  const headers = { Accept: "application/json" };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(`${apiBase()}/assets/upload`, { method: "POST", headers, body: form });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const detail = payload?.detail;
    throw new Error(typeof detail === "string" ? detail : "Не удалось загрузить файл");
  }
  return payload?.object_key || objectKey;
}

function assetObjectUrl(objectKey) {
  const parts = String(objectKey).split("/").map((part) => encodeURIComponent(part));
  return `${apiBase()}/assets/objects/${parts.join("/")}`;
}

async function syncProductEditorPhotos(productId) {
  for (const photoId of productEditorPhotos.removed) {
    await requestNoBody("DELETE", `/catalog/products/${productId}/photos/${photoId}`, true);
  }
  let order = productEditorPhotos.existing.length;
  for (const item of productEditorPhotos.pending) {
    const ext = (item.file.name.split(".").pop() || "jpg").toLowerCase();
    const objectKey = `products/${productId}/${Date.now()}-${order}.${ext}`;
    await uploadAssetFile(item.file, objectKey);
    await api(
      "POST",
      `/catalog/products/${productId}/photos`,
      { object_key: objectKey, sort_order: order },
      true
    );
    order += 1;
  }
}

async function hydrateProductPhotoUrls(products) {
  state.productPhotoUrls = {};
  for (const product of products) {
    const key = product.photos?.[0]?.object_key;
    if (key) state.productPhotoUrls[product.id] = assetObjectUrl(key);
  }
}

async function openProductEditor(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  populateProductCategoryDatalist();
  document.getElementById("editProductId").value = product.id;
  document.getElementById("editProductName").value = displayProductTitle(product);
  document.getElementById("editProductSku").value = product.sku;
  document.getElementById("editProductBrand").value = displayProductBrand(product);
  document.getElementById("editProductPrice").value = product.price;
  document.getElementById("editProductStock").value = product.stock;
  document.getElementById("editProductDesc").value = displayProductDescription(product) || "";
  document.getElementById("editProductCategory").value = categoryInputValue(product.category_id);
  await loadProductEditorPhotos(product);
  document.getElementById("productEditorTitle").textContent = "Редактировать товар";
  bootstrap.Modal.getOrCreateInstance(document.getElementById("productEditorModal")).show();
}

async function openNewProductEditor() {
  await ensureCategoriesLoaded();
  populateProductCategoryDatalist();
  document.getElementById("editProductId").value = "";
  document.getElementById("editProductName").value = "";
  document.getElementById("editProductSku").value = `SKU-${Date.now()}`;
  document.getElementById("editProductBrand").value = "";
  document.getElementById("editProductPrice").value = "10000";
  document.getElementById("editProductStock").value = "5";
  document.getElementById("editProductDesc").value = "";
  document.getElementById("editProductCategory").value = visibleCategories()[0]?.name || "";
  resetProductEditorPhotos();
  renderProductEditorPhotosPreview();
  document.getElementById("productEditorTitle").textContent = "Новый товар";
  bootstrap.Modal.getOrCreateInstance(document.getElementById("productEditorModal")).show();
}

async function saveProductEditor() {
  const id = document.getElementById("editProductId").value;
  const categoryNameInput = document.getElementById("editProductCategory").value;
  const payload = {
    name: document.getElementById("editProductName").value.trim(),
    sku: document.getElementById("editProductSku").value.trim(),
    brand: document.getElementById("editProductBrand").value.trim(),
    description: document.getElementById("editProductDesc").value.trim(),
    price: Number(document.getElementById("editProductPrice").value),
    stock: Number(document.getElementById("editProductStock").value),
    is_active: true,
  };
  if (!payload.name || !payload.sku || payload.price <= 0) {
    toast("Заполните название, SKU и цену", false);
    return;
  }
  try {
    const categoryId = await resolveCategoryIdByName(categoryNameInput);
    payload.category_id = categoryId;
    let productId = id ? Number(id) : null;
    if (productId) {
      await api("PATCH", `/catalog/products/${productId}`, payload, true);
      toast("Товар обновлён");
    } else {
      const created = await api("POST", "/catalog/products", payload, true);
      productId = created.id;
      toast("Товар добавлен");
    }
    await syncProductEditorPhotos(productId);
    bootstrap.Modal.getInstance(document.getElementById("productEditorModal")).hide();
    await loadCatalog();
    renderAdminCatalogTable();
  } catch (error) {
    toast(`Ошибка сохранения: ${error.message}`, false);
  }
}

async function deactivateProduct(productId) {
  if (!confirm("Скрыть товар из каталога?")) return;
  try {
    await requestNoBody("DELETE", `/catalog/products/${productId}`, true);
    toast("Товар скрыт");
    await loadCatalog();
    renderAdminCatalogTable();
  } catch (error) {
    toast(`Ошибка: ${error.message}`, false);
  }
}

function renderAdminCatalogTable() {
  const host = document.getElementById("adminCatalogTable");
  if (!host) return;
  host.innerHTML = `
    <table class="table table-sm admin-table">
      <thead><tr><th>ID</th><th>Название</th><th>SKU</th><th>Цена</th><th>Склад</th><th></th></tr></thead>
      <tbody>
        ${state.products.map((p) => `
          <tr>
            <td>${p.id}</td>
            <td>${escapeHtml(displayProductTitle(p))}</td>
            <td class="small text-muted">${escapeHtml(p.sku)}</td>
            <td>${money(Number(p.price))}</td>
            <td>${p.stock}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary" data-edit="${p.id}">Изменить</button>
              <button class="btn btn-sm btn-outline-danger" data-del="${p.id}">Скрыть</button>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
  host.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => openProductEditor(Number(btn.dataset.edit))));
  host.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", () => deactivateProduct(Number(btn.dataset.del))));
}

async function renderCuttingJobs() {
  const host = document.getElementById("cuttingJobsList");
  if (!host) return;
  try {
    const jobs = await api("GET", "/cutting/jobs");
    if (!jobs.length) {
      host.innerHTML = `<div class="text-muted small">История раскроев пуста.</div>`;
      return;
    }
    host.innerHTML = `
      <table class="table table-sm admin-table mb-0">
        <thead><tr><th>#</th><th>Дата</th><th>Лист</th><th>Деталей</th><th>Загрузка</th><th></th></tr></thead>
        <tbody>${jobs
          .map((job) => {
            const active = state.selectedCutJobId === job.id ? "table-primary" : "";
            const created = job.created_at ? new Date(job.created_at).toLocaleString("ru-RU") : "—";
            const viewBtn = job.has_result
              ? `<button class="btn btn-sm btn-outline-primary py-0" data-view-cut="${job.id}">Схема</button>`
              : `<span class="text-muted">—</span>`;
            return `<tr class="${active}">
              <td>${job.id}</td>
              <td class="small">${escapeHtml(created)}</td>
              <td>${job.sheet_width}×${job.sheet_height} мм</td>
              <td>${job.placed_count}/${job.parts_count}</td>
              <td>${job.utilization_percent}%</td>
              <td>${viewBtn}</td>
            </tr>`;
          })
          .join("")}</tbody>
      </table>`;
    host.querySelectorAll("[data-view-cut]").forEach((button) => {
      button.addEventListener("click", () => viewCuttingJob(Number(button.dataset.viewCut)));
    });
  } catch (error) {
    host.innerHTML = `<div class="text-danger small">${escapeHtml(error.message)}</div>`;
  }
}

async function viewCuttingJob(jobId) {
  try {
    const job = await api("GET", `/cutting/jobs/${jobId}`);
    if (!job.result) {
      toast("Для этого раскроя нет сохранённой схемы", false);
      return;
    }
    state.selectedCutJobId = job.id;
    state.lastCutResult = job.result;
    const stats = document.getElementById("cutStats");
    if (stats) {
      stats.textContent = `${job.result.placed_count}/${job.result.requested_count} деталей, ${job.result.total_sheets} лист(ов), ${job.result.utilization_percent}%`;
    }
    renderCutView(job.sheet_width, job.sheet_height, job.result.sheets || []);
    renderCutExtra(job.result);
    await renderCuttingJobs();
    toast(`Показан раскрой #${job.id}`);
  } catch (error) {
    toast(`Не удалось открыть раскрой: ${formatApiError(error)}`, false);
  }
}

async function clearCuttingJobs() {
  if (!window.confirm("Очистить всю историю раскроев?")) return;
  try {
    await api("DELETE", "/cutting/jobs", undefined, true);
    state.selectedCutJobId = null;
    state.lastCutResult = null;
    const stats = document.getElementById("cutStats");
    if (stats) stats.textContent = "готово";
    const view = document.getElementById("cutView");
    if (view) view.innerHTML = `<span class="text-muted">Схема появится после расчёта</span>`;
    const extra = document.getElementById("cutExtraInfo");
    if (extra) extra.textContent = "";
    await renderCuttingJobs();
    toast("История раскроев очищена");
  } catch (error) {
    toast(`Не удалось очистить историю: ${formatApiError(error)}`, false);
  }
}

function removeObject3D(id) {
  const index = state.objects3d.findIndex((obj) => obj.id === id);
  if (index < 0) return;
  const [removed] = state.objects3d.splice(index, 1);
  if (state.selected3dObjectId === removed.id) state.selected3dObjectId = null;
  renderObjects3dList();
  renderRoomTopView();
  renderRoom3D();
  renderBom();
  toast(`Удалён: ${removed.name}`);
}

function renderObjects3dList() {
  const host = document.getElementById("objects3dList");
  if (!host || APP_MODE === "admin") return;
  if (!state.objects3d.length) {
    host.innerHTML = `<div class="text-muted">Объектов в комнате пока нет.</div>`;
    return;
  }
  host.innerHTML = state.objects3d
    .map(
      (item) => `<div class="d-flex justify-content-between align-items-center gap-2 border rounded px-2 py-1 mb-1">
        <span>${escapeHtml(item.name)} <span class="text-muted">(${Math.round(item.width)}×${Math.round(item.depth)}×${Math.round(item.height)})</span></span>
        <button type="button" class="btn btn-sm btn-outline-danger py-0" data-delete-object="${item.id}">Удалить</button>
      </div>`
    )
    .join("");
  host.querySelectorAll("[data-delete-object]").forEach((button) => {
    button.addEventListener("click", () => removeObject3D(button.dataset.deleteObject));
  });
}

async function loadCrm() {
  if (APP_MODE !== "admin" || !canManageCatalog()) return;
  try {
    state.crm.warehouse = await api("GET", "/catalog/crm/warehouse", undefined, true);
    state.crm.orders = await api("GET", "/catalog/crm/orders", undefined, true);
    renderCrmPanel();
  } catch (error) {
    const wh = document.getElementById("crmWarehouseTable");
    const orders = document.getElementById("crmOrdersPanel");
    const msg = `<div class="text-danger">${escapeHtml(error.message)}</div>`;
    if (wh) wh.innerHTML = msg;
    if (orders) orders.innerHTML = msg;
  }
}

function renderCrmWarehouse() {
  const host = document.getElementById("crmWarehouseTable");
  if (!host) return;
  if (!state.crm.warehouse.length) {
    host.innerHTML = `<div class="text-muted">Склад пуст. Нажмите «Загрузить демо CRM».</div>`;
    return;
  }
  host.innerHTML = `
    <table class="table table-sm mb-0">
      <thead><tr><th>Материал</th><th>На складе</th></tr></thead>
      <tbody>${state.crm.warehouse
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.material_name)}</td><td><strong>${row.quantity}</strong> ${escapeHtml(row.unit)}</td></tr>`
        )
        .join("")}</tbody>
    </table>`;
}

async function renderCrmOrderProcurement(orderId) {
  const host = document.getElementById(`crm-proc-${orderId}`);
  if (!host) return;
  host.innerHTML = `<span class="text-muted">Считаем...</span>`;
  try {
    const data = await api("GET", `/catalog/crm/orders/${orderId}/procurement`, undefined, true);
    state.crm.procurementByOrder[orderId] = data;
    host.innerHTML = `
      <table class="table table-sm table-bordered mb-0 mt-2">
        <thead class="table-light">
          <tr><th>Материал</th><th>Нужно</th><th>На складе</th><th class="text-danger">Купить</th></tr>
        </thead>
        <tbody>${data.lines
          .map(
            (line) => `<tr>
              <td>${escapeHtml(line.material_name)}</td>
              <td>${line.required_qty} ${escapeHtml(line.unit)}</td>
              <td>${line.in_stock_qty} ${escapeHtml(line.unit)}</td>
              <td class="${line.to_buy_qty > 0 ? "text-danger fw-semibold" : "text-success"}">${line.to_buy_qty > 0 ? line.to_buy_qty : "—"} ${line.to_buy_qty > 0 ? escapeHtml(line.unit) : ""}</td>
            </tr>`
          )
          .join("")}</tbody>
      </table>
      <button type="button" class="btn btn-sm btn-outline-dark mt-2" data-crm-pdf="${orderId}">PDF закупки</button>`;
    host.querySelector(`[data-crm-pdf="${orderId}"]`)?.addEventListener("click", () => exportCrmProcurementPdf(orderId));
  } catch (error) {
    host.innerHTML = `<div class="text-danger small">${escapeHtml(error.message)}</div>`;
  }
}

function crmStatusBadge(status) {
  const map = {
    конструктор: "text-bg-info",
    закупка: "text-bg-warning",
    сборка: "text-bg-success",
    готова: "text-bg-secondary",
  };
  return map[status] || "text-bg-secondary";
}

function crmOrdersForTab(tab = state.crm.tab) {
  if (tab === "archive") {
    return state.crm.orders.filter((order) => order.status === CRM_STATUS_DONE);
  }
  return state.crm.orders.filter((order) => order.status !== CRM_STATUS_DONE);
}

function renderCrmOrderCard(order) {
  return `
      <div class="border rounded p-3 mb-3" data-order-card="${order.id}">
        <div class="d-flex flex-wrap justify-content-between gap-2 mb-2">
          <div>
            <strong>${escapeHtml(order.title)}</strong>
            <span class="badge ${crmStatusBadge(order.status)} ms-2">${escapeHtml(order.status)}</span>
            ${order.planner_project_id ? `<span class="badge text-bg-light ms-1">проект #${order.planner_project_id}</span>` : ""}
          </div>
          <span class="text-muted small">${escapeHtml(order.customer || "—")}</span>
        </div>
        ${order.notes ? `<div class="small text-muted mb-2">${escapeHtml(order.notes)}</div>` : ""}
        ${order.selected_tier ? `<div class="small mb-2"><span class="badge bg-info text-dark">Комплектация: ${escapeHtml(tierTitle(order.selected_tier))}</span> · <strong>${money(orderSelectedPrice(order))}</strong></div>` : ""}
        ${order.materials?.length ? `<div class="small mb-2"><strong>Материалы:</strong> ${order.materials.map((line) => `${escapeHtml(line.material_name)} — ${line.required_qty} ${escapeHtml(line.unit)}`).join("; ")}</div>` : ""}
        ${order.price_standard ? `<div class="small text-muted mb-2">Все цены: стандарт ${money(order.price_standard)} · комфорт ${money(order.price_comfort)} · премиум ${money(order.price_premium)}</div>` : ""}
        <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
          <select class="form-select form-select-sm" style="max-width:160px" data-crm-status="${order.id}">
            ${CRM_STATUSES.map((s) => `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-crm-save-status="${order.id}">Сохранить статус</button>
          <button type="button" class="btn btn-sm btn-outline-primary" data-crm-order="${order.id}">Рассчитать закупку</button>
          <button type="button" class="btn btn-sm btn-outline-success" data-crm-photo="${order.id}">Добавить фото</button>
        </div>
        <div id="crm-proc-${order.id}"></div>
        <div id="crm-photos-${order.id}" class="mt-2"></div>
      </div>`;
}

function bindCrmOrderPanel(host) {
  host.querySelectorAll("[data-crm-order]").forEach((btn) => {
    btn.addEventListener("click", () => renderCrmOrderProcurement(Number(btn.dataset.crmOrder)));
  });
  host.querySelectorAll("[data-crm-save-status]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = Number(btn.dataset.crmSaveStatus);
      const select = host.querySelector(`[data-crm-status="${orderId}"]`);
      updateCrmOrderStatus(orderId, select?.value || "конструктор");
    });
  });
  host.querySelectorAll("[data-crm-photo]").forEach((btn) => {
    btn.addEventListener("click", () => uploadCrmOrderPhoto(Number(btn.dataset.crmPhoto)));
  });
}

function renderCrmPanel() {
  renderCrmWarehouse();
  const host = document.getElementById("crmOrdersPanel");
  if (!host) return;
  const activeCount = state.crm.orders.filter((order) => order.status !== CRM_STATUS_DONE).length;
  const archiveCount = state.crm.orders.filter((order) => order.status === CRM_STATUS_DONE).length;
  const orders = crmOrdersForTab(state.crm.tab);
  const tabs = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <ul class="nav nav-pills mb-0">
        <li class="nav-item">
          <button type="button" class="nav-link ${state.crm.tab === "active" ? "active" : ""}" data-crm-tab="active">Активные (${activeCount})</button>
        </li>
        <li class="nav-item">
          <button type="button" class="nav-link ${state.crm.tab === "archive" ? "active" : ""}" data-crm-tab="archive">Архив (${archiveCount})</button>
        </li>
      </ul>
      ${activeCount + archiveCount > 0 ? `<button type="button" class="btn btn-sm btn-outline-danger" id="btnClearCrmOrdersInline">Очистить историю</button>` : ""}
    </div>`;
  if (!orders.length) {
    host.innerHTML = `${tabs}<div class="text-muted">${state.crm.tab === "archive" ? "В архиве пока нет завершённых проектов." : "Нет активных заказов. Нажмите «Загрузить демо CRM» или дождитесь отправки проекта клиентом."}</div>`;
    host.querySelectorAll("[data-crm-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.crm.tab = btn.dataset.crmTab;
        renderCrmPanel();
      });
    });
    host.querySelector("#btnClearCrmOrdersInline")?.addEventListener("click", clearCrmOrders);
    return;
  }
  host.innerHTML = `${tabs}${orders.map((order) => renderCrmOrderCard(order)).join("")}`;
  host.querySelectorAll("[data-crm-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.crm.tab = btn.dataset.crmTab;
      renderCrmPanel();
    });
  });
  host.querySelector("#btnClearCrmOrdersInline")?.addEventListener("click", clearCrmOrders);
  bindCrmOrderPanel(host);
  orders.forEach((order) => renderCrmOrderPhotos(order.id));
}

async function updateCrmOrderStatus(orderId, status) {
  try {
    await api("PATCH", `/catalog/crm/orders/${orderId}/status`, { status }, true);
    if (status === CRM_STATUS_DONE) {
      state.crm.tab = "archive";
    }
    await loadCrm();
    toast(status === CRM_STATUS_DONE ? "Проект завершён и перемещён в архив" : `Статус заказа: ${status}`);
  } catch (error) {
    toast(`Не удалось обновить статус: ${error.message}`, false);
  }
}

async function uploadCrmOrderPhoto(orderId) {
  const caption = window.prompt("Подпись к фото", "Этап изготовления") || "";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const objectKey = `orders/${orderId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    try {
      await uploadAssetFile(file, objectKey);
      await api("POST", `/catalog/crm/orders/${orderId}/photos`, { object_key: objectKey, caption }, true);
      await loadCrm();
      toast("Фото добавлено к заказу");
    } catch (error) {
      toast(`Фото: ${error.message}`, false);
    }
  };
  input.click();
}

async function getPhotoViewUrl(objectKey) {
  if (!objectKey) return "";
  return assetObjectUrl(objectKey);
}

function exportCrmProcurementPdf(orderId) {
  const cached = state.crm.procurementByOrder[orderId];
  if (!cached?.lines?.length) {
    toast("Сначала нажмите «Рассчитать закупку»", false);
    return;
  }
  if (!window.pdfMake) {
    toast("Модуль PDF не загружен", false);
    return;
  }
  const order = state.crm.orders.find((o) => o.id === orderId);
  window.pdfMake
    .createPdf({
      pageSize: "A4",
      pageMargins: [28, 28, 28, 28],
      content: [
        { text: "Закупка материалов", style: "title" },
        { text: order ? `${order.title} · ${order.customer}` : `Заказ #${orderId}`, style: "meta" },
        { text: `Дата: ${new Date().toLocaleString("ru-RU")}`, style: "meta", margin: [0, 0, 0, 12] },
        {
          table: {
            widths: ["*", 70, 70, 70],
            body: [
              [
                { text: "Материал", style: "thead" },
                { text: "Нужно", style: "thead" },
                { text: "Склад", style: "thead" },
                { text: "Купить", style: "thead" },
              ],
              ...cached.lines.map((line) => [
                line.material_name,
                `${line.required_qty} ${line.unit}`,
                `${line.in_stock_qty}`,
                line.to_buy_qty > 0 ? `${line.to_buy_qty} ${line.unit}` : "—",
              ]),
            ],
          },
          layout: "lightHorizontalLines",
        },
      ],
      styles: {
        title: { fontSize: 18, bold: true },
        meta: { fontSize: 10, color: "#4b5563" },
        thead: { bold: true, fillColor: "#eef2ff", fontSize: 10 },
      },
      defaultStyle: { font: "Roboto", fontSize: 10 },
    })
    .download(`procurement-order-${orderId}.pdf`);
  toast("PDF закупки сохранён");
}

async function renderCrmOrderPhotos(orderId) {
  const host = document.getElementById(`crm-photos-${orderId}`);
  if (!host) return;
  try {
    const photos = await api("GET", `/catalog/crm/orders/${orderId}/photos`, undefined, true);
    if (!photos.length) {
      host.innerHTML = `<div class="small text-muted">Фото этапов пока нет.</div>`;
      return;
    }
    const items = await Promise.all(
      photos.map(async (photo) => {
        const url = await getPhotoViewUrl(photo.object_key);
        return `<div class="d-inline-block me-2 mb-2" style="max-width:140px">
          ${url ? `<img src="${url}" alt="" class="img-fluid rounded border" style="max-height:100px">` : `<div class="border rounded p-2 small">${escapeHtml(photo.object_key)}</div>`}
          <div class="small text-muted">${escapeHtml(photo.caption || "")}</div>
        </div>`;
      })
    );
    host.innerHTML = `<div class="small fw-semibold mb-1">Фото производства</div>${items.join("")}`;
  } catch {
    host.innerHTML = "";
  }
}

async function buildCrmMaterialsFromBom(bom, tier = state.selectedTier || "standard") {
  const materials = await api("GET", "/catalog/crm/materials", undefined, true);
  if (!materials.length) throw new Error("Материалы CRM не настроены. Админ должен загрузить демо CRM.");
  const profile = TIER_MATERIAL_PROFILES[tier] || TIER_MATERIAL_PROFILES.standard;
  const findMaterial = (pattern, fallback) => {
    const primary = materials.find((m) => m.name.toLowerCase().includes(pattern));
    if (primary) return primary;
    if (fallback) return materials.find((m) => m.name.toLowerCase().includes(fallback)) || null;
    return null;
  };
  const ldsp = findMaterial(profile.patterns.panel, "дсп") || materials[0];
  const edge = findMaterial(profile.patterns.edge, "кромка");
  const screws = findMaterial(profile.patterns.screws, "саморез");
  const hinges = findMaterial(profile.patterns.hinges, "петл");
  const slides = findMaterial(profile.patterns.slides, "направляющ");
  let sheetArea = 0;
  let edgeMeters = 0;
  for (const part of bom.parts) {
    sheetArea += (part.width * part.height * part.quantity) / 1_000_000;
    edgeMeters += ((part.width + part.height) * 2 * part.quantity) / 1000;
  }
  const cabinetCount = state.objects3d.filter((o) => o.type === "cabinet" || o.type === "wardrobe").length;
  const drawerCabinets = state.objects3d.filter((o) => o.type === "cabinet").length;
  const qty = profile.qty;
  const lines = [];
  lines.push({ material_id: ldsp.id, required_qty: Math.max(1, Math.ceil((sheetArea / 4.9) * qty.panel)) });
  if (edge) lines.push({ material_id: edge.id, required_qty: Math.max(1, Math.round(edgeMeters * qty.edge)) });
  if (hinges) lines.push({ material_id: hinges.id, required_qty: Math.max(2, Math.round(cabinetCount * 4 * qty.hinges)) });
  if (slides) lines.push({ material_id: slides.id, required_qty: Math.max(1, Math.round(drawerCabinets * 2 * qty.slides)) });
  if (screws) lines.push({ material_id: screws.id, required_qty: Math.max(50, Math.round(bom.parts.length * 24 * qty.screws)) });
  return lines;
}

function buildTierSubmissionNotes(tier, bom, tiers) {
  const profile = TIER_MATERIAL_PROFILES[tier] || TIER_MATERIAL_PROFILES.standard;
  const specs = profile.specs.join("; ");
  const price = tiers?.[tier];
  const priceText = price ? money(price) : "—";
  return `Комплектация: ${tierTitle(tier)} (${priceText}). Материалы: ${specs}. Комната ${state.roomConfig.width}×${state.roomConfig.length}×${state.roomConfig.height} мм, объектов: ${state.objects3d.length}, деталей: ${bom.parts.length}`;
}

async function submitProjectToWork() {
  if (!customerName()) {
    toast("Войдите, чтобы отправить проект в работу", false);
    bootstrap.Modal.getOrCreateInstance(document.getElementById("accountModal")).show();
    return;
  }
  if (!state.objects3d.length) {
    toast("Добавьте мебель в комнату", false);
    return;
  }
  const selectedTier = state.selectedTier || "standard";
  if (!PRICING_TIERS.some((tier) => tier.key === selectedTier)) {
    toast("Выберите комплектацию на вкладке «Стоимость»", false);
    document.querySelector('[data-bs-target="#costPane"]')?.click();
    return;
  }
  try {
    const bom = buildBomFromObjects();
    const cost = estimateProjectCost(bom);
    const tiers = estimateTierPrices(cost);
    const project = await savePlannerProject();
    state.projectId = project.id;
    await syncPlannerObjectsToBackend();
    await api("POST", `/planner/projects/${state.projectId}/submit`, { selected_tier: selectedTier }, true);
    const materials = await buildCrmMaterialsFromBom(bom, selectedTier);
    const projectName = document.getElementById("projectName")?.value?.trim() || `Кухня ${customerName()}`;
    await api(
      "POST",
      "/catalog/crm/orders/submit-project",
      {
        planner_project_id: state.projectId,
        title: projectName,
        customer: customerName(),
        user_id: customerName(),
        pricing: tiers,
        selected_tier: selectedTier,
        materials,
        notes: buildTierSubmissionNotes(selectedTier, bom, tiers),
      },
      true
    );
    document.getElementById("plannerHint").textContent = `Проект №${state.projectId} отправлен в производство (${tierTitle(selectedTier)}, ${money(tiers[selectedTier])})`;
    await loadUserOrders();
    toast("Проект отправлен в работу — админ увидит расчёты");
  } catch (error) {
    toast(`Не удалось отправить: ${error.message}`, false);
  }
}

async function clearCrmOrders() {
  if (!window.confirm("Очистить всю историю заказов CRM? Фото и материалы заказов будут удалены.")) return;
  try {
    await api("DELETE", "/catalog/crm/orders", undefined, true);
    state.crm.procurementByOrder = {};
    state.crm.tab = "active";
    await loadCrm();
    toast("История заказов очищена");
  } catch (error) {
    toast(`Не удалось очистить историю: ${formatApiError(error)}`, false);
  }
}

async function loadUserProjects() {
  const host = document.getElementById("userProjectsPanel");
  if (!host || !customerName()) return;
  try {
    state.userProjects = await api(
      "GET",
      `/planner/projects/user/${encodeURIComponent(customerName())}`,
      undefined,
      true
    );
    renderUserProjects();
  } catch (error) {
    host.innerHTML = `<div class="text-danger small">${escapeHtml(formatApiError(error))}</div>`;
  }
}

function renderUserProjects() {
  const host = document.getElementById("userProjectsPanel");
  if (!host) return;
  if (!state.userProjects.length) {
    host.innerHTML = `<div class="text-muted">У вас пока нет сохранённых проектов. Спланируйте комнату и нажмите «Сохранить проект».</div>`;
    return;
  }
  host.innerHTML = state.userProjects
    .map((project) => {
      const tier = project.selected_tier ? ` · ${tierTitle(project.selected_tier)}` : "";
      const price = project[`price_${project.selected_tier || "standard"}`];
      const priceText = price ? ` · ${money(price)}` : "";
      return `<div class="border rounded p-3 mb-2">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <strong>${escapeHtml(project.name)}</strong>
            <div class="small text-muted">${plannerStatusLabel(project.status)}${tier}${priceText}</div>
            <div class="small">${Math.round(project.room_width)}×${Math.round(project.room_length)}×${Math.round(project.room_height)} мм</div>
            ${project.location ? `<div class="small text-muted">${escapeHtml(project.location)}</div>` : ""}
          </div>
          <button type="button" class="btn btn-sm btn-primary" data-open-user-project="${project.id}">Открыть</button>
        </div>
      </div>`;
    })
    .join("");
  host.querySelectorAll("[data-open-user-project]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await openUserProject(Number(button.dataset.openUserProject));
      } catch (error) {
        toast(`Не удалось открыть проект: ${formatApiError(error)}`, false);
      }
    });
  });
}

async function openUserProject(projectId) {
  await loadPlannerProject(projectId);
  const modal = document.getElementById("accountModal");
  if (modal) bootstrap.Modal.getInstance(modal)?.hide();
  document.getElementById("planner")?.scrollIntoView({ behavior: "smooth", block: "start" });
  toast("Проект загружен в планировщик");
}

async function loadUserOrders() {
  const host = document.getElementById("userOrdersPanel");
  if (!host || !customerName()) return;
  try {
    state.userOrders = await api("GET", `/catalog/crm/orders/user/${encodeURIComponent(customerName())}`, undefined, true);
    await renderUserOrders();
  } catch (error) {
    host.innerHTML = `<div class="text-danger small">${escapeHtml(error.message)}</div>`;
  }
}

async function renderUserOrders() {
  const host = document.getElementById("userOrdersPanel");
  if (!host) return;
  if (!state.userOrders.length) {
    host.innerHTML = `<div class="text-muted">У вас пока нет заказов в производстве. Спланируйте кухню и нажмите «Отправить в работу».</div>`;
    return;
  }
  const cards = await Promise.all(
    state.userOrders.map(async (order) => {
      let photosHtml = "";
      try {
        const photos = await api("GET", `/catalog/crm/orders/${order.id}/photos`, undefined, true);
        if (photos.length) {
          const thumbs = await Promise.all(
            photos.map(async (photo) => {
              const url = await getPhotoViewUrl(photo.object_key);
              return url
                ? `<div class="me-2 mb-2 d-inline-block"><img src="${url}" class="rounded border" style="height:72px" alt=""><div class="small text-muted">${escapeHtml(photo.caption || "")}</div></div>`
                : "";
            })
          );
          photosHtml = `<div class="mt-2">${thumbs.join("")}</div>`;
        }
      } catch {
        photosHtml = "";
      }
      const tier = order.selected_tier || "standard";
      const price = orderSelectedPrice(order);
      const prices = price
        ? `<div class="small mt-1">Комплектация <strong>${escapeHtml(tierTitle(tier))}</strong> — ${money(price)}</div>`
        : "";
      return `<div class="border rounded p-3 mb-2">
        <div class="d-flex justify-content-between gap-2">
          <strong>${escapeHtml(order.title)}</strong>
          <span class="badge ${crmStatusBadge(order.status)}">${escapeHtml(order.status)}</span>
        </div>
        ${prices}
        <div class="small text-muted">Заказ #${order.id}${order.planner_project_id ? ` · проект #${order.planner_project_id}` : ""}</div>
        ${photosHtml}
      </div>`;
    })
  );
  host.innerHTML = cards.join("");
}

function applyPlannerModeUi() {
  if (APP_MODE === "admin") return;
  document.getElementById("bomTabNav")?.classList.add("d-none");
  document.getElementById("btnGenerateBom")?.classList.add("d-none");
  ["btnEstimateCost", "btnExportAssemblyPdf", "btnExport3d", "btnExportDbs"].forEach((id) => {
    document.getElementById(id)?.classList.add("d-none");
  });
}

function plannerStatusLabel(status) {
  if (status === "submitted") return "отправлен";
  if (status === "draft") return "черновик";
  return status || "—";
}

async function loadPlannerProject(projectId) {
  let project;
  if (APP_MODE === "admin") {
    const projects = await api("GET", "/planner/projects");
    project = projects.find((row) => row.id === projectId);
  } else {
    if (!customerName()) throw new Error("Войдите в аккаунт");
    const projects = await api(
      "GET",
      `/planner/projects/user/${encodeURIComponent(customerName())}`,
      undefined,
      true
    );
    project = projects.find((row) => row.id === projectId);
  }
  if (!project) throw new Error("Проект не найден");

  state.projectId = project.id;
  state.selectedTier = project.selected_tier || "standard";
  state.roomConfig = {
    width: Number(project.room_width) || 6000,
    length: Number(project.room_length) || 5000,
    height: Number(project.room_height) || 2800,
  };

  const furniture = await api("GET", `/planner/projects/${projectId}/furniture`);
  state.objects3d = furniture.map((row) => ({
    id: makeId(),
    type: row.furniture_type || "cabinet",
    texture: row.texture || "wood_oak",
    customColor: row.custom_color || "",
    name: row.name,
    width: row.width,
    depth: row.depth,
    height: row.height,
    x: row.x,
    z: row.z,
    rotationY: row.rotation_y || 0,
    drawers: row.drawers ?? 0,
    handles: row.handles ?? 0,
  }));
  state.selected3dObjectId = state.objects3d[0]?.id || null;

  if (project.bom_json) {
    try {
      state.lastCutResult = null;
    } catch {
      // ignore invalid bom cache
    }
  }

  const roomWidth = document.getElementById("roomWidth");
  const roomLength = document.getElementById("roomLength");
  const roomHeight = document.getElementById("roomHeight");
  if (roomWidth) roomWidth.value = state.roomConfig.width;
  if (roomLength) roomLength.value = state.roomConfig.length;
  if (roomHeight) roomHeight.value = state.roomConfig.height;

  if (state.three) rebuildRoomGeometry();
  renderObjects3dList();
  renderRoomTopView();
  renderRoom3D();
  renderBom();
  renderCostEstimate();
  ensureRoom3D();

  const hint = document.getElementById("plannerHint");
  if (hint) {
    const user = project.user_id ? ` · ${project.user_id}` : "";
    const location = project.location ? ` · ${project.location}` : "";
    hint.textContent = `Открыт проект №${project.id}: ${project.name}${user}${location} (${plannerStatusLabel(project.status)})`;
  }
}

async function renderAdminPlannerProjects() {
  const host = document.getElementById("adminProjectsList");
  if (!host) return;
  host.textContent = "Загрузка проектов...";
  try {
    const projects = await api("GET", "/planner/projects");
    if (!projects.length) {
      host.innerHTML = '<div class="text-muted">Сохранённых проектов пока нет.</div>';
      return;
    }
    host.innerHTML = projects
      .map((project) => {
        const active = state.projectId === project.id ? "border-primary" : "";
        const tier = project.selected_tier ? `<span class="badge bg-info text-dark ms-1">${escapeHtml(tierTitle(project.selected_tier))}</span>` : "";
        const selectedPrice = project.selected_tier && project[`price_${project.selected_tier}`]
          ? `<div class="small text-muted mt-1">${money(project[`price_${project.selected_tier}`])}</div>`
          : project.price_standard
            ? `<div class="small text-muted mt-1">от ${money(project.price_standard)}</div>`
            : "";
        return `<div class="border rounded p-3 mb-2 ${active}">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <strong>#${project.id} ${escapeHtml(project.name)}</strong>${tier}
              <div class="small text-muted">${escapeHtml(project.user_id || "—")} · ${escapeHtml(plannerStatusLabel(project.status))}</div>
              <div class="small">${Math.round(project.room_width)}×${Math.round(project.room_length)}×${Math.round(project.room_height)} мм</div>
              ${selectedPrice}
            </div>
            <button class="btn btn-sm btn-primary" data-open-project="${project.id}">Открыть</button>
          </div>
        </div>`;
      })
      .join("");

    host.querySelectorAll("[data-open-project]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await loadPlannerProject(Number(button.dataset.openProject));
          await renderAdminPlannerProjects();
          toast("Проект загружен");
        } catch (error) {
          toast(`Не удалось открыть проект: ${formatApiError(error)}`, false);
        }
      });
    });
  } catch (error) {
    host.innerHTML = `<div class="text-warning">Не удалось загрузить проекты: ${escapeHtml(formatApiError(error))}</div>`;
  }
}

async function seedCrmDemo() {
  try {
    await api("POST", "/catalog/crm/seed-demo", {}, true);
    await loadCrm();
    toast("Демо CRM загружено");
  } catch (error) {
    const msg = String(error?.message || error || "");
    if (/internal server error/i.test(msg)) {
      toast("CRM: ошибка сервера. После деплоя обновите backend и примените migrate (не -Fast).", false);
      return;
    }
    toast(`CRM: ${msg}`, false);
  }
}

async function bootAdminPanel() {
  const gate = document.getElementById("adminGate");
  const content = document.getElementById("adminContent");
  if (!gate || !content) return;
  await refreshAuth();
  const allowed = canManageCatalog() || canRunCutting();
  gate.classList.toggle("d-none", allowed);
  content.classList.toggle("d-none", !allowed);
  if (!allowed) return;
  renderAdminCatalogTable();
  await renderCuttingJobs();
  await loadDeliverySettingsAdmin();
  await loadCrm();
  await renderAdminPlannerProjects();
  if (state.projectId) {
    ensureRoom3D();
  }
}

async function cutFrom3D() {
  const bom = renderBom();
  if (!bom.parts.length) {
    toast("Нет объектов для расчета раскроя", false);
    return;
  }
  const result = await optimizeCutting(bom.parts, true);
  if (!result) {
    toast("Не удалось выполнить раскрой из 3D", false);
    return;
  }
  document.getElementById("plannerCutResult").textContent = `Раскрой из 3D: ${result.placed_count}/${result.requested_count} деталей, ${result.total_sheets} лист(ов), свободно ${result.total_unused_area} мм².`;
  window.location.hash = "#cutting";
  toast("Раскрой из 3D выполнен");
}

function sheetCanvasForPdfmake(sheet, sheetWidthMm, sheetHeightMm) {
  const maxW = 220;
  const maxH = 130;
  const ratio = Math.min(maxW / sheetWidthMm, maxH / sheetHeightMm);
  const width = Math.max(Math.round(sheetWidthMm * ratio), 1);
  const height = Math.max(Math.round(sheetHeightMm * ratio), 1);
  const colors = ["#a16207", "#7c3aed", "#0f766e", "#be123c", "#2563eb", "#65a30d"];
  const canvas = [{ type: "rect", x: 0, y: 0, w: width, h: height, lineColor: "#8a8f98", lineWidth: 1.2 }];

  (sheet.placements || []).forEach((placement, idx) => {
    const x = placement.x * ratio;
    const y = placement.y * ratio;
    const w = Math.max(placement.width * ratio, 1.2);
    const h = Math.max(placement.height * ratio, 1.2);
    const color = colors[idx % colors.length];
    canvas.push({ type: "rect", x, y, w, h, color, lineColor: "#ffffff", lineWidth: 0.4 });
  });

  return { canvas, width };
}

function exportCutPdf() {
  const result = state.lastCutResult;
  if (!result) {
    toast("Сначала выполните раскрой", false);
    return;
  }
  if (!window.pdfMake) {
    toast("Модуль PDF не загружен", false);
    return;
  }
  const sheetW = Number(document.getElementById("sheetW").value);
  const sheetH = Number(document.getElementById("sheetH").value);
  const content = [
    { text: "Карта раскроя", style: "title" },
    { text: `Дата: ${new Date().toLocaleString("ru-RU")}`, style: "meta" },
    {
      text: `Размещено: ${result.placed_count}/${result.requested_count} · Листов: ${result.total_sheets} · Занято: ${result.total_used_area} мм² · Свободно: ${result.total_unused_area} мм²`,
      style: "meta",
      margin: [0, 0, 0, 10],
    },
  ];

  (result.sheets || []).forEach((sheet, index) => {
    const drawn = sheetCanvasForPdfmake(sheet, sheetW, sheetH);
    const legendRows = (sheet.placements || []).map((p, i) => [
      { text: `${i + 1}`, style: "small" },
      { text: p.name, style: "small" },
      { text: `${p.width}×${p.height} мм`, style: "small" },
    ]);
    content.push({
      text: `Лист ${sheet.sheet_index + 1}: занято ${sheet.utilized_area ?? 0} мм² · свободно ${sheet.unused_area ?? 0} мм² · загрузка ${sheet.utilization_percent}%`,
      style: "sheetTitle",
      margin: [0, index ? 8 : 0, 0, 4],
    });
    content.push({
      columns: [
        { width: drawn.width + 10, stack: [{ canvas: drawn.canvas }] },
        {
          width: "*",
          stack: legendRows.length
            ? [{ table: { widths: [16, "*", 80], body: [[{ text: "№", style: "thead" }, { text: "Деталь", style: "thead" }, { text: "Размер", style: "thead" }], ...legendRows] }, layout: "lightHorizontalLines" }]
            : [{ text: "На листе нет размещенных деталей", style: "small" }],
        },
      ],
      columnGap: 12,
      margin: [0, 0, 0, 6],
    });
  });

  if (result.unplaced_parts?.length) {
    content.push({ text: "Не размещено (деталь больше листа):", style: "sheetTitle", margin: [0, 8, 0, 4] });
    content.push({
      table: {
        widths: [28, "*", 90, 50],
        body: [
          [{ text: "№", style: "thead" }, { text: "Деталь", style: "thead" }, { text: "Размер", style: "thead" }, { text: "Кол-во", style: "thead" }],
          ...result.unplaced_parts.map((part, i) => [String(i + 1), part.name, `${part.width}×${part.height} мм`, String(part.quantity)]),
        ],
      },
      layout: "lightHorizontalLines",
    });
  }

  window.pdfMake
    .createPdf({
      pageSize: "A4",
      pageMargins: [24, 24, 24, 24],
      content,
      styles: {
        title: { fontSize: 20, bold: true, color: "#1f2937" },
        meta: { fontSize: 10, color: "#4b5563" },
        sheetTitle: { fontSize: 12, bold: true, color: "#111827" },
        thead: { bold: true, fillColor: "#eef2ff", fontSize: 9 },
        small: { fontSize: 9 },
      },
      defaultStyle: { font: "Roboto" },
    })
    .download("cutting-report.pdf");
  toast("Карта раскроя сохранена");
}

function jsString(value) {
  return JSON.stringify(String(value));
}

function buildBasisCabinetScript(item, offsetX, offsetZ) {
  const { width: w, depth: d, height: h } = getObjectManufacturingSize(item);
  const name = item.name.replace(/'/g, "\\'");
  const lines = [
    `  // ${name} (${w}×${d}×${h} мм)`,
    `  (function() {`,
    `    var ox = ${Math.round(offsetX)};`,
    `    var oz = ${Math.round(offsetZ)};`,
    `    var W = ${Math.round(w)};`,
    `    var D = ${Math.round(d)};`,
    `    var H = ${Math.round(h)};`,
    `    var TH = ActiveMaterial.Thickness;`,
  ];

  if (item.type === "wardrobe" || item.type === "shelf" || item.type === "cabinet") {
    const shelfCount = item.type === "cabinet" ? 0 : Math.max(2, Math.round(h / 500));
    const doorCount = item.type === "wardrobe" ? 2 : item.type === "cabinet" ? 1 : 0;
    lines.push(
      `    AddHorizPanel(ox, oz, ox + W, oz + D, 0).Name = ${jsString(name + " — дно")};`,
      `    AddHorizPanel(ox, oz, ox + W, oz + D, H - TH).Name = ${jsString(name + " — крышка")};`,
      `    AddVertPanel(oz, 0, oz + D, H, ox).Name = ${jsString(name + " — боковина левая")};`,
      `    AddVertPanel(oz, 0, oz + D, H, ox + W - TH).Name = ${jsString(name + " — боковина правая")};`,
      `    AddFrontPanel(ox, 0, ox + W, H, oz).Name = ${jsString(name + " — задняя стенка")};`
    );
    if (shelfCount > 0) {
      lines.push(`    var gap = (H - 2 * TH) / (${shelfCount} + 1);`);
      lines.push(`    for (var i = 1; i <= ${shelfCount}; i++) {`);
      lines.push(`      var y = i * gap;`);
      lines.push(`      AddHorizPanel(ox + TH, oz + TH, ox + W - TH, oz + D - TH, y).Name = ${jsString(name + " — полка")} + " " + i;`);
      lines.push(`    }`);
    }
    if (doorCount === 1) {
      lines.push(`    AddFrontPanel(ox, 0, ox + W, H - TH, oz + D - TH).Name = ${jsString(name + " — фасад")};`);
    } else if (doorCount === 2) {
      lines.push(`    var doorW = (W - TH) / 2;`);
      lines.push(`    AddFrontPanel(ox, 0, ox + doorW, H - TH, oz + D - TH).Name = ${jsString(name + " — дверца 1")};`);
      lines.push(`    AddFrontPanel(ox + doorW, 0, ox + W, H - TH, oz + D - TH).Name = ${jsString(name + " — дверца 2")};`);
    }
  } else if (item.type === "table") {
    lines.push(
      `    AddHorizPanel(ox, oz, ox + W, oz + D, H - TH).Name = ${jsString(name + " — столешница")};`,
      `    AddVertPanel(oz, 0, oz + 80, H, ox + 40).Name = ${jsString(name + " — опора 1")};`,
      `    AddVertPanel(oz, 0, oz + 80, H, ox + W - 40 - TH).Name = ${jsString(name + " — опора 2")};`,
      `    AddVertPanel(oz + D - 80, 0, oz + D, H, ox + 40).Name = ${jsString(name + " — опора 3")};`,
      `    AddVertPanel(oz + D - 80, 0, oz + D, H, ox + W - 40 - TH).Name = ${jsString(name + " — опора 4")};`
    );
  } else {
    lines.push(
      `    AddHorizPanel(ox, oz, ox + W, oz + D, 0).Name = ${jsString(name + " — основание")};`,
      `    AddFrontPanel(ox, 0, ox + W, H, oz).Name = ${jsString(name + " — корпус")};`
    );
  }

  lines.push(`  })();`);
  return lines.join("\n");
}

function exportBasisScript() {
  if (!state.objects3d.length) {
    toast("Добавьте объекты в планировщик для экспорта в Базис", false);
    return;
  }

  const blocks = state.objects3d.map((item, index) => {
    const offsetX = Math.round(item.x - getObjectManufacturingSize(item).width / 2);
    const offsetZ = Math.round(item.z - getObjectManufacturingSize(item).depth / 2) + index * 120;
    return buildBasisCabinetScript(item, offsetX, offsetZ);
  });

  const cutComment = state.lastCutResult
    ? `\n// Раскрой: ${state.lastCutResult.placed_count}/${state.lastCutResult.requested_count} деталей, ${state.lastCutResult.total_sheets} лист(ов)\n`
    : "\n// Раскрой ещё не рассчитан — запустите расчёт перед экспортом\n";

  const script = [
    "// WoodCraft Market → БАЗИС-Мебельщик",
    "// Как открыть: Скрипты → Выбрать этот файл → Запустить",
    "// Все размеры в миллиметрах",
    cutComment,
    "Undo.changing();",
    "try {",
    ...blocks,
    "  alert('Импорт завершён: корпуса построены.');",
    "} finally {",
    "  Undo.commit();",
    "}",
  ].join("\n");

  const blob = new Blob([script], { type: "text/javascript;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "woodcraft-basis-import.js";
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Скрипт для Базис сохранён — запустите его через меню «Скрипты»");
}

function buildDbsDocument() {
  const bom = buildBomFromObjects();
  const cost = estimateProjectCost(bom);
  const panels = bom.parts.map((part) => ({
    name: part.name,
    width_mm: part.width,
    height_mm: part.height,
    quantity: part.quantity,
    area_mm2: part.width * part.height * part.quantity,
  }));

  return {
    format: "woodcraft-dbs",
    version: "1.0",
    generated_at: new Date().toISOString(),
    producer: "WoodCraft Market",
    project: {
      id: state.projectId,
      title: "Комната WoodCraft",
      units: "mm",
    },
    room: { ...state.roomConfig },
    furniture: state.objects3d.map((item) => {
      const preset = resolveTexturePreset(item);
      return {
        id: item.id,
        name: item.name,
        type: item.type,
        texture: item.texture,
        material: preset.material,
        width_mm: item.width,
        depth_mm: item.depth,
        height_mm: item.height,
        x_mm: item.x,
        z_mm: item.z,
        rotation_deg: item.rotationY || 0,
      };
    }),
    bom: {
      parts: bom.parts,
      assembly: bom.assembly,
      estimated_cost_rub: cost.total,
    },
    panels,
    cutting: state.lastCutResult
      ? {
          placed_count: state.lastCutResult.placed_count,
          requested_count: state.lastCutResult.requested_count,
          total_sheets: state.lastCutResult.total_sheets,
          utilization_percent: state.lastCutResult.utilization_percent,
        }
      : null,
    exports: {
      basis_script: "woodcraft-basis-import.js",
      gltf: "room-scene.gltf",
      note: "DBS — Design Bundle Specification для передачи в производство и CRM",
    },
  };
}

function exportDbsFile() {
  if (!state.objects3d.length) {
    toast("Добавьте объекты в планировщик для экспорта DBS", false);
    return;
  }
  const doc = buildDbsDocument();
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `woodcraft-project-${Date.now()}.dbs`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Файл DBS сохранён (спецификация для производства)");
}

function exportAssemblyPdf() {
  const bom = buildBomFromObjects();
  if (!bom.parts.length) {
    toast("Добавьте объекты, чтобы собрать инструкцию", false);
    return;
  }
  if (!window.pdfMake) {
    toast("Модуль PDF не загружен", false);
    return;
  }
  const objectsTableBody = [
    [{ text: "№", style: "thead" }, { text: "Объект", style: "thead" }, { text: "Тип", style: "thead" }, { text: "Габариты, мм", style: "thead" }, { text: "Текстура", style: "thead" }],
    ...state.objects3d.map((item, idx) => {
      const textureTitle = (texturePresets[item.texture] || {}).title || "По типу";
      const typeTitle = (typePresets[item.type] || {}).title || item.type;
      return [String(idx + 1), item.name, typeTitle, `${Math.round(item.width)}×${Math.round(item.depth)}×${Math.round(item.height)}`, textureTitle];
    }),
  ];

  const partsTableBody = [
    [{ text: "№", style: "thead" }, { text: "Деталь", style: "thead" }, { text: "Размер, мм", style: "thead" }, { text: "Кол-во", style: "thead" }],
    ...bom.parts.map((part, idx) => [String(idx + 1), part.name, `${part.width}×${part.height}`, String(part.quantity)]),
  ];

  const content = [
    { text: "Инструкция по сборке", style: "title" },
    { text: `Комната: ${state.roomConfig.width} × ${state.roomConfig.length} × ${state.roomConfig.height} мм`, style: "meta" },
    { text: `Дата: ${new Date().toLocaleString("ru-RU")}`, style: "meta", margin: [0, 0, 0, 10] },
    { text: "1. Перечень объектов в проекте", style: "section" },
    { table: { headerRows: 1, widths: [20, "*", 64, 78, 70], body: objectsTableBody }, layout: "lightHorizontalLines", margin: [0, 0, 0, 10] },
    { text: "2. Детали для изготовления", style: "section" },
    { table: { headerRows: 1, widths: [20, "*", 90, 50], body: partsTableBody }, layout: "lightHorizontalLines", margin: [0, 0, 0, 10] },
    { text: "3. Порядок сборки", style: "section" },
    {
      ul: (bom.assembly.length ? bom.assembly : ["Подготовьте крепеж и выполняйте сборку по порядку объектов."]).map((row) => row),
      margin: [0, 0, 0, 6],
    },
    { text: "Примечание: названия деталей/объектов служат только для идентификации и не влияют на геометрию раскроя.", style: "note" },
  ];

  window.pdfMake
    .createPdf({
      pageSize: "A4",
      pageMargins: [24, 24, 24, 24],
      content,
      styles: {
        title: { fontSize: 20, bold: true, color: "#1f2937" },
        meta: { fontSize: 10, color: "#4b5563" },
        section: { fontSize: 12, bold: true, color: "#111827", margin: [0, 6, 0, 4] },
        thead: { bold: true, fillColor: "#eef2ff", fontSize: 9 },
        note: { fontSize: 9, color: "#6b7280", italics: true },
      },
      defaultStyle: { font: "Roboto" },
    })
    .download("assembly-instruction.pdf");
  toast("Инструкция по сборке сохранена");
}

function exportSceneGltf() {
  if (!state.three || !window.THREE?.GLTFExporter) {
    toast("GLTF exporter недоступен", false);
    return;
  }
  const exporter = new THREE.GLTFExporter();
  exporter.parse(state.three.scene, (result) => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "room-scene.gltf";
    link.click();
    URL.revokeObjectURL(link.href);
    toast("3D сцена экспортирована в GLTF");
  });
}

function setBackendStatus(ok, message) {
  const dot = document.getElementById("backendDot");
  if (dot) {
    dot.classList.toggle("ok", ok);
    dot.classList.toggle("bad", !ok);
  }
  const statusEl = document.getElementById("backendStatus");
  if (statusEl) statusEl.textContent = message;
}

function bindClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

async function boot() {
  const apiBaseInput = document.getElementById("apiBase");
  if (apiBaseInput) apiBaseInput.value = localStorage.getItem(LS_API) || defaultApiBase();
  bindClick("saveApiBase", () => {
    localStorage.setItem(LS_API, document.getElementById("apiBase").value.trim());
    location.reload();
  });
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.search = event.target.value;
      renderProducts();
    });
  }

  bindClick("btnOptimize", () => optimizeCutting());
  bindClick("btnAddPart", addPartFromInputs);
  bindClick("btnResetParts", resetPartsToDefault);
  bindClick("btnApplyRoomSize", applyRoomSize);
  bindClick("btnAddObject3d", () => { addObject3DFromForm(); renderBom(); });
  bindClick("btnCreateRoom", createRoom);
  bindClick("btnAddFurniture", addFurnitureSet);
  bindClick("btnGenerateBom", () => { renderBom(); toast("Список деталей обновлён"); });
  bindClick("btnEstimateCost", () => {
    renderBom();
    if (APP_MODE !== "admin") {
      document.querySelector('[data-bs-target="#costPane"]')?.click();
    }
    toast("Стоимость пересчитана");
  });
  bindClick("btnSubmitToWork", submitProjectToWork);
  bindClick("btnCutFrom3d", cutFrom3D);
  bindClick("btnExportBasis", exportBasisScript);
  bindClick("btnExportDbs", exportDbsFile);
  bindClick("btnExportCutPdf", exportCutPdf);
  bindClick("btnExportAssemblyPdf", exportAssemblyPdf);
  bindClick("btnExport3d", exportSceneGltf);
  bindClick("btnRefreshProjects", renderAdminPlannerProjects);
  bindClick("btnLogin", loginCustomer);
  bindClick("btnRegister", registerCustomer);
  bindClick("btnAdminLogin", loginCustomer);
  bindClick("btnSaveProduct", saveProductEditor);
  bindClick("btnAddProduct", openNewProductEditor);
  bindClick("btnSaveDeliverySettings", saveDeliverySettingsAdmin);
  bindClick("btnQuoteDelivery", quoteDelivery);
  bindClick("btnSeedDemo", async () => { await seedDemoData(); await loadCatalog(); renderAdminCatalogTable(); toast("Демо-данные загружены"); });
  bindClick("btnSeedCrm", seedCrmDemo);
  bindClick("btnClearCrmOrders", clearCrmOrders);
  bindClick("btnRefreshJobs", renderCuttingJobs);
  bindClick("btnClearCuttingJobs", clearCuttingJobs);

  document.addEventListener("pointermove", handleDragMove);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  if (APP_MODE === "admin") {
    state.cuttingParts = defaultCuttingParts.map((p) => ({ ...p }));
    renderParts();
    state.objects3d = [];
  } else {
    createDemoObjects();
  }
  renderCart();
  applyPlannerModeUi();
  if (document.getElementById("roomPlan")) renderRoomTopView();
  renderObjects3dList();
  renderBom();
  if (APP_MODE !== "admin") {
    ensureRoom3D();
  }
  updateAccountButton();

  const useCustomColorEl = document.getElementById("objUseCustomColor");
  const customColorEl = document.getElementById("objCustomColor");
  const productPhotosInput = document.getElementById("editProductPhotos");
  if (productPhotosInput) productPhotosInput.addEventListener("change", handleProductPhotosSelected);
  if (useCustomColorEl && customColorEl) {
    const syncCustomColorInput = () => {
      customColorEl.disabled = !useCustomColorEl.checked;
    };
    useCustomColorEl.addEventListener("change", syncCustomColorInput);
    syncCustomColorInput();
  }

  try {
    await api("GET", "/health");
    setBackendStatus(true, APP_MODE === "admin" ? "Backend доступен" : "Магазин подключен");
    if (APP_MODE === "admin") {
      await autoLogin();
      await bootAdminPanel();
      if (canManageCatalog()) {
        seedDemoData().catch((error) => console.warn("Demo seed:", error));
      }
      setBackendStatus(true, token() ? "Панель администратора подключена" : "Войдите как admin");
    } else {
      if (token()) await refreshAuth();
      await loadDeliverySettings();
      setBackendStatus(true, "Магазин подключен");
    }
    await loadCatalog();
  } catch (error) {
    setBackendStatus(false, "Backend недоступен");
    const grid = document.getElementById("productGrid");
    const hint = formatApiError(error);
    if (grid) {
      grid.innerHTML = `<div class="col-12"><div class="alert alert-warning">Не удалось подключиться к backend (${escapeHtml(apiBase())}): ${escapeHtml(hint)}</div></div>`;
    }
  }
}

document.addEventListener("DOMContentLoaded", boot);
