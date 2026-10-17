// Alta de pedidos con precios verificados contra el catálogo.
// La web manda solo productos y cantidades; el precio, la oferta vigente, el envío y los beneficios se calculan acá.
const { getAdmin, hasAdmin, body, send, appCheckOk, rateLimit } = require('./_lib');
const L = require('./_logic');
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  if (!hasAdmin()) return send(res, 503, { error: 'Servidor sin configurar' });
  try {
    if (!(await appCheckOk(req))) return send(res, 403, { error: 'No pudimos validar tu navegador. Recargá la página.' });
    if (!(await rateLimit(req, 'order', 8, 10 * 60e3))) return send(res, 429, { error: 'Mandaste muchos pedidos seguidos. Esperá unos minutos o escribinos por WhatsApp.' });
    const a = getAdmin(), db = a.firestore(), FV = a.firestore.FieldValue;
    const b = body(req);
    const buyer = b.buyer || {}, delivery = b.delivery || {};
    const name = clip(buyer.name, 80), phone = L.digits(buyer.phone).slice(0, 15), barrio = clip(buyer.barrio, 80);
    if (name.length < 2) return send(res, 400, { error: 'Falta tu nombre.' });
    if (phone.length < 8) return send(res, 400, { error: 'Falta tu WhatsApp.' });
    const raw = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
    const want = {}; raw.forEach((i) => { const id = clip(i && i.id, 40), q = Math.floor(Number(i && i.q)); if (id && q > 0 && q <= 999) want[id] = (want[id] || 0) + q; });
    const ids = Object.keys(want);
    if (!ids.length) return send(res, 400, { error: 'El pedido está vacío.' });
    // usuario con cuenta (opcional)
    let uid = null;
    const m = String(req.headers.authorization || '').match(/^Bearer (.+)$/);
    if (m) { try { uid = (await a.auth().verifyIdToken(m[1])).uid; } catch (e) { uid = null; } }
    const refs = ids.map((id) => db.collection('products').doc(id));
    const [siteSnap, ...prodSnaps] = await db.getAll(db.collection('site').doc('main'), ...refs);
    const site = siteSnap.exists ? siteSnap.data() : {};
    const items = [], problems = [];
    prodSnaps.forEach((s, k) => {
      if (!s.exists) { problems.push('Un producto ya no está en el catálogo.'); return; }
      const p = s.data(), q = want[ids[k]];
      if (p.stock === 'out') { problems.push(p.name + ' se quedó sin stock.'); return; }
      if (p.stock !== 'order' && L.tracked(p) && q > Number(p.qty)) { problems.push('De ' + p.name + ' quedan ' + Number(p.qty) + '.'); return; }
      items.push({ id: s.id, name: clip(p.name, 120), sku: clip(p.sku, 30), q, price: L.priceOf(p), cat: clip(p.cat, 60), sub: clip(p.sub, 60) });
    });
    if (problems.length) return send(res, 409, { error: problems.join(' '), problems });
    const total = items.reduce((t, i) => t + i.q * i.price, 0);
    const minOrder = Number((site.settings || {}).minOrder) || 0;
    if (total < minOrder) return send(res, 400, { error: 'El pedido mínimo es de $' + minOrder.toLocaleString('es-AR') + '.' });
    // envío y beneficio por nivel
    const ship = Object.assign({ enabled: false, zones: [] }, site.shipping || {});
    let dl = { mode: 'retiro' }, shipping = 0;
    if (delivery.mode === 'envio' && ship.enabled) {
      const z = (ship.zones || []).find((x) => x.name === delivery.zone);
      if (!z) return send(res, 400, { error: 'Elegí una zona de envío válida.' });
      const addr = clip(delivery.address, 160);
      if (addr.length < 5) return send(res, 400, { error: 'Falta la dirección de entrega.' });
      shipping = Number(z.cost) || 0;
      dl = { mode: 'envio', zone: clip(z.name, 60), address: addr, cost: shipping, eta: clip(z.eta, 60) };
      if (uid && L.tiersCfg(site).enabled) {
        const cs = await db.collection('customers').doc(uid).get();
        const lv = cs.exists && cs.data().tier ? L.levelByName(site, cs.data().tier.level) : null;
        const off = lv ? Math.min(100, Math.max(0, Number(lv.shipOff) || 0)) : 0;
        if (off) { dl.base = shipping; dl.benefit = 'Nivel ' + lv.name; shipping = Math.round((shipping * (100 - off)) / 100); dl.cost = shipping; }
      }
    }
    // vendedor (solo si el código existe y está activo)
    let ref = String(b.ref || '').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (ref) { const cs = await db.collection('codes').doc(ref).get(); if (!cs.exists || cs.data().active === false) ref = ''; }
    const oref = db.collection('orders').doc();
    const code = oref.id.slice(0, 5).toUpperCase();
    const order = { code, name, barrio, phone, items, total, shipping, grand: total + shipping, delivery: dl, status: 'nuevo', verified: true, createdAt: FV.serverTimestamp() };
    if (ref) order.ref = ref;
    if (uid) order.uid = uid;
    const day = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
    const batch = db.batch();
    batch.set(oref, order);
    const inc = {}; items.forEach((i) => { inc['items.' + i.id] = FV.increment(i.q); });
    batch.set(db.collection('aggr').doc('day-' + day), { day, orders: FV.increment(1) }, { merge: true });
    batch.update(db.collection('aggr').doc('day-' + day), inc);
    await batch.commit();
    // más vendidos de los últimos 14 días (para la web)
    try {
      const days = []; for (let k = 0; k < 14; k++) days.push(db.collection('aggr').doc('day-' + new Date(Date.now() - 3 * 3600e3 - k * 864e5).toISOString().slice(0, 10).replace(/-/g, '')));
      const ds = await db.getAll(...days), tally = {};
      ds.forEach((d) => { if (d.exists) Object.entries(d.data().items || {}).forEach(([k, v]) => { tally[k] = (tally[k] || 0) + (Number(v) || 0); }); });
      const top = Object.keys(tally).sort((x, y) => tally[y] - tally[x]).slice(0, 8);
      await db.collection('site').doc('counters').set({ top, topAt: Date.now() }, { merge: true });
    } catch (e) { /* los más vendidos no frenan el pedido */ }
    return send(res, 200, { id: oref.id, code, items, total, shipping, grand: total + shipping, delivery: dl, ref: ref || null });
  } catch (e) {
    return send(res, 500, { error: 'No se pudo registrar el pedido. Probá de nuevo.', detail: e.message });
  }
};
