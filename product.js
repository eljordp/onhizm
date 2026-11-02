/* Product pages: big sharp photos you can swipe, a buy bar that stays on phones, and
   "Text me the next drop" when the piece is sold out. Buying still runs through shopify.js:
   the bar presses the page's own Add to Cart button. */
(function () {
  var page = document.querySelector('.product-page[data-handle]');
  if (!page) return;
  var handle = page.getAttribute('data-handle');

  /* ---------- Photos ---------- */
  var main = page.querySelector('.product-page__main-img img');
  var thumbsEl = page.querySelector('.product-page__thumbs');
  var mainWrap = page.querySelector('.product-page__main-img');
  var WIDTHS = [1200, 1600, 2000];
  var ours = '';

  function isShopify(url) { return /cdn\.shopify\.com|myshopify\.com\/cdn/.test(url); }
  function atWidth(url, w) {
    return /[?&]width=\d+/.test(url) ? url.replace(/([?&]width=)\d+/, '$1' + w) : url + (url.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;
  }
  function show(url) {
    if (!main || !url) return;
    if (isShopify(url)) {
      main.srcset = WIDTHS.map(function (w) { return atWidth(url, w) + ' ' + w + 'w'; }).join(', ');
      main.sizes = '(min-width: 900px) 52vw, 100vw';
      ours = atWidth(url, 1600);
    } else {
      main.removeAttribute('srcset');
      main.removeAttribute('sizes');
      ours = url;
    }
    main.src = ours;
  }
  function thumbs() { return thumbsEl ? Array.prototype.slice.call(thumbsEl.querySelectorAll('.product-page__thumb')) : []; }
  function activeIndex() {
    var i = thumbs().findIndex(function (t) { return t.classList.contains('product-page__thumb--active'); });
    return i < 0 ? 0 : i;
  }
  function go(i) {
    var list = thumbs();
    if (!list.length) return;
    var next = (i + list.length) % list.length;
    list.forEach(function (t) { t.classList.remove('product-page__thumb--active'); t.removeAttribute('aria-current'); });
    list[next].classList.add('product-page__thumb--active');
    list[next].setAttribute('aria-current', 'true');
    show(list[next].querySelector('img').getAttribute('src'));
    if (counter) counter.textContent = (next + 1) + ' / ' + list.length;
  }
  var counter = null;
  if (main) {
    main.removeAttribute('loading');
    if (isShopify(main.getAttribute('src'))) show(main.getAttribute('src'));
    // A colour or variant button on the page swapped the photo: its file wins.
    new MutationObserver(function () {
      if (main.getAttribute('src') !== ours) { main.removeAttribute('srcset'); main.removeAttribute('sizes'); ours = main.getAttribute('src'); }
    }).observe(main, { attributes: true, attributeFilter: ['src'] });
  }
  if (thumbsEl && main) {
    Array.prototype.forEach.call(thumbs(), function (t, i) { t.setAttribute('aria-label', 'Photo ' + (i + 1)); t.type = 'button'; });
    thumbsEl.addEventListener('click', function (e) {
      var t = e.target.closest('.product-page__thumb');
      if (!t) return;
      e.stopPropagation();
      go(thumbs().indexOf(t));
    }, true);
    if (thumbs().length > 1) {
      counter = document.createElement('span');
      counter.className = 'pp-count';
      counter.textContent = (activeIndex() + 1) + ' / ' + thumbs().length;
      mainWrap.appendChild(counter);
      var sx = 0, sy = 0, on = false;
      mainWrap.addEventListener('touchstart', function (e) { var p = e.changedTouches[0]; sx = p.clientX; sy = p.clientY; on = true; }, { passive: true });
      mainWrap.addEventListener('touchend', function (e) {
        if (!on) return;
        on = false;
        var p = e.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) go(activeIndex() + (dx < 0 ? 1 : -1));
      }, { passive: true });
    }
  }

  /* ---------- Buy bar + sold out ---------- */
  var addBtn = document.getElementById('addToCartBtn');
  var openBtn = document.getElementById('nextDropOpen');
  var slot = document.getElementById('nextDropForm');
  var title = page.querySelector('.product-page__title');
  var priceEl = page.querySelector('.product-page__price');
  var badge = page.querySelector('.product-page__badge');
  if (!addBtn || !title) return;

  var bar = document.createElement('div');
  bar.className = 'buy-bar';
  bar.innerHTML = '<div class="buy-bar__info"><span class="buy-bar__name"></span><span class="buy-bar__meta"></span></div><button type="button" class="btn btn--primary buy-bar__btn"></button>';
  document.body.appendChild(bar);
  document.body.classList.add('has-buy-bar');
  var barName = bar.querySelector('.buy-bar__name');
  var barMeta = bar.querySelector('.buy-bar__meta');
  var barBtn = bar.querySelector('.buy-bar__btn');
  barName.textContent = title.textContent.trim();

  var formReady = false;
  function openForm(focus) {
    if (!slot || !window.OnhizmNextDrop) return;
    if (!formReady) { window.OnhizmNextDrop.render(slot, handle); formReady = true; }
    slot.hidden = false;
    if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
    if (focus) {
      var header = document.getElementById('header');
      var top = (header ? header.offsetHeight : 0) + 16;
      var rect = slot.getBoundingClientRect();
      var barH = bar.offsetHeight || 0;
      if (rect.top < top || rect.top > window.innerHeight - barH - 120) {
        var y = rect.top + window.scrollY - top;
        if (window.HouseMotion && window.HouseMotion.scrollTo) window.HouseMotion.scrollTo(y, { immediate: false }); else window.scrollTo(0, y);
      }
      var input = slot.querySelector('input');
      if (input) input.focus({ preventScroll: true });
    }
  }
  if (openBtn) openBtn.addEventListener('click', function () { openForm(true); });

  // A piece marked sold out in the page stays sold out if Shopify can't be reached.
  var stockFailed = false;
  if (page.dataset.staticSold && window.OnhizmStock) window.OnhizmStock.then(function (map) { stockFailed = !map[handle]; sync(); });

  function isSold() { return /sold out/i.test(addBtn.textContent) && addBtn.disabled; }
  var picked = false;
  function sync() {
    if (stockFailed && /add to cart/i.test(addBtn.textContent)) {
      addBtn.textContent = 'Sold Out';
      addBtn.disabled = true;
      return;
    }
    var sold = isSold();
    var active = page.querySelector('.size-btn--active');
    var loading = /loading/i.test(addBtn.textContent);
    // Show which size will be added: pick the first one left, once.
    if (!sold && !loading && !picked && !active) {
      var first = page.querySelector('.size-btn:not([disabled])');
      if (first) { picked = true; first.click(); active = first; }
    }
    var price = priceEl ? priceEl.textContent.trim() : '';
    if (sold) {
      addBtn.hidden = true;
      if (openBtn) openBtn.hidden = false;
      barMeta.textContent = 'Sold out';
      barBtn.textContent = 'Text me the next drop';
      barBtn.disabled = false;
      if (badge) { badge.hidden = false; badge.textContent = 'Sold out'; }
      if (!page.querySelector('.product-soldout-note') && openBtn) {
        var note = document.createElement('p');
        note.className = 'product-soldout-note';
        note.textContent = 'Sold out means sold out. This piece is not planned to restock.';
        openBtn.parentNode.insertBefore(note, openBtn);
      }
    } else {
      addBtn.hidden = false;
      if (openBtn) openBtn.hidden = true;
      if (slot) slot.hidden = true;
      if (badge && !loading) badge.hidden = true;
      Array.prototype.forEach.call(page.querySelectorAll('.product-soldout-note'), function (n) { if (!loading) n.hidden = true; });
      barMeta.textContent = price + (active ? ' · ' + active.textContent.trim() : '');
      barBtn.textContent = addBtn.textContent.trim();
      barBtn.disabled = addBtn.disabled;
    }
  }
  barBtn.addEventListener('click', function () {
    if (isSold()) { openForm(true); return; }
    addBtn.click();
  });
  new MutationObserver(sync).observe(addBtn, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'class'] });
  page.addEventListener('click', function (e) { if (e.target.closest('.size-btn')) setTimeout(sync, 0); });
  if (priceEl) new MutationObserver(sync).observe(priceEl, { childList: true, characterData: true, subtree: true });
  sync();
})();
