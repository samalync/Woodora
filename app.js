// Woodora - the Express application.
// This file only BUILDS the app. It is started in two ways:
//   - on your computer: server.js calls app.listen()
//   - on Vercel:        api/index.js exports the app and Vercel runs it for every request
require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');

const db = require('./db/database');
const { addCsrfToken, verifyCsrfToken } = require('./middleware/csrf');

const app = express();
const onVercel = Boolean(process.env.VERCEL);

// A problem with the settings (not with the code). The message is safe to show.
class ConfigError extends Error {}

// Which settings does the server see? Shows only NAMES and yes/no (never values), to help fix a missing or
// misspelled setting in the Vercel dashboard.
function settingsReport() {
    const wanted = ['SESSION_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];
    const seen = wanted.map((name) => `${name}: ${process.env[name] ? 'found' : 'MISSING'}`).join(', ');
    // Variables that look similar but are not exact matches (a typo, an extra space...).
    const similar = Object.keys(process.env)
        .filter((name) => /session|secret|turso|admin/i.test(name) && !wanted.includes(name))
        .map((name) => JSON.stringify(name));
    return ` [Environment: ${process.env.VERCEL_ENV || 'unknown'}. ${seen}.` +
        (similar.length ? ` Similar names that do not match exactly: ${similar.join(', ')}.` : '') + ']';
}

// Login sessions are stored in a signed cookie, so they work on any server instance
// (Vercel may run each request on a different one). The secret signs the cookie so it cannot be edited.
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && !onVercel) {
    console.warn('WARNING: SESSION_SECRET is not set in .env - using a temporary one (logins reset on restart).');
    sessionSecret = crypto.randomBytes(32).toString('hex');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (onVercel) app.set('trust proxy', 1); // Vercel sits in front of us and handles HTTPS

// Basic security headers
app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Referrer-Policy', 'same-origin');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false, limit: '20kb' })); // read HTML form data

// Default values for the page templates. They are set first, so even the error page can be shown
// if something fails early (for example a wrong database setting). Later steps replace them.
app.use((req, res, next) => {
    res.locals.currentUser = null;
    res.locals.currentPath = req.path;
    res.locals.cartCount = 0;
    res.locals.flash = null;
    res.locals.csrfToken = '';
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

// On Vercel the secret MUST come from the project settings: a random one would differ on every instance.
if (!sessionSecret) {
    app.use((req, res, next) => next(new ConfigError('Server setting missing: add SESSION_SECRET in the Vercel project settings (Environment Variables) for the Production environment, then redeploy.' + settingsReport())));
}

// Make sure the database tables exist (creates them the first time).
app.use(async (req, res, next) => {
    try {
        await db.ensureReady();
        next();
    } catch (err) {
        console.error('Database setup failed:', err);
        next(new ConfigError('The database could not be reached or set up. Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the Vercel project settings (and ADMIN_EMAIL / ADMIN_PASSWORD), then redeploy. Details are in the Vercel function logs.' + settingsReport()));
    }
});

if (sessionSecret) {
    app.use(cookieSession({
        name: 'woodora',
        keys: [sessionSecret],
        httpOnly: true,
        sameSite: 'lax',
        secure: onVercel,                  // HTTPS-only cookie when deployed
        maxAge: 1000 * 60 * 60 * 8,        // 8 hours
    }));
}

// The cookie says who you are, but the DATABASE decides: if the account no longer exists
// the user is logged out, and the role always comes from the database (never from the cookie).
app.use(async (req, res, next) => {
    try {
        if (req.session && req.session.user) {
            const user = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', req.session.user.id);
            if (!user) delete req.session.user;
            else req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
        }
        next();
    } catch (err) { next(err); }
});

app.use(addCsrfToken);

// Values every page can use in its template.
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    res.locals.currentPath = req.path;
    res.locals.cartCount = Object.values(req.session.cart || {}).reduce((sum, qty) => sum + qty, 0);
    res.locals.flash = req.session.flash || null; // one-time message (success / error)
    delete req.session.flash;
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
    const message = err instanceof ConfigError ? err.message : 'An unexpected error happened. Please try again.';
    res.status(500).render('error', { title: 'Something went wrong', heading: 'Something went wrong', message });
});

module.exports = app;
