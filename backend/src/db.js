const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Antes esto era { rejectUnauthorized: false } -- cifraba la conexion pero
// no verificaba que el servidor fuera realmente Supabase (ventana teorica a
// un ataque de intermediario). Ahora se fija la autoridad certificadora real
// de Supabase (descargada desde Settings -> Database -> SSL Configuration
// -> Download certificate, es un archivo publico, no un secreto) y SI se
// verifica el certificado contra ella. Probado 2026-09-26 contra la base
// real: sin esto, rejectUnauthorized:true a secas falla con "self-signed
// certificate in certificate chain"; con el CA de Supabase, conecta bien.
const supabaseCa = fs.readFileSync(path.join(__dirname, '../certs/supabase-ca.crt'), 'utf8');

// Sin estos limites, una conexion mala (contrasena/red/lo que sea) se queda
// esperando para siempre en vez de fallar rapido -- y como render.yaml usa
// /api/health (que consulta la BD) como healthCheckPath, un despliegue puede
// quedarse "colgado" muchos minutos en vez de fallar en segundos con un
// error visible en los logs.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: supabaseCa, rejectUnauthorized: true },
  connectionTimeoutMillis: 8000,
  query_timeout: 8000,
  statement_timeout: 8000,
});

// pg emite 'error' en el pool cuando un cliente inactivo pierde la conexion
// (contrasena mala, red, la BD la cierra, etc.). Sin este listener, Node lo
// trata como una excepcion no capturada y TUMBA TODO EL PROCESO -- eso puede
// verse desde Render como un deploy que "nunca arranca" cuando en realidad
// el servidor arranca, se cae, se reinicia, se vuelve a caer. Con el
// listener, el error solo se registra y el proceso sigue vivo (las rutas ya
// manejan el error de cada query individualmente).
pool.on('error', (err) => {
  console.error('Error inesperado en un cliente inactivo del pool de Postgres:', err);
});

module.exports = { pool };
