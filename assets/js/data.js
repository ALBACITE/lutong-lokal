/* ==========================================================================
   THE UNKNOWN COFFEE — assets/js/data.js
   Static seed data for the prototype.

   IMPORTANT — account and order examples are demo data. The menu names and
   prices below are the supplied THE UNKNOWN COFFEE menu.
   ========================================================================== */

/* The demo accounts are PUBLIC. They are printed in the README and shown on
   the sign-in page on purpose, so anybody can try the prototype.
   They are never written to localStorage — they live in this file only, so
   there is no credential material sitting in browser storage. */
var LUTONG_DEMO_ACCOUNTS = [
  {
    username: "demo",
    displayName: "Demo Customer",
    email: "demo@lutonglokal.test",
    role: "user",
    passcode: "demo123",
    isSeeded: true
  },
  {
    username: "admin",
    displayName: "Demo Administrator",
    email: "admin@lutonglokal.test",
    role: "admin",
    passcode: "admin123",
    isSeeded: true
  }
];

/* Demo sign-in code used for accounts created through the Register page.
   It is a shared, publicly documented demo string — not a secret, and it is
   never stored anywhere. */
var LUTONG_REGISTERED_PASSCODE = "demo123";

var LUTONG_CATEGORIES = [
  { id: "all", name: "All Drinks" },
  { id: "coffee", name: "Coffee" },
  { id: "non-coffee", name: "Non-Coffee" }
];

/* Order status flow used by the admin dashboard. */
var LUTONG_ORDER_STATUSES = [
  { id: "Pending", label: "Pending" },
  { id: "Preparing", label: "Preparing" },
  { id: "Ready for Pickup", label: "Ready for Pickup" },
  { id: "Completed", label: "Completed" },
  { id: "Cancelled", label: "Cancelled" }
];

/* Helper so every seed item keeps the same shape. */
function lutongSeedItem(id, name, description, priceMedium, priceLarge, category, image, available, featured) {
  return {
    id: id,
    name: name,
    description: description,
    price: priceMedium,
    priceMedium: priceMedium,
    priceLarge: priceLarge,
    category: category,
    image: image,
    available: available !== false,
    featured: featured === true,
    createdAt: "2026-01-01T08:00:00.000Z"
  };
}

/* Starter menu for THE UNKNOWN COFFEE. */
var LUTONG_MENU_SEED = [
  lutongSeedItem("c01", "Caramel Macchiato", "Rich espresso paired with creamy milk and a caramel finish.", 39, 49, "coffee", "assets/img/menu-items/caramel-macchiato.jpg", true, true),
  lutongSeedItem("c02", "Spanish Latte", "Smooth espresso with sweet milk and a creamy texture.", 39, 49, "coffee", "assets/img/menu-items/spanish-latte.jpg", true, true),
  lutongSeedItem("c03", "Strawberry Latte", "Espresso blended with strawberry flavor and creamy milk.", 49, 59, "coffee", "assets/img/menu-items/strawberry-latte.jpg", true, false),
  lutongSeedItem("c04", "Matcha Latte", "Matcha with milk and a smooth finish.", 49, 59, "coffee", "assets/img/menu-items/matcha-latte.jpg", true, false),
  lutongSeedItem("c05", "Cappuccino", "Classic espresso with velvety milk foam and a balanced finish.", 49, 59, "coffee", "assets/img/menu-items/cappuccino.jpg", true, false),
  lutongSeedItem("n01", "Taro", "Creamy taro drink with a smooth, sweet flavor.", 49, 59, "non-coffee", "assets/img/menu-items/taro.jpg", true, false),
  lutongSeedItem("n02", "Creamy Matcha", "Matcha blended with creamy milk.", 49, 59, "non-coffee", "assets/img/menu-items/creamy-matcha.jpg", true, false),
  lutongSeedItem("n03", "Creamy Strawberry", "Sweet strawberry flavor with a rich, creamy finish.", 49, 59, "non-coffee", "assets/img/menu-items/creamy-strawberry.jpg", true, false),
  lutongSeedItem("n04", "Matcha Strawberry", "A smooth blend of matcha and strawberry notes.", 49, 59, "non-coffee", "assets/img/menu-items/matcha-strawberry.jpg", true, false),
  lutongSeedItem("n05", "Dark Choco", "Smooth dark chocolate drink with a rich cocoa finish.", 49, 59, "non-coffee", "assets/img/menu-items/dark-choco.jpg", true, false)
];
