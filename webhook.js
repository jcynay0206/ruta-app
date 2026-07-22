// api/webhook.js
// Recibe eventos de Stripe (pago exitoso, cancelación, etc.) y actualiza
// el plan real de la agencia en Supabase. Stripe llama esta URL sola,
// nadie la visita manualmente.
//
// Variables de entorno adicionales necesarias:
//   STRIPE_WEBHOOK_SECRET          whsec_... (te lo da Stripe al crear el webhook)
//   SUPABASE_SERVICE_ROLE_KEY      la clave secreta de Supabase (Settings → API)
//                                   — NUNCA la uses en el código del navegador,
//                                   solo aquí, en el servidor.
//   SUPABASE_URL                   https://zvuoxvvauxfluhimylfz.supabase.co

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Stripe necesita el cuerpo "crudo" de la petición para verificar la firma
export const config = { api: { bodyParser: false } };

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await buffer(req);
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Firma de webhook inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { agency_id, plan } = session.metadata;
        await supabase.from('agencies').update({ plan }).eq('id', agency_id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const agencyId = sub.metadata?.agency_id;
        if (agencyId) {
          await supabase.from('agencies').update({ plan: 'prueba' }).eq('id', agencyId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        // Aquí podrías marcar la agencia como "en riesgo" o notificarte
        console.log('Pago fallido:', event.data.object.customer_email);
        break;
      }

      default:
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error procesando webhook:', err);
    res.status(500).json({ error: err.message });
  }
}
