const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { stripe } = require('../lib/stripe');

const router = express.Router();

// POST /api/stripe/create-checkout-session -- requiere sesion
router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    if (!priceId) return res.status(500).json({ ok: false, error: 'Suscripcion premium no configurada.' });

    const frontendOrigin = (process.env.FRONTEND_ORIGIN || 'http://localhost:5500')
      .split(',')[0].trim();

    const { rows } = await pool.query('SELECT stripe_customer_id FROM perfiles WHERE id = $1', [req.user.id]);
    const existingCustomerId = rows[0]?.stripe_customer_id || null;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: req.user.id,
      ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: req.user.email }),
      success_url: `${frontendOrigin}/premium.html?success=1`,
      cancel_url: `${frontendOrigin}/premium.html?canceled=1`,
    });

    res.json({ ok: true, url: session.url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
