/* Shopify is the truth for stock and price. Reads the same public catalogue as inventory-sync.js,
   corrects the prices shown, and tells the page (onhizm:stock) what is live. */
(function () {
  var needed = document.querySelector('[data-shopify-handle], .product-page[data-handle], .wall-grid');
  if (!needed || typeof shopifyFetch !== 'function') { window.OnhizmStock = Promise.resolve({}); return; }

  var names = { SMALL: 'S', MEDIUM: 'M', LARGE: 'L', 'X-LARGE': 'XL', XLARGE: 'XL', 'EXTRA LARGE': 'XL' };
  function short(title) {
    var t = String(title || '').trim();
    return names[t.toUpperCase()] || t;
  }
  function money(amount) {
    var n = Number(amount);
    if (!isFinite(n)) return '';
    return '$' + (n % 1 === 0 ? String(n) : n.toFixed(2));
  }
  var query = '{ products(first: 30) { edges { node { handle availableForSale variants(first: 20) { edges { node { title availableForSale price { amount } } } } } } } }';

  window.OnhizmStock = shopifyFetch(query).then(function (data) {
    var map = {};
    (data.products ? data.products.edges : []).forEach(function (edge) {
      var node = edge.node;
      var variants = node.variants.edges.map(function (v) { return v.node; });
      var live = variants.filter(function (v) { return v.availableForSale; });
      var priced = live[0] || variants[0];
      map[node.handle] = {
        available: Boolean(node.availableForSale && live.length),
        totalVariants: variants.length,
        availableTitles: live.map(function (v) { return short(v.title); }),
        price: priced && priced.price ? money(priced.price.amount) : ''
      };
    });
    return map;
  }).catch(function (err) {
    console.warn('Stock check failed:', err);
    return {};
  });

  window.OnhizmStock.then(function (map) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-shopify-handle]'), function (el) {
      var info = map[el.dataset.shopifyHandle];
      if (!info) return;
      if (el.classList.contains('product-page__price')) {
        if (info.price) el.textContent = info.price;
        return;
      }
      var price = el.querySelector('.product-card__price');
      if (price && info.price) price.textContent = info.price;
      Array.prototype.forEach.call(el.querySelectorAll('.product-card__tag'), function (tag) {
        tag.hidden = !info.available && /ready to ship|in stock|available/i.test(tag.textContent);
      });
      var badge = el.querySelector('.product-card__badge');
      if (badge && info.available && /sold out/i.test(badge.textContent)) badge.textContent = 'Available';
    });
    window.dispatchEvent(new CustomEvent('onhizm:stock', { detail: map }));
  });
})();
