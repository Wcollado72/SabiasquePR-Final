const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { pool } = require('./db');
const { requireAuth } = require('./middleware/auth');
const { enviarError500 } = require('./util/errores');
const foroRoutes = require('./routes/foro');
const noticiasRoutes = require('./routes/noticias');
const contenidosRoutes = require('./routes/contenidos');
const productosRoutes = require('./routes/productos');
const stripeRoutes = require('./routes/stripe');
const stripeWebhookRoutes = require('./routes/stripeWebhook');
const adminRoutes = require('./routes/admin');
const correccionRoutes = require('./routes/correccion');
const contenidoIaRoutes = require('./routes/contenidoIa');
const brigadaRoutes = require('./routes/brigada');
const semillasRoutes = require('./routes/semillas');
const perfilRoutes = require('./routes/perfil');
const ordenesRoutes = require('./routes/ordenes');
const comentariosRoutes = require('./routes/comentarios');
const reportesRoutes = require('./routes/reportes');
const newsletterRoutes = require('./routes/newsletter');
const agradecimientosRoutes = require('./routes/agradecimientos');

function buildApp() {
  const app = express();

  // Saltos de proxy delante de Express (auditoría de seguridad del proyecto, debilidad #1).
  // Sin esto, `req.ip` es siempre el proxy local de Render (::1) y TODOS los
  // visitantes comparten un solo contador del rate limit: una persona podia
  // agotar los 300 pedidos por 15 min de todos. Medido en produccion el
  // 2026-10-02: la cadena que llega a Express es
  //   socket ::1 <- balanceador interno <- borde de Cloudflare <- cliente real
  // = 3 saltos de confianza, y el cliente real queda como `req.ip`. Un
  // X-Forwarded-For falso que mande un atacante queda a la IZQUIERDA del
  // cliente real y se ignora. En local/pruebas (sin proxies) el default es 0.
  // Si Render cambia de infraestructura: TRUST_PROXY_HOPS lo ajusta sin tocar
  // codigo (cómo volver a medirlo: ver la auditoría de seguridad del proyecto).
  const hops = Number.parseInt(process.env.TRUST_PROXY_HOPS, 10);
  app.set('trust proxy', Number.isInteger(hops) && hops >= 0 ? hops : (process.env.RENDER ? 3 : 0));

  // Cabeceras de endurecimiento del API (auditoría de seguridad del proyecto, debilidad #7):
  // quita `x-powered-by: Express` (anunciaba el framework) y agrega nosniff,
  // HSTS, X-Frame-Options, etc. El API solo devuelve JSON, asi que el CSP es el
  // mas cerrado posible. `Cross-Origin-Resource-Policy: cross-origin` es
  // necesario porque el frontend (Netlify) vive en otro origen y llama a este
  // API con fetch -- el default de helmet (same-origin) estorbaria.
  app.use(helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

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
  // Express 5 deja `req.body` en `undefined` (en Express 4 era `{}`) cuando la
  // peticion no trae cuerpo JSON. Muchas rutas leen `req.body.campo` tras el
  // validador; sin esto una peticion vacia daba TypeError -> 500 en vez de un
  // 400 de validacion (probado en app.express5.test.js). El webhook de Stripe
  // se monta antes y necesita su cuerpo crudo, asi que no pasa por aqui.
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });

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
      console.error(err);
      res.status(500).json({ ok: false, error: 'Base de datos no disponible.' });
    }
  });

  // Identidad del usuario autenticado (id, email, rol) -- usado por el panel de administración.
  // `rol` es el rol REAL (para que el panel sepa que le falta el paso de MFA);
  // el poder efectivo ya lo degrada requireAuth mientras la sesion sea aal1.
  app.get('/api/me', requireAuth, (req, res) => {
    const { rolReal, mfaPendiente, ...user } = req.user;
    res.json({
      ok: true,
      user: { ...user, rol: rolReal || user.rol },
      mfaPendiente: Boolean(mfaPendiente),
      aal: req.auth?.aal ?? null,
    });
  });

  app.use('/api/foro', foroRoutes);
  app.use('/api/noticias', noticiasRoutes);
  app.use('/api/contenidos', contenidosRoutes);
  app.use('/api/productos', productosRoutes);
  app.use('/api/stripe', stripeRoutes);
  app.use('/api/admin/corregir', correccionRoutes);
  app.use('/api/admin/contenido-ia', contenidoIaRoutes);
  app.use('/api/admin/brigada', brigadaRoutes);
  app.use('/api/semillas', semillasRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/perfil', perfilRoutes);
  app.use('/api/agradecimientos', agradecimientosRoutes);
  app.use('/api/ordenes', ordenesRoutes);
  app.use('/api/comentarios', comentariosRoutes);
  app.use('/api/reportes', reportesRoutes);
  app.use('/api/newsletter', newsletterRoutes);

  // Manejador de errores. Nunca se devuelve err.message tal cual en un error
  // inesperado (auditoría de seguridad del proyecto, debilidad #9): solo los casos conocidos
  // tienen mensaje propio; el resto se registra en el log y sale generico.
  app.use((err, _req, res, _next) => {
    if (err.message && err.message.includes('CORS')) {
      return res.status(403).json({ ok: false, error: 'Origen no permitido por CORS.' });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ ok: false, error: 'El cuerpo de la peticion no es un JSON valido.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ ok: false, error: 'El cuerpo de la peticion es demasiado grande.' });
    }
    enviarError500(res, err);
  });

  return app;
}

module.exports = { buildApp };
