  /* ================= vendedores: asignación y comisiones ================= */
  var VIA = { link: 'por su link o código', cliente: 'cliente asignado', manual: 'asignado a mano' };
  function sellerName(code) { var s = sellersMap[code]; return s ? s.name : code; }
  function sellerLink(code, vender) { return location.origin + '/?v=' + code + (vender ? '#vender' : ''); }
  function activeSeller(code) { var s = sellersMap[code]; return !!(s && s.active !== false); }
  function overrideFor(code) {
    var s = sellersMap[code];
    if (!s || !s.recruitedBy || !activeSeller(s.recruitedBy) || !(Number(comm().override) > 0)) return null;
    return (Date.now() - (Number(s.since) || 0)) <= monthsMs(comm().overrideMonths) ? s.recruitedBy : null;
  }
  function suggestAssign(o) {
    if (o.sellerCode) return { code: o.sellerCode, via: o.assignVia || 'manual' };
    var ph = digits(o.phone), c = ph && clientsMap ? clientsMap[ph] : null;
    if (c && c.seller && activeSeller(c.seller) && (Date.now() - (Number(c.last) || 0)) <= monthsMs(comm().clientMonths)) return { code: c.seller, via: 'cliente', suggested: true };
    var r = cleanCode(o.ref);
    if (r && activeSeller(r)) return { code: r, via: 'link', suggested: true };
    return null;
  }
  function calcCommission(o, code, ovCode) {
    var base = 0, amt = 0;
    (o.items || []).forEach(function (i) {
      var sub = (Number(i.q) || 0) * (Number(i.price) || 0);
      var catName = i.cat || (prodById(i.id) || {}).cat || '';
      base += sub; amt += sub * rateFor(catName) / 100;
    });
    var res = { base: Math.round(base), at: Date.now(), seller: { code: code, amount: Math.round(amt) } };
    if (ovCode) res.override = { code: ovCode, amount: Math.round(base * (Number(comm().override) || 0) / 100) };
    return res;
  }
  function isPaid(c) { return !!(c && ((c.seller && c.seller.payoutId) || (c.override && c.override.payoutId))); }
  function touchClient(o, force) {
    var ph = digits(o.phone); if (!ph || !o.sellerCode || !fb) return;
    var cur = (clientsMap || {})[ph];
    var keep = cur && cur.seller && cur.seller !== o.sellerCode && activeSeller(cur.seller) && (Date.now() - (Number(cur.last) || 0)) <= monthsMs(comm().clientMonths);
    var d = { seller: keep && !force ? cur.seller : o.sellerCode, last: Date.now(), name: String(o.name || '').slice(0, 80) };
    if (!cur || d.seller !== cur.seller) d.since = Date.now();
    fb.db.collection('clients').doc(ph).set(d, { merge: true }).then(function () {
      clientsMap = clientsMap || {}; clientsMap[ph] = Object.assign({}, cur || {}, d);
    }).catch(function () {});
  }
