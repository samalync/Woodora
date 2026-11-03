# Woodora - Project Guide

## 1. Project overview

Woodora is an online shop for natural wooden kitchenware, built for our Human-Computer Interaction (HCI) assignment.
Customers can browse products, fill a cart, check out and follow their orders. An administrator manages products and orders.

**Design idea: basic in complexity, professional in quality.** There is no framework magic: every page is a plain
HTML template and every action is a small, commented route.

## 2. Technologies used

| Technology | What we use it for |
|---|---|
| Node.js + Express | The web server. It receives requests and sends back pages. |
| EJS | Templates: HTML with small gaps filled in by data from the server. |
| SQLite (`@libsql/client`) | The database. On your computer it is one file (`db/woodora.db`); on Vercel it is a hosted SQLite database (Turso). |
| `cookie-session` | Remembers who is logged in and what is in the cart, in a signed cookie (works on Vercel). |
| `bcryptjs` | Hashes passwords so the real password is never stored. |
| `dotenv` | Reads private settings (admin password, session secret) from the `.env` file. |
| HTML, CSS, a little JavaScript | The interface. JavaScript only opens the mobile menu and asks "Are you sure?" before deleting. |

## 3. Folder structure

```
WOOdora/
├── app.js               Builds the website: sessions, security checks, shared values
├── server.js            Starts the website on your computer (npm start)
├── api/index.js         Starts the same website on Vercel
├── vercel.json          Tells Vercel how to run the website
├── package.json         List of libraries and the commands "npm run setup" / "npm start"
├── .env.example         Template for the private settings file (.env)
├── db/
│   ├── schema.sql       The table definitions
│   ├── database.js      Opens the database file
│   ├── seed.js          Creates tables, 4 categories, 13 products and the admin account
│   ├── woodora.db       THE DATABASE FILE
│   └── woodora-export.sql  Text export of the database (see section 6)
├── middleware/
│   ├── auth.js          requireLogin / requireAdmin guards and safe redirects
│   ├── csrf.js          Protects forms against forged requests
│   └── visitors.js      Anonymous visit tracking (cookies, consent check, saving visits and notifications)
├── tests/               Automated tests (npm test)
├── helpers/cart.js      Reads the cart and checks it against real prices and stock
├── helpers/payment-methods.js  Which payment methods are switched on (for checkout) and all their names (for old orders)
├── routes/              One file per area of the site
│   ├── pages.js         Home, Impact, Our Mission, Contact form
│   ├── shop.js          Product list (search, filter) and product details
│   ├── cart.js          Add / change quantity / remove
│   ├── auth.js          Register, customer login, admin login, logout
│   ├── checkout.js      Checkout, simulated payments, order history
│   ├── privacy.js       Privacy page and the Accept / Decline cookie choice
│   └── admin.js         Everything for the administrator
├── views/               The HTML templates (header and footer are written once in views/partials)
│   ├── login-choice.ejs     Login selection page (Customer or Admin)
│   ├── login-customer.ejs   Customer login page
│   ├── login-admin.ejs      Administrator login page
│   ├── admin/               Administrator pages (sidebar layout)
│   └── partials/            Shared pieces: header, footer, admin-top/bottom, icons, product card...
├── public/              Files the browser downloads directly
│   ├── css/style.css    The one stylesheet for the whole site
│   ├── js/main.js       Mobile menu, dismissable messages, delete confirmation, image preview
│   ├── js/admin-notifications.js  The admin notification bell (checks for news every 10 seconds)
│   └── images/          Product and background pictures
└── _original/           Backup of the project before we added the server
```

## 4. Database tables

| Table | Purpose |
|---|---|
| `users` | Accounts. Stores name, email, **password hash** and role (`customer` or `admin`). |
| `categories` | Utensils, Bowls & Plates, Trays & Boards, Sets. |
| `products` | Name, description, **price (RWF)**, **stock**, image, category, "featured" flag. |
| `orders` | One row per order: customer and delivery details, total, payment method, **`payment_status`** (Unpaid/Paid) and **`order_status`** (Pending/Paid/Delivered), kept separate. |
| `order_items` | The products in each order. Copies the **product name and price at purchase time**, so old orders never change when a product is edited or deleted. |
| `messages` | Messages sent through the contact form. |
| `visits` | One row per recorded page view of the public site: random `visitor_id`, random `session_id`, `path`, whether it started a new session / a new visitor, UTC time. **No personal data.** |
| `payment_methods` | Three fixed rows (`momo`, `card`, `cod`): display name and an `enabled` flag (1/0) that the administrator switches in Admin > Payment methods. Created and filled automatically on the first request. |
| `admin_notifications` | The messages in the admin bell ("A new visitor opened Woodora."), with an `is_read` flag and the time. |

The cart is not a table: it lives in the user's session as "product id -> quantity". Prices are never stored in it.

## 5. The 10 modules and where they live

1. **Home Page** - `views/home.ejs`, `views/partials/header.ejs`, `footer.ejs` (logo, menu, 3 featured products from the database, contact footer).
2. **Product Catalogue** - `routes/shop.js`, `views/products.ejs`, `views/product.ejs` (RWF prices, stock, categories, search and category filter).
3. **Shopping Cart** - `routes/cart.js`, `helpers/cart.js`, `views/cart.ejs` (+ / - buttons, remove, totals, cannot exceed stock).
4. **User Accounts** - `routes/auth.js` (register, two login pages, logout, bcrypt hashing, customer and admin roles). See "Login flow" below.
5. **Checkout and Orders** - `routes/checkout.js` (contact + address form, order saved in a transaction, order history).
6. **Payment (simulated)** - `routes/checkout.js`, `views/pay.ejs`.
7. **Administrator Dashboard** - `routes/admin.js`, `views/admin/*`.
8. **Customer Interaction** - Contact form: `routes/pages.js`, `views/contact.ejs`. Messages are saved and the admin reads them under Admin > Messages.
9. **Design and Usability** - `public/css/style.css` (one consistent look, mobile menu, tables that turn into cards on phones, clear success/error messages).
10. **Basic Security** - see the list below.

### Security checklist (Module 10)

- Passwords are hashed with bcrypt (`routes/auth.js`).
- All database queries use `?` placeholders (prepared statements), so SQL injection does not work.
- Every form is validated **on the server** (`routes/*.js`), not only in the browser.
- `/admin/*` is protected by `requireAdmin` (`routes/admin.js`). Not logged in -> sent to login. Customer -> "Access denied" (403).
- Prices, totals and stock are always read from the database. The browser sends only product ids and quantities.
- Stock is checked again, and reduced, inside a database transaction when the order is placed.
- CSRF token on every form (`middleware/csrf.js`); the logout button is a form too.
- Output is escaped by EJS (`<%= %>`), which stops script injection.
- Customers and administrators have **separate login pages but one login system**: the same `users` table, the same bcrypt check, and a role check on the server after the password is verified.
- Registration always creates a `customer`. A `role` sent in the form is ignored, so nobody can make themselves an administrator.
- Session id is renewed at login; cookies are `httpOnly`; "next" redirects only allow pages on our own site.
- Card numbers and CVV are never stored or shown again.

## 6. How to install and run

You need **Node.js 18 or newer** (https://nodejs.org).

```bash
npm install                 # 1. download the libraries
cp .env.example .env        # 2. create your private settings file
# 3. open .env and set ADMIN_PASSWORD and SESSION_SECRET (do NOT use the # character in the password)
npm run setup               # 4. create tables, products and the admin account (safe to run again)
npm start                   # 5. start the website
```

Open **http://localhost:3000**.

### The database

- The database is the file `db/woodora.db`. Open it with the free app **DB Browser for SQLite** to look at the tables.
- **Start again from zero:** stop the server, delete `db/woodora.db`, then run `npm run setup`.
- **Export to a text file:** `sqlite3 db/woodora.db .dump > db/woodora-export.sql`
- **Import from that file:** `sqlite3 db/new.db < db/woodora-export.sql`
- **Back up:** copy `db/woodora.db` somewhere safe while the server is stopped.

### Login flow

| Page | Address | Who may use it | After a successful login |
|---|---|---|---|
| Login selection | `/login` | everyone | - (choose Customer or Admin) |
| Customer login | `/login/customer` | accounts with role `customer` | the page you were trying to open, or the Products page |
| Admin login | `/admin/login` | accounts with role `admin` | the Admin Dashboard |

- A customer who tries the Admin login (right password) is refused with "Access denied: this account is not an administrator".
- An administrator who tries the Customer login is pointed to the Admin login.
- Opening any `/admin/...` address without logging in sends you to the Admin login. A logged-in customer gets "Access denied" (403). This is checked on the server for every admin request in `routes/admin.js`.
- Wrong email or wrong password always shows the same message, so the page never reveals which emails exist.

## 7. Test accounts

- **Administrator:** log in at **`/admin/login`** (or choose "Admin Login" on `/login`) with the email and password you put in `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). `npm run setup` creates it. If you leave `ADMIN_PASSWORD` empty, setup creates a random one and prints it once.
  If you change `.env` later, delete `db/woodora.db` and run `npm run setup` again (setup does not overwrite an existing admin).
- **Customer:** click **Sign up** and register any email (e.g. `student@example.com`, password `Woodora123`). Passwords need 8+ characters with a letter and a number.
- **Demo card for the payment simulation:** `4242 4242 4242 4242`, expiry any future date (e.g. `12/29`), CVV `123`.
- **Demo Mobile Money number:** `0788 123 456` (any valid Rwandan format).

## 8. Customer workflow

Home -> Products (search / filter) -> Product details -> **Add to Cart** -> Cart (change quantities) -> **Checkout** (log in or register if asked; fill contact + address; choose payment method) ->
payment page (Mobile Money or Card) -> Order confirmation -> **My Orders** (status shown any time).

The order is created in the database at checkout as **Pending + Unpaid**, and the stock is reduced. A successful simulated payment changes it to **Paid + Paid**.

## 9. Administrator workflow

Log in on the **Admin login** page (you land on the dashboard; the admin area has its own sidebar: Dashboard, Products, Orders, Website Visitors, Messages, Payment methods) -> **Dashboard** (counts, paid revenue, recent orders) ->
**Products** (add, edit, delete; change price, stock, category, featured flag) ->
**Orders** (filter by status) -> open an order -> change **Order status** and **Payment status** -> Save. Customers see the change in My Orders.
**Messages** shows what customers sent through the contact form.

## 10. Simulated payments

**No real money is ever moved.** The pages say so clearly (banner on the checkout and payment pages, and in the footer).

- **Mobile Money (simulated):** the customer enters a phone number; we pretend to send a request. On the next step the customer presses "I approved the payment" or "Decline". We never ask for a PIN. Approve -> order becomes Paid.
- **Card (simulated):** the form checks the format only (16 digits, valid future expiry, 3-digit code). It is not sent to any bank and **nothing is stored**. Success -> order becomes Paid.
- **Cash on Delivery:** no payment page. The order stays Pending + Unpaid. When delivered, the administrator sets Delivered + Paid.

Why two separate statuses? An order can be *Pending* and *Unpaid* (new), *Paid* but not yet delivered, or *Delivered* but still unpaid (cash on delivery). One field cannot describe all of these.

## 11. Code files to understand before the demonstration

1. `db/schema.sql` - the whole data model in one page.
2. `app.js` - how the app is built: sessions and the security checks that run on every request (`server.js` only starts it).
3. `helpers/cart.js` - why the browser can never fake a price.
4. `routes/checkout.js` - the heart of the shop: validation, the transaction, payment simulation.
5. `routes/admin.js` - product and order management, protected by `requireAdmin`.
6. `middleware/auth.js` and `routes/auth.js` - the two login pages, roles and password hashing.
7. `views/partials/header.ejs` and `admin-top.ejs` - how one header (and one admin layout) is shared by every page.
8. `public/css/style.css` - the whole design; the colours and fonts are defined at the top in `:root`.

## Changing the placeholder contact details

The email, phone, address and opening hours in the footer and contact page come from one place: the `res.locals.business` block in `app.js`. The phone and address there are the real ones; the email is empty on purpose (an empty email hides the email line) and the opening hours have not been confirmed.

To use a new product picture, copy it into `public/images/`, then pick it from the Image list when adding or editing a product.

Known limits (fine for a demonstration): logins and carts live in a signed cookie, so signing out only removes the cookie from that browser (a copied cookie would stay valid until it expires after 8 hours). On Vercel without the Turso settings the site runs in demo mode and its data is lost when the function restarts.

## Deploying to Vercel

See the "Deploy to Vercel" section of `README.md`. In short: create a Turso database, add `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the Vercel project settings, and redeploy. The tables, products and admin account are created on the first visit.


## 12. Website visitor tracking and admin notifications

**What the administrator gets:** a notification bell in the top bar of every admin page, and a **Website Visitors** page
(`/admin/visitors`) with total visits, unique visitors, today's visits, sessions, recent activity, most visited pages and new vs returning visitors.

### How a visit is counted
1. A first-time visitor sees a **cookie notice** (`views/partials/consent-banner.ejs`). Nothing is counted and no tracking cookie is set until they press **Accept**. Their choice is remembered in the `woodora_consent` cookie, and they can change it any time on `/privacy`. Declining deletes the tracking cookies.
2. After consent, `middleware/visitors.js` runs on every request. It counts only real page views: `GET` requests for the public pages (home, products, product details, mission, impact, contact, privacy) that ask for HTML. It ignores robots, prefetches, images, the query string (`?q=...`), 404s, other customer pages, and **administrators** browsing the shop.
3. Two random cookies are used: `woodora_vid` (anonymous visitor, 1 year) and `woodora_sid` (visit session, renewed on every page view, ends after **30 minutes** of inactivity). Navigating between pages inside one session adds visits but **not** a new session.
4. The same page opened again by the same session within **10 seconds** (a reload) is saved only once.
5. The first page of a new session is saved together with an `admin_notifications` row in one database transaction ("A new visitor opened Woodora." for an unknown visitor id, "A returning visitor opened Woodora." for a known one). A unique index guarantees a session can start only once even if two requests arrive together.

**Definitions on the Website Visitors page:** *Total visits* = pages opened (rows in `visits`). *Unique visitors* = different `visitor_id`s. *Visit sessions* = sessions started. *New vs returning* is counted per session. *Today* starts at midnight Rwanda time (UTC+2); times are saved in UTC and displayed as Rwanda time (CAT).

### How the admin is notified (without refreshing)
`public/js/admin-notifications.js` asks `GET /admin/api/notifications` every 10 seconds (and pauses while the browser tab is hidden). The answer is `{ unread, notifications }`, which updates the red number on the bell and the dropdown list. Buttons call `POST /admin/api/notifications/:id/read` and `POST /admin/api/notifications/read-all` (they send the CSRF token like every other form).

**Why polling and not Server-Sent Events / Socket.IO?** The site is designed to run on Vercel, whose serverless functions cannot keep a connection open for long, and polling every 10 seconds is plenty for a shop of this size. It also needs no new library.

### Security and privacy
- Every `/admin/...` route, including `/admin/api/...`, is behind `requireAdmin` on the server. Customers get `403`, logged-out visitors get `401` (JSON) or a redirect to the admin login. Customers never receive visitor data.
- Stored per visit: random visitor id, random session id, page path, time. **Not stored:** name, email, IP address, user agent, referrer, query string, or the logged-in account. The id cannot be linked to a person.
- Cookies are `HttpOnly`, `SameSite=Lax` (and `Secure` on Vercel). All SQL uses `?` placeholders and only a fixed list of page paths can be stored.
- A tracking error never breaks the website: it is logged and the page is still shown.

### Known limitations
- Only visitors who accept the cookie notice are counted, so the numbers are lower than real traffic.
- Anyone can create "visits" by sending requests with the consent cookie and a browser-like `User-Agent` and fresh random cookies; there is no rate limiting. Fake visits would flood the bell. Add rate limiting if the site gets real traffic.
- Robot detection is a simple keyword list; some robots will be counted.
- Unique visitors are really unique *browsers*: someone using two browsers, or clearing cookies, counts again.
- Old rows are never deleted automatically. Delete old `visits` / read `admin_notifications` periodically if the tables grow large.
- The cookie notice text is a sensible default for a small shop, not legal advice. Check the data-protection rules that apply to you (for example Rwanda's Law No. 058/2021 and, for EU visitors, the GDPR/ePrivacy rules).

### Tests
`npm test` starts the real server with a throw-away database and checks the whole feature over HTTP (see `tests/visitor-tracking.test.js`).

## 13. Payment methods on/off (administrator)

Admin > **Payment methods** (`/admin/payment-methods`, protected by `requireAdmin`) shows Mobile Money, Card and Cash on Delivery, each with an On/Off switch and one Save button (a normal form with the CSRF token).

- **Rule:** at least one method must stay On. If every switch is Off, nothing is saved and a clear error is shown.
- **Checkout** (`routes/checkout.js`) lists only the methods that are On. The server checks again when the order is submitted, so a method that is Off is refused even if someone sends it by hand (the order is not created).
- **Existing orders are not affected.** An order keeps its own `payment_method`, so an unpaid order can still be paid with it after the method is switched off, and the order pages still show its name.
- The `payment_methods` table is created and seeded (all three On) by `db/seed.js` on the first request, like the other tables, so it also appears by itself on Turso. Re-running setup never changes the admin's choice.
- No new environment variables.
- Tests: `tests/payment-methods.test.js` (toggling, the at-least-one rule, checkout hiding a method, the server refusing it, existing orders, customer = Access denied).
