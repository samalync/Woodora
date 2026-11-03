// Administrator area. EVERY route in this file is protected by requireAdmin,
// so a customer (or a visitor who is not logged in) can never reach it.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(requireAdmin);

// The notification bell (in the top bar of every admin page) shows how many notifications are unread.
router.use(async (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.locals.unreadNotifications = (await db.get('SELECT COUNT(*) AS n FROM admin_notifications WHERE is_read = 0')).n;
    next();
});

const ORDER_STATUSES = ['Pending', 'Paid', 'Delivered'];
const PAYMENT_STATUSES = ['Unpaid', 'Paid'];

// ---------- Dashboard ----------
router.get('/', async (req, res) => {
    const one = async (sql) => (await db.get(sql)).n;
    const stats = {
        products: await one('SELECT COUNT(*) AS n FROM products'),
        lowStock: await one('SELECT COUNT(*) AS n FROM products WHERE stock <= 5'),
        orders: await one('SELECT COUNT(*) AS n FROM orders'),
        pending: await one("SELECT COUNT(*) AS n FROM orders WHERE order_status = 'Pending'"),
        revenue: await one("SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE payment_status = 'Paid'"),
        messages: await one('SELECT COUNT(*) AS n FROM messages'),
    };
    const recentOrders = await db.all('SELECT * FROM orders ORDER BY id DESC LIMIT 5');
    res.render('admin/dashboard', { title: 'Admin Dashboard', stats, recentOrders });
});

// ---------- Products ----------
// Image choices = the files in public/images (to add an image, copy it into that folder).
function imageChoices() {
    return fs.readdirSync(path.join(__dirname, '..', 'public', 'images'))
        .filter((file) => /\.(jpe?g|png|webp|gif)$/i.test(file) && file !== 'woodora-background.jpeg');
}

// Check the product form. Returns { values, errors }.
async function readProductForm(body) {
    const values = {
        name: String(body.name || '').trim(),
        description: String(body.description || '').trim(),
        price: String(body.price || '').trim(),
        stock: String(body.stock || '').trim(),
        image: String(body.image || ''),
        category_id: String(body.category_id || ''),
        featured: body.featured ? 1 : 0,
    };
    const errors = {};
    if (values.name.length < 2 || values.name.length > 80) errors.name = 'Name must be 2-80 characters.';
    if (values.description.length > 500) errors.description = 'Description can be at most 500 characters.';
    if (!/^[0-9]+$/.test(values.price) || Number(values.price) < 1 || Number(values.price) > 10000000) errors.price = 'Price must be a whole number of RWF between 1 and 10,000,000.';
    if (!/^[0-9]+$/.test(values.stock) || Number(values.stock) > 100000) errors.stock = 'Stock must be a whole number from 0 to 100,000.';
    if (!imageChoices().includes(values.image)) errors.image = 'Please choose an image from the list.';
    if (!(await db.get('SELECT id FROM categories WHERE id = ?', Number(values.category_id)))) errors.category_id = 'Please choose a category.';
    return { values, errors };
}

async function productFormPage(res, status, title, product, errors, action) {
    const categories = await db.all('SELECT * FROM categories ORDER BY id');
    res.status(status).render('admin/product-form', { title, product, errors, action, categories, images: imageChoices() });
}

router.get('/products', async (req, res) => {
    const products = await db.all(
        `SELECT p.*, c.name AS category FROM products p
         JOIN categories c ON c.id = p.category_id ORDER BY p.id`
    );
    res.render('admin/products', { title: 'Manage Products', products });
});

router.get('/products/new', async (req, res) => {
    await productFormPage(res, 200, 'Add Product', { name: '', description: '', price: '', stock: '', image: '', category_id: '', featured: 0 }, {}, '/admin/products/new');
});

router.post('/products/new', async (req, res) => {
    const { values, errors } = await readProductForm(req.body);
    if (Object.keys(errors).length > 0) return productFormPage(res, 400, 'Add Product', values, errors, '/admin/products/new');
    await db.run(`INSERT INTO products (name, description, price, stock, image, category_id, featured)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values.name, values.description, Number(values.price), Number(values.stock), values.image, Number(values.category_id), values.featured);
    req.session.flash = { type: 'success', text: `Product "${values.name}" was added.` };
    res.redirect('/admin/products');
});

router.get('/products/:id/edit', async (req, res, next) => {
    const product = await db.get('SELECT * FROM products WHERE id = ?', Number(req.params.id));
    if (!product) return next();
    await productFormPage(res, 200, 'Edit Product', product, {}, `/admin/products/${product.id}/edit`);
});

router.post('/products/:id/edit', async (req, res, next) => {
    const id = Number(req.params.id);
    if (!(await db.get('SELECT id FROM products WHERE id = ?', id))) return next();
    const { values, errors } = await readProductForm(req.body);
    if (Object.keys(errors).length > 0) return productFormPage(res, 400, 'Edit Product', values, errors, `/admin/products/${id}/edit`);
    await db.run(`UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image = ?, category_id = ?, featured = ?
                WHERE id = ?`,
        values.name, values.description, Number(values.price), Number(values.stock), values.image, Number(values.category_id), values.featured, id);
    req.session.flash = { type: 'success', text: `Product "${values.name}" was updated.` };
    res.redirect('/admin/products');
});

// Old orders keep their copied product name and price, so deleting is safe.
router.post('/products/:id/delete', async (req, res) => {
    const id = Number(req.params.id);
    const product = await db.get('SELECT name FROM products WHERE id = ?', id);
    if (product) {
        // Detach the product from old order lines first, then delete it (both or neither).
        await db.transaction(async (tx) => {
            await tx.run('UPDATE order_items SET product_id = NULL WHERE product_id = ?', id);
            await tx.run('DELETE FROM products WHERE id = ?', id);
        });
        req.session.flash = { type: 'success', text: `Product "${product.name}" was deleted.` };
    }
    res.redirect('/admin/products');
});

// ---------- Orders ----------
router.get('/orders', async (req, res) => {
    const filter = ORDER_STATUSES.includes(req.query.status) ? req.query.status : '';
    const orders = filter
        ? await db.all('SELECT * FROM orders WHERE order_status = ? ORDER BY id DESC', filter)
        : await db.all('SELECT * FROM orders ORDER BY id DESC');
    res.render('admin/orders', { title: 'Manage Orders', orders, filter, statuses: ORDER_STATUSES });
});

router.get('/orders/:id', async (req, res, next) => {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', Number(req.params.id));
    if (!order) return next();
    const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', order.id);
    res.render('admin/order', { title: `Order #${order.id}`, order, items, orderStatuses: ORDER_STATUSES, paymentStatuses: PAYMENT_STATUSES });
});

router.post('/orders/:id/status', async (req, res, next) => {
    const order = await db.get('SELECT id FROM orders WHERE id = ?', Number(req.params.id));
    if (!order) return next();
    const orderStatus = String(req.body.order_status);
    const paymentStatus = String(req.body.payment_status);
    if (!ORDER_STATUSES.includes(orderStatus) || !PAYMENT_STATUSES.includes(paymentStatus)) {
        req.session.flash = { type: 'error', text: 'Invalid status selected.' };
        return res.redirect(`/admin/orders/${order.id}`);
    }
    await db.run('UPDATE orders SET order_status = ?, payment_status = ? WHERE id = ?', orderStatus, paymentStatus, order.id);
    req.session.flash = { type: 'success', text: `Order #${order.id} updated.` };
    res.redirect(`/admin/orders/${order.id}`);
});

// ---------- Customer messages ----------
router.get('/messages', async (req, res) => {
    const messages = await db.all('SELECT * FROM messages ORDER BY id DESC');
    res.render('admin/messages', { title: 'Customer Messages', messages });
});

// ---------- Website visitors and notifications ----------
// Times are stored in UTC and shown in Rwanda time (Africa/Kigali, UTC+2, no daylight saving).
const KIGALI_OFFSET_HOURS = 2;
const kigaliFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kigali', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const utcDate = (text) => new Date(text.replace(' ', 'T') + 'Z');
const toIso = (text) => utcDate(text).toISOString();

// UTC text ("2026-11-03 10:15:00") of the moment today started in Rwanda.
function startOfTodayUtc() {
    const shifted = new Date(Date.now() + KIGALI_OFFSET_HOURS * 3600 * 1000);
    shifted.setUTCHours(0, 0, 0, 0);
    return new Date(shifted.getTime() - KIGALI_OFFSET_HOURS * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

const PAGE_NAMES = { '/': 'Home', '/products': 'All products', '/mission': 'Our Mission', '/impact': 'Our Impact', '/contact': 'Contact us', '/privacy': 'Privacy & Cookies' };

// The bell: the latest notifications and how many are unread.
async function notificationPayload() {
    const unread = (await db.get('SELECT COUNT(*) AS n FROM admin_notifications WHERE is_read = 0')).n;
    const rows = await db.all(
        `SELECT n.id, n.message, n.is_read, n.created_at, v.path
         FROM admin_notifications n LEFT JOIN visits v ON v.id = n.visit_id
         ORDER BY n.id DESC LIMIT 15`);
    return {
        unread,
        notifications: rows.map((n) => ({ id: n.id, message: n.message, isRead: n.is_read === 1, createdAt: toIso(n.created_at), page: n.path || null })),
    };
}

// Answers are never cached: the bell must always show the current numbers.
router.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get('/api/notifications', async (req, res) => res.json(await notificationPayload()));

router.post('/api/notifications/read-all', async (req, res) => {
    await db.run("UPDATE admin_notifications SET is_read = 1, read_at = datetime('now') WHERE is_read = 0");
    res.json(await notificationPayload());
});

router.post('/api/notifications/:id/read', async (req, res) => {
    if (!/^[0-9]{1,9}$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid notification.' });
    await db.run("UPDATE admin_notifications SET is_read = 1, read_at = datetime('now') WHERE id = ? AND is_read = 0", Number(req.params.id));
    res.json(await notificationPayload());
});

router.get('/visitors', async (req, res) => {
    const todayStart = startOfTodayUtc();
    const count = async (sql, ...args) => (await db.get(sql, ...args)).n;

    const stats = {
        totalVisits: await count('SELECT COUNT(*) AS n FROM visits'),
        uniqueVisitors: await count('SELECT COUNT(DISTINCT visitor_id) AS n FROM visits'),
        todayVisits: await count('SELECT COUNT(*) AS n FROM visits WHERE created_at >= ?', todayStart),
        sessions: await count('SELECT COUNT(*) AS n FROM visits WHERE is_new_session = 1'),
        newSessions: await count('SELECT COUNT(*) AS n FROM visits WHERE is_new_session = 1 AND is_new_visitor = 1'),
    };
    stats.returningSessions = stats.sessions - stats.newSessions;

    const products = new Map((await db.all('SELECT id, name FROM products')).map((p) => [String(p.id), p.name]));
    const pageName = (path) => PAGE_NAMES[path] || (/^\/products\/(\d+)$/.test(path) ? `Product: ${products.get(path.split('/')[2]) || 'removed product'}` : path);

    const topPages = (await db.all(
        `SELECT path, COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors
         FROM visits GROUP BY path ORDER BY visits DESC, path LIMIT 10`)).map((p) => ({ ...p, name: pageName(p.path) }));

    const recent = (await db.all(
        'SELECT id, visitor_id, path, is_new_session, is_new_visitor, created_at FROM visits ORDER BY id DESC LIMIT 20'))
        .map((v) => ({ ...v, name: pageName(v.path), when: kigaliFormat.format(utcDate(v.created_at)), who: v.visitor_id.slice(0, 8) }));

    res.render('admin/visitors', { title: 'Website Visitors', stats, topPages, recent });
});

module.exports = router;
