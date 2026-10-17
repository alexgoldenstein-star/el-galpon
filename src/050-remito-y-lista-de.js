  /* ================= remito y lista de preparación ================= */
  function printDoc(title, body) {
    var w = window.open('', '_blank');
    if (!w) { setToast('El navegador bloqueó la ventana. Permití ventanas emergentes para este sitio.'); return; }
    w.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' +
      'body{font-family:Figtree,Arial,sans-serif;color:#1E2A5A;margin:0;padding:28px;font-size:13px}h1{font-size:22px;margin:0}h2{font-size:15px;margin:18px 0 6px}' +
      '.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #FF6B1A;padding-bottom:10px;margin-bottom:12px}.brand{font-weight:800;font-size:20px}.muted{color:#6B7299}' +
      'table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border-bottom:1px solid #E5D6C6;padding:6px 4px;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#6B7299}' +
      '.r{text-align:right}.tot td{border:0;font-weight:700}.big{font-size:16px}.box{border:1px solid #E5D6C6;border-radius:8px;padding:8px 10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.chk{width:14px;height:14px;border:2px solid #1E2A5A;border-radius:3px;display:inline-block;vertical-align:-2px;margin-right:4px}.sign{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px}.sign div{border-top:1px solid #1E2A5A;padding-top:4px;text-align:center}' +
      '.page{page-break-after:always}.page:last-child{page-break-after:auto}@media print{body{padding:10mm}.noprint{display:none}}' +
      '</style></head><body><div class="noprint" style="margin-bottom:14px"><button onclick="print()" style="font:inherit;padding:8px 14px">Imprimir o guardar PDF</button></div>' + body +
      '<script>setTimeout(function(){print()},400)<\/script></body></html>');
    w.document.close();
  }
  function remitoHtml(o) {
    var d = oDate(o), c = cfg.contact, rows = (o.items || []).map(function (i) {
      var sku = i.sku || cleanSku((prodById(i.id) || {}).sku);
      return '<tr><td><span class="chk"></span></td><td class="r">' + i.q + '</td><td>' + esc(sku || '—') + '</td><td>' + esc(i.name) + '</td><td class="r">' + money(i.price) + '</td><td class="r">' + money(i.q * i.price) + '</td></tr>';
    }).join('');
    var del = o.delivery && o.delivery.mode === 'envio' ? 'Envío a ' + esc(o.delivery.zone || '') + '<br>' + esc(o.delivery.address || '') : 'Retira en el depósito';
    var pay = o.payment && o.payment.status === 'aprobado' ? 'Pagado ' + money(o.payment.amount) + (o.payment.method === 'manual' ? '' : ' (Mercado Pago)') : o.payment && o.payment.status === 'pendiente' ? 'Pago pendiente' : 'A cobrar';
    return '<div class="page"><div class="top"><div><div class="brand">' + esc(cfg.brand.name) + '</div><div class="muted">' + esc(c.address || '') + (c.area ? ', ' + esc(c.area) : '') + (ourWa() ? ' · WhatsApp ' + esc(ourWa()) : '') + '</div></div>' +
      '<div style="text-align:right"><h1>Remito · Pedido #' + esc(o.code || o.id.slice(0, 5).toUpperCase()) + '</h1><div class="muted">' + (d ? d.toLocaleDateString('es-AR') : '') + ' · Documento no válido como factura</div></div></div>' +
      '<div class="grid"><div class="box"><b>Cliente</b><br>' + esc(o.name) + (o.barrio ? '<br>' + esc(o.barrio) : '') + (o.phone ? '<br>Tel. ' + esc(fmtPhone(o.phone)) : '') + '</div>' +
      '<div class="box"><b>Entrega</b><br>' + del + (o.sellerCode ? '<br>Vendedor: ' + esc(sellerName(o.sellerCode)) + ' (' + esc(o.sellerCode) + ')' : '') + '<br><b>' + pay + '</b></div></div>' +
      '<table><thead><tr><th></th><th class="r">Cant.</th><th>SKU</th><th>Producto</th><th class="r">Precio</th><th class="r">Subtotal</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tbody class="tot"><tr><td colspan="5" class="r">Productos</td><td class="r">' + money(o.total) + '</td></tr>' +
      (o.shipping ? '<tr><td colspan="5" class="r">Envío</td><td class="r">' + money(o.shipping) + '</td></tr>' : '') +
      '<tr class="big"><td colspan="5" class="r">Total</td><td class="r">' + money(o.grand || o.total) + '</td></tr></tbody></table>' +
      '<div class="sign"><div>Preparó</div><div>Recibí conforme (firma y aclaración)</div></div></div>';
  }
  function printRemitos(list) {
    if (!list.length) { setToast('No hay pedidos para imprimir.'); return; }
    printDoc('Remitos', list.map(remitoHtml).join(''));
  }
  function printPicking(list) {
    list = list.filter(function (o) { return o.status !== 'cancelado' && o.status !== 'entregado'; });
    if (!list.length) { setToast('No hay pedidos pendientes para preparar en este filtro.'); return; }
    var agg = {};
    list.forEach(function (o) { (o.items || []).forEach(function (i) {
      var p = prodById(i.id), sku = i.sku || cleanSku((p || {}).sku), k = sku || i.name;
      var a = agg[k] = agg[k] || { sku: sku, name: i.name, cat: i.cat || (p || {}).cat || '', q: 0, orders: [], stock: tracked(p) ? Number(p.qty) : null };
      a.q += Number(i.q) || 0; a.orders.push('#' + (o.code || '') + ' ×' + i.q);
    }); });
    var rows = Object.keys(agg).map(function (k) { return agg[k]; }).sort(function (a, b) { return String(a.cat).localeCompare(b.cat) || String(a.name).localeCompare(b.name); });
    var body = '<div class="top"><div><div class="brand">' + esc(cfg.brand.name) + '</div><div class="muted">Lista de preparación · ' + new Date().toLocaleDateString('es-AR') + ' · ' + list.length + ' pedidos</div></div></div>' +
      '<h2>Total a juntar</h2><table><thead><tr><th></th><th class="r">Cant.</th><th>SKU</th><th>Producto</th><th>Rubro</th><th class="r">En depósito</th><th>Pedidos</th></tr></thead><tbody>' +
      rows.map(function (a) { return '<tr><td><span class="chk"></span></td><td class="r big"><b>' + a.q + '</b></td><td>' + esc(a.sku || '—') + '</td><td>' + esc(a.name) + '</td><td>' + esc(a.cat) + '</td><td class="r">' + (a.stock === null ? '—' : a.stock < a.q ? '<b style="color:#B91C1C">' + a.stock + ' (falta)</b>' : a.stock) + '</td><td class="muted">' + esc(a.orders.join(', ')) + '</td></tr>'; }).join('') +
      '</tbody></table><h2>Por pedido</h2>' +
      list.map(function (o) { return '<div class="box" style="margin-bottom:8px"><b>#' + esc(o.code || '') + ' · ' + esc(o.name) + '</b> <span class="muted">' + (o.delivery && o.delivery.mode === 'envio' ? 'Envío ' + esc(o.delivery.zone || '') : 'Retira') + '</span><br>' +
        (o.items || []).map(function (i) { return '<span class="chk"></span> ' + i.q + ' × ' + esc(i.sku ? '[' + i.sku + '] ' : '') + esc(i.name); }).join('<br>') + '</div>'; }).join('');
    printDoc('Lista de preparación', body);
  }
  function filteredOrders() {
    return (orders || []).filter(function (o) {
      if (oFilter === 'todos') return true;
      if (oFilter === 'pendientes') return o.status === 'nuevo' || o.status === 'confirmado' || o.status === 'listo';
      return o.status === oFilter;
    });
  }
  function ordersAdmin() {
    var head = '<div class="panel"><div class="sec-row" style="margin:0"><h2>Pedidos</h2><button class="btn btn-line btn-sm" type="button" data-act="load-orders">Actualizar</button></div>';
    if (ordersErr) return head + '<p style="color:var(--danger)">' + esc(ordersErr) + '</p></div>';
    if (!orders) return head + '<p>Cargando pedidos…</p></div>';
    if (!orders.length) return head + '<p>Todavía no llegó ningún pedido. Cada pedido enviado desde el carrito aparece acá con su número.</p></div>';
    var filters = [['pendientes', 'Pendientes'], ['nuevo', 'Nuevos'], ['confirmado', 'Confirmados'], ['listo', 'Listos'], ['todos', 'Todos']];
    var list = filteredOrders();
    return summary() + head +
      '<div class="chips" style="margin-top:4px">' + filters.map(function (f) {
        return '<button type="button" class="chip' + (oFilter === f[0] ? ' on' : '') + '" data-act="ofilter" data-f="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="sactions"><button class="btn btn-line btn-sm" type="button" data-act="print-pick">Lista de preparación</button><button class="btn btn-line btn-sm" type="button" data-act="print-rem-all">Imprimir remitos (' + list.filter(function (o) { return o.status !== 'cancelado'; }).length + ')</button></div>' +
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
          priceCheck(o) + deliveryLine(o) + sellerLine(o) +
          '<div class="order-foot"><span class="num"><b>' + money(o.grand || o.total) + '</b>' + (o.shipping ? '<small class="ship-note"> incluye envío ' + money(o.shipping) + '</small>' : '') + '</span>' +
          '<select data-order="' + esc(o.id) + '" aria-label="Estado del pedido">' +
          Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (o.status === k ? ' selected' : '') + '>' + STATUS[k] + '</option>'; }).join('') +
          '</select></div>' +
          payLine(o) +
          '<div class="sactions">' + (wa ? '<a class="btn btn-line btn-sm" href="' + esc(wa) + '" target="_blank" rel="noopener">' + ic('wa', 18) + esc(NOTIFY_LABEL[o.status] || 'Escribirle') + '</a>' : '') +
          '<button class="btn btn-line btn-sm" type="button" data-act="print-rem" data-id="' + esc(o.id) + '">Remito</button>' +
          (o.notified && o.notified[o.status] ? '<span class="hint">' + ic('check', 14) + ' Aviso automático enviado</span>' : '') + '</div>' +
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

  var pq = '', pLow = false;
  function productsAdmin() {
    var q = pq.trim().toLowerCase();
    var list = products.filter(function (p) { return !q || (p.name + ' ' + p.cat + ' ' + (p.sku || '')).toLowerCase().indexOf(q) !== -1; });
    var nOffer = products.filter(onOffer).length, nOut = products.filter(function (p) { return p.stock === 'out'; }).length;
    var low = products.filter(function (p) { return tracked(p) && p.stock !== 'order' && Number(p.qty) <= (Number(p.minQty) || 0); });
    if (pLow) list = list.filter(function (p) { return low.indexOf(p) !== -1 || p.stock === 'out'; });
    return '<div class="panel">' +
      '<div class="sec-row" style="margin:0"><div><h2>Productos</h2><p style="color:var(--ink-3);font-size:14px;margin-top:4px" class="num">' + products.length + ' productos · ' + nOffer + ' en oferta · ' + nOut + ' sin stock</p></div>' +
      '<div class="sactions"><label class="btn btn-line btn-sm upload-btn">' + ic('plus', 18) + 'Importar Excel<input type="file" accept=".xlsx,.xls,.csv" data-import="1"></label>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="export-x">Exportar Excel</button>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="cats">Rubros (' + (cfg.categories || []).length + ')</button>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="new-prod">' + ic('camera', 18) + 'Cargar producto</button></div></div>' +
      '<p class="hint">Para cargar muchos de una vez: <button type="button" class="linkbtn" data-act="template-x">bajá la plantilla de Excel</button>, completala y tocá “Importar Excel”. Si un SKU ya existe, se actualiza.</p>' +
      '<label class="search" style="flex:none">' + ic('search', 20) + '<input id="pq" type="search" placeholder="Buscar por nombre, rubro o SKU" value="' + esc(pq) + '" aria-label="Buscar en mis productos"></label>' +
      (low.length || nOut ? '<div class="admin-note warn-note">' + ic('info', 20) + '<span><b>' + (function (n) { return n + (n === 1 ? ' producto' : ' productos'); })(low.length + products.filter(function (p) { return p.stock === 'out' && low.indexOf(p) === -1; }).length) + ' para reponer</b> (sin stock o por debajo del mínimo). <button type="button" class="linkbtn" data-act="plow">' + (pLow ? 'Ver todos' : 'Ver cuáles') + '</button></span></div>' : '') +
      '<p class="hint">Cambiá precio, unidades y stock directo en la lista: se guarda solo. Tocá la foto o el nombre para editar todo. “Por encargo” sirve para publicar productos que todavía no tenés y medir el interés con las vistas y los agregados al carrito.</p>' +
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
          '<label class="qf"><span>Unid.</span><input type="number" inputmode="numeric" min="0" data-quick="qty" data-id="' + pid + '" value="' + (tracked(p) ? esc(p.qty) : '') + '" placeholder="—" aria-label="Unidades de ' + esc(p.name) + '"></label>' +
          '<label class="qf"><span>Stock</span><select data-quick="stock" data-id="' + pid + '" aria-label="Stock de ' + esc(p.name) + '">' +
          '<option value="ok"' + (p.stock === 'ok' ? ' selected' : '') + '>Hay</option>' +
          '<option value="low"' + (p.stock === 'low' ? ' selected' : '') + '>Pocas</option>' +
          '<option value="order"' + (p.stock === 'order' ? ' selected' : '') + '>Por encargo</option>' +
          '<option value="out"' + (p.stock === 'out' ? ' selected' : '') + '>Sin stock</option></select></label>' +
          '</div></div>';
      }).join('') : '<div class="empty">No hay productos con esa búsqueda.</div>') + '</div></div>';
  }

