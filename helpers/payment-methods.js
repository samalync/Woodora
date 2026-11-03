// Payment methods that the administrator can switch on and off (table payment_methods).
//   enabledMethods() - what customers may choose at checkout:  { momo: 'Mobile Money (simulated)', ... }
//   methodLabels()   - the names of ALL methods, switched on or off. Used to show existing orders,
//                      which keep their payment method even if it is switched off later.
const db = require('../db/database');

const CODES = ['momo', 'card', 'cod']; // fixed order of the methods everywhere

const allMethods = () => db.all(
    "SELECT code, name, enabled FROM payment_methods ORDER BY CASE code WHEN 'momo' THEN 1 WHEN 'card' THEN 2 ELSE 3 END");

const toMap = (rows) => Object.fromEntries(rows.map((m) => [m.code, m.name]));

async function enabledMethods() { return toMap((await allMethods()).filter((m) => m.enabled === 1)); }
async function methodLabels() { return toMap(await allMethods()); }

module.exports = { CODES, allMethods, enabledMethods, methodLabels };
