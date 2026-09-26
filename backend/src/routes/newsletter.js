const express = require('express');
const { enviarError500 } = require('../util/errores');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/newsletter/subscribe -- publica, sin sesion (cualquiera puede
// suscribirse, igual que antes con Mailchimp). La llave de Beehiiv vive
// solo aqui, en el servidor -- nunca llega al navegador.
router.post('/subscribe', async (req, res) => {
  const email = (req.body?.email || '').trim();
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ ok: false, error: 'Correo electrónico no válido.' });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID;
  if (!apiKey || !publicationId) {
    return res.status(503).json({ ok: false, error: 'El boletín todavía no está configurado.' });
  }

  try {
    const beehiivRes = await fetch(
      `https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          reactivate_existing: false,
          send_welcome_email: true,
          utm_source: 'sabiasquepr.com',
        }),
      }
    );
    const data = await beehiivRes.json().catch(() => ({}));

    if (!beehiivRes.ok) {
      // Beehiiv devuelve un 400 claro (ej. "ya esta suscrito") -- se le
      // pasa el mensaje al usuario tal cual cuando es un error suyo, no
      // uno interno.
      const msg = data?.errors?.[0]?.message || data?.message || 'No se pudo completar la suscripción.';
      return res.status(400).json({ ok: false, error: msg });
    }

    res.json({ ok: true });
  } catch (err) {
    enviarError500(res, err);
  }
});

module.exports = router;
