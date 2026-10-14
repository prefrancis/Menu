/* =========================================================
   SUGAR CRUSH MILK TEA — Pre-Order System
   Backed by Supabase. Same `orders` table as the original
   system (no schema changes needed) — see notes in section 8.
========================================================= */

/* ---------------------------------------------------------
   0. SUPABASE SETUP
   Dashboard > Project Settings > API:
   - Project URL  -> looks like https://xxxxx.supabase.co
   - anon public key -> long string starting with "eyJ..."
--------------------------------------------------------- */
const SUPABASE_URL = "https://devdmcimuyqkwdzypomb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldmRtY2ltdXlxa3dkenlwb21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Mjg1OTcsImV4cCI6MjEwMDAwNDU5N30.qYUvpKApDliUw11wcmB5c2VzvrRNtrlV5kwRXlDl1H4";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------------------------------------------------------
   1. SHOP SETTINGS — EDIT HERE
--------------------------------------------------------- */
const MAX_QTY_PER_ITEM = 100;   // max cups per menu item, per order (all sizes/variants combined)

const ADMIN_PASSCODE = "sugarcrush2026"; // demo only — replace with real auth for production

// Pickup slots are generated from these (24-hour clock)
const OPEN_HOUR = 10;           // first pickup slot  -> 10:00 AM
const CLOSE_HOUR = 21;          // last pickup slot   ->  9:00 PM
const SLOT_MINUTES = 30;        // gap between slots
const PREP_MINUTES = 15;        // earliest a slot can be booked from "now"

/* ---------------------------------------------------------
   2. EDIT YOUR MENU HERE  (prices from the shop's menu board)
--------------------------------------------------------- */

// Sweetness levels shown on the menu board
const SUGAR_LEVELS = [0, 25, 50, 75, 100];
const DEFAULT_SUGAR = 100;

// Add-ons. `only` limits an add-on to certain categories.
const ADDONS = [
  { id: "a1", name: "Tapioca Pearls",      price: 10 },
  { id: "a2", name: "Nata Jelly",          price: 10 },
  { id: "a3", name: "Extra Shot Espresso", price: 30, only: ["Coffee"] },
];

// Size / option helpers
const ML = (m, l) => [
  { key: "M", label: "Medium (16oz)", short: "M", price: m },
  { key: "L", label: "Large (22oz)",  short: "L", price: l },
];
const COFFEE = (p) => [
  { key: "ICED", label: "Iced (16oz)", short: "Iced", price: p },
  { key: "HOT",  label: "Hot (12oz)",  short: "Hot",  price: p },
];
const ONE_SIZE = (p, oz = "16oz") => [{ key: "STD", label: oz, short: oz, price: p }];

const CATEGORY_NOTES = {
  "Coffee": "Iced 16oz or Hot 12oz — same price",
  "Non Coffee": "16oz",
};

const MENU = [
  // ---- FRUITTI (M 16oz / L 22oz) ----
  { id: "f1", category: "Fruitti", name: "Lychee",      emoji: "🍒", desc: "Sweet, floral lychee fruit tea.",          options: ML(39, 49) },
  { id: "f2", category: "Fruitti", name: "Strawberry",  emoji: "🍓", desc: "Juicy strawberry fruit tea.",              options: ML(39, 49) },
  { id: "f3", category: "Fruitti", name: "Mango",       emoji: "🥭", desc: "Tropical ripe mango fruit tea.",           options: ML(39, 49) },
  { id: "f4", category: "Fruitti", name: "Melon",       emoji: "🍈", desc: "Cool, refreshing melon fruit tea.",        options: ML(39, 49) },
  { id: "f5", category: "Fruitti", name: "Blueberry",   emoji: "🫐", desc: "Fruity, tangy blueberry fruit tea.",       options: ML(39, 49) },
  { id: "f6", category: "Fruitti", name: "Green Apple", emoji: "🍏", desc: "Crisp and tangy green apple fruit tea.",   options: ML(39, 49) },

  // ---- MILK TEA (M 16oz / L 22oz) ----
  { id: "t1", category: "Milk Tea", name: "Wintermelon",       emoji: "🧋", desc: "Classic caramel-sweet wintermelon milk tea.", options: ML(49, 59) },
  { id: "t2", category: "Milk Tea", name: "Cookies & Cream",   emoji: "🍪", desc: "Creamy milk tea with cookie crumbs.",         options: ML(49, 59) },
  { id: "t3", category: "Milk Tea", name: "Okinawa",           emoji: "🧋", desc: "Rich brown-sugar Okinawa milk tea.",          options: ML(49, 59) },
  { id: "t4", category: "Milk Tea", name: "Salted Caramel",    emoji: "🍮", desc: "Sweet-salty caramel milk tea.",               options: ML(49, 59) },
  { id: "t5", category: "Milk Tea", name: "Taro",              emoji: "🍠", desc: "Smooth, nutty purple taro milk tea.",         options: ML(49, 59) },
  { id: "t6", category: "Milk Tea", name: "Belgian Chocolate", emoji: "🍫", desc: "Deep chocolatey milk tea.",                   options: ML(49, 59) },
  { id: "t7", category: "Milk Tea", name: "Matcha",            emoji: "🍵", desc: "Earthy Japanese-style matcha milk tea.",      options: ML(49, 59) },

  // ---- COFFEE (ESPRESSO) — Iced 16oz or Hot 12oz ----
  { id: "c1", category: "Coffee", name: "Americano",         emoji: "☕", desc: "Espresso with water. Bold and clean.",       options: COFFEE(79) },
  { id: "c2", category: "Coffee", name: "Cafe Latte",        emoji: "☕", desc: "Espresso with steamed milk.",                options: COFFEE(89) },
  { id: "c3", category: "Coffee", name: "Dalgona Espresso",  emoji: "☕", desc: "Whipped coffee cream over milk & espresso.", options: COFFEE(99) },
  { id: "c4", category: "Coffee", name: "Spanish Latte",     emoji: "☕", desc: "Sweetened condensed milk latte.",            options: COFFEE(99) },
  { id: "c5", category: "Coffee", name: "Vanilla Latte",     emoji: "☕", desc: "Smooth latte with vanilla syrup.",           options: COFFEE(99) },
  { id: "c6", category: "Coffee", name: "Mocha Latte",       emoji: "☕", desc: "Espresso, milk and chocolate.",              options: COFFEE(99) },
  { id: "c7", category: "Coffee", name: "White Mocha Latte", emoji: "☕", desc: "Espresso, milk and white chocolate.",        options: COFFEE(99) },
  { id: "c8", category: "Coffee", name: "Caramel Macchiato", emoji: "☕", desc: "Vanilla milk, espresso and caramel drizzle.",options: COFFEE(99) },

  // ---- FRESH LEMON (M 16oz / L 22oz) ----
  // ⚠ Classic Lemonade's price was smudged on the menu photo — 59 / 69 is a best guess. Please confirm.
  { id: "l1", category: "Fresh Lemon", name: "Classic Lemonade", emoji: "🍋", desc: "Freshly squeezed lemonade.",              options: ML(59, 69) },
  { id: "l2", category: "Fresh Lemon", name: "Lemon Yakult",     emoji: "🍋", desc: "Fresh lemon with creamy Yakult.",          options: ML(69, 79) },

  // ---- NON COFFEE (16oz) ----
  { id: "n1", category: "Non Coffee", name: "Strawberry Milk", emoji: "🍓", desc: "Strawberry puree with cold milk.",          options: ONE_SIZE(79) },
  { id: "n2", category: "Non Coffee", name: "Matchaberry",     emoji: "🍵", desc: "Matcha meets strawberry. Sweet & earthy.",  options: ONE_SIZE(79) },
  { id: "n3", category: "Non Coffee", name: "Milky Matcha",    emoji: "🍵", desc: "Creamy matcha latte.",                      options: ONE_SIZE(79) },

  // ---- FRAPPE (M 16oz / L 22oz) ----
  // ⚠ Only "Cookies & Cream" was visible on the photo (the board is cut off). Add other frappes here.
  { id: "p1", category: "Frappe", name: "Cookies & Cream", emoji: "🥤", desc: "Blended cookies & cream frappe.", options: ML(99, 119) },
];

/* ---------------------------------------------------------
   3. STATE
--------------------------------------------------------- */
const state = {
  cart: {},               // { lineKey: { itemId, optKey, sugar, addons:[ids], qty } }
  orders: [],             // orders currently loaded from Supabase
  myTicketIds: [],        // tickets placed this session, shown automatically in tracker
  nextTicketNumber: 1,    // shown on the hero banner; refreshed from the DB
  activeCategory: "All",
  adminAuthed: false,
  adminStatusFilter: "All",
  custom: null,           // drink currently being customized
};

const money = (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatTicket = (n) => "SC-" + String(n).padStart(4, "0");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------------------------------------------------
   4. ELEMENT REFS
--------------------------------------------------------- */
const el = (id) => document.getElementById(id);

const catbar = el("catbar");
const menuGrid = el("menuGrid");
const cartItemsEl = el("cartItems");
const cartEmptyEl = el("cartEmpty");
const cartTotalEl = el("cartTotal");
const cartCountEl = el("cartCount");
const checkoutBtn = el("checkoutBtn");

const views = { student: el("view-student"), tracker: el("view-tracker"), admin: el("view-admin") };
const navBtns = { student: el("navStudent"), tracker: el("navTracker"), admin: el("navAdmin") };

let toastTimer;
function toast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-show"), 2600);
}

/* ---------------------------------------------------------
   5. SUPABASE DATA LAYER
--------------------------------------------------------- */

// Convert a raw Supabase row into the shape the UI uses
function mapRow(row) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    ticket: formatTicket(row.ticket_number),
    studentName: row.student_name,       // customer name
    studentSection: row.student_section, // customer mobile number
    pickupTime: row.pickup_time,
    payment: row.payment_method,
    gcashRef: row.gcash_ref,
    paid: row.paid,
    items: row.items,
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
  };
}

// Load every order (used for the admin dashboard's full queue)
async function fetchAllOrders() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch orders failed:", error);
    return [];
  }
  return data.map(mapRow);
}

// Refresh the "next queue number" shown on the hero banner
async function refreshHeroTicket() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("ticket_number")
    .order("ticket_number", { ascending: false })
    .limit(1);

  const nextNum = !error && data && data.length ? data[0].ticket_number + 1 : 1;
  state.nextTicketNumber = nextNum;
  const ticketEl = el("heroTicketNum");
  if (ticketEl) ticketEl.textContent = formatTicket(nextNum);
}

// Insert a new order; returns the saved row (with DB-assigned ticket_number) or null on failure
async function insertOrder(payload) {
  const { data, error } = await supabaseClient
    .from("orders")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Insert order failed:", error);
    alert("❌ Order not saved.\n\nReason: " + error.message);
    return null;
  }
  return mapRow(data);
}

async function updateOrderStatus(id, status) {
  const { error } = await supabaseClient.from("orders").update({ status }).eq("id", id);
  if (error) {
    console.error("Update status failed:", error);
    alert("❌ Could not update status: " + error.message);
    return false;
  }
  return true;
}

async function updateOrderPaid(id, paid) {
  const { error } = await supabaseClient.from("orders").update({ paid }).eq("id", id);
  if (error) {
    console.error("Update paid failed:", error);
    alert("❌ Could not update payment: " + error.message);
    return false;
  }
  return true;
}

// Search orders by ticket number or customer name (used in the tracker)
async function searchOrders(query) {
  const digits = query.replace(/[^0-9]/g, "");
  const safe = query.replace(/[,()%]/g, " "); // keep the PostgREST filter string well-formed
  const orFilter = digits
    ? `ticket_number.eq.${Number(digits)},student_name.ilike.%${safe}%`
    : `student_name.ilike.%${safe}%`;

  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Search failed:", error);
    return [];
  }
  return data.map(mapRow);
}

// Live updates: whenever any order changes, refresh whichever view is open
supabaseClient
  .channel("orders-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
    refreshHeroTicket();
    if (!views.admin.hidden) renderAdmin();
    if (!views.tracker.hidden) renderTracker();
  })
  .subscribe();

/* ---------------------------------------------------------
   6. VIEW SWITCHING
--------------------------------------------------------- */
function showView(name) {
  Object.keys(views).forEach((k) => {
    views[k].hidden = k !== name;
    navBtns[k].classList.toggle("is-active", k === name);
  });
  if (name === "tracker") renderTracker();
  if (name === "admin") renderAdmin();
}
navBtns.student.addEventListener("click", () => showView("student"));
navBtns.tracker.addEventListener("click", () => showView("tracker"));
navBtns.admin.addEventListener("click", () => showView("admin"));

/* ---------------------------------------------------------
   7. MENU RENDERING
--------------------------------------------------------- */
const findItem = (id) => MENU.find((m) => m.id === id);

function categories() {
  return ["All", ...new Set(MENU.map((m) => m.category))];
}

function renderCatbar() {
  catbar.innerHTML = "";
  categories().forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "catchip" + (cat === state.activeCategory ? " is-active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      state.activeCategory = cat;
      renderCatbar();
      renderMenu();
    });
    catbar.appendChild(btn);
  });
}

function renderMenu() {
  menuGrid.innerHTML = "";
  const grouped = {};
  MENU.filter((m) => state.activeCategory === "All" || m.category === state.activeCategory)
    .forEach((m) => {
      grouped[m.category] = grouped[m.category] || [];
      grouped[m.category].push(m);
    });

  Object.entries(grouped).forEach(([cat, items]) => {
    const heading = document.createElement("div");
    heading.className = "menuCategory";
    const note = CATEGORY_NOTES[cat] || (items[0].options.length > 1 ? "Medium 16oz · Large 22oz" : "");
    heading.innerHTML = `<h3>${esc(cat)}</h3>${note ? `<small>${esc(note)}</small>` : ""}`;
    menuGrid.appendChild(heading);
    items.forEach((item) => menuGrid.appendChild(buildDrinkCard(item)));
  });
}

function buildDrinkCard(item) {
  const inCart = itemQty(item.id);
  const full = inCart >= MAX_QTY_PER_ITEM;
  const card = document.createElement("article");
  card.className = "foodCard" + (inCart ? " is-inCart" : "");

  const prices = item.options.length > 1
    ? item.options.map((o) => `<span class="priceTag"><small>${esc(o.short)}</small>${money(o.price).replace(".00", "")}</span>`).join("")
    : `<span class="priceTag">${money(item.options[0].price).replace(".00", "")}</span>`;

  card.innerHTML = `
    ${inCart ? `<span class="inCartBadge">${inCart} in tray</span>` : ""}
    <div class="foodCard__top">
      <div class="foodCard__emoji">${item.emoji}</div>
      <div>
        <div class="foodCard__name">${esc(item.name)}</div>
        <div class="foodCard__desc">${esc(item.desc)}</div>
      </div>
    </div>
    <div class="foodCard__bottom">
      <div class="foodCard__prices">${prices}</div>
      <button class="addBtn" ${full ? "disabled" : ""}>${full ? "Max " + MAX_QTY_PER_ITEM : "Add +"}</button>
    </div>
  `;
  card.querySelector(".addBtn").addEventListener("click", () => openCustomize(item.id));
  return card;
}

/* ---------------------------------------------------------
   8. CART  (each unique drink + size + sweetness + add-ons is one line)
   Notes: the order is saved to the existing `orders` table. Each
   cart line is stored in `items` as { name, qty, price } where `name`
   carries the size / sweetness / add-ons, e.g.
   "Wintermelon (L, 50% sugar, +Tapioca Pearls)" and `price` is the
   per-cup price including add-ons. The mobile number is stored in the
   existing `student_section` column.
--------------------------------------------------------- */
const lineKeyOf = (l) => [l.itemId, l.optKey, l.sugar, [...l.addons].sort().join("+")].join("|");

// Total cups of one menu item currently in the cart (all sizes / variants)
function itemQty(itemId) {
  return Object.values(state.cart).filter((l) => l.itemId === itemId).reduce((s, l) => s + l.qty, 0);
}

function addonsFor(item) {
  return ADDONS.filter((a) => !a.only || a.only.includes(item.category));
}

// Expand a stored cart line into everything the UI needs
function describeLine(key, l) {
  const item = findItem(l.itemId);
  const opt = item.options.find((o) => o.key === l.optKey);
  const addons = l.addons.map((id) => ADDONS.find((a) => a.id === id));
  const unit = opt.price + addons.reduce((s, a) => s + a.price, 0);

  const parts = [];
  if (item.options.length > 1) parts.push(opt.short);
  parts.push(l.sugar + "% sugar");
  addons.forEach((a) => parts.push("+" + a.name));

  return {
    key,
    itemId: l.itemId,
    qty: l.qty,
    emoji: item.emoji,
    baseName: item.name,
    optsText: parts.join(", "),
    name: `${item.name} (${parts.join(", ")})`,
    price: unit,
    lineTotal: unit * l.qty,
  };
}

function cartLines() {
  return Object.entries(state.cart).map(([key, l]) => describeLine(key, l));
}
function cartTotal() {
  return cartLines().reduce((sum, l) => sum + l.lineTotal, 0);
}

// Add cups to the cart; returns how many were actually added (respects the per-item limit)
function addToCart(line, qty) {
  const room = MAX_QTY_PER_ITEM - itemQty(line.itemId);
  const add = Math.min(qty, Math.max(0, room));
  if (add <= 0) {
    toast(`Limit reached — max ${MAX_QTY_PER_ITEM} per item per order.`);
    return 0;
  }
  const key = lineKeyOf(line);
  if (state.cart[key]) state.cart[key].qty += add;
  else state.cart[key] = { ...line, addons: [...line.addons], qty: add };
  if (add < qty) toast(`Only ${add} added — max ${MAX_QTY_PER_ITEM} per item per order.`);
  return add;
}

function setLineQty(key, wanted) {
  const l = state.cart[key];
  if (!l) return;
  const others = itemQty(l.itemId) - l.qty;
  const max = MAX_QTY_PER_ITEM - others;
  let next = Math.floor(Number(wanted));
  if (!Number.isFinite(next)) next = l.qty;
  if (next > max) { next = max; toast(`Limit reached — max ${MAX_QTY_PER_ITEM} per item per order.`); }
  if (next <= 0) delete state.cart[key];
  else l.qty = next;
  renderMenu();
  renderCart();
}

function renderCart() {
  const lines = cartLines();
  cartCountEl.textContent = lines.reduce((s, l) => s + l.qty, 0);

  cartItemsEl.innerHTML = "";
  cartEmptyEl.hidden = lines.length > 0;
  checkoutBtn.disabled = lines.length === 0;

  lines.forEach((l) => {
    const room = MAX_QTY_PER_ITEM - itemQty(l.itemId);
    const row = document.createElement("div");
    row.className = "cartItem";
    row.innerHTML = `
      <div class="cartItem__emoji">${l.emoji}</div>
      <div class="cartItem__info">
        <div class="cartItem__name">${esc(l.baseName)}</div>
        <div class="cartItem__opts">${esc(l.optsText)}</div>
        <div class="cartItem__price">${money(l.price)} ea · ${money(l.lineTotal)}</div>
      </div>
      <div class="cartItem__side">
        <div class="stepper">
          <button data-act="minus" aria-label="Less">−</button>
          <input type="number" inputmode="numeric" min="1" max="${MAX_QTY_PER_ITEM}" value="${l.qty}" aria-label="Quantity">
          <button data-act="plus" aria-label="More" ${room <= 0 ? "disabled" : ""}>+</button>
        </div>
        <button class="cartItem__remove">Remove</button>
      </div>
    `;
    row.querySelector('[data-act="minus"]').addEventListener("click", () => setLineQty(l.key, l.qty - 1));
    row.querySelector('[data-act="plus"]').addEventListener("click", () => setLineQty(l.key, l.qty + 1));
    row.querySelector("input").addEventListener("change", (e) => setLineQty(l.key, e.target.value));
    row.querySelector(".cartItem__remove").addEventListener("click", () => setLineQty(l.key, 0));
    cartItemsEl.appendChild(row);
  });

  cartTotalEl.textContent = money(cartTotal());
}

const overlay = el("overlay");
const cartDrawer = el("cartDrawer");
function openCart() { cartDrawer.classList.add("is-open"); overlay.classList.add("is-open"); }
function closeCart() { cartDrawer.classList.remove("is-open"); overlay.classList.remove("is-open"); }
el("cartFab").addEventListener("click", openCart);
el("closeCart").addEventListener("click", closeCart);
overlay.addEventListener("click", () => { closeCart(); closeAllModals(); });

/* ---------------------------------------------------------
   9. CUSTOMIZE-A-DRINK SHEET (size, sweetness, add-ons, quantity)
--------------------------------------------------------- */
const customOverlay = el("customOverlay");
const customBody = el("customBody");

function openCustomize(itemId) {
  const item = findItem(itemId);
  if (itemQty(itemId) >= MAX_QTY_PER_ITEM) {
    toast(`Limit reached — max ${MAX_QTY_PER_ITEM} per item per order.`);
    return;
  }
  state.custom = { itemId, optKey: item.options[0].key, sugar: DEFAULT_SUGAR, addons: [], qty: 1 };
  renderCustomize();
  customOverlay.classList.add("is-open");
}
function closeCustomize() { customOverlay.classList.remove("is-open"); state.custom = null; }
el("closeCustom").addEventListener("click", closeCustomize);

function customUnitPrice() {
  const c = state.custom, item = findItem(c.itemId);
  const base = item.options.find((o) => o.key === c.optKey).price;
  return base + c.addons.reduce((s, id) => s + ADDONS.find((a) => a.id === id).price, 0);
}
const customRoom = () => MAX_QTY_PER_ITEM - itemQty(state.custom.itemId);

function updateCustomTotals() {
  const c = state.custom;
  el("customTotal").textContent = money(customUnitPrice() * c.qty);
}

function renderCustomize() {
  const c = state.custom, item = findItem(c.itemId), room = customRoom();
  c.qty = Math.min(Math.max(1, c.qty), room);

  const sizeGroup = item.options.length > 1 ? `
    <div class="custom__group">
      <h4>Size</h4>
      <div class="chipRow">
        ${item.options.map((o) => `
          <button type="button" class="optChip ${o.key === c.optKey ? "is-on" : ""}" data-opt="${o.key}">
            ${esc(o.label)}<small>${money(o.price).replace(".00", "")}</small>
          </button>`).join("")}
      </div>
    </div>` : "";

  const addons = addonsFor(item);
  const addonGroup = addons.length ? `
    <div class="custom__group">
      <h4>Add-ons <small>optional</small></h4>
      <div class="chipRow">
        ${addons.map((a) => `
          <button type="button" class="optChip optChip--addon ${c.addons.includes(a.id) ? "is-on" : ""}" data-addon="${a.id}">
            ${esc(a.name)}<small>+${money(a.price).replace(".00", "")}</small>
          </button>`).join("")}
      </div>
    </div>` : "";

  customBody.innerHTML = `
    <div class="custom__top">
      <div class="foodCard__emoji">${item.emoji}</div>
      <div>
        <div class="custom__title">${esc(item.name)}</div>
        <div class="custom__desc">${esc(item.desc)}</div>
      </div>
    </div>
    ${sizeGroup}
    <div class="custom__group">
      <h4>Sweetness level</h4>
      <div class="chipRow">
        ${SUGAR_LEVELS.map((s) => `<button type="button" class="optChip optChip--sugar ${s === c.sugar ? "is-on" : ""}" data-sugar="${s}">${s}%</button>`).join("")}
      </div>
    </div>
    ${addonGroup}
    <div class="custom__group custom__qty">
      <div>
        <h4 style="margin:0">Quantity</h4>
        <div class="hint">${room < MAX_QTY_PER_ITEM ? `${room} more allowed` : `Max ${MAX_QTY_PER_ITEM}`} per item</div>
      </div>
      <div class="stepper">
        <button type="button" data-q="-1" aria-label="Less">−</button>
        <input type="number" id="customQty" inputmode="numeric" min="1" max="${room}" value="${c.qty}" aria-label="Quantity">
        <button type="button" data-q="1" aria-label="More">+</button>
      </div>
    </div>
    <button type="button" class="btn btn--primary btn--block" id="customAddBtn">
      Add to Order · <span id="customTotal">${money(customUnitPrice() * c.qty)}</span>
    </button>
  `;

  customBody.querySelectorAll("[data-opt]").forEach((b) => b.addEventListener("click", () => { c.optKey = b.dataset.opt; renderCustomize(); }));
  customBody.querySelectorAll("[data-sugar]").forEach((b) => b.addEventListener("click", () => { c.sugar = Number(b.dataset.sugar); renderCustomize(); }));
  customBody.querySelectorAll("[data-addon]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.addon;
    c.addons = c.addons.includes(id) ? c.addons.filter((x) => x !== id) : [...c.addons, id];
    renderCustomize();
  }));

  const qtyInput = el("customQty");
  const clampQty = (v) => {
    let n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > room) { n = room; toast(`Limit reached — max ${MAX_QTY_PER_ITEM} per item per order.`); }
    return n;
  };
  customBody.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => {
    c.qty = clampQty(c.qty + Number(b.dataset.q));
    qtyInput.value = c.qty;
    updateCustomTotals();
  }));
  qtyInput.addEventListener("input", () => {
    const n = Math.floor(Number(qtyInput.value));
    if (Number.isFinite(n) && n >= 1) { c.qty = Math.min(n, room); updateCustomTotals(); }
  });
  qtyInput.addEventListener("change", () => { c.qty = clampQty(qtyInput.value); qtyInput.value = c.qty; updateCustomTotals(); });

  el("customAddBtn").addEventListener("click", () => {
    c.qty = clampQty(qtyInput.value);
    const added = addToCart({ itemId: c.itemId, optKey: c.optKey, sugar: c.sugar, addons: c.addons, qty: c.qty }, c.qty);
    if (!added) return;
    closeCustomize();
    renderMenu();
    renderCart();
    if (added === c.qty) toast(`${added} × ${item.name} added to your tray 🧋`);
  });
}

/* ---------------------------------------------------------
   10. CHECKOUT MODAL
--------------------------------------------------------- */
const checkoutOverlay = el("checkoutOverlay");
const checkoutForm = el("checkoutForm");
const gcashBox = el("gcashBox");

// Build pickup choices: "As soon as possible" + time slots from now until closing
function buildPickupOptions() {
  const sel = el("pickupTime");
  const keep = sel.value;
  sel.innerHTML = `<option value="">Select a pickup time…</option>`;

  const fmt = (d) => d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  const now = new Date();
  const earliest = new Date(now.getTime() + PREP_MINUTES * 60000);

  const slotsFor = (base) => {
    const out = [];
    let d = new Date(base); d.setHours(OPEN_HOUR, 0, 0, 0);
    const end = new Date(base); end.setHours(CLOSE_HOUR, 0, 0, 0);
    for (; d <= end; d = new Date(d.getTime() + SLOT_MINUTES * 60000)) out.push(new Date(d));
    return out;
  };

  let today = slotsFor(now).filter((d) => d >= earliest);
  let prefix = "";
  if (today.length) {
    sel.insertAdjacentHTML("beforeend", `<option>As soon as possible (about ${PREP_MINUTES}–20 mins)</option>`);
  } else {
    const tmr = new Date(now.getTime() + 86400000);
    today = slotsFor(tmr);
    prefix = "Tomorrow — ";
  }
  today.forEach((d) => sel.insertAdjacentHTML("beforeend", `<option>${prefix}${fmt(d)}</option>`));
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
}

function openCheckout() {
  if (cartLines().length === 0) return;
  closeCart();
  buildPickupOptions();
  renderCheckoutSummary();
  checkoutOverlay.classList.add("is-open");
}
function closeCheckout() { checkoutOverlay.classList.remove("is-open"); }
checkoutBtn.addEventListener("click", openCheckout);
el("closeCheckout").addEventListener("click", closeCheckout);

document.querySelectorAll('input[name="payment"]').forEach((r) => {
  r.addEventListener("change", (e) => { gcashBox.hidden = e.target.value !== "gcash"; });
});

function renderCheckoutSummary() {
  const lines = cartLines();
  const rows = lines.map((l) => `<div class="row"><span>${esc(l.name)} × ${l.qty}</span><b>${money(l.lineTotal)}</b></div>`).join("");
  el("modalSummary").innerHTML = `${rows}<div class="totalRow"><span>Total</span><strong>${money(cartTotal())}</strong></div>`;
}

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payment = document.querySelector('input[name="payment"]:checked').value;
  const gcashRef = el("gcashRef").value.trim();

  if (payment === "gcash" && !gcashRef) {
    el("gcashRef").focus();
    el("gcashRef").style.borderColor = "var(--pink)";
    return;
  }

  // Safety net: never let an item go past the per-order limit
  const overLimit = MENU.find((m) => itemQty(m.id) > MAX_QTY_PER_ITEM);
  if (overLimit) { toast(`${overLimit.name}: max ${MAX_QTY_PER_ITEM} per order.`); return; }

  const customerName = el("studentName").value.trim();
  const customerPhone = el("studentSection").value.trim();
  const pickupTime = el("pickupTime").value;
  const lines = cartLines();

  const payload = {
    student_name: customerName,
    student_section: customerPhone,
    pickup_time: pickupTime,
    payment_method: payment,
    gcash_ref: payment === "gcash" ? gcashRef : null,
    paid: false, // cash: unpaid until pickup, gcash: pending verification
    items: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
    total: cartTotal(),
    status: "Pending",
  };

  const submitBtn = checkoutForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Placing order…";

  const savedOrder = await insertOrder(payload);

  submitBtn.disabled = false;
  submitBtn.textContent = "Place Order";

  if (!savedOrder) return; // insertOrder already alerted the specific error

  state.myTicketIds.push(savedOrder.id);
  state.cart = {};

  renderMenu();
  renderCart();
  await refreshHeroTicket();
  closeCheckout();
  checkoutForm.reset();
  el("gcashRef").style.borderColor = "";
  gcashBox.hidden = true;
  showConfirmation(savedOrder);
});

/* ---------------------------------------------------------
   11. CONFIRMATION TICKET
--------------------------------------------------------- */
const confirmOverlay = el("confirmOverlay");
function showConfirmation(order) {
  el("confirmNumber").textContent = order.ticket;
  const itemsList = order.items.map((i) => `${i.qty}× ${esc(i.name)}`).join("<br>");
  el("confirmDetails").innerHTML = `
    <div class="row"><span>Name</span><b>${esc(order.studentName)}</b></div>
    <div class="row"><span>Mobile</span><b>${esc(order.studentSection)}</b></div>
    <div class="row"><span>Pickup</span><b>${esc(order.pickupTime)}</b></div>
    <div class="row"><span>Items</span><b>${itemsList}</b></div>
    <div class="row"><span>Payment</span><b>${order.payment === "gcash" ? "GCash (pending verification)" : "Cash on pickup"}</b></div>
    <div class="row"><span>Total</span><b>${money(order.total)}</b></div>
  `;
  confirmOverlay.classList.add("is-open");
}
el("confirmDoneBtn").addEventListener("click", () => {
  confirmOverlay.classList.remove("is-open");
  showView("tracker");
});

function closeAllModals() {
  checkoutOverlay.classList.remove("is-open");
  confirmOverlay.classList.remove("is-open");
  closeCustomize();
}
[checkoutOverlay, confirmOverlay, customOverlay].forEach((ov) => {
  ov.addEventListener("click", (e) => { if (e.target === ov) closeAllModals(); });
});

/* ---------------------------------------------------------
   12. TRACKER VIEW (customer side)
--------------------------------------------------------- */
async function renderTracker() {
  const list = el("trackerList");
  list.innerHTML = `<p class="trackerEmpty">Loading…</p>`;

  let mine = [];
  if (state.myTicketIds.length) {
    const all = await fetchAllOrders();
    mine = all.filter((o) => state.myTicketIds.includes(o.id));
  }

  list.innerHTML = "";
  if (mine.length === 0) {
    list.innerHTML = `<p class="trackerEmpty">No orders yet this visit. Place an order, or search above for a past ticket.</p>`;
    return;
  }
  mine.forEach((o) => list.appendChild(buildOrderCard(o, false)));
}

el("trackerSearchBtn").addEventListener("click", runTrackerSearch);
el("trackerSearchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") runTrackerSearch(); });

async function runTrackerSearch() {
  const q = el("trackerSearchInput").value.trim();
  const list = el("trackerList");
  if (!q) { renderTracker(); return; }

  list.innerHTML = `<p class="trackerEmpty">Searching…</p>`;
  const results = await searchOrders(q);
  list.innerHTML = "";
  if (results.length === 0) {
    list.innerHTML = `<p class="trackerEmpty">No matching orders found.</p>`;
    return;
  }
  results.forEach((o) => list.appendChild(buildOrderCard(o, false)));
}

function statusBadgeClass(status) {
  return { Pending: "badge--pending", Preparing: "badge--preparing", Ready: "badge--ready", Completed: "badge--completed" }[status];
}

function buildOrderCard(o, isAdmin) {
  const card = document.createElement("div");
  card.className = "orderCard";
  const itemsText = o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join("<br>");
  const payBadge = o.payment === "gcash"
    ? `<span class="badge ${o.paid ? "badge--paid" : "badge--unpaid"}">${o.paid ? "GCash Verified" : "GCash Ref " + esc(o.gcashRef)}</span>`
    : `<span class="badge badge--unpaid">Cash on Pickup</span>`;

  card.innerHTML = `
    <div class="orderCard__head">
      <div>
        <div class="orderCard__num">${o.ticket}</div>
        <div class="orderCard__meta">${esc(o.studentName)} · ${esc(o.studentSection)} · ${esc(o.pickupTime)}</div>
      </div>
      <span class="badge ${statusBadgeClass(o.status)}">${esc(o.status)}</span>
    </div>
    <div class="orderCard__items">${itemsText}</div>
    <div class="orderCard__foot">
      ${payBadge}
      <strong>${money(o.total)}</strong>
    </div>
  `;

  if (isAdmin) {
    const actions = document.createElement("div");
    actions.className = "adminOrder__actions";

    const flow = ["Pending", "Preparing", "Ready", "Completed"];
    const idx = flow.indexOf(o.status);

    if (idx < flow.length - 1) {
      const nextBtn = document.createElement("button");
      nextBtn.className = "smallBtn smallBtn--primary";
      nextBtn.textContent = "Mark as " + flow[idx + 1];
      nextBtn.addEventListener("click", async () => { await updateOrderStatus(o.id, flow[idx + 1]); renderAdmin(); });
      actions.appendChild(nextBtn);
    }
    if (idx > 0) {
      const backBtn = document.createElement("button");
      backBtn.className = "smallBtn smallBtn--revert";
      backBtn.textContent = "↩ Revert to " + flow[idx - 1];
      backBtn.addEventListener("click", async () => { await updateOrderStatus(o.id, flow[idx - 1]); renderAdmin(); });
      actions.appendChild(backBtn);
    }
    if (o.payment === "gcash" && !o.paid) {
      const payBtn = document.createElement("button");
      payBtn.className = "smallBtn";
      payBtn.textContent = "Confirm GCash Payment";
      payBtn.addEventListener("click", async () => { await updateOrderPaid(o.id, true); renderAdmin(); });
      actions.appendChild(payBtn);
    }
    card.appendChild(actions);
  }

  return card;
}

/* ---------------------------------------------------------
   13. ADMIN VIEW
--------------------------------------------------------- */
el("adminLoginBtn").addEventListener("click", tryAdminLogin);
el("adminPass").addEventListener("keydown", (e) => { if (e.key === "Enter") tryAdminLogin(); });

function tryAdminLogin() {
  const val = el("adminPass").value;
  if (val === ADMIN_PASSCODE) {
    state.adminAuthed = true;
    el("adminError").hidden = true;
    el("adminPass").value = "";
    renderAdmin();
  } else {
    el("adminError").hidden = false;
  }
}
el("adminLogoutBtn").addEventListener("click", () => { state.adminAuthed = false; renderAdmin(); });
el("adminSearch").addEventListener("input", renderAdminOrderList);

async function renderAdmin() {
  el("adminLogin").hidden = state.adminAuthed;
  el("adminDash").hidden = !state.adminAuthed;
  if (!state.adminAuthed) return;

  el("adminDate").textContent = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  el("orderList").innerHTML = `<p class="trackerEmpty">Loading orders…</p>`;
  state.orders = await fetchAllOrders();

  renderAdminStats();
  renderAdminTabs();
  renderAdminOrderList();
}

function renderAdminStats() {
  const today = state.orders;
  const totalSales = today.reduce((s, o) => s + o.total, 0);
  const pending = today.filter((o) => o.status === "Pending").length;
  const ready = today.filter((o) => o.status === "Ready").length;

  el("statRow").innerHTML = `
    <div class="statCard"><strong>${today.length}</strong><span>TOTAL ORDERS</span></div>
    <div class="statCard"><strong>${money(totalSales)}</strong><span>TOTAL SALES</span></div>
    <div class="statCard"><strong>${pending}</strong><span>PENDING</span></div>
    <div class="statCard"><strong>${ready}</strong><span>READY FOR PICKUP</span></div>
  `;
}

function renderAdminTabs() {
  const tabs = ["All", "Pending", "Preparing", "Ready", "Completed"];
  const bar = el("statusTabs");
  bar.innerHTML = "";
  tabs.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "catchip" + (state.adminStatusFilter === t ? " is-active" : "");
    btn.textContent = t;
    btn.addEventListener("click", () => { state.adminStatusFilter = t; renderAdminTabs(); renderAdminOrderList(); });
    bar.appendChild(btn);
  });
}

function renderAdminOrderList() {
  const q = el("adminSearch").value.trim().toLowerCase();
  const list = el("orderList");
  list.innerHTML = "";

  const filtered = state.orders.filter((o) => {
    const statusOk = state.adminStatusFilter === "All" || o.status === state.adminStatusFilter;
    const searchOk = !q || o.ticket.toLowerCase().includes(q) || (o.studentName || "").toLowerCase().includes(q);
    return statusOk && searchOk;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<p class="trackerEmpty">No orders match here yet.</p>`;
    return;
  }
  filtered.forEach((o) => list.appendChild(buildOrderCard(o, true)));
}

/* ---------------------------------------------------------
   14. INIT
--------------------------------------------------------- */
renderCatbar();
renderMenu();
renderCart();
refreshHeroTicket();
showView("student");
