  /* ================= Excel: importar y exportar productos ================= */
  var XCOLS = ['SKU', 'Nombre', 'Rubro', 'Subrubro', 'Precio revendedor', 'Precio sugerido', 'Unidades', 'Avisar cuando queden', 'Por encargo (si/no)', 'Destacado (si/no)', 'Descripción', 'Foto (link)'];
  var importer = null; // { rows, news, upd, errs, busy }
  function loadScript(src, globalName) {
    return new Promise(function (res, rej) {
      if (window[globalName]) { res(window[globalName]); return; }
      var sc = document.createElement('script'); sc.src = src;
      sc.onload = function () { res(window[globalName]); }; sc.onerror = rej;
      document.head.appendChild(sc);
    });
  }
  function loadXLSX() { return loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX'); }
  function xnum(v) { if (typeof v === 'number') return v; var t = String(v || '').replace(/[^\d.,]/g, ''); if (/,\d{1,2}$/.test(t) || /\.\d{3}/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, ''); return Number(t) || 0; }
  function yes(v) { return /^(s|si|sí|x|1|true|yes)$/i.test(String(v || '').trim()); }
  function exportProducts(template) {
    loadXLSX().then(function (X) {
      var rows = template ? [['SAB-2P-01', 'Juego de sábanas 2 plazas', 'Blanquería', 'Sábanas', 14500, 22000, 40, 10, 'no', 'si', 'Algodón, varios colores', ''], ['MOC-URB-01', 'Mochila urbana', 'Marroquinería', 'Mochilas', 9000, 15000, 25, 5, 'no', 'no', '', '']]
        : products.map(function (p) { return [p.sku || '', p.name, p.cat, p.sub || '', Number(p.price) || 0, Number(p.sug) || 0, tracked(p) ? Number(p.qty) : '', Number(p.minQty) || '', p.stock === 'order' ? 'si' : 'no', p.featured ? 'si' : 'no', p.desc || '', /^https?:/.test(p.img || '') ? p.img : '']; });
      var ws = X.utils.aoa_to_sheet([XCOLS].concat(rows));
      ws['!cols'] = [14, 34, 16, 20, 16, 16, 10, 12, 12, 12, 40, 30].map(function (w) { return { wch: w }; });
      var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Productos');
      X.writeFile(wb, template ? 'plantilla-productos-el-galpon.xlsx' : 'productos-el-galpon-' + todayStr() + '.xlsx');
    }).catch(function () { setToast('No se pudo cargar la herramienta de Excel. Revisá la conexión.'); });
  }
  function readExcel(file) {
    setToast('Leyendo el Excel…', true);
    Promise.all([loadXLSX(), file.arrayBuffer()]).then(function (r) {
      var X = r[0], wb = X.read(r[1], { type: 'array' });
      var aoa = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      var head = (aoa[0] || []).map(function (h) { return String(h).trim().toLowerCase(); });
      var col = function (name) { var n = name.toLowerCase(); for (var i = 0; i < head.length; i++) if (head[i].indexOf(n) === 0) return i; return -1; };
      var C = { sku: col('sku'), name: col('nombre'), cat: col('rubro'), sub: col('subrubro'), price: col('precio revendedor'), sug: col('precio sugerido'), qty: col('unidades'), min: col('avisar'), order: col('por encargo'), feat: col('destacado'), desc: col('descrip'), img: col('foto') };
      if (C.name < 0 || C.price < 0) { setToast('No encontré las columnas “Nombre” y “Precio revendedor”. Usá la plantilla.'); return; }
      var cats = cfg.categories || [], out = [], seen = {};
      aoa.slice(1).forEach(function (row, i) {
        var g = function (k) { return C[k] < 0 ? '' : row[C[k]]; };
        var name = String(g('name')).trim(); if (!name && !String(g('sku')).trim()) return;
        var r = { line: i + 2, sku: cleanSku(g('sku')), name: name, cat: String(g('cat')).trim(), price: xnum(g('price')), sug: xnum(g('sug')),
          qty: String(g('qty')).trim() === '' ? null : Math.max(0, Math.round(Number(g('qty')) || 0)), minQty: Math.max(0, Math.round(Number(g('min')) || 0)),
          order: yes(g('order')), featured: yes(g('feat')), desc: String(g('desc')).trim(), img: String(g('img')).trim(), errs: [] };
        r.sub = String(g('sub')).trim();
        var rc = resolveCat(r.cat);
        if (rc) { r.cat = rc[0]; if (!r.sub) r.sub = rc[1]; } else if (r.cat) r.newCat = true; else r.cat = cats[0] || 'Varios';
        if (r.sub) { var sm = subsOf(r.cat).filter(function (x) { return norm(x) === norm(r.sub); })[0]; if (sm) r.sub = sm; else r.newSub = true; }
        if (!r.name) r.errs.push('falta el nombre');
        if (!(r.price > 0)) r.errs.push('falta el precio');
        if (r.sug && r.sug <= r.price) r.errs.push('sugerido menor al precio');
        if (r.img && !/^https?:\/\//.test(r.img)) r.img = '';
        var key = r.sku || r.name.toLowerCase();
        if (seen[key]) r.errs.push('repetido en la fila ' + seen[key]); else seen[key] = r.line;
        r.target = (r.sku && products.filter(function (p) { return cleanSku(p.sku) === r.sku; })[0]) || products.filter(function (p) { return String(p.name).trim().toLowerCase() === r.name.toLowerCase(); })[0] || null;
        out.push(r);
      });
      importer = { rows: out, file: file.name };
      render(true);
    }).catch(function () { setToast('No se pudo leer ese archivo. Guardalo como .xlsx y probá de nuevo.'); });
  }
  function importModal() {
    if (!importer) return '';
    var rows = importer.rows, ok = rows.filter(function (r) { return !r.errs.length; });
    var nNew = ok.filter(function (r) { return !r.target; }).length, nUpd = ok.length - nNew, nErr = rows.length - ok.length;
    var newCats = []; ok.forEach(function (r) { if (r.newCat && newCats.indexOf(r.cat) === -1) newCats.push(r.cat); });
    return '<div class="modal-wrap" data-act="close-import" style="z-index:60"><div class="modal import-modal" role="dialog" aria-modal="true" aria-label="Importar productos" data-stop="1">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">Importar ' + esc(importer.file) + '</h2><button class="x" type="button" data-act="close-import" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="tiles">' + tile('Nuevos', String(nNew), 'se crean') + tile('Actualizados', String(nUpd), 'mismo SKU o nombre') + tile('Con errores', String(nErr), 'no se importan') + '</div>' +
      (newCats.length ? '<p class="hint">Rubros nuevos que se van a agregar: <b>' + newCats.map(esc).join(', ') + '</b></p>' : '') +
      '<p class="hint">Los productos nuevos sin foto se publican con una foto genérica: después les sacás la foto desde la lista. En los que ya existen, se mantiene la foto si la planilla no trae una.</p>' +
      '<div class="imp-table"><table><thead><tr><th>Fila</th><th>SKU</th><th>Nombre</th><th>Rubro</th><th class="num">Precio</th><th class="num">Unid.</th><th>Estado</th></tr></thead><tbody>' +
      rows.slice(0, 300).map(function (r) {
        return '<tr class="' + (r.errs.length ? 'err' : '') + '"><td class="num">' + r.line + '</td><td>' + esc(r.sku || '—') + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.cat) + (r.sub ? ' › ' + esc(r.sub) : '') + '</td><td class="num">' + money(r.price) + '</td><td class="num">' + (r.qty === null ? '—' : r.qty) + '</td><td>' +
          (r.errs.length ? '<b class="bad">' + esc(r.errs.join(', ')) + '</b>' : r.target ? 'Actualiza' : 'Nuevo') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="edit-actions"><span style="flex:1"></span><button class="btn btn-line btn-sm" type="button" data-act="close-import">Cancelar</button>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="do-import"' + (ok.length && !importer.busy ? '' : ' disabled') + '>' + (importer.busy ? 'Importando…' : 'Importar ' + ok.length + ' productos') + '</button></div>' +
      '</div></div>';
  }
  function doImport() {
    if (!importer || importer.busy) return;
    var ok = importer.rows.filter(function (r) { return !r.errs.length; });
    importer.busy = true; render(true);
    var minOrder = products.reduce(function (m, x) { return Math.min(m, typeof x.order === 'number' ? x.order : 0); }, 0);
    var sc = clone(cfg.subcats || {}), subsChanged = false;
    ok.forEach(function (r) { if (r.sub) { sc[r.cat] = sc[r.cat] || []; if (sc[r.cat].indexOf(r.sub) === -1) { sc[r.cat].push(r.sub); subsChanged = true; } } });
    var prevSc = cfg.subcats; cfg.subcats = sc;
    var docs = ok.map(function (r, i) {
      var base = r.target ? Object.assign({}, r.target) : { id: fb.db.collection('products').doc().id, order: minOrder - ok.length + i, combo: false, offer: 0, offerUntil: '', img: '' };
      var stockMode = r.order ? 'order' : (base.stock === 'order' ? 'ok' : (base.stock || 'ok'));
      var p = Object.assign(base, { sku: r.sku || base.sku || '', name: r.name, cat: r.cat, sub: r.sub || '', price: r.price, sug: r.sug || base.sug || 0, qty: r.order ? null : r.qty, minQty: r.minQty, stock: stockMode, featured: r.featured, desc: r.desc || base.desc || '' });
      if (r.img) p.img = r.img;
      if (!p.img) p.img = (cfg.images && cfg.images.depB) || '';
      if (r.order) p.leadDays = p.leadDays || 7;
      var d = productDoc(p); d.id = p.id; return d;
    });
    var newCats = []; ok.forEach(function (r) { if (r.newCat && (cfg.categories || []).indexOf(r.cat) === -1 && newCats.indexOf(r.cat) === -1) newCats.push(r.cat); });
    var chunks = []; for (var i = 0; i < docs.length; i += 400) chunks.push(docs.slice(i, i + 400));
    var run = chunks.reduce(function (pr, ch) {
      return pr.then(function () { var b = fb.db.batch(); ch.forEach(function (d) { var x = Object.assign({}, d); delete x.id; b.set(fb.db.collection('products').doc(d.id), x); }); return b.commit(); });
    }, (newCats.length || subsChanged) && isAdmin() ? fb.db.collection('site').doc('main').update({ categories: (cfg.categories || []).concat(newCats), subcats: sc }).then(function () { cfg.categories = (cfg.categories || []).concat(newCats); if (cfgDraft) { cfgDraft.categories = cfg.categories.slice(); cfgDraft.subcats = clone(sc); } }) : Promise.resolve().then(function () { if (!isAdmin()) cfg.subcats = prevSc; }));
    run.then(function () {
      logAudit('importar', importer.file + ': ' + docs.length + ' productos');
      docs.forEach(function (d) { var i2 = -1; products.forEach(function (p, k) { if (p.id === d.id) i2 = k; }); if (i2 >= 0) products[i2] = d; else products.unshift(d); });
      importer = null; setToast(docs.length + ' productos importados.');
    }).catch(function (e) { importer.busy = false; setToast(e && e.code === 'permission-denied' ? 'Sin permiso para guardar productos.' : 'Se cortó la importación. Revisá y probá de nuevo: lo que ya entró no se duplica.'); });
  }

