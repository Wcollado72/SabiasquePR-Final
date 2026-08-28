require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { requireAuth } = require('./middleware/auth');
const foroRoutes = require('./routes/foro');
const noticiasRoutes = require('./routes/noticias');
const productosRoutes = require('./routes/productos');

const app = express();

const allowedOrigins = (process.env.FRONTEND_ORIGIN ||
  'http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origen no permitido por CORS.'));
  },
}));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS hora_servidor');
    res.json({ ok: true, hora_servidor: result.rows[0].hora_servidor });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Identidad del usuario autenticado (id, email, rol) -- usado por el panel de administración.
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.use('/api/foro', foroRoutes);
app.use('/api/noticias', noticiasRoutes);
app.use('/api/productos', productosRoutes);

// Manejador de errores (CORS rechazado, JSON malformado, etc.)
app.use((err, _req, res, _next) => {
  const status = err.message && err.message.includes('CORS') ? 403 : 400;
  res.status(status).json({ ok: false, error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API de Sabias que PR escuchando en http://localhost:${PORT}`);
});
