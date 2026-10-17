// Reglas de negocio compartidas por las funciones del servidor.
// Son las mismas que usa el panel: precios, ofertas, comisiones, stock, puntos y niveles.
const DAY = 864e5;
const COMM_DEFAULT = { base: 10, byCat: {}, override: 2, overrideMonths: 6, clientMonths: 6 };
const monthsMs = (m) => (Number(m) || 0) * 30 * DAY;
const digits = (s) => String(s || '').replace(/\D/g, '');
function todayAR() {
  // fecha de hoy en Buenos Aires (UTC-3), formato YYYY-MM-DD
  const d = new Date(Date.now() - 3 * 3600e3);
  return d.toISOString().slice(0, 10);
}
const onOffer = (p) => Number(p.offer) > 0 && Number(p.offer) < Number(p.price) && !!p.offerUntil && p.offerUntil >= todayAR();
const priceOf = (p) => (onOffer(p) ? Number(p.offer) : Number(p.price) || 0);
const tracked = (p) => p && p.qty !== undefined && p.qty !== null && p.qty !== '' && !isNaN(Number(p.qty));
function deriveStock(p) {
  if (p.stock === 'order') return 'order';
  if (!tracked(p)) return p.stock || 'ok';
  const q = Number(p.qty), m = Number(p.minQty) || 0;
  return q <= 0 ? 'out' : m && q <= m ? 'low' : 'ok';
}
const comm = (site) => Object.assign({}, COMM_DEFAULT, (site && site.commissions) || {});
function rateFor(site, cat) { const c = comm(site), v = (c.byCat || {})[cat]; return v === undefined || v === '' || v === null ? Number(c.base) || 0 : Number(v); }
function calcCommission(site, order, code, ovCode) {
  let base = 0, amt = 0;
  (order.items || []).forEach((i) => { const sub = (Number(i.q) || 0) * (Number(i.price) || 0); base += sub; amt += (sub * rateFor(site, i.cat || '')) / 100; });
  const res = { base: Math.round(base), at: Date.now(), seller: { code, amount: Math.round(amt) } };
  if (ovCode) res.override = { code: ovCode, amount: Math.round((base * (Number(comm(site).override) || 0)) / 100) };
  return res;
}
const isPaid = (c) => !!(c && ((c.seller && c.seller.payoutId) || (c.override && c.override.payoutId)));
const activeSeller = (s) => !!(s && s.active !== false);
function monthKey(t) { const d = new Date((t || Date.now()) - 3 * 3600e3); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); }
const loyal = (site) => Object.assign({ enabled: false, per: 1000, rewards: [], raffle: {} }, (site && site.loyalty) || {});
const tiersCfg = (site) => Object.assign({ enabled: false, days: 90, levels: [] }, (site && site.tiers) || {});
const levelsSorted = (site) => (tiersCfg(site).levels || []).slice().sort((a, b) => Number(a.min) - Number(b.min));
function tierFor(site, amount) { let cur = null; levelsSorted(site).forEach((l) => { if ((Number(amount) || 0) >= Number(l.min)) cur = l; }); return cur || levelsSorted(site)[0] || null; }
const levelByName = (site, n) => levelsSorted(site).find((l) => l.name === n) || null;
function ptsFor(site, order, clientDoc) {
  const L = loyal(site); if (!L.enabled || !(Number(L.per) > 0)) return 0;
  const lv = tiersCfg(site).enabled && clientDoc && clientDoc.tier ? levelByName(site, clientDoc.tier.level) : null;
  return Math.floor(((Number(order.total) || 0) / Number(L.per)) * (lv && Number(lv.ptsMult) > 1 ? Number(lv.ptsMult) : 1));
}
module.exports = { DAY, monthsMs, digits, todayAR, onOffer, priceOf, tracked, deriveStock, comm, rateFor, calcCommission, isPaid, activeSeller, monthKey, loyal, tiersCfg, tierFor, levelByName, ptsFor };
