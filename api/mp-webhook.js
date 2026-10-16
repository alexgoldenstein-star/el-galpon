// Mercado Pago avisa acá cada novedad de un pago; consultamos el pago y actualizamos el pedido.
const { getAdmin, hasMP, body, send, mp, mpSignatureOk } = require('./_lib');
const MAP = { approved: 'aprobado', authorized: 'pendiente', pending: 'pendiente', in_process: 'pendiente', in_mediation: 'pendiente', rejected: 'rechazado', cancelled: 'rechazado', refunded: 'devuelto', charged_back: 'devuelto' };
module.exports = async (req, res) => {
  if (!hasMP()) return send(res, 200, { ok: true });
  try {
    const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    const b = body(req);
    const type = q.type || q.topic || b.type || b.topic;
    const id = q['data.id'] || q.id || (b.data && b.data.id);
    if (type !== 'payment' || !id) return send(res, 200, { ok: true, ignored: true });
    if (!mpSignatureOk(req, id)) return send(res, 401, { error: 'Firma inválida' });
    const p = await mp('/v1/payments/' + encodeURIComponent(id), { method: 'GET' });
    const orderId = p.external_reference;
    if (!orderId) return send(res, 200, { ok: true, ignored: true });
    const ref = getAdmin().firestore().collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) return send(res, 200, { ok: true, ignored: true });
    const cur = snap.data().payment || {};
    const st = MAP[p.status] || 'pendiente';
    if (cur.status === 'aprobado' && st !== 'devuelto' && String(cur.paymentId) !== String(p.id)) return send(res, 200, { ok: true, kept: true });
    await ref.update({ payment: Object.assign({}, cur, { status: st, amount: Number(p.transaction_amount) || cur.amount || 0, paymentId: String(p.id), method: p.payment_method_id || 'mercadopago', detail: p.status_detail || '', at: Date.now() }) });
    return send(res, 200, { ok: true, status: st });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
};
