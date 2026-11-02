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
function authenticate(email, password) {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return null;
    return user;
}

// Start a fresh session after login (prevents session fixation) but keep the guest's cart.
function logUserIn(req, res, user, redirectTo) {
    const guestCart = req.session.cart || {};
    req.session.regenerate((err) => {
        if (err) throw err;
        req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
        req.session.cart = guestCart;
        req.session.flash = { type: 'success', text: `Welcome, ${user.name}!` };
        res.redirect(redirectTo);
    });
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

router.post('/login/customer', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const next = safeNext(req.body.next);
    const fail = (status, error) => res.status(status).render('login-customer', { title: 'Customer login', error, email, next });

    const user = authenticate(email, password);
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

router.post('/admin/login', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const next = safeAdminNext(req.body.next);
    const fail = (status, error) => res.status(status).render('login-admin', { title: 'Admin login', error, email, next });

    const user = authenticate(email, password);
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

router.post('/register', (req, res) => {
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
    if (!errors.email && db.prepare('SELECT id FROM users WHERE email = ?').get(values.email)) {
        errors.email = 'An account with this email already exists. Try logging in.';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).render('register', { title: 'Create account', errors, values });
    }
    // The role is ALWAYS 'customer' here. Anything sent in the form (e.g. role=admin) is ignored.
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')")
        .run(values.name, values.email, hash);
    logUserIn(req, res, { id: result.lastInsertRowid, name: values.name, email: values.email, role: 'customer' }, '/products');
});

// ----- Logout (a POST form, so other websites cannot log you out) -----
router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
