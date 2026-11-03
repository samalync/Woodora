// Shared test tools: starts the real server (server.js) with a brand new temporary database
// and gives you a tiny "browser" that remembers cookies. Used by tests/payment-methods.test.js.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');

const ADMIN = { email: 'admin@test.example', password: 'Test-Admin-Pass-123' };
const AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const freePort = () => new Promise((resolve) => {
    const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
});

function createHarness() {
    let tempDir, port, server;

    async function start() {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'woodora-test-'));
        port = await freePort();
        server = spawn(process.execPath, ['server.js'], {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, PORT: String(port), TURSO_DATABASE_URL: 'file:' + path.join(tempDir, 'test.db'), TURSO_AUTH_TOKEN: '',
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

    async function stop() {
        if (server && server.exitCode === null) await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    class Browser {
        constructor() { this.cookies = {}; }
        async request(url, { method = 'GET', form } = {}) {
            const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
            const res = await fetch(`http://127.0.0.1:${port}${url}`, {
                method, redirect: 'manual',
                headers: { 'User-Agent': AGENT, Accept: 'text/html', ...(cookie ? { Cookie: cookie } : {}),
                           ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
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
        // POST a form. A value may be an array (a field sent several times, like several ticked checkboxes).
        // Pass csrfFrom = a page to take the CSRF token from, or null to send no token.
        async post(url, form, csrfFrom) {
            const pairs = csrfFrom ? [['_csrf', await this.csrf(csrfFrom)]] : [];
            for (const [key, value] of Object.entries(form)) for (const v of [].concat(value)) pairs.push([key, v]);
            return this.request(url, { method: 'POST', form: pairs });
        }
    }
    return { start, stop, Browser };
}

module.exports = { createHarness, ADMIN };
