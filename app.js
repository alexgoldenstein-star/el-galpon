(function () {
  'use strict';
  var RESET = ':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px/1.4 system-ui,-apple-system,sans-serif}img{max-width:100%}[hidden]{display:none!important}';
  var app = document.getElementById('app');
  var stateEl = document.getElementById('site-state');
  var STANDALONE = !stateEl;
  var data = stateEl ? JSON.parse(stateEl.textContent) : null;
  var savedJSON = data ? JSON.stringify(data) : '';
  var view = 'inicio';
  var cat = 'Todo';
  var query = '';
  var cart = {};
  var buyer = { name: '', barrio: '' };
  var canEdit = false;
  var artifactApi = null;
  var cartOpen = false;
  var share = null; // {id, img, text}
  var saveState = { busy: false, msg: '', kind: '' };

  try { cart = JSON.parse(sessionStorage.getItem('galpon-cart') || '{}') || {}; } catch (e) { cart = {}; }
  try { buyer = JSON.parse(sessionStorage.getItem('galpon-buyer') || 'null') || buyer; } catch (e) {}

  var h0 = (location.hash || '').replace('#', '');
  if (h0 === 'catalogo' || h0 === 'admin' || h0 === 'inicio') view = h0;

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-AR'); }
  function txt(v, ph) { return (v && String(v).trim()) ? esc(v) : '<span class="ph">' + esc(ph) + '</span>'; }
  function dirty() { return JSON.stringify(data) !== savedJSON; }
  function persist() {
    try { sessionStorage.setItem('galpon-cart', JSON.stringify(cart)); sessionStorage.setItem('galpon-buyer', JSON.stringify(buyer)); } catch (e) {}
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function waLink(text) {
    var n = digits(data.contact.whatsapp);
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text);
  }
  function prodById(id) {
    for (var i = 0; i < data.products.length; i++) if (data.products[i].id === id) return data.products[i];
    return null;
  }
  function gain(p) { return (Number(p.sug) || 0) - (Number(p.price) || 0); }
  function cartLines() {
    var out = [];
    Object.keys(cart).forEach(function (id) {
      var p = prodById(id);
      if (p && cart[id] > 0) out.push({ p: p, q: cart[id] });
    });
    return out;
  }
  function cartTotals() {
    var t = { count: 0, total: 0, gain: 0 };
    cartLines().forEach(function (l) { t.count += l.q; t.total += l.q * l.p.price; t.gain += l.q * gain(l.p); });
    return t;
  }
  function mapsUrl() {
    if (data.contact.mapsUrl) return data.contact.mapsUrl;
    var a = [data.contact.address, data.contact.area].filter(Boolean).join(', ');
    return a ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a) : '';
  }

  var IC = {
    house: '<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9 20v-6h6v6"/>',
    bag: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
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
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.7-4.9-4-5.7"/>'
  };
  function ic(name, size) {
    var s = size || 22;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[name] + '</svg>';
  }

  /* ---------- pieces ---------- */
  function header() {
    var t = cartTotals();
    return '<header class="top"><div class="wrap top-in">' +
      '<a class="logo" href="#inicio" data-go="inicio"><span class="logo-mark">' + ic('house', 24) + '</span><span class="logo-name">' + esc(data.brand.name) + '</span></a>' +
      '<nav class="nav" aria-label="Secciones">' +
      '<a href="#inicio" data-go="inicio" class="' + (view === 'inicio' ? 'on' : '') + '">Inicio</a>' +
      '<a href="#catalogo" data-go="catalogo" class="' + (view === 'catalogo' ? 'on' : '') + '">Catálogo</a>' +
      (canEdit ? '<a href="#admin" data-go="admin" class="' + (view === 'admin' ? 'on' : '') + '">Administrar' + (dirty() ? ' •' : '') + '</a>' : '') +
      '</nav>' +
      '<button class="cart-btn" type="button" data-act="open-cart" aria-label="Ver mi pedido">' + ic('bag') + (t.count ? '<span class="badge num">' + t.count + '</span>' : '') + '</button>' +
      '</div></header>';
  }

  function card(p, compact) {
    var q = cart[p.id] || 0;
    var out = p.stock === 'out';
    var stock = out ? '<span class="stock out">Sin stock</span>' : (p.stock === 'low' ? '<span class="stock">Últimas unidades</span>' : '');
    var actions = compact ? '' :
      '<div class="card-actions">' +
      (q > 0
        ? '<div class="qty"><button type="button" data-act="dec" data-id="' + esc(p.id) + '" aria-label="Quitar uno">−</button><span class="num">' + q + '</span><button type="button" data-act="inc" data-id="' + esc(p.id) + '" aria-label="Agregar uno">+</button></div>'
        : '<button class="add" type="button" data-act="inc" data-id="' + esc(p.id) + '"' + (out ? ' disabled' : '') + '>' + (out ? 'Sin stock' : 'Agregar al pedido') + '</button>') +
      '<button class="share" type="button" data-act="share" data-id="' + esc(p.id) + '">' + ic('share', 16) + 'Compartir</button>' +
      '</div>';
    return '<article class="card">' +
      '<div class="card-pic"><img src="' + p.img + '" alt="' + esc(p.name) + '" loading="lazy">' + stock + '</div>' +
      '<div class="card-body">' +
      '<span class="card-cat">' + esc(p.cat) + '</span>' +
      '<span class="card-name">' + esc(p.name) + '</span>' +
      (p.desc ? '<span class="card-desc">' + esc(p.desc) + '</span>' : '') +
      '<span class="price-lbl">Tu precio</span>' +
      '<span class="price num">' + money(p.price) + '</span>' +
      '<span class="sug num">Vendelo a ' + money(p.sug) + '</span>' +
      '<span class="gain num">Ganás ' + money(gain(p)) + '</span>' +
      actions +
      '</div></article>';
  }

  function landing() {
    var c = data.contact, im = data.images;
    var feat = data.products.filter(function (p) { return p.featured; }).slice(0, 4);
    if (!feat.length) feat = data.products.slice(0, 4);
    var ex = feat[0] || data.products[0] || { name: 'Producto', price: 0, sug: 0, img: im.depB };
    var joinMsg = 'Hola ' + data.brand.name + '! Quiero sumarme como revendedor.';
    var sellMsg = 'Hola ' + data.brand.name + '! Quiero ser vendedor en mi zona.';
    return '' +
      '<section class="hero"><div class="wrap hero-grid">' +
      '<div class="hero-copy">' +
      '<span class="pill">' + ic('pin', 16) + 'Depósito en ' + txt(c.zone, 'zona sur/oeste') + ' · Abierto al público</span>' +
      '<h1>Ganá plata extra vendiendo <em>cosas para la casa</em></h1>' +
      '<p class="lead">Bazar, blanquería y cocina a precio de depósito. Elegís del catálogo, retirás y lo vendés a tus vecinos, en el trabajo o en tu barrio. Lo que ganás es tuyo.</p>' +
      '<div class="ctas"><a class="btn btn-main" href="#catalogo" data-go="catalogo">Ver catálogo y precios</a>' +
      '<a class="btn btn-line" href="' + esc(waLink(joinMsg)) + '" target="_blank" rel="noopener">' + ic('wa') + 'Quiero revender</a></div>' +
      '<div class="checks"><span>' + ic('check', 18) + 'No pagás nada para sumarte</span><span>' + ic('check', 18) + 'Pagás cuando ves la mercadería</span></div>' +
      '</div>' +
      '<div class="hero-pic"><img src="' + im.hero + '" alt="Mercadería en el depósito">' +
      '<div class="hero-tag"><span class="ico">' + ic('cash') + '</span><div><b>Ganás ' + money(gain(ex)) + ' por unidad</b><small>vendiendo ' + esc(ex.name.toLowerCase()) + '</small></div></div></div>' +
      '</div></section>' +

      '<div class="band"><div class="wrap band-grid">' +
      '<div class="band-item">' + ic('shield', 32) + '<div><b>Sumarte es gratis</b><span>Sin inscripción, sin cuota y sin kit obligatorio.</span></div></div>' +
      '<div class="band-item">' + ic('cash', 32) + '<div><b>Pagás al retirar</b><span>Venís, ves la mercadería, la pagás y te la llevás.</span></div></div>' +
      '<div class="band-item">' + ic('receipt', 32) + '<div><b>Siempre con comprobante</b><span>Empresa registrada, con razón social y CUIT a la vista.</span></div></div>' +
      '</div></div>' +

      '<section><div class="wrap">' +
      '<div class="sec-head"><span class="eyebrow">Somos un depósito real</span><h2 class="h2">Vení a conocernos antes de comprar</h2>' +
      '<p class="lead">No somos una app ni una promesa. Tenemos depósito con mercadería, gente que te atiende y una dirección donde nos encontrás.</p></div>' +
      '<div class="depot-grid">' +
      '<figure><img src="' + im.depA + '" alt="Depósito"><figcaption>' + esc(data.captions.depA) + '</figcaption></figure>' +
      '<figure><img src="' + im.depB + '" alt="Mercadería"><figcaption>' + esc(data.captions.depB) + '</figcaption></figure>' +
      '<figure><img src="' + im.depC + '" alt="Pedidos listos"><figcaption>' + esc(data.captions.depC) + '</figcaption></figure>' +
      '</div>' +
      '<div class="depot-facts">' +
      '<div class="fact">' + ic('pin', 20) + '<div><small>Dirección</small>' + txt(c.address, 'Dirección del depósito') + '</div></div>' +
      '<div class="fact">' + ic('clock', 20) + '<div><small>Horario de retiro</small>' + txt(c.hours, 'Días y horario') + '</div></div>' +
      '<div class="fact">' + ic('receipt', 20) + '<div><small>Empresa</small>' + txt(c.company, 'Razón social') + ' · CUIT ' + txt(c.cuit, '00-00000000-0') + '</div></div>' +
      '</div></div></section>' +

      '<section style="padding-top:8px"><div class="wrap">' +
      '<div class="sec-head"><h2 class="h2">Cómo funciona</h2></div>' +
      '<div class="steps">' +
      '<div class="step"><span class="step-n">1</span><h3>Elegís del catálogo</h3><p>Ves tu precio, el precio al que conviene venderlo y cuánto ganás en cada producto.</p></div>' +
      '<div class="step"><span class="step-n">2</span><h3>Mandás el pedido por WhatsApp</h3><p>Armás el carrito y se envía armado. Te confirmamos stock, total y día de retiro.</p></div>' +
      '<div class="step"><span class="step-n">3</span><h3>Retirás y vendés</h3><p>Pasás por el depósito, pagás y te lo llevás. Lo vendés a tu precio y la ganancia es tuya.</p></div>' +
      '</div></div></section>' +

      '<section class="earn"><div class="wrap earn-grid">' +
      '<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow green">Cuánto podés ganar</span>' +
      '<h2 class="h2">En cada producto ves tu ganancia antes de comprar</h2>' +
      '<p class="lead">Te sugerimos un precio de venta parecido al que la gente ya ve en internet. La diferencia con tu precio es lo que ganás.</p></div>' +
      '<div><div class="earn-card">' +
      '<div class="earn-prod"><img src="' + ex.img + '" alt=""><b>' + esc(ex.name) + '</b></div>' +
      '<div class="row-line"><span>Lo comprás a</span><strong class="num">' + money(ex.price) + '</strong></div>' +
      '<div class="row-line"><span>Lo vendés a</span><strong class="num">' + money(ex.sug) + '</strong></div>' +
      '<div class="gain-box"><span>Ganás por unidad</span><b class="num">' + money(gain(ex)) + '</b></div>' +
      '<p class="earn-note num">Si vendés 10 en el mes, son ' + money(gain(ex) * 10) + ' para vos. Con tus horarios y sin jefe.</p>' +
      '</div></div></div></section>' +

      '<section><div class="wrap">' +
      '<div class="sec-row"><div class="sec-head" style="margin:0"><span class="eyebrow">Lo más pedido</span><h2 class="h2">Destacados de la semana</h2></div>' +
      '<a class="btn btn-dark btn-sm" href="#catalogo" data-go="catalogo">Ver todo el catálogo</a></div>' +
      '<div class="grid">' + feat.map(function (p) { return card(p, false); }).join('') + '</div>' +
      '</div></section>' +

      '<section class="pickup"><div class="wrap pickup-grid">' +
      '<div><h2 class="h2">Dónde retirar</h2><div class="pick-list">' +
      '<div class="pick-item">' + ic('pin', 26) + '<div><b>' + txt(c.address, 'Dirección del depósito') + '</b><br>' + txt(c.area, 'Barrio / localidad') + '</div></div>' +
      '<div class="pick-item">' + ic('clock', 26) + '<div><b>Horario de retiro</b><br>' + txt(c.hours, 'Días y franja horaria') + '</div></div>' +
      '<div class="pick-item">' + ic('bus', 26) + '<div><b>Cómo llegar</b><br>' + txt(c.howToGet, 'Colectivos, estación de tren y avenida de referencia') + '</div></div>' +
      '</div></div>' +
      '<div><div class="map-card"><span class="map-pin">' + ic('pin', 32) + '</span>' +
      '<b style="font-size:20px">' + txt(c.address, 'Dirección del depósito') + '</b>' +
      '<p style="color:var(--ink-2)">Pedí con tiempo: te avisamos por WhatsApp cuando tu pedido está listo para retirar.</p>' +
      (mapsUrl() ? '<a class="btn btn-main btn-sm" href="' + esc(mapsUrl()) + '" target="_blank" rel="noopener">Abrir en Google Maps</a>' : '') +
      '</div></div>' +
      '</div></section>' +

      '<section><div class="wrap"><div class="sellers">' +
      '<div><span class="eyebrow" style="color:var(--orange)">También buscamos vendedores</span>' +
      '<h2 class="h2">¿Te movés por estaciones, paradas o tu barrio?</h2>' +
      '<p class="lead">Si conocés gente y te gusta vender, sumate como vendedor de ' + esc(data.brand.name) + '. Te damos catálogo y fotos listas para compartir.</p>' +
      '<ul><li>' + ic('check', 18) + 'Material para mostrar en la calle y en tus estados</li><li>' + ic('check', 18) + 'Ganás por cada venta, no por sumar gente</li><li>' + ic('check', 18) + 'Retirás en el depósito cuando tenés pedidos</li></ul></div>' +
      '<div style="flex:0 1 320px"><a class="btn btn-main" style="width:100%" href="' + esc(waLink(sellMsg)) + '" target="_blank" rel="noopener">' + ic('users') + 'Quiero ser vendedor</a></div>' +
      '</div></div></section>' +

      '<section style="padding-top:8px"><div class="wrap"><div class="sec-head"><h2 class="h2">Preguntas frecuentes</h2></div><div class="faq">' +
      '<details><summary>¿Tengo que pagar algo para empezar?</summary><p>No. Sumarte es gratis. Solo pagás la mercadería que pedís, cuando la retirás.</p></details>' +
      '<details><summary>¿Hay pedido mínimo?</summary><p class="num">Sí, ' + money(data.settings.minOrder) + ', para que cualquiera pueda arrancar.</p></details>' +
      '<details><summary>¿Cómo pago?</summary><p>' + txt(c.payments, 'Transferencia, Mercado Pago o efectivo al retirar.') + '</p></details>' +
      '<details><summary>¿Y si un producto viene fallado?</summary><p>Lo cambiamos. Traelo con tu número de pedido dentro de ' + txt(c.changes, '7 días') + '.</p></details>' +
      '<details><summary>¿Tengo que conseguir más revendedores?</summary><p>No. Ganás vendiendo productos, no sumando gente.</p></details>' +
      '</div></div></section>';
  }

  function catalog() {
    var cats = ['Todo'].concat(data.categories);
    var q = query.trim().toLowerCase();
    var list = data.products.filter(function (p) {
      return (cat === 'Todo' || p.cat === cat) && (!q || (p.name + ' ' + (p.desc || '')).toLowerCase().indexOf(q) !== -1);
    });
    return '<div class="wrap">' +
      '<div class="cat-head"><span class="eyebrow">Precios para revendedores</span><h1 class="h2" style="margin-top:8px">Catálogo</h1>' +
      '<p class="lead" style="margin-top:10px">Elegí, sumá al pedido y mandalo por WhatsApp. El precio sugerido es una referencia: vos decidís a cuánto vender.</p>' +
      (data.settings.examplePrices ? '<div class="notice">' + ic('info', 20) + '<span>Precios de ejemplo. Los precios reales se confirman por WhatsApp al tomar el pedido.</span></div>' : '') +
      '</div>' +
      '<div class="toolbar"><label class="search">' + ic('search', 20) + '<input id="q" type="search" placeholder="Buscar productos" value="' + esc(query) + '" aria-label="Buscar productos"></label>' +
      '<div class="chips" role="tablist">' + cats.map(function (c) {
        return '<button type="button" class="chip' + (c === cat ? ' on' : '') + '" data-act="cat" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div></div>' +
      (list.length ? '<div class="grid" style="padding-bottom:48px">' + list.map(function (p) { return card(p, false); }).join('') + '</div>'
        : '<div class="empty">No encontramos productos con esa búsqueda.</div>') +
      '</div>';
  }

  function footer() {
    var c = data.contact;
    return '<footer><div class="wrap foot">' +
      '<div><b>' + esc(data.brand.name) + '</b><div>' + esc(data.brand.tagline) + '</div></div>' +
      '<div>' + txt(c.company, 'Razón social') + ' · CUIT ' + txt(c.cuit, '00-00000000-0') + '<br>' + txt(c.address, 'Dirección del depósito') + (c.area ? ', ' + esc(c.area) : '') +
      '<br>WhatsApp ' + txt(c.whatsappDisplay || c.whatsapp, 'número') + ' · Instagram ' + txt(c.instagram ? '@' + c.instagram.replace('@', '') : '', '@usuario') + '</div>' +
      '</div></footer>';
  }

  function cartbar() {
    var t = cartTotals();
    if (!t.count || cartOpen || view === 'admin') return '';
    return '<div class="cartbar"><div class="cartbar-in">' +
      '<div class="cartbar-info num"><b>' + t.count + ' producto' + (t.count > 1 ? 's' : '') + ' · ' + money(t.total) + '</b><br><span class="g">Ganás ' + money(t.gain) + ' si lo vendés al precio sugerido</span></div>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="open-cart">Ver mi pedido</button>' +
      '</div></div>';
  }

  function orderText() {
    var t = cartTotals();
    var lines = cartLines().map(function (l) { return l.q + ' x ' + l.p.name + ' (' + money(l.p.price) + ' c/u)'; });
    return 'Hola ' + data.brand.name + '! Quiero hacer este pedido:\n' + lines.join('\n') +
      '\n\nTotal: ' + money(t.total) +
      '\nNombre: ' + (buyer.name || '') + '\nBarrio: ' + (buyer.barrio || '') + '\nRetiro en el depósito.';
  }

  function drawer() {
    if (!cartOpen) return '';
    var lines = cartLines(), t = cartTotals();
    var min = Number(data.settings.minOrder) || 0;
    var short = Math.max(0, min - t.total);
    var body = lines.length ? lines.map(function (l) {
      return '<div class="line"><img src="' + l.p.img + '" alt=""><div class="line-info"><b>' + esc(l.p.name) + '</b><span class="num">' + money(l.p.price) + ' c/u · ganás ' + money(gain(l.p) * l.q) + '</span></div>' +
        '<div class="mini-qty"><button type="button" data-act="dec" data-id="' + esc(l.p.id) + '" aria-label="Quitar uno">−</button><span class="num">' + l.q + '</span><button type="button" data-act="inc" data-id="' + esc(l.p.id) + '" aria-label="Agregar uno">+</button></div></div>';
    }).join('') : '<div class="empty">Tu pedido está vacío. Sumá productos desde el catálogo.</div>';
    var ready = lines.length && !short && buyer.name.trim();
    return '<div class="scrim" data-act="close-cart"><aside class="drawer" role="dialog" aria-modal="true" aria-label="Mi pedido" data-stop="1">' +
      '<div class="drawer-head"><h2>Mi pedido</h2><button class="x" type="button" data-act="close-cart" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="drawer-body">' + body + '</div>' +
      (lines.length ? '<div class="drawer-foot">' +
        '<div class="tot num"><span>Total a pagar</span><b>' + money(t.total) + '</b></div>' +
        '<div class="tot g num"><span>Tu ganancia vendiendo al sugerido</span><span>' + money(t.gain) + '</span></div>' +
        (short ? '<div class="min-warn num">Te faltan ' + money(short) + ' para el pedido mínimo de ' + money(min) + '.</div>' : '') +
        '<div class="fields"><div class="fld"><label for="b-name">Tu nombre</label><input id="b-name" data-buyer="name" value="' + esc(buyer.name) + '" autocomplete="name"></div>' +
        '<div class="fld"><label for="b-barrio">Barrio</label><input id="b-barrio" data-buyer="barrio" value="' + esc(buyer.barrio) + '"></div></div>' +
        '<a id="send-order" class="btn btn-main" href="' + esc(waLink(orderText())) + '" target="_blank" rel="noopener"' + (ready ? '' : ' aria-disabled="true" style="opacity:.5;pointer-events:none"') + '>' + ic('wa') + 'Enviar pedido por WhatsApp</a>' +
        '<small id="send-hint" style="color:var(--ink-3)">' + (ready ? 'Se abre WhatsApp con el pedido escrito. Te confirmamos stock y día de retiro.' : (buyer.name.trim() ? '' : 'Escribí tu nombre para enviar el pedido.')) + '</small>' +
        '</div>' : '') +
      '</aside></div>';
  }

  function shareModal() {
    if (!share) return '';
    var p = prodById(share.id);
    if (!p) return '';
    return '<div class="modal-wrap" data-act="close-share"><div class="modal" role="dialog" aria-modal="true" aria-label="Compartir producto" data-stop="1">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">Para tus estados</h2><button class="x" type="button" data-act="close-share" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      (share.img ? '<img src="' + share.img + '" alt="Imagen para compartir: ' + esc(p.name) + '">' : '<div class="empty">Preparando imagen…</div>') +
      '<p style="font-size:14px;color:var(--ink-2)">Mantené apretada la imagen para guardarla y subila a tus estados. Muestra tu precio de venta, nunca el precio de depósito.</p>' +
      '<div class="copybox" id="share-text">' + esc(share.text) + '</div>' +
      '<button class="btn btn-dark btn-sm" type="button" data-act="copy-share">Copiar texto</button>' +
      '</div></div>';
  }

  /* ---------- admin ---------- */
  function fld(label, path, value, opts) {
    opts = opts || {};
    var id = 'f-' + path.replace(/\./g, '-');
    var input = opts.area
      ? '<textarea id="' + id + '" data-bind="' + path + '">' + esc(value) + '</textarea>'
      : '<input id="' + id + '" data-bind="' + path + '" type="' + (opts.type || 'text') + '" value="' + esc(value) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.type === 'number' ? ' inputmode="numeric" min="0"' : '') + '>';
    return '<div class="fld' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + '</label>' + input + '</div>';
  }
  function slot(key, label, square) {
    return '<div class="slot' + (square ? ' sq' : '') + '"><b>' + esc(label) + '</b><img src="' + data.images[key] + '" alt="">' +
      '<label class="upload">' + ic('camera', 18) + 'Cambiar foto<input type="file" accept="image/*" data-img="' + key + '"></label>' +
      (key !== 'hero' ? '<div class="fld"><label for="cap-' + key + '">Texto sobre la foto</label><input id="cap-' + key + '" data-bind="captions.' + key + '" value="' + esc(data.captions[key]) + '"></div>' : '') +
      '</div>';
  }
  function prodEditor(p) {
    var opts = data.categories.map(function (c) { return '<option' + (c === p.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var pid = esc(p.id);
    return '<div class="prod-edit">' +
      '<div class="pe-pic"><img src="' + p.img + '" alt=""><label class="upload">' + ic('camera', 18) + 'Foto<input type="file" accept="image/*" data-pimg="' + pid + '"></label></div>' +
      '<div class="pe-fields">' +
      '<div class="fld wide"><label for="pn-' + pid + '">Nombre</label><input id="pn-' + pid + '" data-p="' + pid + '" data-f="name" value="' + esc(p.name) + '"></div>' +
      '<div class="fld wide"><label for="pd-' + pid + '">Descripción corta</label><input id="pd-' + pid + '" data-p="' + pid + '" data-f="desc" value="' + esc(p.desc) + '"></div>' +
      '<div class="fld"><label for="pc-' + pid + '">Rubro</label><select id="pc-' + pid + '" data-p="' + pid + '" data-f="cat">' + opts + '</select></div>' +
      '<div class="fld"><label for="pp-' + pid + '">Precio revendedor ($)</label><input id="pp-' + pid + '" type="number" inputmode="numeric" min="0" data-p="' + pid + '" data-f="price" value="' + esc(p.price) + '"></div>' +
      '<div class="fld"><label for="ps-' + pid + '">Precio sugerido ($)</label><input id="ps-' + pid + '" type="number" inputmode="numeric" min="0" data-p="' + pid + '" data-f="sug" value="' + esc(p.sug) + '"></div>' +
      '<div class="fld"><label for="pk-' + pid + '">Stock</label><select id="pk-' + pid + '" data-p="' + pid + '" data-f="stock">' +
      '<option value="ok"' + (p.stock === 'ok' ? ' selected' : '') + '>Hay stock</option>' +
      '<option value="low"' + (p.stock === 'low' ? ' selected' : '') + '>Últimas unidades</option>' +
      '<option value="out"' + (p.stock === 'out' ? ' selected' : '') + '>Sin stock</option></select></div>' +
      '<span class="pe-gain num" id="pg-' + pid + '">Ganancia: ' + money(gain(p)) + '</span>' +
      '<label class="check"><input type="checkbox" data-p="' + pid + '" data-f="featured"' + (p.featured ? ' checked' : '') + '>Destacado en inicio</label>' +
      '<button class="del" type="button" data-act="del-prod" data-id="' + pid + '">Eliminar producto</button>' +
      '</div></div>';
  }
  function admin() {
    if (!canEdit) {
      return '<div class="wrap admin"><div class="panel"><h2>Administrar</h2><p>Esta sección es solo para quien administra la página. Abrila desde tu cuenta para editar los datos y los productos.</p></div></div>';
    }
    var c = data.contact;
    return '<div class="wrap admin">' +
      '<div><span class="eyebrow">Panel del administrador</span><h1 class="h2" style="margin-top:8px">Administrar la página</h1>' +
      '<p class="lead" style="margin-top:10px">' + (STANDALONE
        ? 'Los cambios se ven al instante en Inicio y Catálogo, solo en este navegador. Cuando termines, tocá “Descargar data.json” y subilo a GitHub reemplazando el anterior: Vercel publica en 1 minuto.'
        : 'Los cambios se ven al instante en Inicio y Catálogo. Tocá “Guardar y publicar” para que los vean todos.') + '</p></div>' +
      '<div class="admin-note">' + ic('info', 20) + '<span>Las fotos del depósito son de muestra. Reemplazalas por fotos reales del depósito y del equipo: es lo que más confianza genera.</span></div>' +

      '<div class="panel"><h2>Datos del negocio</h2><div class="form-grid">' +
      fld('Nombre de la marca', 'brand.name', data.brand.name) +
      fld('Frase de la marca', 'brand.tagline', data.brand.tagline) +
      fld('WhatsApp (con código de país, solo números)', 'contact.whatsapp', c.whatsapp, { ph: '5491123456789' }) +
      fld('WhatsApp como se muestra', 'contact.whatsappDisplay', c.whatsappDisplay, { ph: '11 2345-6789' }) +
      fld('Instagram', 'contact.instagram', c.instagram, { ph: 'elgalpon.ok' }) +
      fld('Zona', 'contact.zone', c.zone, { ph: 'zona sur/oeste' }) +
      fld('Dirección del depósito', 'contact.address', c.address, { ph: 'Av. Ejemplo 1234' }) +
      fld('Barrio / localidad', 'contact.area', c.area, { ph: 'Barrio, Partido' }) +
      fld('Horario de retiro', 'contact.hours', c.hours, { ph: 'Lunes a viernes de 9 a 17, sábados de 9 a 13' }) +
      fld('Link de Google Maps (opcional)', 'contact.mapsUrl', c.mapsUrl, { ph: 'https://maps.app.goo.gl/…' }) +
      fld('Cómo llegar', 'contact.howToGet', c.howToGet, { wide: true, ph: 'Colectivos 000 y 000, a 5 cuadras de la estación…' }) +
      fld('Razón social', 'contact.company', c.company) +
      fld('CUIT', 'contact.cuit', c.cuit, { ph: '30-00000000-0' }) +
      fld('Formas de pago', 'contact.payments', c.payments, { wide: true }) +
      fld('Plazo para cambios', 'contact.changes', c.changes, { ph: '7 días' }) +
      fld('Pedido mínimo ($)', 'settings.minOrder', data.settings.minOrder, { type: 'number' }) +
      '<label class="check wide"><input type="checkbox" data-bind="settings.examplePrices"' + (data.settings.examplePrices ? ' checked' : '') + '>Mostrar aviso de “precios de ejemplo” en el catálogo</label>' +
      '</div></div>' +

      '<div class="panel"><h2>Fotos</h2><p>Se ajustan solas al tamaño de la página.</p><div class="img-slots">' +
      slot('hero', 'Foto principal', false) + slot('depA', 'Depósito 1', true) + slot('depB', 'Depósito 2', true) + slot('depC', 'Depósito 3', true) +
      '</div></div>' +

      '<div class="panel"><div class="sec-row" style="margin:0"><h2>Productos (' + data.products.length + ')</h2>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="add-prod">' + ic('plus', 18) + 'Agregar producto</button></div>' +
      data.products.map(prodEditor).join('') +
      '</div>' +
      '</div>';
  }
  function savebar() {
    if (view !== 'admin' || !canEdit) return '';
    var d = dirty();
    var msg = saveState.msg ? '<b>' + esc(saveState.msg) + '</b>'
      : STANDALONE ? (d ? '<b>Tenés cambios guardados en este navegador.</b> Descargá data.json para publicarlos.' : 'Sin cambios. Editá y después descargá data.json.')
      : (d ? '<b>Tenés cambios sin publicar.</b> Por ahora solo los ves vos.' : 'Todo publicado.');
    return '<div class="savebar"><div class="savebar-in"><div class="savebar-msg" id="save-msg">' + msg + '</div>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="discard"' + (d && !saveState.busy ? '' : ' disabled') + '>Descartar</button>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="save"' + ((d || STANDALONE) && !saveState.busy ? '' : ' disabled') + '>' + (saveState.busy ? 'Publicando…' : STANDALONE ? 'Descargar data.json' : 'Guardar y publicar') + '</button>' +
      '</div></div>';
  }

  /* ---------- render ---------- */
  function render(keepScroll) {
    var y = window.scrollY;
    var active = document.activeElement && document.activeElement.id;
    var main = view === 'catalogo' ? catalog() : view === 'admin' ? admin() : landing();
    var t = cartTotals();
    document.body.classList.toggle('has-cart', !!t.count && view !== 'admin');
    app.innerHTML = header() + '<main>' + main + '</main>' + (view === 'admin' ? '' : footer()) +
      (view === 'admin' ? '' : '<a class="wa-float" href="' + esc(waLink('Hola ' + data.brand.name + '!')) + '" target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp">' + ic('wa', 30) + '</a>') +
      cartbar() + savebar() + drawer() + shareModal();
    if (keepScroll) window.scrollTo(0, y);
    if (active) {
      var el = document.getElementById(active);
      if (el && typeof el.focus === 'function') {
        el.focus();
        if (el.setSelectionRange && (el.type === 'search' || el.type === 'text')) { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
      }
    }
  }
  function go(v) {
    view = v; cartOpen = false; share = null;
    try { history.replaceState(null, '', '#' + v); } catch (e) {}
    render(); window.scrollTo(0, 0);
  }
  function refreshSaveBar() {
    var sb = document.querySelector('.savebar');
    if (sb) sb.outerHTML = savebar();
    var nav = document.querySelector('.nav a[data-go="admin"]');
    if (nav) nav.textContent = 'Administrar' + (dirty() ? ' •' : '');
  }

  /* ---------- images ---------- */
  function loadImg(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
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
      return cv.toDataURL('image/jpeg', 0.74);
    });
  }
  function wrapText(g, text, x, y, maxW, lh, maxLines) {
    var words = text.split(' '), line = '', lines = [];
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
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
      g.textAlign = 'right'; g.fillStyle = '#FFFFFF'; g.font = '800 40px "Bricolage Grotesque", Figtree, sans-serif';
      g.fillText(data.brand.name, W - 64, H - 56);
      return cv.toDataURL('image/jpeg', 0.86);
    });
  }

  /* ---------- publish ---------- */
  function buildDoc() {
    var css = document.getElementById('site-css').textContent;
    var js = document.getElementById('site-js').textContent;
    var json = JSON.stringify(data).replace(/</g, '\\u003c');
    var fonts = document.getElementById('site-fonts');
    return '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>' + RESET + '</style></head><body>' +
      '<title>' + esc(data.brand.name) + '</title>' +
      '<link id="site-fonts" rel="stylesheet" href="' + esc(fonts ? fonts.getAttribute('href') : '') + '">' +
      '<style id="site-css">' + css + '</style>' +
      '<div id="app"></div>' +
      '<script id="site-state" type="application/json">' + json + '<\/script>' +
      '<script id="site-js">' + js + '<\/script>' +
      '</body></html>';
  }
  function exportJson() {
    var json = JSON.stringify(data, null, 2);
    try {
      var blob = new Blob([json], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'data.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      saveState.msg = 'Se descargó data.json. Subilo a GitHub reemplazando el anterior y Vercel publica en 1 minuto.';
    } catch (e) {
      saveState.msg = 'No se pudo descargar. Probá desde otro navegador.';
    }
    refreshSaveBar();
  }
  function save() {
    if (STANDALONE) { exportJson(); return; }
    if (!dirty() || saveState.busy) return;
    if (!artifactApi) { saveState.msg = 'No se puede publicar desde esta vista. Abrí la página desde tu cuenta de Claude, con permiso de edición.'; refreshSaveBar(); return; }
    saveState.busy = true; saveState.msg = ''; refreshSaveBar();
    try { sessionStorage.setItem('galpon-draft', JSON.stringify(data)); } catch (e) {}
    artifactApi.publish(buildDoc()).then(function () {
      try { sessionStorage.removeItem('galpon-draft'); } catch (e) {}
      savedJSON = JSON.stringify(data); saveState.busy = false; saveState.msg = 'Publicado. La página se actualiza para todos.'; refreshSaveBar();
    }).catch(function (err) {
      saveState.busy = false;
      var code = err && err.code;
      if (code === 'conflict') saveState.msg = 'Otra persona publicó antes. La página se recarga con su versión; tus cambios quedan como borrador.';
      else if (code === 'not_writer' || code === 'not_granted' || code === 'capability_disabled' || code === 'not_declared') saveState.msg = 'Esta vista no tiene permiso para publicar. Abrila desde tu cuenta, con permiso de edición.';
      else if (code === 'too_large') saveState.msg = 'La página quedó muy pesada. Probá con menos fotos o fotos más chicas.';
      else if (code === 'rate_limited') saveState.msg = 'Se publicó muchas veces seguidas. Esperá un minuto y probá de nuevo.';
      else saveState.msg = 'No se pudo publicar. Probá de nuevo en unos segundos.';
      refreshSaveBar();
    });
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var goEl = t.closest('[data-go]');
    if (goEl) { e.preventDefault(); go(goEl.getAttribute('data-go')); return; }
    var a = t.closest('[data-act]');
    if (!a) return;
    var act = a.getAttribute('data-act');
    if ((act === 'close-cart' || act === 'close-share') && a !== t && t.closest('[data-stop]') && !t.closest('.x')) return;
    var id = a.getAttribute('data-id');
    if (act === 'inc') { var p = prodById(id); if (p && p.stock !== 'out') { cart[id] = (cart[id] || 0) + 1; persist(); render(true); } }
    else if (act === 'dec') { cart[id] = Math.max(0, (cart[id] || 0) - 1); if (!cart[id]) delete cart[id]; persist(); render(true); }
    else if (act === 'open-cart') { cartOpen = true; render(true); }
    else if (act === 'close-cart') { cartOpen = false; render(true); }
    else if (act === 'cat') { cat = a.getAttribute('data-cat'); render(true); }
    else if (act === 'share') {
      var sp = prodById(id);
      share = { id: id, img: '', text: sp.name + (sp.desc ? ' (' + sp.desc + ')' : '') + '\nPrecio: ' + money(sp.sug) + '\nPedímelo por acá y te lo consigo.' };
      render(true);
      makeShareImage(sp).then(function (u) { if (share && share.id === id) { share.img = u; render(true); } }).catch(function () {});
    }
    else if (act === 'close-share') { share = null; render(true); }
    else if (act === 'copy-share') {
      var done = function () { a.textContent = 'Copiado'; };
      try {
        navigator.clipboard.writeText(share.text).then(done, function () { selectText('share-text'); a.textContent = 'Seleccionado: copialo'; });
      } catch (err) { selectText('share-text'); a.textContent = 'Seleccionado: copialo'; }
    }
    else if (act === 'add-prod') {
      var nid = 'p' + Date.now().toString(36);
      data.products.unshift({ id: nid, name: 'Producto nuevo', desc: '', cat: data.categories[0], price: 0, sug: 0, stock: 'ok', featured: false, img: data.images.depB });
      render(true);
    }
    else if (act === 'del-prod') {
      if (a.getAttribute('data-confirm') === '1') {
        data.products = data.products.filter(function (x) { return x.id !== id; }); delete cart[id]; render(true);
      } else { a.setAttribute('data-confirm', '1'); a.textContent = 'Tocá de nuevo para eliminar'; }
    }
    else if (act === 'discard') { data = JSON.parse(savedJSON); saveState.msg = ''; render(true); }
    else if (act === 'save') { save(); }
  });
  function selectText(id) {
    var el = document.getElementById(id); if (!el) return;
    var r = document.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }

  function setPath(path, value) {
    var parts = path.split('.'), o = data;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'q') { query = t.value; render(true); return; }
    if (t.hasAttribute('data-buyer')) {
      buyer[t.getAttribute('data-buyer')] = t.value; persist();
      var link = document.getElementById('send-order'), hint = document.getElementById('send-hint');
      var tt = cartTotals(), short = Math.max(0, (Number(data.settings.minOrder) || 0) - tt.total);
      var ready = tt.count && !short && buyer.name.trim();
      if (link) {
        link.setAttribute('href', waLink(orderText()));
        if (ready) { link.removeAttribute('aria-disabled'); link.style.opacity = ''; link.style.pointerEvents = ''; }
        else { link.setAttribute('aria-disabled', 'true'); link.style.opacity = '.5'; link.style.pointerEvents = 'none'; }
      }
      if (hint) hint.textContent = ready ? 'Se abre WhatsApp con el pedido escrito. Te confirmamos stock y día de retiro.' : (buyer.name.trim() ? '' : 'Escribí tu nombre para enviar el pedido.');
      return;
    }
    if (t.hasAttribute('data-bind')) {
      var path = t.getAttribute('data-bind');
      var v = t.type === 'checkbox' ? t.checked : (t.type === 'number' ? (Number(t.value) || 0) : t.value);
      setPath(path, v);
      if (path === 'brand.name') { var ln = document.querySelector('.logo-name'); if (ln) ln.textContent = v; }
      refreshSaveBar(); return;
    }
    if (t.hasAttribute('data-p')) {
      var p = prodById(t.getAttribute('data-p')); if (!p) return;
      var f = t.getAttribute('data-f');
      p[f] = t.type === 'checkbox' ? t.checked : (t.type === 'number' ? (Number(t.value) || 0) : t.value);
      var pg = document.getElementById('pg-' + p.id); if (pg) pg.textContent = 'Ganancia: ' + money(gain(p));
      refreshSaveBar();
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type === 'checkbox' || t.tagName === 'SELECT') { t.dispatchEvent(new Event('input', { bubbles: true })); }
    if (t.type === 'file' && t.files && t.files[0]) {
      var key = t.getAttribute('data-img'), pid = t.getAttribute('data-pimg');
      var ratio = key === 'hero' ? 1.5 : 1, max = key === 'hero' ? 1200 : (pid ? 560 : 720);
      readFile(t.files[0]).then(function (src) { return cropTo(src, ratio, max); }).then(function (u) {
        if (key) data.images[key] = u;
        if (pid) { var p = prodById(pid); if (p) p.img = u; }
        render(true);
      }).catch(function () { saveState.msg = 'No se pudo leer esa imagen. Probá con una foto JPG o PNG.'; refreshSaveBar(); });
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && (cartOpen || share)) { cartOpen = false; share = null; render(true); }
  });
  window.addEventListener('beforeunload', function (e) { if (canEdit && dirty() && !saveState.busy) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- boot ---------- */
  function storeDraft() {
    if (!STANDALONE) return;
    try { if (dirty()) localStorage.setItem('galpon-draft', JSON.stringify(data)); else localStorage.removeItem('galpon-draft'); } catch (e) {}
  }
  document.addEventListener('input', storeDraft);
  document.addEventListener('click', function () { setTimeout(storeDraft, 0); });
  window.addEventListener('change', function () { setTimeout(storeDraft, 400); });
  if (STANDALONE) {
    app.innerHTML = '<div class="wrap" style="padding-block:80px;text-align:center;color:var(--ink-2)">Cargando…</div>';
    fetch('data.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      data = d; savedJSON = JSON.stringify(d);
      canEdit = (location.hash || '') === '#admin';
      if (canEdit) {
        try {
          var dr = localStorage.getItem('galpon-draft');
          if (dr && dr !== savedJSON) { data = JSON.parse(dr); saveState.msg = 'Recuperamos tus cambios sin descargar.'; }
        } catch (e) {}
      } else if (view === 'admin') view = 'inicio';
      render();
    }).catch(function () {
      app.innerHTML = '<div class="wrap" style="padding-block:80px;text-align:center">No se pudo cargar el catálogo. Recargá la página.</div>';
    });
    return;
  }
  render();
  (function boot() {
    var c = window.claude;
    if (!c || typeof c.use !== 'function') return;
    c.use('user').then(function (u) { return u ? u.canEdit() : false; }).catch(function () { return false; }).then(function (ok) {
      canEdit = !!ok;
      if (!canEdit) { if (view === 'admin') view = 'inicio'; render(true); return; }
      try {
        var draft = sessionStorage.getItem('galpon-draft');
        if (draft) { var d = JSON.parse(draft); if (JSON.stringify(d) !== savedJSON) { data = d; saveState.msg = 'Recuperamos tus cambios sin publicar.'; } }
      } catch (e) {}
      return c.use('artifact').then(function (api) { artifactApi = api; }).catch(function () {}).then(function () { render(true); });
    });
  })();
})();
