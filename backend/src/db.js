const { Pool } = require('pg');

// Sin estos limites, una conexion mala (contrasena/red/lo que sea) se queda
// esperando para siempre en vez de fallar rapido -- y como render.yaml usa
// /api/health (que consulta la BD) como healthCheckPath, un despliegue puede
// quedarse "colgado" muchos minutos en vez de fallar en segundos con un
// error visible en los logs.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
  query_timeout: 8000,
  statement_timeout: 8000,
});

module.exports = { pool };
