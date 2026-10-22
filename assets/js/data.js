/* ==========================================================================
   Lutong Lokal — assets/js/data.js
   Static seed data for the prototype.

   IMPORTANT — everything in this file is DEMO data.
   The meal names, descriptions, prices, order history and demo accounts are
   invented for classroom purposes only. They are not real products, not real
   prices and not real customers.
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
  { id: "all", name: "All Items" },
  { id: "main-dish", name: "Mga Ulam" },
  { id: "noodles", name: "Noodles & Palabok" },
  { id: "rice-sides", name: "Rice & Sides" },
  { id: "snacks", name: "Snacks" },
  { id: "sweets", name: "Sweets (Puso)" },
  { id: "drinks", name: "Drinks" }
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
function lutongSeedItem(id, name, description, price, category, image, available, featured) {
  return {
    id: id,
    name: name,
    description: description,
    price: price,
    category: category,
    image: image,
    available: available !== false,
    featured: featured === true,
    createdAt: "2026-01-01T08:00:00.000Z"
  };
}

/* The starter menu. Prices are sample demo prices in Philippine pesos.
   Photos are real photographs from Wikimedia Commons, served through the
   stable Special:FilePath endpoint at a fixed width so the page stays fast.
   Full credits are listed in the README. */
var LUTONG_MENU_SEED = [
  lutongSeedItem(
    "m01",
    "Chicken Adobo",
    "Bone-in chicken simmered low and slow in soy sauce, garlic, bay leaf and cane vinegar until the sauce turns glossy.",
    185,
    "main-dish",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Adobo%20Filipino%20style.jpg?width=480",
    true,
    true
  ),
  lutongSeedItem(
    "m02",
    "Sisig",
    "Chopped pork jowl and liver sizzling on a hot plate with onions, chilli and a squeeze of calamansi.",
    165,
    "main-dish",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Sisig%20(Philippines)%2001.jpg?width=480",
    true,
    true
  ),
  lutongSeedItem(
    "m03",
    "Sinigang na Baboy",
    "Pork belly in a sour tamarind broth with kangkong, radish, tomatoes and whole tamarind.",
    210,
    "main-dish",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Sinigang%20na%20Baboy.jpg?width=480",
    true,
    false
  ),
  lutongSeedItem(
    "m04",
    "Kare-Kare",
    "Oxtail and peanut stew with pechay, eggplant and a warm Artepata dipping sauce on the side.",
    245,
    "main-dish",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Kare-kare.jpg?width=480",
    false,
    false
  ),
  lutongSeedItem(
    "m05",
    "Bicol Express",
    "Pork and long beans in a fiery coconut milk and shrimp-paste sauce. Seriously hot.",
    225,
    "main-dish",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Bicol%20Express.jpg?width=480",
    true,
    false
  ),
  lutongSeedItem(
    "m06",
    "Menudo",
    "Classic pork liver stew with potatoes, carrots and dashes of liver spread for good luck.",
    195,
    "main-dish",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Menudo%20(Philippines)%2002.jpg?width=480",
    true,
    false
  ),
  lutongSeedItem(
    "m07",
    "Tinola na Manok",
    "Chicken in a clear ginger, garlic and lemongrass broth with green papaya, chayote and kalamunggay.",
    175,
    "main-dish",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Tinola%20na%20Manok.jpg?width=480",
    true,
    false
  ),
  lutongSeedItem(
    "m08",
    "Pancit Bihon",
    "Rice noodles stir-fried with soy sauce, garlic, cabbage, carrots and a hint of calamansi.",
    125,
    "noodles",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Pancit%20bihon%20(Philippines)%2003.jpg?width=480",
    true,
    true
  ),
  lutongSeedItem(
    "m09",
    "Palabok",
    "Rice noodles topped with a rich savoury sauce, chicharon, spring onion, egg and fried garlic.",
    135,
    "noodles",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Pancit%20Palabok%202.jpg?width=480",
    true,
    false
  ),
  lutongSeedItem(
    "m10",
    "Sinangag",
    "Garlic fried rice with crisp egg, spring onion and a scatter of toasted garlic.",
    85,
    "rice-sides",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Sinangag%20Recipe%20(Garlic%20Fried%20Rice).jpg?width=480",
    true,
    false
  ),
  lutongSeedItem(
    "m11",
    "Pork Silog",
    "Garlic fried rice with a fried egg and seasoned pork, served with a small dip and pickled onion.",
    120,
    "rice-sides",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Pork%20Silog,%20May%202025.jpg?width=480",
    true,
    false
  ),
  lutongSeedItem(
    "m12",
    "Pork BBQ Skewers",
    "Three skewers of sweet and savoury marinated pork with a dip of vinegar and chilli.",
    110,
    "rice-sides",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Filipino%20bbq%20(Isaw,%20dugo,%20pork%20skewer).jpg?width=480",
    true,
    false
  ),
  lutongSeedItem(
    "m13",
    "Fresh Lumpia",
    "Crisp spring rolls filled with pork, jicama and carrot, served with a sweet chilli dip.",
    90,
    "snacks",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Lumpia%203.jpg?width=480",
    false,
    false
  ),
  lutongSeedItem(
    "m14",
    "Grilled Hotdog",
    "Street-style grilled hotdog on a bun with mustard, ketchup and sweet relish.",
    55,
    "snacks",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Grilled%20Hotdog%20from%20Philippine%20streets.jpg?width=480",
    true,
    false
  ),
  lutongSeedItem(
    "m15",
    "Leche Flan",
    "Silky caramel custard flan baked in small llanera cups.",
    75,
    "sweets",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Leche%20flan%20(Philippines)%2001.jpg?width=480",
    true,
    true
  ),
  lutongSeedItem(
    "m16",
    "Halo-Halo",
    "Shaved ice layered with sweet beans, jackfruit, nata de coco, leche flan and a scoop of ube ice cream.",
    95,
    "sweets",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Halo-Halo.jpg?width=480",
    true,
    true
  ),
  lutongSeedItem(
    "m17",
    "Turon",
    "Sliced banana spring roll coated in caramelised sugar and coated with jackfruit strips.",
    60,
    "sweets",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Pinoy%20Turon.jpg?width=480",
    true,
    false
  ),
  lutongSeedItem(
    "m18",
    "Sago Gulaman",
    "Chilled sago pearls in sweet brown-sugar gulaman, served with a calamansi wedge.",
    45,
    "drinks",
    "https://commons.wikimedia.org/wiki/Special:FilePath/Sago%20Gulaman.jpg?width=480",
    true,
    false
  )
];
