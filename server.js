// Woodora - main entry point.
// Sets up Express, sessions, shared template values and the route files.
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const db = require('./db/database');
const { addCsrfToken, verifyCsrfToken } = require('./middleware/csrf');
const { getCartDetails } = require('./helpers/cart');

const app = express();
const PORT = process.env.PORT || 3000;

// Make sure setup has been run (tables exist).
const tablesExist = db.prepare("SELECT name FROM sqlite_master WHERE name = 'products'").get();
if (!tablesExist) {
    console.error('Database is empty. Please run:  npm run setup');
    process.exit(1);
}

// Sessions need a secret. In production it must come from .env.
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
    console.warn('WARNING: SESSION_SECRET is not set in .env - using a temporary one (logins reset on restart).');
    sessionSecret = crypto.randomBytes(32).toString('hex');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Basic security headers
app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Referrer-Policy', 'same-origin');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false, limit: '20kb' })); // read HTML form data

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
}));

app.use(addCsrfToken);

// Values every page can use in its template.
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    res.locals.currentPath = req.path;
    res.locals.cartCount = Object.values(req.session.cart || {}).reduce((sum, qty) => sum + qty, 0);
    res.locals.flash = req.session.flash || null; // one-time message (success / error)
    delete req.session.flash;
    res.locals.rwf = (amount) => Number(amount).toLocaleString('en-US') + ' RWF';
    // PLACEHOLDER business details - replace with the real ones in one place.
    res.locals.business = {
        email: 'info@woodora.example',
        phone: '+250 7XX XXX XXX',
        address: '[Shop address - to be added], Kigali, Rwanda',
        hours: 'Mon - Sat, 8:00 - 18:00',
    };
    next();
});

app.use(verifyCsrfToken); // checks every POST form

app.use('/', require('./routes/pages'));
app.use('/', require('./routes/auth'));
app.use('/products', require('./routes/shop'));
app.use('/cart', require('./routes/cart'));
app.use('/', require('./routes/checkout'));
app.use('/admin', require('./routes/admin'));

// 404 page
app.use((req, res) => {
    res.status(404).render('error', { title: 'Page not found', heading: 'Page not found',
        message: 'Sorry, we could not find the page you were looking for.' });
});

// Unexpected errors: show a friendly page, log details for developers.
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { title: 'Something went wrong', heading: 'Something went wrong',
        message: 'An unexpected error happened. Please try again.' });
});

app.listen(PORT, () => console.log(`Woodora is running at http://localhost:${PORT}`));
