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
      installCard('vendedor') + (d.me.active === false ? '<div class="admin-note">' + ic('info', 20) + '<span>Tu cuenta está pausada: por ahora tus clientes no generan comisión. Hablá con el equipo.</span></div>' : '') +
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
      '<button class="btn btn-line btn-sm" type="button" data-act="catpdf" data-code="' + esc(sellerCode) + '">Catálogo en PDF con tu QR</button>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="labels">Etiquetas de precio para los puestos</button>' +
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
          '<div class="sactions"><button class="btn btn-main btn-sm" type="button" data-act="seller-order" data-ph="' + esc(digits(c.phone) || c.name) + '">' + ic('bag', 18) + 'Armarle un pedido</button>' +
          (c.phone ? '<a class="btn btn-line btn-sm" href="' + esc(waTo(c.phone, 'Hola ' + String(c.name).split(' ')[0] + '! ¿Cómo va el puesto? Ya está el catálogo actualizado: ' + link)) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'Escribirle</a>' : '') + '</div>' +
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

