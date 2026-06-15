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
  projectId: null,
  three: null,
  cuttingParts: [],
  roomConfig: { width: 6000, length: 5000, height: 2800 },
  objects3d: [],
  drag: { active: false, id: null, startX: 0, startY: 0, baseX: 0, baseZ: 0 },
  rotate: { active: false, id: null, centerX: 0, centerY: 0, startAngle: 0, baseRotation: 0 },
  cameraDrag: { active: false, startX: 0, startY: 0 },
  lastCutResult: null,
};

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
  { name: "Боковина шкафа", width: 600, height: 2200, quantity: 2 },
  { name: "Полка", width: 560, height: 400, quantity: 5 },
  { name: "Фасад", width: 480, height: 720, quantity: 4 },
  { name: "Цоколь", width: 1800, height: 120, quantity: 1 },
];

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
  board_white: { title: "Белое ДСП", material: "board", color: "#E9ECEF" },
  fabric_gray: { title: "Серая ткань", material: "fabric", color: "#6C757D" },
  metal_graphite: { title: "Графитовый металл", material: "metal", color: "#495057" },
};

function apiBase() {
  const input = document.getElementById("apiBase");
  return (input?.value || localStorage.getItem(LS_API) || defaultApiBase()).replace(/\/$/, "");
}

function defaultApiBase() {
  const { protocol, hostname, port } = window.location;
  if (port === "8080" || port === "8001" || port === "8002") {
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

async function repairCorruptCategoryNames(categories, products) {
  const takenNames = new Set(
    categories.filter((c) => !isLikelyCorruptCategoryName(c.name)).map((c) => c.name)
  );
  for (const cat of categories) {
    if (!isLikelyCorruptCategoryName(cat.name)) continue;
    const label = inferDemoCategoryLabel(cat.id, products);
    if (!label || takenNames.has(label)) continue;
    try {
      await api("PATCH", `/catalog/categories/${cat.id}`, { name: label }, true);
      takenNames.add(label);
    } catch (error) {
      console.warn("Category repair skipped:", cat.id, error);
    }
  }
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

  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const detail = payload?.detail ? JSON.stringify(payload.detail) : text || response.statusText;
    throw new Error(detail);
  }
  return payload;
}

async function validateToken() {
  if (!token()) return false;
  try {
    const response = await fetch(`${apiBase()}/auth/me`, { headers: { Authorization: `Bearer ${token()}` } });
    return response.ok;
  } catch {
    return false;
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
    toast(`Не удалось войти: ${error.message}`, false);
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
  let categories = await api("GET", "/catalog/categories");
  let products = await api("GET", "/catalog/products?limit=100");
  await repairCorruptCategoryNames(categories, products);
  categories = await api("GET", "/catalog/categories");
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
}

async function loadCatalog() {
  state.categories = await api("GET", "/catalog/categories");
  state.products = await api("GET", "/catalog/products?limit=100&sort_by=name");
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
  const raw = state.categories.find((c) => c.id === id)?.name;
  if (raw && !isLikelyCorruptCategoryName(raw)) return raw;
  const inferred = demoCategoryLabelForCategoryId(id);
  if (inferred) return inferred;
  return raw || "Каталог";
}

function renderCategories() {
  const host = document.getElementById("categoryPills");
  const counts = new Map();
  state.products.forEach((p) => counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1));
  const buttons = [`<button class="btn btn-sm category-pill ${state.activeCategory === "all" ? "active" : ""}" data-cat="all">Все (${state.products.length})</button>`];
  for (const cat of state.categories) {
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
            <div class="product-art" style="background:${meta.gradient}">${meta.icon}</div>
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

function renderCart() {
  document.getElementById("cartCount").textContent = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const host = document.getElementById("cartItems");
  if (!state.cart.length) {
    host.innerHTML = `<div class="text-muted">Корзина пуста. Добавьте мебель из каталога.</div>`;
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
      renderCart();
    });
  });
  const total = state.cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  document.getElementById("cartTotal").textContent = money(total);
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
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-outline-secondary" data-part-minus="${index}">-</button>
          <span class="badge text-bg-secondary">${part.quantity} шт.</span>
          <button class="btn btn-sm btn-outline-secondary" data-part-plus="${index}">+</button>
          <button class="btn btn-sm btn-outline-danger" data-part-remove="${index}">Удалить</button>
        </div>
      </div>`)
    .join("");

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
    ...part,
    width: Number(part.width),
    height: Number(part.height),
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
  state.cuttingParts.push({ name, width, height, quantity });
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
  const projectName = document.getElementById("projectName")?.value?.trim() || `Проект ${customerName()}`;
  const projectLocation = document.getElementById("projectLocation")?.value?.trim() || "Онлайн";
  try {
    const project = await api(
      "POST",
      "/planner/projects",
      {
        name: projectName,
        location: projectLocation,
      },
      true
    );
    state.projectId = project.id;
    document.getElementById("plannerHint").textContent = `Проект №${project.id} создан: ${project.name}`;
    await syncPlannerObjectsToBackend();
    toast("Проект комнаты создан");
  } catch (error) {
    toast(`Планировщик недоступен: ${error.message}`, false);
  }
}

async function syncPlannerObjectsToBackend() {
  if (!state.projectId) return;
  for (const obj of state.objects3d) {
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
}

function addFurnitureSet() {
  createDemoObjects();
  renderRoomTopView();
  renderRoom3D();
  renderBom();
  toast("Демо-комплект добавлен");
}

function getTextureByType(type) {
  if (!window.THREE) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (type === "wood") {
    ctx.fillStyle = "#9b6b43";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = i % 2 ? "#7b4f2f" : "#b88456";
      ctx.beginPath();
      ctx.moveTo(0, i * 12 + (i % 3));
      ctx.bezierCurveTo(32, i * 12 + 6, 96, i * 12 - 4, 128, i * 12 + 3);
      ctx.stroke();
    }
  } else if (type === "metal") {
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#d1d5db";
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 16, 0);
      ctx.lineTo(i * 16 + 40, 128);
      ctx.stroke();
    }
  } else if (type === "board") {
    ctx.fillStyle = "#5f6368";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 16);
      ctx.lineTo(128, i * 16);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#64748b";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "rgba(255,255,255,.25)";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * 16, y * 16, 8, 8);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1.5);
  return tex;
}

function roomUnitToWorldX(x) {
  return x - state.roomConfig.width / 2;
}

function roomUnitToWorldZ(z) {
  return z - state.roomConfig.length / 2;
}

function resolveTexturePreset(item) {
  return texturePresets[item.texture] || {
    material: (typePresets[item.type] || typePresets.cabinet).texture,
    color: (typePresets[item.type] || typePresets.cabinet).color,
    title: "По типу",
  };
}

function initRoom3D() {
  const host = document.getElementById("room3d");
  if (!host || !window.THREE) {
    return;
  }

  const width = host.clientWidth || 640;
  const height = 360;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1f2937);

  const camera = new THREE.PerspectiveCamera(45, width / height, 1, 50000);
  camera.position.set(7000, 5500, 7500);
  camera.lookAt(0, 1000, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  host.querySelectorAll("canvas").forEach((canvas) => canvas.remove());
  host.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambient);
  const light = new THREE.DirectionalLight(0xffffff, 0.95);
  light.position.set(3, 7, 4);
  scene.add(light);

  const roomGroup = new THREE.Group();
  const furnitureGroup = new THREE.Group();
  scene.add(roomGroup);
  scene.add(furnitureGroup);

  const orbit = {
    theta: 0.78,
    phi: 1.03,
    radius: 11000,
    target: new THREE.Vector3(0, 1000, 0),
  };
  state.three = { scene, camera, renderer, roomGroup, furnitureGroup, host, orbit };
  init3DPointerControls(renderer.domElement);
  updateOrbitCamera();
  rebuildRoomGeometry();
  renderRoom3D();

  const animate = () => {
    if (!state.three) return;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();

  window.addEventListener("resize", () => {
    if (!state.three) return;
    const w = host.clientWidth || 640;
    camera.aspect = w / height;
    camera.updateProjectionMatrix();
    renderer.setSize(w, height);
    updateOrbitCamera();
  });
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
}

function init3DPointerControls(canvas) {
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", (event) => {
    state.cameraDrag.active = true;
    state.cameraDrag.startX = event.clientX;
    state.cameraDrag.startY = event.clientY;
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.cameraDrag.active || !state.three) return;
    const dx = event.clientX - state.cameraDrag.startX;
    const dy = event.clientY - state.cameraDrag.startY;
    state.cameraDrag.startX = event.clientX;
    state.cameraDrag.startY = event.clientY;
    state.three.orbit.theta -= dx * 0.01;
    state.three.orbit.phi = Math.min(Math.max(state.three.orbit.phi + dy * 0.01, 0.22), Math.PI / 2 - 0.04);
    updateOrbitCamera();
  });
  const stopDrag = () => {
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

function rebuildRoomGeometry() {
  if (!state.three) return;
  const { roomGroup } = state.three;
  roomGroup.clear();

  const { width, length, height } = state.roomConfig;
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 60, length),
    new THREE.MeshStandardMaterial({ color: 0xd8c2a8, roughness: 0.95 })
  );
  floor.position.y = -30;
  roomGroup.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4eadf, roughness: 0.95 });
  const wallBack = new THREE.Mesh(new THREE.BoxGeometry(width, height, 50), wallMat);
  wallBack.position.set(0, height / 2, -length / 2);
  roomGroup.add(wallBack);

  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(50, height, length), wallMat);
  wallLeft.position.set(-width / 2, height / 2, 0);
  roomGroup.add(wallLeft);
}

function renderRoom3D() {
  if (!state.three) return;
  const { furnitureGroup } = state.three;
  furnitureGroup.clear();

  state.objects3d.forEach((item) => {
    const texturePreset = resolveTexturePreset(item);
    const w = Math.max(Number(item.width) || 350, 350);
    const d = Math.max(Number(item.depth) || 350, 350);
    const h = Math.max(Number(item.height) || 350, 350);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        map: getTextureByType(texturePreset.material),
        color: texturePreset.color,
        roughness: 0.65,
        metalness: texturePreset.material === "metal" ? 0.22 : 0.06,
      })
    );
    mesh.position.set(roomUnitToWorldX(item.x), h / 2, roomUnitToWorldZ(item.z));
    mesh.rotation.y = ((Number(item.rotationY) || 0) * Math.PI) / 180;
    mesh.userData.kind = "furniture";
    mesh.userData.objectId = item.id;
    furnitureGroup.add(mesh);
  });
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
      return `
        <div class="furniture-chip-wrap" style="left:${left}px; top:${top}px; width:${Math.max(planW * scale, 24)}px; height:${Math.max(planD * scale, 18)}px;">
          <div class="furniture-chip" data-drag-id="${item.id}" style="cursor:grab; left:50%; top:50%; width:${chipW}px; height:${chipH}px; background:${texturePreset.color}; transform: translate(-50%, -50%) rotate(${rotation}deg);">
            <span class="furniture-chip-label">${escapeHtml(item.name)}</span>
            <button type="button" class="furniture-rotate-handle" data-rotate-id="${item.id}" title="Удерживайте и вращайте">↻</button>
          </div>
        </div>`;
    })
    .join("");

  host.querySelectorAll("[data-drag-id]").forEach((el) => {
    el.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest("[data-rotate-id]")) return;
      beginDrag(ev, el.dataset.dragId);
    });
  });
  host.querySelectorAll("[data-rotate-id]").forEach((el) => {
    el.addEventListener("pointerdown", (ev) => beginRotate(ev, el.dataset.rotateId));
  });
}

function beginDrag(ev, id) {
  if (state.rotate.active) return;
  const item = state.objects3d.find((obj) => obj.id === id);
  if (!item) return;
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
  ev.stopPropagation();
  ev.preventDefault();
  const item = state.objects3d.find((obj) => obj.id === id);
  if (!item) return;
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
  renderRoom3D();
}

function handleRotateMove(ev) {
  const item = state.objects3d.find((obj) => obj.id === state.rotate.id);
  if (!item) return;
  const angle = Math.atan2(ev.clientY - state.rotate.centerY, ev.clientX - state.rotate.centerX);
  const delta = ((angle - state.rotate.startAngle) * 180) / Math.PI;
  item.rotationY = Math.round(normalizeAngle(state.rotate.baseRotation + delta) * 10) / 10;
  clampObjectPosition(item, state.roomConfig.width, state.roomConfig.length);
  renderRoomTopView();
  renderRoom3D();
}

function endDrag() {
  if (state.rotate.active) {
    state.rotate.active = false;
    state.rotate.id = null;
    renderRoomTopView();
    renderRoom3D();
    renderBom();
    return;
  }
  state.drag.active = false;
  state.drag.id = null;
}

function applyRoomSize() {
  const width = Number(document.getElementById("roomWidth").value);
  const length = Number(document.getElementById("roomLength").value);
  const height = Number(document.getElementById("roomHeight").value);
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
  const item = {
    id: makeId(),
    type,
    texture,
    name,
    width,
    depth,
    height,
    x: Math.min(Math.max(state.roomConfig.width * 0.5, planW / 2), state.roomConfig.width - planW / 2),
    z: Math.min(Math.max(state.roomConfig.length * 0.5, planD / 2), state.roomConfig.length - planD / 2),
    rotationY: 0,
  };
  state.objects3d.push(item);
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

function renderCostEstimate(bom = null) {
  const host = document.getElementById("costEstimate");
  if (!host) return;
  const data = bom || buildBomFromObjects();
  if (!data.parts.length && !state.objects3d.length) {
    host.innerHTML = `<div class="text-muted">Добавьте мебель в комнату — здесь появится ориентировочная стоимость проекта.</div>`;
    return;
  }
  const cost = estimateProjectCost(data);
  host.innerHTML = `
    <div class="row g-3">
      <div class="col-sm-6"><div class="p-3 bg-light rounded"><div class="small text-muted">Материалы (ЛДСП)</div><div class="fw-semibold">${money(cost.materialCost)}</div></div></div>
      <div class="col-sm-6"><div class="p-3 bg-light rounded"><div class="small text-muted">Кромка</div><div class="fw-semibold">${money(cost.edgeCost)}</div></div></div>
      <div class="col-sm-6"><div class="p-3 bg-light rounded"><div class="small text-muted">Работа</div><div class="fw-semibold">${money(cost.laborCost)}</div></div></div>
      <div class="col-sm-6"><div class="p-3 bg-light rounded"><div class="small text-muted">Мебель в проекте</div><div class="fw-semibold">${money(cost.furnitureCost)}</div></div></div>
    </div>
    <div class="mt-3 p-3 border rounded bg-white">
      <div class="small text-muted">Итоговая ориентировочная стоимость</div>
      <div class="cost-highlight">${money(cost.total)}</div>
      <div class="small text-muted mt-1">Расчёт для клиента. Точная развёртка и раскрой — в панели администратора.</div>
    </div>`;
}

function openProductEditor(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  document.getElementById("editProductId").value = product.id;
  document.getElementById("editProductName").value = displayProductTitle(product);
  document.getElementById("editProductSku").value = product.sku;
  document.getElementById("editProductBrand").value = displayProductBrand(product);
  document.getElementById("editProductPrice").value = product.price;
  document.getElementById("editProductStock").value = product.stock;
  document.getElementById("editProductDesc").value = displayProductDescription(product) || "";
  const catSelect = document.getElementById("editProductCategory");
  catSelect.innerHTML = state.categories.map((c) => `<option value="${c.id}" ${c.id === product.category_id ? "selected" : ""}>${escapeHtml(categoryName(c.id))}</option>`).join("");
  document.getElementById("productEditorTitle").textContent = "Редактировать товар";
  bootstrap.Modal.getOrCreateInstance(document.getElementById("productEditorModal")).show();
}

function openNewProductEditor() {
  document.getElementById("editProductId").value = "";
  document.getElementById("editProductName").value = "";
  document.getElementById("editProductSku").value = `SKU-${Date.now()}`;
  document.getElementById("editProductBrand").value = "";
  document.getElementById("editProductPrice").value = "10000";
  document.getElementById("editProductStock").value = "5";
  document.getElementById("editProductDesc").value = "";
  const catSelect = document.getElementById("editProductCategory");
  catSelect.innerHTML = state.categories.map((c) => `<option value="${c.id}">${escapeHtml(categoryName(c.id))}</option>`).join("");
  document.getElementById("productEditorTitle").textContent = "Новый товар";
  bootstrap.Modal.getOrCreateInstance(document.getElementById("productEditorModal")).show();
}

async function saveProductEditor() {
  const id = document.getElementById("editProductId").value;
  const payload = {
    name: document.getElementById("editProductName").value.trim(),
    sku: document.getElementById("editProductSku").value.trim(),
    brand: document.getElementById("editProductBrand").value.trim(),
    description: document.getElementById("editProductDesc").value.trim(),
    price: Number(document.getElementById("editProductPrice").value),
    stock: Number(document.getElementById("editProductStock").value),
    category_id: Number(document.getElementById("editProductCategory").value),
    is_active: true,
  };
  try {
    if (id) {
      await api("PATCH", `/catalog/products/${id}`, payload, true);
      toast("Товар обновлён");
    } else {
      await api("POST", "/catalog/products", payload, true);
      toast("Товар добавлен");
    }
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
      <table class="table table-sm admin-table">
        <thead><tr><th>#</th><th>Лист</th><th>Деталей</th><th>Загрузка</th></tr></thead>
        <tbody>${jobs.map((j) => `<tr><td>${j.id}</td><td>${j.sheet_width}×${j.sheet_height} мм</td><td>${j.placed_count}/${j.parts_count}</td><td>${j.utilization_percent}%</td></tr>`).join("")}</tbody>
      </table>`;
  } catch (error) {
    host.innerHTML = `<div class="text-danger small">${escapeHtml(error.message)}</div>`;
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

async function prepareAssetLink() {
  try {
    const data = await api(
      "POST",
      "/assets/presign-put",
      { object_key: `models/demo-room-${Date.now()}.glb`, content_type: "model/gltf-binary" },
      true
    );
    document.getElementById("assetResult").innerHTML = `
      <strong>Ссылка подготовлена.</strong> В реальном кабинете дизайнер загрузил бы 3D-модель в хранилище.<br>
      <span class="small text-muted">Bucket: ${escapeHtml(data.bucket)}, key: ${escapeHtml(data.object_key)}</span>`;
    toast("Хранилище готово принять 3D-модель");
  } catch (error) {
    toast(`Хранилище недоступно: ${error.message}`, false);
  }
}

function setBackendStatus(ok, message) {
  const dot = document.getElementById("backendDot");
  dot.classList.toggle("ok", ok);
  dot.classList.toggle("bad", !ok);
  document.getElementById("backendStatus").textContent = message;
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
  bindClick("btnEstimateCost", () => { renderBom(); toast("Стоимость пересчитана"); });
  bindClick("btnCutFrom3d", cutFrom3D);
  bindClick("btnExportBasis", exportBasisScript);
  bindClick("btnExportCutPdf", exportCutPdf);
  bindClick("btnExportAssemblyPdf", exportAssemblyPdf);
  bindClick("btnExport3d", exportSceneGltf);
  bindClick("btnAssetLink", prepareAssetLink);
  bindClick("btnLogin", loginCustomer);
  bindClick("btnRegister", registerCustomer);
  bindClick("btnAdminLogin", loginCustomer);
  bindClick("btnSaveProduct", saveProductEditor);
  bindClick("btnAddProduct", openNewProductEditor);
  bindClick("btnSeedDemo", async () => { await seedDemoData(); await loadCatalog(); renderAdminCatalogTable(); toast("Демо-данные загружены"); });
  bindClick("btnRefreshJobs", renderCuttingJobs);

  document.addEventListener("pointermove", handleDragMove);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  if (APP_MODE === "admin") {
    state.cuttingParts = defaultCuttingParts.map((p) => ({ ...p }));
    renderParts();
  }
  createDemoObjects();
  renderCart();
  renderRoomTopView();
  renderBom();
  initRoom3D();
  updateAccountButton();

  try {
    await api("GET", "/health");
    if (APP_MODE === "admin") {
      await autoLogin();
      await bootAdminPanel();
      if (canManageCatalog()) await seedDemoData();
      setBackendStatus(true, "Панель администратора подключена");
    } else {
      if (token()) await refreshAuth();
      setBackendStatus(true, "Магазин подключен");
    }
    await loadCatalog();
  } catch (error) {
    setBackendStatus(false, "Backend недоступен");
    const grid = document.getElementById("productGrid");
    if (grid) grid.innerHTML = `<div class="col-12"><div class="alert alert-warning">Не удалось подключиться к backend: ${escapeHtml(error.message)}</div></div>`;
  }
}

document.addEventListener("DOMContentLoaded", boot);
