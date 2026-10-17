  /* ================= Firebase: datos ================= */
  function productDoc(p) {
    return {
      name: String(p.name || '').trim() || 'Producto', sku: cleanSku(p.sku), desc: String(p.desc || ''), cat: p.cat || (cfg.categories || [''])[0], sub: subsOf(p.cat).indexOf(p.sub) !== -1 ? p.sub : '',
      price: Number(p.price) || 0, sug: Number(p.sug) || 0, stock: deriveStock(p), featured: !!p.featured,
      qty: tracked(p) ? Math.max(0, Math.round(Number(p.qty))) : null, minQty: Math.max(0, Math.round(Number(p.minQty) || 0)),
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
    var docData = productDoc(p), oldP = prodById(p.id);
    fb.db.collection('products').doc(p.id).set(docData).then(function () {
      logAudit(isNew ? 'producto' : (oldP && (oldP.price !== docData.price || oldP.sug !== docData.sug) ? 'precio' : 'producto'), (isNew ? 'Alta: ' : 'Edición: ') + docData.name + (oldP && oldP.price !== docData.price ? ' · precio ' + money(oldP.price) + ' → ' + money(docData.price) : ' · ' + money(docData.price)), { pid: p.id });
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
      logAudit('borrar', p.name + (p.sku ? ' [' + p.sku + ']' : ''), { pid: p.id });
      products = products.filter(function (x) { return x.id !== p.id; }); delete cart[p.id]; persistCart();
      busy = false; editing = null; setToast('Producto eliminado.');
    }).catch(function () { busy = false; setToast('No se pudo eliminar.'); });
  }
  function saveCfg() {
    if (busy) return;
    var d = clone(cfgDraft);
    d.categories = (cfg.categories || []).slice(); // los rubros se manejan desde "Administrar rubros"
    d.subcats = clone(cfg.subcats || {});
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
    d.loyalty = d.loyalty || clone(LOYAL_DEFAULT);
    d.loyalty.enabled = !!d.loyalty.enabled; d.loyalty.per = Math.max(1, Number(d.loyalty.per) || 1000);
    d.loyalty.rewards = (d.loyalty.rewards || []).filter(function (r) { return Number(r.pts) > 0 && String(r.label || '').trim(); }).map(function (r) { return { pts: Math.round(Number(r.pts)), label: String(r.label).trim().slice(0, 80) }; }).sort(function (a, b) { return a.pts - b.pts; });
    d.loyalty.raffle = { enabled: !!(d.loyalty.raffle && d.loyalty.raffle.enabled), every: Math.max(1, Number(d.loyalty.raffle && d.loyalty.raffle.every) || 20000), prize: String((d.loyalty.raffle && d.loyalty.raffle.prize) || '').trim().slice(0, 100) || LOYAL_DEFAULT.raffle.prize };
    d.payments = d.payments || clone(PAY_DEFAULT);
    d.payments.enabled = !!d.payments.enabled; d.payments.pct = Math.min(100, Math.max(1, Number(d.payments.pct) || 30));
    d.notify = { auto: !(d.notify && d.notify.auto === false) };
    d.trust = d.trust || clone(TRUST_DEFAULT);
    d.trust = { showNumbers: !!d.trust.showNumbers, minShow: Math.max(0, Number(d.trust.minShow) || 0), baseOrders: Math.max(0, Number(d.trust.baseOrders) || 0), baseClients: Math.max(0, Number(d.trust.baseClients) || 0),
      video: String(d.trust.video || '').trim().slice(0, 200), guarantees: (d.trust.guarantees || []).filter(function (g) { return g && String(g.t || '').trim(); }).map(function (g) { return { t: String(g.t).trim().slice(0, 60), d: String(g.d || '').trim().slice(0, 240) }; }) };
    d.tiers = d.tiers || clone(TIERS_DEFAULT);
    d.tiers = { enabled: !!d.tiers.enabled, days: Math.max(7, Number(d.tiers.days) || 90), levels: (d.tiers.levels || []).filter(function (l) { return String(l.name || '').trim(); }).map(function (l) { return { name: String(l.name).trim().slice(0, 20), min: Math.max(0, Number(l.min) || 0), shipOff: Math.min(100, Math.max(0, Number(l.shipOff) || 0)), ptsMult: Math.max(1, Number(l.ptsMult) || 1), perk: String(l.perk || '').trim().slice(0, 80) }; }).sort(function (a, b) { return a.min - b.min; }) };
    if (d.tiers.levels.length) d.tiers.levels[0].min = 0;
    if (d.contact.channel && !/^https?:\/\//.test(d.contact.channel)) { setToast('El link del canal tiene que empezar con https://'); return; }
    busy = true; render(true);
    fb.db.collection('site').doc('main').set(d).then(function () {
      logAudit('ajustes', 'Guardó datos y ajustes');
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
      if (counters !== null) computeCounters(); else setTimeout(computeCounters, 1500);
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
      busy = false; team = null; loadTeam(); setToast('Listo. Ya puede entrar con ' + em + '.'); logAudit('equipo', 'Sumó a ' + em + ' (' + r + ')');
    }).catch(function () { busy = false; setToast('No se pudo sumar. Revisá las reglas de Firestore.'); });
  }
  // Mensaje de WhatsApp a partir de los datos confirmados (los del servidor, si está activo)
  function msgFrom(code, d) {
    var envio = d.delivery && d.delivery.mode === 'envio';
    var lines = d.items.map(function (i) { var p = prodById(i.id); return '• ' + i.q + ' x ' + (i.sku ? '[' + i.sku + '] ' : '') + i.name + ' (' + money(i.price) + ' c/u)' + (p && p.stock === 'order' ? ' · por encargo' : ''); });
    return 'Hola ' + cfg.brand.name + '! Te mando mi pedido' + (code ? ' #' + code : '') + ':\n\n' + lines.join('\n') +
      '\n\nProductos: ' + money(d.total) +
      (envio ? '\nEnvío a ' + d.delivery.zone + ': ' + money(d.shipping) + (d.delivery.benefit ? ' (beneficio ' + d.delivery.benefit.toLowerCase() + ')' : '') : '\nRetiro en el depósito') +
      '\nTotal: ' + money(d.total + d.shipping) +
      '\n\nNombre: ' + (buyer.name || '') + '\nWhatsApp: ' + (buyer.phone || '') + (buyer.barrio ? '\nBarrio: ' + buyer.barrio : '') +
      (envio ? '\nDirección: ' + (d.delivery.address || '') : '') +
      (d.ref ? '\nVendedor: ' + d.ref : '');
  }
  function localOrderData() {
    var lines = cartLines(), t = cartTotals();
    return {
      items: lines.slice(0, 50).map(function (l) { return { id: l.p.id, name: String(l.p.name).slice(0, 120), sku: cleanSku(l.p.sku), q: l.q, price: priceOf(l.p), cat: String(l.p.cat || '').slice(0, 60), sub: String(l.p.sub || '').slice(0, 60) }; }),
      total: t.total, shipping: shippingCost(),
      delivery: effMode() === 'envio'
        ? Object.assign({ mode: 'envio', zone: String(buyer.zone || '').slice(0, 60), address: String(buyer.address || '').slice(0, 160), cost: shippingCost(), eta: String((zoneByName(buyer.zone) || {}).eta || '').slice(0, 60) }, shipOffPct() && shipBase() ? { base: shipBase(), benefit: 'Nivel ' + myLevel().name } : {})
        : { mode: 'retiro' },
      ref: orderRef() || null
    };
  }
  // Camino principal: el servidor valida precios, stock y envío. Si el servidor no está configurado o no responde, se guarda directo.
  function sendOrderApi() {
    var payload = { items: cartLines().map(function (l) { return { id: l.p.id, q: l.q }; }), buyer: { name: buyer.name, barrio: buyer.barrio, phone: buyer.phone },
      delivery: { mode: effMode(), zone: buyer.zone, address: buyer.address }, ref: orderRef() || '' };
    return Promise.all([user ? user.getIdToken().catch(function () { return null; }) : null, appCheckToken()]).then(function (t) {
      var h = { 'Content-Type': 'application/json' }; if (t[0]) h.Authorization = 'Bearer ' + t[0]; if (t[1]) h['X-Firebase-AppCheck'] = t[1];
      var ctl = window.AbortController ? new AbortController() : null; var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
      return fetch('/api/order-create', { method: 'POST', headers: h, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { clearTimeout(timer); return r.json().catch(function () { return {}; }).then(function (j) { if (r.ok) return j; var e = new Error(j.error || 'Error ' + r.status); e.fallback = r.status >= 500; throw e; }); },
          function () { clearTimeout(timer); var e = new Error('sin conexión con el servidor'); e.fallback = true; throw e; });
    });
  }
  function sendOrderDirect() {
    var ref = fb.db.collection('orders').doc(), code = ref.id.slice(0, 5).toUpperCase(), d = localOrderData();
    var doc = Object.assign({ code: code, name: String(buyer.name || '').slice(0, 80), barrio: String(buyer.barrio || '').slice(0, 80), phone: digits(buyer.phone).slice(0, 15),
      items: d.items, total: d.total, shipping: d.shipping, grand: d.total + d.shipping, delivery: d.delivery, status: 'nuevo', createdAt: window.firebase.firestore.FieldValue.serverTimestamp() },
      d.ref ? { ref: d.ref } : {}, isClient() && user ? { uid: user.uid } : {});
    var timeout = new Promise(function (res) { setTimeout(res, 2500); });
    return Promise.race([ref.set(doc).catch(function () {}), timeout]).then(function () { return Object.assign({ id: ref.id, code: code }, d); });
  }
  function sendOrder() {
    if (sending) return;
    if (offline) { showToast('Estás sin conexión. Cuando vuelva la señal, tocá “Enviar pedido” de nuevo: tu carrito queda guardado.'); return; }
    if (!cartLines().length) return;
    sending = true; render(true);
    if (!fb) { var c0 = Date.now().toString(36).slice(-5).toUpperCase(); finishOrder(Object.assign({ id: '', code: c0 }, localOrderData())); return; }
    var job = server.admin ? sendOrderApi().catch(function (e) { if (e.fallback) return sendOrderDirect(); throw e; }) : sendOrderDirect();
    job.then(finishOrder).catch(function (e) { sending = false; render(true); showToast(e.message || 'No se pudo enviar el pedido.'); });
  }
  function finishOrder(r) {
    var link = waLink(msgFrom(r.code, r));
    if (isClient() && user && customer && !customer.error && (!customer.barrio || !customer.phone || (effMode() === 'envio' && !customer.address))) {
      var upd = Object.assign({}, customer, { name: customer.name || buyer.name, phone: customer.phone || digits(buyer.phone), barrio: customer.barrio || buyer.barrio, address: customer.address || (effMode() === 'envio' ? buyer.address : ''), zone: customer.zone || (effMode() === 'envio' ? buyer.zone : '') });
      saveCustomerDoc(upd, !customer.createdAt).then(function () { customer = upd; }).catch(function () {});
    }
    lastOrder = { code: r.code, link: link, id: r.id || '' };
    if (r.id && server.wa) fetch('/api/order-created', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: r.id }), keepalive: true }).catch(function () {});
    try { sessionStorage.setItem('galpon-last-order', JSON.stringify(lastOrder)); } catch (e) {}
    cart = {}; persistCart(); sending = false; cartOpen = true; render(true);
    window.location.href = link;
  }

