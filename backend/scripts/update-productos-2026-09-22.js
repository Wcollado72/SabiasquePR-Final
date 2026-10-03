// ============================================================
// update-productos-2026-09-22.js — Sabías que PR · Fotos y textos
// de producto actualizados (Gemini/Nano Banana) + producto nuevo Bolso.
// Uso: node scripts/update-productos-2026-09-22.js
// ============================================================
require('dotenv').config({ quiet: true });
const { pool } = require('../src/db');

const updates = [
  ['taza-nuevos-humanos', {
    imagen: 'images/taza-nuevos-humanos.webp',
    imagen_alt: 'Taza blanca con el logo de Nuevos Humanos, una silueta humana con circuitos y hojas',
    descripcion: 'Taza de cerámica blanca con el emblema de Nuevos Humanos: una silueta con circuitos y hojas, símbolo de tecnología al servicio de la vida. Ideal para el café de la mañana mientras lees las noticias.',
  }],
  ['camiseta-coqui', {
    imagen: 'images/camiseta-coqui-boriken.webp',
    imagen_alt: 'Camiseta azul marino con un coquí de circuitos sobre la silueta de Puerto Rico y la palabra Borikén',
    descripcion: 'Camiseta azul marino con el coquí de circuitos y la palabra Borikén sobre la silueta de Puerto Rico. Unisex, para llevar el mensaje del proyecto a donde vayas.',
  }],
  ['gorra-curiosidades', {
    nombre: 'Gorra "Sol Taíno"',
    imagen: 'images/gorra-sol-taino.webp',
    imagen_alt: 'Gorra azul marino bordada con el sol taíno en rojo y blanco',
    descripcion: 'Gorra ajustable bordada con el sol taíno, símbolo de identidad boricua, en rojo y blanco sobre azul marino.',
  }],
  ['polo-noticias', {
    descripcion: 'Polo con el globo terráqueo y la bandera de Puerto Rico en el centro, conectada por líneas a distintos continentes — para quienes siguen las noticias internacionales del proyecto.',
  }],
  ['libreta-educacion', {
    imagen: 'images/libreta-pr.webp',
    imagen_alt: 'Libreta azul marino con montañas y una planta de café grabadas, y cinta elástica roja',
    descripcion: 'Libreta de tapa dura con la cordillera y los cafetales de Puerto Rico grabados en relieve. Ideal para tus apuntes, investigaciones y proyectos.',
  }],
  ['sticker-pack', {
    nombre: 'Sticker Pack "Cultura Boricua"',
    imagen: 'images/stickers-cultura-boricua.webp',
    imagen_alt: 'Hoja de stickers con una cotorra, coquíes, un vejigante, un cuatro, un güiro y una conga',
    descripcion: 'Siete stickers con símbolos de Puerto Rico: la cotorra puertorriqueña, el coquí, un vejigante, el cuatro, el güiro y la conga.',
  }],
];

async function main() {
  for (const [id, fields] of updates) {
    const cols = Object.keys(fields);
    const set = cols.map((c, i) => `${c}=$${i + 2}`).join(', ');
    const vals = [id, ...cols.map((c) => fields[c])];
    const r = await pool.query(`UPDATE productos SET ${set} WHERE id=$1 RETURNING id, nombre`, vals);
    console.log('✓', r.rows[0]?.id, '-', r.rows[0]?.nombre);
  }

  const bolso = await pool.query(
    `INSERT INTO productos (id, nombre, descripcion, precio, imagen, imagen_alt, stripe_link, disponible)
     VALUES ($1,$2,$3,$4,$5,$6,NULL,true)
     ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, descripcion=EXCLUDED.descripcion,
       precio=EXCLUDED.precio, imagen=EXCLUDED.imagen, imagen_alt=EXCLUDED.imagen_alt
     RETURNING id, nombre, precio`,
    ['bolso-puerta-san-juan', 'Bolso "Puerta de San Juan"',
      'Bolso de tela natural con la garita de la Puerta de San Juan ilustrada a línea, sobre el adoquinado del Viejo San Juan. Resistente y reutilizable, para el día a día.',
      18.00, 'images/bolso-puerta-san-juan.webp',
      'Bolso de tela color crudo con la garita de la Puerta de San Juan y el sol, ilustrados a línea azul marino']
  );
  console.log('✓ NUEVO', bolso.rows[0]);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
