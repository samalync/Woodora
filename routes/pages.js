// Home, Impact, Our Mission and Contact pages.
const express = require('express');
const db = require('../db/database');
const router = express.Router();

router.get('/', (req, res) => {
    // Featured products come from the same products table as the catalogue.
    const featured = db.prepare(
        `SELECT p.*, c.name AS category FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.featured = 1 ORDER BY p.id LIMIT 3`
    ).all();
    // Category tiles: name, number of products and a picture taken from the category's first product.
    const categories = db.prepare(
        `SELECT c.id, c.name, COUNT(p.id) AS count,
                (SELECT image FROM products WHERE category_id = c.id ORDER BY id LIMIT 1) AS image
         FROM categories c LEFT JOIN products p ON p.category_id = c.id
         GROUP BY c.id ORDER BY c.id`
    ).all();
    res.render('home', { title: 'Home', featured, categories });
});

router.get('/impact', (req, res) => res.render('impact', { title: 'Our Impact' }));
router.get('/mission', (req, res) => res.render('mission', { title: 'Our Mission' }));
router.get('/our-mission.html', (req, res) => res.redirect(301, '/mission')); // old link

// ----- Contact form -----
router.get('/contact', (req, res) => {
    const user = req.session.user;
    res.render('contact', { title: 'Contact Us', errors: {},
        values: { name: user ? user.name : '', email: user ? user.email : '', subject: '', message: '' } });
});

router.post('/contact', (req, res) => {
    const values = {
        name: String(req.body.name || '').trim(),
        email: String(req.body.email || '').trim(),
        subject: String(req.body.subject || '').trim(),
        message: String(req.body.message || '').trim(),
    };
    const errors = {};
    if (values.name.length < 2 || values.name.length > 60) errors.name = 'Please enter your name (2-60 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) || values.email.length > 100) errors.email = 'Please enter a valid email address.';
    if (values.subject.length < 3 || values.subject.length > 100) errors.subject = 'Please enter a subject (3-100 characters).';
    if (values.message.length < 10 || values.message.length > 1000) errors.message = 'Your message must be 10-1000 characters.';

    if (Object.keys(errors).length > 0) {
        return res.status(400).render('contact', { title: 'Contact Us', errors, values });
    }
    db.prepare('INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)')
        .run(values.name, values.email, values.subject, values.message);
    req.session.flash = { type: 'success', text: 'Thank you! Your message was sent. We will reply by email.' };
    res.redirect('/contact');
});

module.exports = router;
