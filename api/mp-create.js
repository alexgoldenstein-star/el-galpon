// Crea el link de pago de Mercado Pago (Checkout Pro) para un pedido.
// Lo usa el cliente (botón "Pagar") y el equipo ("Mandar link de pago").
const { getAdmin, hasMP, staffFromReq, body, send, siteUrl, mp, payCfg, payAmount } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  if (!hasMP()) return send(res, 503, { error: 'Mercado Pago no está configurado' });
  try {
    const { orderId, force } = body(req);
    if (!orderId || !/^[A-Za-z0-9]{10,40}$/.test(String(orderId))) return send(res, 400, { error: 'Pedido inválido' });
    const db = getAdmin().firestore();
    const ref = db.collection('orders').doc(String(orderId));
    const [snap, siteSnap] = await Promise.all([ref.get(), db.collection('site').doc('main').get()]);
    if (!snap.exists) return send(res, 404, { error: 'No existe el pedido' });
    const o = snap.data(), site = siteSnap.exists ? siteSnap.data() : {}, P = payCfg(site);
    const staff = req.headers.authorization ? await staffFromReq(req) : null;
    if (!P.enabled && !staff) return send(res, 400, { error: 'Los pagos online están apagados' });
    if (o.payment && o.payment.status === 'aprobado') return send(res, 400, { error: 'Este pedido ya está pagado' });
    if (o.status === 'cancelado') return send(res, 400, { error: 'El pedido está cancelado' });
    if (!staff && P.when !== 'siempre' && !['confirmado', 'listo'].includes(o.status)) return send(res, 400, { error: 'Podés pagar cuando confirmemos el pedido' });
    const amount = payAmount(o, P);
    if (!(amount > 0)) return send(res, 400, { error: 'Monto inválido' });
    if (o.payment && o.payment.status === 'pendiente' && o.payment.link && o.payment.amount === amount && !(force && staff)) return send(res, 200, { url: o.payment.link, amount });
    const site0 = siteUrl(req), brand = (site.brand && site.brand.name) || 'El Galpón';
    const pref = await mp('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: orderId, title: `Pedido #${o.code || ''} · ${brand}` + (P.mode === 'sena' ? ' (seña)' : ''), quantity: 1, unit_price: amount, currency_id: 'ARS' }],
        payer: { name: String(o.name || '').slice(0, 60) },
        external_reference: String(orderId),
        notification_url: site0 + '/api/mp-webhook',
        back_urls: { success: site0 + '/#cuenta', pending: site0 + '/#cuenta', failure: site0 + '/#cuenta' },
        auto_return: 'approved',
        statement_descriptor: brand.normalize('NFD').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, 13),
        metadata: { order_code: o.code || '' }
      })
    });
    const url = pref.init_point || pref.sandbox_init_point;
    await ref.update({ payment: { status: 'pendiente', amount, mode: P.mode, prefId: pref.id || '', link: url, createdAt: Date.now() } });
    return send(res, 200, { url, amount });
  } catch (e) {
    return send(res, 502, { error: e.message });
  }
};
