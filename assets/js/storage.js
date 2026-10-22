/* ==========================================================================
   Lutong Lokal — assets/js/storage.js
   A small, defensive wrapper around localStorage and sessionStorage.

   Why this file exists
   - Browser storage can be disabled, full, or holding corrupt JSON.
   - Every read is validated and repaired so a broken entry can never crash
     a page.
   - Nothing secret is ever stored here: no passwords, no payment details.
   ========================================================================== */

var LUTONG_STORAGE_KEYS = {
  menu: "lutonglokal.menu.v1",
  cart: "lutonglokal.cart.v1",
  orders: "lutonglokal.orders.v1",
  users: "lutonglokal.users.v1",
  session: "lutonglokal.session.v1",
  myOrders: "lutonglokal.myorders.v1",
  messages: "lutonglokal.messages.v1"
};

/* Returns the storage area, or null when the browser blocks it entirely. */
function lutongGetStore(useSession) {
  try {
    var store = useSession ? window.sessionStorage : window.localStorage;
    // Touch the store so a blocked storage throws here instead of later.
    var probe = "__lutong_probe__";
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch (error) {
    return null;
  }
}

/* Reads and parses one key. Returns fallback when the value is missing,
   unreadable or not valid JSON. Never throws. */
function lutongRead(key, fallback, useSession) {
  var store = lutongGetStore(!!useSession);
  if (!store) {
    return fallback;
  }

  var raw;
  try {
    raw = store.getItem(key);
  } catch (error) {
    return fallback;
  }

  if (raw === null || raw === undefined || raw === "") {
    return fallback;
  }

  try {
    var parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (error) {
    // Corrupt value: clear it so it stops causing trouble, then start clean.
    try {
      store.removeItem(key);
    } catch (clearError) {
      /* ignore */
    }
    return fallback;
  }
}

/* Writes one key. Returns true when the write succeeded. */
function lutongWrite(key, value, useSession) {
  var store = lutongGetStore(!!useSession);
  if (!store) {
    return false;
  }

  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

/* Removes one key. */
function lutongRemove(key, useSession) {
  var store = lutongGetStore(!!useSession);
  if (!store) {
    return false;
  }

  try {
    store.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

/* Wipes every key this prototype owns (used by the "reset demo data" action). */
function lutongClearAll() {
  for (var name in LUTONG_STORAGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(LUTONG_STORAGE_KEYS, name)) {
      lutongRemove(LUTONG_STORAGE_KEYS[name], false);
      lutongRemove(LUTONG_STORAGE_KEYS[name], true);
    }
  }
}

/* --------------------------------------------------------------------------
   Validators used while reading stored data. They return a clean version of
   the record or null when the record is unusable.
   -------------------------------------------------------------------------- */

function lutongCleanMenuItem(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  var id = String(raw.id || "").trim();
  var name = String(raw.name || "").trim();

  if (!id || !name) {
    return null;
  }

  var price = Number(raw.price);
  if (!isFinite(price) || price < 0) {
    price = 0;
  }

  var category = String(raw.category || "main-dish").trim();
  var image = String(raw.image || "").trim();

  return {
    id: id,
    name: name.slice(0, 80),
    description: String(raw.description || "").slice(0, 400),
    price: Math.round(price * 100) / 100,
    category: category,
    image: image.slice(0, 500),
    available: raw.available !== false,
    featured: raw.featured === true,
    createdAt: String(raw.createdAt || "")
  };
}

function lutongCleanCartLine(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  var itemId = String(raw.itemId || "").trim();
  var name = String(raw.name || "").trim();
  var quantity = Math.floor(Number(raw.quantity));

  if (!itemId || !name || !isFinite(quantity) || quantity < 1) {
    return null;
  }

  var price = Number(raw.price);
  if (!isFinite(price) || price < 0) {
    price = 0;
  }

  return {
    itemId: itemId,
    name: name.slice(0, 80),
    price: Math.round(price * 100) / 100,
    quantity: Math.min(quantity, 99),
    image: String(raw.image || "").slice(0, 500)
  };
}

function lutongCleanOrder(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  var id = String(raw.id || "").trim();
  if (!id) {
    return null;
  }

  var items = [];
  var rawItems = Array.isArray(raw.items) ? raw.items : [];

  for (var i = 0; i < rawItems.length; i += 1) {
    var line = rawItems[i];
    if (!line || typeof line !== "object") {
      continue;
    }
    var name = String(line.name || "").trim();
    var price = Number(line.price);
    var quantity = Math.floor(Number(line.quantity));
    if (!name || !isFinite(price) || !isFinite(quantity) || quantity < 1) {
      continue;
    }
    items.push({
      name: name.slice(0, 80),
      price: Math.round(price * 100) / 100,
      quantity: Math.min(quantity, 99),
      lineTotal: Math.round(price * 100) * Math.min(quantity, 99) / 100
    });
  }

  var subtotal = lutongSumMoney(items);
  var itemCount = 0;
  for (var j = 0; j < items.length; j += 1) {
    itemCount += items[j].quantity;
  }

  return {
    id: id,
    createdAt: String(raw.createdAt || ""),
    ownerUsername: String(raw.ownerUsername || ""),
    customerName: String(raw.customerName || "").slice(0, 80),
    contactEmail: String(raw.contactEmail || "").slice(0, 120),
    phone: String(raw.phone || "").slice(0, 30),
    pickupTime: String(raw.pickupTime || "As soon as possible").slice(0, 60),
    pickupNote: String(raw.pickupNote || "").slice(0, 400),
    items: items,
    subtotal: subtotal,
    itemCount: itemCount,
    total: subtotal,
    status: lutongIsValidStatus(raw.status) ? raw.status : "Pending"
  };
}

/* Accounts loaded from storage are ALWAYS forced to the "user" role.
   This is a client-side convenience, not a security control — anyone can
   still edit localStorage by hand. */
function lutongCleanUser(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  var username = String(raw.username || "").trim();
  var email = String(raw.email || "").trim();

  if (!username || !email) {
    return null;
  }

  return {
    id: String(raw.id || ("u_" + username)),
    username: username.slice(0, 40),
    displayName: String(raw.displayName || username).slice(0, 80),
    email: email.slice(0, 120),
    role: "user",
    createdAt: String(raw.createdAt || "")
  };
}

function lutongCleanMessage(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  var name = String(raw.name || "").trim();
  var email = String(raw.email || "").trim();
  var message = String(raw.message || "").trim();

  if (!name || !email || !message) {
    return null;
  }

  return {
    id: String(raw.id || ""),
    createdAt: String(raw.createdAt || ""),
    name: name.slice(0, 80),
    email: email.slice(0, 120),
    subject: String(raw.subject || "General enquiry").slice(0, 60),
    message: message.slice(0, 1000)
  };
}

function lutongIsValidStatus(status) {
  var list = typeof LUTONG_ORDER_STATUSES !== "undefined" ? LUTONG_ORDER_STATUSES : [];
  for (var i = 0; i < list.length; i += 1) {
    if (list[i].id === status) {
      return true;
    }
  }
  return false;
}

/* --------------------------------------------------------------------------
   Public helpers for the collections this app uses.
   -------------------------------------------------------------------------- */

/* Money is calculated in centavos so totals never pick up float dust. */
function lutongSumMoney(items) {
  var totalCentavos = 0;
  for (var i = 0; i < items.length; i += 1) {
    totalCentavos += Math.round(Number(items[i].price) * 100) * Number(items[i].quantity);
  }
  return totalCentavos / 100;
}

function lutongGetMenu() {
  var stored = lutongRead(LUTONG_STORAGE_KEYS.menu, null, false);
  if (!Array.isArray(stored)) {
    var seeded = [];
    for (var i = 0; i < LUTONG_MENU_SEED.length; i += 1) {
      seeded.push(lutongCleanMenuItem(LUTONG_MENU_SEED[i]));
    }
    lutongWrite(LUTONG_STORAGE_KEYS.menu, seeded, false);
    return seeded;
  }

  var clean = [];
  for (var j = 0; j < stored.length; j += 1) {
    var item = lutongCleanMenuItem(stored[j]);
    if (item) {
      clean.push(item);
    }
  }
  return clean;
}

function lutongSaveMenu(items) {
  var clean = [];
  for (var i = 0; i < items.length; i += 1) {
    var item = lutongCleanMenuItem(items[i]);
    if (item) {
      clean.push(item);
    }
  }
  return lutongWrite(LUTONG_STORAGE_KEYS.menu, clean, false);
}

function lutongGetCart() {
  var stored = lutongRead(LUTONG_STORAGE_KEYS.cart, [], false);
  if (!Array.isArray(stored)) {
    return [];
  }

  var clean = [];
  for (var i = 0; i < stored.length; i += 1) {
    var line = lutongCleanCartLine(stored[i]);
    if (line) {
      clean.push(line);
    }
  }
  return clean;
}

function lutongSaveCart(lines) {
  var clean = [];
  for (var i = 0; i < lines.length; i += 1) {
    var line = lutongCleanCartLine(lines[i]);
    if (line) {
      clean.push(line);
    }
  }
  return lutongWrite(LUTONG_STORAGE_KEYS.cart, clean, false);
}

function lutongGetOrders() {
  var stored = lutongRead(LUTONG_STORAGE_KEYS.orders, [], false);
  if (!Array.isArray(stored)) {
    return [];
  }

  var clean = [];
  for (var i = 0; i < stored.length; i += 1) {
    var order = lutongCleanOrder(stored[i]);
    if (order) {
      clean.push(order);
    }
  }
  return clean;
}

function lutongSaveOrders(orders) {
  var clean = [];
  for (var i = 0; i < orders.length; i += 1) {
    var order = lutongCleanOrder(orders[i]);
    if (order) {
      clean.push(order);
    }
  }
  return lutongWrite(LUTONG_STORAGE_KEYS.orders, clean, false);
}

function lutongGetUsers() {
  var stored = lutongRead(LUTONG_STORAGE_KEYS.users, [], false);
  if (!Array.isArray(stored)) {
    return [];
  }

  var clean = [];
  for (var i = 0; i < stored.length; i += 1) {
    var user = lutongCleanUser(stored[i]);
    if (user) {
      clean.push(user);
    }
  }
  return clean;
}

function lutongSaveUsers(users) {
  var clean = [];
  for (var i = 0; i < users.length; i += 1) {
    var user = lutongCleanUser(users[i]);
    if (user) {
      clean.push(user);
    }
  }
  return lutongWrite(LUTONG_STORAGE_KEYS.users, clean, false);
}

function lutongGetSession() {
  // The demo session lives in localStorage (not sessionStorage) so that a
  // student can sign in on one page and still be signed in on another page
  // or in another tab. It holds no password and no secret.
  var stored = lutongRead(LUTONG_STORAGE_KEYS.session, null, false);
  if (!stored || typeof stored !== "object") {
    return null;
  }

  var username = String(stored.username || "").trim();
  var role = stored.role === "admin" ? "admin" : "user";
  if (!username) {
    return null;
  }

  return {
    username: username.slice(0, 40),
    displayName: String(stored.displayName || username).slice(0, 80),
    email: String(stored.email || "").slice(0, 120),
    role: role,
    loginAt: String(stored.loginAt || ""),
    isNew: stored.isNew === true
  };
}

function lutongSaveSession(session) {
  return lutongWrite(LUTONG_STORAGE_KEYS.session, session, false);
}

function lutongClearSession() {
  return lutongRemove(LUTONG_STORAGE_KEYS.session, false);
}

function lutongGetMyOrderIds() {
  var stored = lutongRead(LUTONG_STORAGE_KEYS.myOrders, [], false);
  if (!Array.isArray(stored)) {
    return [];
  }
  var ids = [];
  for (var i = 0; i < stored.length; i += 1) {
    var id = String(stored[i] || "").trim();
    if (id) {
      ids.push(id.slice(0, 40));
    }
  }
  return ids;
}

function lutongAddMyOrderId(id) {
  var ids = lutongGetMyOrderIds();
  if (id && ids.indexOf(id) === -1) {
    ids.push(id);
    lutongWrite(LUTONG_STORAGE_KEYS.myOrders, ids, false);
  }
}

function lutongGetMessages() {
  var stored = lutongRead(LUTONG_STORAGE_KEYS.messages, [], false);
  if (!Array.isArray(stored)) {
    return [];
  }
  var clean = [];
  for (var i = 0; i < stored.length; i += 1) {
    var message = lutongCleanMessage(stored[i]);
    if (message) {
      clean.push(message);
    }
  }
  return clean;
}

function lutongSaveMessages(messages) {
  var clean = [];
  for (var i = 0; i < messages.length; i += 1) {
    var message = lutongCleanMessage(messages[i]);
    if (message) {
      clean.push(message);
    }
  }
  return lutongWrite(LUTONG_STORAGE_KEYS.messages, clean, false);
}
