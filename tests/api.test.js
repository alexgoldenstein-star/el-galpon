// Pruebas de las funciones del servidor contra los emuladores de Firebase y servidores falsos de WhatsApp y Mercado Pago.
// Corre con:  npm run test:api
process.env.GCLOUD_PROJECT = 'demo-galpon';
Object.assign(process.env, { WA_TOKEN: 't', WA_PHONE_ID: '123', WA_ADMIN_PHONE: '1150516254', MP_ACCESS_TOKEN: 'APP_USR-x', SITE_URL: 'https://el-galpon.test',
  WA_API_BASE: 'http://127.0.0.1:8899/wa', MP_API_BASE: 'http://127.0.0.1:8899/mp', MP_WEBHOOK_SECRET: 'sekret' });
const http = require('http'), crypto = require('crypto'), path = require('path');
const API = path.join(__dirname, '..', 'api') + '/';
let fails = 0, oks = 0;
const check = (name, cond, extra) => { if (cond) { oks++; console.log('OK  ' + name); } else { fails++; console.log('BAD ' + name + (extra ? ' ' + JSON.stringify(extra).slice(0, 200) : '')); } };
const calls = [];
const payments = { 555: { id: 555, status: 'approved', transaction_amount: 4350, external_reference: '', payment_method_id: 'account_money' } };
const fake = http.createServer((req, res) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
  calls.push([req.method, req.url, b ? JSON.parse(b) : null]); res.setHeader('Content-Type', 'application/json');
  if (req.url.startsWith('/wa/')) return res.end(JSON.stringify({ messages: [{ id: 'wamid.1' }] }));
  if (req.url === '/mp/checkout/preferences') return res.end(JSON.stringify({ id: 'pref1', init_point: 'https://mp.test/pay/pref1' }));
  const m = req.url.match(/^\/mp\/v1\/payments\/(\d+)/); if (m) return res.end(JSON.stringify(payments[m[1]]));
  res.statusCode = 404; res.end('{}'); }); });
let ipn = 0;
function call(name, { method = 'POST', body = {}, headers = {}, query = {} } = {}) {
  return new Promise((resolve) => { const req = { method, body, headers: Object.assign({ 'x-forwarded-for': '10.0.0.' + (ipn % 250) }, headers), query, url: '/api/' + name };
    const res = { statusCode: 200, setHeader() {}, end(s) { resolve({ code: this.statusCode, json: JSON.parse(s || '{}') }); } }; require(API + name + '.js')(req, res); });
}
(async () => {
  await new Promise((r) => fake.listen(8899, r));
  const admin = require('firebase-admin'); admin.initializeApp({ projectId: 'demo-galpon' }); const db = admin.firestore();
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  await db.doc('site/main').set({ brand: { name: 'El Galpón' }, contact: { address: 'Av. Siempreviva 742' }, settings: { minOrder: 10000 }, commissions: { base: 10, byCat: { 'Tecnología': 5 }, override: 2, overrideMonths: 6, clientMonths: 6 },
    shipping: { enabled: true, zones: [{ name: 'La Matanza', cost: 3500, eta: '48 hs' }] }, loyalty: { enabled: true, per: 1000 }, payments: { enabled: true, mode: 'sena', pct: 30, when: 'confirmado' },
    tiers: { enabled: true, days: 90, levels: [{ name: 'Bronce', min: 0, shipOff: 0, ptsMult: 1 }, { name: 'Plata', min: 50000, shipOff: 50, ptsMult: 1.5 }] } });
  await db.doc('products/p1').set({ name: 'Sábanas', sku: 'SAB', cat: 'Blanquería', sub: 'Sábanas', price: 14500, sug: 22000, stock: 'ok', qty: 10, minQty: 4 });
  await db.doc('products/p2').set({ name: 'Auriculares', cat: 'Tecnología', price: 8000, sug: 14000, stock: 'ok', offer: 6500, offerUntil: tomorrow });
  await db.doc('products/p3').set({ name: 'Agotado', cat: 'Bazar', price: 1000, stock: 'out' });
  await db.doc('codes/JORGE').set({ name: 'Jorge', active: true });
  await db.doc('sellers/MARTA').set({ name: 'Marta', active: true, since: Date.now() - 40 * 864e5 });
  await db.doc('sellers/JORGE').set({ name: 'Jorge', active: true, recruitedBy: 'MARTA', since: Date.now() - 10 * 864e5 });
  await db.doc('customers/rosa').set({ name: 'Rosa', phone: '1199998888', tier: { level: 'Plata', amount: 60000 } });
  const au = admin.auth();
  await au.createUser({ uid: 'rosa', email: 'rosa@test.com', password: 'secreto1', emailVerified: true });
  await au.createUser({ email: 'alexgoldenstein@hotmail.com', password: 'secreto1', emailVerified: true });
  const tok = async (e) => (await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: 'secreto1', returnSecureToken: true }) })).json()).idToken;
  const RT = 'Bearer ' + (await tok('rosa@test.com')), OT = 'Bearer ' + (await tok('alexgoldenstein@hotmail.com'));
  const buyer = { name: 'Rosa Feriante', phone: '11 9999-8888', barrio: 'Laferrere' };

  // --- alta de pedidos
  let r = await call('order-create', { body: { items: [{ id: 'p1', q: 2, price: 1 }, { id: 'p2', q: 1 }], buyer, delivery: { mode: 'envio', zone: 'La Matanza', address: 'Calle 123' }, ref: 'JORGE' }, headers: { authorization: RT } });
  check('pedido con precio trucho: se usa el del catálogo y la oferta vigente', r.code === 200 && r.json.total === 35500, r.json);
  check('beneficio de nivel aplicado al envío', r.json.shipping === 1750 && r.json.delivery.benefit === 'Nivel Plata', r.json.delivery);
  const oid = r.json.id;
  check('sin stock rechazado', (await call('order-create', { body: { items: [{ id: 'p3', q: 1 }], buyer } })).code === 409);
  check('más unidades de las que hay rechazado', (await call('order-create', { body: { items: [{ id: 'p1', q: 11 }], buyer } })).code === 409);
  check('pedido mínimo', (await call('order-create', { body: { items: [{ id: 'p2', q: 1 }], buyer } })).code === 400);
  check('zona inválida', (await call('order-create', { body: { items: [{ id: 'p1', q: 1 }], buyer, delivery: { mode: 'envio', zone: 'Marte', address: 'x 123' } } })).code === 400);
  r = await call('order-create', { body: { items: [{ id: 'p1', q: 1 }], buyer, ref: 'NOEXISTE' } });
  check('código de vendedor inexistente se descarta', r.code === 200 && r.json.ref === null);
  let last; for (let i = 0; i < 8; i++) last = await call('order-create', { body: { items: [{ id: 'p1', q: 1 }], buyer } });
  check('límite de pedidos por IP', last.code === 429, last);
  ipn++;
  const stored = (await db.doc('orders/' + oid).get()).data();
  check('pedido guardado como verificado con uid y vendedor', stored.verified === true && stored.uid === 'rosa' && stored.ref === 'JORGE');

  // --- cambio de estado transaccional
  check('estado sin permiso', (await call('order-status', { body: { orderId: oid, status: 'confirmado' } })).code === 401);
  r = await call('order-status', { body: { orderId: oid, status: 'confirmado' }, headers: { authorization: OT } });
  check('confirmado asigna al vendedor del link', r.code === 200 && r.json.order.sellerCode === 'JORGE' && r.json.order.overrideCode === 'MARTA', r.json);
  r = await call('order-status', { body: { orderId: oid, status: 'entregado' }, headers: { authorization: OT } });
  const o = (await db.doc('orders/' + oid).get()).data();
  check('comisión por rubro y extra del que lo sumó', o.commission.seller.amount === 3225 && o.commission.override.amount === 710, o.commission);
  check('stock descontado', (await db.doc('products/p1').get()).data().qty === 8);
  const cli = (await db.doc('clients/1199998888').get()).data();
  check('puntos, mes y nivel del cliente', cli.points === 35 && cli.month.amount === 35500 && cli.tier.level === 'Bronce', cli);
  check('saldo copiado a la cuenta', (await db.doc('customers/rosa').get()).data().points === 35);
  const ctr = (await db.doc('site/counters').get()).data();
  check('números públicos actualizados', ctr.delivered === 1 && ctr.clients === 1 && ctr.places === 1 && ctr.top[0] === 'p1', ctr);
  await call('order-status', { body: { orderId: oid, status: 'listo' }, headers: { authorization: OT } });
  const o2 = (await db.doc('orders/' + oid).get()).data();
  check('volver atrás revierte comisión, stock y puntos', o2.commission === null && (await db.doc('products/p1').get()).data().qty === 10 && (await db.doc('clients/1199998888').get()).data().points === 0);
  const auditN = (await db.collection('audit').get()).size;
  check('historial registrado', auditN >= 3, auditN);

  // --- WhatsApp y Mercado Pago
  check('estado del servidor', (await call('status', { method: 'GET' })).json.mp === true);
  r = await call('mp-create', { body: { orderId: oid } });
  check('link de pago (seña 30%)', r.code === 200 && r.json.amount === Math.round(37250 * 0.3), r.json);
  payments[555].external_reference = oid;
  const ts = '1700000000', h = crypto.createHmac('sha256', 'sekret').update(`id:555;request-id:r1;ts:${ts};`).digest('hex');
  check('webhook con firma inválida rechazado', (await call('mp-webhook', { query: { type: 'payment', 'data.id': '555' }, headers: { 'x-signature': 'ts=1,v1=abc', 'x-request-id': 'r1' } })).code === 401);
  r = await call('mp-webhook', { query: { type: 'payment', 'data.id': '555' }, headers: { 'x-signature': `ts=${ts},v1=${h}`, 'x-request-id': 'r1' } });
  check('webhook marca el pago aprobado', r.json.status === 'aprobado' && (await db.doc('orders/' + oid).get()).data().payment.status === 'aprobado');
  r = await call('notify', { body: { orderId: oid }, headers: { authorization: OT } });
  check('aviso de estado por WhatsApp', r.code === 200 && calls.some((c) => c[1].startsWith('/wa/') && c[2].template.name === 'pedido_estado'), r.json);
  check('registro de errores agrupado', (await call('log', { body: { msg: 'TypeError: x', where: 'app.js:1' } })).code === 200 && (await call('log', { body: { msg: 'TypeError: x', where: 'app.js:1' } })).code === 200 &&
    (await db.collection('errors').get()).docs[0].data().count === 2);

  console.log(`\n${oks}/${oks + fails} pruebas del servidor OK`);
  fake.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
