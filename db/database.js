// Database access for the whole app (SQLite through the libSQL driver).
//
// Where is the database?
//   - On your computer:  db/woodora.db  (a normal SQLite file)
//   - On Vercel + Turso: the hosted SQLite database named by TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
//   - On Vercel without Turso: a temporary file in /tmp (demo only - it is wiped when the function restarts)
//
// Every query uses "?" placeholders, which is what protects us from SQL injection.
// All functions are async, so use them with await:
//     const user = await db.get('SELECT * FROM users WHERE email = ?', email);
const path = require('path');
const os = require('os');
const { createClient } = require('@libsql/client');

let url;
let storage; // text shown in the logs
if (process.env.TURSO_DATABASE_URL) {
    // Turso gives "libsql://..." addresses; "https://" is more reliable inside short-lived serverless functions.
    url = process.env.TURSO_DATABASE_URL.replace(/^libsql:/, 'https:');
    storage = url.startsWith('file:') ? 'database file' : 'Turso (hosted SQLite)';
} else if (process.env.VERCEL) {
    url = 'file:' + path.join(os.tmpdir(), 'woodora.db');
    storage = 'TEMPORARY /tmp file (demo mode: data is lost when the function restarts - set TURSO_DATABASE_URL)';
} else {
    url = 'file:' + path.join(__dirname, 'woodora.db');
    storage = 'local file db/woodora.db';
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

// Turn a result into plain objects like { id: 1, name: 'Bowl' }.
function toObjects(result) {
    return result.rows.map((row) => Object.fromEntries(result.columns.map((name, i) => [name, row[i]])));
}

// The same four helpers work on the normal connection and inside a transaction.
function makeApi(executor) {
    const all = async (sql, ...args) => toObjects(await executor.execute({ sql, args }));
    return {
        all,                                                        // many rows
        get: async (sql, ...args) => (await all(sql, ...args))[0],  // first row or undefined
        run: async (sql, ...args) => {                              // INSERT / UPDATE / DELETE
            const result = await executor.execute({ sql, args });
            return {
                changes: result.rowsAffected,
                lastInsertRowid: result.lastInsertRowid == null ? undefined : Number(result.lastInsertRowid),
            };
        },
    };
}

const db = {
    ...makeApi(client),
    storage,

    // Run several statements as ONE unit: all succeed, or none are saved.
    // Usage: await db.transaction(async (tx) => { await tx.run(...); });
    async transaction(work) {
        const tx = await client.transaction('write');
        try {
            const result = await work(makeApi(tx));
            await tx.commit();
            return result;
        } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
        } finally {
            tx.close();
        }
    },

    // Run a whole SQL script (used to create the tables).
    exec: (script) => client.executeMultiple(script),
};

// Create the tables and starting data the first time the app runs (once per server start).
let ready = null;
db.ensureReady = function ensureReady() {
    if (!ready) {
        ready = require('./seed').setupDatabase({ allowGeneratedPassword: false })
            .catch((err) => { ready = null; throw err; }); // try again on the next request
    }
    return ready;
};

module.exports = db;
