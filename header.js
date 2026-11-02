/* ONHIZM header + phone menu (SPEC §1.4). Replaces the inline menu script that was copied into all 18 pages.
   State stays in the classes shopify.js already uses: #mobileNav.open, #mobileMenuBtn.active, body.no-scroll.
   - Tap the backdrop, the X, a link, or press Escape: the menu closes (Escape and backdrop return focus to the toggle).
   - While open, everything behind the bar and the menu is inert, and Tab wraps between the bar and the menu,
     so neither Tab nor VoiceOver can reach the page or the closed cart drawer.
   - The menu's Cart: shopify.js closeMobileNav() closes the menu and openCart() sets body.no-scroll again.
     The observer below re-syncs aria/inert only and never touches no-scroll, or the page would scroll behind the drawer. */
(function () {
  var btn = document.getElementById('mobileMenuBtn');
  var nav = document.getElementById('mobileNav');
  var header = document.getElementById('header');
  if (!btn || !nav || !header) return;
  var wide = window.matchMedia('(min-width: 900px)');
  var walled = [];
  function isOpen() { return nav.classList.contains('open'); }
  function wall(on) {
    if (on) {
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === header || el === nav || el.tagName === 'SCRIPT' || el.inert) return;
        el.inert = true; walled.push(el);
      });
    } else { walled.forEach(function (el) { el.inert = false; }); walled = []; }
  }
  function sync() {
    var open = isOpen();
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.setAttribute('aria-hidden', String(!open));
    if ('inert' in nav) { nav.inert = !open; wall(open); }
    if (!open) btn.classList.remove('active');
  }
  function openMenu() {
    nav.classList.add('open'); btn.classList.add('active'); document.body.classList.add('no-scroll'); sync();
    var first = nav.querySelector('a, button'); if (first) first.focus({ preventScroll: true });
  }
  function closeMenu(returnFocus) {
    nav.classList.remove('open'); btn.classList.remove('active'); document.body.classList.remove('no-scroll'); sync();
    if (returnFocus) btn.focus({ preventScroll: true });
  }
  function stops() {                                        // the bar's visible controls, then the menu's
    return Array.prototype.filter.call(document.querySelectorAll('#header a[href], #header button, #mobileNav a[href], #mobileNav button'), function (el) {
      return el.getClientRects().length > 0;
    });
  }
  btn.addEventListener('click', function () { if (isOpen()) closeMenu(false); else openMenu(); });
  nav.addEventListener('click', function (e) { if (e.target === nav) closeMenu(true); });          // backdrop
  Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) { a.addEventListener('click', function () { closeMenu(false); }); });
  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); return; }
    if (e.key !== 'Tab') return;
    // move focus ourselves: Safari's default Tab skips links and buttons, so native order can't be relied on to stay inside
    var s = stops(); if (!s.length) return;
    var i = s.indexOf(document.activeElement);
    e.preventDefault();
    if (e.shiftKey) s[i <= 0 ? s.length - 1 : i - 1].focus();
    else s[i === -1 || i === s.length - 1 ? 0 : i + 1].focus();
  });
  new MutationObserver(sync).observe(nav, { attributes: true, attributeFilter: ['class'] });
  var onWide = function () { if (wide.matches && isOpen()) closeMenu(false); };
  if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
  window.addEventListener('pageshow', function (e) { if (e.persisted && isOpen()) closeMenu(false); });   // back/forward cache
  sync();
})();
