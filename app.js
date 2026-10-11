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
  var cart = {}, buyer = { name: '', barrio: '' };
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
  function gain(p) { return (Number(p.sug) || 0) - (Number(p.price) || 0); }
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
    cartLines().forEach(function (l) { t.count += l.q; t.total += l.q * (Number(l.p.price) || 0); t.gain += l.q * gain(l.p); });
    return t;
  }
  function mapsUrl() {
    if (cfg.contact.mapsUrl) return cfg.contact.mapsUrl;
    var a = [cfg.contact.address, cfg.contact.area].filter(Boolean).join(', ');
    return a ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a) : '';
  }
  function setToast(m) { toast = m; render(true); if (m) setTimeout(function () { if (toast === m) { toast = ''; render(true); } }, 4500); }
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
    if (p.stock === 'out') return '<span class="stock out">Sin stock</span>';
    if (p.stock === 'low') return '<span class="stock">Últimas unidades</span>';
    return '';
  }
  function qtyControl(p, big) {
    var q = cart[p.id] || 0, out = p.stock === 'out';
    if (q > 0) return '<div class="qty' + (big ? ' big' : '') + '"><button type="button" data-act="dec" data-id="' + esc(p.id) + '" aria-label="Quitar uno">−</button><span class="num">' + q + '</span><button type="button" data-act="inc" data-id="' + esc(p.id) + '" aria-label="Agregar uno">+</button></div>';
    return '<button class="add' + (big ? ' big' : '') + '" type="button" data-act="inc" data-id="' + esc(p.id) + '"' + (out ? ' disabled' : '') + '>' + (out ? 'Sin stock' : 'Agregar al pedido') + '</button>';
  }
  function card(p) {
    return '<article class="card">' +
      '<button type="button" class="card-open" data-act="detail" data-id="' + esc(p.id) + '" aria-label="Ver ' + esc(p.name) + '">' +
      '<span class="card-pic"><img src="' + esc(p.img) + '" alt="" loading="lazy">' + stockBadge(p) + '</span>' +
      '<span class="card-body">' +
      '<span class="card-cat">' + esc(p.cat) + '</span>' +
      '<span class="card-name">' + esc(p.name) + '</span>' +
      '<span class="price-lbl">Tu precio</span>' +
      '<span class="price num">' + money(p.price) + '</span>' +
      '<span class="sug num">Vendelo a ' + money(p.sug) + '</span>' +
      '<span class="gain num">Ganás ' + money(gain(p)) + '</span>' +
      '<span class="more">Ver detalle</span>' +
      '</span></button>' +
      '<div class="card-actions">' + qtyControl(p) + '</div>' +
      '</article>';
  }

  function landing() {
    var c = cfg.contact, im = cfg.images;
    var feat = products.filter(function (p) { return p.featured; }).slice(0, 4);
    if (!feat.length) feat = products.slice(0, 4);
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
      '<div class="earn-prod"><img src="' + esc(ex.img) + '" alt=""><b>' + esc(ex.name) + '</b></div>' +
      '<div class="row-line"><span>Lo comprás a</span><strong class="num">' + money(ex.price) + '</strong></div>' +
      '<div class="row-line"><span>Lo vendés a</span><strong class="num">' + money(ex.sug) + '</strong></div>' +
      '<div class="gain-box"><span>Ganás por unidad</span><b class="num">' + money(gain(ex)) + '</b></div>' +
      '<p class="earn-note num">Si vendés 10 en el mes, son ' + money(gain(ex) * 10) + ' para vos.</p>' +
      '</div></div></div></section>' +

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
    var cats = ['Todo'].concat(cfg.categories || []);
    var q = query.trim().toLowerCase();
    var list = products.filter(function (p) {
      return (cat === 'Todo' || p.cat === cat) && (!q || (p.name + ' ' + (p.desc || '')).toLowerCase().indexOf(q) !== -1);
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
      '<div class="detail-pic"><img src="' + esc(p.img) + '" alt="' + esc(p.name) + '">' + stockBadge(p) + '</div>' +
      '<div class="detail-body">' +
      '<span class="card-cat">' + esc(p.cat) + '</span>' +
      '<h2 style="font-size:28px">' + esc(p.name) + '</h2>' +
      (p.desc ? '<p style="color:var(--ink-2);font-size:17px">' + esc(p.desc) + '</p>' : '') +
      '<div class="detail-prices">' +
      '<div><span class="price-lbl">Tu precio</span><span class="price num">' + money(p.price) + '</span></div>' +
      '<div><span class="price-lbl">Precio sugerido de venta</span><span class="price num" style="color:var(--ink-2)">' + money(p.sug) + '</span></div>' +
      '</div>' +
      '<div class="gain-box"><span>Ganás por unidad</span><b class="num">' + money(gain(p)) + '</b></div>' +
      qtyControl(p, true) +
      '<button class="share" type="button" data-act="share" data-id="' + esc(p.id) + '">' + ic('share', 16) + 'Imagen para compartir en mis estados</button>' +
      ((cart[p.id] || 0) > 0 ? '<button class="btn btn-dark btn-sm" type="button" data-act="open-cart">Ver mi pedido</button>' : '') +
      '</div></div></div>';
  }

  function orderMessage(code) {
    var t = cartTotals();
    var lines = cartLines().map(function (l) { return '• ' + l.q + ' x ' + l.p.name + ' (' + money(l.p.price) + ' c/u)'; });
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
      return '<div class="line"><img src="' + esc(l.p.img) + '" alt=""><div class="line-info"><b>' + esc(l.p.name) + '</b><span class="num">' + money(l.p.price) + ' c/u · ganás ' + money(gain(l.p) * l.q) + '</span></div>' +
        '<div class="mini-qty"><button type="button" data-act="dec" data-id="' + esc(l.p.id) + '" aria-label="Quitar uno">−</button><span class="num">' + l.q + '</span><button type="button" data-act="inc" data-id="' + esc(l.p.id) + '" aria-label="Agregar uno">+</button></div></div>';
    }).join('') : '<div class="empty">Tu pedido está vacío. Sumá productos desde el catálogo.</div>';
    var ready = lines.length && !short && buyer.name.trim() && digits(cfg.contact.whatsapp);
    var hint = !digits(cfg.contact.whatsapp) ? 'Falta cargar el WhatsApp del negocio en el panel.'
      : short ? '' : !buyer.name.trim() ? 'Escribí tu nombre para enviar el pedido.'
      : 'Se abre WhatsApp con el pedido escrito: solo tocás Enviar.';
    return '<div class="scrim" data-act="close-cart"><aside class="drawer" role="dialog" aria-modal="true" aria-label="Mi pedido" data-stop="1">' +
      '<div class="drawer-head"><h2>Mi pedido</h2><button class="x" type="button" data-act="close-cart" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="drawer-body">' + body + '</div>' +
      (lines.length ? '<div class="drawer-foot">' +
        '<div class="tot num"><span>Total a pagar</span><b>' + money(t.total) + '</b></div>' +
        '<div class="tot g num"><span>Tu ganancia vendiendo al sugerido</span><span>' + money(t.gain) + '</span></div>' +
        (short ? '<div class="min-warn num">Te faltan ' + money(short) + ' para el pedido mínimo de ' + money(min) + '.</div>' : '') +
        '<div class="fields"><div class="fld"><label for="b-name">Tu nombre</label><input id="b-name" data-buyer="name" value="' + esc(buyer.name) + '" autocomplete="name"></div>' +
        '<div class="fld"><label for="b-barrio">Barrio</label><input id="b-barrio" data-buyer="barrio" value="' + esc(buyer.barrio) + '"></div></div>' +
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
    var list = [['pedidos', 'Pedidos'], ['productos', 'Productos']];
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
      : adminTab === 'negocio' && isAdmin() ? businessAdmin()
      : adminTab === 'equipo' && isAdmin() ? teamAdmin()
      : ordersAdmin();
    return '<div class="wrap admin">' +
      '<div class="admin-top"><div><span class="eyebrow">Panel</span><h1 class="h2" style="margin-top:6px">Hola' + (user.displayName ? ', ' + esc(user.displayName.split(' ')[0]) : '') + '</h1>' +
      '<p style="color:var(--ink-3);font-size:14px;margin-top:6px">' + esc(user.email) + ' · ' + ROLE_NAME[role] + ' · <button type="button" class="linkbtn" data-act="logout">Salir</button></p></div></div>' +
      seedBox + tabs() + body + '</div>';
  }

  var STATUS = { nuevo: 'Nuevo', confirmado: 'Confirmado', listo: 'Listo para retirar', entregado: 'Entregado', cancelado: 'Cancelado' };
  function ordersAdmin() {
    var head = '<div class="panel"><div class="sec-row" style="margin:0"><h2>Pedidos</h2><button class="btn btn-line btn-sm" type="button" data-act="load-orders">Actualizar</button></div>';
    if (ordersErr) return head + '<p style="color:var(--danger)">' + esc(ordersErr) + '</p></div>';
    if (!orders) return head + '<p>Cargando pedidos…</p></div>';
    if (!orders.length) return head + '<p>Todavía no llegó ningún pedido. Cada pedido enviado desde el carrito aparece acá con su número.</p></div>';
    var open = 0, tot = 0;
    orders.forEach(function (o) { if (o.status === 'nuevo' || o.status === 'confirmado' || o.status === 'listo') open++; if (o.status !== 'cancelado') tot += Number(o.total) || 0; });
    return head + '<p class="num">' + open + ' pendientes · ' + orders.length + ' en total · ' + money(tot) + ' vendidos (sin cancelados)</p>' +
      '<div class="orders">' + orders.map(function (o) {
        var d = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : null;
        var when = d ? d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
        var items = (o.items || []).map(function (i) { return i.q + ' x ' + esc(i.name); }).join('<br>');
        return '<div class="order st-' + esc(o.status) + '">' +
          '<div class="order-top"><b>#' + esc(o.code || o.id.slice(0, 6).toUpperCase()) + '</b><span class="num">' + when + '</span></div>' +
          '<div><b>' + esc(o.name) + '</b>' + (o.barrio ? ' · ' + esc(o.barrio) : '') + '</div>' +
          '<div class="order-items">' + items + '</div>' +
          '<div class="order-foot"><b class="num">' + money(o.total) + '</b>' +
          '<select data-order="' + esc(o.id) + '" aria-label="Estado del pedido">' +
          Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (o.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') +
          '</select></div></div>';
      }).join('') + '</div></div>';
  }

  function productsAdmin() {
    return '<div class="panel"><div class="sec-row" style="margin:0"><h2>Productos (' + products.length + ')</h2>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="new-prod">' + ic('plus', 18) + 'Agregar producto</button></div>' +
      '<div class="plist">' + products.map(function (p) {
        return '<button type="button" class="prow" data-act="edit-prod" data-id="' + esc(p.id) + '">' +
          '<img src="' + esc(p.img) + '" alt="">' +
          '<span class="prow-info"><b>' + esc(p.name) + '</b><span class="num">' + money(p.price) + ' · vende a ' + money(p.sug) + ' · ' + esc(p.cat) + '</span></span>' +
          '<span class="prow-st ' + esc(p.stock) + '">' + (p.stock === 'out' ? 'Sin stock' : p.stock === 'low' ? 'Pocas' : 'Stock') + '</span>' +
          ic('edit', 18) + '</button>';
      }).join('') + '</div></div>';
  }

  function productEditor() {
    if (!editing) return '';
    var p = editing;
    var opts = (cfg.categories || []).map(function (c) { return '<option' + (c === p.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    return '<div class="modal-wrap" style="z-index:55"><div class="modal" role="dialog" aria-modal="true" aria-label="Editar producto" data-stop="1" style="width:min(560px,100%)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">' + (p._new ? 'Nuevo producto' : 'Editar producto') + '</h2><button class="x" type="button" data-act="close-edit" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="edit-pic"><img src="' + esc(p.img) + '" alt=""><label class="upload">' + ic('camera', 18) + (p._uploading ? 'Subiendo…' : 'Cambiar foto') + '<input type="file" accept="image/*" data-edit-img="1"></label></div>' +
      '<div class="form-grid">' +
      '<div class="fld wide"><label for="e-name">Nombre</label><input id="e-name" data-e="name" value="' + esc(p.name) + '"></div>' +
      '<div class="fld wide"><label for="e-desc">Descripción</label><textarea id="e-desc" data-e="desc">' + esc(p.desc) + '</textarea></div>' +
      '<div class="fld"><label for="e-cat">Rubro</label><select id="e-cat" data-e="cat">' + opts + '</select></div>' +
      '<div class="fld"><label for="e-stock">Stock</label><select id="e-stock" data-e="stock">' +
      '<option value="ok"' + (p.stock === 'ok' ? ' selected' : '') + '>Hay stock</option>' +
      '<option value="low"' + (p.stock === 'low' ? ' selected' : '') + '>Últimas unidades</option>' +
      '<option value="out"' + (p.stock === 'out' ? ' selected' : '') + '>Sin stock</option></select></div>' +
      '<div class="fld"><label for="e-price">Precio revendedor ($)</label><input id="e-price" type="number" inputmode="numeric" min="0" data-e="price" value="' + esc(p.price) + '"></div>' +
      '<div class="fld"><label for="e-sug">Precio sugerido ($)</label><input id="e-sug" type="number" inputmode="numeric" min="0" data-e="sug" value="' + esc(p.sug) + '"></div>' +
      '<div class="wide pe-gain num" id="e-gain">Ganancia del revendedor: ' + money(gain(p)) + '</div>' +
      '<label class="check wide"><input type="checkbox" data-e="featured"' + (p.featured ? ' checked' : '') + '>Destacado en la página de inicio</label>' +
      '</div>' +
      '<div class="edit-actions">' +
      (p._new ? '' : '<button class="del" type="button" data-act="del-prod">' + (p._confirmDel ? 'Tocá de nuevo para eliminar' : 'Eliminar') + '</button>') +
      '<span style="flex:1"></span>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="close-edit">Cancelar</button>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="save-prod"' + (busy || p._uploading ? ' disabled' : '') + '>' + (busy ? 'Guardando…' : 'Guardar') + '</button>' +
      '</div></div></div>';
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
      cartbar() + (view === 'admin' ? '' : detailModal()) + drawer() + shareModal() + productEditor() +
      (toast ? '<div class="toast" role="status">' + esc(toast) + '</div>' : '');
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
      img: p.img || '', order: typeof p.order === 'number' ? p.order : 0
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
  function saveProduct() {
    var p = editing; if (!p || busy) return;
    if (!String(p.name || '').trim()) { setToast('Poné un nombre al producto.'); return; }
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
      busy = false; editing = null; setToast(isNew ? 'Producto agregado.' : 'Producto guardado.');
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
    fb.db.collection('orders').orderBy('createdAt', 'desc').limit(150).get().then(function (snap) {
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
      items: lines.slice(0, 50).map(function (l) { return { id: l.p.id, name: String(l.p.name).slice(0, 120), q: l.q, price: Number(l.p.price) || 0 }; }),
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
      case 'seed': seed(); break;
      case 'new-prod': editing = { id: fb.db.collection('products').doc().id, _new: true, name: '', desc: '', cat: (cfg.categories || [''])[0], price: 0, sug: 0, stock: 'ok', featured: false, img: cfg.images.depB }; render(true); break;
      case 'edit-prod': { var ep = prodById(id); if (ep) { editing = clone(ep); render(true); } break; }
      case 'close-edit': editing = null; render(true); break;
      case 'save-prod': saveProduct(); break;
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
    if (t.id === 'l-email') { loginEmail = t.value; return; }
    if (t.id === 'l-pass') { loginPass = t.value; return; }
    if (t.hasAttribute('data-buyer')) {
      buyer[t.getAttribute('data-buyer')] = t.value; persistCart();
      var btn = document.getElementById('send-order'), hint = document.getElementById('send-hint');
      var tt = cartTotals(), short = Math.max(0, (Number(cfg.settings.minOrder) || 0) - tt.total);
      var ok = tt.count && !short && buyer.name.trim() && digits(cfg.contact.whatsapp);
      if (btn) btn.disabled = !ok;
      if (hint) hint.textContent = !digits(cfg.contact.whatsapp) ? 'Falta cargar el WhatsApp del negocio en el panel.' : short ? '' : !buyer.name.trim() ? 'Escribí tu nombre para enviar el pedido.' : 'Se abre WhatsApp con el pedido escrito: solo tocás Enviar.';
      return;
    }
    if (t.hasAttribute('data-e') && editing) {
      var k = t.getAttribute('data-e');
      editing[k] = t.type === 'checkbox' ? t.checked : (t.type === 'number' ? (Number(t.value) || 0) : t.value);
      var g = document.getElementById('e-gain'); if (g) g.textContent = 'Ganancia del revendedor: ' + money(gain(editing));
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
