/**
 * main.js
 * App entry point:
 *  - Fetches products.json and renders product cards on home & products pages
 *  - Wires up add-to-cart flows, size selection, quick-add
 *  - Newsletter form handling
 */

(function () {
  'use strict';

  // ── Load products ─────────────────────────────────────────────────────────
  let productsCache = null;

  async function fetchProducts() {
    if (productsCache) return productsCache;
    try {
      const res = await fetch('/products.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      productsCache = await res.json();
      return productsCache;
    } catch (err) {
      console.error('Failed to load products.json:', err);
      return [];
    }
  }

  // ── Render home page featured grid ────────────────────────────────────────
  async function renderFeaturedGrid() {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;

    const products = await fetchProducts();
    if (!products.length) return;

    // Show first 4 products as featured
    const featured = products.slice(0, 4);
    grid.innerHTML = featured.map(productCardHTML).join('');
    bindProductCards(grid);
  }

  // ── Render full products page grid ────────────────────────────────────────
  async function renderProductsGrid() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    const products = await fetchProducts();
    if (!products.length) {
      grid.innerHTML = '<p style="color:var(--c-text-muted)">No products found.</p>';
      return;
    }

    renderFilteredGrid(products, grid);
    initCategoryFilter(products, grid);
  }

  function renderFilteredGrid(products, grid) {
    grid.innerHTML = products.map(productCardHTML).join('');
    bindProductCards(grid);

    // Trigger reveal animations for newly rendered cards
    if (window.IntersectionObserver) {
      grid.querySelectorAll('.product-card').forEach((card, i) => {
        card.style.transitionDelay = `${i * 60}ms`;
        card.classList.add('is-visible');
      });
    }
  }

  function initCategoryFilter(products, grid) {
    const filterBtns = document.querySelectorAll('[data-filter]');
    if (!filterBtns.length) return;

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const category = btn.dataset.filter;
        const filtered = category === 'all'
          ? products
          : products.filter((p) => p.category === category);

        renderFilteredGrid(filtered, grid);
      });
    });

    // Handle URL query param ?category=tops on load
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    if (cat) {
      const matchingBtn = document.querySelector(`[data-filter="${CSS.escape(cat)}"]`);
      matchingBtn && matchingBtn.click();
    }
  }

  // ── Product card HTML ─────────────────────────────────────────────────────
  function productCardHTML(product) {
    const img1 = product.images[0] || 'images/placeholder.webp';
    const img2 = product.images[1] || img1;
    const price = formatPrice(product.price);

    return `
      <article class="product-card" data-product-id="${escapeAttr(product.id)}">
        <div class="product-card__img-wrap">
          <img
            class="product-card__img product-card__img--primary"
            src="${escapeAttr(img1)}"
            alt="${escapeAttr(product.name)}"
            loading="lazy"
            width="600"
            height="800"
            onerror="this.src='images/placeholder.webp'"
          />
          <img
            class="product-card__img product-card__img--alt"
            src="${escapeAttr(img2)}"
            alt="${escapeAttr(product.name)} — alternate view"
            loading="lazy"
            width="600"
            height="800"
            aria-hidden="true"
            onerror="this.src='images/placeholder.webp'"
          />
          <button
            class="product-card__quick-add"
            data-quick-add="${escapeAttr(product.id)}"
            aria-label="Quick add ${escapeAttr(product.name)} to bag"
          >
            + Quick Add
          </button>
        </div>
        <div class="product-card__body">
          <p class="product-card__category">${escapeHTML(product.category)}</p>
          <h3 class="product-card__name">
            <a href="products.html?id=${escapeAttr(product.id)}">${escapeHTML(product.name)}</a>
          </h3>
          <p class="product-card__price">${price}</p>
        </div>
      </article>
    `;
  }

  // ── Bind product card interactions ────────────────────────────────────────
  function bindProductCards(container) {
    // Quick-add buttons → open a size picker then add to cart
    container.querySelectorAll('[data-quick-add]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const productId = btn.dataset.quickAdd;
        const products  = await fetchProducts();
        const product   = products.find((p) => p.id === productId);
        if (!product) return;

        // If only one size, add directly; otherwise prompt
        if (product.sizes.length === 1) {
          window.NC.cart.addToCart(product, product.sizes[0]);
        } else {
          openSizePicker(product);
        }
      });
    });

    // Card click → product detail (on products.html handled via URL)
    container.querySelectorAll('.product-card__name a').forEach((link) => {
      // Already an <a> with correct href — no extra JS needed
    });
  }

  // ── Size picker modal (lightweight inline) ────────────────────────────────
  function openSizePicker(product) {
    // Remove existing picker if any
    document.getElementById('size-picker-modal')?.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'size-picker-modal';
    Object.assign(backdrop.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '300',
      background: 'rgba(28,28,28,0.45)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    });
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', `Select size for ${product.name}`);

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: 'var(--c-off-white)',
      width: '100%',
      maxWidth: '480px',
      padding: '2rem',
      borderRadius: '6px 6px 0 0',
      animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
    });

    panel.innerHTML = `
      <style>@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}</style>
      <p style="font-family:var(--font-serif);font-size:1.25rem;font-weight:300;margin-bottom:0.5rem">${escapeHTML(product.name)}</p>
      <p style="font-size:0.875rem;color:var(--c-text-muted);margin-bottom:1.5rem">Select a size:</p>
      <div class="size-selector" role="group" aria-label="Available sizes" style="margin-bottom:1.5rem">
        ${product.sizes.map((s) => `
          <button class="size-btn" data-size="${escapeAttr(s)}" aria-pressed="false">${escapeHTML(s)}</button>
        `).join('')}
      </div>
      <button
        id="size-picker-confirm"
        class="btn btn--dark"
        style="width:100%;justify-content:center;opacity:0.4;pointer-events:none"
        disabled
        aria-disabled="true"
      >Add to Bag</button>
    `;

    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    // Size selection
    let selectedSize = null;
    const confirmBtn = panel.querySelector('#size-picker-confirm');

    panel.querySelectorAll('.size-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.size-btn').forEach((b) => {
          b.classList.remove('selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-pressed', 'true');
        selectedSize = btn.dataset.size;
        confirmBtn.disabled = false;
        confirmBtn.setAttribute('aria-disabled', 'false');
        confirmBtn.style.opacity = '1';
        confirmBtn.style.pointerEvents = '';
      });
    });

    confirmBtn.addEventListener('click', () => {
      if (selectedSize) {
        window.NC.cart.addToCart(product, selectedSize);
        closeSizePicker();
      }
    });

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeSizePicker();
    });

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === 'Escape') { closeSizePicker(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);

    // Focus first size button
    setTimeout(() => panel.querySelector('.size-btn')?.focus(), 50);
  }

  function closeSizePicker() {
    document.getElementById('size-picker-modal')?.remove();
  }

  // ── Newsletter form ───────────────────────────────────────────────────────
  function initNewsletterForm() {
    const forms = document.querySelectorAll('.newsletter__form');
    forms.forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = form.querySelector('[type="email"]');
        const email = emailInput ? emailInput.value.trim() : '';

        if (!email) return;

        // TODO: Connect to your email service (Mailchimp, ConvertKit, etc.)
        // For now, show a thank-you message
        form.innerHTML = `
          <p style="font-family:var(--font-serif);font-size:1.125rem;font-weight:300;color:var(--c-text);text-align:center;padding:1rem 0">
            Thank you — we'll be in touch.
          </p>
        `;
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatPrice(dollars) {
    return `$${Number(dollars).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  }

  function escapeHTML(str) {
    const el = document.createElement('div');
    el.textContent = String(str);
    return el.innerHTML;
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    await renderFeaturedGrid();   // home page
    await renderProductsGrid();   // products page
    initNewsletterForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
