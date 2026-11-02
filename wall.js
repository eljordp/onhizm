/* The wall: filter by piece, and a full-screen viewer with swipe, arrow keys and Esc.
   Name, Instagram and the piece in the photo come from wall-data.js; stock comes live from stock.js. */
(function () {
  var grid = document.querySelector('.wall-grid');
  var DATA = window.ONHIZM_WALL;
  if (!grid || !DATA) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.wall-card'));
  var byId = {};
  DATA.photos.forEach(function (p) { byId[p.id] = p; });
  var stock = {};
  if (window.OnhizmStock) window.OnhizmStock.then(function (m) { stock = m || {}; if (viewer && !viewer.hidden) renderInfo(); });

  /* ---------- Filter ---------- */
  var filterEl = document.querySelector('.wall-filter');
  var filterSelect = null;
  function visible() { return cards.filter(function (c) { return !c.hidden; }).map(function (c) { return c.getAttribute('data-id'); }); }
  function setFilter(piece) {
    cards.forEach(function (c) { c.hidden = piece !== 'all' && c.getAttribute('data-piece') !== piece; });
    Array.prototype.forEach.call(filterEl.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === piece));
    });
    if (filterSelect) filterSelect.value = piece;
    if (window.HouseMotion && window.HouseMotion.refresh) { try { window.ScrollTrigger && window.ScrollTrigger.refresh(); } catch (e) {} }
  }
  if (filterEl) filterEl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-filter]');
    if (b) setFilter(b.getAttribute('data-filter'));
  });
  /* Phones get one dropdown, so the photos stay on the first screen. */
  if (filterEl) {
    filterSelect = document.createElement('select');
    filterSelect.className = 'wall-filter__select';
    filterSelect.setAttribute('aria-label', 'Filter by piece');
    Array.prototype.forEach.call(filterEl.querySelectorAll('button[data-filter]'), function (b) {
      var o = document.createElement('option');
      o.value = b.getAttribute('data-filter');
      o.textContent = b.textContent.replace(/\s+/g, ' ').trim();
      if (b.getAttribute('aria-pressed') === 'true') o.selected = true;
      filterSelect.appendChild(o);
    });
    filterSelect.addEventListener('change', function () { setFilter(filterSelect.value); });
    filterEl.appendChild(filterSelect);
  }

  /* ---------- Viewer ---------- */
  var viewer = document.createElement('div');
  viewer.className = 'wv';
  viewer.hidden = true;
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-label', 'Photo viewer');
  viewer.setAttribute('data-lenis-prevent', '');
  viewer.innerHTML =
    '<button type="button" class="wv__close">Close</button>' +
    '<div class="wv__stage">' +
      '<button type="button" class="wv__nav wv__nav--prev" aria-label="Previous photo">&#8592;</button>' +
      '<div class="wv__photo"><img alt=""></div>' +
      '<button type="button" class="wv__nav wv__nav--next" aria-label="Next photo">&#8594;</button>' +
    '</div>' +
    '<div class="wv__info"></div>';
  document.body.appendChild(viewer);
  var photoEl = viewer.querySelector('.wv__photo');
  var imgEl = photoEl.querySelector('img');
  var infoEl = viewer.querySelector('.wv__info');
  var stage = viewer.querySelector('.wv__stage');
  var current = null, list = [], lastFocus = null;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function stateOf(handle) { return stock[handle] || null; }

  function renderInfo() {
    if (!current) return;
    var p = current;
    var ig = p.ig.map(function (h) { return '<a href="https://instagram.com/' + esc(h) + '" target="_blank" rel="noopener">@' + esc(h) + '</a>'; }).join(' ');
    var html = '<h2 class="wv__name">' + esc(p.name) + '</h2><p class="wv__ig">' + ig + '</p>';
    var piece = p.piece ? DATA.pieces[p.piece] : null;
    if (piece) {
      var st = stateOf(p.piece);
      var sold = st && !st.available;
      html += '<p class="wv__piece"><a href="products/' + esc(piece.page) + '">' + esc(piece.name) + '</a>' + (st && st.price ? ' <span>' + esc(st.price) + '</span>' : '') + (sold ? ' <span>Sold out</span>' : '') + '</p>';
      html += sold
        ? '<button type="button" class="btn btn--primary wv__notify">Text me the next drop</button><div class="wv__form" hidden></div>'
        : '<a class="btn btn--primary wv__shop" href="products/' + esc(piece.page) + '">Shop this</a>';
    } else {
      html += '<a class="wv__more" href="shop.html">See what is in stock</a>';
    }
    infoEl.innerHTML = html;
    var notify = infoEl.querySelector('.wv__notify');
    if (notify) notify.addEventListener('click', function () {
      var slot = infoEl.querySelector('.wv__form');
      if (window.OnhizmNextDrop && !slot.firstChild) window.OnhizmNextDrop.render(slot, p.piece);
      slot.hidden = false;
      notify.hidden = true;
      var input = slot.querySelector('input');
      if (input) input.focus();
    });
  }

  function renderDot() {
    Array.prototype.forEach.call(photoEl.querySelectorAll('.wv__dot, .wv__tag'), function (n) { n.remove(); });
    var p = current;
    if (!p.dot || !p.piece) return;
    var piece = DATA.pieces[p.piece];
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'wv__dot';
    dot.style.left = (p.dot[0] * 100) + '%';
    dot.style.top = (p.dot[1] * 100) + '%';
    dot.setAttribute('aria-label', 'See the ' + piece.name);
    dot.setAttribute('aria-expanded', 'false');
    photoEl.appendChild(dot);
    var tag = document.createElement('a');
    tag.className = 'wv__tag';
    tag.href = 'products/' + piece.page;
    tag.textContent = piece.name;
    tag.hidden = true;
    tag.style.top = (p.dot[1] * 100) + '%';
    if (p.dot[1] > .75) tag.classList.add('wv__tag--up');
    photoEl.appendChild(tag);
    dot.addEventListener('click', function () {
      tag.hidden = !tag.hidden;
      dot.setAttribute('aria-expanded', String(!tag.hidden));
      if (tag.hidden) return;
      // Centre the tag under the dot, kept inside the photo.
      var W = photoEl.clientWidth, w = tag.offsetWidth;
      tag.style.left = Math.max(8, Math.min(W - w - 8, W * p.dot[0] - w / 2)) + 'px';
    });
  }

  // The photo box is exactly the photo's shape, so the dots stay on the clothes at any screen size.
  function fit() {
    if (!current) return;
    var pad = window.matchMedia('(min-width: 900px)').matches ? 32 : 6;
    var aw = stage.clientWidth - (window.matchMedia('(min-width: 900px)').matches ? 128 : 0);
    var ah = stage.clientHeight - pad;
    var r = current.w / current.h;
    var w = Math.min(aw, ah * r);
    photoEl.style.width = Math.round(w) + 'px';
    photoEl.style.height = Math.round(w / r) + 'px';
  }
  window.addEventListener('resize', fit);

  function show(id) {
    current = byId[id];
    if (!current) return;
    fit();
    imgEl.src = current.view || current.img;
    imgEl.alt = current.name + ' with ONHIZM';
    renderDot();
    renderInfo();
    var one = list.length < 2;
    viewer.querySelector('.wv__nav--prev').hidden = one;
    viewer.querySelector('.wv__nav--next').hidden = one;
    try { history.replaceState(null, '', '#p-' + id); } catch (e) {}
    viewer.scrollTop = 0;
  }
  function open(id) {
    list = visible();
    if (list.indexOf(id) < 0) { setFilter('all'); list = visible(); }
    lastFocus = document.activeElement;
    viewer.hidden = false;
    document.body.classList.add('no-scroll');
    show(id);
    viewer.querySelector('.wv__close').focus({ preventScroll: true });
  }
  function close() {
    viewer.hidden = true;
    document.body.classList.remove('no-scroll');
    imgEl.removeAttribute('src');
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    current = null;
  }
  function step(n) {
    var i = list.indexOf(current.id);
    show(list[(i + n + list.length) % list.length]);
  }

  grid.addEventListener('click', function (e) {
    var a = e.target.closest('[data-wall-open]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    open(a.getAttribute('data-wall-open'));
  });
  viewer.querySelector('.wv__close').addEventListener('click', close);
  viewer.querySelector('.wv__nav--prev').addEventListener('click', function () { step(-1); });
  viewer.querySelector('.wv__nav--next').addEventListener('click', function () { step(1); });
  viewer.addEventListener('click', function (e) { if (e.target === viewer || e.target === stage) close(); });
  document.addEventListener('keydown', function (e) {
    if (viewer.hidden) return;
    var typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (!typing && e.key === 'ArrowLeft') step(-1);
    if (!typing && e.key === 'ArrowRight') step(1);
    if (e.key === 'Tab') {
      var f = Array.prototype.filter.call(viewer.querySelectorAll('a[href], button, input'), function (n) { return !n.hidden && n.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  var sx = 0, sy = 0, on = false;
  stage.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; on = true; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (!on) return;
    on = false;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
  }, { passive: true });

  function fromHash() {
    var m = /^#p-(.+)$/.exec(location.hash);
    if (m && byId[m[1]] && (!current || current.id !== m[1])) open(m[1]);
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
