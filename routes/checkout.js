// Checkout, simulated payments and the customer's order history.
//
// Flow:  cart -> /checkout (creates the order: Pending + Unpaid)
//        -> /orders/:id/pay (Mobile Money or Card simulation) -> order confirmation
//        Cash on Delivery skips the payment page and stays Unpaid until delivery.
//
// ALL PAYMENTS HERE ARE SIMULATED. No money moves and no card data is saved.
const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const { getCartDetails } = require('../helpers/cart');
const router = express.Router();

router.use(['/checkout', '/orders'], requireLogin); // customers must be logged in

const METHODS = {
    momo: 'Mobile Money (simulated)',
    card: 'Card payment (simulated)',
    cod: 'Cash on Delivery',
};
const PHONE_PATTERN = /^(\+?250|0)?7[2389]\d{7}$/; // Rwandan mobile numbers

// A normal "cannot buy this" situation (safe to show to the customer), not a program error.
class StockError extends Error {}

// Load an order only if it belongs to the logged-in customer.
function findMyOrder(req, orderId) {
    return db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', Number(orderId), req.session.user.id);
}

// ---------- Checkout ----------
router.get('/checkout', async (req, res) => {
    const cart = await getCartDetails(req.session);
    if (cart.items.length === 0) {
        req.session.flash = { type: 'error', text: 'Your cart is empty. Add some products first.' };
        return res.redirect('/products');
    }
    if (cart.notices.length > 0) {
        req.session.flash = { type: 'error', text: cart.notices.join(' ') };
        return res.redirect('/cart');
    }
    const user = req.session.user;
    res.render('checkout', { title: 'Checkout', cart, errors: {}, methods: METHODS,
        values: { name: user.name, email: user.email, phone: '', address: '', city: '', method: 'momo' } });
});

router.post('/checkout', async (req, res) => {
    const values = {
        name: String(req.body.name || '').trim(),
        email: String(req.body.email || '').trim(),
        phone: String(req.body.phone || '').replace(/\s+/g, ''),
        address: String(req.body.address || '').trim(),
        city: String(req.body.city || '').trim(),
        method: String(req.body.method || ''),
    };
    const errors = {};
    if (values.name.length < 2 || values.name.length > 60) errors.name = 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 100) errors.email = 'Please enter a valid email address.';
    if (!/^\+?[0-9]{9,15}$/.test(values.phone)) errors.phone = 'Please enter a valid phone number (digits only, 9-15 numbers).';
    if (values.address.length < 5 || values.address.length > 200) errors.address = 'Please enter your delivery address (5-200 characters).';
    if (values.city.length < 2 || values.city.length > 60) errors.city = 'Please enter your city or district.';
    if (!METHODS[values.method]) errors.method = 'Please choose a payment method.';

    const cart = await getCartDetails(req.session);
    if (cart.items.length === 0) {
        req.session.flash = { type: 'error', text: 'Your cart is empty.' };
        return res.redirect('/products');
    }
    if (Object.keys(errors).length > 0) {
        return res.status(400).render('checkout', { title: 'Checkout', cart, errors, values, methods: METHODS });
    }

    // Create the order inside ONE database transaction: either everything is saved, or nothing.
    let orderId;
    try {
        orderId = await db.transaction(async (tx) => {
            let total = 0;
            const lines = [];
            for (const item of cart.items) {
                // Read the price again from the database (never from the browser).
                const product = await tx.get('SELECT id, name, price FROM products WHERE id = ?', item.id);
                if (!product) throw new StockError(`"${item.name}" is no longer available.`);
                // Take the stock; this only succeeds if enough stock is still available.
                const taken = await tx.run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
                    item.quantity, item.id, item.quantity);
                if (taken.changes !== 1) throw new StockError(`Not enough stock for "${item.name}".`);
                total += product.price * item.quantity;
                lines.push({ product, quantity: item.quantity });
            }
            const order = await tx.run(
                `INSERT INTO orders (user_id, customer_name, email, phone, address, city, total, payment_method)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                req.session.user.id, values.name, values.email, values.phone, values.address, values.city, total, values.method
            );
            for (const l of lines) {
                await tx.run(
                    'INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)',
                    order.lastInsertRowid, l.product.id, l.product.name, l.product.price, l.quantity
                );
            }
            return order.lastInsertRowid;
        });
    } catch (err) {
        if (!(err instanceof StockError)) throw err; // real errors go to the error page
        req.session.flash = { type: 'error', text: err.message + ' Please review your cart.' };
        return res.redirect('/cart');
    }

    req.session.cart = {}; // empty the cart
    if (values.method === 'cod') {
        req.session.flash = { type: 'success', text: 'Order placed! Please pay in cash when your order is delivered.' };
        return res.redirect(`/orders/${orderId}`);
    }
    res.redirect(`/orders/${orderId}/pay`);
});

// ---------- Simulated payment ----------
// Marks the order as paid. The "AND payment_status = 'Unpaid'" stops it being paid twice.
function markPaid(orderId) {
    return db.run("UPDATE orders SET payment_status = 'Paid', order_status = 'Paid' WHERE id = ? AND payment_status = 'Unpaid'",
        orderId);
}

// Find an order that can still be paid online, or redirect with a message.
async function findPayableOrder(req, res) {
    const order = await findMyOrder(req, req.params.id);
    if (!order) { res.status(404).render('error', { title: 'Order not found', heading: 'Order not found', message: 'We could not find that order.' }); return null; }
    if (order.payment_status === 'Paid' || order.payment_method === 'cod') { res.redirect(`/orders/${order.id}`); return null; }
    return order;
}

router.get('/orders/:id/pay', async (req, res) => {
    const order = await findPayableOrder(req, res);
    if (!order) return;
    const pending = req.session.momoPending;
    // Mobile Money step 2 is shown only after a phone number was submitted for THIS order.
    const momoStep = order.payment_method === 'momo' && pending && pending.orderId === order.id ? pending : null;
    res.render('pay', { title: 'Payment', order, momoStep, errors: {}, values: {}, methodName: METHODS[order.payment_method] });
});

// Mobile Money step 1: customer enters a phone number. We never ask for a PIN.
router.post('/orders/:id/pay/momo', async (req, res) => {
    const order = await findPayableOrder(req, res);
    if (!order || order.payment_method !== 'momo') return;
    const phone = String(req.body.momoPhone || '').replace(/\s+/g, '');
    if (!PHONE_PATTERN.test(phone)) {
        return res.status(400).render('pay', { title: 'Payment', order, momoStep: null, methodName: METHODS.momo,
            errors: { momoPhone: 'Enter a valid Rwandan Mobile Money number, e.g. 0788 123 456.' }, values: { momoPhone: phone } });
    }
    req.session.momoPending = { orderId: order.id, maskedPhone: phone.slice(0, 3) + '****' + phone.slice(-3) };
    res.redirect(`/orders/${order.id}/pay`);
});

// Mobile Money step 2: simulates the customer approving (or declining) on their phone.
router.post('/orders/:id/pay/momo/confirm', async (req, res) => {
    const order = await findPayableOrder(req, res);
    if (!order || order.payment_method !== 'momo') return;
    const pending = req.session.momoPending;
    if (!pending || pending.orderId !== order.id) return res.redirect(`/orders/${order.id}/pay`);
    delete req.session.momoPending;

    if (req.body.decision === 'approve') {
        await markPaid(order.id);
        req.session.flash = { type: 'success', text: 'Simulated Mobile Money payment approved. Thank you!' };
        return res.redirect(`/orders/${order.id}`);
    }
    req.session.flash = { type: 'error', text: 'Payment was declined. Your order is saved - you can try again from My Orders.' };
    res.redirect(`/orders/${order.id}/pay`);
});

// Card payment: we only validate the format. Card details are NEVER stored or logged.
router.post('/orders/:id/pay/card', async (req, res) => {
    const order = await findPayableOrder(req, res);
    if (!order || order.payment_method !== 'card') return;
    const cardName = String(req.body.cardName || '').trim();
    const cardNumber = String(req.body.cardNumber || '').replace(/[\s-]/g, '');
    const expiry = String(req.body.expiry || '').trim();
    const cvv = String(req.body.cvv || '').trim();
    const errors = {};

    if (cardName.length < 2 || cardName.length > 60) errors.cardName = 'Enter the name on the card.';
    if (!/^[0-9]{16}$/.test(cardNumber)) errors.cardNumber = 'Enter a 16-digit card number (for the demo use 4242 4242 4242 4242).';
    const expiryMatch = /^(0[1-9]|1[0-2])\/([0-9]{2})$/.exec(expiry);
    if (!expiryMatch) {
        errors.expiry = 'Enter the expiry date as MM/YY.';
    } else {
        const now = new Date();
        const year = 2000 + Number(expiryMatch[2]);
        const month = Number(expiryMatch[1]);
        if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) errors.expiry = 'This card has expired.';
    }
    if (!/^[0-9]{3}$/.test(cvv)) errors.cvv = 'Enter the 3-digit security code.';

    if (Object.keys(errors).length > 0) {
        // Only the name and expiry are shown again; card number and CVV are never sent back.
        return res.status(400).render('pay', { title: 'Payment', order, momoStep: null, methodName: METHODS.card,
            errors, values: { cardName, expiry } });
    }
    await markPaid(order.id); // card details are discarded here
    req.session.flash = { type: 'success', text: 'Simulated card payment successful. Thank you!' };
    res.redirect(`/orders/${order.id}`);
});

// ---------- Order history ----------
router.get('/orders', async (req, res) => {
    const orders = await db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', req.session.user.id);
    res.render('orders', { title: 'My Orders', orders, methods: METHODS });
});

router.get('/orders/:id', async (req, res, next) => {
    const order = await findMyOrder(req, req.params.id);
    if (!order) return next();
    const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', order.id);
    res.render('order', { title: `Order #${order.id}`, order, items, methodName: METHODS[order.payment_method] });
});

module.exports = router;
