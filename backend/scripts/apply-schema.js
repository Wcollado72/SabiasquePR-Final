require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Esquema aplicado correctamente.');
  await pool.end();
}

main().catch((err) => {
  console.error('Error aplicando el esquema:', err.message);
  process.exit(1);
});
