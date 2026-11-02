// Register, login and logout.
//
// There are two login PAGES (customer and administrator) but only ONE login system:
// both use authenticate() below, the same users table and the same bcrypt hashes.
// After the password is verified, the server checks the user's ROLE for the page being used.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { safeNext, safeAdminNext } = require('../middleware/auth');
const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Check email + password. Returns the user row, or null if they are wrong.
async function authenticate(email, password) {
    const user = await db.get('SELECT * FROM users WHERE email = ?', email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return null;
    return user;
}

// Start a brand new session after login (the old one is thrown away) but keep the guest's cart.
// The session lives in a signed cookie, so the role stored here cannot be edited by the user.
function logUserIn(req, res, user, redirectTo) {
    const guestCart = req.session.cart || {};
    req.session = {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        cart: guestCart,
        flash: { type: 'success', text: `Welcome, ${user.name}!` },
    };
    res.redirect(redirectTo);
}

// If somebody is already logged in, send them to the right place instead of a login form.
function redirectIfLoggedIn(req, res, page) {
    const user = req.session.user;
    if (!user) return false;
    if (user.role === 'admin') { res.redirect('/admin'); return true; }
    if (page === 'admin') req.session.flash = { type: 'error', text: 'You are logged in as a customer. Log out first to use the administrator login.' };
    res.redirect('/');
    return true;
}

// ----- Login selection page: "Customer or Administrator?" -----
router.get('/login', (req, res) => {
    if (redirectIfLoggedIn(req, res, 'customer')) return;
    res.render('login-choice', { title: 'Log in' });
});

// ----- Customer login -----
router.get('/login/customer', (req, res) => {
    if (redirectIfLoggedIn(req, res, 'customer')) return;
    res.render('login-customer', { title: 'Customer login', error: null, email: '', next: safeNext(req.query.next) });
});

router.post('/login/customer', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const next = safeNext(req.body.next);
    const fail = (status, error) => res.status(status).render('login-customer', { title: 'Customer login', error, email, next });

    const user = await authenticate(email, password);
    // Same message for "no such user" and "wrong password" so attackers learn nothing.
    if (!user) return fail(401, 'Incorrect email or password.');
    if (user.role !== 'customer') {
        return fail(403, 'This is an administrator account. Please use the Admin Login instead.');
    }
    logUserIn(req, res, user, next);
});

// ----- Administrator login (separate page, same secure system) -----
router.get('/admin/login', (req, res) => {
    if (redirectIfLoggedIn(req, res, 'admin')) return;
    res.render('login-admin', { title: 'Admin login', error: null, email: '', next: safeAdminNext(req.query.next) });
});

router.post('/admin/login', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const next = safeAdminNext(req.body.next);
    const fail = (status, error) => res.status(status).render('login-admin', { title: 'Admin login', error, email, next });

    const user = await authenticate(email, password);
    if (!user) return fail(401, 'Incorrect email or password.');
    // A valid customer account is NOT allowed through the admin door.
    if (user.role !== 'admin') {
        return fail(403, 'Access denied: this account is not an administrator. Customers can log in from the Customer Login page.');
    }
    logUserIn(req, res, user, next);
});

// ----- Register (customers only) -----
router.get('/register', (req, res) => {
    if (redirectIfLoggedIn(req, res, 'customer')) return;
    res.render('register', { title: 'Create account', errors: {}, values: {} });
});

router.post('/register', async (req, res) => {
    const values = {
        name: String(req.body.name || '').trim(),
        email: String(req.body.email || '').trim().toLowerCase(),
    };
    const password = String(req.body.password || '');
    const confirm = String(req.body.confirm || '');
    const errors = {};

    if (values.name.length < 2 || values.name.length > 60) errors.name = 'Please enter your name (2-60 characters).';
    if (!EMAIL_PATTERN.test(values.email) || values.email.length > 100) errors.email = 'Please enter a valid email address.';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        errors.password = 'Password must be at least 8 characters and include a letter and a number.';
    }
    if (password !== confirm) errors.confirm = 'The two passwords do not match.';
    if (!errors.email && await db.get('SELECT id FROM users WHERE email = ?', values.email)) {
        errors.email = 'An account with this email already exists. Try logging in.';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).render('register', { title: 'Create account', errors, values });
    }
    // The role is ALWAYS 'customer' here. Anything sent in the form (e.g. role=admin) is ignored.
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.run("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')",
        values.name, values.email, hash);
    logUserIn(req, res, { id: result.lastInsertRowid, name: values.name, email: values.email, role: 'customer' }, '/products');
});

// ----- Logout (a POST form, so other websites cannot log you out) -----
router.post('/logout', (req, res) => {
    req.session = null; // removes the session cookie
    res.redirect('/');
});

module.exports = router;
