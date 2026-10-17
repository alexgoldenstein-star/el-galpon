  /* ================= rubros (categorías) ================= */
  var catMgr = null; // { edit: idx, editVal, newVal, del: idx, moveTo, busy }
  function catCount(c) { return products.filter(function (p) { return p.cat === c; }).length; }
  function cleanCatName(v) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, 40); }
  function catExists(name, except) { var n = name.toLowerCase(); return (cfg.categories || []).some(function (c, i) { return i !== except && c.toLowerCase() === n; }); }
  // Guarda la lista de rubros y, si hace falta, cambia el rubro de los productos (renombrar o mover).
  function saveCats(next, remap, done) {
    if (!isAdmin()) { setToast('Solo un administrador puede cambiar los rubros.'); return; }
    remap = remap || {};
    var byCat = clone((cfg.commissions && cfg.commissions.byCat) || {}), nb = {};
    // al renombrar, el % del rubro se conserva; al eliminar y mover productos, el destino mantiene su propio %
    Object.keys(byCat).forEach(function (k) { if (remap[k] === undefined && next.indexOf(k) !== -1) nb[k] = byCat[k]; });
    Object.keys(remap).forEach(function (k) { var to = remap[k]; if (byCat[k] !== undefined && (cfg.categories || []).indexOf(to) === -1 && next.indexOf(to) !== -1) nb[to] = byCat[k]; });
    var touched = products.filter(function (p) { return remap[p.cat] !== undefined; });
    var sc0 = (cfg && cfg.subcats) || {}, sc = {};
    next.forEach(function (c) { var from = Object.keys(remap).filter(function (k) { return remap[k] === c && (cfg.categories || []).indexOf(c) === -1; })[0]; sc[c] = (sc0[c] || (from ? sc0[from] : null) || []).slice(); });
    var newSub = function (p) { var to = remap[p.cat]; return sc[to] && sc[to].indexOf(p.sub) !== -1 ? p.sub : ''; };
    var ops = [function (b) { b.update(fb.db.collection('site').doc('main'), { categories: next, subcats: sc, 'commissions.byCat': nb }); }];
    touched.forEach(function (p) { ops.push(function (b) { b.update(fb.db.collection('products').doc(p.id), { cat: remap[p.cat], sub: newSub(p) }); }); });
    var chunks = []; for (var i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
    if (catMgr) catMgr.busy = true; render(true);
    chunks.reduce(function (pr, ch) { return pr.then(function () { var b = fb.db.batch(); ch.forEach(function (f) { f(b); }); return b.commit(); }); }, Promise.resolve()).then(function () {
      touched.forEach(function (p) { p.sub = newSub(p); p.cat = remap[p.cat]; });
      Object.keys(remap).forEach(function (k) { if (cat === k) cat = remap[k] || 'Todo'; });
      cfg.categories = next.slice(); cfg.subcats = sc; if (cfgDraft) cfgDraft.subcats = clone(sc); cfg.commissions = cfg.commissions || clone(COMM_DEFAULT); cfg.commissions.byCat = nb;
      if (cfgDraft) { cfgDraft.categories = next.slice(); cfgDraft.commissions = cfgDraft.commissions || {}; cfgDraft.commissions.byCat = clone(nb); }
      if (catMgr) { catMgr.busy = false; catMgr.edit = -1; catMgr.del = -1; }
      if (done) done();
      render(true);
    }).catch(function (e) { if (catMgr) catMgr.busy = false; setToast(e && e.code === 'permission-denied' ? 'Sin permiso para cambiar los rubros.' : 'No se pudo guardar. Probá de nuevo.'); });
  }
  function addCat(name, then) {
    name = cleanCatName(name);
    if (name.length < 2) { setToast('Escribí el nombre del rubro.', true); return; }
    if (catExists(name)) { setToast('Ese rubro ya existe.', true); return; }
    saveCats((cfg.categories || []).concat([name]), null, function () { showToast('Rubro “' + name + '” creado.'); if (then) then(name); });
  }
  function catsModal() {
    if (!catMgr) return '';
    var cats = cfg.categories || [], m = catMgr, admin = isAdmin();
    var orphan = products.filter(function (p) { return cats.indexOf(p.cat) === -1; }).length;
    return '<div class="modal-wrap" data-act="close-cats" style="z-index:60"><div class="modal cats-modal" role="dialog" aria-modal="true" aria-label="Rubros" data-stop="1">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">Rubros</h2><button class="x" type="button" data-act="close-cats" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<p class="hint">El orden de esta lista es el orden de los bloques del catálogo, de los filtros y del catálogo en PDF. Si renombrás un rubro, sus productos se actualizan solos.</p>' +
      (admin ? '<form class="cat-add" id="cat-add-form"><input id="cat-new" maxlength="40" placeholder="Nuevo rubro, ej: Termos y mates" value="' + esc(m.newVal || '') + '" aria-label="Nombre del nuevo rubro"><button class="btn btn-main btn-sm" type="submit"' + (m.busy ? ' disabled' : '') + '>' + ic('plus', 18) + 'Agregar</button></form>' : '<p class="hint">Solo un administrador puede cambiar los rubros.</p>') +
      (admin && !SUGGESTED_TREE.every(function (t) { return cats.indexOf(t[0]) !== -1; }) ? '<div class="admin-note">' + ic('info', 20) + '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start"><span><b>Estructura sugerida:</b> Bazar, Hogar, Tecnología, Marroquinería y Blanquería, cada uno con sus subrubros (tappers, limpieza, cargadores, billeteras, sábanas…). Los productos que ya cargaste se reubican solos.</span><button class="btn btn-main btn-sm" type="button" data-act="cat-tree"' + (m.busy ? ' disabled' : '') + '>Usar la estructura sugerida</button></div></div>' : '') +
      '<ol class="cat-list">' + cats.map(function (c, i) {
        var n = catCount(c);
        if (m.edit === i) return '<li class="editing"><input id="cat-edit" maxlength="40" value="' + esc(m.editVal) + '" aria-label="Nuevo nombre de ' + esc(c) + '"><div class="cat-acts"><button class="btn btn-main btn-sm" type="button" data-act="cat-rename" data-i="' + i + '"' + (m.busy ? ' disabled' : '') + '>Guardar</button><button class="linkbtn" type="button" data-act="cat-cancel">Cancelar</button></div></li>';
        if (m.del === i) return '<li class="deleting"><div><b>¿Eliminar “' + esc(c) + '”?</b>' + (n ? '<label class="cat-move">Pasar sus ' + n + ' productos a <select id="cat-move">' + cats.filter(function (x) { return x !== c; }).map(function (x) { return '<option' + (x === m.moveTo ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>' : '<small>No tiene productos.</small>') + '</div>' +
          '<div class="cat-acts"><button class="btn btn-sm btn-danger" type="button" data-act="cat-del-ok" data-i="' + i + '"' + (m.busy || (n && cats.length < 2) ? ' disabled' : '') + '>Eliminar</button><button class="linkbtn" type="button" data-act="cat-cancel">Cancelar</button></div></li>';
        var S = subsOf(c), open = m.open === c;
        var subPanel = open ? '<li class="sub-panel">' + (S.length ? '<div class="sub-list">' + S.map(function (x, k) {
            var nx = products.filter(function (p) { return p.cat === c && p.sub === x; }).length;
            if (m.subEdit && m.subEdit.main === c && m.subEdit.sub === x) return '<div class="sub-item editing"><input id="sub-edit" maxlength="40" value="' + esc(m.subEdit.val) + '"><button class="btn btn-main btn-sm" type="button" data-act="sub-ren-ok">Guardar</button></div>';
            return '<div class="sub-item"><span>' + esc(x) + ' <small class="num">' + nx + '</small></span>' + (admin ? '<span class="cat-acts"><button class="icon-btn sm" type="button" data-act="sub-up" data-main="' + esc(c) + '" data-i="' + k + '" aria-label="Subir ' + esc(x) + '"' + (k === 0 ? ' disabled' : '') + '>↑</button><button class="icon-btn sm" type="button" data-act="sub-ren" data-main="' + esc(c) + '" data-sub="' + esc(x) + '" aria-label="Renombrar ' + esc(x) + '">' + ic('edit', 14) + '</button><button class="linkbtn" type="button" data-act="sub-del" data-main="' + esc(c) + '" data-sub="' + esc(x) + '">Quitar</button></span>' : '') + '</div>';
          }).join('') + '</div>' : '<p class="hint">Todavía no tiene subrubros.</p>') +
          (admin ? '<div class="cat-add"><input id="subnew-' + catSlug(c) + '" maxlength="40" placeholder="Nuevo subrubro de ' + esc(c) + '"><button class="btn btn-dark btn-sm" type="button" data-act="sub-add" data-main="' + esc(c) + '">Agregar</button></div>' : '') + '</li>' : '';
        return '<li><span class="cat-name"><b>' + esc(c) + '</b><small class="num">' + n + ' producto' + (n === 1 ? '' : 's') + ' · <button type="button" class="linkbtn sm" data-act="cat-open" data-main="' + esc(c) + '">' + S.length + ' subrubro' + (S.length === 1 ? '' : 's') + (open ? ' ▲' : ' ▼') + '</button></small></span>' +
          (admin ? '<div class="cat-acts">' +
            '<button class="icon-btn" type="button" data-act="cat-up" data-i="' + i + '" aria-label="Subir ' + esc(c) + '"' + (i === 0 || m.busy ? ' disabled' : '') + '>↑</button>' +
            '<button class="icon-btn" type="button" data-act="cat-down" data-i="' + i + '" aria-label="Bajar ' + esc(c) + '"' + (i === cats.length - 1 || m.busy ? ' disabled' : '') + '>↓</button>' +
            '<button class="icon-btn" type="button" data-act="cat-edit" data-i="' + i + '" aria-label="Renombrar ' + esc(c) + '">' + ic('edit', 16) + '</button>' +
            '<button class="icon-btn" type="button" data-act="cat-del" data-i="' + i + '" aria-label="Eliminar ' + esc(c) + '">' + ic('x', 16) + '</button></div>' : '') + '</li>' + subPanel;
      }).join('') + '</ol>' +
      (orphan ? '<p class="hint warn">' + orphan + ' producto' + (orphan > 1 ? 's tienen' : ' tiene') + ' un rubro que no está en la lista: aparecen en “Otros” del catálogo. Editalos para asignarles uno.</p>' : '') +
      '</div></div>';
  }

  function productEditor() {
    if (!editing) return '';
    var p = editing;
    var opts = (cfg.categories || []).map(function (c) { return '<option' + (c === p.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var photo = p.img
      ? '<img src="' + esc(p.img) + '" alt="">'
      : '<span class="photo-empty">' + ic('camera', 36) + '<span>Sin foto</span></span>';
    return '<div class="modal-wrap" style="z-index:55"><div class="modal" role="dialog" aria-modal="true" aria-label="' + (p._new ? 'Cargar producto' : 'Editar producto') + '" data-stop="1" style="width:min(600px,100%)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">' + (p._new ? 'Cargar producto' : 'Editar producto') + '</h2><button class="x" type="button" data-act="close-edit" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="edit-pic">' + photo + '<div class="edit-pic-btns">' +
      '<label class="upload upload-main">' + ic('camera', 18) + (p._uploading ? 'Subiendo…' : p.img ? 'Sacar otra foto' : 'Sacar foto') + '<input type="file" accept="image/*" capture="environment" data-edit-img="1"></label>' +
      '<label class="upload">Elegir de la galería<input type="file" accept="image/*" data-edit-img="1"></label>' +
      '</div></div>' +
      '<div class="form-grid">' +
      '<div class="fld"><label for="e-sku">SKU / código interno</label><input id="e-sku" data-e="sku" value="' + esc(p.sku || '') + '" maxlength="30" autocapitalize="characters" placeholder="Ej: BLA-SAB-2P"><small class="hint" id="e-sku-hint">' + (skuTaken(cleanSku(p.sku), p.id) ? 'Ese SKU ya lo tiene otro producto.' : 'El que usás en el depósito. Aparece en cada pedido.') + '</small></div>' +
      '<div class="fld"><label for="e-name">Nombre</label><input id="e-name" data-e="name" value="' + esc(p.name) + '" placeholder="Ej: Juego de sábanas 2 plazas"></div>' +
      '<div class="fld"><label for="e-price">Precio revendedor ($)</label><input id="e-price" type="number" inputmode="numeric" min="0" data-e="price" value="' + esc(p.price || '') + '"></div>' +
      '<div class="fld"><label for="e-sug">Precio sugerido ($)</label><input id="e-sug" type="number" inputmode="numeric" min="0" data-e="sug" value="' + esc(p.sug || '') + '"></div>' +
      '<div class="wide pe-gain num" id="e-gain">Ganancia del revendedor: ' + money(gain(p)) + '</div>' +
      '<div class="fld"><label for="e-cat">Rubro</label><select id="e-cat" data-e="cat">' + opts + (isAdmin() ? '<option value="__new">+ Crear rubro nuevo…</option>' : '') + '</select>' +
        (p._newCat ? '<div class="cat-add"><input id="e-newcat" maxlength="40" placeholder="Nombre del rubro" value="' + esc(p._newCatVal || '') + '" aria-label="Nombre del rubro nuevo"><button class="btn btn-dark btn-sm" type="button" data-act="e-cat-create">Crear</button></div>' : '') + '</div>' +
      '<div class="fld"><label for="e-sub">Subrubro</label><select id="e-sub" data-e="sub"><option value="">Sin subrubro</option>' + subsOf(p.cat).map(function (x) { return '<option' + (x === p.sub ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + (isAdmin() ? '<option value="__newsub">+ Crear subrubro…</option>' : '') + '</select>' +
        (p._newSub ? '<div class="cat-add"><input id="e-newsub" maxlength="40" placeholder="Nombre del subrubro" value="' + esc(p._newSubVal || '') + '" aria-label="Nombre del subrubro nuevo"><button class="btn btn-dark btn-sm" type="button" data-act="e-sub-create">Crear</button></div>' : '') + '</div>' +
      '<div class="fld"><label for="e-stock">Stock</label><select id="e-stock" data-e="stock">' +
      '<option value="ok"' + (p.stock === 'ok' ? ' selected' : '') + '>Hay stock</option>' +
      '<option value="low"' + (p.stock === 'low' ? ' selected' : '') + '>Últimas unidades</option>' +
      '<option value="order"' + (p.stock === 'order' ? ' selected' : '') + '>Por encargo</option>' +
      '<option value="out"' + (p.stock === 'out' ? ' selected' : '') + '>Sin stock</option></select></div>' +
      (p.stock !== 'order' ? '<div class="fld"><label for="e-qty">Unidades en depósito <span class="opt">(opcional)</span></label><input id="e-qty" type="number" inputmode="numeric" min="0" data-e="qty" value="' + (tracked(p) ? esc(p.qty) : '') + '" placeholder="Vacío = no contar"><small class="hint">Si lo cargás, el stock se descuenta solo al entregar cada pedido.</small></div>' +
        '<div class="fld"><label for="e-min">Avisar cuando queden</label><input id="e-min" type="number" inputmode="numeric" min="0" data-e="minQty" value="' + esc(p.minQty || '') + '" placeholder="Ej: 10"></div>' : '') +
      (p.stock === 'order' ? '<div class="fld"><label for="e-lead">Llega en (días)</label><input id="e-lead" type="number" inputmode="numeric" min="1" data-e="leadDays" value="' + esc(p.leadDays || 7) + '"></div>' : '') +
      '<div class="fld wide"><label for="e-desc">' + (p.combo ? 'Qué incluye el combo' : 'Descripción (medidas, material, colores)') + '</label><textarea id="e-desc" data-e="desc">' + esc(p.desc) + '</textarea></div>' +
      '<label class="check"><input type="checkbox" data-e="combo"' + (p.combo ? ' checked' : '') + '>Es un combo</label>' +
      '<label class="check"><input type="checkbox" data-e="featured"' + (p.featured ? ' checked' : '') + '>Destacado en inicio</label>' +
      '</div>' +
      '<fieldset class="offer-box"><legend>Oferta (opcional)</legend><div class="form-grid">' +
      '<div class="fld"><label for="e-offer">Precio de oferta ($)</label><input id="e-offer" type="number" inputmode="numeric" min="0" data-e="offer" value="' + esc(p.offer || '') + '" placeholder="Vacío = sin oferta"></div>' +
      '<div class="fld"><label for="e-until">Válida hasta</label><input id="e-until" type="date" data-e="offerUntil" value="' + esc(p.offerUntil || '') + '"></div>' +
      '</div><small id="e-offer-hint" class="hint">' + offerHint(p) + '</small></fieldset>' +
      '<div class="edit-actions">' +
      (p._new ? '' : '<button class="del" type="button" data-act="del-prod">' + (p._confirmDel ? 'Tocá de nuevo para eliminar' : 'Eliminar') + '</button>') +
      '<span style="flex:1"></span>' +
      (p._new ? '<button class="btn btn-line btn-sm" type="button" data-act="save-prod-next"' + (busy || p._uploading ? ' disabled' : '') + '>Guardar y cargar otro</button>' : '<button class="btn btn-line btn-sm" type="button" data-act="close-edit">Cancelar</button>') +
      '<button class="btn btn-main btn-sm" type="button" data-act="save-prod"' + (busy || p._uploading ? ' disabled' : '') + '>' + (busy ? 'Guardando…' : 'Guardar') + '</button>' +
      '</div></div></div>';
  }
  function offerHint(p) {
    if (!(Number(p.offer) > 0)) return 'Para poner un producto en oferta, cargá el precio rebajado y hasta qué día vale.';
    if (Number(p.offer) >= Number(p.price)) return 'El precio de oferta tiene que ser menor al precio revendedor.';
    if (!p.offerUntil) return 'Elegí hasta qué día vale la oferta.';
    if (p.offerUntil < todayStr()) return 'Esa fecha ya pasó: la oferta no se muestra.';
    return 'Se muestra como oferta hasta el ' + ddmm(p.offerUntil) + '. Ganancia con oferta: ' + money(gain(p)) + '.';
  }

  function f(label, path, opts) {
    opts = opts || {};
    var parts = path.split('.'), v = cfgDraft;
    parts.forEach(function (k) { v = v == null ? '' : v[k]; });
    var id = 'c-' + parts.join('-');
    var input = opts.area
      ? '<textarea id="' + id + '" data-c="' + path + '">' + esc(v) + '</textarea>'
      : '<input id="' + id + '" data-c="' + path + '" type="' + (opts.type || 'text') + '" value="' + esc(v) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>';
    return '<div class="fld' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + '</label>' + input + (opts.help ? '<small style="color:var(--ink-3)">' + esc(opts.help) + '</small>' : '') + '</div>';
  }
  function imgSlot(key, label, square) {
    return '<div class="slot' + (square ? ' sq' : '') + '"><b>' + esc(label) + '</b><img src="' + esc(cfgDraft.images[key]) + '" alt="">' +
      '<label class="upload">' + ic('camera', 18) + 'Cambiar foto<input type="file" accept="image/*" data-cfg-img="' + key + '"></label>' +
      (key !== 'hero' ? '<div class="fld"><label for="cap-' + key + '">Texto sobre la foto</label><input id="cap-' + key + '" data-c="captions.' + key + '" value="' + esc(cfgDraft.captions[key]) + '"></div>' : '') +
      '</div>';
  }
  function cfgBase() { return clone(cfg); }
  function businessAdmin() {
    if (!cfgDraft) cfgDraft = cfgBase();
    var changed = JSON.stringify(cfgDraft) !== JSON.stringify(cfgBase());
    return '<div class="panel"><h2>Datos del negocio</h2><div class="form-grid">' +
      f('Nombre de la marca', 'brand.name') +
      f('Frase de la marca', 'brand.tagline') +
      f('WhatsApp de pedidos', 'contact.whatsapp', { ph: '5491123456789', help: 'Con 549 + código de área, sin 0 ni 15. Ej: 5491123456789' }) +
      f('WhatsApp como se muestra', 'contact.whatsappDisplay', { ph: '11 2345-6789', help: 'Es el número que sale en banners, carteles y la web.' }) +
      f('Link del canal de WhatsApp (opcional)', 'contact.channel', { wide: true, ph: 'https://whatsapp.com/channel/…', help: 'Si lo cargás, los QR llevan directo al canal. Si no, abren WhatsApp con un mensaje para sumarse a la lista de difusión.' }) +
      f('Instagram', 'contact.instagram', { ph: 'elgalpon.ok' }) +
      f('Mail de contacto (opcional)', 'contact.email', { ph: 'hola@elgalpon.com.ar' }) +
      f('Dirección del depósito', 'contact.address', { ph: 'Av. Ejemplo 1234' }) +
      f('Barrio / localidad', 'contact.area', { ph: 'Barrio, Partido' }) +
      f('Horario de retiro', 'contact.hours', { ph: 'Lunes a viernes de 9 a 17' }) +
      f('Link de Google Maps (opcional)', 'contact.mapsUrl', { ph: 'https://maps.app.goo.gl/…' }) +
      f('Cómo llegar (opcional)', 'contact.howToGet', { wide: true, ph: 'Colectivos 000 y 000, a 5 cuadras de la estación…' }) +
      f('Formas de pago', 'contact.payments', { wide: true }) +
      f('Plazo para cambios', 'contact.changes', { ph: '7 días' }) +
      f('Pedido mínimo ($)', 'settings.minOrder', { type: 'number' }) +
      '<div class="fld wide"><label>Rubros</label><div class="cat-summary">' + (cfg.categories || []).map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + '<button class="btn btn-line btn-sm" type="button" data-act="cats">Administrar rubros</button></div></div>' +
      '<label class="check wide"><input type="checkbox" data-c="settings.examplePrices"' + (cfgDraft.settings.examplePrices ? ' checked' : '') + '>Mostrar aviso de “precios de ejemplo” en el catálogo</label>' +
      '</div></div>' +
      '<div class="panel"><h2>Fotos de la página</h2><p>Reemplazá las de muestra por fotos reales del depósito y del equipo.</p><div class="img-slots">' +
      imgSlot('hero', 'Foto principal', false) + imgSlot('depA', 'Depósito 1', true) + imgSlot('depB', 'Depósito 2', true) + imgSlot('depC', 'Depósito 3', true) +
      '</div></div>' + brandsAdmin() + commissionsAdmin() + shippingAdmin() + trustAdmin() + tiersAdmin() + paymentsAdmin() + notifyAdmin() + loyaltyAdmin() +
      '<div class="savebar"><div class="savebar-in"><div class="savebar-msg">' + (changed ? '<b>Tenés cambios sin publicar.</b>' : 'Todo publicado.') + '</div>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="cfg-discard"' + (changed && !busy ? '' : ' disabled') + '>Descartar</button>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="cfg-save"' + (changed && !busy ? '' : ' disabled') + '>' + (busy ? 'Publicando…' : 'Guardar y publicar') + '</button>' +
      '</div></div>';
  }

  function teamAdmin() {
    var rows = '';
    OWNERS.forEach(function (e) { rows += '<div class="trow"><span><b>' + esc(e) + '</b><br><small>Dueño · definido en el código</small></span></div>'; });
    if (!team) rows += '<p>Cargando…</p>';
    else team.forEach(function (m) {
      rows += '<div class="trow"><span><b>' + esc(m.id) + '</b><br><small>' + (ROLE_NAME[m.role] || m.role) + '</small></span>' +
        '<button class="del" type="button" data-act="del-member" data-id="' + esc(m.id) + '">Quitar</button></div>';
    });
    return '<div class="panel"><h2>Equipo</h2>' +
      '<p>Sumá a las personas que te ayudan. Después entran a esta página en Panel: la primera vez tocan “Es mi primera vez: crear acceso” con ese mismo mail (o usan “Ingresar con Google” si es una cuenta de Google).</p>' +
      '<ul class="roles"><li><b>Carga de productos:</b> agrega y edita productos, precios, fotos y stock, y ve los pedidos.</li><li><b>Administrador:</b> además cambia los datos del negocio, las comisiones, los envíos y el equipo.</li><li><b>Vendedor:</b> ve solo sus clientes, sus comisiones y sus liquidaciones. Se da de alta en la pestaña Vendedores.</li></ul>' +
      '<div class="tlist">' + rows + '</div>' +
      '<div class="form-grid" style="align-items:end">' +
      '<div class="fld"><label for="m-email">Mail</label><input id="m-email" type="email" placeholder="nombre@gmail.com" autocomplete="off"></div>' +
      '<div class="fld"><label for="m-role">Permiso</label><select id="m-role"><option value="editor">Carga de productos</option><option value="admin">Administrador</option></select></div>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="add-member"' + (busy ? ' disabled' : '') + '>' + ic('plus', 18) + 'Sumar al equipo</button>' +
      '</div></div>';
  }

