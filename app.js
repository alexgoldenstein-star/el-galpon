/* El Galpón — sitio + panel (Firebase) */
(function () {
  'use strict';

  /* ================= estado ================= */
  var app = document.getElementById('app');
  var OWNERS = (window.GALPON_ADMINS || []).map(function (e) { return String(e).toLowerCase().trim(); });
  var fb = null;                 // { auth, db, storage }
  var cfg = null;                // datos del negocio (site/main)
  var products = [];             // colección products
  var needSeed = { cfg: false, products: false };
  var user = null, role = null;  // role: owner | admin | editor | null
  var authReady = false;
  var orders = null, ordersErr = '';
  var team = null;
  var view = 'inicio', adminTab = 'pedidos';
  var cat = 'Todo', query = '';
  var cart = {}, buyer = { name: '', barrio: '', phone: '' };
  var cartOpen = false, detailId = null, share = null;
  var editing = null;            // borrador de producto en edición
  var cfgDraft = null;           // borrador de datos del negocio
  var busy = false, toast = '';
  var sending = false, lastOrder = null;

  try { cart = JSON.parse(sessionStorage.getItem('galpon-cart') || '{}') || {}; } catch (e) { cart = {}; }
  try { buyer = JSON.parse(localStorage.getItem('galpon-buyer') || 'null') || buyer; } catch (e) {}
  try { lastOrder = JSON.parse(sessionStorage.getItem('galpon-last-order') || 'null'); } catch (e) {}

  function readHash() {
    var h = (location.hash || '').replace('#', '');
    if (h.indexOf('producto-') === 0) { view = 'catalogo'; detailId = h.slice(9); return; }
    if (h === 'catalogo' || h === 'admin' || h === 'inicio') view = h;
  }
  readHash();

  /* ================= utilidades ================= */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-AR'); }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function waLink(text) { return 'https://wa.me/' + digits(cfg.contact.whatsapp) + '?text=' + encodeURIComponent(text); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function onOffer(p) { return Number(p.offer) > 0 && Number(p.offer) < Number(p.price) && !!p.offerUntil && p.offerUntil >= todayStr(); }
  function priceOf(p) { return onOffer(p) ? Number(p.offer) : (Number(p.price) || 0); }
  function gain(p) { return (Number(p.sug) || 0) - priceOf(p); }
  function ddmm(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; }
  function priceHtml(p) {
    return onOffer(p)
      ? '<span class="price num">' + money(priceOf(p)) + '</span><s class="old num">' + money(p.price) + '</s>'
      : '<span class="price num">' + money(p.price) + '</span>';
  }
  function imgOf(p) { return p.img || (cfg && cfg.images && cfg.images.depB) || ''; }
  function prodById(id) { for (var i = 0; i < products.length; i++) if (products[i].id === id) return products[i]; return null; }
  function isStaff() { return role === 'owner' || role === 'admin' || role === 'editor'; }
  function isAdmin() { return role === 'owner' || role === 'admin'; }
  function persistCart() {
    try { sessionStorage.setItem('galpon-cart', JSON.stringify(cart)); localStorage.setItem('galpon-buyer', JSON.stringify(buyer)); } catch (e) {}
  }
  function cartLines() {
    var out = [];
    Object.keys(cart).forEach(function (id) { var p = prodById(id); if (p && cart[id] > 0) out.push({ p: p, q: cart[id] }); });
    return out;
  }
  function cartTotals() {
    var t = { count: 0, total: 0, gain: 0 };
    cartLines().forEach(function (l) { t.count += l.q; t.total += l.q * priceOf(l.p); t.gain += l.q * gain(l.p); });
    return t;
  }
  function mapsUrl() {
    if (cfg.contact.mapsUrl) return cfg.contact.mapsUrl;
    var a = [cfg.contact.address, cfg.contact.area].filter(Boolean).join(', ');
    return a ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a) : '';
  }
  var toastTimer = null;
  function showToast(m) {
    var el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = m; el.hidden = !m;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 4500);
  }
  function setToast(m, noRender) { if (!noRender) render(true); showToast(m); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var IC = {
    house: '<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9 20v-6h6v6"/>',
    bag: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bus: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l1.5-4M16 21l-1.5-4"/>',
    wa: '<path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M9 9.5c.3 2 2.3 4.2 4.5 4.8l1.2-1.2 1.8.8"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.7-4.9-4-5.7"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>'
  };
  function ic(name, size) {
    var s = size || 22;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[name] + '</svg>';
  }
  function ph(v, placeholder) { return (v && String(v).trim()) ? esc(v) : '<span class="ph">' + esc(placeholder) + '</span>'; }

  /* ================= piezas públicas ================= */
  function header() {
    var t = cartTotals();
    return '<header class="top"><div class="wrap top-in">' +
      '<a class="logo" href="#inicio" data-go="inicio"><span class="logo-mark">' + ic('house', 24) + '</span><span class="logo-name">' + esc(cfg.brand.name) + '</span></a>' +
      '<nav class="nav" aria-label="Secciones">' +
      '<a href="#inicio" data-go="inicio" class="' + (view === 'inicio' ? 'on' : '') + '">Inicio</a>' +
      '<a href="#catalogo" data-go="catalogo" class="' + (view === 'catalogo' ? 'on' : '') + '">Catálogo</a>' +
      ((isStaff() || view === 'admin') ? '<a href="#admin" data-go="admin" class="' + (view === 'admin' ? 'on' : '') + '">Panel</a>' : '') +
      '</nav>' +
      (view === 'admin' ? '' : '<button class="cart-btn" type="button" data-act="open-cart" aria-label="Ver mi pedido">' + ic('bag') + (t.count ? '<span class="badge num">' + t.count + '</span>' : '') + '</button>') +
      '</div></header>';
  }

  function stockBadge(p) {
    var b = [];
    if (onOffer(p)) b.push('<span class="badge-offer">Oferta hasta el ' + ddmm(p.offerUntil) + '</span>');
    if (p.combo) b.push('<span class="badge-combo">Combo</span>');
    if (p.stock === 'out') b.push('<span class="stock out">Sin stock</span>');
    else if (p.stock === 'low') b.push('<span class="stock">Últimas unidades</span>');
    return b.length ? '<span class="badges">' + b.join('') + '</span>' : '';
  }
  function qtyControl(p, big) {
    var q = cart[p.id] || 0, out = p.stock === 'out';
    if (q > 0) return '<div class="qty' + (big ? ' big' : '') + '"><button type="button" data-act="dec" data-id="' + esc(p.id) + '" aria-label="Quitar uno">−</button><span class="num">' + q + '</span><button type="button" data-act="inc" data-id="' + esc(p.id) + '" aria-label="Agregar uno">+</button></div>';
    return '<button class="add' + (big ? ' big' : '') + '" type="button" data-act="inc" data-id="' + esc(p.id) + '"' + (out ? ' disabled' : '') + '>' + (out ? 'Sin stock' : 'Agregar al pedido') + '</button>';
  }
  function card(p) {
    return '<article class="card">' +
      '<button type="button" class="card-open" data-act="detail" data-id="' + esc(p.id) + '" aria-label="Ver ' + esc(p.name) + '">' +
      '<span class="card-pic"><img src="' + esc(imgOf(p)) + '" alt="" loading="lazy">' + stockBadge(p) + '</span>' +
      '<span class="card-body">' +
      '<span class="card-cat">' + esc(p.cat) + '</span>' +
      '<span class="card-name">' + esc(p.name) + '</span>' +
      '<span class="price-lbl">Tu precio</span>' +
      '<span class="price-row">' + priceHtml(p) + '</span>' +
      '<span class="sug num">Vendelo a ' + money(p.sug) + '</span>' +
      '<span class="gain num">Ganás ' + money(gain(p)) + '</span>' +
      '<span class="more">Ver detalle</span>' +
      '</span></button>' +
      '<div class="card-actions">' + qtyControl(p) + '</div>' +
      '</article>';
  }

  function landing() {
    var c = cfg.contact, im = cfg.images;
    var offers = products.filter(function (p) { return onOffer(p) && p.stock !== 'out'; }).slice(0, 4);
    var feat = products.filter(function (p) { return p.featured && !onOffer(p); }).slice(0, 4);
    if (!feat.length) feat = products.filter(function (p) { return !onOffer(p); }).slice(0, 4);
    var ex = feat[0] || { name: 'Producto', price: 0, sug: 0, img: im.depB };
    var joinMsg = 'Hola ' + cfg.brand.name + '! Quiero sumarme como revendedor.';
    var sellMsg = 'Hola ' + cfg.brand.name + '! Quiero ser vendedor en mi zona.';
    return '' +
      '<section class="hero"><div class="wrap hero-grid">' +
      '<div class="hero-copy">' +
      '<span class="pill">' + ic('pin', 16) + 'Depósito en ' + esc(c.zone || 'zona sur/oeste') + ' · Abierto al público</span>' +
      '<h1>Ganá plata extra vendiendo <em>cosas para la casa</em></h1>' +
      '<p class="lead">Bazar, blanquería y cocina a precio de depósito. Elegís del catálogo, retirás y lo vendés a tus vecinos, en el trabajo o en tu barrio.</p>' +
      '<div class="ctas"><a class="btn btn-main" href="#catalogo" data-go="catalogo">Ver catálogo y precios</a>' +
      '<a class="btn btn-line" href="' + esc(waLink(joinMsg)) + '" target="_blank" rel="noopener">' + ic('wa') + 'Quiero revender</a></div>' +
      '<div class="checks"><span>' + ic('check', 18) + 'No pagás nada para sumarte</span><span>' + ic('check', 18) + 'Pagás cuando ves la mercadería</span></div>' +
      '</div>' +
      '<div class="hero-pic"><img src="' + esc(im.hero) + '" alt="Mercadería en el depósito">' +
      '<div class="hero-tag"><span class="ico">' + ic('cash') + '</span><div><b>Ganás ' + money(gain(ex)) + ' por unidad</b><small>vendiendo ' + esc(String(ex.name).toLowerCase()) + '</small></div></div></div>' +
      '</div></section>' +

      '<div class="band"><div class="wrap band-grid">' +
      '<div class="band-item">' + ic('shield', 32) + '<div><b>Sumarte es gratis</b><span>Sin inscripción, sin cuota y sin kit obligatorio.</span></div></div>' +
      '<div class="band-item">' + ic('cash', 32) + '<div><b>Pagás al retirar</b><span>Venís, ves la mercadería, la pagás y te la llevás.</span></div></div>' +
      '<div class="band-item">' + ic('wa', 32) + '<div><b>Te avisamos por WhatsApp</b><span>Confirmamos tu pedido y el día en que está listo.</span></div></div>' +
      '</div></div>' +

      '<section><div class="wrap">' +
      '<div class="sec-head"><span class="eyebrow">Somos un depósito real</span><h2 class="h2">Vení a conocernos</h2>' +
      '<p class="lead">Depósito con mercadería, gente que te atiende y una dirección donde nos encontrás.</p></div>' +
      '<div class="depot-grid">' +
      '<figure><img src="' + esc(im.depA) + '" alt="" loading="lazy"><figcaption>' + esc(cfg.captions.depA) + '</figcaption></figure>' +
      '<figure><img src="' + esc(im.depB) + '" alt="" loading="lazy"><figcaption>' + esc(cfg.captions.depB) + '</figcaption></figure>' +
      '<figure><img src="' + esc(im.depC) + '" alt="" loading="lazy"><figcaption>' + esc(cfg.captions.depC) + '</figcaption></figure>' +
      '</div></div></section>' +

      '<section style="padding-top:8px"><div class="wrap">' +
      '<div class="sec-head"><h2 class="h2">Cómo funciona</h2></div>' +
      '<div class="steps">' +
      '<div class="step"><span class="step-n">1</span><h3>Elegís del catálogo</h3><p>Ves tu precio, el precio al que conviene venderlo y cuánto ganás.</p></div>' +
      '<div class="step"><span class="step-n">2</span><h3>Mandás el pedido</h3><p>Armás el carrito y lo enviás por WhatsApp con un toque. Te confirmamos stock y día de retiro.</p></div>' +
      '<div class="step"><span class="step-n">3</span><h3>Retirás y vendés</h3><p>Pasás por el depósito, pagás y te lo llevás. La ganancia es tuya.</p></div>' +
      '</div></div></section>' +

      '<section class="earn"><div class="wrap earn-grid">' +
      '<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow green">Cuánto podés ganar</span>' +
      '<h2 class="h2">En cada producto ves tu ganancia antes de comprar</h2>' +
      '<p class="lead">Te sugerimos un precio de venta parecido al que la gente ya ve en internet. La diferencia es tuya.</p></div>' +
      '<div><div class="earn-card">' +
      '<div class="earn-prod"><img src="' + esc(imgOf(ex)) + '" alt=""><b>' + esc(ex.name) + '</b></div>' +
      '<div class="row-line"><span>Lo comprás a</span><strong class="num">' + money(priceOf(ex)) + '</strong></div>' +
      '<div class="row-line"><span>Lo vendés a</span><strong class="num">' + money(ex.sug) + '</strong></div>' +
      '<div class="gain-box"><span>Ganás por unidad</span><b class="num">' + money(gain(ex)) + '</b></div>' +
      '<p class="earn-note num">Si vendés 10 en el mes, son ' + money(gain(ex) * 10) + ' para vos.</p>' +
      '</div></div></div></section>' +

      (offers.length ? '<section class="offers-sec"><div class="wrap">' +
        '<div class="sec-row"><div class="sec-head" style="margin:0"><span class="eyebrow">Por tiempo limitado</span><h2 class="h2">Ofertas de la semana</h2></div>' +
        '<a class="btn btn-dark btn-sm" href="#catalogo" data-act="cat-go" data-cat="Ofertas">Ver todas las ofertas</a></div>' +
        '<div class="grid">' + offers.map(card).join('') + '</div></div></section>' : '') +
      '<section><div class="wrap">' +
      '<div class="sec-row"><div class="sec-head" style="margin:0"><span class="eyebrow">Lo más pedido</span><h2 class="h2">Destacados de la semana</h2></div>' +
      '<a class="btn btn-dark btn-sm" href="#catalogo" data-go="catalogo">Ver todo el catálogo</a></div>' +
      '<div class="grid">' + feat.map(card).join('') + '</div>' +
      '</div></section>' +

      '<section class="pickup"><div class="wrap pickup-grid">' +
      '<div><h2 class="h2">Dónde retirar</h2><div class="pick-list">' +
      '<div class="pick-item">' + ic('pin', 26) + '<div><b>' + ph(c.address, 'Dirección del depósito') + '</b><br>' + ph(c.area, 'Barrio / localidad') + '</div></div>' +
      '<div class="pick-item">' + ic('clock', 26) + '<div><b>Horario de retiro</b><br>' + ph(c.hours, 'Días y franja horaria') + '</div></div>' +
      (c.howToGet ? '<div class="pick-item">' + ic('bus', 26) + '<div><b>Cómo llegar</b><br>' + esc(c.howToGet) + '</div></div>' : '') +
      '</div></div>' +
      '<div><div class="map-card"><span class="map-pin">' + ic('pin', 32) + '</span>' +
      '<b style="font-size:20px">' + ph(c.address, 'Dirección del depósito') + '</b>' +
      '<p style="color:var(--ink-2)">Te avisamos por WhatsApp cuando tu pedido está listo para retirar.</p>' +
      (mapsUrl() ? '<a class="btn btn-main btn-sm" href="' + esc(mapsUrl()) + '" target="_blank" rel="noopener">Abrir en Google Maps</a>' : '') +
      '</div></div>' +
      '</div></section>' +

      '<section><div class="wrap"><div class="sellers">' +
      '<div><span class="eyebrow" style="color:var(--orange)">También buscamos vendedores</span>' +
      '<h2 class="h2">¿Te movés por estaciones, paradas o tu barrio?</h2>' +
      '<p class="lead">Si conocés gente y te gusta vender, sumate. Te damos catálogo y fotos listas para compartir.</p>' +
      '<ul><li>' + ic('check', 18) + 'Material para mostrar en la calle y en tus estados</li><li>' + ic('check', 18) + 'Ganás por cada venta, no por sumar gente</li></ul></div>' +
      '<div style="flex:0 1 320px"><a class="btn btn-main" style="width:100%" href="' + esc(waLink(sellMsg)) + '" target="_blank" rel="noopener">' + ic('users') + 'Quiero ser vendedor</a></div>' +
      '</div></div></section>' +

      '<section style="padding-top:8px"><div class="wrap"><div class="sec-head"><h2 class="h2">Preguntas frecuentes</h2></div><div class="faq">' +
      '<details><summary>¿Tengo que pagar algo para empezar?</summary><p>No. Sumarte es gratis. Solo pagás la mercadería que pedís, cuando la retirás.</p></details>' +
      '<details><summary>¿Hay pedido mínimo?</summary><p class="num">Sí, ' + money(cfg.settings.minOrder) + ', para que cualquiera pueda arrancar.</p></details>' +
      '<details><summary>¿Cómo pago?</summary><p>' + esc(c.payments || 'Transferencia, Mercado Pago o efectivo al retirar.') + '</p></details>' +
      '<details><summary>¿Y si un producto viene fallado?</summary><p>Lo cambiamos. Traelo con tu número de pedido dentro de ' + esc(c.changes || '7 días') + '.</p></details>' +
      '<details><summary>¿Tengo que conseguir más revendedores?</summary><p>No. Ganás vendiendo productos, no sumando gente.</p></details>' +
      '</div></div></section>';
  }

  function catalog() {
    var hasOffers = products.some(onOffer), hasCombos = products.some(function (p) { return p.combo; });
    var cats = ['Todo'].concat(hasOffers ? ['Ofertas'] : [], hasCombos ? ['Combos'] : [], cfg.categories || []);
    if (cats.indexOf(cat) === -1) cat = 'Todo';
    var q = query.trim().toLowerCase();
    var list = products.filter(function (p) {
      var inCat = cat === 'Todo' || (cat === 'Ofertas' ? onOffer(p) : cat === 'Combos' ? !!p.combo : p.cat === cat);
      return inCat && (!q || (p.name + ' ' + (p.desc || '')).toLowerCase().indexOf(q) !== -1);
    });
    return '<div class="wrap">' +
      '<div class="cat-head"><span class="eyebrow">Precios para revendedores</span><h1 class="h2" style="margin-top:8px">Catálogo</h1>' +
      '<p class="lead" style="margin-top:10px">Tocá un producto para ver el detalle. El precio sugerido es una referencia: vos decidís a cuánto vender.</p>' +
      (cfg.settings.examplePrices ? '<div class="notice">' + ic('info', 20) + '<span>Precios de ejemplo. Los precios reales se confirman al tomar el pedido.</span></div>' : '') +
      '</div>' +
      '<div class="toolbar"><label class="search">' + ic('search', 20) + '<input id="q" type="search" placeholder="Buscar productos" value="' + esc(query) + '" aria-label="Buscar productos"></label>' +
      '<div class="chips">' + cats.map(function (c) {
        return '<button type="button" class="chip' + (c === cat ? ' on' : '') + '" data-act="cat" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div></div>' +
      (list.length ? '<div class="grid" style="padding-bottom:48px">' + list.map(card).join('') + '</div>'
        : '<div class="empty">No encontramos productos con esa búsqueda.</div>') +
      '</div>';
  }

  function footer() {
    var c = cfg.contact;
    var ig = c.instagram ? '@' + String(c.instagram).replace('@', '') : '';
    return '<footer><div class="wrap foot">' +
      '<div><b>' + esc(cfg.brand.name) + '</b><div>' + esc(cfg.brand.tagline) + '</div></div>' +
      '<div>' + (c.address ? esc(c.address) + (c.area ? ', ' + esc(c.area) : '') + '<br>' : '') +
      (c.whatsappDisplay || c.whatsapp ? 'WhatsApp ' + esc(c.whatsappDisplay || c.whatsapp) : '') +
      (ig ? (c.whatsappDisplay || c.whatsapp ? ' · ' : '') + 'Instagram ' + esc(ig) : '') + '</div>' +
      '</div></footer>';
  }

  function cartbar() {
    var t = cartTotals();
    if (!t.count || cartOpen || view === 'admin' || detailId) return '';
    return '<div class="cartbar"><div class="cartbar-in">' +
      '<div class="cartbar-info num"><b>' + t.count + ' producto' + (t.count > 1 ? 's' : '') + ' · ' + money(t.total) + '</b><br><span class="g">Ganás ' + money(t.gain) + ' vendiendo al sugerido</span></div>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="open-cart">Ver mi pedido</button>' +
      '</div></div>';
  }

  function detailModal() {
    if (!detailId) return '';
    var p = prodById(detailId);
    if (!p) return '';
    return '<div class="modal-wrap" data-act="close-detail"><div class="modal detail" role="dialog" aria-modal="true" aria-label="' + esc(p.name) + '" data-stop="1">' +
      '<button class="x x-float" type="button" data-act="close-detail" aria-label="Cerrar">' + ic('x') + '</button>' +
      '<div class="detail-pic"><img src="' + esc(imgOf(p)) + '" alt="' + esc(p.name) + '">' + stockBadge(p) + '</div>' +
      '<div class="detail-body">' +
      '<span class="card-cat">' + esc(p.cat) + '</span>' +
      '<h2 style="font-size:28px">' + esc(p.name) + '</h2>' +
      (p.desc ? '<p style="color:var(--ink-2);font-size:17px;white-space:pre-line">' + (p.combo ? '<b>Incluye:</b> ' : '') + esc(p.desc) + '</p>' : '') +
      '<div class="detail-prices">' +
      '<div><span class="price-lbl">Tu precio' + (onOffer(p) ? ' · oferta hasta el ' + ddmm(p.offerUntil) : '') + '</span><span class="price-row">' + priceHtml(p) + '</span></div>' +
      '<div><span class="price-lbl">Precio sugerido de venta</span><span class="price num" style="color:var(--ink-2)">' + money(p.sug) + '</span></div>' +
      '</div>' +
      '<div class="gain-box"><span>Ganás por unidad</span><b class="num">' + money(gain(p)) + '</b></div>' +
      qtyControl(p, true) +
      '<button class="share" type="button" data-act="share" data-id="' + esc(p.id) + '">' + ic('share', 16) + 'Imagen para compartir en mis estados</button>' +
      ((cart[p.id] || 0) > 0 ? '<button class="btn btn-dark btn-sm" type="button" data-act="open-cart">Ver mi pedido</button>' : '') +
      '</div></div></div>';
  }

  function checkoutState() {
    var t = cartTotals(), short = Math.max(0, (Number(cfg.settings.minOrder) || 0) - t.total);
    var hint = !digits(cfg.contact.whatsapp) ? 'Falta cargar el WhatsApp del negocio en el panel.'
      : short ? ''
      : !String(buyer.name || '').trim() ? 'Escribí tu nombre para enviar el pedido.'
      : digits(buyer.phone).length < 8 ? 'Escribí tu WhatsApp para que te avisemos cuando esté listo.'
      : 'Se abre WhatsApp con el pedido escrito: solo tocás Enviar.';
    return { ready: !!(t.count && !short && String(buyer.name || '').trim() && digits(buyer.phone).length >= 8 && digits(cfg.contact.whatsapp)), hint: hint };
  }
  function orderMessage(code) {
    var t = cartTotals();
    var lines = cartLines().map(function (l) { return '• ' + l.q + ' x ' + l.p.name + ' (' + money(priceOf(l.p)) + ' c/u)'; });
    return 'Hola ' + cfg.brand.name + '! Te mando mi pedido' + (code ? ' #' + code : '') + ':\n\n' + lines.join('\n') +
      '\n\nTotal: ' + money(t.total) +
      '\nNombre: ' + (buyer.name || '') + (buyer.barrio ? '\nBarrio: ' + buyer.barrio : '') +
      '\nRetiro en el depósito.';
  }

  function drawer() {
    if (!cartOpen) return '';
    if (lastOrder && !cartLines().length) {
      return '<div class="scrim" data-act="close-cart"><aside class="drawer" role="dialog" aria-modal="true" aria-label="Pedido enviado" data-stop="1">' +
        '<div class="drawer-head"><h2>Pedido #' + esc(lastOrder.code) + '</h2><button class="x" type="button" data-act="close-cart" aria-label="Cerrar">' + ic('x') + '</button></div>' +
        '<div class="drawer-body"><div class="sent">' + ic('check', 40) +
        '<h3>¡Listo! Tu pedido quedó registrado</h3>' +
        '<p>Si WhatsApp no se abrió o no lo enviaste, tocá el botón para mandarlo. Te confirmamos stock y día de retiro.</p>' +
        '<a class="btn btn-main" href="' + esc(lastOrder.link) + '" target="_blank" rel="noopener">' + ic('wa') + 'Abrir WhatsApp de nuevo</a>' +
        '<button class="btn btn-line btn-sm" type="button" data-act="new-order">Hacer otro pedido</button>' +
        '</div></div></aside></div>';
    }
    var lines = cartLines(), t = cartTotals();
    var min = Number(cfg.settings.minOrder) || 0;
    var short = Math.max(0, min - t.total);
    var body = lines.length ? lines.map(function (l) {
      return '<div class="line"><img src="' + esc(imgOf(l.p)) + '" alt=""><div class="line-info"><b>' + esc(l.p.name) + '</b><span class="num">' + money(priceOf(l.p)) + ' c/u · ganás ' + money(gain(l.p) * l.q) + '</span></div>' +
        '<div class="mini-qty"><button type="button" data-act="dec" data-id="' + esc(l.p.id) + '" aria-label="Quitar uno">−</button><span class="num">' + l.q + '</span><button type="button" data-act="inc" data-id="' + esc(l.p.id) + '" aria-label="Agregar uno">+</button></div></div>';
    }).join('') : '<div class="empty">Tu pedido está vacío. Sumá productos desde el catálogo.</div>';
    var cs = checkoutState(); var ready = cs.ready, hint = cs.hint;
    return '<div class="scrim" data-act="close-cart"><aside class="drawer" role="dialog" aria-modal="true" aria-label="Mi pedido" data-stop="1">' +
      '<div class="drawer-head"><h2>Mi pedido</h2><button class="x" type="button" data-act="close-cart" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="drawer-body">' + body + '</div>' +
      (lines.length ? '<div class="drawer-foot">' +
        '<div class="tot num"><span>Total a pagar</span><b>' + money(t.total) + '</b></div>' +
        '<div class="tot g num"><span>Tu ganancia vendiendo al sugerido</span><span>' + money(t.gain) + '</span></div>' +
        (short ? '<div class="min-warn num">Te faltan ' + money(short) + ' para el pedido mínimo de ' + money(min) + '.</div>' : '') +
        '<div class="fields"><div class="fld"><label for="b-name">Tu nombre</label><input id="b-name" data-buyer="name" value="' + esc(buyer.name) + '" autocomplete="name"></div>' +
        '<div class="fld"><label for="b-phone">Tu WhatsApp</label><input id="b-phone" data-buyer="phone" type="tel" inputmode="tel" value="' + esc(buyer.phone || '') + '" autocomplete="tel" placeholder="11 2345-6789"></div>' +
        '<div class="fld" style="grid-column:1 / -1"><label for="b-barrio">Barrio</label><input id="b-barrio" data-buyer="barrio" value="' + esc(buyer.barrio) + '"></div></div>' +
        '<button id="send-order" class="btn btn-main" type="button" data-act="send-order"' + (ready && !sending ? '' : ' disabled') + '>' + ic('wa') + (sending ? 'Enviando…' : 'Enviar pedido por WhatsApp') + '</button>' +
        '<small id="send-hint" style="color:var(--ink-3)">' + esc(hint) + '</small>' +
        '</div>' : '') +
      '</aside></div>';
  }

  function shareModal() {
    if (!share) return '';
    var p = prodById(share.id);
    if (!p) return '';
    return '<div class="modal-wrap" data-act="close-share" style="z-index:50"><div class="modal" role="dialog" aria-modal="true" aria-label="Compartir producto" data-stop="1">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">Para tus estados</h2><button class="x" type="button" data-act="close-share" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      (share.img ? '<img src="' + share.img + '" alt="Imagen para compartir: ' + esc(p.name) + '">' : '<div class="empty">Preparando imagen…</div>') +
      '<p style="font-size:14px;color:var(--ink-2)">Mantené apretada la imagen para guardarla. Muestra tu precio de venta, nunca el de depósito.</p>' +
      '<div class="copybox" id="share-text">' + esc(share.text) + '</div>' +
      '<button class="btn btn-dark btn-sm" type="button" data-act="copy-share">Copiar texto</button>' +
      '</div></div>';
  }

  /* ================= panel ================= */
  var loginMode = 'login'; // login | signup | reset
  var loginMsg = '';
  var loginEmail = '', loginPass = '';
  function loginPanel() {
    var body;
    if (!authReady) body = '<p>Cargando…</p>';
    else if (user && !user.emailVerified) {
      body = '<p>Te mandamos un mail a <b>' + esc(user.email) + '</b> para verificar tu cuenta. Abrí el link (revisá también correo no deseado) y después tocá “Ya verifiqué”.</p>' +
        '<div class="ctas"><button class="btn btn-main btn-sm" type="button" data-act="verified">Ya verifiqué</button>' +
        '<button class="btn btn-line btn-sm" type="button" data-act="resend">Reenviar mail</button>' +
        '<button class="btn btn-line btn-sm" type="button" data-act="logout">Salir</button></div>';
    }
    else if (user) body = '<p>Entraste como <b>' + esc(user.email) + '</b>, pero esa cuenta todavía no tiene acceso al panel. Pedile al administrador que te sume en “Equipo” con este mismo mail.</p><button class="btn btn-line btn-sm" type="button" data-act="logout">Salir y entrar con otra cuenta</button>';
    else {
      var title = loginMode === 'signup' ? 'Crear tu acceso' : loginMode === 'reset' ? 'Recuperar contraseña' : 'Ingresar';
      body = '<p style="color:var(--ink-2)">' + (loginMode === 'signup'
        ? 'Usá el mismo mail con el que te sumaron al equipo. Te vamos a mandar un mail para verificarlo.'
        : loginMode === 'reset' ? 'Te mandamos un link para crear una contraseña nueva.'
        : 'Con tu mail y contraseña, o con tu cuenta de Google.') + '</p>' +
        '<form id="login-form" style="display:flex;flex-direction:column;gap:12px" novalidate>' +
        '<div class="fld"><label for="l-email">Mail</label><input id="l-email" type="email" autocomplete="email" required value="' + esc(loginEmail) + '"></div>' +
        (loginMode !== 'reset' ? '<div class="fld"><label for="l-pass">Contraseña' + (loginMode === 'signup' ? ' (mínimo 6 caracteres)' : '') + '</label><input id="l-pass" type="password" autocomplete="' + (loginMode === 'signup' ? 'new-password' : 'current-password') + '" required value="' + esc(loginPass) + '"></div>' : '') +
        '<button class="btn btn-main" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Un momento…' : loginMode === 'signup' ? 'Crear acceso' : loginMode === 'reset' ? 'Mandarme el link' : 'Ingresar') + '</button>' +
        '</form>' +
        (loginMsg ? '<p class="login-msg">' + esc(loginMsg) + '</p>' : '') +
        '<div class="login-links">' +
        (loginMode !== 'login' ? '<button type="button" class="linkbtn" data-act="mode" data-mode="login">Ya tengo acceso: ingresar</button>' : '<button type="button" class="linkbtn" data-act="mode" data-mode="signup">Es mi primera vez: crear acceso</button><button type="button" class="linkbtn" data-act="mode" data-mode="reset">Olvidé mi contraseña</button>') +
        '</div>' +
        '<div class="login-sep"><span>o</span></div>' +
        '<button class="btn btn-line" type="button" data-act="login">Ingresar con Google</button>';
      return '<div class="wrap admin"><div class="panel" style="max-width:460px"><h2>' + title + '</h2>' + body + '</div></div>';
    }
    return '<div class="wrap admin"><div class="panel" style="max-width:520px"><h2>Panel</h2>' + body +
      (loginMsg ? '<p class="login-msg">' + esc(loginMsg) + '</p>' : '') + '</div></div>';
  }
  var AUTH_ERR = {
    'auth/invalid-email': 'Ese mail no es válido.',
    'auth/missing-password': 'Escribí tu contraseña.',
    'auth/weak-password': 'La contraseña tiene que tener al menos 6 caracteres.',
    'auth/email-already-in-use': 'Ese mail ya tiene acceso. Ingresá, o usá “Olvidé mi contraseña”.',
    'auth/invalid-credential': 'Mail o contraseña incorrectos.',
    'auth/wrong-password': 'Mail o contraseña incorrectos.',
    'auth/user-not-found': 'No hay un acceso con ese mail. Tocá “Es mi primera vez”.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
    'auth/operation-not-allowed': 'Este método de ingreso no está activado en Firebase (Authentication → Sign-in method).',
    'auth/unauthorized-domain': 'Falta agregar este dominio en Firebase → Authentication → Settings → Authorized domains.',
    'auth/configuration-not-found': 'Authentication no está configurado en Firebase. Activá los métodos de ingreso.',
    'auth/network-request-failed': 'Sin conexión. Revisá internet y probá de nuevo.'
  };
  function authError(err) {
    var c = err && err.code;
    return AUTH_ERR[c] || ('No se pudo ingresar (' + (c || 'error desconocido') + ').');
  }
  function emailLogin() {
    var em = (document.getElementById('l-email') || {}).value || '';
    var pw = (document.getElementById('l-pass') || {}).value || '';
    em = em.trim().toLowerCase();
    loginMsg = ''; busy = true; render(true);
    var done = function (m) { busy = false; loginMsg = m || ''; render(true); };
    if (loginMode === 'reset') {
      fb.auth.sendPasswordResetEmail(em).then(function () { loginMode = 'login'; done('Listo: revisá tu mail (y correo no deseado) para crear la contraseña nueva.'); }).catch(function (e) { done(authError(e)); });
    } else if (loginMode === 'signup') {
      fb.auth.createUserWithEmailAndPassword(em, pw).then(function (cred) {
        return cred.user.sendEmailVerification();
      }).then(function () { done(''); }).catch(function (e) { done(authError(e)); });
    } else {
      fb.auth.signInWithEmailAndPassword(em, pw).then(function () { done(''); }).catch(function (e) { done(authError(e)); });
    }
  }
  function tabs() {
    var list = [['pedidos', 'Pedidos'], ['revendedores', 'Revendedores'], ['productos', 'Productos']];
    if (isAdmin()) list.push(['negocio', 'Datos y fotos'], ['equipo', 'Equipo']);
    return '<div class="tabs" role="tablist">' + list.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (adminTab === t[0]) + '" class="tab' + (adminTab === t[0] ? ' on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }
  var ROLE_NAME = { owner: 'Dueño', admin: 'Administrador', editor: 'Carga de productos' };
  function adminView() {
    if (!isStaff()) return loginPanel();
    var seedBox = (isAdmin() && (needSeed.cfg || needSeed.products))
      ? '<div class="admin-note">' + ic('info', 20) + '<div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start"><span><b>Primer uso:</b> los datos y productos de ejemplo todavía no están guardados en Firebase.</span><button class="btn btn-main btn-sm" type="button" data-act="seed"' + (busy ? ' disabled' : '') + '>Cargar datos iniciales</button></div></div>' : '';
    var body = adminTab === 'productos' ? productsAdmin()
      : adminTab === 'revendedores' ? resellersAdmin()
      : adminTab === 'negocio' && isAdmin() ? businessAdmin()
      : adminTab === 'equipo' && isAdmin() ? teamAdmin()
      : ordersAdmin();
    return '<div class="wrap admin">' +
      '<div class="admin-top"><div><span class="eyebrow">Panel</span><h1 class="h2" style="margin-top:6px">Hola' + (user.displayName ? ', ' + esc(user.displayName.split(' ')[0]) : '') + '</h1>' +
      '<p style="color:var(--ink-3);font-size:14px;margin-top:6px">' + esc(user.email) + ' · ' + ROLE_NAME[role] + ' · <button type="button" class="linkbtn" data-act="logout">Salir</button></p></div></div>' +
      seedBox + tabs() + body + '</div>';
  }

  var STATUS = { nuevo: 'Nuevo', confirmado: 'Confirmado', listo: 'Listo para retirar', entregado: 'Entregado', cancelado: 'Cancelado' };
  var DAY = 864e5;
  var NOTIFY_LABEL = { nuevo: 'Avisar que lo recibimos', confirmado: 'Avisar que está confirmado', listo: 'Avisar que está listo', entregado: 'Agradecerle la compra', cancelado: 'Escribirle' };
  function oDate(o) { return o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : null; }
  function oKey(o) { var ph = digits(o.phone); return ph ? ph : 'n-' + String(o.name || 'sin nombre').toLowerCase().trim().replace(/[\/\s]+/g, '-').slice(0, 60); }
  function fmtDate(d) { return d ? d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : ''; }
  function waTo(phone, text) {
    var n = digits(phone); if (!n) return '';
    if (n.length === 10) n = '549' + n;           // 11 2345 6789
    else if (n.length === 12 && n.indexOf('54') === 0) n = '549' + n.slice(2);
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text);
  }
  function notifyText(o) {
    var first = String(o.name || '').split(' ')[0];
    var code = '#' + (o.code || o.id.slice(0, 5).toUpperCase());
    var c = cfg.contact;
    if (o.status === 'listo') return 'Hola ' + first + '! Tu pedido ' + code + ' ya está listo para retirar' + (c.address ? ' en ' + c.address : '') + (c.hours ? ' (' + c.hours + ')' : '') + '. Total: ' + money(o.total) + '. ¡Te esperamos!';
    if (o.status === 'entregado') return 'Hola ' + first + '! Gracias por tu compra (' + code + '). Cuando quieras reponer, ya tenés el catálogo actualizado.';
    if (o.status === 'cancelado') return 'Hola ' + first + '. Te escribimos por tu pedido ' + code + '.';
    return 'Hola ' + first + '! Recibimos tu pedido ' + code + ' por ' + money(o.total) + '. Te confirmamos stock y te avisamos cuando esté listo para retirar.';
  }

  function stats() {
    var now = Date.now(), valid = (orders || []).filter(function (o) { return o.status !== 'cancelado'; });
    var s7 = 0, n7 = 0, s30 = 0, n30 = 0, pend = 0, prodMap = {}, people = {};
    (orders || []).forEach(function (o) { if (o.status === 'nuevo' || o.status === 'confirmado' || o.status === 'listo') pend++; });
    valid.forEach(function (o) {
      var d = oDate(o), age = d ? (now - d.getTime()) / DAY : 999;
      if (age <= 7) { s7 += Number(o.total) || 0; n7++; }
      if (age <= 30) {
        s30 += Number(o.total) || 0; n30++;
        (o.items || []).forEach(function (i) { var k = i.name; prodMap[k] = prodMap[k] || { name: k, q: 0, amount: 0 }; prodMap[k].q += i.q; prodMap[k].amount += i.q * (Number(i.price) || 0); });
      }
      var k = oKey(o); people[k] = people[k] || { n: 0, last: 0 }; people[k].n++; if (d && d.getTime() > people[k].last) people[k].last = d.getTime();
    });
    var keys = Object.keys(people);
    var active = keys.filter(function (k) { return now - people[k].last <= 30 * DAY; }).length;
    var repeat = keys.filter(function (k) { return people[k].n >= 2; }).length;
    var top = Object.keys(prodMap).map(function (k) { return prodMap[k]; }).sort(function (a, b) { return b.q - a.q; }).slice(0, 5);
    return { s7: s7, n7: n7, s30: s30, n30: n30, avg: n30 ? s30 / n30 : 0, pend: pend, active: active, buyers: keys.length, repeat: repeat, repeatPct: keys.length ? Math.round(repeat / keys.length * 100) : 0, top: top };
  }
  function tile(label, value, sub) {
    return '<div class="tile"><span class="tile-lbl">' + label + '</span><span class="tile-val num">' + value + '</span>' + (sub ? '<span class="tile-sub num">' + sub + '</span>' : '') + '</div>';
  }
  function summary() {
    var s = stats();
    var maxQ = s.top.length ? s.top[0].q : 1;
    return '<div class="panel"><h2>Resumen</h2>' +
      '<div class="tiles">' +
      tile('Ventas últimos 7 días', money(s.s7), s.n7 + ' pedido' + (s.n7 === 1 ? '' : 's')) +
      tile('Ventas últimos 30 días', money(s.s30), s.n30 + ' pedido' + (s.n30 === 1 ? '' : 's')) +
      tile('Ticket promedio', money(s.avg), 'últimos 30 días') +
      tile('Revendedores activos', String(s.active), 'compraron en 30 días') +
      tile('Recompra', s.repeatPct + '%', s.repeat + ' de ' + s.buyers + ' compraron 2 veces o más') +
      tile('Pedidos pendientes', String(s.pend), 'nuevos, confirmados o listos') +
      '</div>' +
      (s.top.length ? '<h3 class="sub-h">Más vendidos · últimos 30 días</h3><ol class="toplist">' + s.top.map(function (t) {
        return '<li><span class="top-name">' + esc(t.name) + '</span><span class="top-bar" aria-hidden="true"><i style="width:' + Math.max(4, Math.round(t.q / maxQ * 100)) + '%"></i></span><span class="top-val num">' + t.q + ' u. · ' + money(t.amount) + '</span></li>';
      }).join('') + '</ol>' : '') +
      '</div>';
  }
  var oFilter = 'pendientes';
  function ordersAdmin() {
    var head = '<div class="panel"><div class="sec-row" style="margin:0"><h2>Pedidos</h2><button class="btn btn-line btn-sm" type="button" data-act="load-orders">Actualizar</button></div>';
    if (ordersErr) return head + '<p style="color:var(--danger)">' + esc(ordersErr) + '</p></div>';
    if (!orders) return head + '<p>Cargando pedidos…</p></div>';
    if (!orders.length) return head + '<p>Todavía no llegó ningún pedido. Cada pedido enviado desde el carrito aparece acá con su número.</p></div>';
    var filters = [['pendientes', 'Pendientes'], ['nuevo', 'Nuevos'], ['listo', 'Listos'], ['todos', 'Todos']];
    var list = orders.filter(function (o) {
      if (oFilter === 'todos') return true;
      if (oFilter === 'pendientes') return o.status === 'nuevo' || o.status === 'confirmado' || o.status === 'listo';
      return o.status === oFilter;
    });
    return summary() + head +
      '<div class="chips" style="margin-top:4px">' + filters.map(function (f) {
        return '<button type="button" class="chip' + (oFilter === f[0] ? ' on' : '') + '" data-act="ofilter" data-f="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>' +
      (list.length ? '<div class="orders">' + list.map(function (o) {
        var d = oDate(o);
        var when = d ? fmtDate(d) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
        var items = (o.items || []).map(function (i) { return i.q + ' x ' + esc(i.name); }).join('<br>');
        var wa = waTo(o.phone, notifyText(o));
        return '<div class="order st-' + esc(o.status) + '">' +
          '<div class="order-top"><b>#' + esc(o.code || o.id.slice(0, 6).toUpperCase()) + '</b><span class="num">' + when + '</span></div>' +
          '<div><b>' + esc(o.name) + '</b>' + (o.barrio ? ' · ' + esc(o.barrio) : '') + (o.phone ? '<br><span class="num" style="color:var(--ink-3);font-size:14px">' + esc(o.phone) + '</span>' : '') + '</div>' +
          '<div class="order-items">' + items + '</div>' +
          '<div class="order-foot"><b class="num">' + money(o.total) + '</b>' +
          '<select data-order="' + esc(o.id) + '" aria-label="Estado del pedido">' +
          Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (o.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') +
          '</select></div>' +
          (wa ? '<a class="btn btn-line btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener">' + ic('wa', 18) + esc(NOTIFY_LABEL[o.status] || 'Escribirle') + '</a>' : '') +
          '</div>';
      }).join('') + '</div>' : '<div class="empty">No hay pedidos en este filtro.</div>') + '</div>';
  }

  var notes = null, rq = '', rSort = 'recent';
  function loadNotes() {
    fb.db.collection('resellers').get().then(function (snap) {
      notes = {}; snap.docs.forEach(function (d) { notes[d.id] = d.data(); }); if (adminTab === 'revendedores') render(true);
    }).catch(function () { notes = {}; if (adminTab === 'revendedores') render(true); });
  }
  function resellers() {
    var map = {};
    (orders || []).forEach(function (o) {
      var k = oKey(o), d = oDate(o), t = d ? d.getTime() : 0;
      var r = map[k] = map[k] || { key: k, name: o.name, phone: o.phone || '', barrio: o.barrio || '', n: 0, total: 0, last: 0, first: Infinity, cancel: 0 };
      if (t >= r.last) { r.name = o.name || r.name; r.barrio = o.barrio || r.barrio; r.phone = o.phone || r.phone; }
      if (o.status === 'cancelado') { r.cancel++; return; }
      r.n++; r.total += Number(o.total) || 0;
      if (t > r.last) r.last = t; if (t < r.first) r.first = t;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).filter(function (r) { return r.n > 0; });
  }
  function rStatus(r) {
    var days = (Date.now() - r.last) / DAY;
    if (days <= 30) return ['activo', 'Activo', 'check'];
    if (days <= 60) return ['riesgo', 'Hace más de un mes', 'clock'];
    return ['inactivo', 'Inactivo', 'info'];
  }
  function resellersAdmin() {
    if (!orders) return '<div class="panel"><p>Cargando…</p></div>';
    if (notes === null) { loadNotes(); }
    var all = resellers();
    var q = rq.trim().toLowerCase();
    var list = all.filter(function (r) { return !q || (r.name + ' ' + r.barrio + ' ' + r.phone).toLowerCase().indexOf(q) !== -1; });
    list.sort(function (a, b) { return rSort === 'total' ? b.total - a.total : rSort === 'orders' ? b.n - a.n : b.last - a.last; });
    var act = all.filter(function (r) { return rStatus(r)[0] === 'activo'; }).length;
    var risk = all.filter(function (r) { return rStatus(r)[0] === 'riesgo'; }).length;
    return '<div class="panel">' +
      '<div><h2>Revendedores</h2><p class="num" style="color:var(--ink-3);font-size:14px;margin-top:4px">' + all.length + ' revendedores · ' + act + ' activos · ' + risk + ' hace más de un mes sin comprar</p></div>' +
      '<p class="hint">Se arma solo con los pedidos. A los que hace más de un mes que no compran conviene escribirles con la oferta de la semana.</p>' +
      '<div class="toolbar-admin"><label class="search">' + ic('search', 20) + '<input id="rq" type="search" placeholder="Buscar por nombre, barrio o teléfono" value="' + esc(rq) + '" aria-label="Buscar revendedores"></label>' +
      '<label class="qf"><span>Ordenar</span><select id="rsort" aria-label="Ordenar revendedores">' +
      '<option value="recent"' + (rSort === 'recent' ? ' selected' : '') + '>Último pedido</option>' +
      '<option value="total"' + (rSort === 'total' ? ' selected' : '') + '>Total comprado</option>' +
      '<option value="orders"' + (rSort === 'orders' ? ' selected' : '') + '>Cantidad de pedidos</option></select></label></div>' +
      (list.length ? '<div class="rlist">' + list.map(function (r) {
        var st = rStatus(r);
        var first = String(r.name || '').split(' ')[0];
        var offers = products.filter(onOffer).slice(0, 3).map(function (p) { return '• ' + p.name + ' a ' + money(priceOf(p)); });
        var msg = 'Hola ' + first + '! ¿Cómo va? ' + (offers.length ? 'Esta semana tenemos ofertas:\n' + offers.join('\n') + '\n' : 'Ya tenemos el catálogo actualizado. ') + 'Mirá todo en ' + location.origin + '/#catalogo';
        var wa = waTo(r.phone, msg);
        var note = (notes && notes[r.key] && notes[r.key].note) || '';
        return '<div class="rcard">' +
          '<div class="rcard-top"><div><b>' + esc(r.name) + '</b><span>' + esc(r.barrio || 'Sin barrio') + (r.phone ? ' · ' + esc(r.phone) : '') + '</span></div>' +
          '<span class="rstate ' + st[0] + '">' + ic(st[2], 14) + st[1] + '</span></div>' +
          '<div class="rnums num"><div><small>Pedidos</small><b>' + r.n + '</b></div><div><small>Comprado</small><b>' + money(r.total) + '</b></div><div><small>Ticket prom.</small><b>' + money(r.total / r.n) + '</b></div><div><small>Último</small><b>' + fmtDate(new Date(r.last)) + '</b></div></div>' +
          '<div class="fld"><label for="rn-' + esc(r.key) + '">Nota interna</label><input id="rn-' + esc(r.key) + '" data-rnote="' + esc(r.key) + '" value="' + esc(note) + '" placeholder="Ej: vende en la estación Laferrere, prefiere blanquería"></div>' +
          (wa ? '<a class="btn btn-line btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'Escribirle' + (offers.length ? ' con las ofertas' : '') + '</a>' : '<small class="hint">Sin teléfono: pedidos anteriores a esta versión.</small>') +
          '</div>';
      }).join('') + '</div>' : '<div class="empty">' + (all.length ? 'No hay revendedores con esa búsqueda.' : 'Todavía no hay revendedores: aparecen solos con el primer pedido.') + '</div>') +
      '</div>';
  }

  var pq = '';
  function productsAdmin() {
    var q = pq.trim().toLowerCase();
    var list = products.filter(function (p) { return !q || (p.name + ' ' + p.cat).toLowerCase().indexOf(q) !== -1; });
    var nOffer = products.filter(onOffer).length, nOut = products.filter(function (p) { return p.stock === 'out'; }).length;
    return '<div class="panel">' +
      '<div class="sec-row" style="margin:0"><div><h2>Productos</h2><p style="color:var(--ink-3);font-size:14px;margin-top:4px" class="num">' + products.length + ' productos · ' + nOffer + ' en oferta · ' + nOut + ' sin stock</p></div>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="new-prod">' + ic('camera', 18) + 'Cargar producto</button></div>' +
      '<label class="search" style="flex:none">' + ic('search', 20) + '<input id="pq" type="search" placeholder="Buscar en mis productos" value="' + esc(pq) + '" aria-label="Buscar en mis productos"></label>' +
      '<p class="hint">Cambiá precio y stock directo en la lista: se guarda solo. Tocá la foto o el nombre para editar todo.</p>' +
      '<div class="plist">' + (list.length ? list.map(function (p) {
        var pid = esc(p.id);
        return '<div class="prow' + (p.stock === 'out' ? ' is-out' : '') + '">' +
          '<button type="button" class="prow-main" data-act="edit-prod" data-id="' + pid + '">' +
          '<img src="' + esc(imgOf(p)) + '" alt="">' +
          '<span class="prow-info"><b>' + esc(p.name) + '</b><span>' + esc(p.cat) + (p.combo ? ' · Combo' : '') + (onOffer(p) ? ' · Oferta ' + money(p.offer) + ' hasta el ' + ddmm(p.offerUntil) : '') + '</span></span>' +
          ic('edit', 18) + '</button>' +
          '<div class="prow-quick">' +
          '<label class="qf"><span>Precio</span><input type="number" inputmode="numeric" min="0" data-quick="price" data-id="' + pid + '" value="' + esc(p.price) + '" aria-label="Precio revendedor de ' + esc(p.name) + '"></label>' +
          '<label class="qf"><span>Sugerido</span><input type="number" inputmode="numeric" min="0" data-quick="sug" data-id="' + pid + '" value="' + esc(p.sug) + '" aria-label="Precio sugerido de ' + esc(p.name) + '"></label>' +
          '<label class="qf"><span>Stock</span><select data-quick="stock" data-id="' + pid + '" aria-label="Stock de ' + esc(p.name) + '">' +
          '<option value="ok"' + (p.stock === 'ok' ? ' selected' : '') + '>Hay</option>' +
          '<option value="low"' + (p.stock === 'low' ? ' selected' : '') + '>Pocas</option>' +
          '<option value="out"' + (p.stock === 'out' ? ' selected' : '') + '>Sin stock</option></select></label>' +
          '</div></div>';
      }).join('') : '<div class="empty">No hay productos con esa búsqueda.</div>') + '</div></div>';
  }

  function productEditor() {
    if (!editing) return '';
    var p = editing;
    var opts = (cfg.categories || []).map(function (c) { return '<option' + (c === p.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var photo = p.img
      ? '<img src="' + esc(p.img) + '" alt="">'
      : '<span class="photo-empty">' + ic('camera', 36) + '<span>Sin foto</span></span>';
    return '<div class="modal-wrap" style="z-index:55"><div class="modal" role="dialog" aria-modal="true" aria-label="' + (p._new ? 'Cargar producto' : 'Editar producto') + '" data-stop="1" style="width:min(600px,100%)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">' + (p._new ? 'Cargar producto' : 'Editar producto') + '</h2><button class="x" type="button" data-act="close-edit" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="edit-pic">' + photo + '<div class="edit-pic-btns">' +
      '<label class="upload upload-main">' + ic('camera', 18) + (p._uploading ? 'Subiendo…' : p.img ? 'Sacar otra foto' : 'Sacar foto') + '<input type="file" accept="image/*" capture="environment" data-edit-img="1"></label>' +
      '<label class="upload">Elegir de la galería<input type="file" accept="image/*" data-edit-img="1"></label>' +
      '</div></div>' +
      '<div class="form-grid">' +
      '<div class="fld wide"><label for="e-name">Nombre</label><input id="e-name" data-e="name" value="' + esc(p.name) + '" placeholder="Ej: Juego de sábanas 2 plazas"></div>' +
      '<div class="fld"><label for="e-price">Precio revendedor ($)</label><input id="e-price" type="number" inputmode="numeric" min="0" data-e="price" value="' + esc(p.price || '') + '"></div>' +
      '<div class="fld"><label for="e-sug">Precio sugerido ($)</label><input id="e-sug" type="number" inputmode="numeric" min="0" data-e="sug" value="' + esc(p.sug || '') + '"></div>' +
      '<div class="wide pe-gain num" id="e-gain">Ganancia del revendedor: ' + money(gain(p)) + '</div>' +
      '<div class="fld"><label for="e-cat">Rubro</label><select id="e-cat" data-e="cat">' + opts + '</select></div>' +
      '<div class="fld"><label for="e-stock">Stock</label><select id="e-stock" data-e="stock">' +
      '<option value="ok"' + (p.stock === 'ok' ? ' selected' : '') + '>Hay stock</option>' +
      '<option value="low"' + (p.stock === 'low' ? ' selected' : '') + '>Últimas unidades</option>' +
      '<option value="out"' + (p.stock === 'out' ? ' selected' : '') + '>Sin stock</option></select></div>' +
      '<div class="fld wide"><label for="e-desc">' + (p.combo ? 'Qué incluye el combo' : 'Descripción (medidas, material, colores)') + '</label><textarea id="e-desc" data-e="desc">' + esc(p.desc) + '</textarea></div>' +
      '<label class="check"><input type="checkbox" data-e="combo"' + (p.combo ? ' checked' : '') + '>Es un combo</label>' +
      '<label class="check"><input type="checkbox" data-e="featured"' + (p.featured ? ' checked' : '') + '>Destacado en inicio</label>' +
      '</div>' +
      '<fieldset class="offer-box"><legend>Oferta (opcional)</legend><div class="form-grid">' +
      '<div class="fld"><label for="e-offer">Precio de oferta ($)</label><input id="e-offer" type="number" inputmode="numeric" min="0" data-e="offer" value="' + esc(p.offer || '') + '" placeholder="Vacío = sin oferta"></div>' +
      '<div class="fld"><label for="e-until">Válida hasta</label><input id="e-until" type="date" data-e="offerUntil" value="' + esc(p.offerUntil || '') + '"></div>' +
      '</div><small id="e-offer-hint" class="hint">' + offerHint(p) + '</small></fieldset>' +
      '<div class="edit-actions">' +
      (p._new ? '' : '<button class="del" type="button" data-act="del-prod">' + (p._confirmDel ? 'Tocá de nuevo para eliminar' : 'Eliminar') + '</button>') +
      '<span style="flex:1"></span>' +
      (p._new ? '<button class="btn btn-line btn-sm" type="button" data-act="save-prod-next"' + (busy || p._uploading ? ' disabled' : '') + '>Guardar y cargar otro</button>' : '<button class="btn btn-line btn-sm" type="button" data-act="close-edit">Cancelar</button>') +
      '<button class="btn btn-main btn-sm" type="button" data-act="save-prod"' + (busy || p._uploading ? ' disabled' : '') + '>' + (busy ? 'Guardando…' : 'Guardar') + '</button>' +
      '</div></div></div>';
  }
  function offerHint(p) {
    if (!(Number(p.offer) > 0)) return 'Para poner un producto en oferta, cargá el precio rebajado y hasta qué día vale.';
    if (Number(p.offer) >= Number(p.price)) return 'El precio de oferta tiene que ser menor al precio revendedor.';
    if (!p.offerUntil) return 'Elegí hasta qué día vale la oferta.';
    if (p.offerUntil < todayStr()) return 'Esa fecha ya pasó: la oferta no se muestra.';
    return 'Se muestra como oferta hasta el ' + ddmm(p.offerUntil) + '. Ganancia con oferta: ' + money(gain(p)) + '.';
  }

  function f(label, path, opts) {
    opts = opts || {};
    var parts = path.split('.'), v = cfgDraft;
    parts.forEach(function (k) { v = v == null ? '' : v[k]; });
    var id = 'c-' + parts.join('-');
    var input = opts.area
      ? '<textarea id="' + id + '" data-c="' + path + '">' + esc(v) + '</textarea>'
      : '<input id="' + id + '" data-c="' + path + '" type="' + (opts.type || 'text') + '" value="' + esc(v) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>';
    return '<div class="fld' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + '</label>' + input + (opts.help ? '<small style="color:var(--ink-3)">' + esc(opts.help) + '</small>' : '') + '</div>';
  }
  function imgSlot(key, label, square) {
    return '<div class="slot' + (square ? ' sq' : '') + '"><b>' + esc(label) + '</b><img src="' + esc(cfgDraft.images[key]) + '" alt="">' +
      '<label class="upload">' + ic('camera', 18) + 'Cambiar foto<input type="file" accept="image/*" data-cfg-img="' + key + '"></label>' +
      (key !== 'hero' ? '<div class="fld"><label for="cap-' + key + '">Texto sobre la foto</label><input id="cap-' + key + '" data-c="captions.' + key + '" value="' + esc(cfgDraft.captions[key]) + '"></div>' : '') +
      '</div>';
  }
  function cfgBase() { var b = clone(cfg); b.categoriesText = (cfg.categories || []).join(', '); return b; }
  function businessAdmin() {
    if (!cfgDraft) cfgDraft = cfgBase();
    var changed = JSON.stringify(cfgDraft) !== JSON.stringify(cfgBase());
    return '<div class="panel"><h2>Datos del negocio</h2><div class="form-grid">' +
      f('Nombre de la marca', 'brand.name') +
      f('Frase de la marca', 'brand.tagline') +
      f('WhatsApp de pedidos', 'contact.whatsapp', { ph: '5491123456789', help: 'Con 549 + código de área, sin 0 ni 15. Ej: 5491123456789' }) +
      f('WhatsApp como se muestra', 'contact.whatsappDisplay', { ph: '11 2345-6789' }) +
      f('Instagram', 'contact.instagram', { ph: 'elgalpon.ok' }) +
      f('Zona', 'contact.zone', { ph: 'zona sur/oeste' }) +
      f('Dirección del depósito', 'contact.address', { ph: 'Av. Ejemplo 1234' }) +
      f('Barrio / localidad', 'contact.area', { ph: 'Barrio, Partido' }) +
      f('Horario de retiro', 'contact.hours', { ph: 'Lunes a viernes de 9 a 17' }) +
      f('Link de Google Maps (opcional)', 'contact.mapsUrl', { ph: 'https://maps.app.goo.gl/…' }) +
      f('Cómo llegar (opcional)', 'contact.howToGet', { wide: true, ph: 'Colectivos 000 y 000, a 5 cuadras de la estación…' }) +
      f('Formas de pago', 'contact.payments', { wide: true }) +
      f('Plazo para cambios', 'contact.changes', { ph: '7 días' }) +
      f('Pedido mínimo ($)', 'settings.minOrder', { type: 'number' }) +
      f('Rubros (separados por coma)', 'categoriesText', { wide: true }) +
      '<label class="check wide"><input type="checkbox" data-c="settings.examplePrices"' + (cfgDraft.settings.examplePrices ? ' checked' : '') + '>Mostrar aviso de “precios de ejemplo” en el catálogo</label>' +
      '</div></div>' +
      '<div class="panel"><h2>Fotos de la página</h2><p>Reemplazá las de muestra por fotos reales del depósito y del equipo.</p><div class="img-slots">' +
      imgSlot('hero', 'Foto principal', false) + imgSlot('depA', 'Depósito 1', true) + imgSlot('depB', 'Depósito 2', true) + imgSlot('depC', 'Depósito 3', true) +
      '</div></div>' +
      '<div class="savebar"><div class="savebar-in"><div class="savebar-msg">' + (changed ? '<b>Tenés cambios sin publicar.</b>' : 'Todo publicado.') + '</div>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="cfg-discard"' + (changed && !busy ? '' : ' disabled') + '>Descartar</button>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="cfg-save"' + (changed && !busy ? '' : ' disabled') + '>' + (busy ? 'Publicando…' : 'Guardar y publicar') + '</button>' +
      '</div></div>';
  }

  function teamAdmin() {
    var rows = '';
    OWNERS.forEach(function (e) { rows += '<div class="trow"><span><b>' + esc(e) + '</b><br><small>Dueño · definido en el código</small></span></div>'; });
    if (!team) rows += '<p>Cargando…</p>';
    else team.forEach(function (m) {
      rows += '<div class="trow"><span><b>' + esc(m.id) + '</b><br><small>' + (ROLE_NAME[m.role] || m.role) + '</small></span>' +
        '<button class="del" type="button" data-act="del-member" data-id="' + esc(m.id) + '">Quitar</button></div>';
    });
    return '<div class="panel"><h2>Equipo</h2>' +
      '<p>Sumá a las personas que te ayudan. Después entran a esta página en Panel: la primera vez tocan “Es mi primera vez: crear acceso” con ese mismo mail (o usan “Ingresar con Google” si es una cuenta de Google).</p>' +
      '<ul class="roles"><li><b>Carga de productos:</b> agrega y edita productos, precios, fotos y stock, y ve los pedidos.</li><li><b>Administrador:</b> además cambia los datos del negocio, las fotos de la página y el equipo.</li></ul>' +
      '<div class="tlist">' + rows + '</div>' +
      '<div class="form-grid" style="align-items:end">' +
      '<div class="fld"><label for="m-email">Mail</label><input id="m-email" type="email" placeholder="nombre@gmail.com" autocomplete="off"></div>' +
      '<div class="fld"><label for="m-role">Permiso</label><select id="m-role"><option value="editor">Carga de productos</option><option value="admin">Administrador</option></select></div>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="add-member"' + (busy ? ' disabled' : '') + '>' + ic('plus', 18) + 'Sumar al equipo</button>' +
      '</div></div>';
  }

  /* ================= render ================= */
  function render(keepScroll) {
    if (!cfg) return;
    var y = window.scrollY;
    var active = document.activeElement && document.activeElement.id;
    var main = view === 'catalogo' ? catalog() : view === 'admin' ? adminView() : landing();
    var t = cartTotals();
    document.body.classList.toggle('has-cart', !!t.count && view !== 'admin');
    document.body.classList.toggle('lock', !!(cartOpen || detailId || share || editing));
    app.innerHTML = header() + '<main>' + main + '</main>' + (view === 'admin' ? '' : footer()) +
      (view === 'admin' ? '' : '<a class="wa-float" href="' + esc(waLink('Hola ' + cfg.brand.name + '!')) + '" target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp">' + ic('wa', 30) + '</a>') +
      cartbar() + (view === 'admin' ? '' : detailModal()) + drawer() + shareModal() + productEditor();
    if (keepScroll) window.scrollTo(0, y);
    if (active) {
      var el = document.getElementById(active);
      if (el && typeof el.focus === 'function') {
        el.focus({ preventScroll: true });
        if (el.setSelectionRange && (el.type === 'search' || el.type === 'text')) { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
      }
    }
  }
  function setHash(h) { try { history.replaceState(null, '', h ? '#' + h : location.pathname); } catch (e) {} }
  function go(v) {
    view = v; cartOpen = false; share = null; detailId = null;
    setHash(v); render(); window.scrollTo(0, 0);
    if (v === 'admin' && isStaff() && orders === null) loadOrders();
  }

  /* ================= imágenes ================= */
  function loadImg(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }
  function readFile(file) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(file); });
  }
  function cropTo(src, ratio, maxW) {
    return loadImg(src).then(function (im) {
      var sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
      if (sw / sh > ratio) { var nw = sh * ratio; sx = (sw - nw) / 2; sw = nw; } else { var nh = sw / ratio; sy = (sh - nh) / 2; sh = nh; }
      var tw = Math.min(maxW, Math.round(sw)), th = Math.round(tw / ratio);
      var cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
      cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, tw, th);
      return cv.toDataURL('image/jpeg', 0.78);
    });
  }
  function dataUrlToBlob(u) {
    var parts = u.split(','), bin = atob(parts[1]), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: 'image/jpeg' });
  }
  function uploadImage(dataUrl) {
    var ref = fb.storage.ref('img/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.jpg');
    return ref.put(dataUrlToBlob(dataUrl), { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' })
      .then(function () { return ref.getDownloadURL(); })
      .catch(function () { return dataUrl; }); // sin Storage, la foto queda dentro del documento
  }
  function processUpload(file, ratio, max) {
    return readFile(file).then(function (src) { return cropTo(src, ratio, max); }).then(uploadImage);
  }
  function wrapText(g, text, x, y, maxW, lh, maxLines) {
    var words = String(text).split(' '), line = '', lines = [];
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach(function (l, i) { g.fillText(l, x, y + i * lh); });
    return Math.min(lines.length, maxLines);
  }
  function makeShareImage(p) {
    return loadImg(p.img).then(function (im) {
      var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      g.fillStyle = '#FFF8F0'; g.fillRect(0, 0, W, H);
      var s = Math.min(im.naturalWidth, im.naturalHeight);
      g.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, W, 960);
      g.fillStyle = '#1E2A5A'; g.fillRect(0, 960, W, H - 960);
      g.fillStyle = '#FF6B1A'; g.fillRect(0, 960, W, 14);
      g.fillStyle = '#FFFFFF'; g.font = '700 54px Figtree, system-ui, sans-serif';
      var n = wrapText(g, p.name, 64, 1056, W - 128, 62, 2);
      g.fillStyle = '#FF6B1A'; g.font = '800 104px "Bricolage Grotesque", Figtree, system-ui, sans-serif';
      g.fillText(money(p.sug), 64, 1056 + n * 62 + 96);
      g.fillStyle = '#C9CFE6'; g.font = '600 36px Figtree, system-ui, sans-serif';
      g.fillText('Pedímelo por WhatsApp', 64, H - 56);
      return cv.toDataURL('image/jpeg', 0.86);
    });
  }

  /* ================= Firebase: datos ================= */
  function productDoc(p) {
    return {
      name: String(p.name || '').trim() || 'Producto', desc: String(p.desc || ''), cat: p.cat || (cfg.categories || [''])[0],
      price: Number(p.price) || 0, sug: Number(p.sug) || 0, stock: p.stock || 'ok', featured: !!p.featured,
      img: p.img || '', order: typeof p.order === 'number' ? p.order : 0,
      combo: !!p.combo, offer: Number(p.offer) || 0, offerUntil: p.offer ? String(p.offerUntil || '') : ''
    };
  }
  function seed() {
    if (busy) return; busy = true; render(true);
    var batch = fb.db.batch();
    if (needSeed.cfg) batch.set(fb.db.collection('site').doc('main'), cfg);
    if (needSeed.products) products.forEach(function (p, i) { p.order = i + 1; batch.set(fb.db.collection('products').doc(p.id), productDoc(p)); });
    batch.commit().then(function () {
      needSeed = { cfg: false, products: false }; busy = false; setToast('Datos iniciales cargados.');
    }).catch(function (e) { busy = false; setToast(e && e.code === 'permission-denied' ? 'Sin permiso: revisá las reglas de Firestore.' : 'No se pudo guardar. Probá de nuevo.'); });
  }
  function blankProduct(catName) {
    return { id: fb.db.collection('products').doc().id, _new: true, name: '', desc: '', cat: catName || (cfg.categories || [''])[0], price: 0, sug: 0, stock: 'ok', featured: false, combo: false, offer: 0, offerUntil: '', img: '' };
  }
  function saveProduct(next) {
    var p = editing; if (!p || busy) return;
    if (!p.img) { setToast('Sacale una foto al producto antes de guardar.'); return; }
    if (!String(p.name || '').trim()) { setToast('Poné un nombre al producto.'); return; }
    if (!(Number(p.price) > 0)) { setToast('Cargá el precio para el revendedor.'); return; }
    if (Number(p.sug) && Number(p.sug) <= Number(p.price)) { setToast('El precio sugerido tiene que ser mayor al precio revendedor.'); return; }
    if (Number(p.offer) > 0 && (!p.offerUntil || Number(p.offer) >= Number(p.price))) { setToast('Revisá la oferta: precio menor al normal y fecha de fin.'); return; }
    busy = true; render(true);
    var isNew = !!p._new;
    if (isNew) {
      var minOrder = products.reduce(function (m, x) { return Math.min(m, typeof x.order === 'number' ? x.order : 0); }, 0);
      p.order = minOrder - 1;
    }
    var docData = productDoc(p);
    fb.db.collection('products').doc(p.id).set(docData).then(function () {
      docData.id = p.id;
      if (isNew) products.unshift(docData);
      else products = products.map(function (x) { return x.id === p.id ? docData : x; });
      busy = false; editing = next ? blankProduct(p.cat) : null; setToast(isNew ? 'Producto agregado.' : 'Producto guardado.');
    }).catch(function (e) { busy = false; setToast(e && e.code === 'permission-denied' ? 'Tu cuenta no tiene permiso para cargar productos.' : 'No se pudo guardar. Probá de nuevo.'); });
  }
  function deleteProduct() {
    var p = editing; if (!p) return;
    if (!p._confirmDel) { p._confirmDel = true; render(true); return; }
    busy = true; render(true);
    fb.db.collection('products').doc(p.id).delete().then(function () {
      products = products.filter(function (x) { return x.id !== p.id; }); delete cart[p.id]; persistCart();
      busy = false; editing = null; setToast('Producto eliminado.');
    }).catch(function () { busy = false; setToast('No se pudo eliminar.'); });
  }
  function saveCfg() {
    if (busy) return;
    var d = clone(cfgDraft);
    if (typeof d.categoriesText === 'string') {
      d.categories = d.categoriesText.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!d.categories.length) d.categories = cfg.categories;
    }
    delete d.categoriesText;
    d.settings.minOrder = Number(d.settings.minOrder) || 0;
    d.contact.whatsapp = digits(d.contact.whatsapp);
    busy = true; render(true);
    fb.db.collection('site').doc('main').set(d).then(function () {
      cfg = d; cfgDraft = cfgBase();
      busy = false; needSeed.cfg = false; setToast('Datos publicados.');
    }).catch(function (e) { busy = false; setToast(e && e.code === 'permission-denied' ? 'Tu cuenta no puede cambiar los datos del negocio.' : 'No se pudo guardar. Probá de nuevo.'); });
  }
  function loadOrders() {
    if (!fb || !isStaff()) return;
    ordersErr = '';
    fb.db.collection('orders').orderBy('createdAt', 'desc').limit(500).get().then(function (snap) {
      orders = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; });
      if (view === 'admin') render(true);
    }).catch(function () { ordersErr = 'No se pudieron cargar los pedidos.'; if (view === 'admin') render(true); });
  }
  function loadTeam() {
    if (!isAdmin()) return;
    fb.db.collection('team').get().then(function (snap) {
      team = snap.docs.map(function (d) { var m = d.data(); m.id = d.id; return m; });
      render(true);
    }).catch(function () { team = []; render(true); });
  }
  function addMember() {
    var em = (document.getElementById('m-email').value || '').trim().toLowerCase();
    var r = document.getElementById('m-role').value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setToast('Escribí un mail válido.'); return; }
    busy = true; render(true);
    fb.db.collection('team').doc(em).set({ role: r, addedBy: user.email, addedAt: window.firebase.firestore.FieldValue.serverTimestamp() }).then(function () {
      busy = false; team = null; loadTeam(); setToast('Listo. Ya puede entrar con ' + em + '.');
    }).catch(function () { busy = false; setToast('No se pudo sumar. Revisá las reglas de Firestore.'); });
  }
  function sendOrder() {
    if (sending) return;
    var lines = cartLines(); if (!lines.length) return;
    sending = true; render(true);
    var ref = fb ? fb.db.collection('orders').doc() : null;
    var code = ref ? ref.id.slice(0, 5).toUpperCase() : Date.now().toString(36).slice(-5).toUpperCase();
    var msg = orderMessage(code);
    var link = waLink(msg);
    var t = cartTotals();
    var write = ref ? ref.set({
      code: code,
      name: String(buyer.name || '').slice(0, 80),
      barrio: String(buyer.barrio || '').slice(0, 80),
      phone: digits(buyer.phone).slice(0, 15),
      items: lines.slice(0, 50).map(function (l) { return { id: l.p.id, name: String(l.p.name).slice(0, 120), q: l.q, price: priceOf(l.p) }; }),
      total: t.total,
      status: 'nuevo',
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    }) : Promise.resolve();
    var timeout = new Promise(function (res) { setTimeout(res, 2500); });
    Promise.race([write.catch(function () {}), timeout]).then(function () {
      lastOrder = { code: code, link: link };
      try { sessionStorage.setItem('galpon-last-order', JSON.stringify(lastOrder)); } catch (e) {}
      cart = {}; persistCart(); sending = false; cartOpen = true; render(true);
      window.location.href = link;
    });
  }

  /* ================= eventos ================= */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var goEl = t.closest('[data-go]');
    if (goEl) { e.preventDefault(); go(goEl.getAttribute('data-go')); return; }
    var a = t.closest('[data-act]');
    if (!a) return;
    var act = a.getAttribute('data-act');
    if (/^close-/.test(act) && a !== t && t.closest('[data-stop]') && !t.closest('.x') && a.tagName !== 'BUTTON') return;
    var id = a.getAttribute('data-id');
    switch (act) {
      case 'inc': { var p = prodById(id); if (p && p.stock !== 'out') { cart[id] = (cart[id] || 0) + 1; if (lastOrder) { lastOrder = null; try { sessionStorage.removeItem('galpon-last-order'); } catch (er) {} } persistCart(); render(true); } break; }
      case 'dec': cart[id] = Math.max(0, (cart[id] || 0) - 1); if (!cart[id]) delete cart[id]; persistCart(); render(true); break;
      case 'detail': detailId = id; setHash('producto-' + id); render(true); break;
      case 'close-detail': detailId = null; setHash(view); render(true); break;
      case 'open-cart': detailId = null; cartOpen = true; render(true); break;
      case 'close-cart': cartOpen = false; render(true); break;
      case 'new-order': lastOrder = null; try { sessionStorage.removeItem('galpon-last-order'); } catch (er) {} cartOpen = false; go('catalogo'); break;
      case 'send-order': sendOrder(); break;
      case 'cat': cat = a.getAttribute('data-cat'); render(true); break;
      case 'share': {
        var sp = prodById(id);
        share = { id: id, img: '', text: sp.name + (sp.desc ? '\n' + sp.desc : '') + '\nPrecio: ' + money(sp.sug) + '\nPedímelo por acá y te lo consigo.' };
        render(true);
        makeShareImage(sp).then(function (u) { if (share && share.id === id) { share.img = u; render(true); } })
          .catch(function () { if (share && share.id === id) { share.img = sp.img; render(true); } });
        break;
      }
      case 'close-share': share = null; render(true); break;
      case 'copy-share':
        try {
          navigator.clipboard.writeText(share.text).then(function () { a.textContent = 'Copiado'; }, function () { selectText('share-text'); a.textContent = 'Seleccionado: copialo'; });
        } catch (err) { selectText('share-text'); a.textContent = 'Seleccionado: copialo'; }
        break;
      case 'login': {
        var prov = new window.firebase.auth.GoogleAuthProvider();
        prov.setCustomParameters({ prompt: 'select_account' });
        loginMsg = '';
        fb.auth.signInWithPopup(prov).catch(function (err) {
          if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment')) fb.auth.signInWithRedirect(prov);
          else if (err && err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') { loginMsg = authError(err); render(true); }
        });
        break;
      }
      case 'mode': loginMode = a.getAttribute('data-mode'); loginMsg = ''; render(true); break;
      case 'resend':
        if (user) user.sendEmailVerification().then(function () { loginMsg = 'Te reenviamos el mail de verificación.'; render(true); }).catch(function (e) { loginMsg = authError(e); render(true); });
        break;
      case 'verified':
        if (user) user.reload().then(function () { return fb.auth.currentUser.getIdToken(true); }).then(function () {
          user = fb.auth.currentUser;
          if (!user.emailVerified) { loginMsg = 'Todavía no figura verificado. Abrí el link del mail y probá de nuevo.'; render(true); return; }
          loginMsg = ''; resolveRole(user);
        }).catch(function (e) { loginMsg = authError(e); render(true); });
        break;
      case 'logout': loginMsg = ''; loginMode = 'login'; fb.auth.signOut(); break;
      case 'tab': adminTab = a.getAttribute('data-tab'); if (adminTab === 'equipo' && !team) loadTeam(); if (adminTab === 'negocio' && !cfgDraft) cfgDraft = cfgBase(); render(); break;
      case 'load-orders': orders = null; render(true); loadOrders(); break;
      case 'ofilter': oFilter = a.getAttribute('data-f'); render(true); break;
      case 'seed': seed(); break;
      case 'new-prod': editing = blankProduct(); render(true); break;
      case 'cat-go': e.preventDefault(); cat = a.getAttribute('data-cat'); go('catalogo'); break;
      case 'edit-prod': { var ep = prodById(id); if (ep) { editing = clone(ep); render(true); } break; }
      case 'close-edit': editing = null; render(true); break;
      case 'save-prod': saveProduct(false); break;
      case 'save-prod-next': saveProduct(true); break;
      case 'del-prod': deleteProduct(); break;
      case 'cfg-save': saveCfg(); break;
      case 'cfg-discard': cfgDraft = cfgBase(); render(true); break;
      case 'add-member': addMember(); break;
      case 'del-member':
        if (a.getAttribute('data-confirm') !== '1') { a.setAttribute('data-confirm', '1'); a.textContent = '¿Quitar? Tocá de nuevo'; break; }
        fb.db.collection('team').doc(id).delete().then(function () { team = null; loadTeam(); setToast('Quitado del equipo.'); }).catch(function () { setToast('No se pudo quitar.'); });
        break;
    }
  });
  function selectText(id) {
    var el = document.getElementById(id); if (!el) return;
    var r = document.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function setPath(obj, path, value) {
    var parts = path.split('.'), o = obj;
    for (var i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null) o[parts[i]] = {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = value;
  }
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'q') { query = t.value; render(true); return; }
    if (t.id === 'pq') { pq = t.value; render(true); return; }
    if (t.id === 'rq') { rq = t.value; render(true); return; }
    if (t.id === 'l-email') { loginEmail = t.value; return; }
    if (t.id === 'l-pass') { loginPass = t.value; return; }
    if (t.hasAttribute('data-buyer')) {
      buyer[t.getAttribute('data-buyer')] = t.value; persistCart();
      var btn = document.getElementById('send-order'), hint = document.getElementById('send-hint');
      var cs = checkoutState();
      if (btn) btn.disabled = !cs.ready;
      if (hint) hint.textContent = cs.hint;
      return;
    }
    if (t.hasAttribute('data-e') && editing) {
      var k = t.getAttribute('data-e');
      editing[k] = t.type === 'checkbox' ? t.checked : (t.type === 'number' ? (Number(t.value) || 0) : t.value);
      var g = document.getElementById('e-gain'); if (g) g.textContent = 'Ganancia del revendedor: ' + money(gain(editing));
      var oh = document.getElementById('e-offer-hint'); if (oh) oh.textContent = offerHint(editing);
      if (k === 'combo') render(true);
      return;
    }
    if (t.hasAttribute('data-c') && cfgDraft) {
      setPath(cfgDraft, t.getAttribute('data-c'), t.type === 'checkbox' ? t.checked : (t.type === 'number' ? (Number(t.value) || 0) : t.value));
      var sb = document.querySelector('.savebar');
      if (sb) {
        var changed = JSON.stringify(cfgDraft) !== JSON.stringify(cfgBase());
        sb.querySelector('.savebar-msg').innerHTML = changed ? '<b>Tenés cambios sin publicar.</b>' : 'Todo publicado.';
        sb.querySelectorAll('button').forEach(function (b) { b.disabled = !changed || busy; });
      }
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type === 'checkbox' || t.tagName === 'SELECT') t.dispatchEvent(new Event('input', { bubbles: true }));
    if (t.id === 'rsort') { rSort = t.value; render(true); return; }
    if (t.hasAttribute('data-rnote') && fb) {
      var rk = t.getAttribute('data-rnote'), nv = t.value.slice(0, 300);
      fb.db.collection('resellers').doc(rk).set({ note: nv, updatedBy: user ? user.email : '', updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).then(function () {
        notes = notes || {}; notes[rk] = { note: nv }; setToast('Nota guardada.', true);
      }).catch(function () { setToast('No se pudo guardar la nota.', true); });
      return;
    }
    if (t.hasAttribute('data-quick') && fb) {
      var qp = prodById(t.getAttribute('data-id')), field = t.getAttribute('data-quick');
      if (!qp) return;
      var val = field === 'stock' ? t.value : (Number(t.value) || 0);
      if (field !== 'stock' && !(val > 0)) { t.value = qp[field]; setToast('El precio tiene que ser mayor a 0.', true); return; }
      var upd = {}; upd[field] = val;
      fb.db.collection('products').doc(qp.id).update(upd).then(function () {
        qp[field] = val; setToast('Guardado: ' + qp.name, true);
        var row = t.closest('.prow'); if (row && field === 'stock') row.classList.toggle('is-out', val === 'out');
      }).catch(function () { t.value = qp[field]; setToast('No se pudo guardar el cambio.', true); });
      return;
    }
    if (t.hasAttribute('data-order') && fb) {
      var oid = t.getAttribute('data-order'), st = t.value;
      fb.db.collection('orders').doc(oid).update({ status: st }).then(function () {
        (orders || []).forEach(function (o) { if (o.id === oid) o.status = st; }); render(true);
      }).catch(function () { setToast('No se pudo cambiar el estado.'); });
      return;
    }
    if (t.type === 'file' && t.files && t.files[0]) {
      var file = t.files[0];
      if (t.hasAttribute('data-edit-img') && editing) {
        var ed = editing; ed._uploading = true; render(true);
        processUpload(file, 1, 900).then(function (u) { ed.img = u; ed._uploading = false; render(true); })
          .catch(function () { ed._uploading = false; setToast('No se pudo leer esa imagen. Probá con JPG o PNG.'); });
      } else if (t.hasAttribute('data-cfg-img') && cfgDraft) {
        var key = t.getAttribute('data-cfg-img');
        setToast('Subiendo foto…');
        processUpload(file, key === 'hero' ? 1.5 : 1, key === 'hero' ? 1400 : 900).then(function (u) {
          cfgDraft.images[key] = u; setToast('Foto lista. Tocá “Guardar y publicar”.');
        }).catch(function () { setToast('No se pudo leer esa imagen.'); });
      }
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'login-form') { e.preventDefault(); emailLogin(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (editing) editing = null; else if (share) share = null; else if (detailId) { detailId = null; setHash(view); } else if (cartOpen) cartOpen = false; else return;
    render(true);
  });
  window.addEventListener('hashchange', function () {
    var prev = view; readHash();
    if (!(location.hash || '').match(/^#producto-/)) detailId = null;
    render(prev === view);
  });

  /* ================= arranque ================= */
  app.innerHTML = '<div class="wrap" style="padding-block:80px;text-align:center;color:var(--ink-2)">Cargando…</div>';
  function loadStatic() { return fetch('data.json', { cache: 'no-store' }).then(function (r) { return r.json(); }); }
  function fromStatic(d) {
    var c = clone(d); var ps = c.products || []; delete c.products; return { cfg: c, products: ps };
  }
  function start() {
    if (lastOrder && !cartLines().length) cartOpen = true;
    render();
  }
  if (!(window.firebase && window.GALPON_FIREBASE)) {
    loadStatic().then(function (d) { var s = fromStatic(d); cfg = s.cfg; products = s.products; start(); });
    return;
  }
  window.firebase.initializeApp(window.GALPON_FIREBASE);
  fb = { auth: window.firebase.auth(), db: window.firebase.firestore(), storage: window.firebase.storage() };

  Promise.all([
    fb.db.collection('site').doc('main').get().catch(function () { return null; }),
    fb.db.collection('products').orderBy('order').get().catch(function () { return null; })
  ]).then(function (res) {
    var siteSnap = res[0], prodSnap = res[1];
    var needStatic = !(siteSnap && siteSnap.exists) || !(prodSnap && !prodSnap.empty);
    return (needStatic ? loadStatic() : Promise.resolve(null)).then(function (st) {
      var s = st ? fromStatic(st) : null;
      if (siteSnap && siteSnap.exists) {
        cfg = siteSnap.data();
        if (Array.isArray(cfg.products) && !(prodSnap && !prodSnap.empty)) { s = { products: cfg.products }; }
        delete cfg.products;
      } else { cfg = s.cfg; needSeed.cfg = true; }
      if (prodSnap && !prodSnap.empty) products = prodSnap.docs.map(function (d) { var p = d.data(); p.id = d.id; return p; });
      else { products = s.products; needSeed.products = true; }
      cfg.contact = cfg.contact || {}; cfg.settings = cfg.settings || { minOrder: 0 }; cfg.captions = cfg.captions || {}; cfg.images = cfg.images || {};
      start();
      fb.auth.getRedirectResult().catch(function (err) { if (err && err.code) { loginMsg = authError(err); render(true); } });
      fb.auth.onAuthStateChanged(function (u) {
        user = u; role = null; authReady = true;
        if (!u) { orders = null; team = null; render(true); return; }
        resolveRole(u);
      });
    });
  }).catch(function () {
    app.innerHTML = '<div class="wrap" style="padding-block:80px;text-align:center">No se pudo cargar el catálogo. Recargá la página.</div>';
  });
  function resolveRole(u) {
    role = null;
    if (!u.emailVerified) { render(true); return; }
    var em = String(u.email || '').toLowerCase();
    if (OWNERS.indexOf(em) !== -1) { role = 'owner'; afterLogin(); return; }
    fb.db.collection('team').doc(em).get().then(function (d) {
      role = d.exists && (d.data().role === 'admin' || d.data().role === 'editor') ? d.data().role : null;
      afterLogin();
    }).catch(function () { afterLogin(); });
  }
  function afterLogin() {
    if (isStaff()) { loadOrders(); if (adminTab === 'equipo') loadTeam(); }
    render(true);
  }
})();
