  /* ================= subrubros ================= */
  var SUGGESTED_TREE = [
    ['Bazar', ['Tappers y herméticos', 'Vasos y jarras', 'Platos y bowls', 'Cubiertos y utensilios', 'Tablas de cortar', 'Frascos y especieros', 'Ollas y sartenes', 'Termos y mates', 'Descartables']],
    ['Hogar', ['Limpieza', 'Organización y orden', 'Baño', 'Decoración', 'Iluminación', 'Plantas y jardín', 'Ferretería liviana']],
    ['Tecnología', ['Cargadores y cables', 'Auriculares', 'Parlantes', 'Accesorios para celular', 'Luces LED', 'Pilas y linternas', 'Relojes y smartwatch']],
    ['Marroquinería', ['Billeteras', 'Mochilas', 'Riñoneras', 'Bolsos y carteras', 'Cinturones', 'Valijas y bolsos de viaje', 'Neceseres']],
    ['Blanquería', ['Sábanas', 'Toallas y toallones', 'Acolchados y frazadas', 'Almohadas', 'Manteles y repasadores', 'Cortinas', 'Alfombras']]
  ];
  // nombres viejos (rubros sueltos) → rubro y subrubro nuevos
  var LEGACY_MAP = { 'tappers': ['Bazar', 'Tappers y herméticos'], 'vasos plasticos': ['Bazar', 'Vasos y jarras'], 'vasos de vidrio': ['Bazar', 'Vasos y jarras'], 'vasos termicos': ['Bazar', 'Vasos y jarras'],
    'tablas de cortar': ['Bazar', 'Tablas de cortar'], 'frascos de vidrio': ['Bazar', 'Frascos y especieros'], 'cocina': ['Bazar', 'Ollas y sartenes'], 'tecno economica': ['Tecnología', ''], 'tecnologia': ['Tecnología', ''],
    'blanqueria': ['Blanquería', ''], 'bazar': ['Bazar', ''], 'hogar': ['Hogar', ''], 'marroquineria': ['Marroquinería', ''], 'termos y mates': ['Bazar', 'Termos y mates'] };
  var sub = '';
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function subsOf(c) { return ((cfg && cfg.subcats) || {})[c] || []; }
  function sortBySub(list, c) { var S = subsOf(c); return list.slice().sort(function (a, b) { var ia = S.indexOf(a.sub), ib = S.indexOf(b.sub); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); }); }
  function catLabel(p) { return esc(p.cat || '') + (p.sub ? ' · ' + esc(p.sub) : ''); }
  // busca un rubro o subrubro por nombre (para Excel y migración)
  function resolveCat(name) {
    var n = norm(name); if (!n) return null;
    var mains = cfg.categories || [];
    for (var i = 0; i < mains.length; i++) if (norm(mains[i]) === n) return [mains[i], ''];
    for (var j = 0; j < mains.length; j++) { var S = subsOf(mains[j]); for (var k = 0; k < S.length; k++) if (norm(S[k]) === n) return [mains[j], S[k]]; }
    return null;
  }
  // Guarda subrubros de un rubro (y renombra o mueve productos si hace falta)
  function saveSubs(mainName, nextSubs, remapSub, done) {
    var sc = clone(cfg.subcats || {}); sc[mainName] = nextSubs;
    var touched = products.filter(function (p) { return p.cat === mainName && remapSub && remapSub[p.sub] !== undefined; });
    var b = fb.db.batch();
    b.update(fb.db.collection('site').doc('main'), { subcats: sc });
    touched.slice(0, 450).forEach(function (p) { b.update(fb.db.collection('products').doc(p.id), { sub: remapSub[p.sub] }); });
    if (catMgr) catMgr.busy = true; render(true);
    b.commit().then(function () {
      touched.forEach(function (p) { p.sub = remapSub[p.sub]; });
      cfg.subcats = sc; if (cfgDraft) cfgDraft.subcats = clone(sc);
      if (catMgr) { catMgr.busy = false; catMgr.subEdit = null; }
      if (done) done(); render(true);
    }).catch(function () { if (catMgr) catMgr.busy = false; setToast('No se pudo guardar el subrubro.'); });
  }
  // Pasa a la estructura sugerida: 5 rubros con sus subrubros, y reubica los productos existentes
  function applySuggestedTree() {
    var mains = SUGGESTED_TREE.map(function (t) { return t[0]; }), sc = {};
    SUGGESTED_TREE.forEach(function (t) { sc[t[0]] = t[1].slice(); });
    var keep = (cfg.categories || []).filter(function (c) { return !LEGACY_MAP[norm(c)] && mains.indexOf(c) === -1; });
    mains = mains.concat(keep); keep.forEach(function (c) { sc[c] = subsOf(c); });
    var moves = [];
    products.forEach(function (p) {
      var m = LEGACY_MAP[norm(p.cat)];
      if (m && (p.cat !== m[0] || (m[1] && p.sub !== m[1]))) moves.push([p, m[0], m[1] || p.sub || '']);
    });
    var byCat = clone((cfg.commissions && cfg.commissions.byCat) || {}), nb = {};
    Object.keys(byCat).forEach(function (k) { var m = LEGACY_MAP[norm(k)], to = m ? m[0] : k; if (mains.indexOf(to) !== -1 && nb[to] === undefined) nb[to] = byCat[k]; });
    var ops = [function (b) { b.update(fb.db.collection('site').doc('main'), { categories: mains, subcats: sc, 'commissions.byCat': nb }); }];
    moves.forEach(function (x) { ops.push(function (b) { b.update(fb.db.collection('products').doc(x[0].id), { cat: x[1], sub: x[2] }); }); });
    var chunks = []; for (var i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
    catMgr.busy = true; render(true);
    chunks.reduce(function (pr, ch) { return pr.then(function () { var b = fb.db.batch(); ch.forEach(function (f) { f(b); }); return b.commit(); }); }, Promise.resolve()).then(function () {
      moves.forEach(function (x) { x[0].cat = x[1]; x[0].sub = x[2]; });
      cfg.categories = mains; cfg.subcats = sc; cfg.commissions.byCat = nb;
      if (cfgDraft) { cfgDraft.categories = mains.slice(); cfgDraft.subcats = clone(sc); cfgDraft.commissions.byCat = clone(nb); }
      catMgr.busy = false; render(true); showToast('Listo: ' + mains.length + ' rubros con sus subrubros' + (moves.length ? ', ' + moves.length + ' productos reubicados.' : '.'));
    }).catch(function () { catMgr.busy = false; setToast('No se pudo aplicar la estructura.'); });
  }
