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

More detail: `PROJECT_GUIDE.md`, `TESTING_CHECKLIST.md` and the Arabic guides (`WOODORA_ARABIC_*.md`).
