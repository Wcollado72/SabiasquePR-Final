const express = require('express');
const { pool } = require('../db');
const { enviarError500 } = require('../util/errores');
const { stripe } = require('../lib/stripe');

const router = express.Router();

// POST /api/stripe/webhook -- llamado por Stripe (sin sesion de usuario).
// Debe montarse ANTES de express.json() en app.js: Stripe firma el body
// crudo, no el JSON ya parseado.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ ok: false, error: `Firma de webhook invalida: ${err.message}` });
  }

  try {
    switch (event.type) {
      // checkout.session.completed cubre pagos sincronos (tarjeta); algunos
      // metodos de pago son asincronos y solo confirman el pago mas tarde via
      // checkout.session.async_payment_succeeded -- ambos se manejan igual,
      // condicionados a que el pago ya este confirmado (payment_status).
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.client_reference_id && session.payment_status === 'paid') {
          await pool.query(
            `UPDATE perfiles
             SET stripe_customer_id = $1, stripe_subscription_id = $2,
                 rol = CASE WHEN rol = 'admin' THEN rol ELSE 'premium' END
             WHERE id = $3`,
            [session.customer, session.subscription, session.client_reference_id]
          );
        }
        if (session.mode === 'payment' && session.client_reference_id && session.payment_status === 'paid') {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
          const items = lineItems.data.map((li) => ({
            nombre: li.description,
            cantidad: li.quantity,
            total: li.amount_total / 100,
          }));
          const envio = session.collected_information?.shipping_details;
          const facturacion = session.customer_details?.address;
          await pool.query(
            `INSERT INTO ordenes (usuario_id, items, total, stripe_session_id, estado, envio_nombre, envio_direccion, facturacion_direccion)
             VALUES ($1, $2, $3, $4, 'pagada', $5, $6, $7)
             ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING`,
            [
              session.client_reference_id, JSON.stringify(items), session.amount_total / 100, session.id,
              envio?.name || null,
              envio?.address ? JSON.stringify(envio.address) : null,
              facturacion ? JSON.stringify(facturacion) : null,
            ]
          );
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const active = sub.status === 'active' || sub.status === 'trialing';
        await pool.query(
          `UPDATE perfiles
           SET stripe_subscription_id = $2,
               rol = CASE WHEN rol = 'admin' THEN rol WHEN $3 THEN 'premium' ELSE 'usuario' END
           WHERE stripe_customer_id = $1`,
          [sub.customer, sub.id, active]
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await pool.query(
          `UPDATE perfiles SET rol = CASE WHEN rol = 'admin' THEN rol ELSE 'usuario' END
           WHERE stripe_customer_id = $1`,
          [sub.customer]
        );
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    enviarError500(res, err);
  }
});

module.exports = router;
