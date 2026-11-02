// CSRF protection: every form carries a secret token that only our own pages know.
// A malicious website cannot guess it, so it cannot submit forms on a user's behalf.
const crypto = require('crypto');

function addCsrfToken(req, res, next) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
}

function verifyCsrfToken(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const sent = String((req.body && req.body._csrf) || '');
    const expected = req.session.csrfToken || '';
    const ok = sent.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
    if (!ok) {
        return res.status(403).render('error', { title: 'Session expired', heading: 'Session expired',
            message: 'Your form expired or was not valid. Please go back, refresh the page and try again.' });
    }
    next();
}

module.exports = { addCsrfToken, verifyCsrfToken };
