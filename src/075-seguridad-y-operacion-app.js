  /* ================= seguridad y operación: App Check, errores, historial, copias ================= */
  var APP_VERSION = '2026.10.17';
  var appCheck = null;
  function initAppCheck() {
    var k = window.GALPON_APPCHECK_KEY;
    if (!k || !window.firebase || !window.firebase.appCheck) return;
    try { appCheck = window.firebase.appCheck(); appCheck.activate(new window.firebase.appCheck.ReCaptchaV3Provider(k), true); } catch (e) { appCheck = null; }
  }
  function appCheckToken() { return appCheck ? appCheck.getToken(false).then(function (r) { return r.token; }).catch(function () { return null; }) : Promise.resolve(null); }
  var errSent = 0;
  function reportError(msg, where, stack) {
    msg = String(msg || ''); if (!msg || errSent >= 5 || /ResizeObserver|^Script error\.?$|extension:\/\//.test(msg + ' ' + where)) return;
    errSent++;
    try { fetch('/api/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg: msg, where: where || '', stack: String(stack || '').slice(0, 1500), url: location.pathname + location.hash, v: APP_VERSION, user: role || '' }), keepalive: true }).catch(function () {}); } catch (e) {}
  }
  window.addEventListener('error', function (e) { reportError(e.message, (e.filename || '').split('/').pop() + ':' + (e.lineno || ''), e.error && e.error.stack); });
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; reportError('Promesa sin manejar: ' + (r && (r.message || r.code) || r), '', r && r.stack); });
  // historial: queda registrado quién cambió qué (precios, estados, liquidaciones, ajustes)
  function logAudit(action, detail, extra) {
    if (!fb || !user || !(isStaff())) return;
    fb.db.collection('audit').add(Object.assign({ at: Date.now(), by: String(user.email || '').toLowerCase(), action: action, detail: String(detail || '').slice(0, 300) }, extra || {})).catch(function () {});
  }
  var auditList = null, errList = null, auditFilter = '';
  function loadAudit() {
    if (!isAdmin()) return;
    fb.db.collection('audit').orderBy('at', 'desc').limit(300).get().then(function (s) { auditList = s.docs.map(function (d) { return d.data(); }); render(true); }).catch(function () { auditList = []; render(true); });
    fb.db.collection('errors').orderBy('last', 'desc').limit(50).get().then(function (s) { errList = s.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }); render(true); }).catch(function () { errList = []; });
  }
  var AUDIT_NAME = { estado: 'Estado de pedido', asignar: 'Vendedor de pedido', producto: 'Producto', precio: 'Precio', stock: 'Stock', borrar: 'Producto eliminado', liquidacion: 'Liquidación', ajustes: 'Datos y ajustes', equipo: 'Equipo', vendedor: 'Vendedor', importar: 'Importación Excel', puntos: 'Puntos', sorteo: 'Sorteo', rubros: 'Rubros', pago: 'Pago' };
  function auditAdmin() {
    if (auditList === null) { auditList = false; loadAudit(); }
    var list = (auditList || []).filter(function (a) { return !auditFilter || a.action === auditFilter; });
    var kinds = []; (auditList || []).forEach(function (a) { if (kinds.indexOf(a.action) === -1) kinds.push(a.action); });
    return '<div class="panel"><div class="sec-row" style="margin:0"><h2>Historial de cambios</h2><button class="btn btn-line btn-sm" type="button" data-act="audit-reload">Actualizar</button></div>' +
      '<p class="hint">Quién cambió qué y cuándo. No se puede editar ni borrar.</p>' +
      (kinds.length ? '<div class="chips">' + [''].concat(kinds).map(function (k) { return '<button type="button" class="chip sm' + (auditFilter === k ? ' on' : '') + '" data-act="audit-f" data-f="' + esc(k) + '">' + esc(k ? (AUDIT_NAME[k] || k) : 'Todo') + '</button>'; }).join('') + '</div>' : '') +
      (auditList === false ? '<p>Cargando…</p>' : list.length ? '<div class="audit-list">' + list.map(function (a) {
        var d = new Date(Number(a.at) || 0);
        return '<div class="audit-row"><span class="num">' + d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + '</span><b>' + esc(AUDIT_NAME[a.action] || a.action) + (a.order ? ' #' + esc(a.order) : '') + '</b><span>' + esc(a.detail || '') + '</span><small>' + esc(a.by || '') + '</small></div>';
      }).join('') + '</div>' : '<div class="empty">Todavía no hay cambios registrados.</div>') + '</div>' +
      '<div class="panel"><h2>Errores de la web</h2><p class="hint">Si algo falla en el celular de un cliente, aparece acá (agrupado y con la cantidad de veces). Pasáselo a quien mantenga el sitio.</p>' +
      (errList === null ? '<p>Cargando…</p>' : errList.length ? '<div class="audit-list">' + errList.map(function (x) { var d = new Date(Number(x.last) || 0); return '<div class="audit-row err"><span class="num">' + d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + '</span><b>' + esc(x.msg) + '</b><span>' + esc(x.where || '') + ' · ' + esc(x.url || '') + '</span><small class="num">' + (x.count || 1) + ' vez/veces · v' + esc(x.v || '') + '</small></div>'; }).join('') + '</div>' : '<p class="hint">' + ic('check', 14) + ' Sin errores registrados.</p>') + '</div>' +
      '<div class="panel"><h2>Copia de seguridad</h2><p>Descargá una copia completa de los datos (productos, pedidos, clientes, vendedores, ajustes…) en un archivo. Guardala en tu compu o en Drive una vez por semana, además de las copias automáticas de Firebase (ver README).</p>' +
      '<div class="ctas"><button class="btn btn-dark btn-sm" type="button" data-act="backup">Descargar copia completa</button></div></div>';
  }
  function exportAll(btn) {
    var cols = ['site', 'products', 'orders', 'clients', 'customers', 'sellers', 'codes', 'payouts', 'leads', 'team', 'pointlog', 'draws', 'resellers', 'stats', 'audit'];
    btn.disabled = true; btn.textContent = 'Preparando…';
    var out = { exportedAt: new Date().toISOString(), version: APP_VERSION, collections: {} };
    cols.reduce(function (pr, c) {
      return pr.then(function () { return fb.db.collection(c).get().then(function (s) { var m = {}; s.docs.forEach(function (d) { m[d.id] = d.data(); }); out.collections[c] = m; }).catch(function () { out.collections[c] = { _error: 'sin permiso' }; }); });
    }, Promise.resolve()).then(function () {
      var json = JSON.stringify(out, function (k, v) { return v && typeof v === 'object' && typeof v.toDate === 'function' ? v.toDate().toISOString() : v; }, 1);
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'el-galpon-copia-' + todayStr() + '.json';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      btn.disabled = false; btn.textContent = 'Descargar copia completa';
      var n = Object.keys(out.collections).reduce(function (t, c) { return t + Object.keys(out.collections[c]).length; }, 0);
      showToast('Copia descargada: ' + n + ' registros.');
      logAudit('ajustes', 'Descargó una copia completa (' + n + ' registros)');
    });
  }
  // pedidos sin verificar por el servidor: avisa si algún precio no coincide con el catálogo
  function priceCheck(o) {
    if (o.verified) return '<span class="ver ok">' + ic('check', 14) + 'Precios verificados</span>';
    var bad = (o.items || []).filter(function (i) { var p = prodById(i.id); return p && Math.abs(Number(i.price) - priceOf(p)) > 0.5 && Math.abs(Number(i.price) - Number(p.price)) > 0.5; });
    return bad.length ? '<span class="ver bad">' + ic('info', 14) + 'Precio distinto al catálogo: ' + bad.map(function (i) { return esc(i.name) + ' ' + money(i.price) + ' (hoy ' + money(priceOf(prodById(i.id))) + ')'; }).join(', ') + '</span>' : '';
  }
