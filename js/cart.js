/**
 * cart.js
 * Client-side cart stored in localStorage.
 * Manages: add, update quantity, remove, render cart drawer, subtotal.
 * Communicates with stripe-checkout.js for the checkout flow.
 */

(function () {
  'use strict';

  const CART_KEY = 'nc_cart_v1';

  // ── State ──────────────────────────────────────────────────────────────────
  let cart = loadCart();

  // ── Persistence ───────────────────────────────────────────────────────────
  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {
      console.warn('Cart: localStorage unavailable', e);
    }
  }

  // ── Cart operations ────────────────────────────────────────────────────────

  /**
   * Add a product to cart or increment qty if same id+size combo exists.
   * @param {Object} product  - from products.json
   * @param {string} size     - selected size
   * @param {number} qty      - quantity to add (default 1)
   */
  function addToCart(product, size, qty = 1) {
    const key = `${product.id}__${size}`;
    const existing = cart.find((item) => item.key === key);

    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({
        key,
        id:       product.id,
        name:     product.name,
        price:    product.price,
        image:    product.images[0] || '',
        size,
        qty,
      });
    }

    saveCart();
    updateCartUI();
    bumpCartCount();
    openCart();
  }

  /**
   * Set the quantity of an item. Removes if qty <= 0.
   */
  function setQty(key, qty) {
    if (qty <= 0) {
      removeItem(key);
      return;
    }
    const item = cart.find((i) => i.key === key);
    if (item) {
      item.qty = qty;
      saveCart();
      updateCartUI();
    }
  }

  /**
   * Remove an item from cart entirely.
   */
  function removeItem(key) {
    cart = cart.filter((i) => i.key !== key);
    saveCart();
    updateCartUI();
  }

  /**
   * Total item count (sum of qty across all lines).
   */
  function totalQty() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  /**
   * Subtotal in dollars.
   */
  function subtotal() {
    return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  // ── UI rendering ──────────────────────────────────────────────────────────

  function updateCartUI() {
    renderCartDrawer();
    updateCartCount();
    updateSubtotalDisplay();
  }

  function updateCartCount() {
    const countEl = document.getElementById('cart-count');
    if (!countEl) return;

    const qty = totalQty();
    countEl.textContent = qty;

    // Update accessible label on the cart button
    const cartToggle = document.getElementById('cart-toggle');
    if (cartToggle) {
      cartToggle.setAttribute('aria-label', `Open cart, ${qty} item${qty !== 1 ? 's' : ''}`);
    }
  }

  function updateSubtotalDisplay() {
    const subtotalEl = document.getElementById('cart-subtotal');
    const footerEl   = document.getElementById('cart-footer');
    if (!subtotalEl || !footerEl) return;

    subtotalEl.textContent = formatPrice(subtotal());
    footerEl.style.display = cart.length ? '' : 'none';
  }

  function renderCartDrawer() {
    const body = document.getElementById('cart-body');
    if (!body) return;

    if (!cart.length) {
      body.innerHTML = `
        <div class="cart-empty" role="status" aria-live="polite">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true" style="opacity:0.3">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
          <p style="font-family:var(--font-serif);font-size:1.125rem;font-weight:300;color:var(--c-text-muted);">Your bag is empty</p>
          <p>Add a piece from the collection to get started.</p>
          <a href="products.html" class="btn btn--outline" onclick="closeCart()">Shop the Collection</a>
        </div>
      `;
      return;
    }

    const itemsHTML = cart.map((item) => `
      <article class="cart-item" aria-label="${item.name}, size ${item.size}">
        <img
          class="cart-item__img"
          src="${escapeAttr(item.image)}"
          alt="${escapeAttr(item.name)}"
          loading="lazy"
          width="80"
          height="100"
          onerror="this.src='images/placeholder.webp'"
        />
        <div class="cart-item__info">
          <p class="cart-item__name">${escapeHTML(item.name)}</p>
          <p class="cart-item__size">Size: ${escapeHTML(item.size)}</p>
          <div class="cart-item__qty" role="group" aria-label="Quantity for ${escapeAttr(item.name)}">
            <button
              class="cart-item__qty-btn"
              aria-label="Decrease quantity"
              onclick="NC.cart.setQty('${escapeAttr(item.key)}', ${item.qty - 1})"
            >−</button>
            <span class="cart-item__qty-val" aria-live="polite">${item.qty}</span>
            <button
              class="cart-item__qty-btn"
              aria-label="Increase quantity"
              onclick="NC.cart.setQty('${escapeAttr(item.key)}', ${item.qty + 1})"
            >+</button>
          </div>
          <button
            class="cart-item__remove"
            aria-label="Remove ${escapeAttr(item.name)} from cart"
            onclick="NC.cart.removeItem('${escapeAttr(item.key)}')"
          >Remove</button>
        </div>
        <p class="cart-item__price">${formatPrice(item.price * item.qty)}</p>
      </article>
    `).join('');

    body.innerHTML = itemsHTML;
  }

  // ── Cart drawer open/close ────────────────────────────────────────────────

  function openCart() {
    const drawer  = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    const toggle  = document.getElementById('cart-toggle');
    if (!drawer) return;

    drawer.classList.add('open');
    overlay.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
    toggle && toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';

    // Focus first focusable element in drawer
    setTimeout(() => {
      const firstFocusable = drawer.querySelector('button, [href], input');
      firstFocusable && firstFocusable.focus();
    }, 350);
  }

  function closeCart() {
    const drawer  = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    const toggle  = document.getElementById('cart-toggle');
    if (!drawer) return;

    drawer.classList.remove('open');
    overlay.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    toggle && toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    toggle && toggle.focus();
  }

  // ── Cart count bump animation ─────────────────────────────────────────────
  function bumpCartCount() {
    const countEl = document.getElementById('cart-count');
    if (!countEl) return;
    countEl.classList.remove('bump');
    // Force reflow to restart animation
    void countEl.offsetWidth;
    countEl.classList.add('bump');
    countEl.addEventListener('transitionend', () => countEl.classList.remove('bump'), { once: true });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatPrice(cents) {
    // price is in dollars in products.json
    return `$${cents.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  function escapeHTML(str) {
    const el = document.createElement('div');
    el.textContent = str;
    return el.innerHTML;
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── DOM event bindings ────────────────────────────────────────────────────
  function bindEvents() {
    // Cart toggle button
    const cartToggle = document.getElementById('cart-toggle');
    if (cartToggle) {
      cartToggle.addEventListener('click', openCart);
    }

    // Close button inside drawer
    const closeBtn = document.getElementById('cart-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeCart);
    }

    // Overlay click to close
    const overlay = document.getElementById('cart-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeCart);
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const drawer = document.getElementById('cart-drawer');
        if (drawer && drawer.classList.contains('open')) {
          closeCart();
        }
      }
    });

    // Checkout button → delegate to stripe-checkout.js
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => {
        if (window.NC && window.NC.checkout) {
          window.NC.checkout.startCheckout(cart);
        } else {
          console.warn('Stripe checkout module not loaded.');
        }
      });
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    bindEvents();
    updateCartUI();
  }

  // ── Public API via window.NC.cart ─────────────────────────────────────────
  window.NC = window.NC || {};
  window.NC.cart = {
    addToCart,
    setQty,
    removeItem,
    getCart: () => [...cart],
    openCart,
    closeCart,
  };

  // Also expose closeCart globally for inline onclick in rendered HTML
  window.closeCart = closeCart;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
