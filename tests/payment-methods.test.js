// Payment methods tests (admin on/off switches). Run with:  npm test
// Each run starts the real server with a brand new temporary database and talks to it over HTTP.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHarness, ADMIN } = require('./helpers');

const harness = createHarness();
const { Browser } = harness;
const ALL = ['momo', 'card', 'cod'];
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

let admin;
before(async () => {
    await harness.start();
    admin = new Browser();
    const login = await admin.post('/admin/login', ADMIN, '/admin/login');
    assert.equal(login.headers.get('location'), '/admin');
});
after(() => harness.stop());

// --- little helpers -----------------------------------------------------------------------------
const setMethods = (enabled) => admin.post('/admin/payment-methods', { enabled }, '/admin/payment-methods');
// Which switches are On on the admin page?
async function adminState() {
    const html = (await admin.request('/admin/payment-methods')).text_;
    return ALL.filter((code) => new RegExp(`name="enabled" value="${code}" checked`).test(html));
}
async function register(name) {
    const customer = new Browser();
    const email = `${name}@example.com`;
    const res = await customer.post('/register', { name: 'Test Buyer', email, password: 'Woodora123', confirm: 'Woodora123' }, '/register');
    assert.equal(res.status, 302, 'registration should redirect');
    return customer;
}
const addToCart = (customer, productId = 2) => customer.post('/cart/add', { productId, quantity: 1 }, '/products');
const checkoutForm = (method) => ({ name: 'Test Buyer', email: 'buyer@example.com', phone: '0788123456', address: '1 KG 7 Ave', city: 'Kigali', method });
// The method radio buttons offered on the checkout page.
const offered = (html) => [...html.matchAll(/name="method" value="(\w+)"/g)].map((m) => m[1]);

// --- tests --------------------------------------------------------------------------------------
test('the table is created automatically with all three methods switched on', async () => {
    const res = await admin.request('/admin/payment-methods');
    assert.equal(res.status, 200);
    for (const label of ['Mobile Money', 'Card payment', 'Cash on Delivery']) assert.match(res.text_, new RegExp(label));
    assert.deepEqual(await adminState(), ALL);
    assert.match(res.text_, /href="\/admin\/payment-methods"[^>]*>[\s\S]*?Payment methods/, 'sidebar link is there');
});

test('toggling: the admin can switch methods off and on and sees a success message', async () => {
    const res = await setMethods(['momo', 'cod']); // Card off
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/admin/payment-methods');
    const page = await admin.request('/admin/payment-methods');
    assert.match(text(page.text_), /Payment methods updated\./);
    assert.deepEqual(await adminState(), ['momo', 'cod'], 'Card is saved as Off');

    // The success message is shown once only.
    assert.doesNotMatch(text((await admin.request('/admin/payment-methods')).text_), /Payment methods updated\./);

    assert.equal((await setMethods(ALL)).status, 302); // back on
    assert.deepEqual(await adminState(), ALL);
});

test('unknown values in the form are ignored', async () => {
    assert.equal((await setMethods(['cod', 'bitcoin'])).status, 302);
    assert.deepEqual(await adminState(), ['cod']);
    await setMethods(ALL);
});

test('rule: at least one method must stay on - turning all off shows an error and saves nothing', async () => {
    await setMethods(['card']); // only Card on
    const res = await admin.post('/admin/payment-methods', {}, '/admin/payment-methods'); // every switch Off
    assert.equal(res.status, 400);
    assert.match(text(res.text_), /At least one payment method must stay on/);
    assert.match(text(res.text_), /Nothing was saved/);
    assert.deepEqual(await adminState(), ['card'], 'the previous setting is unchanged');
    await setMethods(ALL);
});

test('checkout shows only the methods that are On', async () => {
    const customer = await register('hides');
    await addToCart(customer);

    assert.deepEqual(offered((await customer.request('/checkout')).text_), ALL);

    await setMethods(['momo', 'cod']); // Card off
    const page = await customer.request('/checkout');
    assert.equal(page.status, 200);
    assert.deepEqual(offered(page.text_), ['momo', 'cod']);
    assert.doesNotMatch(page.text_, /Card payment/);

    await setMethods(['card', 'cod']); // Mobile Money off: the first method that is On is preselected
    const page2 = await customer.request('/checkout');
    assert.deepEqual(offered(page2.text_), ['card', 'cod']);
    assert.match(page2.text_, /value="card" checked/);
    await setMethods(ALL);
});

test('the server rejects a method that is Off, even if it is sent by hand', async () => {
    const customer = await register('rejects');
    await addToCart(customer);
    await setMethods(['momo', 'cod']); // Card off

    const res = await customer.post('/checkout', checkoutForm('card'), '/checkout');
    assert.equal(res.status, 400);
    assert.match(text(res.text_), /payment method is not available/);
    assert.match(text((await customer.request('/orders')).text_), /not placed any orders/, 'no order was created');

    // Made-up and prototype-style values are rejected too.
    for (const method of ['bitcoin', 'constructor', '']) {
        const bad = await customer.post('/checkout', checkoutForm(method), '/checkout');
        assert.equal(bad.status, 400, `method "${method}" is refused`);
    }
    assert.match(text((await customer.request('/orders')).text_), /not placed any orders/);

    // The cart is untouched, and an enabled method still works.
    const ok = await customer.post('/checkout', checkoutForm('cod'), '/checkout');
    assert.equal(ok.status, 302);
    assert.match(ok.headers.get('location'), /^\/orders\/\d+$/);
    await setMethods(ALL);
});

test('existing orders are not affected: an unpaid order can still be paid with the method it was created with', async () => {
    const customer = await register('existing');
    await addToCart(customer);
    const placed = await customer.post('/checkout', checkoutForm('card'), '/checkout');
    assert.equal(placed.status, 302);
    const payUrl = placed.headers.get('location');
    assert.match(payUrl, /^\/orders\/\d+\/pay$/);
    const orderUrl = payUrl.replace('/pay', '');

    await setMethods(['momo', 'cod']); // Card switched off AFTER the order was created

    const payPage = await customer.request(payUrl);
    assert.equal(payPage.status, 200);
    assert.match(payPage.text_, /name="cardNumber"/, 'the card payment form is still available');
    assert.match(text((await customer.request('/orders')).text_), /Card payment/, 'order list still names the method');

    const paid = await customer.post(`${payUrl}/card`, { cardName: 'Test Buyer', cardNumber: '4242 4242 4242 4242', expiry: '12/39', cvv: '123' }, payUrl);
    assert.equal(paid.status, 302);
    assert.equal(paid.headers.get('location'), orderUrl);
    assert.match(text((await customer.request(orderUrl)).text_), /Paid/);
    await setMethods(ALL);
});

test('a customer gets Access denied on the payment methods page and cannot change anything', async () => {
    const customer = await register('denied');
    const page = await customer.request('/admin/payment-methods');
    assert.equal(page.status, 403);
    assert.match(text(page.text_), /Access denied/);

    const post = await customer.post('/admin/payment-methods', { enabled: ['cod'] }, '/products');
    assert.equal(post.status, 403);
    assert.deepEqual(await adminState(), ALL, 'nothing changed');
});

test('someone who is not logged in is sent to the admin login, and a form without a CSRF token is refused', async () => {
    const visitor = new Browser();
    const page = await visitor.request('/admin/payment-methods');
    assert.equal(page.status, 302);
    assert.match(page.headers.get('location'), /^\/admin\/login/);

    const noToken = await admin.post('/admin/payment-methods', { enabled: ['cod'] }, null);
    assert.equal(noToken.status, 403);
    assert.deepEqual(await adminState(), ALL);
});
