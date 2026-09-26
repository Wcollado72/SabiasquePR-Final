const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
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
    enviarError500(res, err);
  }
});

// POST /api/stripe/create-checkout-session-tienda -- requiere sesion.
// body: { items: [{ productId, qty }] }. El precio y disponibilidad se
// verifican siempre contra la base de datos -- nunca se confia en nada
// que mande el cliente aparte del id y la cantidad.
router.post('/create-checkout-session-tienda', requireAuth, async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (items.length === 0) return res.status(400).json({ ok: false, error: 'El carrito esta vacio.' });

    const ids = items.map((i) => i.productId);
    const { rows: productos } = await pool.query('SELECT * FROM productos WHERE id = ANY($1)', [ids]);

    const lineItems = [];
    for (const item of items) {
      const producto = productos.find((p) => p.id === item.productId);
      const qty = Number(item.qty) || 0;
      if (!producto || !producto.disponible) {
        return res.status(400).json({ ok: false, error: `"${item.productId}" ya no esta disponible.` });
      }
      if (!producto.stripe_price_id) {
        return res.status(400).json({ ok: false, error: `"${producto.nombre}" todavia no tiene pago configurado.` });
      }
      if (qty <= 0) {
        return res.status(400).json({ ok: false, error: `Cantidad invalida para "${producto.nombre}".` });
      }
      lineItems.push({ price: producto.stripe_price_id, quantity: qty });
    }

    const frontendOrigin = (process.env.FRONTEND_ORIGIN || 'http://localhost:5500')
      .split(',')[0].trim();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      client_reference_id: req.user.id,
      customer_email: req.user.email,
      shipping_address_collection: { allowed_countries: ['US'] }, // PR entra como parte de US
      billing_address_collection: 'required',
      success_url: `${frontendOrigin}/tienda.html?success=1`,
      cancel_url: `${frontendOrigin}/tienda.html?canceled=1`,
    });

    res.json({ ok: true, url: session.url });
  } catch (err) {
    enviarError500(res, err);
  }
});

module.exports = router;
