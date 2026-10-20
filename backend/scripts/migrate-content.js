require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

const CONTENT_DIR = path.join(__dirname, '..', '..', 'frontend', '_content');

async function migrateNoticias() {
  const noticias = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'noticias.json'), 'utf8'));

  for (const n of noticias) {
    await pool.query(
      `INSERT INTO noticias
         (id, titulo, fecha, fecha_display, imagen, imagen_alt, imagen_caption, clase, fuente_url, fuente_texto, parrafos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         titulo = EXCLUDED.titulo,
         fecha = EXCLUDED.fecha,
         fecha_display = EXCLUDED.fecha_display,
         imagen = EXCLUDED.imagen,
         imagen_alt = EXCLUDED.imagen_alt,
         imagen_caption = EXCLUDED.imagen_caption,
         clase = EXCLUDED.clase,
         fuente_url = EXCLUDED.fuente_url,
         fuente_texto = EXCLUDED.fuente_texto,
         parrafos = EXCLUDED.parrafos`,
      [
        n.id, n.titulo, n.fecha, n.fechaDisplay, n.imagen, n.imagenAlt,
        n.imagenCaption, n.clase, n.fuenteUrl, n.fuenteTexto, JSON.stringify(n.parrafos),
      ]
    );
  }
  console.log(`  ✓ ${noticias.length} noticias migradas`);
}

async function migrateProductos() {
  const productos = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'productos.json'), 'utf8'));

  for (const p of productos) {
    const stripeLink = p.stripeLink && !p.stripeLink.startsWith('YOUR_') ? p.stripeLink : null;
    await pool.query(
      `INSERT INTO productos (id, nombre, descripcion, precio, imagen, imagen_alt, stripe_link, disponible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         descripcion = EXCLUDED.descripcion,
         precio = EXCLUDED.precio,
         imagen = EXCLUDED.imagen,
         imagen_alt = EXCLUDED.imagen_alt,
         stripe_link = EXCLUDED.stripe_link,
         disponible = EXCLUDED.disponible`,
      [p.id, p.nombre, p.descripcion, p.precio, p.imagen, p.imagenAlt, stripeLink, p.disponible]
    );
  }
  console.log(`  ✓ ${productos.length} productos migrados`);
}

async function main() {
  console.log('Migrando contenido de _content/*.json hacia la base de datos...');
  await migrateNoticias();
  await migrateProductos();
  await pool.end();
  console.log('Migracion completa.');
}

main().catch((err) => {
  console.error('Error migrando contenido:', err.message);
  process.exit(1);
});
