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
  var sellerCode = null;         // si role === 'seller'
  var sellers = null, sellersMap = {}, clientsMap = null, payouts = null, statsMap = null;
  var sellerData = null, sellerForm = null;
  var refCode = '', refName = '';
  var customer = null, myOrders = null, custForm = null; // cuenta de cliente
  var goCanal = false;           // entró por el QR del canal (?go=canal)
  try { goCanal = new URLSearchParams(location.search).get('go') === 'canal'; } catch (e) {}

  try { cart = JSON.parse(sessionStorage.getItem('galpon-cart') || '{}') || {}; } catch (e) { cart = {}; }
  try { buyer = JSON.parse(localStorage.getItem('galpon-buyer') || 'null') || buyer; } catch (e) {}
  try { lastOrder = JSON.parse(sessionStorage.getItem('galpon-last-order') || 'null'); } catch (e) {}
  if (!buyer.mode) buyer.mode = 'retiro';
  (function captureRef() {
    var code = '';
    try { code = new URLSearchParams(location.search).get('v') || ''; } catch (e) {}
    code = cleanCode(code);
    try {
      if (code) localStorage.setItem('galpon-ref', JSON.stringify({ code: code, at: Date.now() }));
      var r = JSON.parse(localStorage.getItem('galpon-ref') || 'null');
      if (r && r.code && Date.now() - r.at < 90 * 864e5) refCode = r.code;
    } catch (e) { refCode = code; }
    if (code) { buyer.ref = code; try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {} }
    if (!buyer.ref && refCode) buyer.ref = refCode;
  })();
  function cleanCode(c) { return String(c || '').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '').slice(0, 12); }

  function readHash() {
    var h = (location.hash || '').replace('#', '');
    if (h.indexOf('producto-') === 0) { view = 'catalogo'; detailId = h.slice(9); return; }
    if (h === 'catalogo' || h === 'admin' || h === 'inicio' || h === 'contacto' || h === 'cuenta') view = h;
    if (h === 'ingresar' || h === 'mis-pedidos') view = 'cuenta';
    if (h === 'proveedores') { view = 'contacto'; contactType = 'proveedor'; }
    if (h === 'vender') { view = 'contacto'; contactType = 'vendedor'; }
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
  // Nuestro WhatsApp tal como se muestra (en banners, carteles y la web)
  function ourWa() {
    var d = cfg.contact.whatsappDisplay, w = cfg.contact.whatsapp;
    if (!w && !d) return '';
    return d && digits(d) !== digits(w) ? d : fmtPhone(w || d);
  }
  // Canal de difusión: el QR apunta siempre a nuestro sitio (?go=canal) y de ahí salta al canal.
  // Así el QR impreso sirve aunque cambie el link del canal, y el vendedor queda registrado.
  function hasChannel() { return /^https?:\/\//.test(String(cfg.contact.channel || '').trim()); }
  function canalLink(code) { return location.origin + '/?' + (code ? 'v=' + code + '&' : '') + 'go=canal'; }
  function canalMsg(code, name) {
    return 'Hola ' + cfg.brand.name + '! Quiero sumarme a la lista de difusión para recibir el catálogo y las ofertas.' +
      (code ? ' Vengo de parte de ' + (name ? name + ', ' : '') + 'código ' + code + '.' : '');
  }
  function canalTarget(code, name) { return hasChannel() ? String(cfg.contact.channel).trim() : waLink(canalMsg(code, name)); }
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
  function cleanSku(v) { return String(v || '').toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9._\-\/]/g, '').slice(0, 30); }
  function skuTaken(sku, id) { return !!sku && products.some(function (p) { return p.id !== id && cleanSku(p.sku) === sku; }); }
  function prodById(id) { for (var i = 0; i < products.length; i++) if (products[i].id === id) return products[i]; return null; }
  function isStaff() { return role === 'owner' || role === 'admin' || role === 'editor'; }
  function isAdmin() { return role === 'owner' || role === 'admin'; }
  function isSeller() { return role === 'seller'; }
  var COMM_DEFAULT = { base: 10, byCat: { 'Tecno económica': 5 }, override: 2, overrideMonths: 6, clientMonths: 6, payEvery: 'cada 15 días' };
  function comm() { return (cfg && cfg.commissions) || COMM_DEFAULT; }
  function monthsMs(m) { return (Number(m) || 0) * 30 * 864e5; }
  function rateFor(catName) {
    var c = comm(), r = c.byCat ? c.byCat[catName] : undefined;
    return (r === undefined || r === null || r === '') ? (Number(c.base) || 0) : (Number(r) || 0);
  }
  function shipOn() { return !!(cfg && cfg.shipping && cfg.shipping.enabled && (cfg.shipping.zones || []).length); }
  function effMode() { return shipOn() && buyer.mode === 'envio' ? 'envio' : 'retiro'; }
  function zoneByName(n) { return ((cfg.shipping && cfg.shipping.zones) || []).filter(function (z) { return z.name === n; })[0] || null; }
  function shippingCost() { if (effMode() !== 'envio') return 0; var z = zoneByName(buyer.zone); return z ? Number(z.cost) || 0 : 0; }
  function rulesList() {
    var c = comm();
    var ex = Object.keys(c.byCat || {}).filter(function (k) { return c.byCat[k] !== '' && Number(c.byCat[k]) !== Number(c.base) && (cfg.categories || []).indexOf(k) !== -1; });
    var out = [
      'Cobrás ' + c.base + '% sobre lo que compran tus clientes' + (ex.length ? ' (' + ex.map(function (k) { return c.byCat[k] + '% en ' + k; }).join(', ') + ')' : '') + '.',
      'Tus clientes quedan asignados a vos por tu link o tu código, durante ' + c.clientMonths + ' meses desde su última compra.',
      'La comisión se calcula sobre pedidos entregados y cobrados. El costo de envío no suma comisión.'
    ];
    if (Number(c.override) > 0) out.push('Si sumás a otro vendedor, cobrás ' + c.override + '% extra sobre sus ventas durante sus primeros ' + c.overrideMonths + ' meses. Es un solo nivel: no cobrás por los que sume tu equipo.');
    out.push('Liquidamos ' + (c.payEvery || 'cada 15 días') + ', con el detalle de cada pedido.');
    return out;
  }
  function rulesHtml() { return '<ul class="rules">' + rulesList().map(function (r) { return '<li>' + ic('check', 18) + '<span>' + esc(r) + '</span></li>'; }).join('') + '</ul>'; }
  function bump(pid, field) {
    if (!fb || isStaff()) return;
    var k = 'galpon-st-' + field + '-' + pid;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) {}
    var d = {}; d[field] = window.firebase.firestore.FieldValue.increment(1);
    fb.db.collection('stats').doc(pid).set(d, { merge: true }).catch(function () {});
  }
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
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    megaphone: '<path d="M3 10v4h3l7 4V6L6 10H3Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>'
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
      '<a href="#contacto" data-go="contacto" class="' + (view === 'contacto' ? 'on' : '') + '">Contacto</a>' +
      ((isStaff() || isSeller()) ? '<a href="#admin" data-go="admin" class="' + (view === 'admin' ? 'on' : '') + '">Panel</a>' : '') +
      '</nav>' +
      ((isStaff() || isSeller()) ? '' : '<a class="acct-btn' + (view === 'cuenta' ? ' on' : '') + '" href="#cuenta" data-go="cuenta" aria-label="' + (user ? 'Mi cuenta y mis pedidos' : 'Ingresar') + '">' + ic('user', 20) + '<span>' + (user ? 'Mi cuenta' : 'Ingresar') + '</span></a>') +
      (view === 'admin' ? '' : '<button class="cart-btn" type="button" data-act="open-cart" aria-label="Ver mi pedido">' + ic('bag') + (t.count ? '<span class="badge num">' + t.count + '</span>' : '') + '</button>') +
      '</div></header>';
  }

  function stockBadge(p) {
    var b = [];
    if (onOffer(p)) b.push('<span class="badge-offer">Oferta hasta el ' + ddmm(p.offerUntil) + '</span>');
    if (p.combo) b.push('<span class="badge-combo">Combo</span>');
    if (p.stock === 'out') b.push('<span class="stock out">Sin stock</span>');
    else if (p.stock === 'order') b.push('<span class="stock order">Por encargo · ' + (Number(p.leadDays) || 7) + ' días</span>');
    else if (p.stock === 'low') b.push('<span class="stock">Últimas unidades</span>');
    return b.length ? '<span class="badges">' + b.join('') + '</span>' : '';
  }
  function qtyControl(p, big) {
    var q = cart[p.id] || 0, out = p.stock === 'out';
    if (q > 0) return '<div class="qty' + (big ? ' big' : '') + '"><button type="button" data-act="dec" data-id="' + esc(p.id) + '" aria-label="Quitar uno">−</button><span class="num">' + q + '</span><button type="button" data-act="inc" data-id="' + esc(p.id) + '" aria-label="Agregar uno">+</button></div>';
    return '<button class="add' + (big ? ' big' : '') + '" type="button" data-act="inc" data-id="' + esc(p.id) + '"' + (out ? ' disabled' : '') + '>' + (out ? 'Sin stock' : big ? 'Agregar al pedido' : 'Agregar') + '</button>';
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
    var sellMsg = 'Hola ' + cfg.brand.name + '! Quiero ser vendedor en mi zona.';
    return '' +
      '<section class="hero"><div class="wrap hero-grid">' +
      '<div class="hero-copy">' +
      '<span class="pill">' + ic('pin', 16) + 'Trabajamos con feriantes de todo Buenos Aires</span>' +
      '<h1>Ganá plata extra vendiendo <em>cosas para la casa</em></h1>' +
      '<p class="lead">Bazar, blanquería, cocina y tecno a precio de depósito para feriantes y revendedores de todo Buenos Aires. Elegís del catálogo, ' + (shipOn() ? 'retirás o te lo enviamos' : 'retirás en el depósito') + ' y lo vendés en tu puesto o en tu barrio.</p>' +
      '<div class="ctas"><a class="btn btn-main" href="#catalogo" data-go="catalogo">Ver catálogo y precios</a>' +
      '<a class="btn btn-line" href="' + esc(canalTarget(refName ? refCode : '', refName)) + '" target="_blank" rel="noopener">' + ic('wa') + 'Recibir ofertas por WhatsApp</a></div>' +
      '<div class="checks"><span>' + ic('check', 18) + 'Sin cuota ni inscripción</span><span>' + ic('check', 18) + (shipOn() ? 'Retiro o envío a tu zona' : 'Pagás cuando ves la mercadería') + '</span></div>' +
      '</div>' +
      '<div class="hero-pic"><img src="' + esc(im.hero) + '" alt="Mercadería en el depósito">' +
      '<div class="hero-tag"><span class="ico">' + ic('cash') + '</span><div><b>Ganás ' + money(gain(ex)) + ' por unidad</b><small>vendiendo ' + esc(String(ex.name).toLowerCase()) + '</small></div></div></div>' +
      '</div></section>' +

      '<div class="band"><div class="wrap band-grid">' +
      '<div class="band-item">' + ic('shield', 32) + '<div><b>Sumarte es gratis</b><span>Sin inscripción, sin cuota y sin kit obligatorio.</span></div></div>' +
      (shipOn() ? '<div class="band-item">' + ic('truck', 32) + '<div><b>Retiro o envío</b><span>Retirás en el depósito o te lo mandamos con costo según tu zona.</span></div></div>'
        : '<div class="band-item">' + ic('cash', 32) + '<div><b>Pagás al retirar</b><span>Venís, ves la mercadería, la pagás y te la llevás.</span></div></div>') +
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

      brandsSection() +
      '<section style="padding-top:8px"><div class="wrap">' +
      '<div class="sec-head"><h2 class="h2">Cómo funciona</h2></div>' +
      '<div class="steps">' +
      '<div class="step"><span class="step-n">1</span><h3>Elegís del catálogo</h3><p>Ves tu precio, el precio al que conviene venderlo y cuánto ganás.</p></div>' +
      '<div class="step"><span class="step-n">2</span><h3>Mandás el pedido</h3><p>Armás el carrito y lo enviás por WhatsApp con un toque. Te confirmamos stock y día de retiro.</p></div>' +
      '<div class="step"><span class="step-n">3</span><h3>' + (shipOn() ? 'Lo recibís y vendés' : 'Retirás y vendés') + '</h3><p>' + (shipOn() ? 'Pasás por el depósito o te lo enviamos. Lo vendés en tu puesto y la ganancia es tuya.' : 'Pasás por el depósito, pagás y te lo llevás. La ganancia es tuya.') + '</p></div>' +
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
      '<div><h2 class="h2">' + (shipOn() ? 'Retiro y envíos' : 'Dónde retirar') + '</h2><div class="pick-list">' +
      '<div class="pick-item">' + ic('pin', 26) + '<div><b>' + ph(c.address, 'Dirección del depósito') + '</b><br>' + ph(c.area, 'Barrio / localidad') + '</div></div>' +
      '<div class="pick-item">' + ic('clock', 26) + '<div><b>Horario de retiro</b><br>' + ph(c.hours, 'Días y franja horaria') + '</div></div>' +
      (c.howToGet ? '<div class="pick-item">' + ic('bus', 26) + '<div><b>Cómo llegar</b><br>' + esc(c.howToGet) + '</div></div>' : '') +
      '</div>' +
      (shipOn() ? '<div class="ztable"><b>Envíos por zona</b><table><thead><tr><th>Zona</th><th>Costo</th><th>Demora</th></tr></thead><tbody>' +
        cfg.shipping.zones.map(function (z) { return '<tr><td>' + esc(z.name) + '</td><td class="num">' + money(z.cost) + '</td><td>' + esc(z.eta || '—') + '</td></tr>'; }).join('') +
        '</tbody></table>' + (cfg.shipping.note ? '<small class="hint">' + esc(cfg.shipping.note) + '</small>' : '') + '</div>' : '') +
      '</div>' +
      '<div><div class="map-card"><span class="map-pin">' + ic('pin', 32) + '</span>' +
      '<b style="font-size:20px">' + ph(c.address, 'Dirección del depósito') + '</b>' +
      '<p style="color:var(--ink-2)">Te avisamos por WhatsApp cuando tu pedido está listo para retirar.</p>' +
      (mapsUrl() ? '<a class="btn btn-main btn-sm" href="' + esc(mapsUrl()) + '" target="_blank" rel="noopener">Abrir en Google Maps</a>' : '') +
      '</div></div>' +
      '</div></section>' +

      '<section><div class="wrap duo">' +
      '<div class="sellers">' +
      '<div><span class="eyebrow" style="color:var(--orange)">Buscamos vendedores</span>' +
      '<h2 class="h2">Recorré ferias y cobrá comisión</h2>' +
      '<p class="lead">Sumá feriantes como clientes y cobrá por todo lo que compren. Nosotros tomamos los pedidos, entregamos y cobramos.</p>' +
      '<ul><li>' + ic('check', 18) + 'Comisión de ' + comm().base + '% sobre lo que compran tus clientes</li><li>' + ic('check', 18) + 'Tus clientes quedan a tu nombre con tu link o tu código</li><li>' + ic('check', 18) + 'Panel propio con tus ventas y liquidaciones</li></ul>' +
      '<a class="btn btn-main" href="#vender" data-act="contact-go" data-type="vendedor">' + ic('users') + 'Quiero ser vendedor</a></div></div>' +
      '<div class="suppliers">' +
      '<span class="eyebrow">Empresas y proveedores</span>' +
      '<h2 class="h2" style="font-size:clamp(26px,3.2vw,34px)">¿Fabricás o distribuís productos para el hogar?</h2>' +
      '<p>Llegá a una red de feriantes y revendedores de todo Buenos Aires. Compramos bazar, blanquería, cocina, hogar y tecno.</p>' +
      '<a class="btn btn-dark" href="#proveedores" data-act="contact-go" data-type="proveedor">' + ic('truck') + 'Ofrecer mis productos</a>' +
      '</div></div></section>' +

      '<section style="padding-top:8px"><div class="wrap"><div class="sec-head"><h2 class="h2">Preguntas frecuentes</h2></div><div class="faq">' +
      '<details><summary>¿Tengo que pagar algo para empezar?</summary><p>No. Sumarte es gratis. Solo pagás la mercadería que pedís, cuando la retirás.</p></details>' +
      '<details><summary>¿Hay pedido mínimo?</summary><p class="num">Sí, ' + money(cfg.settings.minOrder) + ', para que cualquiera pueda arrancar.</p></details>' +
      '<details><summary>¿Cómo pago?</summary><p>' + esc(c.payments || 'Transferencia, Mercado Pago o efectivo al retirar.') + '</p></details>' +
      '<details><summary>¿Y si un producto viene fallado?</summary><p>Lo cambiamos. Traelo con tu número de pedido dentro de ' + esc(c.changes || '7 días') + '.</p></details>' +
      (shipOn() ? '<details><summary>¿Hacen envíos?</summary><p>Sí. Elegís tu zona en el carrito y el costo se suma al total: ' + cfg.shipping.zones.map(function (z) { return esc(z.name) + ' ' + money(z.cost); }).join(' · ') + '.</p></details>' : '') +
      '<details><summary>¿Cómo funciona para vendedores?</summary><p>' + esc(rulesList().join(' ')) + '</p></details>' +
      '</div></div></section>';
  }

  var BLOCK_MAX = 8;
  function catSlug(c) { return 'cat-' + String(c).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function catBlock(title, items, filterKey, note) {
    var more = items.length > BLOCK_MAX;
    return '<section class="cat-block" id="' + catSlug(title) + '" aria-labelledby="' + catSlug(title) + '-h">' +
      '<div class="cat-block-head"><div><h2 id="' + catSlug(title) + '-h">' + esc(title) + '</h2>' +
      '<span class="cat-count num">' + items.length + ' producto' + (items.length === 1 ? '' : 's') + (note ? ' · ' + esc(note) : '') + '</span></div>' +
      (more && filterKey ? '<button type="button" class="btn btn-line btn-sm" data-act="cat" data-cat="' + esc(filterKey) + '">Ver los ' + items.length + '</button>' : '') +
      '</div>' +
      '<div class="grid">' + items.slice(0, more && filterKey ? BLOCK_MAX : items.length).map(card).join('') + '</div></section>';
  }
  function catalog() {
    var catsAll = cfg.categories || [];
    var inCat = function (c) { return products.filter(function (p) { return p.cat === c; }); };
    var offers = products.filter(onOffer), combos = products.filter(function (p) { return p.combo; });
    var others = products.filter(function (p) { return catsAll.indexOf(p.cat) === -1; });
    var usedCats = catsAll.filter(function (c) { return inCat(c).length; });
    var chips = ['Todo'].concat(offers.length ? ['Ofertas'] : [], combos.length ? ['Combos'] : [], usedCats, others.length ? ['Otros'] : []);
    if (chips.indexOf(cat) === -1) cat = 'Todo';
    var q = query.trim().toLowerCase();
    var match = function (p) { return !q || (p.name + ' ' + (p.desc || '') + ' ' + (p.cat || '')).toLowerCase().indexOf(q) !== -1; };
    var body;
    if (cat === 'Todo' && !q) {
      body = (offers.length ? catBlock('Ofertas', offers, 'Ofertas', 'por tiempo limitado') : '') +
        (combos.length ? catBlock('Combos', combos, 'Combos') : '') +
        usedCats.map(function (c) { return catBlock(c, inCat(c), c); }).join('') +
        (others.length ? catBlock('Otros', others, 'Otros') : '');
      if (!products.length) body = '<div class="empty">Todavía no hay productos cargados.</div>';
    } else {
      var list = products.filter(function (p) {
        var ok = cat === 'Todo' || (cat === 'Ofertas' ? onOffer(p) : cat === 'Combos' ? !!p.combo : cat === 'Otros' ? catsAll.indexOf(p.cat) === -1 : p.cat === cat);
        return ok && match(p);
      });
      var title = q ? 'Resultados para “' + query.trim() + '”' + (cat !== 'Todo' ? ' en ' + cat : '') : cat;
      body = list.length
        ? '<section class="cat-block"><div class="cat-block-head"><div><h2>' + esc(title) + '</h2><span class="cat-count num">' + list.length + ' producto' + (list.length === 1 ? '' : 's') + '</span></div>' +
          '<button type="button" class="linkbtn" data-act="cat-all">Ver todo el catálogo</button></div>' +
          '<div class="grid">' + list.map(card).join('') + '</div></section>'
        : '<div class="empty">No encontramos productos' + (q ? ' con esa búsqueda' : ' en esta categoría') + '. <button type="button" class="linkbtn" data-act="cat-all">Ver todo el catálogo</button></div>';
    }
    return '<div class="wrap">' +
      '<div class="cat-head"><span class="eyebrow">Precios para revendedores</span><h1 class="h2" style="margin-top:8px">Catálogo</h1>' +
      '<p class="lead" style="margin-top:10px">Tocá un producto para ver el detalle. El precio sugerido es una referencia: vos decidís a cuánto vender.</p>' +
      (cfg.settings.examplePrices ? '<div class="notice">' + ic('info', 20) + '<span>Precios de ejemplo. Los precios reales se confirman al tomar el pedido.</span></div>' : '') +
      '</div>' +
      '<div class="toolbar"><label class="search">' + ic('search', 20) + '<input id="q" type="search" placeholder="Buscar productos" value="' + esc(query) + '" aria-label="Buscar productos"></label>' +
      '<div class="chips">' + chips.map(function (c) {
        return '<button type="button" class="chip' + (c === cat ? ' on' : '') + '" data-act="cat" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="cat-body">' + body + '</div>' +
      '</div>';
  }

  /* ================= marcas ================= */
  function brandsSection() {
    var list = (cfg.brands || []).filter(function (b) { return b && (b.logo || b.name); });
    if (!list.length) return '';
    var item = function (b) {
      return '<li class="brand">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="' + esc(b.name || 'Marca') + '" loading="lazy">' : '<span class="brand-word">' + esc(b.name) + '</span>') + '</li>';
    };
    var moving = list.length >= 4;
    var reps = moving ? Math.max(1, Math.ceil(10 / list.length)) : 1, seq = [];
    for (var r = 0; r < reps; r++) seq = seq.concat(list);
    var row = seq.map(item).join('');
    return '<section class="brands-sec" aria-label="Marcas con las que trabajamos"><div class="wrap">' +
      '<p class="brands-title">Trabajamos con marcas que la gente ya conoce</p></div>' +
      '<div class="marquee' + (moving ? ' moving' : '') + '"><ul class="marquee-track">' + row +
      (moving ? '</ul><ul class="marquee-track" aria-hidden="true">' + row : '') + '</ul></div></section>';
  }

  /* ================= contacto ================= */
  var contactType = 'vendedor';
  var contactForm = {};
  var contactSent = null;
  var KINDS = ['Ya vendo o recorro ferias', 'Conozco feriantes o puesteros', 'Quiero empezar de cero', 'Otro'];
  var SOURCES = ['Instagram o Facebook', 'Me invitó otro vendedor', 'Lo vi en una feria', 'Otro'];
  function cv(k) { return contactForm[contactType + '.' + k] || ''; }
  function cfield(label, k, opts) {
    opts = opts || {};
    var id = 'ct-' + k, v = cv(k);
    var input;
    if (opts.options) input = '<select id="' + id + '" data-ct="' + k + '"' + (opts.req ? ' required' : '') + '><option value="">Elegí una opción</option>' + opts.options.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
    else if (opts.area) input = '<textarea id="' + id + '" data-ct="' + k + '" maxlength="600"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>' + esc(v) + '</textarea>';
    else input = '<input id="' + id + '" data-ct="' + k + '" type="' + (opts.type || 'text') + '" value="' + esc(v) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.auto ? ' autocomplete="' + opts.auto + '"' : '') + (opts.type === 'tel' ? ' inputmode="tel"' : '') + ' maxlength="' + (opts.max || 120) + '"' + (opts.req ? ' required' : '') + '>';
    return '<div class="fld' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + (opts.req ? '' : ' <span class="opt">(opcional)</span>') + '</label>' + input + '</div>';
  }
  function contactView() {
    var c = cfg.contact;
    var intro = '<div class="contact-head"><span class="eyebrow">Contacto</span><h1 class="h2" style="margin-top:8px">Hablemos</h1>' +
      '<p class="lead" style="margin-top:10px">Elegí qué buscás y dejanos tus datos. Te respondemos por WhatsApp en menos de 48 horas hábiles.</p></div>';
    var switcher = '<div class="ctype" role="tablist" aria-label="Tipo de contacto">' +
      '<button type="button" role="tab" aria-selected="' + (contactType === 'vendedor') + '" class="ctype-btn' + (contactType === 'vendedor' ? ' on' : '') + '" data-act="ctype" data-type="vendedor">' + ic('users', 26) + '<span><b>Quiero ser vendedor</b><small>Recorrer ferias y cobrar comisión</small></span></button>' +
      '<button type="button" role="tab" aria-selected="' + (contactType === 'proveedor') + '" class="ctype-btn' + (contactType === 'proveedor' ? ' on' : '') + '" data-act="ctype" data-type="proveedor">' + ic('truck', 26) + '<span><b>Soy empresa o proveedor</b><small>Fabricantes, importadores y distribuidores</small></span></button>' +
      '</div>';
    var form;
    if (contactSent && contactSent.type === contactType) {
      form = '<div class="panel sent-card">' + ic('check', 40) +
        '<h2>¡Gracias, ' + esc(String(contactSent.name).split(' ')[0]) + '!</h2>' +
        '<p>Recibimos tus datos. Te escribimos por WhatsApp en menos de 48 horas hábiles.</p>' +
        (contactType === 'vendedor' ? '<a class="btn btn-main" href="#catalogo" data-go="catalogo">Mientras tanto, mirá el catálogo</a>' : '<a class="btn btn-line" href="#inicio" data-go="inicio">Volver al inicio</a>') +
        '<button type="button" class="linkbtn" data-act="ct-again">Enviar otra consulta</button></div>';
    } else if (contactType === 'vendedor') {
      form = '<form id="contact-form" class="panel" novalidate>' +
        '<div><h2>Sumate como vendedor</h2><p style="color:var(--ink-2);margin-top:6px">Visitás ferias, le pasás tu link a los feriantes y cobrás comisión por todo lo que compren. No pagás nada para sumarte.</p></div>' +
        (refName ? '<div class="ref-chip">' + ic('users', 18) + '<span>Te invitó <b>' + esc(refName) + '</b></span></div>' : '') +
        '<div class="rules-box open"><b>Así trabajamos</b>' + rulesHtml() + '</div>' +
        '<div class="form-grid">' +
        cfield('Nombre y apellido', 'name', { req: true, auto: 'name', max: 80 }) +
        cfield('WhatsApp', 'phone', { req: true, type: 'tel', auto: 'tel', ph: '11 2345-6789', max: 20 }) +
        cfield('Ferias o zona que recorrés', 'zone', { req: true, ph: 'Ej: feria de Laferrere, La Salada, Isidro Casanova', max: 80 }) +
        cfield('¿Cuál es tu experiencia?', 'kind', { req: true, options: KINDS }) +
        cfield('¿Cómo nos conociste?', 'source', { options: SOURCES }) +
        cfield('Contanos algo más', 'message', { area: true, wide: true, ph: 'Qué productos te interesan, si ya vendés otras cosas…' }) +
        '</div>' +
        '<input type="text" name="website" id="ct-hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">' +
        '<button class="btn btn-main" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Enviando…' : 'Quiero sumarme') + '</button>' +
        '<p class="hint">Usamos tus datos solo para contactarte por esta consulta.</p>' +
        '</form>';
    } else {
      form = '<form id="contact-form" class="panel" novalidate>' +
        '<div><h2>Trabajemos juntos</h2><p style="color:var(--ink-2);margin-top:6px">Compramos bazar, blanquería, cocina, hogar y tecno para una red de feriantes y revendedores de todo Buenos Aires. Contanos qué ofrecés.</p></div>' +
        '<div class="form-grid">' +
        cfield('Empresa', 'company', { req: true, auto: 'organization', max: 80 }) +
        cfield('Tu nombre', 'name', { req: true, auto: 'name', max: 80 }) +
        cfield('WhatsApp', 'phone', { req: true, type: 'tel', auto: 'tel', ph: '11 2345-6789', max: 20 }) +
        cfield('Mail', 'email', { type: 'email', auto: 'email', max: 100 }) +
        cfield('¿Qué productos o marcas ofrecés?', 'products', { req: true, wide: true, ph: 'Ej: ollas de aluminio, blanquería de algodón, marca propia…', max: 200 }) +
        cfield('Condiciones o comentarios', 'message', { area: true, wide: true, ph: 'Pedido mínimo, plazos de entrega, si tenés lista de precios…' }) +
        '</div>' +
        '<input type="text" name="website" id="ct-hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">' +
        '<button class="btn btn-main" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Enviando…' : 'Enviar propuesta') + '</button>' +
        '<p class="hint">Revisamos todas las propuestas. Si encaja con lo que buscamos, te contactamos para pedirte lista de precios y muestras.</p>' +
        '</form>';
    }
    var aside = '<aside class="contact-aside">' +
      '<div class="panel"><h3>Escribinos directo</h3>' +
      (digits(c.whatsapp) ? '<a class="btn btn-line" href="' + esc(waLink('Hola ' + cfg.brand.name + '! Tengo una consulta.')) + '" target="_blank" rel="noopener">' + ic('wa') + 'WhatsApp' + (c.whatsappDisplay ? ' ' + esc(c.whatsappDisplay) : '') + '</a>' : '') +
      (c.instagram ? '<p>Instagram: <b>@' + esc(String(c.instagram).replace('@', '')) + '</b></p>' : '') +
      (c.email ? '<p>Mail: <b class="sel">' + esc(c.email) + '</b></p>' : '') +
      '</div>' +
      '<div class="panel"><h3>Visitanos</h3>' +
      '<p>' + ph(c.address, 'Dirección del depósito') + (c.area ? '<br>' + esc(c.area) : '') + '</p>' +
      (c.hours ? '<p style="color:var(--ink-2)">' + esc(c.hours) + '</p>' : '') +
      (mapsUrl() ? '<a class="btn btn-line btn-sm" href="' + esc(mapsUrl()) + '" target="_blank" rel="noopener">' + ic('pin', 18) + 'Cómo llegar</a>' : '') +
      '</div></aside>';
    return '<div class="wrap contact">' + intro + switcher + '<div class="contact-grid"><div class="contact-main">' + form + '</div>' + aside + '</div></div>';
  }
  function submitContact() {
    if (busy) return;
    var hp = document.getElementById('ct-hp');
    var t = contactType;
    var g = function (k) { return String(cv(k) || '').trim(); };
    var req = t === 'vendedor' ? ['name', 'phone', 'zone', 'kind'] : ['company', 'name', 'phone', 'products'];
    for (var i = 0; i < req.length; i++) {
      if (!g(req[i])) { setToast('Completá los campos obligatorios.'); var el = document.getElementById('ct-' + req[i]); if (el) el.focus(); return; }
    }
    if (digits(g('phone')).length < 8) { setToast('Revisá el número de WhatsApp.'); return; }
    if (g('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g('email'))) { setToast('Revisá el mail.'); return; }
    var done = function () {
      busy = false; contactSent = { type: t, name: g('name') };
      Object.keys(contactForm).forEach(function (k) { if (k.indexOf(t + '.') === 0) delete contactForm[k]; });
      render(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (hp && hp.value) { done(); return; } // bot
    var doc = { type: t, name: g('name').slice(0, 80), phone: digits(g('phone')).slice(0, 20), status: 'nuevo', createdAt: window.firebase.firestore.FieldValue.serverTimestamp() };
    if (t === 'vendedor' && refName) doc.ref = refCode;
    ['email', 'company', 'zone', 'kind', 'source', 'products', 'message'].forEach(function (k) {
      var v = g(k); if (v) doc[k] = v.slice(0, k === 'message' ? 600 : k === 'products' ? 200 : 100);
    });
    busy = true; render(true);
    fb.db.collection('leads').add(doc).then(done).catch(function () {
      busy = false; render(true);
      setToast('No se pudo enviar. Probá de nuevo o escribinos por WhatsApp.');
    });
  }

  /* ================= contactos en el panel ================= */
  var leads = null, leadFilter = 'nuevo';
  var LEAD_STATUS = { nuevo: 'Nuevo', contactado: 'Contactado', acordado: 'Se sumó / acordado', descartado: 'Descartado' };
  function loadLeads() {
    if (!isAdmin()) return;
    fb.db.collection('leads').orderBy('createdAt', 'desc').limit(300).get().then(function (snap) {
      leads = snap.docs.map(function (d) { var l = d.data(); l.id = d.id; return l; });
      if (view === 'admin') render(true);
    }).catch(function () { leads = []; if (view === 'admin') render(true); });
  }
  function leadsAdmin() {
    if (!leads) return '<div class="panel"><p>Cargando contactos…</p></div>';
    var filters = [['nuevo', 'Nuevos'], ['vendedor', 'Vendedores'], ['proveedor', 'Proveedores'], ['todos', 'Todos']];
    var list = leads.filter(function (l) {
      return leadFilter === 'todos' ? true : leadFilter === 'nuevo' ? l.status === 'nuevo' : l.type === leadFilter;
    });
    var nNew = leads.filter(function (l) { return l.status === 'nuevo'; }).length;
    return '<div class="panel"><div><h2>Contactos</h2><p class="num" style="color:var(--ink-3);font-size:14px;margin-top:4px">' + leads.length + ' recibidos · ' + nNew + ' sin responder</p></div>' +
      '<p class="hint">Llegan desde la página de Contacto. Respondé dentro de las 48 horas: es lo que prometemos en la web.</p>' +
      '<div class="chips">' + filters.map(function (f) { return '<button type="button" class="chip' + (leadFilter === f[0] ? ' on' : '') + '" data-act="lfilter" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      (list.length ? '<div class="rlist">' + list.map(function (l) {
        var d = oDate(l), first = String(l.name || '').split(' ')[0];
        var msg = l.type === 'proveedor'
          ? 'Hola ' + first + ', te escribimos de ' + cfg.brand.name + ' por tu propuesta' + (l.company ? ' de ' + l.company : '') + '. ¿Nos podés pasar lista de precios y condiciones?'
          : 'Hola ' + first + '! Te escribimos de ' + cfg.brand.name + ' por tu consulta para vender. Te paso el catálogo con precios: ' + location.origin + '/#catalogo ¿Cuándo podés pasar por el depósito?';
        var wa = waTo(l.phone, msg);
        return '<div class="rcard lead-' + esc(l.type) + '">' +
          '<div class="rcard-top"><div><b>' + esc(l.type === 'proveedor' && l.company ? l.company : l.name) + '</b><span>' + (l.type === 'proveedor' ? esc(l.name) + ' · ' : '') + esc(l.phone) + (l.email ? ' · <span class="sel">' + esc(l.email) + '</span>' : '') + '</span></div>' +
          '<span class="ltype">' + (l.type === 'proveedor' ? 'Proveedor' : 'Vendedor') + '</span></div>' +
          '<dl class="ldata">' +
          (l.zone ? '<dt>Zona</dt><dd>' + esc(l.zone) + '</dd>' : '') +
          (l.ref ? '<dt>Lo invitó</dt><dd>' + esc(sellerName(l.ref)) + ' (' + esc(l.ref) + ')</dd>' : '') +
          (l.kind ? '<dt>Cómo vende</dt><dd>' + esc(l.kind) + '</dd>' : '') +
          (l.products ? '<dt>Ofrece</dt><dd>' + esc(l.products) + '</dd>' : '') +
          (l.source ? '<dt>Nos conoció</dt><dd>' + esc(l.source) + '</dd>' : '') +
          (l.message ? '<dt>Mensaje</dt><dd style="white-space:pre-line">' + esc(l.message) + '</dd>' : '') +
          '<dt>Recibido</dt><dd class="num">' + (d ? fmtDate(d) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '') + '</dd>' +
          '</dl>' +
          '<div class="order-foot"><label class="qf" style="flex:1"><span>Estado</span><select data-lead="' + esc(l.id) + '">' +
          Object.keys(LEAD_STATUS).map(function (k) { return '<option value="' + k + '"' + (l.status === k ? ' selected' : '') + '>' + LEAD_STATUS[k] + '</option>'; }).join('') + '</select></label></div>' +
          (wa ? '<a class="btn btn-line btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'Responder por WhatsApp</a>' : '') +
          (l.type === 'vendedor' && l.status !== 'acordado' && l.status !== 'descartado' ? '<button class="btn btn-main btn-sm" type="button" data-act="lead-seller" data-id="' + esc(l.id) + '">' + ic('plus', 18) + 'Dar de alta como vendedor</button>' : '') +
          '</div>';
      }).join('') + '</div>' : '<div class="empty">No hay contactos en este filtro.</div>') + '</div>';
  }

  /* ================= marcas en el panel ================= */
  function brandsAdmin() {
    var list = cfgDraft.brands || [];
    return '<div class="panel"><h2>Marcas que trabajamos</h2>' +
      '<p>Aparecen en un carrusel en el inicio. Subí el logo en PNG (mejor con fondo transparente). Con 4 marcas o más el carrusel se mueve solo.</p>' +
      '<div class="blist">' + list.map(function (b, i) {
        return '<div class="bitem"><div class="bthumb">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : '<span>Sin logo</span>') + '</div>' +
          '<div class="fld"><label for="bn-' + i + '">Nombre</label><input id="bn-' + i + '" data-brand-name="' + i + '" value="' + esc(b.name) + '"></div>' +
          '<div class="bbtns"><label class="upload">' + ic('camera', 16) + (b.logo ? 'Cambiar logo' : 'Subir logo') + '<input type="file" accept="image/*" data-brand-logo="' + i + '"></label>' +
          '<button class="del" type="button" data-act="brand-del" data-i="' + i + '">Quitar</button></div></div>';
      }).join('') + '</div>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="brand-add" style="align-self:flex-start">' + ic('plus', 18) + 'Agregar marca</button></div>';
  }
  function fitImage(src, maxW, maxH) {
    return loadImg(src).then(function (im) {
      var r = Math.min(1, maxW / im.naturalWidth, maxH / im.naturalHeight);
      var w = Math.round(im.naturalWidth * r), h = Math.round(im.naturalHeight * r);
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(im, 0, 0, w, h);
      return cv.toDataURL('image/png');
    });
  }

  function footer() {
    var c = cfg.contact;
    var ig = c.instagram ? '@' + String(c.instagram).replace('@', '') : '';
    return '<footer><div class="wrap foot">' +
      '<div><b>' + esc(cfg.brand.name) + '</b><div>' + esc(cfg.brand.tagline) + '</div></div>' +
      '<nav class="foot-links" aria-label="Enlaces"><a href="#catalogo" data-go="catalogo">Catálogo</a><a href="#vender" data-act="contact-go" data-type="vendedor">Quiero vender</a><a href="#proveedores" data-act="contact-go" data-type="proveedor">Proveedores</a><a href="#contacto" data-go="contacto">Contacto</a></nav>' +
      '<div>' + (c.address ? esc(c.address) + (c.area ? ', ' + esc(c.area) : '') + '<br>' : '') +
      (ourWa() ? 'WhatsApp ' + esc(ourWa()) : '') +
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
      (p.sku ? '<span class="pcode">Código ' + esc(p.sku) + '</span>' : '') +
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
    var envio = effMode() === 'envio';
    var zoneOk = !envio || !!zoneByName(buyer.zone);
    var addrOk = !envio || String(buyer.address || '').trim().length >= 5;
    var nameOk = !!String(buyer.name || '').trim(), phoneOk = digits(buyer.phone).length >= 8;
    var hint = !digits(cfg.contact.whatsapp) ? 'Falta cargar el WhatsApp del negocio en el panel.'
      : short ? ''
      : !nameOk ? 'Escribí tu nombre para enviar el pedido.'
      : !phoneOk ? 'Escribí tu WhatsApp para que te avisemos cuando esté listo.'
      : !zoneOk ? 'Elegí tu zona de envío.'
      : !addrOk ? 'Escribí la dirección de entrega.'
      : 'Se abre WhatsApp con el pedido escrito: solo tocás Enviar.';
    return { ready: !!(t.count && !short && nameOk && phoneOk && zoneOk && addrOk && digits(cfg.contact.whatsapp)), hint: hint };
  }
  function orderRef() { return refName ? refCode : (cleanCode(buyer.ref) || (isSeller() && sellerCode ? sellerCode : '')); }
  function orderMessage(code) {
    var t = cartTotals(), ship = shippingCost(), envio = effMode() === 'envio';
    var lines = cartLines().map(function (l) { return '• ' + l.q + ' x ' + (l.p.sku ? '[' + l.p.sku + '] ' : '') + l.p.name + ' (' + money(priceOf(l.p)) + ' c/u)' + (l.p.stock === 'order' ? ' · por encargo' : ''); });
    var ref = orderRef();
    return 'Hola ' + cfg.brand.name + '! Te mando mi pedido' + (code ? ' #' + code : '') + ':\n\n' + lines.join('\n') +
      '\n\nProductos: ' + money(t.total) +
      (envio ? '\nEnvío a ' + buyer.zone + ': ' + money(ship) : '\nRetiro en el depósito') +
      '\nTotal: ' + money(t.total + ship) +
      '\n\nNombre: ' + (buyer.name || '') + '\nWhatsApp: ' + (buyer.phone || '') + (buyer.barrio ? '\nBarrio: ' + buyer.barrio : '') +
      (envio ? '\nDirección: ' + (buyer.address || '') : '') +
      (ref ? '\nVendedor: ' + ref : '');
  }
  function deliveryFields() {
    if (!shipOn()) return '';
    var zones = cfg.shipping.zones, envio = effMode() === 'envio', z = zoneByName(buyer.zone);
    return '<fieldset class="dmode"><legend>¿Cómo lo recibís?</legend>' +
      '<label class="dopt' + (!envio ? ' on' : '') + '"><input type="radio" id="dm-retiro" name="dmode" value="retiro" data-buyer="mode"' + (!envio ? ' checked' : '') + '><span><b>Retiro en el depósito</b><small>Sin costo</small></span></label>' +
      '<label class="dopt' + (envio ? ' on' : '') + '"><input type="radio" id="dm-envio" name="dmode" value="envio" data-buyer="mode"' + (envio ? ' checked' : '') + '><span><b>Envío</b><small>Según tu zona</small></span></label>' +
      '</fieldset>' +
      (envio ? '<div class="fields">' +
        '<div class="fld" style="grid-column:1 / -1"><label for="b-zone">Zona de envío</label><select id="b-zone" data-buyer="zone"><option value="">Elegí tu zona</option>' +
        zones.map(function (zz) { return '<option value="' + esc(zz.name) + '"' + (zz.name === buyer.zone ? ' selected' : '') + '>' + esc(zz.name) + ' · ' + money(zz.cost) + (zz.eta ? ' · ' + esc(zz.eta) : '') + '</option>'; }).join('') + '</select></div>' +
        '<div class="fld" style="grid-column:1 / -1"><label for="b-address">Dirección de entrega</label><input id="b-address" data-buyer="address" value="' + esc(buyer.address || '') + '" autocomplete="street-address" placeholder="Calle, número, entre calles"></div>' +
        '</div>' + (cfg.shipping.note ? '<small class="hint">' + esc(cfg.shipping.note) + '</small>' : '') : '');
  }
  function refField() {
    if (isSeller() && sellerCode && !refName && !buyer.ref) return '<div class="ref-chip">' + ic('users', 18) + '<span>Este pedido queda a tu nombre · código <b>' + esc(sellerCode) + '</b></span></div>';
    if (refName) return '<div class="ref-chip">' + ic('users', 18) + '<span>Te atiende <b>' + esc(refName) + '</b> · código ' + esc(refCode) + '</span></div>';
    return '<div class="fld"><label for="b-ref">Código de vendedor <span class="opt">(opcional)</span></label><input id="b-ref" data-buyer="ref" value="' + esc(buyer.ref || '') + '" maxlength="12" autocapitalize="characters" placeholder="Si te recomendó alguien"></div>';
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
        (isClient() ? '<a class="btn btn-line btn-sm" href="#cuenta" data-go="cuenta">Ver el estado en Mi cuenta</a>' : '') +
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
        (short ? '<div class="min-warn num">Te faltan ' + money(short) + ' para el pedido mínimo de ' + money(min) + '.</div>' : '') +
        '<div class="fields"><div class="fld"><label for="b-name">Tu nombre</label><input id="b-name" data-buyer="name" value="' + esc(buyer.name) + '" autocomplete="name"></div>' +
        '<div class="fld"><label for="b-phone">Tu WhatsApp</label><input id="b-phone" data-buyer="phone" type="tel" inputmode="tel" value="' + esc(buyer.phone || '') + '" autocomplete="tel" placeholder="11 2345-6789"></div>' +
        '<div class="fld" style="grid-column:1 / -1"><label for="b-barrio">Barrio o feria</label><input id="b-barrio" data-buyer="barrio" value="' + esc(buyer.barrio) + '"></div></div>' +
        deliveryFields() + refField() +
        '<div class="totals num">' +
        '<div class="tot"><span>Productos</span><span>' + money(t.total) + '</span></div>' +
        (shipOn() ? '<div class="tot"><span>' + (effMode() === 'envio' ? 'Envío' + (buyer.zone ? ' a ' + esc(buyer.zone) : '') : 'Retiro en el depósito') + '</span><span>' + (effMode() === 'envio' ? (zoneByName(buyer.zone) ? money(shippingCost()) : 'Elegí la zona') : 'Sin costo') + '</span></div>' : '') +
        '<div class="tot big"><span>Total a pagar</span><b>' + money(t.total + shippingCost()) + '</b></div>' +
        '<div class="tot g"><span>Tu ganancia vendiendo al sugerido</span><span>' + money(t.gain) + '</span></div>' +
        '</div>' +
        '<button id="send-order" class="btn btn-main" type="button" data-act="send-order"' + (ready && !sending ? '' : ' disabled') + '>' + ic('wa') + (sending ? 'Enviando…' : 'Enviar pedido por WhatsApp') + '</button>' +
        '<small id="send-hint" style="color:var(--ink-3)">' + esc(hint) + '</small>' +
        (isClient() ? '<small class="acct-hint">' + ic('check', 14) + 'Queda guardado en Mi cuenta, con su estado.</small>'
          : !user && fb ? '<small class="acct-hint">¿Querés seguir tus pedidos? <a href="#cuenta" data-go="cuenta">Ingresá o creá tu cuenta</a> antes de enviarlo.</small>' : '') +
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
  var loginEmail = '', loginPass = '', loginName = '', loginPhone = '';
  var pendingProfile = null;   // datos del registro hasta que se guarda la ficha
  function loginPanel() {
    if (!authReady) return '<div class="wrap admin"><div class="panel" style="max-width:460px"><p>Cargando…</p></div></div>';
    if (user) {
      // Sesión iniciada pero sin acceso al panel (solo llega acá si entró por #admin)
      return '<div class="wrap admin"><div class="panel" style="max-width:520px"><h2>Panel</h2>' +
        (user.emailVerified ? '<p>Entraste como <b>' + esc(user.email) + '</b>, pero esa cuenta no tiene acceso al panel. Si sos vendedor o del equipo, pedí que te sumen con este mismo mail.</p>'
          : verifyBox()) +
        '<div class="ctas"><a class="btn btn-main btn-sm" href="#cuenta" data-go="cuenta">Ir a mi cuenta</a><button class="btn btn-line btn-sm" type="button" data-act="logout">Salir</button></div>' +
        (loginMsg ? '<p class="login-msg">' + esc(loginMsg) + '</p>' : '') + '</div></div>';
    }
    var signup = loginMode === 'signup', reset = loginMode === 'reset';
    var title = signup ? 'Creá tu cuenta' : reset ? 'Recuperar contraseña' : 'Ingresá a tu cuenta';
    var sub = signup ? 'Es gratis. Si sos vendedor o del equipo, usá el mismo mail con el que te sumamos.'
      : reset ? 'Te mandamos un link para crear una contraseña nueva.'
      : 'Clientes, vendedores y equipo entran por acá.';
    var form = '<form id="login-form" class="login-form" novalidate>' +
      (signup ? '<div class="fld"><label for="l-name">Tu nombre</label><input id="l-name" autocomplete="name" required value="' + esc(loginName) + '"></div>' +
        '<div class="fld"><label for="l-phone">Tu WhatsApp</label><input id="l-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="11 2345-6789" required value="' + esc(loginPhone) + '"></div>' : '') +
      '<div class="fld"><label for="l-email">Mail</label><input id="l-email" type="email" autocomplete="email" required value="' + esc(loginEmail) + '"></div>' +
      (!reset ? '<div class="fld"><label for="l-pass">Contraseña' + (signup ? ' (mínimo 6 caracteres)' : '') + '</label><input id="l-pass" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" required value="' + esc(loginPass) + '"></div>' : '') +
      '<button class="btn btn-main" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Un momento…' : signup ? 'Crear mi cuenta' : reset ? 'Mandarme el link' : 'Ingresar') + '</button>' +
      '</form>' +
      (loginMsg ? '<p class="login-msg">' + esc(loginMsg) + '</p>' : '') +
      '<div class="login-links">' +
      (loginMode !== 'login' ? '<button type="button" class="linkbtn" data-act="mode" data-mode="login">Ya tengo cuenta: ingresar</button>'
        : '<button type="button" class="linkbtn" data-act="mode" data-mode="signup">No tengo cuenta: crearla</button><button type="button" class="linkbtn" data-act="mode" data-mode="reset">Olvidé mi contraseña</button>') +
      '</div>' +
      (reset ? '' : '<div class="login-sep"><span>o</span></div><button class="btn btn-line" type="button" data-act="login">' + gIcon() + 'Seguir con Google</button>');
    var perks = '<div class="login-perks"><span class="eyebrow">Tu cuenta</span><h2>Seguí tus pedidos sin preguntar</h2><ul class="rules">' +
      ['Mirá en qué estado está cada pedido: recibido, confirmado, listo o entregado.', 'Repetí un pedido anterior con un toque.', 'Tus datos quedan cargados: pedís más rápido.', 'Vendedores: entran a su panel con link, QR, promos y comisiones.'].map(function (x) { return '<li>' + ic('check', 18) + '<span>' + x + '</span></li>'; }).join('') +
      '</ul>' + (refName ? '<div class="ref-chip">' + ic('users', 18) + '<span>Te atiende <b>' + esc(refName) + '</b>: queda guardado en tu cuenta.</span></div>' : '') + '</div>';
    return '<div class="wrap login-wrap"><div class="panel login-card"><h1 class="h2">' + title + '</h1><p class="login-sub">' + sub + '</p>' + form + '</div>' + perks + '</div>';
  }
  function gIcon() {
    return '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  }
  function verifyBox() {
    return '<div class="verify-box"><p><b>¿Sos vendedor o del equipo?</b> Verificá tu mail para entrar a tu panel: te mandamos un link a <b>' + esc(user.email) + '</b> (revisá también correo no deseado).</p>' +
      '<div class="ctas"><button class="btn btn-dark btn-sm" type="button" data-act="verified">Ya verifiqué</button><button class="btn btn-line btn-sm" type="button" data-act="resend">Reenviar mail</button></div></div>';
  }
  /* ================= cuenta del cliente ================= */
  function isClient() { return role === 'client'; }
  function loadCustomer() {
    if (!fb || !user) return;
    var uid = user.uid;
    fb.db.collection('customers').doc(uid).get().then(function (d) {
      if (!user || user.uid !== uid) return;
      if (d.exists) { customer = d.data(); pendingProfile = null; }
      else {
        customer = { name: (pendingProfile && pendingProfile.name) || user.displayName || buyer.name || '', phone: (pendingProfile && pendingProfile.phone) || digits(buyer.phone), barrio: buyer.barrio || '', email: String(user.email || '').toLowerCase() };
        var r = refName ? refCode : '';
        if (r) customer.ref = r;
        if (customer.name && digits(customer.phone).length >= 8) saveCustomerDoc(customer, true);
      }
      applyCustomer(); render(true);
    }).catch(function () { customer = { error: true }; render(true); });
  }
  function saveCustomerDoc(c, isNew) {
    var d = { name: String(c.name || '').slice(0, 80), phone: digits(c.phone).slice(0, 15), barrio: String(c.barrio || '').slice(0, 80), address: String(c.address || '').slice(0, 160), zone: String(c.zone || '').slice(0, 60), email: String((user && user.email) || '').toLowerCase().slice(0, 100), updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() };
    if (c.ref) d.ref = cleanCode(c.ref);
    if (isNew) d.createdAt = window.firebase.firestore.FieldValue.serverTimestamp();
    return fb.db.collection('customers').doc(user.uid).set(d, { merge: true }).then(function () { pendingProfile = null; });
  }
  // Los datos de la cuenta completan el carrito para pedir más rápido
  function applyCustomer() {
    if (!customer || customer.error) return;
    ['name', 'barrio', 'address', 'zone'].forEach(function (k) { if (customer[k]) buyer[k] = customer[k]; });
    if (customer.phone) buyer.phone = fmtPhone(customer.phone);
    if (customer.zone && shipOn() && zoneByName(customer.zone)) buyer.mode = 'envio';
    if (customer.ref && !refName) {
      buyer.ref = customer.ref;
      fb.db.collection('codes').doc(customer.ref).get().then(function (d) {
        if (d.exists && d.data().active !== false) { refCode = customer.ref; refName = d.data().name || customer.ref; render(true); }
      }).catch(function () {});
    }
    persistCart();
  }
  function loadMyOrders() {
    if (!fb || !user) return;
    var uid = user.uid;
    fb.db.collection('orders').where('uid', '==', uid).limit(100).get().then(function (snap) {
      if (!user || user.uid !== uid) return;
      myOrders = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }).sort(function (a, b) { var da = oDate(a), db = oDate(b); return (db ? db.getTime() : 0) - (da ? da.getTime() : 0); });
      render(true);
    }).catch(function () { myOrders = { error: true }; render(true); });
  }
  function saveProfile() {
    var c = custForm; if (!c) return;
    if (String(c.name || '').trim().length < 2) { setToast('Escribí tu nombre.', true); return; }
    if (digits(c.phone).length < 8) { setToast('Escribí tu WhatsApp con código de área.', true); return; }
    busy = true; render(true);
    var isNew = !customer || !customer.createdAt;
    var next = Object.assign({}, customer || {}, { name: c.name.trim(), phone: digits(c.phone), barrio: (c.barrio || '').trim(), address: (c.address || '').trim(), zone: c.zone || '' });
    saveCustomerDoc(next, isNew).then(function () {
      busy = false; customer = next; if (isNew) customer.createdAt = true; custForm = null; applyCustomer(); setToast('Tus datos quedaron guardados.');
    }).catch(function () { busy = false; setToast('No se pudieron guardar tus datos. Probá de nuevo.'); });
  }
  function repeatOrder(o) {
    var added = 0, missing = 0;
    (o.items || []).forEach(function (i) {
      var p = prodById(i.id);
      if (p && p.stock !== 'out') { cart[p.id] = (cart[p.id] || 0) + (Number(i.q) || 1); added++; } else missing++;
    });
    lastOrder = null; try { sessionStorage.removeItem('galpon-last-order'); } catch (e) {}
    persistCart();
    if (!added) { setToast('Esos productos ya no están disponibles. Mirá el catálogo.'); return; }
    cartOpen = true; render(true);
    if (missing) showToast(missing + ' producto' + (missing > 1 ? 's' : '') + ' ya no está' + (missing > 1 ? 'n' : '') + ' disponible' + (missing > 1 ? 's' : '') + '. Sumamos el resto.');
  }
  var CSTEPS = ['nuevo', 'confirmado', 'listo', 'entregado'];
  function cStatusName(o, st) {
    var envio = o.delivery && o.delivery.mode === 'envio';
    return { nuevo: 'Recibido', confirmado: 'Confirmado', listo: envio ? 'Listo para enviar' : 'Listo para retirar', entregado: 'Entregado', cancelado: 'Cancelado' }[st] || st;
  }
  function clientOrderCard(o) {
    var dt = oDate(o), idx = CSTEPS.indexOf(o.status), canc = o.status === 'cancelado';
    var items = o.items || [];
    var shown = items.slice(0, 4).map(function (i) { return '<li><span class="num">' + i.q + ' ×</span> ' + esc(i.name) + '<span class="num">' + money(i.q * (Number(i.price) || 0)) + '</span></li>'; }).join('') +
      (items.length > 4 ? '<li class="more">y ' + (items.length - 4) + ' producto' + (items.length - 4 > 1 ? 's' : '') + ' más</li>' : '');
    var del = o.delivery && o.delivery.mode === 'envio' ? 'Envío a ' + esc(o.delivery.zone || '') + (o.delivery.eta ? ' · ' + esc(o.delivery.eta) : '') : 'Retiro en el depósito';
    return '<article class="corder' + (canc ? ' canc' : '') + '">' +
      '<div class="corder-top"><div><b>Pedido #' + esc(o.code || o.id.slice(0, 5).toUpperCase()) + '</b><small>' + (dt ? dt.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : 'Recién enviado') + ' · ' + del + '</small></div>' +
      '<span class="vst st-' + esc(o.status) + '">' + esc(cStatusName(o, o.status)) + '</span></div>' +
      (canc ? '<p class="hint">Este pedido se canceló. Si tenés dudas, escribinos.</p>'
        : '<ol class="steps" aria-label="Estado del pedido">' + CSTEPS.map(function (st, i) { return '<li class="' + (i < idx ? 'done' : i === idx ? 'now' : '') + '"><span class="dot">' + (i <= idx ? ic('check', 14) : '') + '</span><small>' + esc(cStatusName(o, st)) + '</small></li>'; }).join('') + '</ol>') +
      '<ul class="corder-items">' + shown + '</ul>' +
      '<div class="corder-foot"><div class="num"><small>Total</small><b>' + money(o.grand != null ? o.grand : o.total) + '</b></div><div class="ctas">' +
      '<button class="btn btn-main btn-sm" type="button" data-act="repeat-order" data-id="' + esc(o.id) + '">' + ic('repeat', 18) + 'Repetir pedido</button>' +
      '<a class="btn btn-line btn-sm" href="' + esc(waLink('Hola ' + cfg.brand.name + '! Te consulto por mi pedido #' + (o.code || '') + '.')) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'Consultar</a>' +
      '</div></div></article>';
  }
  function profileForm() {
    if (!custForm) custForm = { name: customer.name || '', phone: customer.phone ? fmtPhone(customer.phone) : '', barrio: customer.barrio || '', address: customer.address || '', zone: customer.zone || '' };
    var c = custForm;
    var fl = function (label, k, opt) {
      opt = opt || {};
      return '<div class="fld' + (opt.wide ? ' wide' : '') + '"><label for="cf-' + k + '">' + label + '</label><input id="cf-' + k + '" data-cf="' + k + '" value="' + esc(c[k]) + '"' + (opt.type ? ' type="' + opt.type + '" inputmode="tel"' : '') + (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : '') + (opt.ac ? ' autocomplete="' + opt.ac + '"' : '') + '></div>';
    };
    return '<div class="form-grid">' + fl('Nombre', 'name', { ac: 'name' }) + fl('WhatsApp', 'phone', { type: 'tel', ph: '11 2345-6789', ac: 'tel' }) + fl('Barrio o feria', 'barrio', { wide: true, ph: 'Ej. Feria de Laferrere' }) +
      (shipOn() ? '<div class="fld"><label for="cf-zone">Zona de envío</label><select id="cf-zone" data-cf="zone"><option value="">Retiro en el depósito</option>' + cfg.shipping.zones.map(function (z) { return '<option' + (z.name === c.zone ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') + '</select></div>' + fl('Dirección de entrega', 'address', { ph: 'Calle, número, entre calles', ac: 'street-address' }) : '') +
      '</div><div class="ctas" style="margin-top:14px"><button class="btn btn-dark btn-sm" type="button" data-act="save-profile"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Guardando…' : 'Guardar mis datos') + '</button></div>';
  }
  function accountView() {
    if (!authReady || (user && !role)) return '<div class="wrap admin"><div class="panel" style="max-width:460px"><p>Cargando…</p></div></div>';
    if (!user) return loginPanel();
    var first = String((customer && customer.name) || user.displayName || '').split(' ')[0];
    var head = '<div class="admin-top"><div><span class="eyebrow">Mi cuenta</span><h1 class="h2" style="margin-top:6px">Hola' + (first ? ', ' + esc(first) : '') + '</h1>' +
      '<p style="color:var(--ink-3);font-size:14px;margin-top:6px">' + esc(user.email) + ' · <button type="button" class="linkbtn" data-act="logout">Salir</button></p></div>' +
      '<a class="btn btn-main btn-sm" href="#catalogo" data-go="catalogo">' + ic('bag', 18) + 'Hacer un pedido</a></div>';
    if (!customer) return '<div class="wrap acct">' + head + '<div class="panel"><p>Cargando tus datos…</p></div></div>';
    var incomplete = !customer.error && (!customer.name || digits(customer.phone).length < 8);
    var ordersHtml;
    if (myOrders === null) ordersHtml = '<p class="hint">Cargando tus pedidos…</p>';
    else if (myOrders.error) ordersHtml = '<p class="hint">No pudimos cargar tus pedidos. Recargá la página.</p>';
    else if (!myOrders.length) ordersHtml = '<div class="empty">Todavía no hiciste pedidos con esta cuenta.<br>Los que hagas estando dentro van a aparecer acá, con su estado.<div class="ctas" style="justify-content:center;margin-top:14px"><a class="btn btn-main btn-sm" href="#catalogo" data-go="catalogo">Ver el catálogo</a></div></div>';
    else ordersHtml = '<div class="corders">' + myOrders.map(clientOrderCard).join('') + '</div>';
    var open = myOrders && !myOrders.error ? myOrders.filter(function (o) { return o.status !== 'entregado' && o.status !== 'cancelado'; }).length : 0;
    return '<div class="wrap acct">' + head +
      (user.emailVerified ? '' : verifyBox()) +
      (incomplete ? '<div class="panel panel-hl"><h2>Completá tus datos</h2><p>Así cada pedido sale con tu nombre y WhatsApp, y te avisamos cuando esté listo.</p>' + profileForm() + '</div>' : '') +
      '<div class="acct-grid"><div class="panel"><h2>Mis pedidos' + (open ? ' <span class="count num">' + open + ' en curso</span>' : '') + '</h2>' + ordersHtml + '</div>' +
      '<aside class="acct-side">' +
      (refName ? '<div class="panel"><h2>Te atiende</h2><div class="ref-chip">' + ic('users', 18) + '<span><b>' + esc(refName) + '</b> · código ' + esc(refCode) + '</span></div><p class="hint" style="margin-top:8px">Tus pedidos le quedan asignados.</p></div>' : '') +
      '<div class="panel canal-card"><h2>' + ic('megaphone', 22) + 'Ofertas por WhatsApp</h2><p>Sumate a nuestro canal de difusión y recibí el catálogo y las ofertas de la semana.</p><a class="btn btn-main btn-sm" href="' + esc(canalTarget(refName ? refCode : '', refName)) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'Sumarme al canal</a></div>' +
      (!incomplete ? '<div class="panel"><h2>Mis datos</h2>' + profileForm() + '</div>' : '') +
      '</aside></div></div>';
  }

  var AUTH_ERR = {
    'auth/invalid-email': 'Ese mail no es válido.',
    'auth/missing-password': 'Escribí tu contraseña.',
    'auth/weak-password': 'La contraseña tiene que tener al menos 6 caracteres.',
    'auth/email-already-in-use': 'Ese mail ya tiene cuenta. Ingresá, o usá “Olvidé mi contraseña”.',
    'auth/invalid-credential': 'Mail o contraseña incorrectos.',
    'auth/wrong-password': 'Mail o contraseña incorrectos.',
    'auth/user-not-found': 'No hay una cuenta con ese mail. Tocá “No tengo cuenta: crearla”.',
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
      var nm = String(loginName || '').trim(), phn = digits(loginPhone);
      if (nm.length < 2) { done('Escribí tu nombre.'); return; }
      if (phn.length < 8) { done('Escribí tu WhatsApp con código de área (ej. 11 2345-6789).'); return; }
      pendingProfile = { name: nm.slice(0, 80), phone: phn.slice(0, 15) };
      fb.auth.createUserWithEmailAndPassword(em, pw).then(function (cred) {
        cred.user.sendEmailVerification().catch(function () {});
        return cred.user.updateProfile({ displayName: nm.slice(0, 80) }).catch(function () {});
      }).then(function () { loginPass = ''; done(''); }).catch(function (e) { pendingProfile = null; done(authError(e)); });
    } else {
      fb.auth.signInWithEmailAndPassword(em, pw).then(function () { loginPass = ''; done(''); }).catch(function (e) { done(authError(e)); });
    }
  }
  function tabs() {
    var list = [['pedidos', 'Pedidos'], ['clientes', 'Clientes'], ['productos', 'Productos'], ['promos', 'Promos y QR']];
    if (isAdmin()) {
      var nl = leads ? leads.filter(function (l) { return l.status === 'nuevo'; }).length : 0;
      list.splice(2, 0, ['vendedores', 'Vendedores'], ['contactos', 'Contactos' + (nl ? ' (' + nl + ')' : '')]);
      list.push(['negocio', 'Datos y ajustes'], ['equipo', 'Equipo']);
    }
    return '<div class="tabs" role="tablist">' + list.map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (adminTab === t[0]) + '" class="tab' + (adminTab === t[0] ? ' on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div>';
  }
  var ROLE_NAME = { owner: 'Dueño', admin: 'Administrador', editor: 'Carga de productos', seller: 'Vendedor' };
  function adminView() {
    if (isSeller()) return sellerView();
    if (!isStaff()) return loginPanel();
    var seedBox = (isAdmin() && (needSeed.cfg || needSeed.products))
      ? '<div class="admin-note">' + ic('info', 20) + '<div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start"><span><b>Primer uso:</b> los datos y productos de ejemplo todavía no están guardados en Firebase.</span><button class="btn btn-main btn-sm" type="button" data-act="seed"' + (busy ? ' disabled' : '') + '>Cargar datos iniciales</button></div></div>' : '';
    var body = adminTab === 'productos' ? productsAdmin()
      : adminTab === 'promos' ? promosAdmin()
      : adminTab === 'clientes' ? resellersAdmin()
      : adminTab === 'vendedores' && isAdmin() ? sellersAdmin()
      : adminTab === 'negocio' && isAdmin() ? businessAdmin()
      : adminTab === 'equipo' && isAdmin() ? teamAdmin()
      : adminTab === 'contactos' && isAdmin() ? leadsAdmin()
      : ordersAdmin();
    return '<div class="wrap admin">' +
      '<div class="admin-top"><div><span class="eyebrow">Panel</span><h1 class="h2" style="margin-top:6px">Hola' + (user.displayName ? ', ' + esc(user.displayName.split(' ')[0]) : '') + '</h1>' +
      '<p style="color:var(--ink-3);font-size:14px;margin-top:6px">' + esc(user.email) + ' · ' + ROLE_NAME[role] + ' · <button type="button" class="linkbtn" data-act="logout">Salir</button></p></div></div>' +
      seedBox + tabs() + body + '</div>';
  }

  var STATUS = { nuevo: 'Nuevo', confirmado: 'Confirmado', listo: 'Listo para entregar', entregado: 'Entregado', cancelado: 'Cancelado' };
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
    if (o.status === 'listo' && o.delivery && o.delivery.mode === 'envio') return 'Hola ' + first + '! Tu pedido ' + code + ' ya está listo y sale para ' + o.delivery.address + (o.delivery.eta ? ' (' + o.delivery.eta + ')' : '') + '. Total con envío: ' + money(o.grand || o.total) + '.';
    if (o.status === 'listo') return 'Hola ' + first + '! Tu pedido ' + code + ' ya está listo para retirar' + (c.address ? ' en ' + c.address : '') + (c.hours ? ' (' + c.hours + ')' : '') + '. Total: ' + money(o.grand || o.total) + '. ¡Te esperamos!';
    if (o.status === 'entregado') return 'Hola ' + first + '! Gracias por tu compra (' + code + '). Cuando quieras reponer, ya tenés el catálogo actualizado.';
    if (o.status === 'cancelado') return 'Hola ' + first + '. Te escribimos por tu pedido ' + code + '.';
    return 'Hola ' + first + '! Recibimos tu pedido ' + code + ' por ' + money(o.grand || o.total) + '. Te confirmamos stock y te avisamos cuando esté listo.';
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
      tile('Clientes activos', String(s.active), 'compraron en 30 días') +
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
        var items = '<table class="oitems"><tbody>' + (o.items || []).map(function (i) {
          var sku = i.sku || cleanSku((prodById(i.id) || {}).sku);
          return '<tr><td class="num q">' + i.q + '</td><td class="sku">' + (sku ? esc(sku) : '<span class="muted">sin SKU</span>') + '</td><td>' + esc(i.name) + '</td></tr>';
        }).join('') + '</tbody></table>';
        var wa = waTo(o.phone, notifyText(o));
        return '<div class="order st-' + esc(o.status) + '">' +
          '<div class="order-top"><b>#' + esc(o.code || o.id.slice(0, 6).toUpperCase()) + '</b><span class="num">' + when + '</span></div>' +
          '<div><b>' + esc(o.name) + '</b>' + (o.barrio ? ' · ' + esc(o.barrio) : '') + (o.phone ? '<br><span class="num" style="color:var(--ink-3);font-size:14px">' + esc(o.phone) + '</span>' : '') + '</div>' +
          '<div class="order-items">' + items + '</div>' +
          deliveryLine(o) + sellerLine(o) +
          '<div class="order-foot"><span class="num"><b>' + money(o.grand || o.total) + '</b>' + (o.shipping ? '<small class="ship-note"> incluye envío ' + money(o.shipping) + '</small>' : '') + '</span>' +
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
      notes = {}; snap.docs.forEach(function (d) { notes[d.id] = d.data(); }); if (adminTab === 'clientes') render(true);
    }).catch(function () { notes = {}; if (adminTab === 'clientes') render(true); });
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
      '<div><h2>Clientes</h2><p class="num" style="color:var(--ink-3);font-size:14px;margin-top:4px">' + all.length + ' clientes · ' + act + ' activos · ' + risk + ' hace más de un mes sin comprar</p></div>' +
      '<p class="hint">Feriantes y revendedores que compraron. Se arma solo con los pedidos. A los que hace más de un mes que no compran conviene escribirles con la oferta de la semana.</p>' +
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
          ((clientsMap || {})[digits(r.phone)] && clientsMap[digits(r.phone)].seller ? '<span class="seller-tag">' + ic('users', 16) + 'Vendedor: ' + esc(sellerName(clientsMap[digits(r.phone)].seller)) + ' · ' + esc(clientsMap[digits(r.phone)].seller) + '</span>' : '') +
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
    var list = products.filter(function (p) { return !q || (p.name + ' ' + p.cat + ' ' + (p.sku || '')).toLowerCase().indexOf(q) !== -1; });
    var nOffer = products.filter(onOffer).length, nOut = products.filter(function (p) { return p.stock === 'out'; }).length;
    return '<div class="panel">' +
      '<div class="sec-row" style="margin:0"><div><h2>Productos</h2><p style="color:var(--ink-3);font-size:14px;margin-top:4px" class="num">' + products.length + ' productos · ' + nOffer + ' en oferta · ' + nOut + ' sin stock</p></div>' +
      '<div class="sactions"><button class="btn btn-line btn-sm" type="button" data-act="poster" data-type="promo">' + ic('share', 18) + 'Armar promo</button>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="new-prod">' + ic('camera', 18) + 'Cargar producto</button></div></div>' +
      '<label class="search" style="flex:none">' + ic('search', 20) + '<input id="pq" type="search" placeholder="Buscar por nombre, rubro o SKU" value="' + esc(pq) + '" aria-label="Buscar en mis productos"></label>' +
      '<p class="hint">Cambiá precio y stock directo en la lista: se guarda solo. Tocá la foto o el nombre para editar todo. “Por encargo” sirve para publicar productos que todavía no tenés y medir el interés con las vistas y los agregados al carrito.</p>' +
      '<div class="plist">' + (list.length ? list.map(function (p) {
        var pid = esc(p.id);
        return '<div class="prow' + (p.stock === 'out' ? ' is-out' : '') + '">' +
          '<button type="button" class="prow-main" data-act="edit-prod" data-id="' + pid + '">' +
          '<img src="' + esc(imgOf(p)) + '" alt="">' +
          '<span class="prow-info"><b>' + esc(p.name) + '</b><span>' + (p.sku ? '<span class="sku-chip">' + esc(p.sku) + '</span> ' : '<span class="sku-chip none">Sin SKU</span> ') + esc(p.cat) + (p.combo ? ' · Combo' : '') + (onOffer(p) ? ' · Oferta ' + money(p.offer) + ' hasta el ' + ddmm(p.offerUntil) : '') + '</span>' +
          (statsMap ? '<span class="pstat num">' + ((statsMap[p.id] || {}).views || 0) + ' vistas · ' + ((statsMap[p.id] || {}).adds || 0) + ' al carrito</span>' : '') + '</span>' +
          ic('edit', 18) + '</button>' +
          '<div class="prow-quick">' +
          '<label class="qf"><span>Precio</span><input type="number" inputmode="numeric" min="0" data-quick="price" data-id="' + pid + '" value="' + esc(p.price) + '" aria-label="Precio revendedor de ' + esc(p.name) + '"></label>' +
          '<label class="qf"><span>Sugerido</span><input type="number" inputmode="numeric" min="0" data-quick="sug" data-id="' + pid + '" value="' + esc(p.sug) + '" aria-label="Precio sugerido de ' + esc(p.name) + '"></label>' +
          '<label class="qf"><span>Stock</span><select data-quick="stock" data-id="' + pid + '" aria-label="Stock de ' + esc(p.name) + '">' +
          '<option value="ok"' + (p.stock === 'ok' ? ' selected' : '') + '>Hay</option>' +
          '<option value="low"' + (p.stock === 'low' ? ' selected' : '') + '>Pocas</option>' +
          '<option value="order"' + (p.stock === 'order' ? ' selected' : '') + '>Por encargo</option>' +
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
      '<div class="fld"><label for="e-sku">SKU / código interno</label><input id="e-sku" data-e="sku" value="' + esc(p.sku || '') + '" maxlength="30" autocapitalize="characters" placeholder="Ej: BLA-SAB-2P"><small class="hint" id="e-sku-hint">' + (skuTaken(cleanSku(p.sku), p.id) ? 'Ese SKU ya lo tiene otro producto.' : 'El que usás en el depósito. Aparece en cada pedido.') + '</small></div>' +
      '<div class="fld"><label for="e-name">Nombre</label><input id="e-name" data-e="name" value="' + esc(p.name) + '" placeholder="Ej: Juego de sábanas 2 plazas"></div>' +
      '<div class="fld"><label for="e-price">Precio revendedor ($)</label><input id="e-price" type="number" inputmode="numeric" min="0" data-e="price" value="' + esc(p.price || '') + '"></div>' +
      '<div class="fld"><label for="e-sug">Precio sugerido ($)</label><input id="e-sug" type="number" inputmode="numeric" min="0" data-e="sug" value="' + esc(p.sug || '') + '"></div>' +
      '<div class="wide pe-gain num" id="e-gain">Ganancia del revendedor: ' + money(gain(p)) + '</div>' +
      '<div class="fld"><label for="e-cat">Rubro</label><select id="e-cat" data-e="cat">' + opts + '</select></div>' +
      '<div class="fld"><label for="e-stock">Stock</label><select id="e-stock" data-e="stock">' +
      '<option value="ok"' + (p.stock === 'ok' ? ' selected' : '') + '>Hay stock</option>' +
      '<option value="low"' + (p.stock === 'low' ? ' selected' : '') + '>Últimas unidades</option>' +
      '<option value="order"' + (p.stock === 'order' ? ' selected' : '') + '>Por encargo</option>' +
      '<option value="out"' + (p.stock === 'out' ? ' selected' : '') + '>Sin stock</option></select></div>' +
      (p.stock === 'order' ? '<div class="fld"><label for="e-lead">Llega en (días)</label><input id="e-lead" type="number" inputmode="numeric" min="1" data-e="leadDays" value="' + esc(p.leadDays || 7) + '"></div>' : '') +
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
      f('WhatsApp como se muestra', 'contact.whatsappDisplay', { ph: '11 2345-6789', help: 'Es el número que sale en banners, carteles y la web.' }) +
      f('Link del canal de WhatsApp (opcional)', 'contact.channel', { wide: true, ph: 'https://whatsapp.com/channel/…', help: 'Si lo cargás, los QR llevan directo al canal. Si no, abren WhatsApp con un mensaje para sumarse a la lista de difusión.' }) +
      f('Instagram', 'contact.instagram', { ph: 'elgalpon.ok' }) +
      f('Mail de contacto (opcional)', 'contact.email', { ph: 'hola@elgalpon.com.ar' }) +
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
      '</div></div>' + brandsAdmin() + commissionsAdmin() + shippingAdmin() +
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
      '<ul class="roles"><li><b>Carga de productos:</b> agrega y edita productos, precios, fotos y stock, y ve los pedidos.</li><li><b>Administrador:</b> además cambia los datos del negocio, las comisiones, los envíos y el equipo.</li><li><b>Vendedor:</b> ve solo sus clientes, sus comisiones y sus liquidaciones. Se da de alta en la pestaña Vendedores.</li></ul>' +
      '<div class="tlist">' + rows + '</div>' +
      '<div class="form-grid" style="align-items:end">' +
      '<div class="fld"><label for="m-email">Mail</label><input id="m-email" type="email" placeholder="nombre@gmail.com" autocomplete="off"></div>' +
      '<div class="fld"><label for="m-role">Permiso</label><select id="m-role"><option value="editor">Carga de productos</option><option value="admin">Administrador</option></select></div>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="add-member"' + (busy ? ' disabled' : '') + '>' + ic('plus', 18) + 'Sumar al equipo</button>' +
      '</div></div>';
  }

  /* ================= vendedores: asignación y comisiones ================= */
  var VIA = { link: 'por su link o código', cliente: 'cliente asignado', manual: 'asignado a mano' };
  function sellerName(code) { var s = sellersMap[code]; return s ? s.name : code; }
  function sellerLink(code, vender) { return location.origin + '/?v=' + code + (vender ? '#vender' : ''); }
  function activeSeller(code) { var s = sellersMap[code]; return !!(s && s.active !== false); }
  function overrideFor(code) {
    var s = sellersMap[code];
    if (!s || !s.recruitedBy || !activeSeller(s.recruitedBy) || !(Number(comm().override) > 0)) return null;
    return (Date.now() - (Number(s.since) || 0)) <= monthsMs(comm().overrideMonths) ? s.recruitedBy : null;
  }
  function suggestAssign(o) {
    if (o.sellerCode) return { code: o.sellerCode, via: o.assignVia || 'manual' };
    var ph = digits(o.phone), c = ph && clientsMap ? clientsMap[ph] : null;
    if (c && c.seller && activeSeller(c.seller) && (Date.now() - (Number(c.last) || 0)) <= monthsMs(comm().clientMonths)) return { code: c.seller, via: 'cliente', suggested: true };
    var r = cleanCode(o.ref);
    if (r && activeSeller(r)) return { code: r, via: 'link', suggested: true };
    return null;
  }
  function calcCommission(o, code, ovCode) {
    var base = 0, amt = 0;
    (o.items || []).forEach(function (i) {
      var sub = (Number(i.q) || 0) * (Number(i.price) || 0);
      var catName = i.cat || (prodById(i.id) || {}).cat || '';
      base += sub; amt += sub * rateFor(catName) / 100;
    });
    var res = { base: Math.round(base), at: Date.now(), seller: { code: code, amount: Math.round(amt) } };
    if (ovCode) res.override = { code: ovCode, amount: Math.round(base * (Number(comm().override) || 0) / 100) };
    return res;
  }
  function isPaid(c) { return !!(c && ((c.seller && c.seller.payoutId) || (c.override && c.override.payoutId))); }
  function touchClient(o, force) {
    var ph = digits(o.phone); if (!ph || !o.sellerCode || !fb) return;
    var cur = (clientsMap || {})[ph];
    var keep = cur && cur.seller && cur.seller !== o.sellerCode && activeSeller(cur.seller) && (Date.now() - (Number(cur.last) || 0)) <= monthsMs(comm().clientMonths);
    var d = { seller: keep && !force ? cur.seller : o.sellerCode, last: Date.now(), name: String(o.name || '').slice(0, 80) };
    if (!cur || d.seller !== cur.seller) d.since = Date.now();
    fb.db.collection('clients').doc(ph).set(d, { merge: true }).then(function () {
      clientsMap = clientsMap || {}; clientsMap[ph] = Object.assign({}, cur || {}, d);
    }).catch(function () {});
  }
  function changeStatus(o, st, sel) {
    if (o.status === 'entregado' && st !== 'entregado' && isPaid(o.commission)) {
      sel.value = o.status; setToast('Este pedido ya está liquidado al vendedor. No se puede cambiar el estado.'); return;
    }
    var upd = { status: st };
    if (st !== 'nuevo' && st !== 'cancelado' && !o.sellerCode) {
      var s = suggestAssign(o);
      if (s) { upd.sellerCode = s.code; upd.assignVia = s.via; upd.overrideCode = overrideFor(s.code); }
    }
    var code = upd.sellerCode || o.sellerCode;
    var ov = upd.overrideCode !== undefined ? upd.overrideCode : (o.overrideCode || null);
    if (st === 'entregado') {
      upd.deliveredAt = Date.now();
      if (code && !isPaid(o.commission)) upd.commission = calcCommission(o, code, ov);
    } else if (o.status === 'entregado') { upd.commission = null; upd.deliveredAt = null; }
    fb.db.collection('orders').doc(o.id).update(upd).then(function () {
      Object.assign(o, upd);
      if (o.sellerCode && st !== 'cancelado') touchClient(o, false);
      render(true);
      if (st === 'entregado' && upd.commission) setToast('Entregado. Comisión de ' + sellerName(code) + ': ' + money(upd.commission.seller.amount) + '.', true);
    }).catch(function () { sel.value = o.status; setToast('No se pudo cambiar el estado.'); });
  }
  function assignSeller(o, code, sel) {
    if (isPaid(o.commission)) { sel.value = o.sellerCode || ''; setToast('Este pedido ya está liquidado. No se puede cambiar el vendedor.'); return; }
    var upd = { sellerCode: code || null, assignVia: code ? 'manual' : null, overrideCode: code ? overrideFor(code) : null };
    if (o.status === 'entregado') upd.commission = code ? calcCommission(o, code, upd.overrideCode) : null;
    fb.db.collection('orders').doc(o.id).update(upd).then(function () {
      Object.assign(o, upd);
      if (code) touchClient(o, true);
      render(true); setToast(code ? 'Pedido asignado a ' + sellerName(code) + '.' : 'Pedido sin vendedor.', true);
    }).catch(function () { setToast('No se pudo asignar el vendedor.'); });
  }
  function sellerLine(o) {
    var s = suggestAssign(o);
    var c = o.commission;
    var comTxt = '';
    if (c && c.seller) {
      comTxt = '<span class="com num">Comisión ' + esc(sellerName(c.seller.code)) + ': ' + money(c.seller.amount) + (c.seller.payoutId ? ' · pagada' : ' · a pagar') +
        (c.override ? ' · extra ' + esc(sellerName(c.override.code)) + ': ' + money(c.override.amount) + (c.override.payoutId ? ' (pagada)' : '') : '') + '</span>';
    } else if (s && o.status !== 'cancelado') {
      comTxt = '<span class="com num">Comisión estimada: ' + money(calcCommission(o, s.code, null).seller.amount) + ' (se confirma al entregar)</span>';
    }
    var who;
    if (isAdmin() && sellers) {
      who = '<label class="qf assign"><span>Vendedor' + (s && s.suggested ? ' · sugerido ' + esc(VIA[s.via] || '') : s ? ' · ' + esc(VIA[s.via] || '') : '') + '</span>' +
        '<select data-assign="' + esc(o.id) + '"' + (isPaid(c) ? ' disabled' : '') + '><option value="">Sin vendedor</option>' +
        sellers.map(function (x) { return '<option value="' + esc(x.id) + '"' + (s && s.code === x.id ? ' selected' : '') + '>' + esc(x.name) + ' (' + esc(x.id) + ')' + (x.active === false ? ' · pausado' : '') + '</option>'; }).join('') +
        '</select></label>';
    } else {
      who = '<span class="seller-tag">' + ic('users', 16) + (s ? esc(sellerName(s.code)) + ' · ' + esc(s.code) + (s.suggested ? ' (sugerido)' : '') : 'Sin vendedor') + '</span>';
    }
    return '<div class="order-seller">' + who + comTxt + '</div>';
  }
  function deliveryLine(o) {
    var d = o.delivery || { mode: 'retiro' };
    if (d.mode === 'envio') return '<div class="order-dl">' + ic('truck', 16) + '<span>Envío a <b>' + esc(d.zone) + '</b> · ' + money(d.cost) + (d.eta ? ' · ' + esc(d.eta) : '') + '<br>' + esc(d.address) + '</span></div>';
    return '<div class="order-dl">' + ic('pin', 16) + '<span>Retira en el depósito</span></div>';
  }

  /* ================= vendedores en el panel ================= */
  function pendingItems(code) {
    var items = [];
    (orders || []).forEach(function (o) {
      var c = o.commission; if (!c || o.status !== 'entregado') return;
      if (c.seller && c.seller.code === code && !c.seller.payoutId) items.push({ id: o.id, order: o.code || o.id.slice(0, 5).toUpperCase(), kind: 'seller', amount: c.seller.amount, base: c.base });
      if (c.override && c.override.code === code && !c.override.payoutId) items.push({ id: o.id, order: o.code || o.id.slice(0, 5).toUpperCase(), kind: 'override', amount: c.override.amount, base: c.base, from: c.seller ? c.seller.code : '' });
    });
    return items;
  }
  function sellerStats(code) {
    var now = Date.now(), r = { pending: 0, pendingN: 0, paid: 0, sales: 0, sales30: 0, orders: 0, clients: 0 };
    (orders || []).forEach(function (o) {
      var c = o.commission; if (!c || o.status !== 'entregado') return;
      if (c.seller && c.seller.code === code) { r.sales += c.base || 0; r.orders++; if (now - (Number(o.deliveredAt) || 0) <= 30 * DAY) r.sales30 += c.base || 0; }
    });
    pendingItems(code).forEach(function (it) { r.pending += it.amount; r.pendingN++; });
    (payouts || []).forEach(function (p) { if (p.code === code) r.paid += Number(p.amount) || 0; });
    Object.keys(clientsMap || {}).forEach(function (k) { var c = clientsMap[k]; if (c.seller === code && now - (Number(c.last) || 0) <= monthsMs(comm().clientMonths)) r.clients++; });
    return r;
  }
  function suggestCode(name) {
    var w = String(name || '').trim().split(/\s+/);
    var b = cleanCode(w[0]).slice(0, 8) || 'VEND';
    if (b.length < 3 && w[1]) b = (b + cleanCode(w[1])).slice(0, 8);
    var c = b, n = 2;
    while (sellersMap[c]) { c = b.slice(0, 7) + n; n++; }
    return c;
  }
  function sfield(label, k, opts) {
    opts = opts || {};
    var id = 'sf-' + k, v = sellerForm[k] || '';
    var input = opts.options
      ? '<select id="' + id + '" data-sf="' + k + '">' + opts.options + '</select>'
      : '<input id="' + id + '" data-sf="' + k + '" type="' + (opts.type || 'text') + '" value="' + esc(v) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.max ? ' maxlength="' + opts.max + '"' : '') + '>';
    return '<div class="fld' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + (opts.opt ? ' <span class="opt">(opcional)</span>' : '') + '</label>' + input + (opts.help ? '<small class="hint">' + esc(opts.help) + '</small>' : '') + '</div>';
  }
  function sellerFormPanel() {
    if (!sellerForm) return '';
    var rbOpts = '<option value="">Nadie: lo sumamos nosotros</option>' + (sellers || []).filter(function (x) { return x.active !== false; }).map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (sellerForm.recruitedBy === x.id ? ' selected' : '') + '>' + esc(x.name) + ' (' + esc(x.id) + ')</option>';
    }).join('');
    return '<div class="panel" id="new-seller"><div class="sec-row" style="margin:0"><h2>Nuevo vendedor</h2><button class="x" type="button" data-act="seller-cancel" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="form-grid">' +
      sfield('Nombre y apellido', 'name', { max: 80 }) +
      sfield('WhatsApp', 'phone', { type: 'tel', ph: '11 2345-6789', max: 20 }) +
      sfield('Código', 'code', { max: 12, help: 'Letras y números. Va en su link: ' + location.origin + '/?v=' + (sellerForm.code || 'CODIGO') }) +
      sfield('Ferias o zona que recorre', 'zone', { max: 100, ph: 'Ej: feria de Laferrere, La Salada', opt: true }) +
      sfield('¿Quién lo sumó?', 'recruitedBy', { options: rbOpts, help: Number(comm().override) > 0 ? 'Quien lo sumó cobra ' + comm().override + '% extra sobre sus ventas durante ' + comm().overrideMonths + ' meses.' : '' }) +
      sfield('Mail para su panel', 'email', { type: 'email', ph: 'nombre@gmail.com', opt: true, help: 'Con este mail entra a ver sus clientes, comisiones y liquidaciones.' }) +
      '</div>' +
      '<div class="edit-actions"><span style="flex:1"></span><button class="btn btn-line btn-sm" type="button" data-act="seller-cancel">Cancelar</button>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="seller-save"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Guardando…' : 'Dar de alta') + '</button></div></div>';
  }
  function sellersAdmin() {
    if (!sellers || !orders) return '<div class="panel"><p>Cargando vendedores…</p></div>';
    if (payouts === null) loadPayouts();
    if (statsMap === null) loadStats();
    var list = sellers.slice().map(function (x) { return { s: x, st: sellerStats(x.id) }; })
      .sort(function (a, b) { return (b.s.active !== false) - (a.s.active !== false) || b.st.pending - a.st.pending || b.st.sales30 - a.st.sales30; });
    var totPending = list.reduce(function (m, x) { return m + x.st.pending; }, 0);
    var nActive = sellers.filter(function (x) { return x.active !== false; }).length;
    return '<div class="panel"><div class="sec-row" style="margin:0"><div><h2>Vendedores</h2>' +
      '<p class="num" style="color:var(--ink-3);font-size:14px;margin-top:4px">' + nActive + ' activos · ' + money(totPending) + ' en comisiones a pagar</p></div>' +
      (sellerForm ? '' : '<button class="btn btn-main btn-sm" type="button" data-act="seller-new">' + ic('plus', 18) + 'Nuevo vendedor</button>') + '</div>' +
      '<details class="rules-box"><summary>Reglas de comisión vigentes</summary>' + rulesHtml() + '<p class="hint">Se cambian en Datos y fotos → Comisiones. Los vendedores ven estas mismas reglas en la web y en su panel.</p></details>' +
      '</div>' +
      sellerFormPanel() +
      (list.length ? '<div class="slist">' + list.map(function (x) {
        var s = x.s, st = x.st, code = s.id, off = s.active === false;
        var link = sellerLink(code), mine = (payouts || []).filter(function (p) { return p.code === code; });
        var team = sellers.filter(function (y) { return y.recruitedBy === code; });
        var wa = waTo(s.phone, 'Hola ' + String(s.name).split(' ')[0] + '! Este es tu link para pasarle a los feriantes: ' + link + ' y este para que se sumen a nuestras ofertas por WhatsApp: ' + canalLink(code) + ' Todo lo que compren por ahí queda a tu nombre. Tu panel, con promos y tu QR: ' + location.origin + '/#cuenta');
        return '<div class="scard' + (off ? ' off' : '') + '">' +
          '<div class="rcard-top"><div><b>' + esc(s.name) + ' <span class="code-chip">' + esc(code) + '</span></b><span>' + esc(s.phone || '') + (s.zone ? ' · ' + esc(s.zone) : '') + '</span>' +
          (s.recruitedBy ? '<span>Lo sumó ' + esc(sellerName(s.recruitedBy)) + (overrideFor(code) ? ' · extra vigente' : '') + '</span>' : '') + '</div>' +
          '<span class="rstate ' + (off ? 'inactivo' : 'activo') + '">' + (off ? 'Pausado' : 'Activo') + '</span></div>' +
          '<div class="rnums num"><div><small>Clientes</small><b>' + st.clients + '</b></div><div><small>Vendido 30 días</small><b>' + money(st.sales30) + '</b></div><div><small>A cobrar</small><b>' + money(st.pending) + '</b></div><div><small>Cobrado</small><b>' + money(st.paid) + '</b></div></div>' +
          '<p class="hint num">QR del canal: <b>' + scans(code) + '</b> escaneos</p>' +
          (team.length ? '<p class="hint">Sumó ' + team.length + ' vendedor' + (team.length > 1 ? 'es' : '') + ': ' + team.map(function (y) { return esc(y.name); }).join(', ') + '</p>' : '') +
          '<div class="linkrow"><input readonly value="' + esc(link) + '" aria-label="Link de ' + esc(s.name) + '"><button class="btn btn-line btn-sm" type="button" data-act="copy" data-text="' + esc(link) + '">Copiar link</button></div>' +
          '<div class="sactions">' +
          (st.pending > 0 ? '<button class="btn btn-main btn-sm" type="button" data-act="payout" data-code="' + esc(code) + '">Liquidar ' + money(st.pending) + ' (' + st.pendingN + ')</button>' : '') +
          (wa ? '<a class="btn btn-line btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'Mandarle su link</a>' : '') +
          '<button class="btn btn-line btn-sm" type="button" data-act="poster" data-type="promo" data-code="' + esc(code) + '">Promo y cartel</button>' +
          '<button class="linkbtn" type="button" data-act="seller-toggle" data-code="' + esc(code) + '">' + (off ? 'Reactivar' : 'Pausar') + '</button>' +
          '</div>' +
          (s.email ? '<p class="hint">Entra a su panel con ' + esc(s.email) + '</p>'
            : '<div class="linkrow"><input id="sa-' + esc(code) + '" type="email" placeholder="Mail para darle acceso a su panel" aria-label="Mail de ' + esc(s.name) + '"><button class="btn btn-line btn-sm" type="button" data-act="seller-access" data-code="' + esc(code) + '">Dar acceso</button></div>') +
          (mine.length ? '<details class="payouts"><summary>Liquidaciones (' + mine.length + ')</summary>' + mine.map(function (p) { return payoutRow(p, s); }).join('') + '</details>' : '') +
          '</div>';
      }).join('') + '</div>' : (sellerForm ? '' : '<div class="panel"><div class="empty">Todavía no hay vendedores. Dalos de alta acá o desde Contactos, cuando alguien completa el formulario “Quiero vender”.</div></div>'));
  }
  function scans(code) { var st = statsMap && statsMap['qr-' + (code || 'general')]; return st ? Number(st.views) || 0 : 0; }
  function promosAdmin() {
    if (statsMap === null) loadStats();
    var gl = canalLink('');
    var list = (sellers || []).filter(function (x) { return x.active !== false; });
    return '<div class="panel"><h2>Promos y QR</h2>' +
      '<p>Armá la imagen para mandar por la lista de difusión, subir a estados o imprimir. En todas figura <b>el WhatsApp del negocio' + (ourWa() ? ' (' + esc(ourWa()) + ')' : '') + '</b>.</p>' +
      '<div class="ctas" style="margin-top:14px"><button class="btn btn-main btn-sm" type="button" data-act="poster" data-type="promo">' + ic('share', 18) + 'Armar promo con productos</button>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="poster" data-type="qr">' + ic('qr', 18) + 'Cartel con QR</button></div></div>' +
      '<div class="panel"><h2>' + ic('megaphone', 22) + ' QR del canal de ofertas</h2>' +
      '<p>' + (hasChannel() ? 'Al escanearlo se abre tu canal de WhatsApp.' : 'Al escanearlo se abre WhatsApp con un mensaje listo para pedir que lo sumes a la lista de difusión (“Vengo de parte de…” si es de un vendedor).') +
      ' El QR apunta a la web y de ahí salta al canal: si mañana cambiás el canal, los carteles impresos siguen andando.</p>' +
      (!hasChannel() && isAdmin() ? '<p class="hint">¿Tenés un canal de WhatsApp? Pegá su link en <b>Datos y ajustes → Link del canal de WhatsApp</b>.</p>' : '') +
      '<div class="linkrow"><input readonly value="' + esc(gl) + '" aria-label="Link general del canal"><button class="btn btn-line btn-sm" type="button" data-act="copy" data-text="' + esc(gl) + '">Copiar</button></div>' +
      '<p class="hint num">Escaneos del QR general: <b>' + scans('') + '</b></p></div>' +
      '<div class="panel"><h2>Por vendedor</h2><p>Cada vendedor tiene su propio QR: los clientes que entran por ahí quedan a su nombre.</p>' +
      (list.length ? '<div class="prow-list">' + list.map(function (x) {
        return '<div class="promo-row"><div><b>' + esc(x.name) + '</b> <span class="code-chip">' + esc(x.id) + '</span><small class="num">' + scans(x.id) + ' escaneos del QR</small></div>' +
          '<div class="ctas"><button class="btn btn-line btn-sm" type="button" data-act="poster" data-type="promo" data-code="' + esc(x.id) + '">Promo</button><button class="btn btn-line btn-sm" type="button" data-act="poster" data-type="qr" data-code="' + esc(x.id) + '">Cartel</button></div></div>';
      }).join('') + '</div>' : '<div class="empty">Todavía no hay vendedores activos.' + (isAdmin() ? ' Dalos de alta en la pestaña Vendedores.' : '') + '</div>') +
      '</div>';
  }
  function payoutRow(p, s) {
    var d = p.createdAt && p.createdAt.toDate ? p.createdAt.toDate() : null;
    var lines = (p.items || []).map(function (it) { return '#' + it.order + (it.kind === 'override' ? ' (extra por ' + sellerName(it.from) + ')' : '') + ': ' + money(it.amount); });
    var msg = 'Hola ' + String((s && s.name) || '').split(' ')[0] + '! Te liquidamos ' + money(p.amount) + ' de comisiones' + (d ? ' el ' + fmtDate(d) : '') + ':\n' + lines.join('\n') + '\nGracias por tu trabajo.';
    var wa = s ? waTo(s.phone, msg) : '';
    return '<div class="prow-pay"><span class="num"><b>' + money(p.amount) + '</b> · ' + (d ? fmtDate(d) + '/' + d.getFullYear() : '') + ' · ' + (p.items || []).length + ' pedido' + ((p.items || []).length === 1 ? '' : 's') + '</span>' +
      (wa ? '<a class="linkbtn" href="' + esc(wa) + '" target="_blank" rel="noopener">Mandar detalle</a>' : '') + '</div>';
  }
  function loadSellers() {
    if (!fb || !isStaff()) return;
    fb.db.collection('sellers').get().then(function (snap) {
      sellers = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      sellersMap = {}; sellers.forEach(function (x) { sellersMap[x.id] = x; });
      if (view === 'admin') render(true);
    }).catch(function () { sellers = []; if (view === 'admin') render(true); });
  }
  function loadClients() {
    if (!fb || !isStaff()) return;
    fb.db.collection('clients').get().then(function (snap) {
      clientsMap = {}; snap.docs.forEach(function (d) { clientsMap[d.id] = d.data(); });
      if (view === 'admin') render(true);
    }).catch(function () { clientsMap = {}; });
  }
  function loadPayouts() {
    if (!fb || !isAdmin()) return;
    payouts = [];
    fb.db.collection('payouts').orderBy('createdAt', 'desc').limit(500).get().then(function (snap) {
      payouts = snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
      if (view === 'admin') render(true);
    }).catch(function () {});
  }
  var statsLoading = false;
  function loadStats() {
    if (!fb || !isStaff() || statsLoading) return;
    statsLoading = true;
    fb.db.collection('stats').get().then(function (snap) {
      statsLoading = false;
      statsMap = {}; snap.docs.forEach(function (d) { statsMap[d.id] = d.data(); });
      if (view === 'admin' && ['productos', 'promos', 'vendedores'].indexOf(adminTab) !== -1) render(true);
    }).catch(function () { statsLoading = false; statsMap = {}; });
  }
  function saveSeller() {
    var f = sellerForm; if (!f || busy) return;
    var code = cleanCode(f.code), name = String(f.name || '').trim(), phone = digits(f.phone), em = String(f.email || '').trim().toLowerCase();
    if (name.length < 2) { setToast('Escribí el nombre del vendedor.'); return; }
    if (phone.length < 8) { setToast('Revisá el WhatsApp del vendedor.'); return; }
    if (code.length < 3) { setToast('El código tiene que tener al menos 3 letras o números.'); return; }
    if (sellersMap[code]) { setToast('Ese código ya existe. Elegí otro.'); return; }
    if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setToast('Revisá el mail.'); return; }
    var doc = { name: name.slice(0, 80), phone: phone, zone: String(f.zone || '').trim().slice(0, 100), recruitedBy: f.recruitedBy || '', since: Date.now(), active: true, email: em, createdBy: user.email };
    var batch = fb.db.batch();
    batch.set(fb.db.collection('sellers').doc(code), doc);
    batch.set(fb.db.collection('codes').doc(code), { name: name.split(' ')[0].slice(0, 40), active: true });
    if (em) batch.set(fb.db.collection('team').doc(em), { role: 'seller', sellerCode: code, addedBy: user.email, addedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    if (f.leadId) batch.update(fb.db.collection('leads').doc(f.leadId), { status: 'acordado' });
    busy = true; render(true);
    batch.commit().then(function () {
      doc.id = code; sellers.push(doc); sellersMap[code] = doc;
      if (f.leadId) (leads || []).forEach(function (l) { if (l.id === f.leadId) l.status = 'acordado'; });
      busy = false; sellerForm = null; setToast(name + ' ya es vendedor. Su link: ' + sellerLink(code));
    }).catch(function (e) { busy = false; setToast(e && e.code === 'permission-denied' ? 'Sin permiso: revisá las reglas de Firestore.' : 'No se pudo dar de alta. Probá de nuevo.'); });
  }
  function toggleSeller(code) {
    var s = sellersMap[code]; if (!s) return;
    var act = s.active === false;
    var batch = fb.db.batch();
    batch.update(fb.db.collection('sellers').doc(code), { active: act });
    batch.set(fb.db.collection('codes').doc(code), { name: String(s.name).split(' ')[0].slice(0, 40), active: act });
    batch.commit().then(function () { s.active = act; setToast(act ? s.name + ' está activo de nuevo.' : s.name + ' quedó pausado: sus clientes no le generan comisión.'); })
      .catch(function () { setToast('No se pudo cambiar.'); });
  }
  function giveAccess(code) {
    var s = sellersMap[code], el = document.getElementById('sa-' + code);
    var em = el ? String(el.value || '').trim().toLowerCase() : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setToast('Escribí un mail válido.'); return; }
    var batch = fb.db.batch();
    batch.set(fb.db.collection('team').doc(em), { role: 'seller', sellerCode: code, addedBy: user.email, addedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    batch.update(fb.db.collection('sellers').doc(code), { email: em });
    batch.commit().then(function () { s.email = em; setToast('Listo. ' + s.name + ' entra en ' + location.origin + '/#admin con ' + em + '.'); })
      .catch(function () { setToast('No se pudo dar acceso.'); });
  }
  function liquidate(code, btn) {
    var items = pendingItems(code); if (!items.length || busy) return;
    var total = items.reduce(function (m, it) { return m + it.amount; }, 0);
    if (btn.getAttribute('data-confirm') !== '1') { btn.setAttribute('data-confirm', '1'); btn.textContent = 'Confirmar pago de ' + money(total); return; }
    var batch = fb.db.batch(), pref = fb.db.collection('payouts').doc();
    batch.set(pref, { code: code, amount: total, items: items.slice(0, 300), by: user.email, createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    items.forEach(function (it) { var u = {}; u['commission.' + it.kind + '.payoutId'] = pref.id; batch.update(fb.db.collection('orders').doc(it.id), u); });
    busy = true; render(true);
    batch.commit().then(function () {
      items.forEach(function (it) { (orders || []).forEach(function (o) { if (o.id === it.id && o.commission && o.commission[it.kind]) o.commission[it.kind].payoutId = pref.id; }); });
      payouts = payouts || []; payouts.unshift({ id: pref.id, code: code, amount: total, items: items, createdAt: { toDate: function () { return new Date(); } } });
      busy = false; setToast('Liquidación registrada: ' + money(total) + ' a ' + sellerName(code) + '. Mandale el detalle desde “Liquidaciones”.');
    }).catch(function () { busy = false; setToast('No se pudo registrar la liquidación.'); });
  }

  /* ================= panel del vendedor ================= */
  function loadSellerData() {
    var code = sellerCode; if (!code) return;
    var C = fb.db.collection.bind(fb.db);
    Promise.all([
      C('sellers').doc(code).get(),
      C('orders').where('sellerCode', '==', code).limit(500).get(),
      C('orders').where('overrideCode', '==', code).limit(500).get(),
      C('payouts').where('code', '==', code).limit(200).get(),
      C('sellers').where('recruitedBy', '==', code).limit(200).get()
    ]).then(function (r) {
      var map = function (snap) { return snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }); };
      var byDate = function (a, b) { var da = oDate(a), db = oDate(b); return (db ? db.getTime() : 0) - (da ? da.getTime() : 0); };
      sellerData = { me: r[0].exists ? r[0].data() : { name: '' }, orders: map(r[1]).sort(byDate), ovOrders: map(r[2]), payouts: map(r[3]).sort(byDate), team: map(r[4]) };
      render(true);
    }).catch(function () { sellerData = { error: true }; render(true); });
  }
  function sellerView() {
    var d = sellerData;
    var head = function (name) {
      return '<div class="admin-top"><div><span class="eyebrow">Panel de vendedor</span><h1 class="h2" style="margin-top:6px">Hola' + (name ? ', ' + esc(String(name).split(' ')[0]) : '') + '</h1>' +
        '<p style="color:var(--ink-3);font-size:14px;margin-top:6px">' + esc(user.email) + ' · código <b>' + esc(sellerCode) + '</b> · <button type="button" class="linkbtn" data-act="logout">Salir</button></p></div></div>';
    };
    if (!d) return '<div class="wrap admin">' + head('') + '<div class="panel"><p>Cargando tus datos…</p></div></div>';
    if (d.error) return '<div class="wrap admin">' + head('') + '<div class="panel"><p>No pudimos cargar tus datos. Recargá la página o avisanos por WhatsApp.</p></div></div>';
    var now = Date.now(), monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    var pending = 0, monthSales = 0, monthCom = 0;
    d.orders.forEach(function (o) {
      var c = o.commission; if (o.status !== 'entregado' || !c || !c.seller || c.seller.code !== sellerCode) return;
      if (!c.seller.payoutId) pending += c.seller.amount;
      if ((Number(o.deliveredAt) || 0) >= monthStart.getTime()) { monthSales += c.base || 0; monthCom += c.seller.amount; }
    });
    var extraBy = {};
    d.ovOrders.forEach(function (o) {
      var c = o.commission; if (o.status !== 'entregado' || !c || !c.override || c.override.code !== sellerCode) return;
      if (!c.override.payoutId) pending += c.override.amount;
      var k = c.seller ? c.seller.code : ''; extraBy[k] = (extraBy[k] || 0) + c.override.amount;
    });
    var paid = d.payouts.reduce(function (m, p) { return m + (Number(p.amount) || 0); }, 0);
    var clients = {};
    d.orders.forEach(function (o) {
      if (o.status === 'cancelado') return;
      var k = oKey(o), dt = oDate(o), t = dt ? dt.getTime() : 0;
      var c = clients[k] = clients[k] || { name: o.name, barrio: o.barrio, phone: o.phone, n: 0, total: 0, last: 0 };
      c.n++; c.total += Number(o.total) || 0; if (t > c.last) { c.last = t; c.name = o.name; c.barrio = o.barrio || c.barrio; }
    });
    var clist = Object.keys(clients).map(function (k) { return clients[k]; }).sort(function (a, b) { return b.last - a.last; });
    var activeClients = clist.filter(function (c) { return now - c.last <= monthsMs(comm().clientMonths); }).length;
    var link = sellerLink(sellerCode), linkV = sellerLink(sellerCode, true);
    var canal = canalLink(sellerCode);
    var shareFeriante = 'Hola! Te paso el catálogo de ' + cfg.brand.name + ' con precios de depósito para tu puesto: ' + link + ' Pedís por ahí y lo retirás o te lo enviamos. Y sumate a las ofertas de la semana por WhatsApp: ' + canal;
    var shareVend = '¿Querés ganar comisión vendiendo a feriantes? Sumate como vendedor de ' + cfg.brand.name + ': ' + linkV;
    var ST = { nuevo: 'Nuevo', confirmado: 'Confirmado', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' };
    return '<div class="wrap admin">' + head(d.me.name) +
      (d.me.active === false ? '<div class="admin-note">' + ic('info', 20) + '<span>Tu cuenta está pausada: por ahora tus clientes no generan comisión. Hablá con el equipo.</span></div>' : '') +
      '<div class="panel"><h2>Tus números</h2><div class="tiles">' +
      tile('A cobrar', money(pending), 'pedidos entregados sin liquidar') +
      tile('Cobrado', money(paid), d.payouts.length + ' liquidaci' + (d.payouts.length === 1 ? 'ón' : 'ones')) +
      tile('Ventas este mes', money(monthSales), 'tu comisión: ' + money(monthCom)) +
      tile('Clientes activos', String(activeClients), 'compraron en los últimos ' + comm().clientMonths + ' meses') +
      '</div></div>' +
      '<div class="panel"><h2>Tu QR y tus links</h2><p>Los feriantes que escanean tu QR se suman a nuestro canal de ofertas por WhatsApp y quedan a tu nombre. Lo mismo si compran por tu link o con tu código <b>' + esc(sellerCode) + '</b>.</p>' +
      '<div class="share-grid"><div class="qr-box"><div id="qr" data-text="' + esc(canal) + '" aria-label="Código QR del canal de ofertas"></div><small class="hint">Mostralo desde el celu: lo escanean y quedan sumados.</small></div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;min-width:0">' +
      '<label class="mini-label" for="lk-cat">Catálogo</label><div class="linkrow"><input id="lk-cat" readonly value="' + esc(link) + '"><button class="btn btn-line btn-sm" type="button" data-act="copy" data-text="' + esc(link) + '">Copiar</button></div>' +
      '<label class="mini-label" for="lk-canal">Canal de ofertas</label><div class="linkrow"><input id="lk-canal" readonly value="' + esc(canal) + '"><button class="btn btn-line btn-sm" type="button" data-act="copy" data-text="' + esc(canal) + '">Copiar</button></div>' +
      '<a class="btn btn-main btn-sm" href="https://wa.me/?text=' + encodeURIComponent(shareFeriante) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'Mandar el catálogo a un feriante</a>' +
      '<button class="btn btn-dark btn-sm" type="button" data-act="poster" data-type="promo" data-code="' + esc(sellerCode) + '">' + ic('share', 18) + 'Promo con productos para mandar</button>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="poster" data-type="qr" data-code="' + esc(sellerCode) + '">' + ic('camera', 18) + 'Cartel con tu QR para el puesto</button>' +
      (Number(comm().override) > 0 ? '<a class="btn btn-line btn-sm" href="https://wa.me/?text=' + encodeURIComponent(shareVend) + '" target="_blank" rel="noopener">' + ic('users', 18) + 'Invitar a otro vendedor</a>' : '') +
      '</div></div></div>' +
      '<div class="panel"><h2>Pedidos de tus clientes</h2>' +
      (d.orders.length ? '<div class="vtable" role="table">' + d.orders.slice(0, 80).map(function (o) {
        var c = o.commission, dt = oDate(o), com;
        if (o.status === 'cancelado') com = '<span class="muted">—</span>';
        else if (o.status === 'entregado' && c && c.seller) com = '<b>' + money(c.seller.amount) + '</b><small>' + (c.seller.payoutId ? 'pagada' : 'a cobrar') + '</small>';
        else com = '<span class="muted">' + money(calcCommission(o, sellerCode, null).seller.amount) + '</span><small>estimada</small>';
        return '<div class="vrow" role="row"><div><b>#' + esc(o.code || o.id.slice(0, 5).toUpperCase()) + '</b> · ' + esc(o.name) + '<small>' + (dt ? fmtDate(dt) : '') + ' · ' + money(o.total) + '</small></div>' +
          '<span class="vst st-' + esc(o.status) + '">' + (ST[o.status] || o.status) + '</span><div class="vcom num">' + com + '</div></div>';
      }).join('') + '</div>' : '<div class="empty">Todavía no hay pedidos a tu nombre. Compartí tu link con los feriantes de tus ferias.</div>') +
      '</div>' +
      (clist.length ? '<div class="panel"><h2>Tus clientes (' + clist.length + ')</h2><div class="rlist">' + clist.map(function (c) {
        var act = now - c.last <= monthsMs(comm().clientMonths);
        return '<div class="rcard"><div class="rcard-top"><div><b>' + esc(c.name) + '</b><span>' + esc(c.barrio || '') + (c.phone ? ' · ' + esc(c.phone) : '') + '</span></div><span class="rstate ' + (act ? 'activo' : 'inactivo') + '">' + (act ? 'Asignado' : 'Vencido') + '</span></div>' +
          '<div class="rnums num" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><small>Pedidos</small><b>' + c.n + '</b></div><div><small>Compró</small><b>' + money(c.total) + '</b></div><div><small>Último</small><b>' + fmtDate(new Date(c.last)) + '</b></div></div>' +
          (c.phone ? '<a class="btn btn-line btn-sm" href="' + esc(waTo(c.phone, 'Hola ' + String(c.name).split(' ')[0] + '! ¿Cómo va el puesto? Ya está el catálogo actualizado: ' + link)) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'Escribirle</a>' : '') +
          '</div>';
      }).join('') + '</div></div>' : '') +
      (d.team.length ? '<div class="panel"><h2>Vendedores que sumaste</h2><div class="rlist">' + d.team.map(function (t) {
        var until = (Number(t.since) || 0) + monthsMs(comm().overrideMonths), live = Date.now() <= until;
        return '<div class="rcard"><div class="rcard-top"><div><b>' + esc(t.name) + '</b><span>Desde ' + fmtDate(new Date(Number(t.since) || 0)) + '</span></div><span class="rstate ' + (live ? 'activo' : 'inactivo') + '">' + (live ? 'Extra hasta el ' + fmtDate(new Date(until)) : 'Extra finalizado') + '</span></div>' +
          '<p class="num">Tu extra por sus ventas: <b>' + money(extraBy[t.id] || 0) + '</b></p></div>';
      }).join('') + '</div></div>' : '') +
      '<div class="panel"><h2>Liquidaciones</h2>' + (d.payouts.length ? d.payouts.map(function (p) { return payoutRow(p, null); }).join('') : '<p class="hint">Todavía no hubo liquidaciones.</p>') + '</div>' +
      '<div class="panel"><h2>Cómo cobrás</h2>' + rulesHtml() + '</div>' +
      '</div>';
  }
  function drawQR() {
    var el = document.getElementById('qr'); if (!el) return;
    var go = function () { var e2 = document.getElementById('qr'); if (!e2 || !window.QRCode) return; e2.innerHTML = ''; new window.QRCode(e2, { text: e2.getAttribute('data-text'), width: 168, height: 168, colorDark: '#1E2A5A', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M }); };
    if (window.QRCode) { go(); return; }
    if (window.__qrLoading) return;
    window.__qrLoading = true;
    var sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    sc.onload = go;
    document.head.appendChild(sc);
  }

  /* ================= comisiones y envíos en el panel ================= */
  function parseCats(txt) { return String(txt || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function commissionsAdmin() {
    var c = cfgDraft.commissions, byCat = c.byCat || {};
    var cats = parseCats(cfgDraft.categoriesText);
    return '<div class="panel"><h2>Comisiones de vendedores</h2>' +
      '<p>Se muestran tal cual en la página para vendedores y en el panel de cada uno. Los cambios aplican a los pedidos que se entreguen desde ahora.</p>' +
      '<div class="form-grid">' +
      f('Comisión general (%)', 'commissions.base', { type: 'number' }) +
      f('Extra por vendedor sumado (%)', 'commissions.override', { type: 'number', help: '0 = sin extra por sumar vendedores' }) +
      f('Meses de extra por cada vendedor sumado', 'commissions.overrideMonths', { type: 'number' }) +
      f('Meses que un cliente queda asignado', 'commissions.clientMonths', { type: 'number', help: 'Se cuentan desde su última compra.' }) +
      f('Frecuencia de liquidación', 'commissions.payEvery', { ph: 'cada 15 días' }) +
      '</div>' +
      '<h3 class="sub-h">Comisión por rubro</h3><p class="hint">Vacío = usa la comisión general (' + esc(c.base) + '%).</p>' +
      '<div class="form-grid">' + cats.map(function (cat, i) {
        var v = byCat[cat];
        return '<div class="fld"><label for="cc-' + i + '">' + esc(cat) + ' (%)</label><input id="cc-' + i + '" type="number" inputmode="decimal" min="0" step="0.5" data-ccat="' + esc(cat) + '" value="' + (v === undefined || v === null ? '' : esc(v)) + '" placeholder="' + esc(c.base) + '"></div>';
      }).join('') + '</div></div>';
  }
  function shippingAdmin() {
    var sh = cfgDraft.shipping, zones = sh.zones || [];
    return '<div class="panel"><h2>Envíos</h2>' +
      '<label class="check"><input type="checkbox" data-c="shipping.enabled"' + (sh.enabled ? ' checked' : '') + '>Ofrecer envío además del retiro en el depósito</label>' +
      '<p class="hint">El cliente elige su zona en el carrito y el costo se suma al total. El envío no suma comisión.</p>' +
      '<div class="zlist">' + zones.map(function (z, i) {
        return '<div class="zrow">' +
          '<div class="fld"><label for="zn-' + i + '">Zona</label><input id="zn-' + i + '" data-zone="' + i + '" data-zf="name" value="' + esc(z.name) + '" placeholder="Ej: Lanús y Lomas"></div>' +
          '<div class="fld"><label for="zc-' + i + '">Costo ($)</label><input id="zc-' + i + '" type="number" inputmode="numeric" min="0" data-zone="' + i + '" data-zf="cost" value="' + esc(z.cost) + '"></div>' +
          '<div class="fld"><label for="ze-' + i + '">Demora</label><input id="ze-' + i + '" data-zone="' + i + '" data-zf="eta" value="' + esc(z.eta || '') + '" placeholder="Ej: 24 a 48 hs"></div>' +
          '<button class="del" type="button" data-act="zone-del" data-i="' + i + '">Quitar</button></div>';
      }).join('') + '</div>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="zone-add" style="align-self:flex-start">' + ic('plus', 18) + 'Agregar zona</button>' +
      '<div class="form-grid">' + f('Aclaración para el cliente (opcional)', 'shipping.note', { wide: true, ph: 'Ej: entregamos martes y viernes por la tarde' }) + '</div>' +
      '</div>';
  }

  /* ================= cartel con QR por vendedor ================= */
  var poster = null; // { code, name, phone, kind: 'a4' | 'story', showPhone, url, busy }
  function loadQRLib() {
    return new Promise(function (res, rej) {
      if (window.QRCode) { res(); return; }
      var sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      sc.onload = function () { res(); }; sc.onerror = rej;
      document.head.appendChild(sc);
    });
  }
  function qrCanvas(text, size) {
    var div = document.createElement('div');
    new window.QRCode(div, { text: text, width: size, height: size, colorDark: '#1E2A5A', colorLight: '#FFFFFF', correctLevel: window.QRCode.CorrectLevel.H });
    return div.querySelector('canvas');
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function fmtPhone(p) {
    var d = digits(p);
    if (d.indexOf('549') === 0) d = d.slice(3); else if (d.indexOf('54') === 0 && d.length === 12) d = d.slice(2);
    if (d.length === 10 && d.indexOf('11') === 0) return '11 ' + d.slice(2, 6) + '-' + d.slice(6);
    if (d.length === 10) return d.slice(0, 3) + ' ' + d.slice(3, 6) + '-' + d.slice(6);
    return p || '';
  }
  function makePoster(pz) {
    var story = pz.kind === 'story';
    var W = story ? 1080 : 1654, H = story ? 1920 : 2339, s = W / 1080;
    var link = qrTarget(pz);
    var D = '"Bricolage Grotesque", Figtree, system-ui, sans-serif', B = 'Figtree, system-ui, sans-serif';
    var fontsReady = document.fonts ? Promise.all([
      document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('700 40px Figtree'), document.fonts.load('500 40px Figtree')
    ]).catch(function () {}) : Promise.resolve();
    return Promise.all([loadQRLib(), fontsReady]).then(function () {
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      var qr = qrCanvas(link, 800);
      var minQR = W * (story ? 0.52 : 0.46);
      var t = s, qrSize = 0;
      for (var i = 0; i < 8; i++) { qrSize = drawPoster(g, t); if (qrSize >= minQR) break; t *= 0.92; }
      drawPoster(g, t, qr);
      return cv.toDataURL('image/png');

      function drawPoster(g, t, qrImg) {
        var NAVY = '#1E2A5A', ORANGE = '#FF6B1A', CREAM = '#FFF8F0', GREEN = '#15803D', M = 72 * s;
        g.setTransform(1, 0, 0, 1, 0, 0); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.fillStyle = CREAM; g.fillRect(0, 0, W, H);
        var top = (story ? 250 : 210) * t;
        g.fillStyle = ORANGE; g.fillRect(0, 0, W, top);
        var ls = 104 * t, lx = M, ly = top / 2 - ls / 2;
        g.fillStyle = NAVY; rrect(g, lx, ly, ls, ls, 24 * t); g.fill();
        g.save(); g.translate(lx + ls * 0.16, ly + ls * 0.16); g.scale(ls / 30, ls / 30);
        g.strokeStyle = ORANGE; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(1, 9.5); g.lineTo(10, 3); g.lineTo(19, 9.5); g.moveTo(3, 8.5); g.lineTo(3, 19); g.lineTo(17, 19); g.lineTo(17, 8.5); g.moveTo(7, 19); g.lineTo(7, 13); g.lineTo(13, 13); g.lineTo(13, 19); g.stroke();
        g.restore();
        g.fillStyle = NAVY; g.textBaseline = 'middle';
        g.font = '800 ' + Math.round(76 * t) + 'px ' + D;
        g.fillText(cfg.brand.name, lx + ls + 28 * t, top / 2 + 2 * t);
        g.textBaseline = 'alphabetic';
        var y = top + 140 * t;
        g.fillStyle = NAVY; g.font = '800 ' + Math.round(104 * t) + 'px ' + D;
        ['Precios de depósito', 'para tu puesto'].forEach(function (ln) { g.fillText(ln, M, y); y += 108 * t; });
        y += 4 * t;
        g.fillStyle = '#4A5380'; g.font = '600 ' + Math.round(36 * t) + 'px ' + B;
        y += wrapText(g, (cfg.categories || []).slice(0, 7).join(' · '), M, y, W - 2 * M, 48 * t, 2) * 48 * t + 34 * t;
        [
          'Ves tu ganancia en cada producto antes de comprar',
          'Pedís por WhatsApp en un minuto',
          shipOn() ? 'Retirás en el depósito o te lo enviamos' : 'Retirás en el depósito, sin vueltas'
        ].forEach(function (b) {
          var cx = M + 22 * t, cy = y - 13 * t;
          g.fillStyle = GREEN; g.beginPath(); g.arc(cx, cy, 22 * t, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#FFFFFF'; g.lineWidth = 5 * t; g.lineCap = 'round'; g.lineJoin = 'round';
          g.beginPath(); g.moveTo(cx - 10 * t, cy); g.lineTo(cx - 3 * t, cy + 8 * t); g.lineTo(cx + 11 * t, cy - 8 * t); g.stroke();
          g.fillStyle = NAVY; g.font = '600 ' + Math.round(36 * t) + 'px ' + B;
          y += wrapText(g, b, M + 64 * t, y, W - 2 * M - 64 * t, 46 * t, 2) * 46 * t + 22 * t;
        });
        var bottomBand = 150 * t;
        var cardX = M, cardW = W - 2 * M, cardY = y + 16 * t, cardH = H - bottomBand - 56 * t - cardY;
        var wa = ourWa();
        var infoH = ((pz.code ? 180 : 40) + (wa ? 64 : 0)) * t;
        var qrSize = Math.min(cardW - 120 * t, cardH - 130 * t - infoH);
        if (!qrImg) return qrSize;
        // la tarjeta se ajusta al contenido y queda centrada en el espacio libre
        var used = 130 * t + qrSize + infoH;
        cardY = cardY + Math.max(0, (cardH - used) / 2); cardH = used;
        g.fillStyle = 'rgba(30,42,90,0.10)'; rrect(g, cardX + 6 * t, cardY + 10 * t, cardW, cardH, 40 * t); g.fill();
        g.fillStyle = '#FFFFFF'; rrect(g, cardX, cardY, cardW, cardH, 40 * t); g.fill();
        g.strokeStyle = '#F0DCC8'; g.lineWidth = 3 * t; rrect(g, cardX, cardY, cardW, cardH, 40 * t); g.stroke();
        g.textAlign = 'center';
        g.fillStyle = NAVY; g.font = '800 ' + Math.round(52 * t) + 'px ' + D;
        g.fillText(pz.dest === 'catalogo' ? 'Escaneá y mirá el catálogo' : 'Escaneá y recibí las ofertas', W / 2, cardY + 82 * t);
        var qy = cardY + 116 * t;
        g.imageSmoothingEnabled = false;
        g.drawImage(qrImg, (W - qrSize) / 2, qy, qrSize, qrSize);
        g.imageSmoothingEnabled = true;
        var iy = qy + qrSize + 66 * t, nextY = qy + qrSize + 20 * t;
        g.textAlign = 'center';
        if (pz.code) {
          var pre = 'Te atiende ', nm = String(pz.name || '').split(' ')[0];
          g.font = '800 ' + Math.round(46 * t) + 'px ' + D; var wName = g.measureText(nm).width;
          g.font = '500 ' + Math.round(40 * t) + 'px ' + B; var wPre = g.measureText(pre).width;
          var st = W / 2 - (wPre + wName) / 2;
          g.textAlign = 'left'; g.fillStyle = '#4A5380'; g.fillText(pre, st, iy);
          g.fillStyle = NAVY; g.font = '800 ' + Math.round(46 * t) + 'px ' + D; g.fillText(nm, st + wPre, iy);
          g.textAlign = 'center';
          var chip = 'Código ' + pz.code;
          g.font = '800 ' + Math.round(34 * t) + 'px ' + B;
          var cw = g.measureText(chip).width + 52 * t, chy = iy + 26 * t;
          g.fillStyle = NAVY; rrect(g, W / 2 - cw / 2, chy, cw, 60 * t, 30 * t); g.fill();
          g.fillStyle = '#FFFFFF'; g.fillText(chip, W / 2, chy + 42 * t);
          nextY = chy + 60 * t;
        }
        if (wa) { g.fillStyle = GREEN; g.font = '800 ' + Math.round(38 * t) + 'px ' + B; g.fillText('WhatsApp ' + wa, W / 2, nextY + 54 * t); }
        g.fillStyle = NAVY; g.fillRect(0, H - bottomBand, W, bottomBand);
        g.fillStyle = '#FFFFFF'; g.font = '700 ' + Math.round(36 * t) + 'px ' + B;
        g.fillText(location.host.replace(/^www\./, '') + (pz.code ? '/?v=' + pz.code : ''), W / 2, H - bottomBand / 2 - 4 * t);
        g.fillStyle = '#C9CFE6'; g.font = '500 ' + Math.round(27 * t) + 'px ' + B;
        g.fillText('Sin cuota ni inscripción · ' + (cfg.brand.tagline || ''), W / 2, H - bottomBand / 2 + 38 * t);
        return qrSize;
      }
    });
  }
  /* ================= promo con productos ================= */
  function loadImgSafe(src) {
    return new Promise(function (res) {
      if (!src) { res(null); return; }
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = src;
    });
  }
  function promoPool(source) {
    var avail = products.filter(function (p) { return p.stock !== 'out'; });
    if (source === 'ofertas') return avail.filter(onOffer);
    if (source === 'destacados') return avail.filter(function (p) { return p.featured; });
    if (source === 'combos') return avail.filter(function (p) { return p.combo; });
    if (source && source.indexOf('cat:') === 0) { var c = source.slice(4); return avail.filter(function (p) { return p.cat === c; }); }
    return avail;
  }
  function promoDefaults() {
    var src = products.some(function (p) { return onOffer(p) && p.stock !== 'out'; }) ? 'ofertas' : 'destacados';
    var sel = promoPool(src).slice(0, 6).map(function (p) { return p.id; });
    if (sel.length < 4) promoPool('todo').forEach(function (p) { if (sel.length < 6 && sel.indexOf(p.id) === -1) sel.push(p.id); });
    return { source: src, sel: sel, title: src === 'ofertas' ? '¡Ofertas para tu puesto!' : '¡Precios de depósito!', subtitle: 'Comprá barato, revendé y ganá' };
  }
  function seeded(n) { var x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function burst(g, cx, cy, r1, r2, pts, fill) {
    g.beginPath();
    for (var i = 0; i < pts * 2; i++) { var r = i % 2 ? r2 : r1, a = Math.PI * i / pts - Math.PI / 2; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
    g.closePath(); g.fillStyle = fill; g.fill();
  }
  function fitFont(g, text, weight, family, size, maxW, min) {
    var sz = size;
    while (sz > min) { g.font = weight + ' ' + Math.round(sz) + 'px ' + family; if (g.measureText(text).width <= maxW) break; sz -= 2; }
    return sz;
  }
  function makePromo(pz) {
    var story = pz.kind !== 'square';
    var W = 1080, H = story ? 1920 : 1350;
    var D = '"Bricolage Grotesque", Figtree, system-ui, sans-serif', B = 'Figtree, system-ui, sans-serif';
    var NAVY = '#1E2A5A', ORANGE = '#FF6B1A', YELLOW = '#FFD23F', GREEN = '#15803D', CREAM = '#FFF8F0';
    var items = pz.sel.map(prodById).filter(Boolean).slice(0, 6);
    var fontsReady = document.fonts ? Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('700 40px Figtree'), document.fonts.load('600 40px Figtree')]).catch(function () {}) : Promise.resolve();
    return Promise.all([loadQRLib(), fontsReady, Promise.all(items.map(function (p) { return loadImgSafe(p.img); }))]).then(function (r) {
      var imgs = r[2];
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      // fondo con rayos y papelitos
      g.fillStyle = ORANGE; g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, story ? 330 : 260);
      for (var k = 0; k < 18; k++) { g.rotate(Math.PI / 9); g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-90, -1600); g.lineTo(90, -1600); g.closePath(); g.fill(); }
      g.restore();
      var conf = ['#FFD23F', '#FFFFFF', '#1E2A5A', '#15803D'];
      for (var c = 0; c < 46; c++) {
        var cx = seeded(c) * W, cy = seeded(c + 99) * H * (story ? 0.24 : 0.22) + 8, sz = 8 + seeded(c + 7) * 14;
        g.save(); g.translate(cx, cy); g.rotate(seeded(c + 3) * Math.PI); g.fillStyle = conf[c % 4]; g.globalAlpha = 0.85; g.fillRect(-sz / 2, -sz / 4, sz, sz / 2); g.restore();
      }
      // marca
      var M = 56, ls = 92;
      g.fillStyle = NAVY; rrect(g, M, 44, ls, ls, 22); g.fill();
      g.save(); g.translate(M + ls * 0.16, 44 + ls * 0.16); g.scale(ls / 30, ls / 30);
      g.strokeStyle = ORANGE; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(1, 9.5); g.lineTo(10, 3); g.lineTo(19, 9.5); g.moveTo(3, 8.5); g.lineTo(3, 19); g.lineTo(17, 19); g.lineTo(17, 8.5); g.moveTo(7, 19); g.lineTo(7, 13); g.lineTo(13, 13); g.lineTo(13, 19); g.stroke();
      g.restore();
      g.fillStyle = '#FFFFFF'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = '800 64px ' + D;
      g.fillText(cfg.brand.name, M + ls + 22, 44 + ls / 2 + 2);
      // sello
      var bx = W - 150, by = 112;
      burst(g, bx, by, 104, 86, 18, YELLOW);
      g.save(); g.translate(bx, by); g.rotate(-0.12); g.fillStyle = NAVY; g.textAlign = 'center';
      g.font = '800 30px ' + D; g.fillText('PRECIOS', 0, -18); g.fillText('DE DEPÓSITO', 0, 18); g.restore();
      // titular en cinta
      var ty = story ? 300 : 236, tw = W - 2 * M;
      g.save(); g.translate(W / 2, ty); g.rotate(-0.03);
      var fs = fitFont(g, pz.title, '800', D, story ? 96 : 84, tw - 70, 44);
      var th = fs * 1.35;
      g.fillStyle = 'rgba(30,42,90,0.35)'; rrect(g, -tw / 2 + 8, -th / 2 + 10, tw, th, 22); g.fill();
      g.fillStyle = '#FFFFFF'; rrect(g, -tw / 2, -th / 2, tw, th, 22); g.fill();
      g.fillStyle = NAVY; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 ' + Math.round(fs) + 'px ' + D;
      g.fillText(pz.title, 0, 4);
      g.restore();
      g.textBaseline = 'alphabetic'; g.textAlign = 'center'; g.fillStyle = '#FFFFFF';
      var ss = fitFont(g, pz.subtitle, '700', B, story ? 42 : 38, W - 2 * M, 26);
      g.font = '700 ' + Math.round(ss) + 'px ' + B; g.fillText(pz.subtitle, W / 2, ty + th / 2 + (story ? 76 : 64));
      // grilla de productos
      var bottomH = story ? 300 : 230;
      var gTop = ty + th / 2 + (story ? 120 : 96), gBot = H - bottomH - 36;
      var n = Math.max(1, items.length);
      var cols = story ? (n === 1 ? 1 : 2) : (n <= 2 ? n : n <= 4 ? 2 : 3);
      var rows = Math.ceil(n / cols), gap = 24;
      var cw = (W - 2 * M - gap * (cols - 1)) / cols, ch = (gBot - gTop - gap * (rows - 1)) / rows;
      items.forEach(function (p, i) {
        var col = i % cols, row = Math.floor(i / cols);
        var lastRow = row === rows - 1, inRow = lastRow ? n - row * cols : cols;
        var offX = lastRow && inRow < cols ? (cols - inRow) * (cw + gap) / 2 : 0;
        var x = M + offX + col * (cw + gap), y = gTop + row * (ch + gap);
        var f = Math.min(cw / 460, ch / 520), pad = 16 * f;
        g.fillStyle = 'rgba(30,42,90,0.28)'; rrect(g, x + 5, y + 8, cw, ch, 26); g.fill();
        g.fillStyle = '#FFFFFF'; rrect(g, x, y, cw, ch, 26); g.fill();
        var infoH = pad + 2 * 34 * f + 8 * f + 60 * f + 10 * f + 46 * f + pad;
        var ih = Math.max(60, Math.min(cw - 2 * pad, ch - infoH - pad));
        var iw = cw - 2 * pad, ix = x + pad, iy = y + pad;
        g.save(); rrect(g, ix, iy, iw, ih, 18); g.clip();
        var im = imgs[i];
        if (im) {
          var sc = Math.max(iw / im.naturalWidth, ih / im.naturalHeight), dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
          g.drawImage(im, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
        } else {
          g.fillStyle = CREAM; g.fillRect(ix, iy, iw, ih);
          g.fillStyle = '#E8A57A'; g.textAlign = 'center'; g.font = '800 ' + Math.round(ih * 0.4) + 'px ' + D;
          g.fillText(String(p.name).charAt(0).toUpperCase(), ix + iw / 2, iy + ih * 0.64);
        }
        g.restore();
        if (onOffer(p)) {
          g.fillStyle = YELLOW; rrect(g, ix + 12 * f, iy + 12 * f, 150 * f, 46 * f, 23 * f); g.fill();
          g.fillStyle = NAVY; g.textAlign = 'center'; g.font = '800 ' + Math.round(26 * f) + 'px ' + D; g.fillText('OFERTA', ix + 12 * f + 75 * f, iy + 12 * f + 32 * f);
        } else if (p.combo) {
          g.fillStyle = NAVY; rrect(g, ix + 12 * f, iy + 12 * f, 140 * f, 46 * f, 23 * f); g.fill();
          g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.font = '800 ' + Math.round(26 * f) + 'px ' + D; g.fillText('COMBO', ix + 12 * f + 70 * f, iy + 12 * f + 32 * f);
        }
        var yy = iy + ih + 12 * f + 30 * f;
        g.textAlign = 'left'; g.fillStyle = NAVY; g.font = '700 ' + Math.round(29 * f) + 'px ' + B;
        var nl = wrapText(g, p.name, ix, yy, iw, 34 * f, 2);
        yy += (nl - 1) * 34 * f + 66 * f;
        g.font = '800 ' + Math.round(58 * f) + 'px ' + D; g.fillStyle = NAVY;
        var priceTxt = money(priceOf(p)); g.fillText(priceTxt, ix, yy);
        if (onOffer(p)) {
          var pw = g.measureText(priceTxt).width;
          g.font = '600 ' + Math.round(28 * f) + 'px ' + B; g.fillStyle = '#6B7299';
          var old = money(p.price), ow = g.measureText(old).width, ox = ix + pw + 14 * f;
          if (ox + ow <= ix + iw) { g.fillText(old, ox, yy); g.fillRect(ox, yy - 10 * f, ow, 3 * f); }
        }
        if (gain(p) > 0) {
          var gt = 'Ganás ' + money(gain(p));
          g.font = '800 ' + Math.round(26 * f) + 'px ' + B;
          var gw = g.measureText(gt).width + 28 * f, gy = yy + 16 * f;
          g.fillStyle = '#DCFCE7'; rrect(g, ix, gy, gw, 44 * f, 22 * f); g.fill();
          g.fillStyle = GREEN; g.fillText(gt, ix + 14 * f, gy + 31 * f);
        }
      });
      // franja inferior
      g.fillStyle = NAVY; g.fillRect(0, H - bottomH, W, bottomH);
      g.fillStyle = YELLOW; g.fillRect(0, H - bottomH, W, 10);
      var qs = bottomH - 70, qx = M, qy = H - bottomH + 40;
      g.fillStyle = '#FFFFFF'; rrect(g, qx - 10, qy - 10, qs + 20, qs + 20, 16); g.fill();
      var qr = qrCanvas(qrTarget(pz), 600);
      g.imageSmoothingEnabled = false; g.drawImage(qr, qx, qy, qs, qs); g.imageSmoothingEnabled = true;
      var tx = qx + qs + 44, maxTW = W - tx - M, top0 = H - bottomH;
      g.textAlign = 'left'; g.fillStyle = '#FFFFFF';
      var l1 = pz.dest === 'catalogo' ? 'Escaneá y mirá el catálogo' : 'Escaneá y recibí las ofertas';
      g.font = '800 ' + Math.round(fitFont(g, l1, '800', D, story ? 48 : 40, maxTW, 24)) + 'px ' + D;
      g.fillText(l1, tx, top0 + (story ? 86 : 70));
      var wa = ourWa();
      if (wa) {
        var wt = 'WhatsApp ' + wa;
        g.fillStyle = YELLOW; g.font = '800 ' + Math.round(fitFont(g, wt, '800', B, story ? 40 : 34, maxTW, 22)) + 'px ' + B;
        g.fillText(wt, tx, top0 + (story ? 140 : 116));
      }
      var site = location.host.replace(/^www\./, '') + (pz.code ? '/?v=' + pz.code : '');
      g.fillStyle = '#C9CFE6'; g.font = '600 ' + Math.round(fitFont(g, site, '600', B, story ? 30 : 26, maxTW, 18)) + 'px ' + B;
      g.fillText(site, tx, top0 + (story ? 184 : 154));
      if (pz.code) {
        var chip = 'Código ' + pz.code + (pz.name ? ' · ' + String(pz.name).split(' ')[0] : '');
        var chH = story ? 50 : 40;
        g.font = '800 ' + Math.round(story ? 28 : 24) + 'px ' + B;
        var cwid = Math.min(maxTW, g.measureText(chip).width + 40), cyy = top0 + (story ? 210 : 174);
        g.fillStyle = ORANGE; rrect(g, tx, cyy, cwid, chH, chH / 2); g.fill(); g.fillStyle = NAVY; g.fillText(chip, tx + 20, cyy + chH * 0.68);
      }
      return cv.toDataURL('image/jpeg', 0.9);
    });
  }

  function qrTarget(pz) { return pz.dest === 'catalogo' ? (pz.code ? sellerLink(pz.code) : location.origin + '/#catalogo') : canalLink(pz.code); }
  function openPoster(code, type) {
    var info = { name: '', phone: '' };
    if (code) {
      if (isSeller() && sellerData && sellerData.me) info = { name: sellerData.me.name, phone: sellerData.me.phone };
      else if (sellersMap[code]) info = { name: sellersMap[code].name, phone: sellersMap[code].phone };
      else return;
    }
    var d = promoDefaults();
    type = type === 'qr' ? 'qr' : 'promo';
    poster = { code: code || '', name: info.name, type: type, kind: type === 'qr' ? 'a4' : 'story', dest: 'canal', url: null,
      source: d.source, sel: d.sel, title: d.title, subtitle: d.subtitle };
    render(true); buildPoster();
  }
  var posterTimer = null;
  function buildPoster(delay) {
    if (!poster) return;
    clearTimeout(posterTimer);
    var pz = poster;
    var run = function () {
      if (poster !== pz) return;
      pz.url = null; render(true);
      var job = pz.type === 'promo' ? makePromo(pz) : makePoster(pz);
      job.then(function (u) { if (poster === pz) { pz.url = u; render(true); } })
        .catch(function () { if (poster === pz) { poster = null; setToast('No se pudo armar la imagen. Revisá la conexión y probá de nuevo.'); } });
    };
    if (delay) posterTimer = setTimeout(run, delay); else run();
  }
  function posterModal() {
    if (!poster) return '';
    var pz = poster, promo = pz.type === 'promo';
    var fname = (promo ? 'promo-' : 'cartel-') + (pz.code || 'general') + '-' + pz.kind + (promo ? '.jpg' : '.png');
    var canShare = !!(navigator.canShare && window.File);
    var first = String(pz.name || '').split(' ')[0];
    var kinds = promo ? [['story', 'Estados (vertical)'], ['square', 'Feed y WhatsApp']] : [['a4', 'Para imprimir (A4)'], ['story', 'Para estados']];
    var sources = [['ofertas', 'Ofertas'], ['destacados', 'Destacados'], ['combos', 'Combos'], ['todo', 'Todos los productos']].concat((cfg.categories || []).map(function (c) { return ['cat:' + c, c]; }));
    var pool = promo ? promoPool(pz.source) : [];
    var extra = promo ? pz.sel.map(prodById).filter(function (p) { return p && pool.indexOf(p) === -1; }) : [];
    return '<div class="modal-wrap" data-act="close-poster" style="z-index:60"><div class="modal poster-modal" role="dialog" aria-modal="true" aria-label="' + (promo ? 'Promo con productos' : 'Cartel con QR') + '" data-stop="1">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 style="font-size:22px">' + (promo ? 'Promo con productos' : pz.code ? 'Cartel de ' + esc(first) : 'Cartel con QR') + '</h2><button class="x" type="button" data-act="close-poster" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      ('<div class="ptype" role="tablist">' +
        '<button type="button" role="tab" class="ptype-btn' + (promo ? ' on' : '') + '" aria-selected="' + promo + '" data-act="poster-type" data-type="promo"><b>Promo con productos</b><small>Para mandar y publicar</small></button>' +
        '<button type="button" role="tab" class="ptype-btn' + (!promo ? ' on' : '') + '" aria-selected="' + !promo + '" data-act="poster-type" data-type="qr"><b>Cartel con QR</b><small>' + (pz.code ? 'Para el puesto' : 'Para imprimir y pegar') + '</small></button></div>') +
      '<div class="pdest"><span>El QR lleva a</span><div class="ptabs">' + [['canal', 'Canal de ofertas (WhatsApp)'], ['catalogo', 'Catálogo web']].map(function (k) { return '<button type="button" class="chip' + (pz.dest === k[0] ? ' on' : '') + '" data-act="poster-dest" data-dest="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="ptabs">' + kinds.map(function (k) { return '<button type="button" class="chip' + (pz.kind === k[0] ? ' on' : '') + '" data-act="poster-kind" data-kind="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>' +
      (promo ? '<div class="form-grid promo-form">' +
        '<div class="fld wide"><label for="pz-title">Título</label><input id="pz-title" data-pz="title" maxlength="40" value="' + esc(pz.title) + '"></div>' +
        '<div class="fld wide"><label for="pz-sub">Bajada</label><input id="pz-sub" data-pz="subtitle" maxlength="60" value="' + esc(pz.subtitle) + '"></div>' +
        '<div class="fld wide"><label for="pz-src">Productos de</label><select id="pz-src" data-pz="source">' + sources.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (pz.source === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>' +
        '</div>' +
        '<div class="pick"><div class="pick-head"><b>Elegí hasta 6</b><span class="num">' + pz.sel.length + '/6</span></div>' +
        ((pool.length + extra.length) ? '<div class="pick-list">' + extra.concat(pool).slice(0, 40).map(function (p) {
          var on = pz.sel.indexOf(p.id) !== -1, dis = !on && pz.sel.length >= 6;
          return '<label class="pick-item' + (on ? ' on' : '') + (dis ? ' dis' : '') + '"><input type="checkbox" data-pick="' + esc(p.id) + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '><img src="' + esc(imgOf(p)) + '" alt=""><span><b>' + esc(p.name) + '</b><small class="num">' + money(priceOf(p)) + (onOffer(p) ? ' · oferta' : '') + '</small></span></label>';
        }).join('') + '</div>' : '<p class="hint">No hay productos con stock en esta selección.</p>') + '</div>' : '') +
      '<div class="poster-prev' + (pz.kind === 'story' ? ' story' : '') + '">' + (pz.url ? '<img src="' + pz.url + '" alt="Vista previa">' : '<div class="empty">Armando la imagen…</div>') + '</div>' +
      '<p class="hint">' + (promo ? 'Mandala por WhatsApp o subila a estados e Instagram. ' : pz.kind === 'a4' ? 'Imprimilo en A4, a color, y pegalo en el puesto. ' : 'Subilo a los estados de WhatsApp o a Instagram. ') +
        (pz.dest === 'catalogo' ? 'El QR abre el catálogo' : 'El QR abre ' + (hasChannel() ? 'nuestro canal de WhatsApp' : 'WhatsApp con un mensaje para sumarse a la lista de difusión')) +
        (pz.code ? ' y el cliente queda a nombre de ' + esc(first) + '.' : '.') + ' El WhatsApp que figura es el del negocio' + (ourWa() ? ' (' + esc(ourWa()) + ')' : '') + '.</p>' +
      (pz.dest === 'canal' && !hasChannel() && isAdmin() ? '<p class="hint">Tip: si creás un canal de WhatsApp, pegá su link en Datos y ajustes → “Link del canal de WhatsApp” y el QR va directo ahí. Los carteles ya impresos siguen funcionando.</p>' : '') +
      '<div class="ctas">' +
      (pz.url ? '<a class="btn btn-main btn-sm" href="' + pz.url + '" download="' + fname + '">Descargar</a>' : '') +
      (pz.url && canShare ? '<button class="btn btn-line btn-sm" type="button" data-act="poster-share">' + ic('share', 18) + 'Compartir por WhatsApp</button>' : '') +
      '</div></div></div>';
  }
  function sharePoster() {
    if (!poster || !poster.url) return;
    fetch(poster.url).then(function (r) { return r.blob(); }).then(function (blob) {
      var isJpg = blob.type === 'image/jpeg';
      var file = new File([blob], (poster.type === 'promo' ? 'promo-' : 'cartel-') + (poster.code || 'general') + (isJpg ? '.jpg' : '.png'), { type: blob.type || 'image/png' });
      var txt = poster.dest === 'catalogo' ? 'Catálogo de ' + cfg.brand.name + ' con precios de depósito: ' + qrTarget(poster) : 'Sumate a las ofertas de ' + cfg.brand.name + ' por WhatsApp: ' + qrTarget(poster);
      if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], text: txt });
      setToast('Tu celular no permite compartir directo. Usá “Descargar”.', true);
    }).catch(function () {});
  }

  /* ================= QR del canal de difusión ================= */
  var canalDone = false;
  function canalCode() { return refName ? refCode : cleanCode(buyer.ref); }
  function canalView() {
    var code = canalCode(), target = canalTarget(code, refName);
    var wa = ourWa();
    return '<section class="canal-go"><div class="wrap"><div class="canal-box">' +
      '<span class="canal-ico">' + ic('megaphone', 34) + '</span>' +
      '<h1 class="h2">Te llevamos a las ofertas de ' + esc(cfg.brand.name) + '</h1>' +
      '<p>' + (hasChannel() ? 'Se abre nuestro canal de WhatsApp: tocá <b>Unirme</b> y listo, te llegan el catálogo y las ofertas de la semana.'
        : 'Se abre WhatsApp con el mensaje listo: tocá <b>Enviar</b> y te sumamos a la lista de difusión.') + '</p>' +
      (!hasChannel() && wa ? '<p class="canal-save">' + ic('info', 18) + '<span>Agendá nuestro número <b class="num">' + esc(wa) + '</b>: sin eso, WhatsApp no te deja recibir las ofertas.</span></p>' : '') +
      (refName && code ? '<div class="ref-chip">' + ic('users', 18) + '<span>Te atiende <b>' + esc(refName) + '</b> · código ' + esc(code) + '</span></div>' : '') +
      '<div class="ctas"><a class="btn btn-main" href="' + esc(target) + '" rel="noopener">' + ic('wa') + (hasChannel() ? 'Abrir el canal' : 'Abrir WhatsApp') + '</a>' +
      '<a class="btn btn-line" href="#catalogo" data-go="catalogo">Ver el catálogo</a></div>' +
      '</div></div></section>';
  }
  function canalRedirect() {
    if (canalDone || !goCanal) return;
    canalDone = true;
    var code = canalCode();
    bump('qr-' + (code || 'general'), 'views');
    render(true);
    setTimeout(function () { if (view === 'canal') window.location.href = canalTarget(code, refName); }, 1600);
  }

  /* ================= render ================= */
  function render(keepScroll) {
    if (!cfg) return;
    var y = window.scrollY;
    var active = document.activeElement && document.activeElement.id;
    if (view === 'admin' && isClient()) { view = 'cuenta'; setHash('cuenta'); }
    if (view === 'cuenta' && (isStaff() || isSeller())) view = 'admin';
    var main = view === 'canal' ? canalView() : view === 'catalogo' ? catalog() : view === 'admin' ? adminView() : view === 'cuenta' ? accountView() : view === 'contacto' ? contactView() : landing();
    var t = cartTotals();
    document.body.classList.toggle('has-cart', !!t.count && view !== 'admin');
    document.body.classList.toggle('lock', !!(cartOpen || detailId || share || editing || poster));
    app.innerHTML = header() + '<main>' + main + '</main>' + (view === 'admin' ? '' : footer()) +
      (view === 'admin' || view === 'canal' ? '' : '<a class="wa-float" href="' + esc(waLink('Hola ' + cfg.brand.name + '!')) + '" target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp">' + ic('wa', 30) + '</a>') +
      cartbar() + (view === 'admin' ? '' : detailModal()) + drawer() + shareModal() + productEditor() + posterModal();
    if (keepScroll) window.scrollTo(0, y);
    if (view === 'admin' && isSeller()) drawQR();
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
    if (v === 'cuenta' && isClient()) loadMyOrders();
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
    var mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function uploadImage(dataUrl) {
    var png = dataUrl.indexOf('data:image/png') === 0;
    var ref = fb.storage.ref('img/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + (png ? '.png' : '.jpg'));
    return ref.put(dataUrlToBlob(dataUrl), { contentType: png ? 'image/png' : 'image/jpeg', cacheControl: 'public,max-age=31536000' })
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
      name: String(p.name || '').trim() || 'Producto', sku: cleanSku(p.sku), desc: String(p.desc || ''), cat: p.cat || (cfg.categories || [''])[0],
      price: Number(p.price) || 0, sug: Number(p.sug) || 0, stock: p.stock || 'ok', featured: !!p.featured,
      img: p.img || '', order: typeof p.order === 'number' ? p.order : 0,
      combo: !!p.combo, offer: Number(p.offer) || 0, offerUntil: p.offer ? String(p.offerUntil || '') : '',
      leadDays: p.stock === 'order' ? (Number(p.leadDays) || 7) : 0
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
    return { id: fb.db.collection('products').doc().id, _new: true, sku: '', name: '', desc: '', cat: catName || (cfg.categories || [''])[0], price: 0, sug: 0, stock: 'ok', featured: false, combo: false, offer: 0, offerUntil: '', img: '' };
  }
  function saveProduct(next) {
    var p = editing; if (!p || busy) return;
    if (!p.img) { setToast('Sacale una foto al producto antes de guardar.'); return; }
    if (!String(p.name || '').trim()) { setToast('Poné un nombre al producto.'); return; }
    p.sku = cleanSku(p.sku);
    if (skuTaken(p.sku, p.id)) { setToast('El SKU ' + p.sku + ' ya lo tiene otro producto.'); return; }
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
    d.brands = (d.brands || []).filter(function (b) { return b && (String(b.name || '').trim() || b.logo); });
    d.commissions = d.commissions || clone(COMM_DEFAULT);
    ['base', 'override', 'overrideMonths', 'clientMonths'].forEach(function (k) { d.commissions[k] = Math.max(0, Number(d.commissions[k]) || 0); });
    var bc = {}; Object.keys(d.commissions.byCat || {}).forEach(function (k) { var v = d.commissions.byCat[k]; if (d.categories.indexOf(k) !== -1 && v !== '' && v !== null && !isNaN(Number(v))) bc[k] = Number(v); });
    d.commissions.byCat = bc;
    d.shipping = d.shipping || { enabled: false, zones: [], note: '' };
    d.shipping.enabled = !!d.shipping.enabled;
    d.shipping.zones = (d.shipping.zones || []).filter(function (z) { return String(z.name || '').trim(); }).map(function (z) { return { name: String(z.name).trim().slice(0, 60), cost: Math.max(0, Number(z.cost) || 0), eta: String(z.eta || '').trim().slice(0, 60) }; });
    d.settings.minOrder = Number(d.settings.minOrder) || 0;
    d.contact.whatsapp = digits(d.contact.whatsapp);
    d.contact.channel = String(d.contact.channel || '').trim();
    if (d.contact.channel && !/^https?:\/\//.test(d.contact.channel)) { setToast('El link del canal tiene que empezar con https://'); return; }
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
    var write = ref ? ref.set(Object.assign({
      code: code,
      name: String(buyer.name || '').slice(0, 80),
      barrio: String(buyer.barrio || '').slice(0, 80),
      phone: digits(buyer.phone).slice(0, 15),
      items: lines.slice(0, 50).map(function (l) { return { id: l.p.id, name: String(l.p.name).slice(0, 120), sku: cleanSku(l.p.sku), q: l.q, price: priceOf(l.p), cat: String(l.p.cat || '').slice(0, 60) }; }),
      total: t.total,
      shipping: shippingCost(),
      grand: t.total + shippingCost(),
      delivery: effMode() === 'envio'
        ? { mode: 'envio', zone: String(buyer.zone || '').slice(0, 60), address: String(buyer.address || '').slice(0, 160), cost: shippingCost(), eta: String((zoneByName(buyer.zone) || {}).eta || '').slice(0, 60) }
        : { mode: 'retiro' },
      status: 'nuevo',
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    }, orderRef() ? { ref: orderRef() } : {}, isClient() && user ? { uid: user.uid } : {})) : Promise.resolve();
    if (ref && isClient() && user && customer && !customer.error && (!customer.barrio || !customer.phone || (effMode() === 'envio' && !customer.address))) {
      var upd = Object.assign({}, customer, { name: customer.name || buyer.name, phone: customer.phone || digits(buyer.phone), barrio: customer.barrio || buyer.barrio, address: customer.address || (effMode() === 'envio' ? buyer.address : ''), zone: customer.zone || (effMode() === 'envio' ? buyer.zone : '') });
      saveCustomerDoc(upd, !customer.createdAt).then(function () { customer = upd; }).catch(function () {});
    }
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
      case 'inc': { var p = prodById(id); if (p && p.stock !== 'out') { if (!cart[id]) bump(id, 'adds'); cart[id] = (cart[id] || 0) + 1; if (lastOrder) { lastOrder = null; try { sessionStorage.removeItem('galpon-last-order'); } catch (er) {} } persistCart(); render(true); } break; }
      case 'dec': cart[id] = Math.max(0, (cart[id] || 0) - 1); if (!cart[id]) delete cart[id]; persistCart(); render(true); break;
      case 'detail': detailId = id; bump(id, 'views'); setHash('producto-' + id); render(true); break;
      case 'close-detail': detailId = null; setHash(view); render(true); break;
      case 'open-cart': detailId = null; cartOpen = true; render(true); break;
      case 'close-cart': cartOpen = false; render(true); break;
      case 'new-order': lastOrder = null; try { sessionStorage.removeItem('galpon-last-order'); } catch (er) {} cartOpen = false; go('catalogo'); break;
      case 'send-order': sendOrder(); break;
      case 'cat': {
        cat = a.getAttribute('data-cat'); render(true);
        var tb = document.querySelector('.toolbar');
        if (tb && !a.classList.contains('chip')) window.scrollTo({ top: tb.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        break;
      }
      case 'cat-all': cat = 'Todo'; query = ''; render(true); break;
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
      case 'logout': loginMsg = ''; loginMode = 'login'; fb.auth.signOut(); if (view === 'admin') go('cuenta'); break;
      case 'save-profile': saveProfile(); break;
      case 'repeat-order': { var ro = (myOrders || []).filter ? myOrders.filter(function (o) { return o.id === id; })[0] : null; if (ro) repeatOrder(ro); break; }
      case 'contact-go': e.preventDefault(); contactType = a.getAttribute('data-type'); contactSent = null; go('contacto'); break;
      case 'ctype': contactType = a.getAttribute('data-type'); render(true); break;
      case 'ct-again': contactSent = null; render(true); break;
      case 'lfilter': leadFilter = a.getAttribute('data-f'); render(true); break;
      case 'brand-add': cfgDraft.brands = (cfgDraft.brands || []).concat([{ name: '', logo: '' }]); render(true); setTimeout(function () { var el = document.getElementById('bn-' + (cfgDraft.brands.length - 1)); if (el) el.focus(); }, 0); break;
      case 'brand-del': {
        var bi = Number(a.getAttribute('data-i'));
        if (a.getAttribute('data-confirm') !== '1') { a.setAttribute('data-confirm', '1'); a.textContent = '¿Quitar? Tocá de nuevo'; break; }
        cfgDraft.brands.splice(bi, 1); render(true); break;
      }
      case 'tab': adminTab = a.getAttribute('data-tab'); if (adminTab === 'equipo' && !team) loadTeam(); if (adminTab === 'negocio' && !cfgDraft) cfgDraft = cfgBase(); if (adminTab === 'productos') loadStats(); render(); break;
      case 'seller-new': sellerForm = { name: '', phone: '', code: '', zone: '', recruitedBy: '', email: '' }; render(true); setTimeout(function () { var el = document.getElementById('sf-name'); if (el) el.focus(); }, 0); break;
      case 'seller-cancel': sellerForm = null; render(true); break;
      case 'seller-save': saveSeller(); break;
      case 'seller-toggle': toggleSeller(a.getAttribute('data-code')); break;
      case 'seller-access': giveAccess(a.getAttribute('data-code')); break;
      case 'payout': liquidate(a.getAttribute('data-code'), a); break;
      case 'poster': openPoster(a.getAttribute('data-code') || '', a.getAttribute('data-type') || 'qr'); break;
      case 'poster-type': if (poster && poster.type !== a.getAttribute('data-type')) { poster.type = a.getAttribute('data-type'); poster.kind = poster.type === 'promo' ? 'story' : 'a4'; buildPoster(); } break;
      case 'close-poster': poster = null; render(true); break;
      case 'poster-dest': if (poster && poster.dest !== a.getAttribute('data-dest')) { poster.dest = a.getAttribute('data-dest'); buildPoster(); } break;
      case 'poster-kind': if (poster && poster.kind !== a.getAttribute('data-kind')) { poster.kind = a.getAttribute('data-kind'); buildPoster(); } break;
      case 'poster-share': sharePoster(); break;
      case 'lead-seller': {
        var ld = (leads || []).filter(function (l) { return l.id === id; })[0]; if (!ld) break;
        sellerForm = { name: ld.name || '', phone: ld.phone || '', code: suggestCode(ld.name), zone: ld.zone || '', recruitedBy: ld.ref && sellersMap[ld.ref] ? ld.ref : '', email: ld.email || '', leadId: ld.id };
        adminTab = 'vendedores'; render(); setTimeout(function () { var el = document.getElementById('new-seller'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
        break;
      }
      case 'copy': {
        var txt = a.getAttribute('data-text');
        var ok = function () { var old = a.textContent; a.textContent = 'Copiado'; setTimeout(function () { a.textContent = old; }, 1600); };
        try { navigator.clipboard.writeText(txt).then(ok, function () { var inp = a.parentNode.querySelector('input'); if (inp) { inp.focus(); inp.select(); } }); }
        catch (er) { var inp2 = a.parentNode.querySelector('input'); if (inp2) { inp2.focus(); inp2.select(); } }
        break;
      }
      case 'zone-add': cfgDraft.shipping.zones = (cfgDraft.shipping.zones || []).concat([{ name: '', cost: 0, eta: '' }]); render(true); setTimeout(function () { var el = document.getElementById('zn-' + (cfgDraft.shipping.zones.length - 1)); if (el) el.focus(); }, 0); break;
      case 'zone-del': cfgDraft.shipping.zones.splice(Number(a.getAttribute('data-i')), 1); render(true); break;
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
  function refreshCfgBar() {
    var sb = document.querySelector('.savebar');
    if (!sb || !cfgDraft) return;
    var changed = JSON.stringify(cfgDraft) !== JSON.stringify(cfgBase());
    sb.querySelector('.savebar-msg').innerHTML = changed ? '<b>Tenés cambios sin publicar.</b>' : 'Todo publicado.';
    sb.querySelectorAll('button').forEach(function (b) { b.disabled = !changed || busy; });
  }
  function setPath(obj, path, value) {
    var parts = path.split('.'), o = obj;
    for (var i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null) o[parts[i]] = {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = value;
  }
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'q') { query = t.value; render(true); return; }
    if ((t.id === 'pz-title' || t.id === 'pz-sub') && poster) { poster[t.id === 'pz-title' ? 'title' : 'subtitle'] = t.value; buildPoster(700); return; }
    if (t.id === 'pq') { pq = t.value; render(true); return; }
    if (t.hasAttribute('data-ct')) { contactForm[contactType + '.' + t.getAttribute('data-ct')] = t.value; return; }
    if (t.hasAttribute('data-brand-name') && cfgDraft) { cfgDraft.brands[Number(t.getAttribute('data-brand-name'))].name = t.value; refreshCfgBar(); return; }
    if (t.id === 'rq') { rq = t.value; render(true); return; }
    if (t.hasAttribute('data-sf') && sellerForm) {
      var sk = t.getAttribute('data-sf');
      sellerForm[sk] = sk === 'code' ? cleanCode(t.value) : t.value;
      if (sk === 'code') { sellerForm._codeTouched = true; if (t.value !== sellerForm.code) t.value = sellerForm.code; }
      if (sk === 'name' && !sellerForm._codeTouched) { sellerForm.code = suggestCode(t.value); var ce = document.getElementById('sf-code'); if (ce) ce.value = sellerForm.code; }
      return;
    }
    if (t.hasAttribute('data-ccat') && cfgDraft) {
      var cc = t.getAttribute('data-ccat'); cfgDraft.commissions.byCat = cfgDraft.commissions.byCat || {};
      if (t.value === '') delete cfgDraft.commissions.byCat[cc]; else cfgDraft.commissions.byCat[cc] = Number(t.value);
      refreshCfgBar(); return;
    }
    if (t.hasAttribute('data-zone') && cfgDraft) {
      var zi = Number(t.getAttribute('data-zone')), zf = t.getAttribute('data-zf');
      cfgDraft.shipping.zones[zi][zf] = zf === 'cost' ? (Number(t.value) || 0) : t.value;
      refreshCfgBar(); return;
    }
    if (t.id === 'l-email') { loginEmail = t.value; return; }
    if (t.id === 'l-pass') { loginPass = t.value; return; }
    if (t.id === 'l-name') { loginName = t.value; return; }
    if (t.id === 'l-phone') { loginPhone = t.value; return; }
    if (t.hasAttribute('data-cf') && custForm) { custForm[t.getAttribute('data-cf')] = t.value; if (t.tagName === 'SELECT') render(true); return; }
    if (t.hasAttribute('data-buyer')) {
      var bk = t.getAttribute('data-buyer');
      buyer[bk] = bk === 'ref' ? cleanCode(t.value) : t.value; persistCart();
      if (bk === 'mode' || bk === 'zone') { render(true); return; }
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
      if (k === 'sku') { var sh = document.getElementById('e-sku-hint'); if (sh) { var tk = skuTaken(cleanSku(editing.sku), editing.id); sh.textContent = tk ? 'Ese SKU ya lo tiene otro producto.' : 'El que usás en el depósito. Aparece en cada pedido.'; sh.classList.toggle('warn', tk); } }
      if (k === 'combo' || k === 'stock') render(true);
      return;
    }
    if (t.hasAttribute('data-c') && cfgDraft) {
      setPath(cfgDraft, t.getAttribute('data-c'), t.type === 'checkbox' ? t.checked : (t.type === 'number' ? (Number(t.value) || 0) : t.value));
      refreshCfgBar();
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type === 'checkbox' || t.tagName === 'SELECT') t.dispatchEvent(new Event('input', { bubbles: true }));
    if (t.id === 'rsort') { rSort = t.value; render(true); return; }
    if (t.hasAttribute('data-pick') && poster) {
      var pid = t.getAttribute('data-pick'), ix = poster.sel.indexOf(pid);
      if (t.checked && ix === -1 && poster.sel.length < 6) poster.sel.push(pid);
      if (!t.checked && ix !== -1) poster.sel.splice(ix, 1);
      buildPoster(150); return;
    }
    if (t.id === 'pz-src' && poster) {
      poster.source = t.value; poster.sel = promoPool(t.value).slice(0, 6).map(function (p) { return p.id; });
      buildPoster(); return;
    }
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
    if (t.hasAttribute('data-lead') && fb) {
      var lid = t.getAttribute('data-lead'), lst = t.value;
      fb.db.collection('leads').doc(lid).update({ status: lst }).then(function () {
        (leads || []).forEach(function (l) { if (l.id === lid) l.status = lst; }); render(true);
      }).catch(function () { setToast('No se pudo cambiar el estado.'); });
      return;
    }
    if (t.hasAttribute('data-order') && fb) {
      var oid = t.getAttribute('data-order');
      var ord = (orders || []).filter(function (o) { return o.id === oid; })[0];
      if (ord) changeStatus(ord, t.value, t);
      return;
    }
    if (t.hasAttribute('data-assign') && fb) {
      var aid = t.getAttribute('data-assign');
      var ao = (orders || []).filter(function (o) { return o.id === aid; })[0];
      if (ao) assignSeller(ao, t.value, t);
      return;
    }
    if (t.type === 'file' && t.files && t.files[0]) {
      var file = t.files[0];
      if (t.hasAttribute('data-edit-img') && editing) {
        var ed = editing; ed._uploading = true; render(true);
        processUpload(file, 1, 900).then(function (u) { ed.img = u; ed._uploading = false; render(true); })
          .catch(function () { ed._uploading = false; setToast('No se pudo leer esa imagen. Probá con JPG o PNG.'); });
      } else if (t.hasAttribute('data-brand-logo') && cfgDraft) {
        var bidx = Number(t.getAttribute('data-brand-logo'));
        setToast('Subiendo logo…');
        readFile(file).then(function (src) { return fitImage(src, 480, 240); }).then(uploadImage).then(function (u) {
          cfgDraft.brands[bidx].logo = u; setToast('Logo listo. Tocá “Guardar y publicar”.');
        }).catch(function () { setToast('No se pudo leer ese logo. Probá con PNG o JPG.'); });
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
    if (e.target && e.target.id === 'contact-form') { e.preventDefault(); submitContact(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (poster) poster = null; else if (editing) editing = null; else if (share) share = null; else if (detailId) { detailId = null; setHash(view); } else if (cartOpen) cartOpen = false; else return;
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
    if (goCanal) { view = 'canal'; cartOpen = false; }
    else if (lastOrder && !cartLines().length) cartOpen = true;
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
      cfg.commissions = Object.assign(clone(COMM_DEFAULT), cfg.commissions || {});
      cfg.shipping = Object.assign({ enabled: false, zones: [], note: '' }, cfg.shipping || {});
      start();
      var rc = cleanCode(buyer.ref || refCode);
      if (rc) fb.db.collection('codes').doc(rc).get().then(function (d) {
        if (d.exists && d.data().active !== false) { refCode = rc; refName = d.data().name || rc; buyer.ref = rc; }
        else { refCode = ''; refName = ''; try { localStorage.removeItem('galpon-ref'); } catch (e) {} }
        render(true); canalRedirect();
      }).catch(function () { canalRedirect(); });
      else canalRedirect();
      fb.auth.getRedirectResult().catch(function (err) { if (err && err.code) { loginMsg = authError(err); render(true); } });
      fb.auth.onAuthStateChanged(function (u) {
        user = u; role = null; authReady = true; customer = null; myOrders = null; custForm = null;
        if (!u) { orders = null; team = null; sellerData = null; sellerCode = null; render(true); return; }
        resolveRole(u);
      });
    });
  }).catch(function () {
    app.innerHTML = '<div class="wrap" style="padding-block:80px;text-align:center">No se pudo cargar el catálogo. Recargá la página.</div>';
  });
  // Una sola puerta de entrada: dueño y equipo (mail verificado) van al panel; el resto, a su cuenta de cliente.
  function resolveRole(u) {
    role = null;
    if (!u.emailVerified) { afterLogin(); return; }
    var em = String(u.email || '').toLowerCase();
    if (OWNERS.indexOf(em) !== -1) { role = 'owner'; afterLogin(); return; }
    fb.db.collection('team').doc(em).get().then(function (d) {
      var r = d.exists ? d.data() : null;
      role = r && (r.role === 'admin' || r.role === 'editor' || (r.role === 'seller' && r.sellerCode)) ? r.role : null;
      sellerCode = role === 'seller' ? r.sellerCode : null;
      afterLogin();
    }).catch(function () { afterLogin(); });
  }
  function afterLogin() {
    if (!role) role = 'client';
    if (isClient()) { loadCustomer(); loadMyOrders(); if (view === 'admin') { view = 'cuenta'; setHash('cuenta'); } }
    else if (view === 'cuenta') { view = 'admin'; setHash('admin'); }
    if (isStaff()) { loadOrders(); loadSellers(); loadClients(); if (adminTab === 'equipo') loadTeam(); if (adminTab === 'productos') loadStats(); }
    if (isAdmin()) { loadLeads(); loadPayouts(); }
    if (isSeller()) loadSellerData();
    render(true);
  }
})();
