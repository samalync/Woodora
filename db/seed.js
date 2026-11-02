// Creates the tables and fills them with starting data.
// Run with:  npm run setup
// Safe to run again: it never deletes existing products, orders or users.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./database');

// 1. Create tables
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// 2. Categories
const categories = ['Utensils', 'Bowls & Plates', 'Trays & Boards', 'Sets'];
const addCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
categories.forEach((name) => addCategory.run(name));

// 3. Products (only added when the products table is empty)
const products = [
    // name, description, price (RWF), stock, image, category, featured
    ['Wooden Utensil Holder', 'A sturdy wooden holder that keeps your spoons and spatulas within easy reach.', 8000, 25, 'utensil-holder.jpeg', 'Utensils', 1],
    ['Wooden Bowl', 'A smooth, hand-finished bowl for serving salads, fruit or warm meals.', 12000, 20, 'bowl.jpeg', 'Bowls & Plates', 1],
    ['Wooden Plate', 'A simple round plate, gentle on your table and kind to the environment.', 10000, 30, 'plate.jpeg', 'Bowls & Plates', 0],
    ['Wooden Serving Tray', 'An elegant tray for serving tea, snacks or breakfast in bed.', 15000, 15, 'serving-tray.jpeg', 'Trays & Boards', 1],
    ['Wooden Cutting Board', 'A thick, durable board for chopping vegetables, bread and more.', 18000, 18, 'cutting-board.jpeg', 'Trays & Boards', 0],
    ['Wooden Kitchen Tools', 'Everyday wooden tools for stirring, flipping and serving.', 14000, 22, 'kitchen-tools.jpeg', 'Utensils', 0],
    ['Wooden Mortar and Pestle', 'A traditional mortar and pestle for crushing spices and herbs.', 16000, 12, 'mortar-pestle.jpeg', 'Utensils', 0],
    ['Wooden Kitchen Set', 'A complete set of wooden essentials for a natural kitchen.', 20000, 10, 'kitchen-set.jpeg', 'Sets', 0],
    ['Wooden Spoons', 'A pack of smooth spoons that will not scratch your pots and pans.', 9000, 40, 'spoons.jpeg', 'Utensils', 0],
    ['Wooden Cups', 'Warm and natural cups for tea, juice or traditional drinks.', 12000, 24, 'cups.jpeg', 'Bowls & Plates', 0],
    ['Wooden Bowl Set', 'A matching set of wooden bowls in different sizes.', 22000, 8, 'bowl-set.jpeg', 'Sets', 0],
    ['Wooden Storage Set', 'Wooden containers to store grains, spices and kitchen supplies.', 25000, 6, 'storage-set.jpeg', 'Sets', 0],
    ['Wooden Knife Holder', 'A safe and stylish block that keeps your knives organised.', 18000, 14, 'knife-holder.jpeg', 'Utensils', 0],
];

const productCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
if (productCount === 0) {
    const findCategory = db.prepare('SELECT id FROM categories WHERE name = ?');
    const addProduct = db.prepare(
        `INSERT INTO products (name, description, price, stock, image, category_id, featured)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    products.forEach(([name, description, price, stock, image, category, featured]) => {
        addProduct.run(name, description, price, stock, image, findCategory.get(category).id, featured);
    });
    console.log(`Added ${products.length} products.`);
}

// 4. Administrator account. Credentials come from the .env file (see .env.example).
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@woodora.example').toLowerCase();
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (!existingAdmin) {
    let adminPassword = process.env.ADMIN_PASSWORD;
    let generated = false;
    if (!adminPassword) {
        // No password configured: create a random one and show it once.
        adminPassword = crypto.randomBytes(9).toString('base64url');
        generated = true;
    }
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
        .run('Woodora Admin', adminEmail, hash);
    console.log(`Administrator created: ${adminEmail}`);
    if (generated) console.log(`Generated password (save it now, it is not stored): ${adminPassword}`);
} else {
    console.log(`Administrator ${adminEmail} already exists - left unchanged.`);
}

console.log('Database ready: db/woodora.db');
