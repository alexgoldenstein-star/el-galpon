  /* ================= utilidades ================= */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-AR'); }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function waLink(text) { return 'https://wa.me/' + digits(cfg.contact.whatsapp) + '?text=' + encodeURIComponent(text); }
  // Nuestro WhatsApp tal como se muestra (en banners, carteles y la web)
  function ourWa() {
    var d = cfg.contact.whatsappDisplay, w = cfg.contact.whatsapp;
    if (!w && !d) return '';
    return d && digits(d) !== digits(w) ? d : fmtPhone(w || d);
  }
  // Canal de difusión: el QR apunta siempre a nuestro sitio (?go=canal) y de ahí salta al canal.
  // Así el QR impreso sirve aunque cambie el link del canal, y el vendedor queda registrado.
  function hasChannel() { return /^https?:\/\//.test(String(cfg.contact.channel || '').trim()); }
  function canalLink(code) { return location.origin + '/?' + (code ? 'v=' + code + '&' : '') + 'go=canal'; }
  function canalMsg(code, name) {
    return 'Hola ' + cfg.brand.name + '! Quiero sumarme a la lista de difusión para recibir el catálogo y las ofertas.' +
      (code ? ' Vengo de parte de ' + (name ? name + ', ' : '') + 'código ' + code + '.' : '');
  }
  function canalTarget(code, name) { return hasChannel() ? String(cfg.contact.channel).trim() : waLink(canalMsg(code, name)); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function onOffer(p) { return Number(p.offer) > 0 && Number(p.offer) < Number(p.price) && !!p.offerUntil && p.offerUntil >= todayStr(); }
  function priceOf(p) { return onOffer(p) ? Number(p.offer) : (Number(p.price) || 0); }
  function gain(p) { return (Number(p.sug) || 0) - priceOf(p); }
  function ddmm(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; }
  function priceHtml(p) {
    return onOffer(p)
      ? '<span class="price num">' + money(priceOf(p)) + '</span><s class="old num">' + money(p.price) + '</s>'
      : '<span class="price num">' + money(p.price) + '</span>';
  }
  function imgOf(p) { return p.img || (cfg && cfg.images && cfg.images.depB) || ''; }
  function cleanSku(v) { return String(v || '').toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9._\-\/]/g, '').slice(0, 30); }
  function skuTaken(sku, id) { return !!sku && products.some(function (p) { return p.id !== id && cleanSku(p.sku) === sku; }); }
  // Stock con unidades: si el producto tiene "qty", el estado (hay/pocas/sin stock) se calcula solo.
  function tracked(p) { return p && p.qty !== undefined && p.qty !== null && p.qty !== '' && !isNaN(Number(p.qty)); }
  function deriveStock(p) {
    if (p.stock === 'order') return 'order';
    if (!tracked(p)) return p.stock || 'ok';
    var q = Number(p.qty), m = Number(p.minQty) || 0;
    return q <= 0 ? 'out' : (m && q <= m) ? 'low' : 'ok';
  }
  function prodById(id) { for (var i = 0; i < products.length; i++) if (products[i].id === id) return products[i]; return null; }
  function isStaff() { return role === 'owner' || role === 'admin' || role === 'editor'; }
  function isAdmin() { return role === 'owner' || role === 'admin'; }
  function isSeller() { return role === 'seller'; }
  var COMM_DEFAULT = { base: 10, byCat: { 'Tecnología': 5 }, override: 2, overrideMonths: 6, clientMonths: 6, payEvery: 'cada 15 días' };
  function comm() { return (cfg && cfg.commissions) || COMM_DEFAULT; }
  function monthsMs(m) { return (Number(m) || 0) * 30 * 864e5; }
  function rateFor(catName) {
    var c = comm(), r = c.byCat ? c.byCat[catName] : undefined;
    return (r === undefined || r === null || r === '') ? (Number(c.base) || 0) : (Number(r) || 0);
  }
  function shipOn() { return !!(cfg && cfg.shipping && cfg.shipping.enabled && (cfg.shipping.zones || []).length); }
  function effMode() { return shipOn() && buyer.mode === 'envio' ? 'envio' : 'retiro'; }
  function zoneByName(n) { return ((cfg.shipping && cfg.shipping.zones) || []).filter(function (z) { return z.name === n; })[0] || null; }
  function shipBase() { if (effMode() !== 'envio') return 0; var z = zoneByName(buyer.zone); return z ? Number(z.cost) || 0 : 0; }
  function shippingCost() { var b = shipBase(), off = shipOffPct(); return off ? Math.round(b * (100 - off) / 100) : b; }
  function rulesList() {
    var c = comm();
    var ex = Object.keys(c.byCat || {}).filter(function (k) { return c.byCat[k] !== '' && Number(c.byCat[k]) !== Number(c.base) && (cfg.categories || []).indexOf(k) !== -1; });
    var out = [
      'Cobrás ' + c.base + '% sobre lo que compran tus clientes' + (ex.length ? ' (' + ex.map(function (k) { return c.byCat[k] + '% en ' + k; }).join(', ') + ')' : '') + '.',
      'Tus clientes quedan asignados a vos por tu link o tu código, durante ' + c.clientMonths + ' meses desde su última compra.',
      'La comisión se calcula sobre pedidos entregados y cobrados. El costo de envío no suma comisión.'
    ];
    if (Number(c.override) > 0) out.push('Si sumás a otro vendedor, cobrás ' + c.override + '% extra sobre sus ventas durante sus primeros ' + c.overrideMonths + ' meses. Es un solo nivel: no cobrás por los que sume tu equipo.');
    out.push('Liquidamos ' + (c.payEvery || 'cada 15 días') + ', con el detalle de cada pedido.');
    return out;
  }
  function rulesHtml() { return '<ul class="rules">' + rulesList().map(function (r) { return '<li>' + ic('check', 18) + '<span>' + esc(r) + '</span></li>'; }).join('') + '</ul>'; }
  function bump(pid, field) {
    if (!fb || isStaff()) return;
    var k = 'galpon-st-' + field + '-' + pid;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) {}
    var d = {}; d[field] = window.firebase.firestore.FieldValue.increment(1);
    fb.db.collection('stats').doc(pid).set(d, { merge: true }).catch(function () {});
  }
  function persistCart() {
    try { sessionStorage.setItem('galpon-cart', JSON.stringify(cart)); localStorage.setItem('galpon-buyer', JSON.stringify(buyer)); } catch (e) {}
  }
  function cartLines() {
    var out = [];
    Object.keys(cart).forEach(function (id) { var p = prodById(id); if (p && cart[id] > 0) out.push({ p: p, q: cart[id] }); });
    return out;
  }
  function cartTotals() {
    var t = { count: 0, total: 0, gain: 0 };
    cartLines().forEach(function (l) { t.count += l.q; t.total += l.q * priceOf(l.p); t.gain += l.q * gain(l.p); });
    return t;
  }
  function mapsUrl() {
    if (cfg.contact.mapsUrl) return cfg.contact.mapsUrl;
    var a = [cfg.contact.address, cfg.contact.area].filter(Boolean).join(', ');
    return a ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a) : '';
  }
  var toastTimer = null;
  function showToast(m) {
    var el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = m; el.hidden = !m;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 4500);
  }
  function setToast(m, noRender) { if (!noRender) render(true); showToast(m); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var IC = {
    house: '<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9 20v-6h6v6"/>',
    bag: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bus: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l1.5-4M16 21l-1.5-4"/>',
    wa: '<path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M9 9.5c.3 2 2.3 4.2 4.5 4.8l1.2-1.2 1.8.8"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.7-4.9-4-5.7"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
    megaphone: '<path d="M3 10v4h3l7 4V6L6 10H3Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>'
  };
  function ic(name, size) {
    var s = size || 22;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[name] + '</svg>';
  }
  function ph(v, placeholder) { return (v && String(v).trim()) ? esc(v) : '<span class="ph">' + esc(placeholder) + '</span>'; }

