// Privacy notice and the cookie choice (Accept / Decline) used by the visitor tracking.
const express = require('express');
const { saveConsent } = require('../middleware/visitors');
const router = express.Router();

// Only go back to a page on our own site (never to another website, never into the admin area).
function safeBack(value) {
    const ok = typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');
    return ok && !value.startsWith('/admin') ? value : '/';
}

router.get('/privacy', (req, res) => res.render('privacy', { title: 'Privacy & Cookies' }));

router.post('/privacy/consent', (req, res) => {
    const granted = req.body.choice === 'accept';
    saveConsent(res, granted);
    req.session.flash = { type: 'success', text: granted
        ? 'Thank you. Anonymous visit statistics are on. You can change this any time on the Privacy page.'
        : 'Understood. Your visits will not be counted.' };
    res.redirect(safeBack(req.body.next));
});

module.exports = router;
