-- Woodora database schema (SQLite)
-- Run automatically by:  npm run setup

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,                       -- bcrypt hash, never the real password
    role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price       INTEGER NOT NULL CHECK (price > 0),    -- whole Rwandan Francs
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image       TEXT NOT NULL,                         -- file name inside public/images
    category_id INTEGER NOT NULL REFERENCES categories(id),
    featured    INTEGER NOT NULL DEFAULT 0,            -- 1 = shown on the home page
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payment status and order status are stored separately on purpose.
CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    customer_name  TEXT NOT NULL,
    email          TEXT NOT NULL,
    phone          TEXT NOT NULL,
    address        TEXT NOT NULL,
    city           TEXT NOT NULL,
    total          INTEGER NOT NULL,                   -- calculated on the server
    payment_method TEXT NOT NULL CHECK (payment_method IN ('momo', 'card', 'cod')),
    payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Paid')),
    order_status   TEXT NOT NULL DEFAULT 'Pending' CHECK (order_status IN ('Pending', 'Paid', 'Delivered')),
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- product_name and unit_price are copied from the product at purchase time,
-- so old orders stay correct even if the product is edited or deleted later.
CREATE TABLE IF NOT EXISTS order_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    unit_price   INTEGER NOT NULL,
    quantity     INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    subject    TEXT NOT NULL,
    message    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Website visitor tracking (anonymous; only after the visitor accepts the cookie notice) ----------
-- One row per recorded page view. No name, email, IP address or browser details are stored:
-- visitor_id is a random text kept in a cookie, session_id is a random text that lasts 30 minutes of activity.
CREATE TABLE IF NOT EXISTS visits (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id     TEXT NOT NULL,                      -- anonymous, random, stays in the visitor's browser for 1 year
    session_id     TEXT NOT NULL,                      -- anonymous, random, one per visit session
    path           TEXT NOT NULL,                      -- page opened, e.g. /products/3 (never the query string)
    is_new_session INTEGER NOT NULL DEFAULT 0 CHECK (is_new_session IN (0, 1)),  -- 1 = first page of a session
    is_new_visitor INTEGER NOT NULL DEFAULT 0 CHECK (is_new_visitor IN (0, 1)),  -- 1 = first session ever of this visitor
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))                       -- UTC
);
CREATE INDEX IF NOT EXISTS idx_visits_created ON visits (created_at);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits (visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_session_path ON visits (session_id, path, created_at);
-- A session can start only once, even if two requests arrive at the same moment.
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_one_start ON visits (session_id) WHERE is_new_session = 1;

-- Messages shown to the administrator in the notification bell.
CREATE TABLE IF NOT EXISTS admin_notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL DEFAULT 'new_visitor',
    message    TEXT NOT NULL,
    visit_id   INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    is_read    INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),                              -- UTC
    read_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON admin_notifications (is_read, id);

-- ---------- Payment methods the administrator can switch on and off ----------
-- Exactly three rows (momo, card, cod), created by db/seed.js. enabled = 1 means customers can choose it at checkout.
-- Orders keep their own payment_method text, so switching a method off never changes existing orders.
CREATE TABLE IF NOT EXISTS payment_methods (
    code    TEXT PRIMARY KEY CHECK (code IN ('momo', 'card', 'cod')),
    name    TEXT NOT NULL,                                                  -- name shown to customers and in the admin area
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1))
);
