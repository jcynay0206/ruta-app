// api/create-checkout-session.js
// Función serverless de Vercel — crea el link de pago de Stripe para
// que una agencia suba de plan (setup fee + mensualidad).
//
// Variables de entorno necesarias en Vercel (Settings → Environment Variables):
//   STRIPE_SECRET_KEY            sk_test_... (o sk_live_... en producción)
//   PRICE_STARTER_SETUP          price_...
//   PRICE_STARTER_MONTHLY        price_...
//   PRICE_PRO_SETUP               price_...
//   PRICE_PRO_MONTHLY             price_...
//   PRICE_ELITE_SETUP             price_...
//   PRICE_ELITE_MONTHLY           price_...
//   APP_URL                       https://ruta-app-opal.vercel.app

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_PRICES = {
  starter: { setup: process.env.PRICE_STARTER_SETUP, monthly: process.env.PRICE_STARTER_MONTHLY },
  pro: { setup: process.env.PRICE_PRO_SETUP, monthly: process.env.PRICE_PRO_MONTHLY },
  elite: { setup: process.env.PRICE_ELITE_SETUP, monthly: process.env.PRICE_ELITE_MONTHLY },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { plan, agencyId, agencyEmail } = req.body || {};

  if (!plan || !agencyId || !PLAN_PRICES[plan]) {
    return res.status(400).json({ error: 'Plan o agencia inválidos' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: agencyEmail,
      line_items: [
        { price: PLAN_PRICES[plan].setup, quantity: 1 },
        { price: PLAN_PRICES[plan].monthly, quantity: 1 },
      ],
      // Guardamos aquí qué agencia y qué plan es esto — lo leemos de
      // vuelta en el webhook cuando el pago se confirme
      metadata: { agency_id: agencyId, plan },
      subscription_data: {
        metadata: { agency_id: agencyId, plan },
      },
      success_url: `${process.env.APP_URL}/admin.html?pago=exitoso`,
      cancel_url: `${process.env.APP_URL}/admin.html?pago=cancelado`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Error creando sesión de Stripe:', err);
    res.status(500).json({ error: err.message });
  }
}
