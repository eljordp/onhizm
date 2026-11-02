/* ONHIZM + House Kit: page changes, scroll lock while something covers the page,
   and the header cart (phone and desktop) with a live count. shopify.js is untouched:
   it writes the count into the hidden .nav-link--cart, and this mirrors it to the visible buttons. */
(function () {
  var M = window.HouseMotion;
  if (M && M.pageLinks) M.pageLinks('a[href$=".html"]');

  function lenis() { return M && M.getLenis ? M.getLenis() : null; }
  new MutationObserver(function () {
    var l = lenis();
    if (!l) return;
    if (document.body.classList.contains('no-scroll')) l.stop(); else l.start();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  var nav = document.getElementById('mobileNav');
  if (nav) nav.setAttribute('data-lenis-prevent', '');

  if (typeof injectCartDrawer !== 'function') return;
  injectCartDrawer();
  var drawer = document.getElementById('cart-drawer');
  if (drawer) drawer.setAttribute('data-lenis-prevent', '');

  var triggers = document.querySelectorAll('.header__cart, .mobile-nav__link--cart');
  Array.prototype.forEach.call(triggers, function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var btn = document.getElementById('mobileMenuBtn');
      if (nav) nav.classList.remove('open');
      if (btn) btn.classList.remove('active');
      document.body.classList.remove('no-scroll');
      openCart();
    });
  });

  var source = document.querySelector('.nav-link--cart');
  function mirror() {
    var text = source.textContent.trim();
    Array.prototype.forEach.call(triggers, function (el) { el.textContent = text; });
  }
  if (source) new MutationObserver(mirror).observe(source, { childList: true, characterData: true, subtree: true });

  // Only ask Shopify when this visitor already has a cart, so a page view never creates one.
  var hasCart = false;
  try { hasCart = !!localStorage.getItem(CART_KEY); } catch (e) {}
  if (hasCart) updateCartCount();
})();
