// =============================================================================
// ONHIZM — Auto-sync product cards with Shopify inventory
// =============================================================================
// Reads availability from Shopify on page load and updates product cards.
// Source of truth: Shopify. If Warsh marks an item available there, it's
// available here too. No more hardcoded "Sold Out" badges going stale.
// =============================================================================

function shortVariantTitle(title) {
  const normalized = String(title || '').trim().toUpperCase();
  const map = {
    SMALL: 'S',
    MEDIUM: 'M',
    LARGE: 'L',
    'X-LARGE': 'XL',
    XLARGE: 'XL',
    'EXTRA LARGE': 'XL'
  };
  return map[normalized] || String(title || '').trim();
}

(async function syncInventory() {
  if (typeof shopifyFetch !== 'function') return;

  const query = `{
    products(first: 30) {
      edges {
        node {
          handle
          availableForSale
          variants(first: 20) {
            edges { node { title availableForSale } }
          }
        }
      }
    }
  }`;

  let productMap = {};
  try {
    const data = await shopifyFetch(query);
    const products = data?.products?.edges || [];
    for (const { node } of products) {
      const variants = node.variants?.edges || [];
      const availableVariants = variants
        .map(v => v.node)
        .filter(v => v.availableForSale);
      productMap[node.handle] = {
        available: Boolean(node.availableForSale && availableVariants.length),
        totalVariants: variants.length,
        availableTitles: [...new Set(availableVariants.map(v => shortVariantTitle(v.title)).filter(Boolean))],
      };
    }
  } catch (e) {
    console.warn('Inventory sync failed:', e);
    return;
  }

  document.querySelectorAll('[data-shopify-handle]').forEach(card => {
    const handle = card.dataset.shopifyHandle;
    if (!(handle in productMap)) return;

    const product = productMap[handle];
    const available = product.available;
    const availableCount = product.availableTitles.length;
    const totalCount = product.totalVariants;
    const isLimited = available && totalCount > 1 && availableCount < totalCount;
    const media = card.querySelector('.product-card__media');
    let badge = card.querySelector('.product-card__badge');

    if (available) {
      card.classList.remove('product-card--sold');
      card.dataset.available = '1';
      if (!badge && media) {
        badge = document.createElement('div');
        badge.className = 'product-card__badge';
        card.insertBefore(badge, media);
      }
      if (badge) {
        badge.className = 'product-card__badge';
        if (isLimited) {
          badge.classList.add('product-card__badge--limited');
          badge.textContent = `Limited: ${product.availableTitles.join(' / ')}`;
        } else {
          badge.textContent = badge.textContent.trim() || 'Available';
        }
      }
    } else {
      card.classList.add('product-card--sold');
      card.dataset.available = '0';
      if (!badge && media) {
        badge = document.createElement('div');
        badge.className = 'product-card__badge product-card__badge--sold';
        card.insertBefore(badge, media);
      }
      if (badge) {
        badge.className = 'product-card__badge product-card__badge--sold';
        badge.textContent = 'Sold Out';
      }
    }
  });

  window.dispatchEvent(new CustomEvent('onhizm:inventory-sync'));
})();
