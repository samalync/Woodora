// The cart is kept in the session as { productId: quantity }.
// It stores NO prices. Every time we show or use the cart we read the real
// price and stock from the database, so the browser can never fake them.
const db = require('../db/database');

const MAX_PER_ITEM = 20;

async function getCartDetails(session) {
    const cart = session.cart || {};
    const items = [];
    const notices = []; // messages like "stock changed"

    for (const [idText, qty] of Object.entries(cart)) {
        const product = await db.get('SELECT id, name, price, stock, image FROM products WHERE id = ?', Number(idText));
        if (!product || product.stock === 0) {
            delete cart[idText];
            notices.push(`"${product ? product.name : 'An item'}" is no longer available and was removed.`);
            continue;
        }
        const quantity = Math.min(qty, product.stock, MAX_PER_ITEM);
        if (quantity < qty) {
            cart[idText] = quantity;
            notices.push(`Only ${product.stock} of "${product.name}" are in stock, so we adjusted your quantity.`);
        }
        items.push({ ...product, quantity, lineTotal: product.price * quantity });
    }
    session.cart = cart;
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    return { items, total, notices };
}

module.exports = { getCartDetails, MAX_PER_ITEM };
