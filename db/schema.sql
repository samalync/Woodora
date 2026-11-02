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
