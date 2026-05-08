const LS_API = "furniture_gateway_url";
const LS_TOKEN = "furniture_jwt";
const LS_CUSTOMER = "furniture_customer_name";
const DEMO_USER = "demo-buyer";

const state = {
  categories: [],
  products: [],
  activeCategory: "all",
  search: "",
  cart: [],
  projectId: null,
  three: null,
  cuttingParts: [],
  roomConfig: { width: 6, length: 5, height: 2.8 },
  objects3d: [],
  drag: { active: false, id: null, startX: 0, startY: 0, baseX: 0, baseZ: 0 },
  cameraDrag: { active: false, startX: 0, startY: 0 },
  lastCutResult: null,
};

const demoCategories = ["Кухни", "Шкафы", "Гостиные", "Спальни", "Офис", "Детские"];
const demoProducts = [
  ["Кухня Nord Line", "DEMO-KITCHEN-NORD", "FurniPro", "Кухни", 184900, 4, "Полный кухонный гарнитур с матовыми фасадами", "🍽️", "linear-gradient(135deg,#bf7b45,#f1c27d)"],
  ["Шкаф Verona 3D", "DEMO-WARD-VERONA", "WoodLine", "Шкафы", 69900, 8, "Трехстворчатый шкаф с зеркальной секцией", "🚪", "linear-gradient(135deg,#6c513f,#b89a7c)"],
  ["Диван Soft Cloud", "DEMO-SOFA-CLOUD", "HomeArt", "Гостиные", 89900, 5, "Модульный диван для гостиной", "🛋️", "linear-gradient(135deg,#7b8794,#d7dde8)"],
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
  const host = window.location.hostname || "127.0.0.1";
  return `http://${host}:8080`;
}

function token() {
  return localStorage.getItem(LS_TOKEN) || "";
}

function setToken(value) {
  value ? localStorage.setItem(LS_TOKEN, value) : localStorage.removeItem(LS_TOKEN);
  updateAccountButton();
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
  if (token() && (await validateToken())) return;
  setToken("");
  setCustomerName("");
  try {
    const data = await api("POST", "/auth/token", { username: "admin", password: "demo123456" });
    setToken(data.access_token);
    setCustomerName("admin");
  } catch (error) {
    console.warn("Demo login failed:", error);
  }
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
    closeAccountModal();
    toast(`Добро пожаловать, ${username}`);
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

async function seedDemoData() {
  const categories = await api("GET", "/catalog/categories");
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

  const products = await api("GET", "/catalog/products?limit=100");
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
}

async function loadCatalog() {
  state.categories = await api("GET", "/catalog/categories");
  state.products = await api("GET", "/catalog/products?limit=100&sort_by=name");
  document.getElementById("statProducts").textContent = state.products.length;
  document.getElementById("statCategories").textContent = state.categories.length;
  renderCategories();
  renderProducts();
}

function demoMeta(product) {
  const row = demoProducts.find((p) => p[1] === product.sku);
  return {
    icon: row?.[7] || "🪑",
    gradient: row?.[8] || "linear-gradient(135deg,#8d6e63,#d7ccc8)",
  };
}

function categoryName(id) {
  return state.categories.find((c) => c.id === id)?.name || "Каталог";
}

function renderCategories() {
  const host = document.getElementById("categoryPills");
  const counts = new Map();
  state.products.forEach((p) => counts.set(p.category_id, (counts.get(p.category_id) || 0) + 1));
  const buttons = [`<button class="btn btn-sm category-pill ${state.activeCategory === "all" ? "active" : ""}" data-cat="all">Все (${state.products.length})</button>`];
  for (const cat of state.categories) {
    const count = counts.get(cat.id) || 0;
    if (!count) continue;
    buttons.push(`<button class="btn btn-sm category-pill ${state.activeCategory === String(cat.id) ? "active" : ""}" data-cat="${cat.id}">${escapeHtml(cat.name)} (${count})</button>`);
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
    const qOk = !q || `${p.name} ${p.brand} ${p.description}`.toLowerCase().includes(q);
    return catOk && qOk;
  });
}

function renderProducts() {
  const host = document.getElementById("productGrid");
  const products = filteredProducts();
  if (!products.length) {
    host.innerHTML = `<div class="col-12 text-center text-muted py-5">По вашему запросу ничего не найдено.</div>`;
    return;
  }
  host.innerHTML = products
    .map((p) => {
      const meta = demoMeta(p);
      return `
        <div class="col-md-6 col-xl-4">
          <article class="card product-card h-100">
            <div class="product-art" style="background:${meta.gradient}">${meta.icon}</div>
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between gap-2 mb-2">
                <span class="badge text-bg-light">${escapeHtml(categoryName(p.category_id))}</span>
                <span class="small text-muted">на складе: ${p.stock}</span>
              </div>
              <h5>${escapeHtml(p.name)}</h5>
              <div class="text-muted small mb-2">${escapeHtml(p.brand)}</div>
              <p class="text-muted small flex-grow-1">${escapeHtml(p.description || "Современное мебельное решение для дома.")}</p>
              <div class="d-flex justify-content-between align-items-center">
                <span class="price fs-5">${money(Number(p.price))}</span>
                <div class="btn-group">
                  <button class="btn btn-outline-secondary btn-sm" data-wish="${p.id}">♡</button>
                  <button class="btn btn-primary btn-sm" data-cart="${p.id}">В корзину</button>
                </div>
              </div>
            </div>
          </article>
        </div>`;
    })
    .join("");

  host.querySelectorAll("[data-cart]").forEach((btn) => btn.addEventListener("click", () => addToCart(Number(btn.dataset.cart))));
  host.querySelectorAll("[data-wish]").forEach((btn) => btn.addEventListener("click", () => addToWishlist(Number(btn.dataset.wish))));
}

async function addToCart(id) {
  const product = state.products.find((p) => p.id === id);
  if (!product) return;
  const existing = state.cart.find((item) => item.id === id);
  existing ? existing.qty++ : state.cart.push({ ...product, qty: 1 });
  renderCart();
  try {
    await api("POST", `/catalog/users/${DEMO_USER}/cart/items`, { product_id: id, quantity: 1 }, true);
    toast(`${product.name} добавлен в корзину`);
  } catch (error) {
    toast(`Витрина обновлена, но backend вернул: ${error.message}`, false);
  }
}

async function addToWishlist(id) {
  const product = state.products.find((p) => p.id === id);
  try {
    await requestNoBody("POST", `/catalog/users/${DEMO_USER}/wishlist/products/${id}`, true);
    toast(`${product?.name || "Товар"} добавлен в избранное`);
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
            <strong>${escapeHtml(item.name)}</strong>
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

function normalizePartsForCutting(parts, sheetW, sheetH) {
  return parts.map((part) => {
    const width = Number(part.width);
    const height = Number(part.height);
    const fitsDirect = width <= sheetW && height <= sheetH;
    const fitsRotated = height <= sheetW && width <= sheetH;
    if (!fitsDirect && fitsRotated) {
      return { ...part, width: height, height: width };
    }
    return { ...part, width, height };
  });
}

async function optimizeCutting(customParts = null, silent = false) {
  const sourceParts = customParts || state.cuttingParts;
  if (!sourceParts.length) {
    if (!silent) toast("Добавьте детали для расчета раскроя", false);
    return null;
  }
  const sheetW = Number(document.getElementById("sheetW").value);
  const sheetH = Number(document.getElementById("sheetH").value);
  const parts = normalizePartsForCutting(sourceParts, sheetW, sheetH);
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
              return `<div title="${escapeHtml(p.name)}" style="
                position:absolute; left:${p.x * scaleX}%; top:${p.y * scaleY}%;
                width:${Math.max(p.width * scaleX, 5)}%; height:${Math.max(p.height * scaleY, 6)}%;
                background:${color};" class="cut-rect"></div>
                <div class="cut-rect-label" style="left:${p.x * scaleX}%; top:${labelTop}%; background:${color};">${escapeHtml(p.name)}</div>`;
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
  try {
    const project = await api(
      "POST",
      "/planner/projects",
      {
        name: document.getElementById("projectName").value,
        location: document.getElementById("projectLocation").value,
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
    { id: crypto.randomUUID(), type: "wardrobe", texture: "wood_dark_oak", name: "Шкаф Verona", width: 1.4, depth: 0.6, height: 2.2, x: 5.0, z: 0.9, rotationY: 0 },
    { id: crypto.randomUUID(), type: "sofa", texture: "fabric_gray", name: "Диван Soft Cloud", width: 2.2, depth: 1.0, height: 0.9, x: 1.5, z: 3.5, rotationY: 90 },
    { id: crypto.randomUUID(), type: "cabinet", texture: "board_black", name: "Остров Chef", width: 1.8, depth: 0.8, height: 0.9, x: 3.0, z: 2.2, rotationY: 0 },
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

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(7, 5.5, 7.5);
  camera.lookAt(0, 1, 0);

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
    radius: 11,
    target: new THREE.Vector3(0, 1, 0),
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
      state.three.orbit.radius = Math.min(Math.max(state.three.orbit.radius + event.deltaY * 0.01, 3), 18);
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
    new THREE.BoxGeometry(width, 0.06, length),
    new THREE.MeshStandardMaterial({ color: 0xd8c2a8, roughness: 0.95 })
  );
  floor.position.y = -0.03;
  roomGroup.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf4eadf, roughness: 0.95 });
  const wallBack = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.05), wallMat);
  wallBack.position.set(0, height / 2, -length / 2);
  roomGroup.add(wallBack);

  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, height, length), wallMat);
  wallLeft.position.set(-width / 2, height / 2, 0);
  roomGroup.add(wallLeft);
}

function renderRoom3D() {
  if (!state.three) return;
  const { furnitureGroup } = state.three;
  furnitureGroup.clear();

  state.objects3d.forEach((item) => {
    const texturePreset = resolveTexturePreset(item);
    const w = Math.max(Number(item.width) || 1, 0.35);
    const d = Math.max(Number(item.depth) || 1, 0.35);
    const h = Math.max(Number(item.height) || 1, 0.35);
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
  host.style.minHeight = `${Math.max(220, Math.round(length * 42))}px`;
  const viewW = host.clientWidth || 400;
  const viewH = host.clientHeight || 260;
  const scale = Math.min(viewW / width, viewH / length);

  host.innerHTML = state.objects3d
    .map((item) => {
      const left = (item.x - item.width / 2) * scale;
      const top = (item.z - item.depth / 2) * scale;
      const chipW = Math.max(item.width * scale, 24);
      const chipH = Math.max(item.depth * scale, 18);
      const texturePreset = resolveTexturePreset(item);
      return `<div class="furniture-chip" data-drag-id="${item.id}" style="cursor:grab; left:${left}px; top:${top}px; width:${chipW}px; height:${chipH}px; background:${texturePreset.color};">${escapeHtml(item.name)}</div>`;
    })
    .join("");

  host.querySelectorAll("[data-drag-id]").forEach((el) => {
    el.addEventListener("pointerdown", (ev) => beginDrag(ev, el.dataset.dragId));
  });
}

function beginDrag(ev, id) {
  const item = state.objects3d.find((obj) => obj.id === id);
  if (!item) return;
  state.drag.active = true;
  state.drag.id = id;
  state.drag.startX = ev.clientX;
  state.drag.startY = ev.clientY;
  state.drag.baseX = item.x;
  state.drag.baseZ = item.z;
  ev.currentTarget.setPointerCapture(ev.pointerId);
}

function handleDragMove(ev) {
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

  item.x = Math.min(Math.max(state.drag.baseX + dx, item.width / 2), width - item.width / 2);
  item.z = Math.min(Math.max(state.drag.baseZ + dz, item.depth / 2), length - item.depth / 2);
  renderRoomTopView();
  renderRoom3D();
}

function endDrag() {
  state.drag.active = false;
  state.drag.id = null;
}

function applyRoomSize() {
  const width = Number(document.getElementById("roomWidth").value);
  const length = Number(document.getElementById("roomLength").value);
  const height = Number(document.getElementById("roomHeight").value);
  if (width < 2 || length < 2 || height < 2) {
    toast("Размеры комнаты должны быть >= 2 м", false);
    return;
  }
  state.roomConfig = { width, length, height };
  for (const item of state.objects3d) {
    item.x = Math.min(Math.max(item.x, item.width / 2), width - item.width / 2);
    item.z = Math.min(Math.max(item.z, item.depth / 2), length - item.depth / 2);
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
    toast("Габариты объекта должны быть > 0", false);
    return;
  }
  const item = {
    id: crypto.randomUUID(),
    type,
    texture,
    name,
    width,
    depth,
    height,
    x: Math.min(Math.max(state.roomConfig.width * 0.5, width / 2), state.roomConfig.width - width / 2),
    z: Math.min(Math.max(state.roomConfig.length * 0.5, depth / 2), state.roomConfig.length - depth / 2),
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
    const w = Math.round(item.width * 1000);
    const d = Math.round(item.depth * 1000);
    const h = Math.round(item.height * 1000);

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
    host.innerHTML = `<div class="text-muted">Добавьте объекты в 3D, чтобы получить детали и сборку.</div>`;
    return bom;
  }
  host.innerHTML = `
    <div class="mb-2"><strong>Детали для изготовления:</strong></div>
    <ul class="mb-3">${bom.parts.map((part) => `<li>${escapeHtml(part.name)} — ${part.width}×${part.height} мм × ${part.quantity}</li>`).join("")}</ul>
    <div class="mb-2"><strong>Черновой список сборки:</strong></div>
    <ul>${bom.assembly.map((row) => `<li>${escapeHtml(row)}</li>`).join("")}</ul>`;
  return bom;
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
      return [String(idx + 1), item.name, typeTitle, `${Math.round(item.width * 1000)}×${Math.round(item.depth * 1000)}×${Math.round(item.height * 1000)}`, textureTitle];
    }),
  ];

  const partsTableBody = [
    [{ text: "№", style: "thead" }, { text: "Деталь", style: "thead" }, { text: "Размер, мм", style: "thead" }, { text: "Кол-во", style: "thead" }],
    ...bom.parts.map((part, idx) => [String(idx + 1), part.name, `${part.width}×${part.height}`, String(part.quantity)]),
  ];

  const content = [
    { text: "Инструкция по сборке", style: "title" },
    { text: `Комната: ${state.roomConfig.width} × ${state.roomConfig.length} × ${state.roomConfig.height} м`, style: "meta" },
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

async function boot() {
  document.getElementById("apiBase").value = localStorage.getItem(LS_API) || defaultApiBase();
  document.getElementById("saveApiBase").addEventListener("click", () => {
    localStorage.setItem(LS_API, document.getElementById("apiBase").value.trim());
    location.reload();
  });
  document.getElementById("searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderProducts();
  });
  document.getElementById("btnOptimize").addEventListener("click", () => optimizeCutting());
  document.getElementById("btnAddPart").addEventListener("click", addPartFromInputs);
  document.getElementById("btnResetParts").addEventListener("click", resetPartsToDefault);

  document.getElementById("btnApplyRoomSize").addEventListener("click", applyRoomSize);
  document.getElementById("btnAddObject3d").addEventListener("click", () => {
    addObject3DFromForm();
    renderBom();
  });
  document.getElementById("btnCreateRoom").addEventListener("click", createRoom);
  document.getElementById("btnAddFurniture").addEventListener("click", addFurnitureSet);
  document.getElementById("btnGenerateBom").addEventListener("click", () => {
    renderBom();
    toast("BOM обновлен");
  });
  document.getElementById("btnCutFrom3d").addEventListener("click", cutFrom3D);
  document.getElementById("btnExportCutPdf").addEventListener("click", exportCutPdf);
  document.getElementById("btnExportAssemblyPdf").addEventListener("click", exportAssemblyPdf);
  document.getElementById("btnExport3d").addEventListener("click", exportSceneGltf);
  document.getElementById("btnAssetLink").addEventListener("click", prepareAssetLink);
  document.getElementById("btnLogin").addEventListener("click", loginCustomer);
  document.getElementById("btnRegister").addEventListener("click", registerCustomer);

  document.addEventListener("pointermove", handleDragMove);
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  state.cuttingParts = defaultCuttingParts.map((p) => ({ ...p }));
  createDemoObjects();
  renderParts();
  renderCart();
  renderRoomTopView();
  renderBom();
  initRoom3D();
  updateAccountButton();

  try {
    await api("GET", "/health");
    await autoLogin();
    await seedDemoData();
    await loadCatalog();
    setBackendStatus(true, "Витрина подключена, тестовые данные загружены");
  } catch (error) {
    setBackendStatus(false, "Backend недоступен");
    document.getElementById("productGrid").innerHTML = `<div class="col-12"><div class="alert alert-warning">Не удалось подключиться к backend: ${escapeHtml(error.message)}</div></div>`;
  }
}

document.addEventListener("DOMContentLoaded", boot);
