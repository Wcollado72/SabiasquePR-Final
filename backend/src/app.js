const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { pool } = require('./db');
const { requireAuth } = require('./middleware/auth');
const foroRoutes = require('./routes/foro');
const noticiasRoutes = require('./routes/noticias');
const contenidosRoutes = require('./routes/contenidos');
const productosRoutes = require('./routes/productos');
const stripeRoutes = require('./routes/stripe');
const stripeWebhookRoutes = require('./routes/stripeWebhook');
const adminRoutes = require('./routes/admin');
const perfilRoutes = require('./routes/perfil');
const ordenesRoutes = require('./routes/ordenes');
const comentariosRoutes = require('./routes/comentarios');
const reportesRoutes = require('./routes/reportes');
const newsletterRoutes = require('./routes/newsletter');

function buildApp() {
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

  // Debe montarse ANTES de express.json(): Stripe firma el body crudo,
  // no el JSON ya parseado.
  app.use('/api/stripe', stripeWebhookRoutes);

  app.use(express.json());

  // Prevencion de bots/abuso, gratis: limite general generoso para toda la
  // API (lectura), y uno mas estricto solo para escribir (crear/editar/
  // borrar) -- ahi es donde importa frenar spam, no en las consultas.
  // No hay formulario anonimo que pase por nuestro backend (contacto va a
  // Formspree, newsletter a Mailchimp, ambos externos) y todo lo que
  // escribe ya exige `requireAuth` con un JWT real de Supabase -- eso ya
  // filtra bots simples; el rate limit frena abuso desde una cuenta real.
  // Desactivado en pruebas (Jest fija NODE_ENV=test) -- si no, los tests de
  // integracion que hacen muchos POST/PATCH/DELETE seguidos empezarian a
  // fallar con 429 en vez de probar la logica real de cada ruta.
  if (process.env.NODE_ENV !== 'test') {
    app.use('/api', rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { ok: false, error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
    }));
    const escrituraLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method),
      message: { ok: false, error: 'Demasiadas publicaciones en poco tiempo. Espera unos minutos.' },
    });
    app.use('/api/foro', escrituraLimiter);
    app.use('/api/comentarios', escrituraLimiter);
    app.use('/api/reportes', escrituraLimiter);
    // Publica y sin sesion (cualquiera puede suscribirse, no solo cuentas
    // logueadas) -- mas expuesta a spam que las de arriba, mismo limite.
    app.use('/api/newsletter', escrituraLimiter);
  }

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
  app.use('/api/contenidos', contenidosRoutes);
  app.use('/api/productos', productosRoutes);
  app.use('/api/stripe', stripeRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/perfil', perfilRoutes);
  app.use('/api/ordenes', ordenesRoutes);
  app.use('/api/comentarios', comentariosRoutes);
  app.use('/api/reportes', reportesRoutes);
  app.use('/api/newsletter', newsletterRoutes);

  // Manejador de errores (CORS rechazado, JSON malformado, etc.)
  app.use((err, _req, res, _next) => {
    const status = err.message && err.message.includes('CORS') ? 403 : 400;
    res.status(status).json({ ok: false, error: err.message });
  });

  return app;
}

module.exports = { buildApp };
