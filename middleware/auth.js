// Guards that protect pages. Use them in front of a route:
//   router.get('/orders', requireLogin, ...)
//   router.use(requireAdmin)
// These run on the SERVER for every request, so hiding a link in the menu is never the only protection.

// Customers may only be sent to pages on our own site (and never straight into the admin area).
function safeNext(next) {
    const ok = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\');
    return ok && !next.startsWith('/admin') ? next : '/products';
}

// Administrators may only be sent to admin pages (not to /admin/login itself).
function safeAdminNext(next) {
    const ok = typeof next === 'string' && /^\/admin(\/|$|\?)/.test(next) && !next.startsWith('/admin/login');
    return ok ? next : '/admin';
}

function requireLogin(req, res, next) {
    if (req.session.user) return next();
    req.session.flash = { type: 'error', text: 'Please log in to continue.' };
    res.redirect('/login/customer?next=' + encodeURIComponent(req.originalUrl));
}

function requireAdmin(req, res, next) {
    if (!req.session.user) {
        req.session.flash = { type: 'error', text: 'Please log in as administrator.' };
        return res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
    }
    if (req.session.user.role !== 'admin') {
        // A logged-in customer must never see admin pages.
        return res.status(403).render('error', { title: 'Access denied', heading: 'Access denied',
            message: 'This area is for administrators only.' });
    }
    next();
}

module.exports = { requireLogin, requireAdmin, safeNext, safeAdminNext };
