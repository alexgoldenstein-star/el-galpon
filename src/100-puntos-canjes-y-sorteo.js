  /* ================= puntos, canjes y sorteo ================= */
  var lastDraw = null, drawRes = null, redeemFor = null, freeForm = { name: '', phone: '' };
  function loadLastDraw() {
    if (!fb) return;
    fb.db.collection('draws').orderBy('at', 'desc').limit(1).get().then(function (s) { lastDraw = s.empty ? false : s.docs[0].data(); render(true); }).catch(function () { lastDraw = false; });
  }
  function clientChances(c, mk) {
    mk = mk || monthKey(); if (!c) return 0;
    return chancesFor(c.month && c.month.key === mk ? c.month.amount : 0) + (c.free && c.free.key === mk ? Number(c.free.n) || 0 : 0);
  }
  function nextReward(pts) {
    var rw = (loyal().rewards || []).slice().sort(function (a, b) { return a.pts - b.pts; });
    for (var i = 0; i < rw.length; i++) if (Number(rw[i].pts) > pts) return rw[i];
    return null;
  }
  function rewardsList(pts) {
    return '<ul class="rewards">' + (loyal().rewards || []).slice().sort(function (a, b) { return a.pts - b.pts; }).map(function (r) {
      var ok = pts !== undefined && pts >= Number(r.pts);
      return '<li class="' + (ok ? 'ok' : '') + '"><b class="num">' + Number(r.pts).toLocaleString('es-AR') + ' pts</b><span>' + esc(r.label) + '</span>' + (ok ? '<em>Ya podés canjear</em>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function loyaltyRulesText() {
    var L = loyal(), r = L.raffle || {};
    var t = ['Sumás 1 punto cada ' + money(L.per) + ' en productos (el envío no suma). Los puntos se acreditan cuando el pedido se entrega.',
      'Los puntos se canjean por los premios de la tabla: pedilo por WhatsApp y lo aplicamos en tu próximo pedido.'];
    if (r.enabled) t.push('Sorteo mensual de ' + r.prize + ': cada ' + money(r.every) + ' comprados en el mes es una chance. También podés participar sin comprar: pedí tu chance gratis por WhatsApp (una por persona por mes). El ganador se sortea en los primeros días del mes siguiente y se publica en la web con su nombre y barrio.');
    return t;
  }
  function basesModalHtml() {
    return '<ul class="rules">' + loyaltyRulesText().map(function (x) { return '<li>' + ic('check', 18) + '<span>' + esc(x) + '</span></li>'; }).join('') + '</ul>';
  }
  function loyaltyLanding() {
    var L = loyal(), T = tiers(); if (!L.enabled && !T.enabled) return '';
    if (L.enabled && lastDraw === null) { lastDraw = false; loadLastDraw(); }
    var r = L.raffle || {};
    var lead = [];
    if (T.enabled) lead.push('Tu nivel sube con lo que comprás: ' + levelsSorted().map(function (l) { return esc(l.name); }).join(', ') + '. Cada nivel tiene mejores beneficios.');
    if (L.enabled) lead.push('Sumá 1 punto cada ' + money(L.per) + ' y canjealos por descuentos.' + (r.enabled ? ' Cada ' + money(r.every) + ' que comprás en el mes es una chance en el sorteo de <b>' + esc(r.prize) + '</b>.' : ''));
    return '<section class="loyal-band"><div class="wrap"><div class="loyal-grid"><div><span class="eyebrow">Programa de beneficios</span><h2 class="h2">Cuanto más comprás, más ganás</h2>' +
      '<p class="lead">' + lead.join(' ') + '</p>' +
      '<div class="ctas"><a class="btn btn-main" href="#cuenta" data-go="cuenta">' + (user ? 'Ver mis beneficios' : 'Crear mi cuenta y sumar') + '</a>' + (L.enabled ? '<button class="btn btn-line" type="button" data-act="bases">Bases y condiciones</button>' : '') + '</div></div>' +
      '<div class="loyal-side">' + (L.enabled ? rewardsList() : '') + (lastDraw ? '<div class="winner">' + ic('check', 20) + '<span>Ganador/a de ' + esc(monthName(lastDraw.month)) + ': <b>' + esc(lastDraw.name) + '</b>' + (lastDraw.barrio ? ' de ' + esc(lastDraw.barrio) : '') + '</span></div>' : '') + '</div></div>' +
      (T.enabled ? '<div class="loyal-tiers">' + tiersTable(null) + '</div>' : '') +
      '</div></section>';
  }
  function myPointsPanel() {
    var L = loyal(); if (!L.enabled || !customer || customer.error) return '';
    var pts = Number(customer.points) || 0, nx = nextReward(pts), mk = monthKey();
    var mAmt = customer.month && customer.month.key === mk ? Number(customer.month.amount) || 0 : 0;
    var ch = chancesFor(mAmt), r = L.raffle || {};
    var pct = nx ? Math.min(100, Math.round(pts / Number(nx.pts) * 100)) : 100;
    return '<div class="panel points-card"><h2>Mis puntos</h2><div class="pts-big num">' + pts.toLocaleString('es-AR') + '<small>puntos</small></div>' +
      (nx ? '<div class="pbar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></div><p class="hint">Te faltan <b>' + (Number(nx.pts) - pts) + ' puntos</b> para ' + esc(nx.label) + '.</p>' : '<p class="hint">Ya llegaste al premio más alto: pedí tu canje por WhatsApp.</p>') +
      (r.enabled ? '<div class="chances"><b class="num">' + ch + ' chance' + (ch === 1 ? '' : 's') + '</b><span>en el sorteo de ' + esc(monthName(mk)) + ': ' + esc(r.prize) + '. Llevás ' + money(mAmt) + ' comprados este mes' + (ch < 50 ? '; con ' + money(Number(r.every) * (ch + 1) - mAmt) + ' más sumás otra chance' : '') + '.</span></div>' : '') +
      '<details><summary>Premios y reglas</summary>' + rewardsList(pts) + basesModalHtml() + '</details>' +
      '<a class="btn btn-line btn-sm" href="' + esc(waLink('Hola ' + cfg.brand.name + '! Quiero canjear mis puntos (' + pts + ' pts). Soy ' + (customer.name || '') + '.')) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'Canjear por WhatsApp</a></div>';
  }
  // ---- panel: pestaña Puntos
  function tiersPanel() {
    var T = tiers();
    if (!T.enabled) return '<div class="panel"><h2>Niveles de cliente</h2><p>Están apagados. Activalos en <b>Datos y ajustes → Niveles de cliente</b>.</p></div>';
    var by = {}; levelsSorted().forEach(function (l) { by[l.name] = 0; });
    Object.keys(clientsMap || {}).forEach(function (k) { var t = clientsMap[k].tier; if (t && by[t.level] !== undefined) by[t.level]++; });
    return '<div class="panel"><div class="sec-row" style="margin:0"><h2>Niveles de cliente</h2><button class="btn btn-line btn-sm" type="button" data-act="recalc-tiers"' + (orders ? '' : ' disabled') + '>Recalcular niveles</button></div>' +
      '<div class="tiles">' + levelsSorted().map(function (l) { return tile(esc(l.name), String(by[l.name] || 0), Number(l.min) ? 'desde ' + money(l.min) : 'todos los clientes'); }).join('') + '</div>' +
      '<p class="hint">Se actualizan solos al entregar cada pedido. Recalculá una vez por semana para que bajen de nivel los que dejaron de comprar.</p></div>';
  }
  function pointsAdmin() {
    var L = loyal();
    if (!clientsMap) return '<div class="panel"><p>Cargando clientes…</p></div>';
    if (!L.enabled) return tiersPanel() + '<div class="panel"><h2>Puntos y sorteo</h2><p>El programa está apagado. Activalo y definí los premios en <b>Datos y ajustes → Puntos y sorteo</b>.</p><button class="btn btn-main btn-sm" type="button" data-act="tab" data-tab="negocio">Ir a Datos y ajustes</button></div>';
    var mk = monthKey(), r = L.raffle || {};
    if (lastDraw === null) { lastDraw = false; loadLastDraw(); }
    var list = Object.keys(clientsMap).map(function (k) { var c = clientsMap[k]; return { ph: k, c: c, pts: Number(c.points) || 0, ch: clientChances(c, mk), amt: c.month && c.month.key === mk ? Number(c.month.amount) || 0 : 0 }; })
      .filter(function (x) { return x.pts || x.ch || x.amt; }).sort(function (a, b) { return b.ch - a.ch || b.pts - a.pts; });
    var totCh = list.reduce(function (m, x) { return m + x.ch; }, 0), totPts = list.reduce(function (m, x) { return m + x.pts; }, 0);
    var prevMk = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15).getTime());
    return tiersPanel() + '<div class="panel"><h2>Puntos y sorteo</h2><div class="tiles">' +
      tile('Chances en ' + monthName(mk), String(totCh), list.filter(function (x) { return x.ch; }).length + ' participantes') +
      tile('Puntos sin canjear', totPts.toLocaleString('es-AR'), 'entre todos los clientes') +
      tile('Último sorteo', lastDraw ? esc(lastDraw.name) : '—', lastDraw ? monthName(lastDraw.month) : 'todavía no hubo') + '</div>' +
      (r.enabled ? '<div class="sactions"><button class="btn btn-main btn-sm" type="button" data-act="draw" data-month="' + mk + '">Sortear ' + esc(monthName(mk)) + '</button>' +
        '<button class="btn btn-line btn-sm" type="button" data-act="draw" data-month="' + prevMk + '">Sortear ' + esc(monthName(prevMk)) + '</button></div>' +
        '<p class="hint">El sorteo elige al azar entre todas las chances del mes (más compras = más chances). Queda registrado y el nombre y barrio del ganador se publican en la web.</p>' : '') +
      '<button type="button" class="linkbtn" data-act="bases">Ver bases y condiciones</button></div>' +
      (r.enabled ? '<div class="panel"><h2>Chance gratis (sin compra)</h2><p>Por ley, el sorteo tiene que permitir participar sin comprar. Si alguien te la pide por WhatsApp, cargala acá (una por persona por mes).</p>' +
        '<div class="form-grid"><div class="fld"><label for="ff-name">Nombre</label><input id="ff-name" data-ff="name" value="' + esc(freeForm.name) + '"></div><div class="fld"><label for="ff-phone">WhatsApp</label><input id="ff-phone" data-ff="phone" type="tel" inputmode="tel" value="' + esc(freeForm.phone) + '"></div></div>' +
        '<div class="ctas" style="margin-top:12px"><button class="btn btn-dark btn-sm" type="button" data-act="free-chance">Sumar chance gratis</button></div></div>' : '') +
      '<div class="panel"><h2>Clientes con puntos</h2>' + (list.length ? '<div class="rlist">' + list.slice(0, 200).map(function (x) {
        var can = (L.rewards || []).filter(function (rw) { return x.pts >= Number(rw.pts); });
        return '<div class="rcard"><div class="rcard-top"><div><b>' + esc(x.c.name || x.ph) + '</b><span>' + esc(x.c.barrio || '') + ' · ' + esc(fmtPhone(x.ph)) + '</span></div><span class="rstate activo num">' + x.pts + ' pts</span></div>' +
          '<div class="rnums num" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><small>Comprado en el mes</small><b>' + money(x.amt) + '</b></div><div><small>Chances</small><b>' + x.ch + '</b></div></div>' +
          (redeemFor === x.ph ? '<div class="redeem">' + (can.length ? can.map(function (rw, i) { return '<button class="btn btn-line btn-sm" type="button" data-act="redeem" data-ph="' + esc(x.ph) + '" data-i="' + (L.rewards || []).indexOf(rw) + '">' + esc(rw.label) + ' (−' + rw.pts + ')</button>'; }).join('') : '<p class="hint">Todavía no le alcanza para ningún premio.</p>') + '<button class="linkbtn" type="button" data-act="redeem-open" data-ph="">Cancelar</button></div>'
            : (can.length ? '<button class="btn btn-main btn-sm" type="button" data-act="redeem-open" data-ph="' + esc(x.ph) + '">Canjear premio</button>' : '')) +
          '</div>';
      }).join('') + '</div>' : '<div class="empty">Todavía nadie sumó puntos. Se suman solos al marcar cada pedido como Entregado.</div>') + '</div>';
  }
  function redeem(ph, idx) {
    var rw = (loyal().rewards || [])[idx], c = (clientsMap || {})[ph];
    if (!rw || !c || (Number(c.points) || 0) < Number(rw.pts)) return;
    var inc = window.firebase.firestore.FieldValue.increment, b = fb.db.batch();
    b.set(fb.db.collection('clients').doc(ph), { points: inc(-Number(rw.pts)) }, { merge: true });
    b.set(fb.db.collection('pointlog').doc(), { phone: ph, name: c.name || '', pts: -Number(rw.pts), kind: 'canje', note: rw.label, at: Date.now(), by: user.email });
    b.commit().then(function () {
      c.points = (Number(c.points) || 0) - Number(rw.pts); redeemFor = null; logAudit('puntos', 'Canje de ' + (c.name || ph) + ': ' + rw.label + ' (−' + rw.pts + ')');
      syncCustomerPoints(ph, null);
      render(true);
      var w = waTo(ph, 'Hola ' + String(c.name || '').split(' ')[0] + '! Canjeaste ' + rw.pts + ' puntos por: ' + rw.label + '. Lo aplicamos en tu próximo pedido. Te quedan ' + c.points + ' puntos.');
      showToast('Canje registrado: ' + rw.label + '.');
      if (w) window.open(w, '_blank');
    }).catch(function () { setToast('No se pudo registrar el canje.'); });
  }
  function freeChance() {
    var ph = digits(freeForm.phone), nm = String(freeForm.name || '').trim(), mk = monthKey();
    if (nm.length < 2 || ph.length < 8) { setToast('Completá nombre y WhatsApp.', true); return; }
    var c = (clientsMap || {})[ph] || {};
    if (c.free && c.free.key === mk) { setToast(nm + ' ya tiene su chance gratis de este mes.', true); return; }
    var d = { free: { key: mk, n: 1 } }; if (!c.name) d.name = nm.slice(0, 80);
    fb.db.collection('clients').doc(ph).set(d, { merge: true }).then(function () {
      clientsMap = clientsMap || {}; clientsMap[ph] = Object.assign({}, c, d); freeForm = { name: '', phone: '' }; setToast('Chance gratis cargada para ' + nm + '.');
    }).catch(function () { setToast('No se pudo cargar la chance.'); });
  }
  function runDraw(mk) {
    var pool = [];
    Object.keys(clientsMap || {}).forEach(function (ph) { var n = clientChances(clientsMap[ph], mk); for (var i = 0; i < n; i++) pool.push(ph); });
    if (!pool.length) { setToast('No hay chances en ' + monthName(mk) + '.'); return; }
    var rnd = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(rnd);
    var ph = pool[rnd[0] % pool.length], c = clientsMap[ph], prize = (loyal().raffle || {}).prize || '';
    var parts = String(c.name || '').trim().split(/\s+/), pub = parts[0] + (parts[1] ? ' ' + parts[1].charAt(0) + '.' : '');
    var participants = Object.keys(clientsMap).filter(function (k) { return clientChances(clientsMap[k], mk) > 0; }).length;
    var b = fb.db.batch();
    b.set(fb.db.collection('draws').doc(mk), { month: mk, name: pub, barrio: String(c.barrio || '').slice(0, 60), prize: prize, chances: pool.length, participants: participants, at: Date.now() });
    b.set(fb.db.collection('pointlog').doc(), { phone: ph, name: c.name || '', pts: 0, kind: 'sorteo', note: mk + ' · ' + prize + ' · ' + pool.length + ' chances', at: Date.now(), by: user.email });
    b.commit().then(function () {
      lastDraw = { month: mk, name: pub, barrio: c.barrio || '', prize: prize }; logAudit('sorteo', monthName(mk) + ': ganó ' + (c.name || ph) + ' (' + pool.length + ' chances)');
      drawRes = { mk: mk, ph: ph, name: c.name || ph, barrio: c.barrio || '', prize: prize, total: pool.length, mine: clientChances(c, mk), participants: participants };
      render(true);
    }).catch(function () { setToast('No se pudo registrar el sorteo.'); });
  }
  function drawModal() {
    if (!drawRes) return '';
    var d = drawRes;
    if (d.bases) return '<div class="modal-wrap" data-act="close-draw" style="z-index:60"><div class="modal" role="dialog" aria-modal="true" aria-label="Bases y condiciones" data-stop="1" style="width:min(560px,100%)"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">Bases y condiciones</h2><button class="x" type="button" data-act="close-draw" aria-label="Cerrar">' + ic('x') + '</button></div>' + basesModalHtml() + '<p class="hint">Organiza ' + esc(cfg.brand.name) + '. Válido para mayores de 18 años con domicilio en la Provincia de Buenos Aires o CABA. Los premios no se cambian por dinero.</p></div></div>';
    var w = waTo(d.ph, '¡Hola ' + String(d.name).split(' ')[0] + '! Te escribimos de ' + cfg.brand.name + ': ¡ganaste el sorteo de ' + monthName(d.mk) + '! Premio: ' + d.prize + '. Coordinamos la entrega por acá.');
    return '<div class="modal-wrap" data-act="close-draw" style="z-index:60"><div class="modal draw-modal" role="dialog" aria-modal="true" aria-label="Resultado del sorteo" data-stop="1" style="width:min(480px,100%)">' +
      '<span class="canal-ico" style="margin:0 auto">' + ic('check', 34) + '</span><span class="eyebrow" style="text-align:center">Sorteo de ' + esc(monthName(d.mk)) + '</span>' +
      '<h2 style="text-align:center;font-size:30px">' + esc(d.name) + '</h2><p style="text-align:center;color:var(--ink-2)">' + esc(d.barrio) + ' · ' + esc(fmtPhone(d.ph)) + '</p>' +
      '<p class="num" style="text-align:center">Tenía ' + d.mine + ' de ' + d.total + ' chances · ' + d.participants + ' participantes</p>' +
      '<div class="ctas" style="justify-content:center">' + (w ? '<a class="btn btn-main btn-sm" href="' + esc(w) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'Avisarle por WhatsApp</a>' : '') + '<button class="btn btn-line btn-sm" type="button" data-act="close-draw">Cerrar</button></div></div></div>';
  }
  function loyaltyAdmin() {
    var L = cfgDraft.loyalty = cfgDraft.loyalty || clone(LOYAL_DEFAULT); L.raffle = L.raffle || clone(LOYAL_DEFAULT.raffle); L.rewards = L.rewards || [];
    return '<div class="panel"><h2>Puntos y sorteo</h2><p>Premiá a los que más compran: suman puntos por cada pedido entregado y participan de un sorteo mensual.</p>' +
      '<label class="check"><input type="checkbox" data-c="loyalty.enabled"' + (L.enabled ? ' checked' : '') + '>Programa de puntos activo</label>' +
      '<div class="form-grid">' + f('Pesos por cada punto', 'loyalty.per', { type: 'number', help: 'Ej: 1000 → un pedido de $65.000 suma 65 puntos.' }) + '</div>' +
      '<h3 class="sub-h">Premios para canjear</h3><div class="zlist">' + L.rewards.map(function (rw, i) {
        return '<div class="zrow"><div class="fld"><label for="rw-p-' + i + '">Puntos</label><input id="rw-p-' + i + '" type="number" min="1" data-rw="' + i + '" data-rf="pts" value="' + esc(rw.pts) + '"></div>' +
          '<div class="fld" style="flex:2"><label for="rw-l-' + i + '">Premio</label><input id="rw-l-' + i + '" data-rw="' + i + '" data-rf="label" value="' + esc(rw.label) + '"></div>' +
          '<button class="linkbtn" type="button" data-act="rw-del" data-i="' + i + '">Quitar</button></div>';
      }).join('') + '</div><button class="btn btn-line btn-sm" type="button" data-act="rw-add" style="align-self:flex-start">' + ic('plus', 18) + 'Agregar premio</button>' +
      '<h3 class="sub-h">Sorteo mensual</h3><label class="check"><input type="checkbox" data-c="loyalty.raffle.enabled"' + (L.raffle.enabled ? ' checked' : '') + '>Hacer un sorteo por mes</label>' +
      '<div class="form-grid">' + f('Una chance cada ($ comprados en el mes)', 'loyalty.raffle.every', { type: 'number' }) + f('Premio del sorteo', 'loyalty.raffle.prize', { ph: 'Combo de bazar valuado en $50.000' }) + '</div>' +
      '<p class="hint">En Argentina, los sorteos promocionales tienen que permitir participar sin comprar: por eso las bases incluyen la chance gratis por WhatsApp. Antes de lanzarlo, consultalo con tu contador o abogado.</p></div>';
  }
  function changeStatus(o, st, sel) {
    if (server.admin) {
      sel.disabled = true;
      api('/api/order-status', { orderId: o.id, status: st }, true).then(function (r) {
        Object.assign(o, r.order); sel.disabled = false; render(true);
        var c = o.commission, base = st === 'entregado' && c && c.seller ? 'Entregado. Comisión de ' + sellerName(c.seller.code) + ': ' + money(c.seller.amount) + '.' : '';
        if (base || r.msg) showToast((base + ' ' + (r.msg || '')).trim());
        loadClients(); autoNotify(o);
      }).catch(function (e) { sel.disabled = false; sel.value = o.status; setToast(e.message || 'No se pudo cambiar el estado.'); });
      return;
    }
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
    var prev = o.status;
    fb.db.collection('orders').doc(o.id).update(upd).then(function () {
      Object.assign(o, upd);
      logAudit('estado', prev + ' → ' + st, { order: o.code || o.id, orderId: o.id });
      if (o.sellerCode && st !== 'cancelado') touchClient(o, false);
      render(true);
      var base = st === 'entregado' && upd.commission ? 'Entregado. Comisión de ' + sellerName(code) + ': ' + money(upd.commission.seller.amount) + '.' : '';
      afterStatus(o, prev, st).then(function (extra) { render(true); if (base || extra) showToast((base + ' ' + extra).trim()); });
      autoNotify(o);
    }).catch(function () { sel.value = o.status; setToast('No se pudo cambiar el estado.'); });
  }
  function assignSeller(o, code, sel) {
    if (server.admin) {
      api('/api/order-status', { orderId: o.id, action: 'assign', sellerCode: code || null }, true).then(function (r) {
        Object.assign(o, r.order); loadClients(); render(true); setToast(code ? 'Pedido asignado a ' + sellerName(code) + '.' : 'Pedido sin vendedor.', true);
      }).catch(function (e) { sel.value = o.sellerCode || ''; setToast(e.message || 'No se pudo asignar el vendedor.'); });
      return;
    }
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

