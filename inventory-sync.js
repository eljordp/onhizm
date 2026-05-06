// =============================================================================
// ONHIZM — Auto-sync product cards with Shopify inventory
// =============================================================================
// Reads availability from Shopify on page load and updates product cards.
// Source of truth: Shopify. If Warsh marks an item available there, it's
// available here too. No more hardcoded "Sold Out" badges going stale.
// =============================================================================

(async function syncInventory() {
  if (typeof shopifyFetch !== 'function') return;

  const query = `{
    products(first: 30) {
      edges {
        node {
          handle
          variants(first: 20) {
            edges { node { availableForSale } }
          }
        }
      }
    }
  }`;

  let availabilityMap = {};
  try {
    const data = await shopifyFetch(query);
    const products = data?.products?.edges || [];
    for (const { node } of products) {
      const variants = node.variants?.edges || [];
      const anyAvailable = variants.some(v => v.node.availableForSale);
      availabilityMap[node.handle] = anyAvailable;
    }
  } catch (e) {
    console.warn('Inventory sync failed:', e);
    return;
  }

  document.querySelectorAll('[data-shopify-handle]').forEach(card => {
    const handle = card.dataset.shopifyHandle;
    if (!(handle in availabilityMap)) return;

    const available = availabilityMap[handle];
    const wasSold = card.classList.contains('product-card--sold');

    if (available) {
      card.classList.remove('product-card--sold');
      card.dataset.available = '1';
      const soldBadge = card.querySelector('.product-card__badge--sold');
      if (soldBadge) soldBadge.remove();
    } else {
      card.classList.add('product-card--sold');
      card.dataset.available = '0';
      const media = card.querySelector('.product-card__media');
      if (media && !card.querySelector('.product-card__badge--sold')) {
        const badge = document.createElement('div');
        badge.className = 'product-card__badge product-card__badge--sold';
        badge.textContent = 'Sold Out';
        card.insertBefore(badge, media);
      }
    }
  });
})();
