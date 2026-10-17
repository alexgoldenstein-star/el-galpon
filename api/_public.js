// Lectura pública de Firestore por REST (productos y datos del negocio ya son públicos).
// No necesita la cuenta de servicio: sirve para las páginas que lee Google y las vistas previas de WhatsApp.
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'el-galpon-b3cac';
const BASE = process.env.FIRESTORE_REST_BASE || `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
function val(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) return obj(v.mapValue.fields || {});
  return null;
}
function obj(fields) { const o = {}; Object.keys(fields || {}).forEach((k) => { o[k] = val(fields[k]); }); return o; }
async function getDoc(path) {
  const r = await fetch(`${BASE}/${path}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore ' + r.status);
  const j = await r.json();
  return Object.assign({ id: j.name.split('/').pop() }, obj(j.fields));
}
async function listProducts() {
  const out = []; let token = '';
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${BASE}/products?pageSize=300${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
    if (!r.ok) throw new Error('Firestore ' + r.status);
    const j = await r.json();
    (j.documents || []).forEach((d) => out.push(Object.assign({ id: d.name.split('/').pop() }, obj(d.fields))));
    if (!j.nextPageToken) break; token = j.nextPageToken;
  }
  return out;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
module.exports = { getDoc, listProducts, esc, slug };
