// Actualiza la foto y el texto del Polo (ahora "Flor de Maga", ya no "Noticias
// Internacionales" — la foto nueva del usuario no tiene nada que ver con el globo).
require('dotenv').config();
const { pool } = require('../src/db');

async function main() {
  const r = await pool.query(
    `UPDATE productos SET nombre=$2, descripcion=$3, imagen=$4, imagen_alt=$5 WHERE id=$1 RETURNING id, nombre, imagen`,
    [
      'polo-noticias',
      'Polo "Flor de Maga"',
      'Polo blanco con vivos rojos y azul marino, y la flor de maga —símbolo nacional de Puerto Rico— bordada en el pecho.',
      'images/polo-flor-de-maga.webp',
      'Polo blanco con cuello y puños de rayas rojas y azul marino, y una flor de maga bordada en el pecho',
    ]
  );
  console.log('✓', r.rows[0]);
  await pool.end();
}
main().catch((err) => { console.error(err); process.exit(1); });
