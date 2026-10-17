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
    else if (isTop(p) && !onOffer(p)) b.push('<span class="badge-top">Más vendido</span>');
    if (p.stock === 'out') b.push('<span class="stock out">Sin stock</span>');
    else if (p.stock === 'order') b.push('<span class="stock order">Por encargo · ' + (Number(p.leadDays) || 7) + ' días</span>');
    else if (p.stock === 'low') b.push('<span class="stock">' + (tracked(p) && Number(p.qty) > 0 ? 'Quedan ' + Number(p.qty) : 'Últimas unidades') + '</span>');
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
      '<span class="card-cat">' + catLabel(p) + '</span>' +
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
    var topP = counters && counters.top ? counters.top.map(prodById).filter(function (p) { return p && p.stock !== 'out' && !onOffer(p); }) : [];
    var feat = topP.length >= 4 ? topP.slice(0, 4) : products.filter(function (p) { return p.featured && !onOffer(p); }).slice(0, 4);
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
      '</div></section>' + numbersStrip() +

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
      '</div>' + videoBlock() + '</div></section>' + guaranteesSection() +

      brandsSection() + loyaltyLanding() +
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
      '<details><summary>¿Dónde veo todas las reglas?</summary><p>En <a href="#como-trabajamos" data-go="como">Cómo trabajamos</a> están las condiciones para feriantes, vendedores y proveedores, y nuestras garantías.</p></details>' +
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
      '</div>' + itemsHtml(items.slice(0, more && filterKey ? BLOCK_MAX : items.length)) + '</section>';
  }
  // vista rápida: filas compactas para pedir rápido desde el celular
  var catMode = 'grid';
  try { catMode = localStorage.getItem('galpon-catmode') || 'grid'; } catch (e) {}
  function quickRow(p) {
    var out = p.stock === 'out';
    return '<div class="qrow' + (out ? ' is-out' : '') + '"><button type="button" class="qrow-open" data-act="detail" data-id="' + esc(p.id) + '" aria-label="Ver ' + esc(p.name) + '"><img src="' + esc(imgOf(p)) + '" alt="" loading="lazy"></button>' +
      '<div class="qrow-info"><b>' + esc(p.name) + '</b><span class="num">' + priceHtml(p) + ' <em class="g">ganás ' + money(gain(p)) + '</em></span>' + (stockBadge(p) ? '<span class="qrow-badges">' + stockBadge(p) + '</span>' : '') + '</div>' +
      '<div class="qrow-qty">' + qtyControl(p, false) + '</div></div>';
  }
  function itemsHtml(items) { return catMode === 'list' ? '<div class="qlist">' + items.map(quickRow).join('') + '</div>' : '<div class="grid">' + items.map(card).join('') + '</div>'; }
  function catalog() {
    var catsAll = cfg.categories || [];
    var inCat = function (c) { return products.filter(function (p) { return p.cat === c; }); };
    var offers = products.filter(onOffer), combos = products.filter(function (p) { return p.combo; });
    var others = products.filter(function (p) { return catsAll.indexOf(p.cat) === -1; });
    var usedCats = catsAll.filter(function (c) { return inCat(c).length; });
    var chips = ['Todo'].concat(offers.length ? ['Ofertas'] : [], combos.length ? ['Combos'] : [], usedCats, others.length ? ['Otros'] : []);
    if (chips.indexOf(cat) === -1) { cat = 'Todo'; sub = ''; }
    var subsHere = catsAll.indexOf(cat) !== -1 ? subsOf(cat).filter(function (s) { return products.some(function (p) { return p.cat === cat && p.sub === s; }); }) : [];
    if (sub && subsHere.indexOf(sub) === -1) sub = '';
    var q = query.trim().toLowerCase();
    var match = function (p) { return !q || (p.name + ' ' + (p.desc || '') + ' ' + (p.cat || '') + ' ' + (p.sub || '') + ' ' + (p.sku || '')).toLowerCase().indexOf(q) !== -1; };
    var body;
    if (cat === 'Todo' && !q) {
      body = (offers.length ? catBlock('Ofertas', offers, 'Ofertas', 'por tiempo limitado') : '') +
        (combos.length ? catBlock('Combos', combos, 'Combos') : '') +
        usedCats.map(function (c) { var s = subsOf(c).filter(function (x) { return products.some(function (p) { return p.cat === c && p.sub === x; }); }); return catBlock(c, sortBySub(inCat(c), c), c, s.length ? s.slice(0, 4).join(', ') + (s.length > 4 ? '…' : '') : ''); }).join('') +
        (others.length ? catBlock('Otros', others, 'Otros') : '');
      if (!products.length) body = '<div class="empty">Todavía no hay productos cargados.</div>';
    } else {
      var list = products.filter(function (p) {
        var ok = cat === 'Todo' || (cat === 'Ofertas' ? onOffer(p) : cat === 'Combos' ? !!p.combo : cat === 'Otros' ? catsAll.indexOf(p.cat) === -1 : p.cat === cat && (!sub || p.sub === sub));
        return ok && match(p);
      });
      if (catsAll.indexOf(cat) !== -1) list = sortBySub(list, cat);
      var where = cat !== 'Todo' ? cat + (sub ? ' › ' + sub : '') : '';
      var title = q ? 'Resultados para “' + query.trim() + '”' + (where ? ' en ' + where : '') : where;
      body = list.length
        ? '<section class="cat-block"><div class="cat-block-head"><div><h2>' + esc(title) + '</h2><span class="cat-count num">' + list.length + ' producto' + (list.length === 1 ? '' : 's') + '</span></div>' +
          '<button type="button" class="linkbtn" data-act="cat-all">Ver todo el catálogo</button></div>' + itemsHtml(list) + '</section>'
        : '<div class="empty">No encontramos productos' + (q ? ' con esa búsqueda' : ' en esta categoría') + '. <button type="button" class="linkbtn" data-act="cat-all">Ver todo el catálogo</button></div>';
    }
    var lastO = isClient() && Array.isArray(myOrders) && myOrders.filter(function (o) { return o.status !== 'cancelado'; })[0];
    return '<div class="wrap">' +
      '<div class="cat-head"><span class="eyebrow">Precios para revendedores</span><h1 class="h2" style="margin-top:8px">Catálogo</h1>' +
      '<p class="lead" style="margin-top:10px">Tocá un producto para ver el detalle. El precio sugerido es una referencia: vos decidís a cuánto vender.</p>' +
      (cfg.settings.examplePrices ? '<div class="notice">' + ic('info', 20) + '<span>Precios de ejemplo. Los precios reales se confirman al tomar el pedido.</span></div>' : '') +
      installCard('catalogo') + (lastO ? '<div class="reorder">' + ic('repeat', 20) + '<span>¿Lo mismo que la última vez? Pedido #' + esc(lastO.code || '') + ' · ' + (lastO.items || []).length + ' productos</span><button class="btn btn-main btn-sm" type="button" data-act="repeat-last">Repetir pedido</button></div>' : '') +
      '</div>' +
      '<div class="toolbar"><div class="toolbar-row"><label class="search">' + ic('search', 20) + '<input id="q" type="search" placeholder="Buscar por nombre, rubro o código" value="' + esc(query) + '" aria-label="Buscar productos"></label>' +
      '<div class="view-toggle" role="group" aria-label="Vista"><button type="button" class="' + (catMode !== 'list' ? 'on' : '') + '" data-act="catmode" data-mode="grid" aria-pressed="' + (catMode !== 'list') + '">Fotos</button><button type="button" class="' + (catMode === 'list' ? 'on' : '') + '" data-act="catmode" data-mode="list" aria-pressed="' + (catMode === 'list') + '">Lista</button></div></div>' +
      '<div class="chips">' + chips.map(function (c) {
        return '<button type="button" class="chip' + (c === cat ? ' on' : '') + '" data-act="cat" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div>' +
      (subsHere.length ? '<div class="chips subchips">' + [''].concat(subsHere).map(function (s) {
        return '<button type="button" class="chip sm' + (s === sub ? ' on' : '') + '" data-act="sub" data-sub="' + esc(s) + '">' + esc(s || 'Todo ' + cat) + '</button>';
      }).join('') + '</div>' : '') + '</div>' +
      '<div class="cat-body">' + body + '</div>' +
      '</div>';
  }

