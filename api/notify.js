// Aviso automático al cliente cuando cambia el estado de su pedido. Solo dueño y equipo.
const { getAdmin, hasWA, staffFromReq, body, send, money } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  if (!hasWA()) return send(res, 503, { error: 'WhatsApp no está configurado' });
  try {
    const staff = await staffFromReq(req);
    if (!staff) return send(res, 401, { error: 'Sin permiso' });
    const { orderId } = body(req);
    if (!orderId) return send(res, 400, { error: 'Falta el pedido' });
    const db = getAdmin().firestore();
    const ref = db.collection('orders').doc(String(orderId));
    const [snap, siteSnap] = await Promise.all([ref.get(), db.collection('site').doc('main').get()]);
    if (!snap.exists) return send(res, 404, { error: 'No existe el pedido' });
    const o = snap.data(), site = siteSnap.exists ? siteSnap.data() : {};
    if (!o.phone) return send(res, 400, { error: 'El pedido no tiene WhatsApp' });
    if (o.status === 'nuevo') return send(res, 400, { error: 'El pedido todavía no cambió de estado' });
    const envio = o.delivery && o.delivery.mode === 'envio';
    const c = site.contact || {};
    const ST = { confirmado: 'confirmado', listo: envio ? 'listo para enviar' : 'listo para retirar', entregado: 'entregado', cancelado: 'cancelado' };
    const EXTRA = {
      confirmado: 'Total a pagar: ' + money(o.grand != null ? o.grand : o.total) + '.' + (site.payments && site.payments.enabled ? ' Podés pagarlo desde Mi cuenta en la web.' : ''),
      listo: envio ? 'Sale a ' + (o.delivery.zone || 'tu zona') + (o.delivery.eta ? ' (' + o.delivery.eta + ')' : '') + '.' : 'Te esperamos' + (c.address ? ' en ' + c.address : ' en el depósito') + (c.hours ? ', ' + c.hours : '') + '.',
      entregado: '¡Gracias por tu compra!' + (o.points ? ' Sumaste ' + o.points + ' puntos.' : ''),
      cancelado: 'Si tenés dudas, respondé este mensaje.'
    };
    if (!ST[o.status]) return send(res, 400, { error: 'Estado sin aviso' });
    const first = String(o.name || '').trim().split(/\s+/)[0] || 'hola';
    await require('./_lib').waSend(o.phone, process.env.WA_TPL_STATUS || 'pedido_estado', [first, o.code || orderId.slice(0, 5).toUpperCase(), ST[o.status], EXTRA[o.status]]);
    await ref.update({ ['notified.' + o.status]: Date.now() });
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 502, { error: e.message });
  }
};
