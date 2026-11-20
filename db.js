const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'data', 'db.json');
function load() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ orders: [], rentals: [], users: {}, warnings: {} }, null, 2));
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function save(db) { fs.writeFileSync(file, JSON.stringify(db, null, 2)); }
module.exports = { load, save };
