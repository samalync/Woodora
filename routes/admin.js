// Administrator area. EVERY route in this file is protected by requireAdmin,
// so a customer (or a visitor who is not logged in) can never reach it.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(requireAdmin);

const ORDER_STATUSES = ['Pending', 'Paid', 'Delivered'];
const PAYMENT_STATUSES = ['Unpaid', 'Paid'];

// ---------- Dashboard ----------
router.get('/', (req, res) => {
    const one = (sql) => db.prepare(sql).get().n;
    const stats = {
        products: one('SELECT COUNT(*) AS n FROM products'),
        lowStock: one('SELECT COUNT(*) AS n FROM products WHERE stock <= 5'),
        orders: one('SELECT COUNT(*) AS n FROM orders'),
        pending: one("SELECT COUNT(*) AS n FROM orders WHERE order_status = 'Pending'"),
        revenue: one("SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE payment_status = 'Paid'"),
        messages: one('SELECT COUNT(*) AS n FROM messages'),
    };
    const recentOrders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 5').all();
    res.render('admin/dashboard', { title: 'Admin Dashboard', stats, recentOrders });
});

// ---------- Products ----------
// Image choices = the files in public/images (to add an image, copy it into that folder).
function imageChoices() {
    return fs.readdirSync(path.join(__dirname, '..', 'public', 'images'))
        .filter((file) => /\.(jpe?g|png|webp|gif)$/i.test(file) && file !== 'woodora-background.jpeg');
}

// Check the product form. Returns { values, errors }.
function readProductForm(body) {
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
    if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(values.category_id))) errors.category_id = 'Please choose a category.';
    return { values, errors };
}

function productFormPage(res, status, title, product, errors, action) {
    const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
    res.status(status).render('admin/product-form', { title, product, errors, action, categories, images: imageChoices() });
}

router.get('/products', (req, res) => {
    const products = db.prepare(
        `SELECT p.*, c.name AS category FROM products p
         JOIN categories c ON c.id = p.category_id ORDER BY p.id`
    ).all();
    res.render('admin/products', { title: 'Manage Products', products });
});

router.get('/products/new', (req, res) => {
    productFormPage(res, 200, 'Add Product', { name: '', description: '', price: '', stock: '', image: '', category_id: '', featured: 0 }, {}, '/admin/products/new');
});

router.post('/products/new', (req, res) => {
    const { values, errors } = readProductForm(req.body);
    if (Object.keys(errors).length > 0) return productFormPage(res, 400, 'Add Product', values, errors, '/admin/products/new');
    db.prepare(`INSERT INTO products (name, description, price, stock, image, category_id, featured)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(values.name, values.description, Number(values.price), Number(values.stock), values.image, Number(values.category_id), values.featured);
    req.session.flash = { type: 'success', text: `Product "${values.name}" was added.` };
    res.redirect('/admin/products');
});

router.get('/products/:id/edit', (req, res, next) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
    if (!product) return next();
    productFormPage(res, 200, 'Edit Product', product, {}, `/admin/products/${product.id}/edit`);
});

router.post('/products/:id/edit', (req, res, next) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id)) return next();
    const { values, errors } = readProductForm(req.body);
    if (Object.keys(errors).length > 0) return productFormPage(res, 400, 'Edit Product', values, errors, `/admin/products/${id}/edit`);
    db.prepare(`UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image = ?, category_id = ?, featured = ?
                WHERE id = ?`)
        .run(values.name, values.description, Number(values.price), Number(values.stock), values.image, Number(values.category_id), values.featured, id);
    req.session.flash = { type: 'success', text: `Product "${values.name}" was updated.` };
    res.redirect('/admin/products');
});

// Old orders keep their copied product name and price, so deleting is safe.
router.post('/products/:id/delete', (req, res) => {
    const id = Number(req.params.id);
    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(id);
    if (product) {
        db.prepare('DELETE FROM products WHERE id = ?').run(id);
        req.session.flash = { type: 'success', text: `Product "${product.name}" was deleted.` };
    }
    res.redirect('/admin/products');
});

// ---------- Orders ----------
router.get('/orders', (req, res) => {
    const filter = ORDER_STATUSES.includes(req.query.status) ? req.query.status : '';
    const orders = filter
        ? db.prepare('SELECT * FROM orders WHERE order_status = ? ORDER BY id DESC').all(filter)
        : db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    res.render('admin/orders', { title: 'Manage Orders', orders, filter, statuses: ORDER_STATUSES });
});

router.get('/orders/:id', (req, res, next) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
    if (!order) return next();
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.render('admin/order', { title: `Order #${order.id}`, order, items, orderStatuses: ORDER_STATUSES, paymentStatuses: PAYMENT_STATUSES });
});

router.post('/orders/:id/status', (req, res, next) => {
    const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(Number(req.params.id));
    if (!order) return next();
    const orderStatus = String(req.body.order_status);
    const paymentStatus = String(req.body.payment_status);
    if (!ORDER_STATUSES.includes(orderStatus) || !PAYMENT_STATUSES.includes(paymentStatus)) {
        req.session.flash = { type: 'error', text: 'Invalid status selected.' };
        return res.redirect(`/admin/orders/${order.id}`);
    }
    db.prepare('UPDATE orders SET order_status = ?, payment_status = ? WHERE id = ?').run(orderStatus, paymentStatus, order.id);
    req.session.flash = { type: 'success', text: `Order #${order.id} updated.` };
    res.redirect(`/admin/orders/${order.id}`);
});

// ---------- Customer messages ----------
router.get('/messages', (req, res) => {
    const messages = db.prepare('SELECT * FROM messages ORDER BY id DESC').all();
    res.render('admin/messages', { title: 'Customer Messages', messages });
});

module.exports = router;
