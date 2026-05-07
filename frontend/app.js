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
  furnitureCount: 0,
};

const demoCategories = ["Кухни", "Шкафы", "Гостиные", "Спальни", "Офис", "Детские"];
const demoProducts = [
  ["Кухня Nord Line", "DEMO-KITCHEN-NORD", "FurniPro", "Кухни", 184900, 4, "Полный кухонный гарнитур с матовыми фасадами", "🍽️", "linear-gradient(135deg,#bf7b45,#f1c27d)"],
  ["Шкаф Verona 3D", "DEMO-WARD-VERONA", "WoodLine", "Шкафы", 69900, 8, "Трёхстворчатый шкаф с зеркальной секцией", "🚪", "linear-gradient(135deg,#6c513f,#b89a7c)"],
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

const demoParts = [
  { name: "Боковина шкафа", width: 600, height: 2200, quantity: 2 },
  { name: "Полка", width: 560, height: 400, quantity: 5 },
  { name: "Фасад", width: 480, height: 720, quantity: 4 },
  { name: "Цоколь", width: 1800, height: 120, quantity: 1 },
];

function apiBase() {
  const input = document.getElementById("apiBase");
  return (input?.value || localStorage.getItem(LS_API) || "http://127.0.0.1:8080").replace(/\/$/, "");
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
  if (token()) return;
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
    toast("Аккаунт создан. Сейчас выполним вход.");
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
  document.getElementById("partsList").innerHTML = demoParts
    .map((part) => `
      <div class="d-flex justify-content-between align-items-center border rounded p-2 mb-2 bg-light">
        <div><strong>${part.name}</strong><div class="small text-muted">${part.width}×${part.height} мм</div></div>
        <span class="badge text-bg-secondary">${part.quantity} шт.</span>
      </div>`)
    .join("");
}

async function optimizeCutting() {
  const payload = {
    sheet_width: Number(document.getElementById("sheetW").value),
    sheet_height: Number(document.getElementById("sheetH").value),
    parts: demoParts,
  };
  try {
    const data = await api("POST", "/cutting/optimize", payload, true);
    document.getElementById("cutStats").textContent = `${data.placed_count}/${data.requested_count} деталей, ${data.utilization_percent}% листа`;
    renderCutView(payload.sheet_width, payload.sheet_height, data.placements || []);
    toast("Раскрой рассчитан");
  } catch (error) {
    toast(`Раскрой недоступен: ${error.message}`, false);
  }
}

function renderCutView(sheetW, sheetH, placements) {
  const view = document.getElementById("cutView");
  if (!placements.length) {
    view.innerHTML = `<span class="text-muted">Сервис не вернул размещения.</span>`;
    return;
  }
  const scaleX = 100 / sheetW;
  const scaleY = 100 / sheetH;
  view.innerHTML = `
    <div class="position-relative w-100 h-100" style="min-height:240px">
      ${placements
        .map((p, i) => {
          const colors = ["#a16207", "#7c3aed", "#0f766e", "#be123c", "#2563eb", "#65a30d"];
          return `<div title="${escapeHtml(p.name)}" style="
            position:absolute; left:${p.x * scaleX}%; top:${p.y * scaleY}%;
            width:${Math.max(p.width * scaleX, 5)}%; height:${Math.max(p.height * scaleY, 6)}%;
            background:${colors[i % colors.length]}; color:#fff; border:1px solid rgba(255,255,255,.75);
            border-radius:.35rem; font-size:.7rem; padding:.2rem; overflow:hidden">${escapeHtml(p.name)}</div>`;
        })
        .join("")}
    </div>`;
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
    state.furnitureCount = 0;
    document.getElementById("plannerHint").textContent = `Проект №${project.id} создан: ${project.name}`;
    renderRoom([]);
    toast("Проект комнаты создан");
  } catch (error) {
    toast(`Планировщик недоступен: ${error.message}`, false);
  }
}

async function addFurnitureSet() {
  if (!state.projectId) await createRoom();
  if (!state.projectId) return;

  const set = [
    { name: "Кухонный остров", width: 1.8, depth: 0.8, height: 0.9, x: 1, y: 0, z: 1, rotation_y: 0 },
    { name: "Шкаф Verona", width: 1.4, depth: 0.6, height: 2.2, x: 3, y: 0, z: 0.5, rotation_y: 0 },
    { name: "Диван Soft Cloud", width: 2.2, depth: 1, height: 0.9, x: 0.8, y: 0, z: 3, rotation_y: 90 },
  ];
  try {
    for (const item of set) {
      await api("POST", `/planner/projects/${state.projectId}/furniture`, item, true);
    }
    const furniture = await api("GET", `/planner/projects/${state.projectId}/furniture`);
    state.furnitureCount = furniture.length;
    document.getElementById("plannerHint").textContent = `В проекте №${state.projectId}: ${furniture.length} предмета мебели`;
    renderRoom(furniture);
    toast("Комплект мебели размещён");
  } catch (error) {
    toast(`Не удалось разместить мебель: ${error.message}`, false);
  }
}

function renderRoom(items) {
  const host = document.getElementById("roomPlan");
  if (!items.length) {
    host.innerHTML = `<div class="position-absolute top-50 start-50 translate-middle text-muted text-center">Создайте проект и добавьте комплект мебели</div>`;
    return;
  }
  host.innerHTML = items
    .map((item, index) => {
      const left = [8, 48, 18, 62, 36][index % 5];
      const top = [14, 10, 62, 48, 35][index % 5];
      const width = Math.min(Math.max(item.width * 18, 18), 42);
      const height = Math.min(Math.max(item.depth * 24, 14), 34);
      return `<div class="furniture-chip" style="left:${left}%; top:${top}%; width:${width}%; height:${height}%">${escapeHtml(item.name)}</div>`;
    })
    .join("");
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
  document.getElementById("apiBase").value = localStorage.getItem(LS_API) || "http://127.0.0.1:8080";
  document.getElementById("saveApiBase").addEventListener("click", () => {
    localStorage.setItem(LS_API, document.getElementById("apiBase").value.trim());
    location.reload();
  });
  document.getElementById("searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderProducts();
  });
  document.getElementById("btnOptimize").addEventListener("click", optimizeCutting);
  document.getElementById("btnCreateRoom").addEventListener("click", createRoom);
  document.getElementById("btnAddFurniture").addEventListener("click", addFurnitureSet);
  document.getElementById("btnAssetLink").addEventListener("click", prepareAssetLink);
  document.getElementById("btnLogin").addEventListener("click", loginCustomer);
  document.getElementById("btnRegister").addEventListener("click", registerCustomer);

  renderParts();
  renderCart();
  renderRoom([]);
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
