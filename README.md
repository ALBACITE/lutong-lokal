# THE UNKNOWN COFFEE

A simple, clean, and mobile-friendly website for **THE UNKNOWN COFFEE**, a small mobile coffee stall in Davao City, Philippines.

**Tagline:** Find Your Coffee, Made Easy.

## Pages

- **Home** (`index.html`) — Business introduction, featured drinks, and location updates
- **Menu** (`menu.html`) — Coffee and non-coffee flavors with medium/large prices
- **Cart & Checkout** (`cart.html`) — Cart management and browser-local pickup orders
- **About** (`about.html`) — Business information
- **Contact** (`contact.html`) — Contact form and mobile-stall location information
- **Login** (`login.html`) — Customer and administrator sign-in
- **Register** (`register.html`) — Customer account creation
- **Dashboard** (`dashboard.html`) — Customer order history and account
- **Admin** (`admin.html`) — Menu management and order status updates

## Features

- Browse menu with coffee and non-coffee flavors
- Size selection (Medium/Large) with correct pricing
- Add to cart, quantity changes, item removal
- Cart totals and order summary
- Order notes, customer details, and pickup preferences saved with each browser-local order
- Customer registration and login
- Customer dashboard with order history
- Admin dashboard with menu management and order status updates
- Contact form (stored locally)
- Responsive design for mobile, tablet, and desktop

This static prototype stores demo accounts and pickup orders in the current
browser's local storage. It does not process payments, send email, or sync
orders and accounts across devices.

## Menu

### Coffee Flavors
| Drink | Medium | Large |
|-------|--------|-------|
| Caramel Macchiato | ₱39 | ₱49 |
| Spanish Latte | ₱39 | ₱49 |
| Strawberry Latte | ₱49 | ₱59 |
| Matcha Latte | ₱49 | ₱59 |
| Cappuccino | ₱49 | ₱59 |

### Non-Coffee Flavors
| Drink | Medium | Large |
|-------|--------|-------|
| Taro | ₱49 | ₱59 |
| Creamy Matcha | ₱49 | ₱59 |
| Creamy Strawberry | ₱49 | ₱59 |
| Matcha Strawberry | ₱49 | ₱59 |
| Dark Choco | ₱49 | ₱59 |

## How to Run Locally

1. Clone or download the repository
2. Open `index.html` in your browser, or serve with `python -m http.server`
3. No build step or dependencies required

## Browser Storage

This prototype uses `localStorage` for all data (menu, cart, orders, accounts, session). Data is stored per-browser and does not synchronize across devices. Orders do not automatically reach the vendor.

## Limitations

- No real backend or database
- No real payment processing
- No real-time order notifications
- No cross-device synchronization
- Authentication is client-side only (not secure for production)
- All data is stored in the browser only

## Credits

Drink-card photos are crops of the supplied THE UNKNOWN COFFEE printed-menu image.
The source photo is preserved unchanged.

## License

Classroom project for IT105 Web Development.
