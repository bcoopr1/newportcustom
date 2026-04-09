/**
 * stripe-checkout.js
 * Creates a Stripe Checkout Session via the serverless API route,
 * then redirects to Stripe's hosted checkout page.
 *
 * Serverless function: /api/create-checkout-session.js
 * Deploy target: Cloudflare Pages Functions or Vercel Serverless Functions
 */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────────────────
  // Update this endpoint if your deployment path differs
  const CHECKOUT_API = '/api/create-checkout-session';

  // ── Start Stripe Checkout ─────────────────────────────────────────────────
  /**
   * @param {Array} cartItems  - NC.cart.getCart() result
   */
  async function startCheckout(cartItems) {
    if (!cartItems || !cartItems.length) {
      alert('Your bag is empty.');
      return;
    }

    const checkoutBtn = document.getElementById('checkout-btn');

    // Update button state
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.textContent = 'Redirecting…';
    }

    try {
      const response = await fetch(CHECKOUT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            id:    item.id,
            name:  item.name,
            price: item.price,   // dollars — serverless converts to cents
            size:  item.size,
            qty:   item.qty,
            image: item.image,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const { url } = await response.json();

      if (!url) throw new Error('No checkout URL returned from server.');

      // Redirect to Stripe Checkout
      window.location.href = url;

    } catch (err) {
      console.error('Checkout error:', err);
      alert(`Unable to start checkout: ${err.message}\n\nPlease try again or contact us.`);

      // Restore button
      if (checkoutBtn) {
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = `Checkout
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>`;
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.NC = window.NC || {};
  window.NC.checkout = { startCheckout };
})();
