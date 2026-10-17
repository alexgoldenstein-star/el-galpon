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
        : '<ol class="osteps" aria-label="Estado del pedido">' + CSTEPS.map(function (st, i) { return '<li class="' + (i < idx ? 'done' : i === idx ? 'now' : '') + '"><span class="dot">' + (i <= idx ? ic('check', 14) : '') + '</span><small>' + esc(cStatusName(o, st)) + '</small></li>'; }).join('') + '</ol>') +
      '<ul class="corder-items">' + shown + '</ul>' +
      (payStatusHtml(o) ? '<div>' + payStatusHtml(o) + '</div>' : '') +
      (payable(o) ? '<button class="btn btn-dark btn-sm pay-btn" type="button" data-act="pay-mp" data-id="' + esc(o.id) + '">Pagar ' + money(payAmount(o)) + (payCfg().mode === 'sena' ? ' de seña' : '') + ' con Mercado Pago</button>' : '') +
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
    return '<div class="wrap acct">' + head + installCard('cuenta') +
      (user.emailVerified ? '' : verifyBox()) +
      (incomplete ? '<div class="panel panel-hl"><h2>Completá tus datos</h2><p>Así cada pedido sale con tu nombre y WhatsApp, y te avisamos cuando esté listo.</p>' + profileForm() + '</div>' : '') +
      '<div class="acct-grid"><div class="panel"><h2>Mis pedidos' + (open ? ' <span class="count num">' + open + ' en curso</span>' : '') + '</h2>' + ordersHtml + '</div>' +
      '<aside class="acct-side">' + myTierPanel() + myPointsPanel() +
      '<div class="panel"><h2>Para tu puesto</h2><p>Etiquetas con el precio sugerido, listas para imprimir y recortar.</p><button class="btn btn-line btn-sm" type="button" data-act="labels">Imprimir etiquetas de precio</button></div>' +
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
      list.push(['historial', 'Historial'], ['puntos', 'Puntos y niveles'], ['negocio', 'Datos y ajustes'], ['equipo', 'Equipo']);
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
      : adminTab === 'puntos' && isAdmin() ? pointsAdmin()
      : adminTab === 'historial' && isAdmin() ? auditAdmin()
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
