/**
 * api/create-checkout-session.js
 * Serverless function — creates a Stripe Checkout Session.
 *
 * Compatible with:
 *   - Cloudflare Pages Functions  (export default { async fetch(request, env) })
 *   - Vercel Serverless Functions  (export default async function handler(req, res))
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY   — your Stripe secret key (sk_live_... or sk_test_...)
 *
 * ── Cloudflare Pages setup ────────────────────────────────────────────────
 * Place this file at:  /functions/api/create-checkout-session.js
 * (Cloudflare Pages Functions maps /functions/** → /<path>)
 *
 * Set environment variables in:
 *   Cloudflare Dashboard → Pages → Project → Settings → Environment variables
 *
 * ── Vercel setup ──────────────────────────────────────────────────────────
 * Place this file at:  /api/create-checkout-session.js  (already done)
 * Set environment variables via: vercel env add STRIPE_SECRET_KEY
 * ─────────────────────────────────────────────────────────────────────────
 */

// ── Shared logic ──────────────────────────────────────────────────────────────

/**
 * Build Stripe line_items from the cart payload.
 * Prices are stored as whole dollars in products.json; Stripe expects cents.
 */
function buildLineItems(items) {
  return items.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.size ? `${item.name} — Size ${item.size}` : item.name,
        // Stripe accepts up to 8 image URLs; use the first product image
        images: item.image
          ? [`https://newportcustom.com/${item.image}`]
          : [],
      },
      // Stripe expects price in smallest currency unit (cents)
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.qty,
  }));
}

/** Parse and validate the incoming cart body. */
async function parseBody(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new Error('Invalid JSON body');
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cart is empty');
  }

  // Basic validation of each line item
  for (const item of items) {
    if (!item.name || typeof item.price !== 'number' || typeof item.qty !== 'number') {
      throw new Error(`Invalid item: ${JSON.stringify(item)}`);
    }
    if (item.qty < 1 || item.qty > 99) {
      throw new Error(`Invalid quantity for ${item.name}`);
    }
    if (item.price < 0.01 || item.price > 100000) {
      throw new Error(`Invalid price for ${item.name}`);
    }
  }

  return items;
}

/** Call the Stripe API to create a Checkout Session. */
async function createStripeSession(secretKey, lineItems) {
  const params = new URLSearchParams({
    mode:                          'payment',
    'payment_method_types[]':      'card',
    'shipping_address_collection[allowed_countries][]': 'US',
    success_url:                   'https://newportcustom.com/success.html?session_id={CHECKOUT_SESSION_ID}',
    cancel_url:                    'https://newportcustom.com/cancel.html',
    'billing_address_collection':  'auto',
    'submit_type':                 'pay',
  });

  // Append line items to form body (Stripe uses form encoding for the API)
  lineItems.forEach((item, i) => {
    params.append(`line_items[${i}][price_data][currency]`,                               item.price_data.currency);
    params.append(`line_items[${i}][price_data][unit_amount]`,                            item.price_data.unit_amount);
    params.append(`line_items[${i}][price_data][product_data][name]`,                     item.price_data.product_data.name);
    if (item.price_data.product_data.images[0]) {
      params.append(`line_items[${i}][price_data][product_data][images][0]`,              item.price_data.product_data.images[0]);
    }
    params.append(`line_items[${i}][quantity]`,                                           item.quantity);
  });

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await response.json();

  if (!response.ok) {
    throw new Error(session.error?.message || `Stripe error ${response.status}`);
  }

  return session;
}

/** CORS + JSON response helpers */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  'https://newportcustom.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// ── Cloudflare Pages Functions handler ───────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;
  const secretKey = env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return errorResponse('Stripe secret key not configured', 500);
  }

  try {
    const items      = await parseBody(request);
    const lineItems  = buildLineItems(items);
    const session    = await createStripeSession(secretKey, lineItems);
    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session]', err.message);
    return errorResponse(err.message, 400);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ── Vercel Serverless Function handler ───────────────────────────────────────
// Uncomment the block below if deploying to Vercel instead of Cloudflare Pages.
//
// import Stripe from 'stripe';
//
// export default async function handler(req, res) {
//   if (req.method === 'OPTIONS') {
//     res.setHeader('Access-Control-Allow-Origin',  'https://newportcustom.com');
//     res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
//     res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
//     return res.status(204).end();
//   }
//
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }
//
//   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
//
//   try {
//     const { items } = req.body;
//     const session = await stripe.checkout.sessions.create({
//       mode: 'payment',
//       payment_method_types: ['card'],
//       line_items: buildLineItems(items),
//       shipping_address_collection: { allowed_countries: ['US'] },
//       success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
//       cancel_url:  `${req.headers.origin}/cancel.html`,
//       billing_address_collection: 'auto',
//     });
//     res.json({ url: session.url });
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// }
