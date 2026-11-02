// Woodora - starts the website on your computer (npm start).
// On Vercel this file is not used: see api/index.js.
const app = require('./app');
const db = require('./db/database');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Woodora is running at http://localhost:${PORT}  (database: ${db.storage})`));
