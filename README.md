# woodora

Woodora is a wooden kitchenware e-commerce website built for an HCI university assignment
(Node.js, Express, SQLite, EJS).

## Run it

```bash
npm install
cp .env.example .env     # then set ADMIN_PASSWORD and SESSION_SECRET (no # character in the password)
npm run setup            # creates the database, 13 products and the admin account
npm start                # http://localhost:3000
```

- Admin login: `/admin/login` (email and password come from your `.env`).
- Customers register at `/register`.
- Online payments are **simulations**; no real money is charged.

## Deploy to Vercel

1. Create a free database at [turso.tech](https://turso.tech) and copy its URL (`libsql://...`) and an auth token.
2. In the Vercel project, open **Settings → Environment Variables** and add:
   `SESSION_SECRET` (a long random text), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
3. Redeploy. The first visit creates the tables, the 13 products and the admin account automatically.

Without the two `TURSO_*` variables the site still opens, but in **demo mode**: the data lives in a temporary
file and is lost whenever Vercel restarts the function. Vercel's own page shows the real error in **Logs** if something is wrong.

## Website visitors (admin)

After a visitor accepts the cookie notice, Woodora counts anonymous visits (random ID, page, time - nothing personal).
Admins see a notification bell (updates every 10 seconds, no refresh) and a **Website Visitors** page at `/admin/visitors`.
Details, privacy notes and limitations: section 12 of `PROJECT_GUIDE.md`. Run the automated tests with `npm test`.

## Payment methods (admin)

Admin > **Payment methods** switches Mobile Money, Card and Cash on Delivery on or off (at least one must stay on). Checkout shows only the methods that are on and the server refuses the others; existing orders keep the method they were created with. Details: section 13 of `PROJECT_GUIDE.md`.

More detail: `PROJECT_GUIDE.md`, `TESTING_CHECKLIST.md` and the Arabic guides (`WOODORA_ARABIC_*.md`).
