  /* ================= al entregar: stock y puntos ================= */
  var LOYAL_DEFAULT = { enabled: false, per: 1000, rewards: [{ pts: 300, label: '$3.000 de descuento en tu próximo pedido' }, { pts: 1000, label: '$12.000 de descuento en tu próximo pedido' }],
    raffle: { enabled: false, every: 20000, prize: 'Un combo de bazar sorpresa' } };
  function loyal() { return (cfg && cfg.loyalty) || LOYAL_DEFAULT; }
  function monthKey(t) { var d = new Date(t || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function monthName(k) { var p = String(k || monthKey()).split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); }
  function ptsFor(o) {
    var L = loyal(); if (!L.enabled || !(Number(L.per) > 0)) return 0;
    var c = (clientsMap || {})[digits(o.phone)], lv = tiers().enabled && c && c.tier ? levelByName(c.tier.level) : null;
    return Math.floor((Number(o.total) || 0) / Number(L.per) * (lv && Number(lv.ptsMult) > 1 ? Number(lv.ptsMult) : 1));
  }
  function chancesFor(amount) { var r = loyal().raffle || {}; return r.enabled && Number(r.every) > 0 ? Math.floor((Number(amount) || 0) / Number(r.every)) : 0; }
  // Descuenta (o devuelve) unidades de los productos que llevan stock contado.
  function applyStock(o, sign) {
    var batch = fb.db.batch(), touched = [];
    (o.items || []).forEach(function (i) {
      var p = prodById(i.id); if (!tracked(p)) return;
      var nq = Math.max(0, Number(p.qty) - sign * (Number(i.q) || 0));
      var np = Object.assign({}, p, { qty: nq });
      batch.update(fb.db.collection('products').doc(p.id), { qty: window.firebase.firestore.FieldValue.increment(-sign * (Number(i.q) || 0)), stock: deriveStock(np) });
      touched.push([p, nq, deriveStock(np)]);
    });
    batch.update(fb.db.collection('orders').doc(o.id), { stockDone: sign > 0 });
    return batch.commit().then(function () {
      o.stockDone = sign > 0;
      touched.forEach(function (x) { x[0].qty = x[1]; x[0].stock = x[2]; });
      return touched.filter(function (x) { return x[2] === 'out' || x[2] === 'low'; }).map(function (x) { return x[0].name; });
    });
  }
  // Suma (o resta) puntos al cliente por teléfono y, si tiene cuenta, a su ficha.
  function applyPoints(o, sign) {
    var ph = digits(o.phone), pts = sign > 0 ? ptsFor(o) : -(Number(o.points) || 0);
    if (!ph || !pts) return Promise.resolve(0);
    var inc = window.firebase.firestore.FieldValue.increment;
    var mk = monthKey(sign > 0 ? Date.now() : o.deliveredAt), amt = sign * (Number(o.total) || 0);
    var cur = (clientsMap || {})[ph] || {};
    var month = cur.month && cur.month.key === mk ? { key: mk, amount: Math.max(0, (Number(cur.month.amount) || 0) + amt) } : { key: mk, amount: Math.max(0, amt) };
    var batch = fb.db.batch();
    batch.set(fb.db.collection('clients').doc(ph), { points: inc(pts), month: month, name: String(o.name || '').slice(0, 80), barrio: String(o.barrio || '').slice(0, 80) }, { merge: true });
    batch.set(fb.db.collection('pointlog').doc(), { phone: ph, name: String(o.name || '').slice(0, 80), pts: pts, kind: sign > 0 ? 'compra' : 'reverso', order: o.code || o.id, at: Date.now() });
    batch.update(fb.db.collection('orders').doc(o.id), { points: sign > 0 ? pts : 0 });
    return batch.commit().then(function () {
      o.points = sign > 0 ? pts : 0;
      clientsMap = clientsMap || {}; clientsMap[ph] = Object.assign({}, cur, { points: (Number(cur.points) || 0) + pts, month: month, name: o.name, barrio: o.barrio });
      return syncCustomerPoints(ph, o.uid);
    }).then(function () { return pts; });
  }
  // Copia el saldo a la cuenta del cliente (si tiene) para que lo vea en "Mi cuenta".
  function syncCustomerPoints(ph, uid) {
    var c = (clientsMap || {})[ph]; if (!c) return Promise.resolve();
    var data = { points: Number(c.points) || 0, month: c.month || null };
    var q = uid ? Promise.resolve([uid]) : fb.db.collection('customers').where('phone', '==', ph).limit(3).get().then(function (s) { return s.docs.map(function (d) { return d.id; }); });
    return q.then(function (ids) { return Promise.all(ids.map(function (id) { return fb.db.collection('customers').doc(id).set(data, { merge: true }); })); }).catch(function () {});
  }
  function afterStatus(o, prev, st) {
    var jobs = [], msgs = [];
    if (st === 'entregado' && prev !== 'entregado') {
      if (!o.stockDone) jobs.push(applyStock(o, 1).then(function (low) { if (low.length) msgs.push('Para reponer: ' + low.join(', ') + '.'); }));
      if (!o.points && loyal().enabled) jobs.push(applyPoints(o, 1).then(function (p) { if (p) msgs.push('Sumó ' + p + ' puntos.'); }));
    } else if (prev === 'entregado' && st !== 'entregado') {
      if (o.stockDone) jobs.push(applyStock(o, -1));
      if (o.points) jobs.push(applyPoints(o, -1));
    }
    return Promise.all(jobs).then(function () {
      if ((st === 'entregado') !== (prev === 'entregado') && tiers().enabled) return applyTier(digits(o.phone), o.uid || null).then(function (up) { if (up) msgs.push(String(o.name || '').split(' ')[0] + ' ahora es nivel ' + up + '.'); });
    }).then(function () { return msgs.join(' '); }).catch(function () { return 'Ojo: no se pudo actualizar el stock, los puntos o el nivel.'; });
  }
