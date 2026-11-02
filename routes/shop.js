// Product catalogue: list with search + category filter, and product details.
const express = require('express');
const db = require('../db/database');
const router = express.Router();

router.get('/', async (req, res) => {
    const search = String(req.query.q || '').trim().slice(0, 60);
    const categoryId = Number(req.query.category) || 0;

    // Build the query step by step. User input only goes into "?" placeholders.
    let sql = `SELECT p.*, c.name AS category FROM products p
               JOIN categories c ON c.id = p.category_id WHERE 1 = 1`;
    const params = [];
    if (search) {
        sql += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    if (categoryId) {
        sql += ' AND p.category_id = ?';
        params.push(categoryId);
    }
    sql += ' ORDER BY p.id';

    const products = await db.all(sql, ...params);
    const categories = await db.all('SELECT * FROM categories ORDER BY id');
    res.render('products', { title: 'Products', products, categories, search, categoryId });
});

router.get('/:id', async (req, res, next) => {
    const product = await db.get(
        `SELECT p.*, c.name AS category FROM products p
         JOIN categories c ON c.id = p.category_id WHERE p.id = ?`,
        Number(req.params.id)
    );
    if (!product) return next(); // goes to the 404 page
    res.render('product', { title: product.name, product });
});

module.exports = router;
