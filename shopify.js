// =============================================================================
// ONHIZM — Shopify Storefront API Integration
// =============================================================================
// TO CONFIGURE: replace the two values below after getting from Shopify Admin
// Settings → Apps and sales channels → Develop apps → [your app] → API credentials
// =============================================================================

const SHOPIFY_DOMAIN = 'p0kd5k-mn.myshopify.com';
const STOREFRONT_TOKEN = '631d6b99c6a4a8e5729a0043328cd068';

// =============================================================================
// Storefront API client
// =============================================================================

async function shopifyFetch(query, variables = {}) {
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const { data, errors } = await res.json();
  if (errors) throw new Error(errors[0].message);
  return data;
}

// =============================================================================
// Product queries
// =============================================================================

async function fetchProductByHandle(handle) {
  const data = await shopifyFetch(`
    query ProductByHandle($handle: String!) {
      product(handle: $handle) {
        id
        title
        availableForSale
        variants(first: 20) {
          edges {
            node {
              id
              title
              availableForSale
              price { amount currencyCode }
            }
          }
        }
      }
    }
  `, { handle });
  return data.product;
}

// =============================================================================
// Cart management (persisted in localStorage)
// =============================================================================

const CART_KEY = 'onhizm_cart_id';

async function getOrCreateCart() {
  const cartId = localStorage.getItem(CART_KEY);
  if (cartId) {
    try {
      const data = await shopifyFetch(`
        query Cart($id: ID!) {
          cart(id: $id) {
            id checkoutUrl
            lines(first: 50) {
              edges {
                node {
                  id quantity
                  merchandise {
                    ... on ProductVariant {
                      id title
                      product { title }
                      price { amount currencyCode }
                      image { url altText }
                    }
                  }
                }
              }
            }
          }
        }
      `, { id: cartId });
      if (data.cart) return data.cart;
    } catch (_) {}
  }
  return createCart();
}

async function createCart() {
  const data = await shopifyFetch(`
    mutation CartCreate {
      cartCreate {
        cart { id checkoutUrl lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } price { amount currencyCode } image { url altText } } } } } } }
        userErrors { field message }
      }
    }
  `);
  const cart = data.cartCreate.cart;
  localStorage.setItem(CART_KEY, cart.id);
  return cart;
}

async function addToCart(variantId, quantity = 1) {
  const cart = await getOrCreateCart();
  const data = await shopifyFetch(`
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart { id checkoutUrl lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } price { amount currencyCode } image { url altText } } } } } } }
        userErrors { field message }
      }
    }
  `, {
    cartId: cart.id,
    lines: [{ merchandiseId: variantId, quantity }],
  });
  if (data.cartLinesAdd.userErrors.length > 0) {
    throw new Error(data.cartLinesAdd.userErrors[0].message);
  }
  return data.cartLinesAdd.cart;
}

async function removeFromCart(lineId) {
  const cart = await getOrCreateCart();
  const data = await shopifyFetch(`
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart { id checkoutUrl lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } price { amount currencyCode } image { url altText } } } } } } }
      }
    }
  `, { cartId: cart.id, lineIds: [lineId] });
  return data.cartLinesRemove.cart;
}

// =============================================================================
// Cart drawer UI
// =============================================================================

function injectCartDrawer() {
  if (document.getElementById('cart-drawer')) return;

  const drawer = document.createElement('div');
  drawer.id = 'cart-drawer';
  drawer.innerHTML = `
    <div class="cart-overlay" id="cartOverlay"></div>
    <div class="cart-panel" id="cartPanel">
      <div class="cart-panel__header">
        <h3>Your Cart</h3>
        <button class="cart-panel__close" id="cartClose">&times;</button>
      </div>
      <div class="cart-panel__body" id="cartBody">
        <p class="cart-empty">Your cart is empty.</p>
      </div>
      <div class="cart-panel__footer" id="cartFooter" style="display:none">
        <div class="cart-subtotal">
          <span>Subtotal</span>
          <span id="cartSubtotal">$0.00</span>
        </div>
        <a href="#" id="cartCheckoutBtn" class="btn btn--primary" target="_blank">Checkout</a>
      </div>
    </div>
  `;
  document.body.appendChild(drawer);

  document.getElementById('cartOverlay').addEventListener('click', closeCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
}

function openCart() {
  document.getElementById('cart-drawer').classList.add('open');
  document.body.classList.add('no-scroll');
  refreshCartUI();
}

function closeCart() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.body.classList.remove('no-scroll');
}

async function refreshCartUI() {
  const cart = await getOrCreateCart();
  const body = document.getElementById('cartBody');
  const footer = document.getElementById('cartFooter');
  const subtotalEl = document.getElementById('cartSubtotal');
  const checkoutBtn = document.getElementById('cartCheckoutBtn');

  const lines = cart.lines.edges.map(e => e.node);

  if (lines.length === 0) {
    body.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    footer.style.display = 'none';
    return;
  }

  let subtotal = 0;
  body.innerHTML = lines.map(line => {
    const v = line.merchandise;
    const price = parseFloat(v.price.amount);
    subtotal += price * line.quantity;
    return `
      <div class="cart-item" data-line-id="${line.id}">
        ${v.image ? `<img src="${v.image.url}" alt="${v.image.altText || v.product.title}" class="cart-item__img">` : ''}
        <div class="cart-item__info">
          <p class="cart-item__title">${v.product.title}</p>
          <p class="cart-item__variant">${v.title !== 'Default Title' ? v.title : ''}</p>
          <p class="cart-item__price">$${price.toFixed(2)} × ${line.quantity}</p>
        </div>
        <button class="cart-item__remove" data-line-id="${line.id}">&times;</button>
      </div>
    `;
  }).join('');

  footer.style.display = 'block';
  subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  checkoutBtn.href = cart.checkoutUrl;

  body.querySelectorAll('.cart-item__remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '...';
      await removeFromCart(btn.dataset.lineId);
      updateCartCount();
      refreshCartUI();
    });
  });
}

function updateCartCount() {
  getOrCreateCart().then(cart => {
    const count = cart.lines.edges.reduce((sum, e) => sum + e.node.quantity, 0);
    document.querySelectorAll('.nav-link--cart').forEach(el => {
      el.textContent = `Cart (${count})`;
    });
  });
}

// =============================================================================
// Product page initialization — by variant IDs in data-variant-id attributes
// =============================================================================
// Use this when size buttons already have data-variant-id set:
//   initProductPageByVariants()

function initProductPageByVariants() {
  injectCartDrawer();

  document.querySelectorAll('.nav-link--cart').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openCart(); });
  });

  updateCartCount();

  const addBtn = document.getElementById('addToCartBtn');
  if (!addBtn) return;

  const sizeBtns = document.querySelectorAll('.size-btn[data-variant-id]');
  let selectedVariantId = null;

  // Set initial selection from first available size
  sizeBtns.forEach(btn => {
    if (!btn.disabled && !selectedVariantId) {
      selectedVariantId = btn.dataset.variantId;
      btn.classList.add('size-btn--active');
    }
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      sizeBtns.forEach(b => b.classList.remove('size-btn--active'));
      btn.classList.add('size-btn--active');
      selectedVariantId = btn.dataset.variantId;
      updateAddBtn();
    });
  });

  function updateAddBtn() {
    if (!selectedVariantId) {
      addBtn.textContent = 'Sold Out';
      addBtn.disabled = true;
      addBtn.classList.remove('btn--primary');
      addBtn.classList.add('btn--disabled');
    } else {
      addBtn.textContent = 'Add to Cart';
      addBtn.disabled = false;
      addBtn.classList.add('btn--primary');
      addBtn.classList.remove('btn--disabled');
    }
  }

  updateAddBtn();

  addBtn.addEventListener('click', async () => {
    if (!selectedVariantId) return;
    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';
    try {
      const gid = `gid://shopify/ProductVariant/${selectedVariantId}`;
      await addToCart(gid);
      updateCartCount();
      addBtn.textContent = 'Added!';
      setTimeout(() => {
        addBtn.disabled = false;
        addBtn.textContent = 'Add to Cart';
        openCart();
      }, 800);
    } catch (err) {
      console.error(err);
      addBtn.textContent = 'Error — try again';
      addBtn.disabled = false;
    }
  });
}

// =============================================================================
// Product page initialization — by Shopify product handle
// =============================================================================
// Call this on a product page:
//   initProductPage('your-product-handle')

async function initProductPage(handle) {
  injectCartDrawer();

  // Wire cart icon
  document.querySelectorAll('.nav-link--cart').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openCart(); });
  });

  updateCartCount();

  const addBtn = document.getElementById('addToCartBtn') || document.querySelector('.btn--primary');
  if (!addBtn) return;

  addBtn.disabled = true;
  addBtn.textContent = 'Loading...';

  try {
    const product = await fetchProductByHandle(handle);

    if (!product) {
      addBtn.textContent = 'Unavailable';
      addBtn.disabled = true;
      return;
    }

    const variants = product.variants.edges.map(e => e.node);

    // Build variant map keyed by title (size)
    const variantMap = {};
    variants.forEach(v => { variantMap[v.title] = v; });

    // Update size buttons with availability
    document.querySelectorAll('.size-btn').forEach(btn => {
      const size = btn.textContent.trim();
      const variant = variantMap[size];
      if (variant && !variant.availableForSale) {
        btn.classList.add('size-btn--sold-out');
        btn.disabled = true;
      }
    });

    // Determine selected variant
    let selectedVariant = variants.find(v => v.availableForSale) || variants[0];

    // Sync with active size button
    const activeSize = document.querySelector('.size-btn--active');
    if (activeSize) {
      const v = variantMap[activeSize.textContent.trim()];
      if (v) selectedVariant = v;
    }

    // Size button click handler
    document.querySelectorAll('.size-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('size-btn--active'));
        btn.classList.add('size-btn--active');
        const v = variantMap[btn.textContent.trim()];
        if (v) selectedVariant = v;
        updateAddBtn();
      });
    });

    function updateAddBtn() {
      if (!selectedVariant || !selectedVariant.availableForSale) {
        addBtn.textContent = 'Sold Out';
        addBtn.disabled = true;
        addBtn.classList.remove('btn--primary');
        addBtn.classList.add('btn--disabled');
      } else {
        addBtn.textContent = 'Add to Cart';
        addBtn.disabled = false;
        addBtn.classList.add('btn--primary');
        addBtn.classList.remove('btn--disabled');
      }
    }

    updateAddBtn();

    addBtn.addEventListener('click', async () => {
      if (!selectedVariant || !selectedVariant.availableForSale) return;
      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';
      try {
        await addToCart(selectedVariant.id);
        updateCartCount();
        addBtn.textContent = 'Added!';
        setTimeout(() => {
          addBtn.disabled = false;
          addBtn.textContent = 'Add to Cart';
          openCart();
        }, 800);
      } catch (err) {
        console.error(err);
        addBtn.textContent = 'Error — try again';
        addBtn.disabled = false;
      }
    });

  } catch (err) {
    console.error('Shopify error:', err);
    addBtn.textContent = 'Add to Cart';
    addBtn.disabled = false;
  }
}
