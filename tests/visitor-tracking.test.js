// Visitor tracking tests. Run with:  npm test
// Each run starts the real server (server.js) with a brand new temporary database, then talks to it over HTTP.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const ADMIN = { email: 'admin@test.example', password: 'Test-Admin-Pass-123' };
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';
let tempDir, dbFile, port, server;

const freePort = () => new Promise((resolve) => {
    const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
});

async function startServer() {
    server = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, PORT: String(port), TURSO_DATABASE_URL: 'file:' + dbFile, TURSO_AUTH_TOKEN: '',
               SESSION_SECRET: 'test-secret-test-secret', ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, VERCEL: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    server.stdout.on('data', (d) => { output += d; });
    server.stderr.on('data', (d) => { output += d; });
    for (let i = 0; i < 100; i++) {
        if (/Woodora is running/.test(output)) return;
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Server did not start:\n' + output);
}

function stopServer() {
    return new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
}

// A tiny "browser": remembers cookies between requests.
class Browser {
    constructor(agent = BROWSER) { this.cookies = {}; this.agent = agent; }
    async request(url, { method = 'GET', form, headers = {} } = {}) {
        const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
        const res = await fetch(`http://127.0.0.1:${port}${url}`, {
            method, redirect: 'manual',
            headers: { 'User-Agent': this.agent, Accept: 'text/html,application/xhtml+xml', ...(cookie ? { Cookie: cookie } : {}),
                       ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...headers },
            body: form ? new URLSearchParams(form).toString() : undefined,
        });
        for (const line of res.headers.getSetCookie()) {
            const [pair] = line.split(';');
            const i = pair.indexOf('=');
            const name = pair.slice(0, i), value = pair.slice(i + 1);
            if (value === '' || /expires=Thu, 01 Jan 1970/i.test(line)) delete this.cookies[name]; else this.cookies[name] = value;
        }
        res.text_ = await res.text();
        return res;
    }
    async csrf(url) {
        const res = await this.request(url);
        const match = res.text_.match(/name="_csrf" value="([a-f0-9]+)"/);
        assert.ok(match, 'no CSRF token on ' + url);
        return match[1];
    }
    async post(url, form, csrfFrom) { return this.request(url, { method: 'POST', form: { _csrf: await this.csrf(csrfFrom), ...form } }); }
    async acceptCookies() { return this.post('/privacy/consent', { choice: 'accept', next: '/' }, '/privacy'); }
    async loginAdmin() {
        const res = await this.post('/admin/login', ADMIN, '/admin/login');
        assert.equal(res.status, 302, 'admin login should redirect');
        assert.equal(res.headers.get('location'), '/admin');
    }
    async api(url, method = 'GET') {
        const form = method === 'POST' ? { _csrf: await this.csrf('/admin') } : undefined;
        const res = await this.request(url, { method, form, headers: { Accept: 'application/json' } });
        return { status: res.status, body: res.text_.startsWith('{') ? JSON.parse(res.text_) : res.text_ };
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'woodora-test-'));
    dbFile = path.join(tempDir, 'test.db');
    port = await freePort();
    await startServer();
});
after(async () => {
    if (server && server.exitCode === null) await stopServer();
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('nothing is recorded before the visitor accepts cookies', async () => {
    const visitor = new Browser();
    const res = await visitor.request('/');
    assert.equal(res.status, 200);
    assert.match(res.text_, /Help us count visits\?/, 'cookie notice is shown');
    assert.equal(visitor.cookies.woodora_vid, undefined, 'no tracking cookie before consent');
    assert.equal(visitor.cookies.woodora_sid, undefined);

    const admin = new Browser();
    await admin.loginAdmin();
    assert.equal((await admin.api('/admin/api/notifications')).body.unread, 0);
});

test('opening the public site after accepting creates a visitor record and an admin notification', async () => {
    const admin = new Browser();
    await admin.loginAdmin();
    assert.equal((await admin.api('/admin/api/notifications')).body.unread, 0);

    const visitor = new Browser();
    await visitor.acceptCookies();
    const res = await visitor.request('/');
    assert.equal(res.status, 200);
    assert.match(visitor.cookies.woodora_vid, /^[a-f0-9]{32}$/);
    assert.match(visitor.cookies.woodora_sid, /^[a-f0-9]{32}$/);
    assert.doesNotMatch(res.text_, /Help us count visits\?/, 'notice is gone after choosing');

    const { status, body } = await admin.api('/admin/api/notifications');
    assert.equal(status, 200);
    assert.equal(body.unread, 1, 'unread count went from 0 to 1');
    assert.equal(body.notifications[0].message, 'A new visitor opened Woodora.');
    assert.equal(body.notifications[0].page, '/');
    assert.equal(body.notifications[0].isRead, false);
    assert.ok(!Number.isNaN(Date.parse(body.notifications[0].createdAt)), 'notification has a date and time');
});

test('moving between pages is one session; reloads are not counted twice; visitors page shows the numbers', async () => {
    const visitor = new Browser();
    await visitor.acceptCookies();
    await visitor.request('/mission');
    const sid = visitor.cookies.woodora_sid;
    await visitor.request('/mission');                 // immediate reload -> duplicate, ignored
    await visitor.request('/products');
    await visitor.request('/products/1');
    assert.equal(visitor.cookies.woodora_sid, sid, 'same session id on every page');

    const admin = new Browser();
    await admin.loginAdmin();
    const { body } = await admin.api('/admin/api/notifications');
    assert.equal(body.unread, 2, 'first test visitor + this visitor: only ONE new notification for 3 pages');

    const page = (await admin.request('/admin/visitors')).text_;
    const t = text(page);
    // visits: 1 (first test) + mission, products, product 1 (reload ignored) = 4; unique visitors = 2; sessions = 2
    assert.match(t, /4 Total visits/);
    assert.match(t, /2 Unique visitors/);
    assert.match(t, /4 Today's visits/);
    assert.match(t, /2 Visit sessions/);
    assert.match(t, /Most visited pages/);
    assert.match(t, /Product: Wooden Utensil Holder/);
    assert.match(t, /New visitors 2/);
});

test('a returning visitor (new session, same visitor id) is counted as returning', async () => {
    const visitor = new Browser();
    await visitor.acceptCookies();
    await visitor.request('/impact');
    delete visitor.cookies.woodora_sid;               // the 30-minute session ended
    await visitor.request('/contact');

    const admin = new Browser();
    await admin.loginAdmin();
    const { body } = await admin.api('/admin/api/notifications');
    assert.equal(body.notifications[0].message, 'A returning visitor opened Woodora.');
    const t = text((await admin.request('/admin/visitors')).text_);
    assert.match(t, /Returning visitors 1/);
});

test('robots, administrators, non-page requests and the query string are not recorded', async () => {
    const admin = new Browser();
    await admin.loginAdmin();
    const before = (await admin.api('/admin/api/notifications')).body.unread;

    const bot = new Browser('Googlebot/2.1');
    await bot.acceptCookies();
    await bot.request('/');
    const adminSelf = new Browser();                   // the admin browsing the shop, with cookies accepted
    await adminSelf.loginAdmin();
    await adminSelf.acceptCookies();
    await adminSelf.request('/');
    const image = new Browser();
    await image.acceptCookies();
    await image.request('/', { headers: { 'Sec-Fetch-Dest': 'image' } });
    await image.request('/', { headers: { Purpose: 'prefetch' } });
    await image.request('/does-not-exist');
    await image.request('/cart');

    assert.equal((await admin.api('/admin/api/notifications')).body.unread, before, 'none of those created a notification');

    const searcher = new Browser();
    await searcher.acceptCookies();
    await searcher.request('/products?q=secret-search-term');
    const t = text((await admin.request('/admin/visitors')).text_);
    assert.doesNotMatch(t, /secret-search-term/, 'query strings are never stored');
});

test('declining cookies deletes the tracking cookies and stops counting', async () => {
    const admin = new Browser();
    await admin.loginAdmin();
    const visitor = new Browser();
    await visitor.acceptCookies();
    await visitor.request('/');
    assert.ok(visitor.cookies.woodora_vid);
    const unread = (await admin.api('/admin/api/notifications')).body.unread;

    await visitor.post('/privacy/consent', { choice: 'decline', next: '/privacy' }, '/privacy');
    assert.equal(visitor.cookies.woodora_vid, undefined, 'visitor cookie deleted');
    assert.equal(visitor.cookies.woodora_sid, undefined, 'session cookie deleted');
    await visitor.request('/products');
    assert.equal((await admin.api('/admin/api/notifications')).body.unread, unread, 'no new notification');
});

test('mark one notification as read, then mark all as read; counts update', async () => {
    const admin = new Browser();
    await admin.loginAdmin();
    let { body } = await admin.api('/admin/api/notifications');
    const total = body.unread;
    assert.ok(total >= 3, 'there are several unread notifications to work with, got ' + total);

    const target = body.notifications.find((n) => !n.isRead);
    ({ body } = await admin.api(`/admin/api/notifications/${target.id}/read`, 'POST'));
    assert.equal(body.unread, total - 1);
    assert.equal(body.notifications.find((n) => n.id === target.id).isRead, true);
    ({ body } = await admin.api(`/admin/api/notifications/${target.id}/read`, 'POST'));
    assert.equal(body.unread, total - 1, 'marking the same one twice changes nothing');

    ({ body } = await admin.api('/admin/api/notifications/read-all', 'POST'));
    assert.equal(body.unread, 0);
    assert.ok(body.notifications.every((n) => n.isRead));

    const bad = await admin.api('/admin/api/notifications/abc/read', 'POST');
    assert.equal(bad.status, 400);

    // the count in the server-rendered bell matches
    assert.match((await admin.request('/admin')).text_, /Notifications, 0 unread/);

    // a brand new visitor makes the count go up again without anyone reloading the admin page
    const visitor = new Browser();
    await visitor.acceptCookies();
    await visitor.request('/mission');
    assert.equal((await admin.api('/admin/api/notifications')).body.unread, 1);
    assert.match((await admin.request('/admin')).text_, /Notifications, 1 unread/);
});

test('mark-as-read needs the CSRF token', async () => {
    const admin = new Browser();
    await admin.loginAdmin();
    const res = await admin.request('/admin/api/notifications/read-all', { method: 'POST', form: { _csrf: 'wrong' }, headers: { Accept: 'application/json' } });
    assert.equal(res.status, 403);
});

test('customers and logged-out visitors cannot reach visitor analytics or notifications', async () => {
    const endpoints = ['/admin/visitors', '/admin/api/notifications'];

    const anonymous = new Browser();
    for (const url of endpoints) {
        const res = await anonymous.request(url, { headers: url.includes('/api/') ? { Accept: 'application/json' } : {} });
        if (url.includes('/api/')) assert.equal(res.status, 401, url);
        else { assert.equal(res.status, 302, url); assert.match(res.headers.get('location'), /^\/admin\/login/); }
    }
    // A valid CSRF token, so the request reaches the administrator check itself.
    const anonPost = await anonymous.request('/admin/api/notifications/read-all', { method: 'POST', form: { _csrf: await anonymous.csrf('/products') }, headers: { Accept: 'application/json' } });
    assert.equal(anonPost.status, 401);

    const customer = new Browser();
    const reg = await customer.post('/register', { name: 'Test Customer', email: 'customer@test.example', password: 'Customer-Pass-1', confirm: 'Customer-Pass-1' }, '/register');
    assert.ok([302, 200].includes(reg.status));
    const check = await customer.request('/orders');           // proves the customer really is logged in
    assert.equal(check.status, 200, 'customer is logged in (status ' + check.status + ')');
    const page = await customer.request('/admin/visitors');
    assert.equal(page.status, 403);
    assert.doesNotMatch(page.text_, /Total visits/);
    for (const [url, method] of [['/admin/api/notifications', 'GET'], ['/admin/api/notifications/read-all', 'POST']]) {
        const res = await customer.request(url, { method, form: method === 'POST' ? { _csrf: await customer.csrf('/products') } : undefined, headers: { Accept: 'application/json' } });
        assert.equal(res.status, 403, url);
        assert.doesNotMatch(res.text_, /notifications"/);
    }
});

test('visitor records and notifications survive a server restart', async () => {
    const admin = new Browser();
    await admin.loginAdmin();
    const beforeNotes = (await admin.api('/admin/api/notifications')).body;
    const beforeStats = text((await admin.request('/admin/visitors')).text_).match(/(\d+) Total visits/)[1];

    await stopServer();
    await startServer();

    const admin2 = new Browser();
    await admin2.loginAdmin();
    const afterNotes = (await admin2.api('/admin/api/notifications')).body;
    assert.deepEqual(afterNotes, beforeNotes);
    assert.equal(text((await admin2.request('/admin/visitors')).text_).match(/(\d+) Total visits/)[1], beforeStats);
    assert.ok(Number(beforeStats) >= 6, 'there were real records to keep (' + beforeStats + ')');
    // and the old visitor cookie is still recognised after the restart
    const visitor = new Browser();
    await visitor.acceptCookies();
    await visitor.request('/');
    const old = visitor.cookies.woodora_vid;
    delete visitor.cookies.woodora_sid;
    await stopServer(); await startServer();
    await visitor.request('/mission');
    assert.equal(visitor.cookies.woodora_vid, old);
});

test('the database stores no personal data columns', async () => {
    const { createClient } = require('@libsql/client');
    const client = createClient({ url: 'file:' + dbFile });
    const visits = (await client.execute('PRAGMA table_info(visits)')).rows.map((r) => r.name);
    assert.deepEqual(visits, ['id', 'visitor_id', 'session_id', 'path', 'is_new_session', 'is_new_visitor', 'created_at']);
    const row = (await client.execute('SELECT * FROM visits ORDER BY id DESC LIMIT 1')).rows[0];
    assert.match(String(row.visitor_id), /^[a-f0-9]{32}$/);
    client.close();
});
