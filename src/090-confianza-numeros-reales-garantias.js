  /* ================= confianza: números reales, garantías, niveles, etiquetas ================= */
  var TRUST_DEFAULT = { showNumbers: true, minShow: 10, baseOrders: 0, baseClients: 0, video: '',
    guarantees: [
      { t: 'Cambios dentro de 7 días', d: 'Si algo no te sirve, lo cambiás dentro de los 7 días con la mercadería sin uso y tu número de pedido.' },
      { t: 'Si llega roto o falta algo, lo reponemos', d: 'Avisanos dentro de las 48 horas con una foto y te lo reponemos en tu próximo pedido o te devolvemos la plata.' },
      { t: 'Precio cerrado', d: 'El precio que ves al pedir es el que pagás. Sin sorpresas al retirar ni costos escondidos.' },
      { t: 'Pagás seguro', d: 'Pagás al retirar, por transferencia o con Mercado Pago desde la web. Nunca te pedimos plata por fuera de los canales oficiales.' },
      { t: 'Tus datos son tuyos', d: 'Usamos tu WhatsApp solo para tus pedidos y ofertas. Si querés dejar de recibirlas, nos avisás y listo.' }
    ] };
  var TIERS_DEFAULT = { enabled: false, days: 90, levels: [
    { name: 'Bronce', min: 0, shipOff: 0, ptsMult: 1, perk: 'Sumás puntos en cada compra' },
    { name: 'Plata', min: 150000, shipOff: 50, ptsMult: 1.25, perk: 'Te avisamos primero de las ofertas' },
    { name: 'Oro', min: 400000, shipOff: 100, ptsMult: 1.5, perk: 'Prioridad en el armado y ofertas exclusivas' }] };
  var counters = null, labels = null;
  function trust() { return (cfg && cfg.trust) || TRUST_DEFAULT; }
  function tiers() { return (cfg && cfg.tiers) || TIERS_DEFAULT; }
  function levelsSorted() { return (tiers().levels || []).slice().sort(function (a, b) { return Number(a.min) - Number(b.min); }); }
  function tierFor(amount) { var cur = null; levelsSorted().forEach(function (l) { if ((Number(amount) || 0) >= Number(l.min)) cur = l; }); return cur || levelsSorted()[0] || null; }
  function nextTier(amount) { var L = levelsSorted(); for (var i = 0; i < L.length; i++) if (Number(L[i].min) > (Number(amount) || 0)) return L[i]; return null; }
  function levelByName(n) { return levelsSorted().filter(function (l) { return l.name === n; })[0] || null; }
  function tierClass(name) { var i = levelsSorted().map(function (l) { return l.name; }).indexOf(name); return 'tier-' + Math.max(0, i); }
  // beneficio de envío del cliente con cuenta
  function myLevel() { if (!tiers().enabled || !isClient() || !customer || !customer.tier) return null; return levelByName(customer.tier.level); }
  function shipOffPct() { var l = myLevel(); return l ? Math.min(100, Math.max(0, Number(l.shipOff) || 0)) : 0; }
  function loadCounters() {
    if (!fb) return;
    fb.db.collection('site').doc('counters').get().then(function (d) { counters = d.exists ? d.data() : false; render(true); }).catch(function () { counters = false; });
  }
  // El equipo recalcula los números públicos cada vez que carga los pedidos.
  function computeCounters() {
    if (!orders || !isStaff() || server.admin) return; // con el servidor activo, los números se actualizan solos en cada entrega
    var valid = orders.filter(function (o) { return o.status !== 'cancelado'; });
    var phones = {}, places = {}, since = null, top = {}, cut = Date.now() - 14 * DAY;
    valid.forEach(function (o) {
      var ph = digits(o.phone); if (ph) phones[ph] = 1;
      var b = String(o.barrio || '').trim().toLowerCase(); if (b) places[b] = 1;
      var d = oDate(o); if (d && (!since || d < since)) since = d;
      if (d && d.getTime() >= cut) (o.items || []).forEach(function (i) { top[i.id] = (top[i.id] || 0) + (Number(i.q) || 0); });
    });
    var next = { delivered: orders.filter(function (o) { return o.status === 'entregado'; }).length, clients: Object.keys(phones).length, places: Object.keys(places).length,
      since: since ? monthKey(since.getTime()) : '', top: Object.keys(top).filter(prodById).sort(function (a, b) { return top[b] - top[a]; }).slice(0, 8) };
    var prev = counters || {};
    if (prev.delivered === next.delivered && prev.clients === next.clients && prev.places === next.places && JSON.stringify(prev.top || []) === JSON.stringify(next.top)) return;
    next.at = Date.now();
    fb.db.collection('site').doc('counters').set(next, { merge: true }).then(function () { counters = Object.assign({}, counters || {}, next); }).catch(function () {});
  }
  function isTop(p) { return !!(counters && counters.top && counters.top.slice(0, 6).indexOf(p.id) !== -1); }
  function trustNumbers() {
    var T = trust(); if (!T.showNumbers || !counters) return null;
    var del = (counters.delivered || 0) + (Number(T.baseOrders) || 0), cli = (counters.clients || 0) + (Number(T.baseClients) || 0);
    if (del < (Number(T.minShow) || 0)) return null;
    return { del: del, cli: cli, places: counters.places || 0, since: counters.since };
  }
  function roundNice(n) { return n >= 1000 ? Math.floor(n / 100) * 100 : n >= 100 ? Math.floor(n / 10) * 10 : n; }
  function numbersStrip() {
    var n = trustNumbers(); if (!n) return '';
    var items = [['+' + roundNice(n.del).toLocaleString('es-AR'), 'pedidos entregados'], [roundNice(n.cli).toLocaleString('es-AR'), 'feriantes y revendedores'], [n.places ? n.places.toLocaleString('es-AR') : '', 'barrios y ferias']].filter(function (x) { return x[0]; });
    return '<div class="nums-strip"><div class="wrap nums-in">' + items.map(function (x) { return '<div><b class="num">' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('') +
      (n.since ? '<small>Números reales de la web, desde ' + esc(monthName(n.since)) + '</small>' : '') + '</div></div>';
  }
  function guaranteesHtml() {
    var G = (trust().guarantees || []).filter(function (g) { return g && g.t; });
    var icons = ['repeat', 'shield', 'cash', 'check', 'users'];
    return '<div class="guar-grid">' + G.map(function (g, i) { return '<div class="guar"><span class="guar-ico">' + ic(icons[i % icons.length], 24) + '</span><b>' + esc(g.t) + '</b><p>' + esc(g.d) + '</p></div>'; }).join('') + '</div>';
  }
  function guaranteesSection() {
    if (!(trust().guarantees || []).length) return '';
    return '<section class="guar-sec"><div class="wrap"><div class="sec-row"><div class="sec-head" style="margin:0"><span class="eyebrow">Compra sin riesgo</span><h2 class="h2">Nuestras garantías</h2></div>' +
      '<a class="btn btn-line btn-sm" href="#como-trabajamos" data-go="como">Cómo trabajamos</a></div>' + guaranteesHtml() + '</div></section>';
  }
  function ytId(u) { var m = String(u || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/); return m ? m[1] : ''; }
  function videoBlock() {
    var v = trust().video; if (!v) return '';
    var id = ytId(v);
    if (id) return '<div class="video-card" data-yt="' + esc(id) + '"><button type="button" class="video-play" data-act="play-yt" aria-label="Ver el video del depósito"><img src="https://i.ytimg.com/vi/' + esc(id) + '/hqdefault.jpg" alt="" loading="lazy"><span class="play">▶</span><span class="video-cap">Mirá cómo armamos tu pedido</span></button></div>';
    return '<a class="btn btn-line btn-sm" href="' + esc(v) + '" target="_blank" rel="noopener">Ver el video del depósito</a>';
  }
  function tiersTable(highlight) {
    var L = levelsSorted();
    return '<div class="tiers">' + L.map(function (l) {
      var perks = [];
      if (Number(l.shipOff) >= 100) perks.push('Envío sin cargo'); else if (Number(l.shipOff) > 0) perks.push(l.shipOff + '% off en el envío');
      if (Number(l.ptsMult) > 1 && loyal().enabled) perks.push('Puntos ×' + String(l.ptsMult).replace('.', ','));
      if (l.perk) perks.push(l.perk);
      return '<div class="tier ' + tierClass(l.name) + (highlight === l.name ? ' on' : '') + '"><b>' + esc(l.name) + '</b><small class="num">' + (Number(l.min) ? 'Desde ' + money(l.min) : 'Desde tu primera compra') + '</small>' +
        '<ul>' + perks.map(function (x) { return '<li>' + ic('check', 14) + esc(x) + '</li>'; }).join('') + '</ul>' + (highlight === l.name ? '<em>Tu nivel</em>' : '') + '</div>';
    }).join('') + '</div><p class="hint">El nivel se calcula con lo que compraste en los últimos ' + (tiers().days || 90) + ' días (pedidos entregados).</p>';
  }
  function myTierPanel() {
    if (!tiers().enabled || !customer || customer.error) return '';
    var t = customer.tier || { amount: 0, level: (levelsSorted()[0] || {}).name };
    var nx = nextTier(t.amount);
    var pct = nx ? Math.min(100, Math.round((Number(t.amount) || 0) / Number(nx.min) * 100)) : 100;
    return '<div class="panel tier-card ' + tierClass(t.level) + '"><h2>Mi nivel</h2><div class="tier-badge">' + ic('shield', 22) + '<b>' + esc(t.level || '') + '</b></div>' +
      '<p class="num">Compraste ' + money(t.amount) + ' en los últimos ' + (tiers().days || 90) + ' días.</p>' +
      (nx ? '<div class="pbar"><span style="width:' + pct + '%"></span></div><p class="hint">Te faltan <b class="num">' + money(Number(nx.min) - (Number(t.amount) || 0)) + '</b> para ser <b>' + esc(nx.name) + '</b>.</p>' : '<p class="hint">Estás en el nivel más alto. ¡Gracias por elegirnos!</p>') +
      '<details><summary>Ver niveles y beneficios</summary>' + tiersTable(t.level) + '</details></div>';
  }
  // ---- niveles: cálculo (equipo)
  function amountDays(ph) {
    var cut = Date.now() - (Number(tiers().days) || 90) * DAY, sum = 0;
    (orders || []).forEach(function (o) { if (o.status === 'entregado' && digits(o.phone) === ph && (Number(o.deliveredAt) || (oDate(o) || { getTime: function () { return 0; } }).getTime()) >= cut) sum += Number(o.total) || 0; });
    return sum;
  }
  function applyTier(ph, uid) {
    if (!tiers().enabled || !ph) return Promise.resolve(null);
    var amt = amountDays(ph), lv = tierFor(amt), t = { amount: amt, level: lv ? lv.name : '', at: Date.now() };
    var cur = (clientsMap || {})[ph] || {};
    if (cur.tier && cur.tier.level === t.level && cur.tier.amount === t.amount) return Promise.resolve(null);
    return fb.db.collection('clients').doc(ph).set({ tier: t }, { merge: true }).then(function () {
      clientsMap = clientsMap || {}; clientsMap[ph] = Object.assign({}, cur, { tier: t });
      var q = uid ? Promise.resolve([uid]) : fb.db.collection('customers').where('phone', '==', ph).limit(3).get().then(function (s) { return s.docs.map(function (d) { return d.id; }); });
      return q.then(function (ids) { return Promise.all(ids.map(function (id) { return fb.db.collection('customers').doc(id).set({ tier: t }, { merge: true }); })); });
    }).then(function () { return cur.tier && cur.tier.level !== t.level ? t.level : null; }).catch(function () { return null; });
  }
  function recalcTiers(btn) {
    if (!orders) return;
    var phones = {}; orders.forEach(function (o) { var ph = digits(o.phone); if (ph) phones[ph] = o.uid || phones[ph] || ''; });
    Object.keys(clientsMap || {}).forEach(function (ph) { if (phones[ph] === undefined) phones[ph] = ''; });
    btn.disabled = true; btn.textContent = 'Recalculando…';
    var keys = Object.keys(phones), ups = 0;
    keys.reduce(function (pr, ph) { return pr.then(function () { return applyTier(ph, phones[ph] || null).then(function (ch) { if (ch) ups++; }); }); }, Promise.resolve())
      .then(function () { render(true); showToast('Niveles recalculados: ' + keys.length + ' clientes' + (ups ? ', ' + ups + ' cambiaron de nivel.' : '.')); });
  }
  // ---- etiquetas de precio para el puesto
  function openLabels() {
    var mine = [];
    if (isClient() && Array.isArray(myOrders)) myOrders.forEach(function (o) { (o.items || []).forEach(function (i) { if (prodById(i.id) && mine.indexOf(i.id) === -1) mine.push(i.id); }); });
    labels = { sel: mine.length ? mine.slice(0, 24) : products.filter(function (p) { return p.featured; }).slice(0, 8).map(function (p) { return p.id; }), q: '', size: 'chica', copies: 1, price: 'sug' };
    render(true);
  }
  function labelsModal() {
    if (!labels) return '';
    var L = labels, q = L.q.trim().toLowerCase();
    var list = products.filter(function (p) { return !q || (p.name + ' ' + p.cat + ' ' + (p.sku || '')).toLowerCase().indexOf(q) !== -1; }).slice(0, 80);
    return '<div class="modal-wrap" data-act="close-labels" style="z-index:60"><div class="modal" role="dialog" aria-modal="true" aria-label="Etiquetas de precio" data-stop="1" style="width:min(640px,100%)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">Etiquetas de precio para tu puesto</h2><button class="x" type="button" data-act="close-labels" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<p class="hint">Imprimilas en A4, recortalas y ponelas en cada producto. Llevan el precio de venta sugerido.</p>' +
      '<div class="ptabs">' + [['chica', 'Chicas (24 por hoja)'], ['grande', 'Grandes (8 por hoja)']].map(function (k) { return '<button type="button" class="chip' + (L.size === k[0] ? ' on' : '') + '" data-act="lab-size" data-size="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>' +
      '<div class="form-grid"><div class="fld"><label for="lab-copies">Copias de cada una</label><input id="lab-copies" type="number" min="1" max="24" inputmode="numeric" value="' + L.copies + '"></div>' +
      '<label class="search" style="align-self:end">' + ic('search', 20) + '<input id="lab-q" type="search" placeholder="Buscar producto" value="' + esc(L.q) + '"></label></div>' +
      '<div class="pick"><div class="pick-head"><b>Productos</b><span class="num">' + L.sel.length + ' elegidos</span></div><div class="pick-list">' + list.map(function (p) {
        var on = L.sel.indexOf(p.id) !== -1;
        return '<label class="pick-item' + (on ? ' on' : '') + '"><input type="checkbox" data-lab="' + esc(p.id) + '"' + (on ? ' checked' : '') + '><img src="' + esc(imgOf(p)) + '" alt=""><span><b>' + esc(p.name) + '</b><small class="num">Se vende a ' + money(p.sug || priceOf(p)) + '</small></span></label>';
      }).join('') + '</div></div>' +
      '<div class="ctas"><button class="btn btn-main btn-sm" type="button" data-act="lab-print"' + (L.sel.length ? '' : ' disabled') + '>Imprimir ' + (L.sel.length * L.copies) + ' etiquetas</button></div></div></div>';
  }
  function printLabels() {
    var L = labels; if (!L || !L.sel.length) return;
    var big = L.size === 'grande', items = [];
    L.sel.forEach(function (id) { var p = prodById(id); if (p) for (var i = 0; i < L.copies; i++) items.push(p); });
    var css = '<style>.sheet{display:grid;grid-template-columns:repeat(' + (big ? 2 : 3) + ',1fr);gap:0}.lab{border:1px dashed #C9CFE6;height:' + (big ? '68mm' : '34mm') + ';padding:' + (big ? '6mm' : '3mm') + ';display:flex;flex-direction:column;justify-content:space-between;break-inside:avoid;overflow:hidden}' +
      '.lab .n{font-weight:700;font-size:' + (big ? '15pt' : '9pt') + ';line-height:1.15;max-height:2.4em;overflow:hidden}.lab .p{font-weight:800;font-size:' + (big ? '44pt' : '22pt') + ';line-height:1;color:#1E2A5A;letter-spacing:-.02em}' +
      '.lab .f{display:flex;justify-content:space-between;align-items:center;font-size:' + (big ? '9pt' : '6.5pt') + ';color:#6B7299}.lab .f b{background:#FF6B1A;color:#1E2A5A;border-radius:4px;padding:1px 5px}@page{size:A4;margin:8mm}</style>';
    var html = css + '<div class="sheet">' + items.map(function (p) {
      return '<div class="lab"><div class="n">' + esc(p.name) + '</div><div class="p">' + money(p.sug || priceOf(p)) + '</div><div class="f"><span>' + esc(p.sku || p.cat || '') + '</span><b>' + esc(cfg.brand.name) + '</b></div></div>';
    }).join('') + '</div>';
    printDoc('Etiquetas de precio', html);
  }
  // ---- página "Cómo trabajamos"
  function comoView() {
    var c = cfg.contact, P = payCfg(), Lo = loyal(), T = tiers();
    var block = function (eyebrow, title, inner, id) { return '<section class="como-sec"' + (id ? ' id="' + id + '"' : '') + '><div class="wrap"><div class="sec-head"><span class="eyebrow">' + eyebrow + '</span><h2 class="h2">' + title + '</h2></div>' + inner + '</div></section>'; };
    var li = function (arr) { return '<ul class="rules">' + arr.filter(Boolean).map(function (x) { return '<li>' + ic('check', 18) + '<span>' + x + '</span></li>'; }).join('') + '</ul>'; };
    var n = trustNumbers();
    return '<section class="como-hero"><div class="wrap"><span class="eyebrow">Reglas claras</span><h1>Cómo trabajamos</h1>' +
      '<p class="lead">Somos un depósito de bazar, blanquería y hogar que trabaja con feriantes y revendedores de todo Buenos Aires. Funciona si ganamos todos: el feriante compra barato y vende con margen, el vendedor cobra por cada cliente que suma, y nosotros crecemos con ustedes.</p>' +
      (n ? '<p class="num como-n">+' + roundNice(n.del) + ' pedidos entregados · ' + roundNice(n.cli) + ' feriantes y revendedores</p>' : '') + '</div></section>' +
      '<section class="como-sec"><div class="wrap"><div class="win-grid">' +
      '<div class="win"><span class="win-ico">' + ic('bag', 26) + '</span><h3>Gana el feriante</h3><p>Precio de depósito, ganancia visible en cada producto antes de comprar' + (Lo.enabled ? ', puntos y premios' : '') + (T.enabled ? ' y beneficios que crecen con tu nivel' : '') + '.</p></div>' +
      '<div class="win"><span class="win-ico">' + ic('users', 26) + '</span><h3>Gana el vendedor</h3><p>Cobra ' + comm().base + '% de lo que compran sus clientes, con panel propio y liquidaciones ' + esc(comm().payEvery || '') + '.</p></div>' +
      '<div class="win"><span class="win-ico">' + ic('truck', 26) + '</span><h3>Gana el proveedor</h3><p>Llega a una red de puestos en todo Buenos Aires con un solo cliente que compra, retira y paga.</p></div>' +
      '</div></div></section>' +
      block('Para feriantes y revendedores', 'Cómo comprás',
        li([
          'Sumarte es gratis: sin inscripción, cuota ni kit obligatorio.',
          'Pedís desde el catálogo o por WhatsApp. ' + (Number(cfg.settings.minOrder) ? 'Pedido mínimo: <b class="num">' + money(cfg.settings.minOrder) + '</b>.' : ''),
          'En cada producto ves tu precio, el precio sugerido de venta y cuánto ganás.',
          'Te confirmamos stock y el día de entrega por WhatsApp.',
          shipOn() ? 'Retirás en el depósito sin costo o te lo enviamos: ' + cfg.shipping.zones.map(function (z) { return esc(z.name) + ' ' + money(z.cost); }).join(' · ') + '.' : 'Retirás en el depósito' + (c.address ? ' (' + esc(c.address) + ')' : '') + '.',
          'Formas de pago: ' + esc(String(c.payments || 'transferencia, Mercado Pago o efectivo al retirar').replace(/\.?\s*$/, '.')) + (P.enabled ? (P.mode === 'sena' ? ' También podés pagar una seña del ' + P.pct + '% online con Mercado Pago.' : ' También podés pagar online con Mercado Pago.') : ''),
          'Productos "por encargo": los publicamos para medir el interés y te avisamos cuándo llegan.'
        ]) + '<div class="ctas" style="margin-top:16px"><a class="btn btn-main" href="#catalogo" data-go="catalogo">Ver el catálogo</a><a class="btn btn-line" href="#cuenta" data-go="cuenta">Crear mi cuenta</a></div>') +
      block('Compra sin riesgo', 'Nuestras garantías', guaranteesHtml(), 'garantias') +
      ((Lo.enabled || T.enabled) ? block('Beneficios', 'Cuanto más comprás, más ganás',
        (T.enabled ? tiersTable(null) : '') + (Lo.enabled ? '<h3 class="sub-h">Puntos' + (Lo.raffle && Lo.raffle.enabled ? ' y sorteo' : '') + '</h3>' + basesModalHtml() + rewardsList() : '')) : '') +
      block('Para vendedores', 'Cómo cobra un vendedor', rulesHtml() + li(['Tus clientes quedan a tu nombre con tu link, tu QR o tu código.', 'Tenés panel propio con tus ventas, tus clientes, tus comisiones y cada liquidación.', 'Te damos promos, catálogo en PDF y carteles con tu QR, listos para mandar.']) +
        '<div class="ctas" style="margin-top:16px"><a class="btn btn-main" href="#vender" data-act="contact-go" data-type="vendedor">Quiero ser vendedor</a></div>') +
      block('Para empresas', 'Si querés vendernos', li(['Compramos bazar, blanquería, cocina, hogar y tecno económica.', 'Pagamos en tiempo y forma, y te contamos qué se vende y qué no.', 'Podemos probar tu producto "por encargo" antes de comprar volumen.']) +
        '<div class="ctas" style="margin-top:16px"><a class="btn btn-dark" href="#proveedores" data-act="contact-go" data-type="proveedor">Ofrecer mis productos</a></div>') +
      block('Dónde estamos', 'Datos del negocio', '<div class="biz-card">' +
        (c.address ? '<p>' + ic('pin', 20) + '<span><b>' + esc(c.address) + '</b>' + (c.area ? ', ' + esc(c.area) : '') + '</span></p>' : '') +
        (c.hours ? '<p>' + ic('clock', 20) + '<span>' + esc(c.hours) + '</span></p>' : '') +
        (ourWa() ? '<p>' + ic('wa', 20) + '<span>WhatsApp <b class="num">' + esc(ourWa()) + '</b></span></p>' : '') +
        (c.instagram ? '<p>' + ic('camera', 20) + '<span>Instagram @' + esc(String(c.instagram).replace('@', '')) + '</span></p>' : '') +
        (c.email ? '<p>' + ic('info', 20) + '<span>' + esc(c.email) + '</span></p>' : '') + '</div>');
  }
  // ---- panel: ajustes de confianza y niveles
  function trustAdmin() {
    var T = cfgDraft.trust = cfgDraft.trust || clone(TRUST_DEFAULT); T.guarantees = T.guarantees || [];
    var n = trustNumbers();
    return '<div class="panel"><h2>Confianza: números, video y garantías</h2>' +
      '<label class="check"><input type="checkbox" data-c="trust.showNumbers"' + (T.showNumbers ? ' checked' : '') + '>Mostrar en la página los pedidos entregados y la cantidad de feriantes</label>' +
      '<p class="hint num">Hoy: ' + (counters ? (counters.delivered || 0) + ' pedidos entregados y ' + (counters.clients || 0) + ' clientes en la web' : 'se calcula al abrir la pestaña Pedidos') + '. ' + (n ? 'Se está mostrando.' : 'Todavía no se muestra (no llega al mínimo).') + '</p>' +
      '<div class="form-grid">' + f('Mostrar desde (pedidos entregados)', 'trust.minShow', { type: 'number', help: 'Para no mostrar números chicos al principio.' }) +
      f('Pedidos reales anteriores a la web', 'trust.baseOrders', { type: 'number', help: 'Solo si son reales (ventas por WhatsApp o ferias antes del sitio).' }) +
      f('Clientes reales anteriores a la web', 'trust.baseClients', { type: 'number' }) +
      f('Video del depósito (link de YouTube)', 'trust.video', { ph: 'https://youtube.com/shorts/…', help: 'Un video corto armando un pedido real genera mucha confianza.' }) + '</div>' +
      '<h3 class="sub-h">Garantías</h3><p class="hint">Se muestran en la página de inicio y en “Cómo trabajamos”. Prometé solo lo que vas a cumplir siempre.</p>' +
      '<div class="glist">' + T.guarantees.map(function (g, i) {
        return '<div class="grow"><div class="fld"><label for="g-t-' + i + '">Título</label><input id="g-t-' + i + '" data-g="' + i + '" data-gf="t" value="' + esc(g.t) + '"></div>' +
          '<div class="fld"><label for="g-d-' + i + '">Detalle</label><textarea id="g-d-' + i + '" data-g="' + i + '" data-gf="d">' + esc(g.d) + '</textarea></div><button class="linkbtn" type="button" data-act="g-del" data-i="' + i + '">Quitar</button></div>';
      }).join('') + '</div><button class="btn btn-line btn-sm" type="button" data-act="g-add" style="align-self:flex-start">' + ic('plus', 18) + 'Agregar garantía</button></div>';
  }
  function tiersAdmin() {
    var T = cfgDraft.tiers = cfgDraft.tiers || clone(TIERS_DEFAULT); T.levels = T.levels || [];
    return '<div class="panel"><h2>Niveles de cliente</h2><p>Cada feriante sube de nivel según lo que compró en los últimos días. Los beneficios de envío se aplican solos en el carrito cuando el cliente entra con su cuenta.</p>' +
      '<label class="check"><input type="checkbox" data-c="tiers.enabled"' + (T.enabled ? ' checked' : '') + '>Niveles activos</label>' +
      '<div class="form-grid">' + f('Días que se cuentan', 'tiers.days', { type: 'number' }) + '</div>' +
      '<div class="zlist">' + T.levels.map(function (l, i) {
        return '<div class="zrow tier-row"><div class="fld"><label for="tl-n-' + i + '">Nivel</label><input id="tl-n-' + i + '" data-tl="' + i + '" data-tf="name" value="' + esc(l.name) + '"></div>' +
          '<div class="fld"><label for="tl-m-' + i + '">Compra desde ($)</label><input id="tl-m-' + i + '" type="number" min="0" data-tl="' + i + '" data-tf="min" value="' + esc(l.min) + '"></div>' +
          '<div class="fld"><label for="tl-s-' + i + '">% off envío</label><input id="tl-s-' + i + '" type="number" min="0" max="100" data-tl="' + i + '" data-tf="shipOff" value="' + esc(l.shipOff) + '"></div>' +
          '<div class="fld"><label for="tl-p-' + i + '">Puntos ×</label><input id="tl-p-' + i + '" type="number" min="1" step="0.25" data-tl="' + i + '" data-tf="ptsMult" value="' + esc(l.ptsMult) + '"></div>' +
          '<div class="fld" style="flex:2"><label for="tl-k-' + i + '">Otro beneficio</label><input id="tl-k-' + i + '" data-tl="' + i + '" data-tf="perk" value="' + esc(l.perk || '') + '"></div>' +
          (T.levels.length > 1 ? '<button class="linkbtn" type="button" data-act="tl-del" data-i="' + i + '">Quitar</button>' : '') + '</div>';
      }).join('') + '</div><button class="btn btn-line btn-sm" type="button" data-act="tl-add" style="align-self:flex-start">' + ic('plus', 18) + 'Agregar nivel</button></div>';
  }
