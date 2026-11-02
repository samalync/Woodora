// Opens the SQLite database file and shares it with the rest of the app.
// Every query in the project uses db.prepare(...) with "?" placeholders,
// which is what protects us from SQL injection.
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'woodora.db'));
db.pragma('foreign_keys = ON'); // make SQLite enforce table relationships

module.exports = db;
