// Shopping cart. Stored in the session so it survives page navigation.
// The browser only ever sends a product id and a quantity - never a price.
const express = require('express');
const db = require('../db/database');
const { getCartDetails, MAX_PER_ITEM } = require('../helpers/cart');
const router = express.Router();

// Go back to the page the user came from (only if it is on our own site).
function backTo(req, fallback) {
    const target = String(req.body.back || '');
    return target.startsWith('/') && !target.startsWith('//') ? target : fallback;
}

router.get('/', (req, res) => {
    const cart = getCartDetails(req.session);
    if (cart.notices.length > 0) res.locals.flash = { type: 'error', text: cart.notices.join(' ') };
    res.render('cart', { title: 'Shopping Cart', cart, maxPerItem: MAX_PER_ITEM });
});

router.post('/add', (req, res) => {
    const productId = Number(req.body.productId);
    const quantity = Math.floor(Number(req.body.quantity) || 1);
    const product = db.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(productId);
    const back = backTo(req, '/products');

    if (!product || quantity < 1) {
        req.session.flash = { type: 'error', text: 'That product could not be added.' };
        return res.redirect(back);
    }
    req.session.cart = req.session.cart || {};
    const wanted = (req.session.cart[productId] || 0) + quantity;
    const limit = Math.min(product.stock, MAX_PER_ITEM);

    if (product.stock === 0) {
        req.session.flash = { type: 'error', text: `Sorry, "${product.name}" is out of stock.` };
    } else if (wanted > limit) {
        req.session.cart[productId] = limit;
        req.session.flash = { type: 'error', text: `You can only buy up to ${limit} of "${product.name}" (available stock). We set your cart to ${limit}.` };
    } else {
        req.session.cart[productId] = wanted;
        req.session.flash = { type: 'success', text: `"${product.name}" was added to your cart.` };
    }
    res.redirect(back);
});

// Set the quantity to an exact number (used by the + / - buttons).
router.post('/update', (req, res) => {
    const productId = Number(req.body.productId);
    const quantity = Math.floor(Number(req.body.quantity));
    const product = db.prepare('SELECT name, stock FROM products WHERE id = ?').get(productId);
    req.session.cart = req.session.cart || {};

    if (!product || !(productId in req.session.cart) || !Number.isFinite(quantity)) {
        req.session.flash = { type: 'error', text: 'That cart item could not be updated.' };
    } else if (quantity < 1) {
        delete req.session.cart[productId];
    } else if (quantity > Math.min(product.stock, MAX_PER_ITEM)) {
        req.session.flash = { type: 'error', text: `Only ${Math.min(product.stock, MAX_PER_ITEM)} of "${product.name}" can be ordered.` };
    } else {
        req.session.cart[productId] = quantity;
    }
    res.redirect('/cart');
});

router.post('/remove', (req, res) => {
    if (req.session.cart) delete req.session.cart[Number(req.body.productId)];
    req.session.flash = { type: 'success', text: 'Item removed from your cart.' };
    res.redirect('/cart');
});

module.exports = router;
