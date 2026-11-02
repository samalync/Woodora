// Creates the tables and fills them with starting data.
//   - Run by hand with:  npm run setup
//   - Also runs by itself the first time the website starts (see db/database.js).
// Safe to run again: it never deletes or duplicates existing products, orders or users.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./database');

const categories = ['Utensils', 'Bowls & Plates', 'Trays & Boards', 'Sets'];

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

async function setupDatabase({ allowGeneratedPassword }) {
    // 1. Create tables (IF NOT EXISTS, so existing data is kept)
    await db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

    // 2. Categories
    for (const name of categories) await db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', name);

    // 3. Products - only when the table is empty, so products deleted by the admin never come back.
    //    The check and the inserts happen in one transaction, so two servers starting together cannot both add them.
    const added = await db.transaction(async (tx) => {
        const { n } = await tx.get('SELECT COUNT(*) AS n FROM products');
        if (n > 0) return 0;
        for (const [name, description, price, stock, image, category, featured] of products) {
            const { id } = await tx.get('SELECT id FROM categories WHERE name = ?', category);
            await tx.run(
                `INSERT INTO products (name, description, price, stock, image, category_id, featured)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                name, description, price, stock, image, id, featured
            );
        }
        return products.length;
    });
    if (added) console.log(`Added ${added} products.`);

    // 4. Administrator account. Credentials come from environment variables (.env file or the Vercel settings).
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@woodora.example').toLowerCase();
    const existingAdmin = await db.get('SELECT id FROM users WHERE email = ?', adminEmail);
    if (!existingAdmin) {
        let adminPassword = process.env.ADMIN_PASSWORD;
        let generated = false;
        if (!adminPassword && allowGeneratedPassword) {
            // Running "npm run setup" by hand without a password: create a random one and show it once.
            adminPassword = crypto.randomBytes(9).toString('base64url');
            generated = true;
        }
        if (adminPassword) {
            const hash = bcrypt.hashSync(adminPassword, 10);
            await db.run('INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                'Woodora Admin', adminEmail, hash, 'admin');
            console.log(`Administrator created: ${adminEmail}`);
            if (generated) console.log(`Generated password (save it now, it is not stored): ${adminPassword}`);
        } else {
            console.warn('WARNING: no administrator created. Set ADMIN_EMAIL and ADMIN_PASSWORD, then restart.');
        }
    }
}

module.exports = { setupDatabase };

// "npm run setup" runs this file directly.
if (require.main === module) {
    setupDatabase({ allowGeneratedPassword: true })
        .then(() => console.log(`Database ready: ${db.storage}`))
        .catch((err) => { console.error('Setup failed:', err.message); process.exit(1); });
}
