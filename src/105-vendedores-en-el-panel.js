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
      '<button class="btn btn-line btn-sm" type="button" data-act="poster" data-type="qr">' + ic('qr', 18) + 'Cartel con QR</button>' +
      '<button class="btn btn-dark btn-sm" type="button" data-act="catpdf">Catálogo en PDF con fotos</button>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="labels">Etiquetas de precio</button></div></div>' +
      '<div class="panel"><h2>' + ic('megaphone', 22) + ' QR del canal de ofertas</h2>' +
      '<p>' + (hasChannel() ? 'Al escanearlo se abre tu canal de WhatsApp.' : 'Al escanearlo se abre WhatsApp con un mensaje listo para pedir que lo sumes a la lista de difusión (“Vengo de parte de…” si es de un vendedor).') +
      ' El QR apunta a la web y de ahí salta al canal: si mañana cambiás el canal, los carteles impresos siguen andando.</p>' +
      (!hasChannel() && isAdmin() ? '<p class="hint">¿Tenés un canal de WhatsApp? Pegá su link en <b>Datos y ajustes → Link del canal de WhatsApp</b>.</p>' : '') +
      '<div class="linkrow"><input readonly value="' + esc(gl) + '" aria-label="Link general del canal"><button class="btn btn-line btn-sm" type="button" data-act="copy" data-text="' + esc(gl) + '">Copiar</button></div>' +
      '<p class="hint num">Escaneos del QR general: <b>' + scans('') + '</b></p></div>' +
      '<div class="panel"><h2>Por vendedor</h2><p>Cada vendedor tiene su propio QR: los clientes que entran por ahí quedan a su nombre.</p>' +
      (list.length ? '<div class="prow-list">' + list.map(function (x) {
        return '<div class="promo-row"><div><b>' + esc(x.name) + '</b> <span class="code-chip">' + esc(x.id) + '</span><small class="num">' + scans(x.id) + ' escaneos del QR</small></div>' +
          '<div class="ctas"><button class="btn btn-line btn-sm" type="button" data-act="catpdf" data-code="' + esc(x.id) + '">Catálogo PDF</button><button class="btn btn-line btn-sm" type="button" data-act="poster" data-type="promo" data-code="' + esc(x.id) + '">Promo</button><button class="btn btn-line btn-sm" type="button" data-act="poster" data-type="qr" data-code="' + esc(x.id) + '">Cartel</button></div></div>';
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
      busy = false; sellerForm = null; setToast(name + ' ya es vendedor. Su link: ' + sellerLink(code)); logAudit('vendedor', 'Alta de ' + name + ' (' + code + ')');
    }).catch(function (e) { busy = false; setToast(e && e.code === 'permission-denied' ? 'Sin permiso: revisá las reglas de Firestore.' : 'No se pudo dar de alta. Probá de nuevo.'); });
  }
  function toggleSeller(code) {
    var s = sellersMap[code]; if (!s) return;
    var act = s.active === false;
    var batch = fb.db.batch();
    batch.update(fb.db.collection('sellers').doc(code), { active: act });
    batch.set(fb.db.collection('codes').doc(code), { name: String(s.name).split(' ')[0].slice(0, 40), active: act });
    batch.commit().then(function () { s.active = act; logAudit('vendedor', (act ? 'Reactivó a ' : 'Pausó a ') + s.name + ' (' + code + ')'); setToast(act ? s.name + ' está activo de nuevo.' : s.name + ' quedó pausado: sus clientes no le generan comisión.'); })
      .catch(function () { setToast('No se pudo cambiar.'); });
  }
  function giveAccess(code) {
    var s = sellersMap[code], el = document.getElementById('sa-' + code);
    var em = el ? String(el.value || '').trim().toLowerCase() : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setToast('Escribí un mail válido.'); return; }
    var batch = fb.db.batch();
    batch.set(fb.db.collection('team').doc(em), { role: 'seller', sellerCode: code, addedBy: user.email, addedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    batch.update(fb.db.collection('sellers').doc(code), { email: em });
    batch.commit().then(function () { s.email = em; logAudit('vendedor', 'Dio acceso a ' + s.name + ' con ' + em); setToast('Listo. ' + s.name + ' entra en ' + location.origin + '/#admin con ' + em + '.'); })
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
      logAudit('liquidacion', 'Pagó ' + money(total) + ' a ' + sellerName(code) + ' (' + items.length + ' comisiones)', { code: code, payout: pref.id });
      busy = false; setToast('Liquidación registrada: ' + money(total) + ' a ' + sellerName(code) + '. Mandale el detalle desde “Liquidaciones”.');
    }).catch(function () { busy = false; setToast('No se pudo registrar la liquidación.'); });
  }

