// Cambio de estado y asignación de vendedor, todo en una sola operación (transacción):
// comisión, stock, puntos, nivel, cliente asignado, números públicos e historial.
// O pasa todo junto, o no pasa nada.
const { getAdmin, hasAdmin, staffFromReq, body, send, audit } = require('./_lib');
const L = require('./_logic');
const STATUS = ['nuevo', 'confirmado', 'listo', 'entregado', 'cancelado'];
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  if (!hasAdmin()) return send(res, 503, { error: 'Servidor sin configurar' });
  try {
    const staff = await staffFromReq(req);
    if (!staff) return send(res, 401, { error: 'Sin permiso' });
    const a = getAdmin(), db = a.firestore(), FV = a.firestore.FieldValue;
    const { orderId, status, action, sellerCode } = body(req);
    if (!orderId) return send(res, 400, { error: 'Falta el pedido' });
    const oref = db.collection('orders').doc(String(orderId));
    const pre = await oref.get();
    if (!pre.exists) return send(res, 404, { error: 'No existe el pedido' });
    const ph = L.digits(pre.data().phone);
    // lecturas fuera de la transacción (consultas): pedidos del cliente y sus cuentas
    const [histSnap, custSnap] = ph ? await Promise.all([
      db.collection('orders').where('phone', '==', ph).limit(500).get(),
      db.collection('customers').where('phone', '==', ph).limit(3).get()
    ]) : [{ docs: [] }, { docs: [] }];
    const custIds = new Set(custSnap.docs.map((d) => d.id)); if (pre.data().uid) custIds.add(pre.data().uid);
    const result = await db.runTransaction(async (tx) => {
      const os = await tx.get(oref); const o = os.data();
      const siteRef = db.collection('site').doc('main'), cliRef = ph ? db.collection('clients').doc(ph) : null;
      const prodRefs = (o.items || []).map((i) => db.collection('products').doc(i.id));
      const reads = [siteRef, db.collection('aggr').doc('places')].concat(cliRef ? [cliRef] : [], prodRefs);
      const snaps = await tx.getAll(...reads);
      const site = snaps[0].exists ? snaps[0].data() : {}, placesDoc = snaps[1].exists ? snaps[1].data() : {};
      const cliSnap = cliRef ? snaps[2] : null, cli = cliSnap && cliSnap.exists ? cliSnap.data() : null;
      const prods = snaps.slice(cliRef ? 3 : 2);
      const C = L.comm(site), now = Date.now();
      const sellerDoc = async (code) => { if (!code) return null; const s = await tx.get(db.collection('sellers').doc(code)); return s.exists ? s.data() : null; };
      const overrideFor = async (code) => {
        const s = await sellerDoc(code); if (!s || !s.recruitedBy || !(Number(C.override) > 0)) return null;
        const r = await sellerDoc(s.recruitedBy); if (!L.activeSeller(r)) return null;
        return now - (Number(s.since) || 0) <= L.monthsMs(C.overrideMonths) ? s.recruitedBy : null;
      };
      const upd = {}, logs = [], prev = o.status;
      let next = prev;
      if (action === 'assign') {
        if (L.isPaid(o.commission)) throw new Error('Este pedido ya está liquidado. No se puede cambiar el vendedor.');
        const code = sellerCode ? String(sellerCode) : null;
        upd.sellerCode = code; upd.assignVia = code ? 'manual' : null; upd.overrideCode = code ? await overrideFor(code) : null;
        if (o.status === 'entregado') upd.commission = code ? L.calcCommission(site, o, code, upd.overrideCode) : null;
        logs.push({ action: 'asignar', detail: (o.sellerCode || 'sin vendedor') + ' → ' + (code || 'sin vendedor') });
      } else {
        if (!STATUS.includes(status)) throw new Error('Estado inválido');
        next = status;
        if (prev === next) return { order: Object.assign({ id: os.id }, o), msgs: [] };
        if (prev === 'entregado' && L.isPaid(o.commission)) throw new Error('Este pedido ya está liquidado al vendedor. No se puede cambiar el estado.');
        upd.status = next;
        if (next !== 'nuevo' && next !== 'cancelado' && !o.sellerCode) {
          // sugerencia: cliente ya asignado, si no el código con el que entró
          let code = null, via = null;
          if (cli && cli.seller && now - (Number(cli.last) || 0) <= L.monthsMs(C.clientMonths) && L.activeSeller(await sellerDoc(cli.seller))) { code = cli.seller; via = 'cliente'; }
          else if (o.ref && L.activeSeller(await sellerDoc(o.ref))) { code = o.ref; via = 'link'; }
          if (code) { upd.sellerCode = code; upd.assignVia = via; upd.overrideCode = await overrideFor(code); }
        }
        if (next === 'entregado') {
          upd.deliveredAt = now;
          const code = upd.sellerCode || o.sellerCode, ov = upd.overrideCode !== undefined ? upd.overrideCode : o.overrideCode || null;
          if (code && !L.isPaid(o.commission)) upd.commission = L.calcCommission(site, o, code, ov);
        } else if (prev === 'entregado') { upd.commission = null; upd.deliveredAt = null; }
        logs.push({ action: 'estado', detail: prev + ' → ' + next });
      }
      const msgs = [];
      const into = next === 'entregado' && prev !== 'entregado', outOf = prev === 'entregado' && next !== 'entregado';
      // stock
      if ((into && !o.stockDone) || (outOf && o.stockDone)) {
        const sign = into ? 1 : -1, low = [];
        prods.forEach((ps, k) => {
          if (!ps.exists) return; const p = ps.data(); if (!L.tracked(p)) return;
          const q = Number(o.items[k].q) || 0, nq = Math.max(0, Number(p.qty) - sign * q), st = L.deriveStock(Object.assign({}, p, { qty: nq }));
          tx.update(ps.ref, { qty: nq, stock: st });
          if (into && (st === 'out' || st === 'low')) low.push(p.name);
        });
        upd.stockDone = into;
        if (low.length) msgs.push('Para reponer: ' + low.join(', ') + '.');
      }
      // cliente: asignación, puntos, mes y nivel
      if (cliRef && (into || outOf || upd.sellerCode !== undefined)) {
        const cd = {};
        const sc = upd.sellerCode !== undefined ? upd.sellerCode : o.sellerCode;
        if (sc && next !== 'cancelado') {
          const keep = cli && cli.seller && cli.seller !== sc && action !== 'assign' && now - (Number(cli.last) || 0) <= L.monthsMs(C.clientMonths);
          cd.seller = keep ? cli.seller : sc; cd.last = now; if (!cli || cd.seller !== cli.seller) cd.since = now;
        }
        cd.name = String(o.name || '').slice(0, 80); cd.barrio = String(o.barrio || '').slice(0, 80);
        if (into && !(cli && cli.firstAt)) cd.firstAt = now; // primera compra entregada: cuenta como cliente en los números públicos
        let pts = 0;
        if (into && !o.points) pts = L.ptsFor(site, o, cli);
        if (outOf && o.points) pts = -Number(o.points);
        const mk = L.monthKey(into ? now : o.deliveredAt), amt = (into ? 1 : outOf ? -1 : 0) * (Number(o.total) || 0);
        if (amt) cd.month = cli && cli.month && cli.month.key === mk ? { key: mk, amount: Math.max(0, (Number(cli.month.amount) || 0) + amt) } : { key: mk, amount: Math.max(0, amt) };
        if (pts) { cd.points = FV.increment(pts); upd.points = into ? pts : 0; tx.set(db.collection('pointlog').doc(), { phone: ph, name: cd.name, pts, kind: into ? 'compra' : 'reverso', order: o.code || os.id, at: now }); if (into) msgs.push('Sumó ' + pts + ' puntos.'); }
        let tier = null;
        if ((into || outOf) && L.tiersCfg(site).enabled) {
          const cut = now - (Number(L.tiersCfg(site).days) || 90) * L.DAY;
          let sum = 0;
          histSnap.docs.forEach((d) => { const x = d.id === os.id ? Object.assign({}, d.data(), { status: next, deliveredAt: upd.deliveredAt }) : d.data(); if (x.status === 'entregado' && (Number(x.deliveredAt) || 0) >= cut) sum += Number(x.total) || 0; });
          const lv = L.tierFor(site, sum); tier = { amount: sum, level: lv ? lv.name : '', at: now };
          cd.tier = tier;
          if (cli && cli.tier && lv && cli.tier.level !== lv.name) msgs.push(String(o.name || '').split(' ')[0] + ' ahora es nivel ' + lv.name + '.');
        }
        tx.set(cliRef, cd, { merge: true });
        const newPts = (cli && Number(cli.points)) || 0;
        custIds.forEach((id) => { const c = {}; if (pts) c.points = newPts + pts; if (cd.month) c.month = cd.month; if (tier) c.tier = tier; if (Object.keys(c).length) tx.set(db.collection('customers').doc(id), c, { merge: true }); });
        // números públicos
        if (into || outOf) {
          const ctr = { delivered: FV.increment(into ? 1 : -1), at: now };
          if (into && !(cli && cli.firstAt)) ctr.clients = FV.increment(1);
          const bk = String(o.barrio || '').trim().toLowerCase().replace(/[.\/#$\[\]]/g, '').slice(0, 60);
          if (into && bk && !placesDoc[bk]) { tx.set(db.collection('aggr').doc('places'), { [bk]: true }, { merge: true }); ctr.places = Object.keys(placesDoc).length + 1; }
          tx.set(db.collection('site').doc('counters'), ctr, { merge: true });
        }
      }
      tx.update(oref, upd);
      return { order: Object.assign({ id: os.id }, o, upd, upd.points !== undefined ? { points: upd.points } : {}), msgs, logs, prev };
    });
    for (const l of result.logs || []) await audit(db, Object.assign({ by: staff.email, order: result.order.code || orderId, orderId }, l));
    const out = Object.assign({}, result.order); delete out.createdAt;
    return send(res, 200, { order: out, msg: (result.msgs || []).join(' ') });
  } catch (e) {
    return send(res, 400, { error: e.message });
  }
};
