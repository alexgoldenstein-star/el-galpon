  /* ================= servidor: WhatsApp automático y Mercado Pago ================= */
  var PAY_DEFAULT = { enabled: false, mode: 'total', pct: 30, when: 'confirmado' };
  var server = { loaded: false, wa: false, mp: false, admin: false };
  function loadServerStatus() {
    fetch('/api/status', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
      .then(function (j) { server = { loaded: true, wa: !!j.wa, mp: !!j.mp, admin: !!j.admin }; render(true); });
  }
  function api(path, body, auth) {
    var tok = auth && user ? user.getIdToken() : Promise.resolve(null);
    return tok.then(function (t) {
      var h = { 'Content-Type': 'application/json' }; if (t) h.Authorization = 'Bearer ' + t;
      return fetch(path, { method: 'POST', headers: h, body: JSON.stringify(body || {}), keepalive: true });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); });
  }
  function payCfg() { return (cfg && cfg.payments) || PAY_DEFAULT; }
  function payAmount(o) { var g = Number(o.grand != null ? o.grand : o.total) || 0; return payCfg().mode === 'sena' ? Math.round(g * (Number(payCfg().pct) || 30) / 100) : g; }
  function payable(o) {
    var P = payCfg();
    if (!P.enabled || !server.mp || !o || o.status === 'cancelado' || o.status === 'entregado') return false;
    if (o.payment && o.payment.status === 'aprobado') return false;
    return P.when === 'siempre' || o.status === 'confirmado' || o.status === 'listo';
  }
  function payStatusHtml(o) {
    var p = o.payment; if (!p || !p.status) return '';
    var txt = p.status === 'aprobado' ? 'Pagado ' + money(p.amount) + (p.method === 'manual' ? '' : ' con Mercado Pago') : p.status === 'rechazado' ? 'El pago fue rechazado' : 'Pago pendiente de ' + money(p.amount);
    return '<span class="pay-st ' + esc(p.status) + '">' + (p.status === 'aprobado' ? ic('check', 14) : '') + esc(txt) + '</span>';
  }
  function payMP(id, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Abriendo Mercado Pago…'; }
    api('/api/mp-create', { orderId: id }, false).then(function (j) { window.location.href = j.url; })
      .catch(function (e) { if (btn) btn.disabled = false; setToast('No se pudo iniciar el pago: ' + e.message, true); });
  }
  function payLine(o) {
    var P = payCfg(); if (!P.enabled && !(o.payment && o.payment.status)) return '';
    var st = payStatusHtml(o) || '<span class="pay-st">Sin pagar</span>';
    var paid = o.payment && o.payment.status === 'aprobado';
    return '<div class="pay-line">' + st +
      (!paid && o.status !== 'cancelado' ? '<span class="sactions">' +
        (server.mp && P.enabled ? '<button class="linkbtn" type="button" data-act="pay-link" data-id="' + esc(o.id) + '">Mandar link de pago</button>' : '') +
        '<button class="linkbtn" type="button" data-act="pay-manual" data-id="' + esc(o.id) + '">Marcar pagado (efectivo o transferencia)</button></span>' : '') + '</div>';
  }
  function payLink(o, btn) {
    btn.disabled = true;
    api('/api/mp-create', { orderId: o.id, force: true }, true).then(function (j) {
      btn.disabled = false; o.payment = Object.assign({}, o.payment || {}, { status: 'pendiente', amount: j.amount, link: j.url }); render(true);
      var w = waTo(o.phone, 'Hola ' + String(o.name || '').split(' ')[0] + '! Te paso el link para pagar tu pedido #' + (o.code || '') + ' (' + money(j.amount) + ') con Mercado Pago: ' + j.url);
      if (w) window.open(w, '_blank'); else showToast('Link de pago: ' + j.url);
    }).catch(function (e) { btn.disabled = false; setToast('No se pudo generar el link: ' + e.message); });
  }
  function payManual(o, a) {
    if (a.getAttribute('data-confirm') !== '1') { a.setAttribute('data-confirm', '1'); a.textContent = '¿Confirmás que ya cobraste ' + money(o.grand || o.total) + '? Tocá de nuevo'; return; }
    var pay = { status: 'aprobado', method: 'manual', amount: Number(o.grand || o.total) || 0, at: Date.now(), by: user.email };
    fb.db.collection('orders').doc(o.id).update({ payment: pay }).then(function () { o.payment = pay; logAudit('pago', 'Marcó pagado ' + money(pay.amount), { order: o.code || o.id, orderId: o.id }); setToast('Pedido #' + (o.code || '') + ' marcado como pagado.'); })
      .catch(function () { setToast('No se pudo marcar como pagado.'); });
  }
  function autoNotify(o) {
    if (!(cfg.notify && cfg.notify.auto) || !server.wa || o.status === 'nuevo' || !o.phone) return;
    if (o.notified && o.notified[o.status]) return;
    api('/api/notify', { orderId: o.id }, true).then(function () {
      o.notified = o.notified || {}; o.notified[o.status] = Date.now(); render(true); showToast('Le avisamos a ' + String(o.name || '').split(' ')[0] + ' por WhatsApp.');
    }).catch(function (e) { showToast('No salió el aviso automático (' + e.message + '). Usá el botón de WhatsApp.'); });
  }
  function connBadge(on, what) { return '<span class="conn ' + (on ? 'on' : 'off') + '">' + (on ? ic('check', 14) + what + ' conectado' : what + ': falta configurar') + '</span>'; }
  function paymentsAdmin() {
    var P = cfgDraft.payments = cfgDraft.payments || clone(PAY_DEFAULT);
    return '<div class="panel"><h2>Cobros con Mercado Pago</h2>' + connBadge(server.mp, 'Mercado Pago') +
      (!server.mp ? '<p class="hint">Para conectarlo hay que cargar tu Access Token de Mercado Pago en Vercel (te dejo los pasos en el README, sección “Mercado Pago”).</p>' : '') +
      '<label class="check"><input type="checkbox" data-c="payments.enabled"' + (P.enabled ? ' checked' : '') + '>Ofrecer pago con Mercado Pago</label>' +
      '<div class="form-grid"><div class="fld"><label for="pay-mode">Qué se cobra</label><select id="pay-mode" data-c="payments.mode"><option value="total"' + (P.mode === 'total' ? ' selected' : '') + '>El total del pedido</option><option value="sena"' + (P.mode === 'sena' ? ' selected' : '') + '>Una seña</option></select></div>' +
      (P.mode === 'sena' ? f('Seña (%)', 'payments.pct', { type: 'number' }) : '') +
      '<div class="fld"><label for="pay-when">Cuándo puede pagar</label><select id="pay-when" data-c="payments.when"><option value="confirmado"' + (P.when !== 'siempre' ? ' selected' : '') + '>Cuando confirmamos el pedido (recomendado)</option><option value="siempre"' + (P.when === 'siempre' ? ' selected' : '') + '>Apenas lo envía</option></select></div></div>' +
      '<p class="hint">El cliente ve el botón “Pagar” en Mi cuenta, y vos podés mandarle el link desde cada pedido. El pago se marca solo cuando Mercado Pago lo aprueba. Efectivo y transferencia se marcan a mano.</p></div>';
  }
  function notifyAdmin() {
    var N = cfgDraft.notify = cfgDraft.notify || { auto: true };
    return '<div class="panel"><h2>Avisos automáticos por WhatsApp</h2>' + connBadge(server.wa, 'WhatsApp Business') +
      (!server.wa ? '<p class="hint">Usa la API oficial de WhatsApp (Meta). Hace falta un número exclusivo para el negocio y dos plantillas aprobadas: los pasos están en el README, sección “WhatsApp automático”. Mientras tanto, los botones de WhatsApp de cada pedido siguen funcionando a mano.</p>' : '') +
      '<label class="check"><input type="checkbox" data-c="notify.auto"' + (N.auto !== false ? ' checked' : '') + '>Avisar al cliente cada vez que cambia el estado de su pedido</label>' +
      '<p class="hint">Confirmado, listo para retirar/enviar, entregado o cancelado. A vos te llega un aviso por cada pedido nuevo.</p></div>';
  }
