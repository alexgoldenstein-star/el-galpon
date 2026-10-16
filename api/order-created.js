// Aviso al negocio de que entró un pedido nuevo (lo llama la web al enviar el pedido).
const { getAdmin, hasWA, body, send, money } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  if (!hasWA() || !process.env.WA_ADMIN_PHONE) return send(res, 200, { ok: true, skipped: true });
  try {
    const { orderId } = body(req);
    if (!orderId) return send(res, 400, { error: 'Falta el pedido' });
    const ref = getAdmin().firestore().collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) return send(res, 404, { error: 'No existe el pedido' });
    const o = snap.data();
    if (o.notified && o.notified.created) return send(res, 200, { ok: true, already: true });
    const created = o.createdAt && o.createdAt.toMillis ? o.createdAt.toMillis() : 0;
    if (!created || Date.now() - created > 15 * 60 * 1000) return send(res, 400, { error: 'Pedido viejo' });
    const where = o.delivery && o.delivery.mode === 'envio' ? 'envío a ' + (o.delivery.zone || '') : 'retira';
    await require('./_lib').waSend(process.env.WA_ADMIN_PHONE, process.env.WA_TPL_NEW || 'pedido_nuevo', [o.code || '', o.name || '', (o.barrio ? o.barrio + ', ' : '') + where, money(o.grand != null ? o.grand : o.total)]);
    await ref.update({ 'notified.created': Date.now() });
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 502, { error: e.message });
  }
};
