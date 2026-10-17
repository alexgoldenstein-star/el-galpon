// Registro de errores de la web: si algo falla en el celular de un cliente, queda anotado para el panel.
// Errores iguales se agrupan (se cuenta cuántas veces pasó) y hay un límite por IP para que no se llene.
const crypto = require('crypto');
const { getAdmin, hasAdmin, body, send, rateLimit } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  if (!hasAdmin()) return send(res, 200, { ok: true });
  try {
    if (!(await rateLimit(req, 'log', 30, 60 * 60e3))) return send(res, 200, { ok: true, limited: true });
    const b = body(req);
    const msg = String(b.msg || '').slice(0, 300), where = String(b.where || '').slice(0, 300);
    if (!msg) return send(res, 400, { error: 'Falta el mensaje' });
    const id = crypto.createHash('sha1').update(msg + '|' + where).digest('hex').slice(0, 24);
    const a = getAdmin(), FV = a.firestore.FieldValue;
    await a.firestore().collection('errors').doc(id).set({
      msg, where, stack: String(b.stack || '').slice(0, 1500), url: String(b.url || '').slice(0, 200), ua: String(req.headers['user-agent'] || '').slice(0, 200),
      v: String(b.v || '').slice(0, 20), user: String(b.user || '').slice(0, 40), last: Date.now(), count: FV.increment(1)
    }, { merge: true });
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 200, { ok: true });
  }
};
