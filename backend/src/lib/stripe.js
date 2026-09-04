const Stripe = require('stripe');

// El SDK v22+ exige una apiKey no vacia al construir el cliente (lanza en
// el require si falta). Usamos un placeholder cuando no esta configurada
// (dev local sin Stripe, o pruebas que no mockean este modulo) para que
// importar el modulo nunca falle; solo se rompe si de verdad se llama a
// la API de Stripe sin una clave real.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-08-26.dahlia',
});

module.exports = { stripe };
