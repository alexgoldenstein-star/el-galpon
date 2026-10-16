// Utilidades compartidas por las funciones del servidor (Vercel).
// Variables de entorno (Vercel → Settings → Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT  JSON de la cuenta de servicio de Firebase (obligatoria)
//   SITE_URL                  https://tu-dominio (opcional; si falta usa el dominio del pedido)
//   OWNER_EMAILS              mails de dueños separados por coma (opcional)
//   WA_TOKEN, WA_PHONE_ID     WhatsApp Cloud API (Meta)
//   WA_ADMIN_PHONE            WhatsApp donde te llegan los pedidos nuevos (opcional)
//   WA_TPL_STATUS, WA_TPL_NEW nombres de las plantillas (por defecto pedido_estado y pedido_nuevo)
//   WA_LANG                   idioma de las plantillas (por defecto es_AR)
//   MP_ACCESS_TOKEN           Mercado Pago (credenciales de producción)
//   MP_WEBHOOK_SECRET         clave secreta de las notificaciones de Mercado Pago (opcional, recomendada)
const admin = require('firebase-admin');
const crypto = require('crypto');

let ready = false;
function getAdmin() {
  if (!ready && admin.apps.length) ready = true;
  if (!ready) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
      const sa = JSON.parse(raw);
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
      admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
    } else if (process.env.FIRESTORE_EMULATOR_HOST) {
      admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-galpon' });
    } else {
      throw new Error('Falta configurar FIREBASE_SERVICE_ACCOUNT en Vercel');
    }
    ready = true;
  }
  return admin;
}
const hasAdmin = () => !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIRESTORE_EMULATOR_HOST);
const hasWA = () => !!(process.env.WA_TOKEN && process.env.WA_PHONE_ID) && hasAdmin();
const hasMP = () => !!process.env.MP_ACCESS_TOKEN && hasAdmin();

const OWNERS = (process.env.OWNER_EMAILS || 'alexgoldenstein@hotmail.com').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
async function staffFromReq(req) {
  const m = String(req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  const a = getAdmin();
  let t;
  try { t = await a.auth().verifyIdToken(m[1]); } catch (e) { return null; }
  if (!t.email_verified) return null;
  const em = String(t.email || '').toLowerCase();
  if (OWNERS.includes(em)) return { email: em, role: 'owner' };
  const d = await a.firestore().collection('team').doc(em).get();
  if (d.exists && ['admin', 'editor'].includes(d.data().role)) return { email: em, role: d.data().role };
  return null;
}
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function siteUrl(req) { return String(process.env.SITE_URL || ('https://' + req.headers.host)).replace(/\/$/, ''); }
const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
// WhatsApp de Argentina: 549 + código de área + número
function waPhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('549')) return d;
  if (d.startsWith('54')) return '549' + d.slice(2);
  if (d.length === 10) return '549' + d;
  return d;
}
const clean = (t) => String(t == null ? '' : t).replace(/[\n\r\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 900) || '-';
async function waSend(to, template, params) {
  const token = process.env.WA_TOKEN, phoneId = process.env.WA_PHONE_ID;
  if (!token || !phoneId) throw new Error('WhatsApp no configurado');
  const base = process.env.WA_API_BASE || 'https://graph.facebook.com/v20.0';
  const r = await fetch(`${base}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: waPhone(to), type: 'template',
      template: { name: template, language: { code: process.env.WA_LANG || 'es_AR' }, components: [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: clean(t) })) }] }
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || ('WhatsApp respondió ' + r.status));
  return j;
}
async function mp(path, opts) {
  const base = process.env.MP_API_BASE || 'https://api.mercadopago.com';
  const r = await fetch(base + path, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json' }, (opts && opts.headers) || {}) }));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || ('Mercado Pago respondió ' + r.status));
  return j;
}
function mpSignatureOk(req, dataId) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = String(req.headers['x-signature'] || ''), reqId = String(req.headers['x-request-id'] || '');
  const parts = Object.fromEntries(sig.split(',').map((p) => p.split('=').map((x) => x.trim())));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const manifest = `id:${id};request-id:${reqId};ts:${parts.ts};`;
  const h = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(parts.v1)); } catch (e) { return false; }
}
function payCfg(site) { return Object.assign({ enabled: false, mode: 'total', pct: 30, when: 'confirmado' }, (site && site.payments) || {}); }
function payAmount(o, P) { const g = Number(o.grand != null ? o.grand : o.total) || 0; return P.mode === 'sena' ? Math.round(g * (Number(P.pct) || 30) / 100) : g; }

module.exports = { getAdmin, hasAdmin, hasWA, hasMP, staffFromReq, body, send, siteUrl, money, waPhone, waSend, mp, mpSignatureOk, payCfg, payAmount };
