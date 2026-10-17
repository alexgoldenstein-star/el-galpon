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

