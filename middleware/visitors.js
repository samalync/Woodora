// Anonymous website visitor tracking.
//
// PRIVACY RULES (see the Privacy page and PROJECT_GUIDE.md):
//   - Nothing is recorded and no tracking cookie is set until the visitor presses "Accept" on the cookie notice.
//   - We store only: a random visitor id, a random session id, the page path and the time.
//     No name, email, IP address, browser details or login account is ever stored with a visit.
//   - Administrators browsing their own shop are never counted.
const crypto = require('crypto');
const db = require('../db/database');

const CONSENT_COOKIE = 'woodora_consent';   // "granted" or "declined" (remembers the choice)
const VISITOR_COOKIE = 'woodora_vid';       // random id, 1 year
const SESSION_COOKIE = 'woodora_sid';       // random id, ends after 30 minutes without a page view
const YEAR = 365 * 24 * 60 * 60 * 1000;
const SESSION_LENGTH = 30 * 60 * 1000;
const DUPLICATE_WINDOW_SECONDS = 10;        // the same page opened again within 10 seconds (reload) counts once
const onVercel = Boolean(process.env.VERCEL);

// Public pages that are counted. Customer pages (cart checkout, orders, login) are not analysed.
const TRACKED_PATHS = [/^\/$/, /^\/products$/, /^\/products\/\d{1,9}$/, /^\/mission$/, /^\/impact$/, /^\/contact$/, /^\/privacy$/];
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|monitor|uptime|headless|lighthouse|curl|wget|python-requests|httpclient|axios|node-fetch|undici/i;
const ID_PATTERN = /^[a-f0-9]{32}$/;

function readCookies(req) {
    const cookies = {};
    for (const part of String(req.headers.cookie || '').split(';')) {
        const index = part.indexOf('=');
        if (index > 0) cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
    }
    return cookies;
}

function cookieOptions(maxAge) {
    return { maxAge, httpOnly: true, sameSite: 'lax', secure: onVercel, path: '/' };
}

function newId() { return crypto.randomBytes(16).toString('hex'); }

// "/products/" and "/products" are the same page.
function normalizePath(pathname) {
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

// Is this request a real person opening a page (not an image, a robot, a prefetch or an administrator)?
function isCountableRequest(req, path) {
    if (req.method !== 'GET') return false;
    if (!TRACKED_PATHS.some((pattern) => pattern.test(path))) return false;
    if (req.session.user && req.session.user.role === 'admin') return false;
    const agent = String(req.headers['user-agent'] || '');
    if (!agent || BOT_PATTERN.test(agent)) return false;
    if (!String(req.headers.accept || '').includes('text/html')) return false;
    const purpose = `${req.headers.purpose || ''} ${req.headers['sec-purpose'] || ''} ${req.headers['x-moz'] || ''}`;
    if (/prefetch|prerender/i.test(purpose)) return false;
    const fetchDest = req.headers['sec-fetch-dest'];
    if (fetchDest && fetchDest !== 'document') return false;
    return true;
}

// Save one page view. Creates the admin notification when it is the first page of a new session.
async function recordVisit(visitorId, sessionId, path) {
    const known = await db.get(
        `SELECT
            (SELECT COUNT(*) FROM visits WHERE session_id = ?) AS in_session,
            (SELECT COUNT(*) FROM visits WHERE session_id = ? AND path = ?
                AND created_at >= datetime('now', ?)) AS duplicate,
            (SELECT COUNT(*) FROM visits WHERE visitor_id = ?) AS seen_before`,
        sessionId, sessionId, path, `-${DUPLICATE_WINDOW_SECONDS} seconds`, visitorId);

    if (known.duplicate > 0) return; // a reload or repeated request

    if (known.in_session > 0) {
        await db.run('INSERT INTO visits (visitor_id, session_id, path) VALUES (?, ?, ?)', visitorId, sessionId, path);
        return;
    }

    // First page of a new session: save the visit and the notification together (both or neither).
    const isNewVisitor = known.seen_before === 0 ? 1 : 0;
    try {
        await db.transaction(async (tx) => {
            const visit = await tx.run(
                'INSERT INTO visits (visitor_id, session_id, path, is_new_session, is_new_visitor) VALUES (?, ?, ?, 1, ?)',
                visitorId, sessionId, path, isNewVisitor);
            await tx.run('INSERT INTO admin_notifications (type, message, visit_id) VALUES (?, ?, ?)',
                'new_visitor', isNewVisitor ? 'A new visitor opened Woodora.' : 'A returning visitor opened Woodora.', visit.lastInsertRowid);
        });
    } catch (err) {
        if (!/UNIQUE|constraint/i.test(String(err && err.message))) throw err;
        // Another request of the same session started it a moment earlier: just save this page view.
        await db.run('INSERT INTO visits (visitor_id, session_id, path) VALUES (?, ?, ?)', visitorId, sessionId, path);
    }
}

// Express middleware. Never lets a tracking problem break the website.
async function trackVisits(req, res, next) {
    const consent = readCookies(req)[CONSENT_COOKIE];
    res.locals.consentChoice = consent === 'granted' || consent === 'declined' ? consent : null; // null = not asked yet

    try {
        const path = normalizePath(req.path);
        if (res.locals.consentChoice === 'granted' && isCountableRequest(req, path)) {
            const cookies = readCookies(req);
            const visitorId = ID_PATTERN.test(cookies[VISITOR_COOKIE] || '') ? cookies[VISITOR_COOKIE] : newId();
            const sessionId = ID_PATTERN.test(cookies[SESSION_COOKIE] || '') ? cookies[SESSION_COOKIE] : newId();
            res.cookie(VISITOR_COOKIE, visitorId, cookieOptions(YEAR));
            res.cookie(SESSION_COOKIE, sessionId, cookieOptions(SESSION_LENGTH)); // renewed on every page view
            await recordVisit(visitorId, sessionId, path);
        }
    } catch (err) {
        console.error('Visitor tracking failed (the page still works):', err.message);
    }
    next();
}

// Remember the visitor's choice. Declining (or changing the mind) also deletes the tracking cookies.
function saveConsent(res, granted) {
    res.cookie(CONSENT_COOKIE, granted ? 'granted' : 'declined', cookieOptions(YEAR));
    if (!granted) {
        const { maxAge, ...options } = cookieOptions(0);
        res.clearCookie(VISITOR_COOKIE, options);
        res.clearCookie(SESSION_COOKIE, options);
    }
}

module.exports = { trackVisits, saveConsent, TRACKED_PATHS };
