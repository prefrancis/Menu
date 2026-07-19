/* =========================================================
   KANTINA QUEUE — School Canteen Pre-Order System
   Backed by Supabase. Run schema.sql in your Supabase project
   first, then fill in the two values below.
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
   1. EDIT YOUR MENU HERE
--------------------------------------------------------- */
const MENU = [
  { id: "m1", category: "Rice Meals", name: "Chicken Adobo with Rice", price: 55, emoji: "🍗", desc: "Classic soy-vinegar braised chicken, steamed rice." },
  { id: "m2", category: "Rice Meals", name: "Beef Sinigang with Rice", price: 60, emoji: "🍲", desc: "Tamarind sour soup with beef and vegetables." },
  { id: "m3", category: "Rice Meals", name: "Sweet & Sour Pork", price: 55, emoji: "🍖", desc: "Crispy pork in tangy sweet-sour sauce, with rice." },
  { id: "m4", category: "Rice Meals", name: "Vegetable Fried Rice", price: 40, emoji: "🍛", desc: "Fried rice with mixed veggies and egg." },

  { id: "s1", category: "Snacks", name: "Cheese Siopao", price: 25, emoji: "🥟", desc: "Steamed bun with cheesy filling." },
  { id: "s2", category: "Snacks", name: "Banana Cue", price: 15, emoji: "🍌", desc: "Caramelized fried saba banana on a stick." },
  { id: "s3", category: "Snacks", name: "Cheese Sandwich", price: 20, emoji: "🥪", desc: "Toasted sandwich, cheese and egg spread." },
  { id: "s4", category: "Snacks", name: "Turon", price: 15, emoji: "🍠", desc: "Crispy banana-jackfruit spring roll." },

  { id: "d1", category: "Drinks", name: "Buko Juice", price: 20, emoji: "🥥", desc: "Fresh coconut juice, chilled." },
  { id: "d2", category: "Drinks", name: "Iced Tea", price: 15, emoji: "🧊", desc: "House-blend iced tea." },
  { id: "d3", category: "Drinks", name: "Bottled Water", price: 12, emoji: "💧", desc: "500ml purified water." },

  { id: "x1", category: "Desserts", name: "Leche Flan Cup", price: 20, emoji: "🍮", desc: "Creamy caramel custard, single serving." },
  { id: "x2", category: "Desserts", name: "Buko Pandan", price: 20, emoji: "🍧", desc: "Coconut and pandan gelatin dessert." },
];

const ADMIN_PASSCODE = "canteen2026"; // demo only — replace with real auth for production

/* ---------------------------------------------------------
   2. STATE
--------------------------------------------------------- */
const state = {
  cart: {},              // { menuId: qty }
  orders: [],             // orders currently loaded from Supabase
  myTicketIds: [],         // tickets placed this session, shown automatically in tracker
  nextTicketNumber: 1,      // shown on the hero banner; refreshed from the DB
  activeCategory: "All",
  adminAuthed: false,
  adminStatusFilter: "All",
};

const money = (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatTicket = (n) => "K-" + String(n).padStart(4, "0");

/* ---------------------------------------------------------
   3. ELEMENT REFS
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

/* ---------------------------------------------------------
   4. SUPABASE DATA LAYER
--------------------------------------------------------- */

// Convert a raw Supabase row into the shape the UI uses
function mapRow(row) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    ticket: formatTicket(row.ticket_number),
    studentName: row.student_name,
    studentSection: row.student_section,
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

// Search orders by ticket number or student name (used in the student tracker)
async function searchOrders(query) {
  const digits = query.replace(/[^0-9]/g, "");
  const orFilter = digits
    ? `ticket_number.eq.${Number(digits)},student_name.ilike.%${query}%`
    : `student_name.ilike.%${query}%`;

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
   5. VIEW SWITCHING
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
   6. MENU RENDERING
--------------------------------------------------------- */
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
    heading.innerHTML = `<h3>${cat}</h3>`;
    menuGrid.appendChild(heading);
    items.forEach((item) => menuGrid.appendChild(buildFoodCard(item)));
  });
}

function buildFoodCard(item) {
  const qty = state.cart[item.id] || 0;
  const card = document.createElement("article");
  card.className = "foodCard";
  card.innerHTML = `
    <div class="foodCard__top">
      <div class="foodCard__emoji">${item.emoji}</div>
      <div>
        <div class="foodCard__name">${item.name}</div>
        <div class="foodCard__desc">${item.desc}</div>
      </div>
    </div>
    <div class="foodCard__bottom">
      <span class="foodCard__price">${money(item.price)}</span>
      <div class="qtyZone" data-id="${item.id}"></div>
    </div>
  `;
  renderQtyZone(card.querySelector(".qtyZone"), item.id, qty);
  return card;
}

function renderQtyZone(zone, id, qty) {
  zone.innerHTML = "";
  if (qty === 0) {
    const btn = document.createElement("button");
    btn.className = "addBtn";
    btn.textContent = "Add +";
    btn.addEventListener("click", () => changeQty(id, 1));
    zone.appendChild(btn);
  } else {
    zone.innerHTML = `
      <div class="stepper">
        <button data-act="minus">−</button>
        <span>${qty}</span>
        <button data-act="plus">+</button>
      </div>`;
    zone.querySelector('[data-act="minus"]').addEventListener("click", () => changeQty(id, -1));
    zone.querySelector('[data-act="plus"]').addEventListener("click", () => changeQty(id, 1));
  }
}

function changeQty(id, delta) {
  const current = state.cart[id] || 0;
  const next = Math.max(0, current + delta);
  if (next === 0) delete state.cart[id];
  else state.cart[id] = next;
  renderMenu();
  renderCart();
}

/* ---------------------------------------------------------
   7. CART
--------------------------------------------------------- */
function cartLines() {
  return Object.entries(state.cart).map(([id, qty]) => {
    const item = MENU.find((m) => m.id === id);
    return { ...item, qty, lineTotal: item.price * qty };
  });
}
function cartTotal() {
  return cartLines().reduce((sum, l) => sum + l.lineTotal, 0);
}

function renderCart() {
  const lines = cartLines();
  cartCountEl.textContent = lines.reduce((s, l) => s + l.qty, 0);

  cartItemsEl.innerHTML = "";
  cartEmptyEl.hidden = lines.length > 0;
  checkoutBtn.disabled = lines.length === 0;

  lines.forEach((l) => {
    const row = document.createElement("div");
    row.className = "cartItem";
    row.innerHTML = `
      <div class="cartItem__emoji">${l.emoji}</div>
      <div class="cartItem__info">
        <div class="cartItem__name">${l.name} × ${l.qty}</div>
        <div class="cartItem__price">${money(l.lineTotal)}</div>
      </div>
      <button class="cartItem__remove">Remove</button>
    `;
    row.querySelector(".cartItem__remove").addEventListener("click", () => {
      delete state.cart[l.id];
      renderMenu();
      renderCart();
    });
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
   8. CHECKOUT MODAL
--------------------------------------------------------- */
const checkoutOverlay = el("checkoutOverlay");
const checkoutForm = el("checkoutForm");
const gcashBox = el("gcashBox");

function openCheckout() {
  if (cartLines().length === 0) return;
  closeCart();
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
  const rows = lines.map((l) => `<div class="row"><span>${l.name} × ${l.qty}</span><b>${money(l.lineTotal)}</b></div>`).join("");
  el("modalSummary").innerHTML = `${rows}<div class="totalRow"><span>Total</span><strong>${money(cartTotal())}</strong></div>`;
}

checkoutForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payment = document.querySelector('input[name="payment"]:checked').value;
  const gcashRef = el("gcashRef").value.trim();

  if (payment === "gcash" && !gcashRef) {
    el("gcashRef").focus();
    el("gcashRef").style.borderColor = "var(--red)";
    return;
  }

  const studentName = el("studentName").value.trim();
  const studentSection = el("studentSection").value.trim();
  const pickupTime = el("pickupTime").value;
  const lines = cartLines();

  const payload = {
    student_name: studentName,
    student_section: studentSection,
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
  gcashBox.hidden = true;
  showConfirmation(savedOrder);
});

/* ---------------------------------------------------------
   9. CONFIRMATION TICKET
--------------------------------------------------------- */
const confirmOverlay = el("confirmOverlay");
function showConfirmation(order) {
  el("confirmNumber").textContent = order.ticket;
  const itemsList = order.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
  el("confirmDetails").innerHTML = `
    <div class="row"><span>Name</span><b>${order.studentName}</b></div>
    <div class="row"><span>Section</span><b>${order.studentSection}</b></div>
    <div class="row"><span>Pickup</span><b>${order.pickupTime}</b></div>
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
}
[checkoutOverlay, confirmOverlay].forEach((ov) => {
  ov.addEventListener("click", (e) => { if (e.target === ov) closeAllModals(); });
});

/* ---------------------------------------------------------
   10. TRACKER VIEW (student side)
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
  const itemsText = o.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
  const payBadge = o.payment === "gcash"
    ? `<span class="badge ${o.paid ? "badge--paid" : "badge--unpaid"}">${o.paid ? "GCash Verified" : "GCash Ref " + o.gcashRef}</span>`
    : `<span class="badge badge--unpaid">Cash on Pickup</span>`;

  card.innerHTML = `
    <div class="orderCard__head">
      <div>
        <div class="orderCard__num">${o.ticket}</div>
        <div class="orderCard__meta">${o.studentName} · ${o.studentSection} · ${o.pickupTime}</div>
      </div>
      <span class="badge ${statusBadgeClass(o.status)}">${o.status}</span>
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
   11. ADMIN VIEW
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
    const searchOk = !q || o.ticket.toLowerCase().includes(q) || o.studentName.toLowerCase().includes(q);
    return statusOk && searchOk;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<p class="trackerEmpty">No orders match here yet.</p>`;
    return;
  }
  filtered.forEach((o) => list.appendChild(buildOrderCard(o, true)));
}

/* ---------------------------------------------------------
   12. INIT
--------------------------------------------------------- */
renderCatbar();
renderMenu();
renderCart();
refreshHeroTicket();
showView("student");
