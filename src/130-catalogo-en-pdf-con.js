  /* ================= catálogo en PDF con fotos ================= */
  var catPdf = null; // { code, name, cats, onlyStock, dest, busy, step, url, size }
  function openCatPdf(code) {
    var name = '';
    if (code) { if (isSeller() && sellerData && sellerData.me) name = sellerData.me.name; else if (sellersMap[code]) name = sellersMap[code].name; }
    var used = (cfg.categories || []).filter(function (c) { return products.some(function (p) { return p.cat === c; }); });
    catPdf = { code: code || '', name: name, cats: used.slice(), onlyStock: true, dest: 'canal', busy: false, url: null };
    render(true);
  }
  function catPdfItems() {
    var cats = catPdf.cats;
    var pool = products.filter(function (p) { return (!catPdf.onlyStock || p.stock !== 'out'); });
    var groups = [];
    var offers = pool.filter(onOffer);
    if (offers.length) groups.push({ title: 'Ofertas de la semana', items: offers });
    cats.forEach(function (c) { var it = pool.filter(function (p) { return p.cat === c && !onOffer(p); }); if (it.length) groups.push({ title: c, items: it }); });
    return groups;
  }
  function catalogModal() {
    if (!catPdf) return '';
    var used = (cfg.categories || []).filter(function (c) { return products.some(function (p) { return p.cat === c; }); });
    var n = catPdfItems().reduce(function (m, g) { return m + g.items.length; }, 0);
    var first = String(catPdf.name || '').split(' ')[0];
    return '<div class="modal-wrap" data-act="close-catpdf" style="z-index:60"><div class="modal" role="dialog" aria-modal="true" aria-label="Catálogo en PDF" data-stop="1" style="width:min(560px,100%)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">Catálogo en PDF</h2><button class="x" type="button" data-act="close-catpdf" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<p class="hint">Con foto, SKU, tu precio, el sugerido y la ganancia de cada producto. La tapa lleva el QR' + (catPdf.code ? ' de ' + esc(first) + ' (los clientes quedan a su nombre)' : '') + ' y nuestro WhatsApp. Ideal para mandar por la lista de difusión.</p>' +
      '<fieldset class="cat-pick"><legend>Rubros</legend>' + used.map(function (c) { return '<label class="check"><input type="checkbox" data-catpdf="' + esc(c) + '"' + (catPdf.cats.indexOf(c) !== -1 ? ' checked' : '') + '>' + esc(c) + '</label>'; }).join('') + '</fieldset>' +
      '<label class="check"><input type="checkbox" id="catpdf-stock"' + (catPdf.onlyStock ? ' checked' : '') + '>Solo productos con stock</label>' +
      '<div class="pdest"><span>El QR de la tapa lleva a</span><div class="ptabs">' + [['canal', 'Canal de ofertas'], ['catalogo', 'Catálogo web']].map(function (k) { return '<button type="button" class="chip' + (catPdf.dest === k[0] ? ' on' : '') + '" data-act="catpdf-dest" data-dest="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div></div>' +
      '<p class="num"><b>' + n + ' productos</b> en el catálogo.</p>' +
      (catPdf.url ? '<div class="admin-note ok-note">' + ic('check', 20) + '<span>Listo: ' + catPdf.pages + ' páginas · ' + catPdf.size + '.</span></div>' : '') +
      '<div class="ctas">' +
      (catPdf.url ? '<a class="btn btn-main btn-sm" href="' + catPdf.url + '" download="' + esc(catPdfName()) + '">Descargar PDF</a>' + (navigator.canShare ? '<button class="btn btn-line btn-sm" type="button" data-act="catpdf-share">' + ic('share', 18) + 'Compartir por WhatsApp</button>' : '') + '<button class="btn btn-line btn-sm" type="button" data-act="catpdf-go">Volver a armar</button>'
        : '<button class="btn btn-main btn-sm" type="button" data-act="catpdf-go"' + (catPdf.busy || !n ? ' disabled' : '') + '>' + (catPdf.busy ? esc(catPdf.step || 'Armando…') : 'Armar el PDF') + '</button>') +
      '</div></div></div>';
  }
  function catPdfName() { return 'catalogo-' + String(cfg.brand.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-') + (catPdf.code ? '-' + catPdf.code.toLowerCase() : '') + '-' + todayStr() + '.pdf'; }
  function buildCatPdf() {
    if (!catPdf || catPdf.busy) return;
    var cp = catPdf; cp.busy = true; cp.url = null; cp.step = 'Cargando fotos…'; render(true);
    var groups = catPdfItems();
    var all = []; groups.forEach(function (g) { g.items.forEach(function (p) { if (all.indexOf(p) === -1) all.push(p); }); });
    var fontsReady = document.fonts ? Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('700 40px Figtree'), document.fonts.load('600 40px Figtree')]).catch(function () {}) : Promise.resolve();
    Promise.all([loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf'), loadQRLib(), fontsReady, Promise.all(all.map(function (p) { return loadImgSafe(imgOf(p)); }))]).then(function (r) {
      var imgMap = {}; all.forEach(function (p, i) { imgMap[p.id] = r[3][i]; });
      var W = 1240, H = 1754, M = 56;
      var D = '"Bricolage Grotesque", Figtree, system-ui, sans-serif', B = 'Figtree, system-ui, sans-serif';
      var NAVY = '#1E2A5A', ORANGE = '#FF6B1A', YELLOW = '#FFD23F', GREEN = '#15803D', CREAM = '#FFF8F0';
      var pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
      var pages = 0;
      var newCanvas = function () { var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var g = cv.getContext('2d'); g.fillStyle = CREAM; g.fillRect(0, 0, W, H); return [cv, g]; };
      var addPage = function (cv) { if (pages) pdf.addPage(); pdf.addImage(cv.toDataURL('image/jpeg', 0.8), 'JPEG', 0, 0, 210, 297, undefined, 'FAST'); pages++; };
      var logo = function (g, x, y, ls, light) {
        g.fillStyle = light ? NAVY : ORANGE; rrect(g, x, y, ls, ls, ls * 0.24); g.fill();
        g.save(); g.translate(x + ls * 0.16, y + ls * 0.16); g.scale(ls / 30, ls / 30);
        g.strokeStyle = light ? ORANGE : NAVY; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(1, 9.5); g.lineTo(10, 3); g.lineTo(19, 9.5); g.moveTo(3, 8.5); g.lineTo(3, 19); g.lineTo(17, 19); g.lineTo(17, 8.5); g.moveTo(7, 19); g.lineTo(7, 13); g.lineTo(13, 13); g.lineTo(13, 19); g.stroke();
        g.restore();
      };
      var wa = ourWa(), host = location.host.replace(/^www\./, '');
      var target = catPdf.dest === 'catalogo' ? (cp.code ? sellerLink(cp.code) : location.origin + '/#catalogo') : canalLink(cp.code);
      // ---- tapa
      (function () {
        var c = newCanvas(), cv = c[0], g = c[1];
        g.fillStyle = ORANGE; g.fillRect(0, 0, W, H);
        g.save(); g.translate(W / 2, 520);
        for (var k = 0; k < 20; k++) { g.rotate(Math.PI / 10); g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-110, -2200); g.lineTo(110, -2200); g.closePath(); g.fill(); }
        g.restore();
        logo(g, M, 60, 110, true);
        g.fillStyle = '#FFFFFF'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = '800 76px ' + D; g.fillText(cfg.brand.name, M + 136, 117);
        g.textBaseline = 'alphabetic';
        burst(g, W - 190, 140, 120, 100, 18, YELLOW);
        g.save(); g.translate(W - 190, 140); g.rotate(-0.12); g.fillStyle = NAVY; g.textAlign = 'center'; g.font = '800 34px ' + D; g.fillText('PRECIOS', 0, -18); g.fillText('DE DEPÓSITO', 0, 24); g.restore();
        g.textAlign = 'left'; g.fillStyle = NAVY; g.font = '800 132px ' + D;
        g.fillText('Catálogo', M, 420); g.fillText('mayorista', M, 550);
        g.fillStyle = '#FFFFFF'; g.font = '700 44px ' + B;
        wrapText(g, 'Para feriantes y revendedores de todo Buenos Aires', M, 640, W - 2 * M, 56, 2);
        g.font = '600 34px ' + B; g.fillStyle = '#FFE7D6';
        g.fillText('Precios vigentes al ' + new Date().toLocaleDateString('es-AR') + ' · ' + all.length + ' productos', M, 770);
        // tarjeta QR
        var cy = 840, ch = 560;
        g.fillStyle = 'rgba(30,42,90,0.25)'; rrect(g, M + 8, cy + 12, W - 2 * M, ch, 36); g.fill();
        g.fillStyle = '#FFFFFF'; rrect(g, M, cy, W - 2 * M, ch, 36); g.fill();
        var qs = 400, qx = M + 50, qy = cy + 80;
        var qr = qrCanvas(target, 800); g.imageSmoothingEnabled = false; g.drawImage(qr, qx, qy, qs, qs); g.imageSmoothingEnabled = true;
        var tx = qx + qs + 50, tw = W - M - 50 - tx;
        g.fillStyle = NAVY; g.font = '800 ' + Math.round(fitFont(g, catPdf.dest === 'catalogo' ? 'Escaneá y pedí' : 'Escaneá y recibí', '800', D, 58, tw, 30)) + 'px ' + D;
        g.fillText(catPdf.dest === 'catalogo' ? 'Escaneá y pedí' : 'Escaneá y recibí', tx, qy + 60);
        g.fillText(catPdf.dest === 'catalogo' ? 'desde el celu' : 'las ofertas', tx, qy + 128);
        var yy = qy + 200;
        if (wa) { g.fillStyle = GREEN; g.font = '800 ' + Math.round(fitFont(g, 'WhatsApp ' + wa, '800', B, 44, tw, 24)) + 'px ' + B; g.fillText('WhatsApp ' + wa, tx, yy); yy += 60; }
        g.fillStyle = '#4A5380'; g.font = '600 ' + Math.round(fitFont(g, host, '600', B, 34, tw, 20)) + 'px ' + B; g.fillText(host + (cp.code ? '/?v=' + cp.code : ''), tx, yy); yy += 60;
        if (cp.code) {
          var chip = 'Te atiende ' + String(cp.name || cp.code).split(' ')[0] + ' · código ' + cp.code;
          g.font = '800 30px ' + B; var cw = Math.min(tw, g.measureText(chip).width + 44);
          g.fillStyle = NAVY; rrect(g, tx, yy - 6, cw, 58, 29); g.fill(); g.fillStyle = '#FFFFFF'; g.fillText(chip, tx + 22, yy + 33);
        }
        // cómo pedir
        var steps = ['Elegí del catálogo: en cada producto ves tu ganancia.', 'Pedí por la web o por WhatsApp' + (Number(cfg.settings.minOrder) ? ' (mínimo ' + money(cfg.settings.minOrder) + ')' : '') + '.', shipOn() ? 'Retirás en el depósito o te lo enviamos a tu zona.' : 'Retirás en el depósito y pagás al retirar.'];
        var sy = cy + ch + 110;
        g.fillStyle = NAVY; g.font = '800 48px ' + D; g.fillText('Cómo pedir', M, sy); sy += 70;
        steps.forEach(function (t, i) {
          g.fillStyle = NAVY; g.beginPath(); g.arc(M + 30, sy - 14, 30, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.font = '800 34px ' + D; g.fillText(String(i + 1), M + 30, sy - 2);
          g.textAlign = 'left'; g.fillStyle = NAVY; g.font = '600 34px ' + B; wrapText(g, t, M + 84, sy - 2, W - 2 * M - 84, 42, 2); sy += 86;
        });
        addPage(cv);
      })();
      // ---- páginas de productos
      var cols = 3, gap = 24, top = 160, bottom = 90;
      var cw = (W - 2 * M - gap * (cols - 1)) / cols, ch = 390;
      var pageNo = 1;
      var pageFrame = function (g, title, cont) {
        g.fillStyle = NAVY; g.fillRect(0, 0, W, 130);
        logo(g, M, 30, 70, false);
        g.fillStyle = '#FFFFFF'; g.textBaseline = 'middle'; g.font = '800 46px ' + D; g.fillText(title, M + 92, 66);
        g.textAlign = 'right'; g.fillStyle = '#C9CFE6'; g.font = '700 26px ' + B; g.fillText(cfg.brand.name, W - M, 66); g.textAlign = 'left';
        g.textBaseline = 'alphabetic';
        pageNo++;
        g.fillStyle = '#6B7299'; g.font = '600 24px ' + B;
        g.fillText((wa ? 'WhatsApp ' + wa + '  ·  ' : '') + host + (cp.code ? '/?v=' + cp.code + '  ·  código ' + cp.code : ''), M, H - 38);
        g.textAlign = 'right'; g.fillText('Pág. ' + pageNo, W - M, H - 38); g.textAlign = 'left';
      };
      var drawCard = function (g, p, x, y) {
        g.fillStyle = 'rgba(30,42,90,0.10)'; rrect(g, x + 3, y + 5, cw, ch, 20); g.fill();
        g.fillStyle = '#FFFFFF'; rrect(g, x, y, cw, ch, 20); g.fill();
        var pad = 14, iw = cw - 2 * pad, ix = x + pad, iy = y + pad;
        // el texto se apoya desde abajo; la foto ocupa el resto
        g.font = '700 25px ' + B; var nl = Math.min(2, wrapCount(g, p.name, iw));
        var hasSug = Number(p.sug) > 0, gy = y + ch - pad - 34;
        var sugY = hasSug ? gy - 12 : y + ch - pad - 4, priceY = (hasSug ? sugY - 34 : sugY), skuY = priceY - 54, nameY = skuY - 30 - (nl - 1) * 30;
        var ih = Math.max(80, nameY - 30 - iy);
        g.save(); rrect(g, ix, iy, iw, ih, 14); g.clip();
        var im = imgMap[p.id];
        if (im) { var sc = Math.max(iw / im.naturalWidth, ih / im.naturalHeight), dw = im.naturalWidth * sc, dh = im.naturalHeight * sc; g.drawImage(im, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh); }
        else { g.fillStyle = CREAM; g.fillRect(ix, iy, iw, ih); g.fillStyle = '#E8A57A'; g.textAlign = 'center'; g.font = '800 ' + Math.round(ih * 0.4) + 'px ' + D; g.fillText(String(p.name).charAt(0).toUpperCase(), ix + iw / 2, iy + ih * 0.64); g.textAlign = 'left'; }
        g.restore();
        var tag = onOffer(p) ? ['OFERTA', YELLOW, NAVY] : p.combo ? ['COMBO', NAVY, '#FFFFFF'] : p.stock === 'order' ? ['POR ENCARGO', '#FFFFFF', NAVY] : p.stock === 'low' ? ['ÚLTIMAS', '#FFFFFF', '#B91C1C'] : null;
        if (tag) { g.font = '800 20px ' + D; var tw2 = g.measureText(tag[0]).width + 24; g.fillStyle = tag[1]; rrect(g, ix + 10, iy + 10, tw2, 34, 17); g.fill(); g.fillStyle = tag[2]; g.fillText(tag[0], ix + 22, iy + 34); }
        g.fillStyle = NAVY; g.font = '700 25px ' + B; wrapText(g, p.name, ix, nameY, iw, 30, 2);
        g.fillStyle = '#6B7299'; g.font = '600 19px ' + B; g.fillText(p.sku ? 'SKU ' + p.sku : String(p.cat || ''), ix, skuY);
        g.fillStyle = NAVY; g.font = '800 46px ' + D; var pt = money(priceOf(p)); g.fillText(pt, ix, priceY);
        if (onOffer(p)) { var pw = g.measureText(pt).width; g.font = '600 22px ' + B; g.fillStyle = '#6B7299'; var old = money(p.price), ow = g.measureText(old).width; if (ix + pw + 12 + ow <= ix + iw) { g.fillText(old, ix + pw + 12, priceY); g.fillRect(ix + pw + 12, priceY - 8, ow, 2); } }
        if (hasSug) {
          g.fillStyle = '#4A5380'; g.font = '600 20px ' + B; g.fillText('Vendelo a ' + money(p.sug), ix, sugY);
          if (gain(p) > 0) { var gt = 'Ganás ' + money(gain(p)); g.font = '800 21px ' + B; var gw = g.measureText(gt).width + 22; g.fillStyle = '#DCFCE7'; rrect(g, ix, gy, gw, 34, 17); g.fill(); g.fillStyle = GREEN; g.fillText(gt, ix + 11, gy + 24); }
        }
      };
      // los rubros van seguidos: cada uno abre con un título y se pasa de página cuando no entra
      var cur = null, yCur = 0, HEADH = 74;
      var openPage = function () { var c = newCanvas(); cur = c; pageFrame(c[1], 'Catálogo mayorista', false); yCur = top; };
      var closePage = function () { if (cur) addPage(cur[0]); cur = null; };
      var sectionHead = function (title, cont) {
        var g = cur[1];
        g.fillStyle = ORANGE; rrect(g, M, yCur + 8, 12, 46, 6); g.fill();
        g.fillStyle = NAVY; g.font = '800 40px ' + D; g.textBaseline = 'middle'; g.fillText(title + (cont ? ' (sigue)' : ''), M + 28, yCur + 32); g.textBaseline = 'alphabetic';
        yCur += HEADH;
      };
      groups.forEach(function (gr) {
        if (!cur || yCur + HEADH + ch > H - bottom) { closePage(); openPage(); }
        sectionHead(gr.title, false);
        for (var i = 0; i < gr.items.length; i += cols) {
          if (yCur + ch > H - bottom) { closePage(); openPage(); sectionHead(gr.title, true); }
          gr.items.slice(i, i + cols).forEach(function (p, k) { drawCard(cur[1], p, M + k * (cw + gap), yCur); });
          yCur += ch + gap;
        }
        yCur += 10;
      });
      closePage();
      var blob = pdf.output('blob');
      if (catPdf !== cp) return;
      cp.busy = false; cp.pages = pages; cp.size = (blob.size / 1048576).toFixed(1).replace('.', ',') + ' MB';
      cp.blob = blob; cp.url = URL.createObjectURL(blob); render(true);
    }).catch(function () { if (catPdf === cp) { cp.busy = false; render(true); setToast('No se pudo armar el PDF. Revisá la conexión y probá de nuevo.', true); } });
  }
  function shareCatPdf() {
    if (!catPdf || !catPdf.blob) return;
    var file = new File([catPdf.blob], catPdfName(), { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], text: 'Catálogo de ' + cfg.brand.name + ' con precios de depósito. Pedidos: ' + (catPdf.code ? sellerLink(catPdf.code) : location.origin) }).catch(function () {});
    else setToast('Tu celular no permite compartir el PDF directo. Usá “Descargar PDF”.', true);
  }
  function openPoster(code, type) {
    var info = { name: '', phone: '' };
    if (code) {
      if (isSeller() && sellerData && sellerData.me) info = { name: sellerData.me.name, phone: sellerData.me.phone };
      else if (sellersMap[code]) info = { name: sellersMap[code].name, phone: sellersMap[code].phone };
      else return;
    }
    var d = promoDefaults();
    type = type === 'qr' ? 'qr' : 'promo';
    poster = { code: code || '', name: info.name, type: type, kind: type === 'qr' ? 'a4' : 'story', dest: 'canal', url: null,
      source: d.source, sel: d.sel, title: d.title, subtitle: d.subtitle };
    render(true); buildPoster();
  }
  var posterTimer = null;
  function buildPoster(delay) {
    if (!poster) return;
    clearTimeout(posterTimer);
    var pz = poster;
    var run = function () {
      if (poster !== pz) return;
      pz.url = null; render(true);
      var job = pz.type === 'promo' ? makePromo(pz) : makePoster(pz);
      job.then(function (u) { if (poster === pz) { pz.url = u; render(true); } })
        .catch(function () { if (poster === pz) { poster = null; setToast('No se pudo armar la imagen. Revisá la conexión y probá de nuevo.'); } });
    };
    if (delay) posterTimer = setTimeout(run, delay); else run();
  }
  function posterModal() {
    if (!poster) return '';
    var pz = poster, promo = pz.type === 'promo';
    var fname = (promo ? 'promo-' : 'cartel-') + (pz.code || 'general') + '-' + pz.kind + (promo ? '.jpg' : '.png');
    var canShare = !!(navigator.canShare && window.File);
    var first = String(pz.name || '').split(' ')[0];
    var kinds = promo ? [['story', 'Estados (vertical)'], ['square', 'Feed y WhatsApp']] : [['a4', 'Para imprimir (A4)'], ['story', 'Para estados']];
    var sources = [['ofertas', 'Ofertas'], ['destacados', 'Destacados'], ['combos', 'Combos'], ['todo', 'Todos los productos']].concat((cfg.categories || []).map(function (c) { return ['cat:' + c, c]; }));
    var pool = promo ? promoPool(pz.source) : [];
    var extra = promo ? pz.sel.map(prodById).filter(function (p) { return p && pool.indexOf(p) === -1; }) : [];
    return '<div class="modal-wrap" data-act="close-poster" style="z-index:60"><div class="modal poster-modal" role="dialog" aria-modal="true" aria-label="' + (promo ? 'Promo con productos' : 'Cartel con QR') + '" data-stop="1">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 style="font-size:22px">' + (promo ? 'Promo con productos' : pz.code ? 'Cartel de ' + esc(first) : 'Cartel con QR') + '</h2><button class="x" type="button" data-act="close-poster" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      ('<div class="ptype" role="tablist">' +
        '<button type="button" role="tab" class="ptype-btn' + (promo ? ' on' : '') + '" aria-selected="' + promo + '" data-act="poster-type" data-type="promo"><b>Promo con productos</b><small>Para mandar y publicar</small></button>' +
        '<button type="button" role="tab" class="ptype-btn' + (!promo ? ' on' : '') + '" aria-selected="' + !promo + '" data-act="poster-type" data-type="qr"><b>Cartel con QR</b><small>' + (pz.code ? 'Para el puesto' : 'Para imprimir y pegar') + '</small></button></div>') +
      '<div class="pdest"><span>El QR lleva a</span><div class="ptabs">' + [['canal', 'Canal de ofertas (WhatsApp)'], ['catalogo', 'Catálogo web']].map(function (k) { return '<button type="button" class="chip' + (pz.dest === k[0] ? ' on' : '') + '" data-act="poster-dest" data-dest="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="ptabs">' + kinds.map(function (k) { return '<button type="button" class="chip' + (pz.kind === k[0] ? ' on' : '') + '" data-act="poster-kind" data-kind="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>' +
      (promo ? '<div class="form-grid promo-form">' +
        '<div class="fld wide"><label for="pz-title">Título</label><input id="pz-title" data-pz="title" maxlength="40" value="' + esc(pz.title) + '"></div>' +
        '<div class="fld wide"><label for="pz-sub">Bajada</label><input id="pz-sub" data-pz="subtitle" maxlength="60" value="' + esc(pz.subtitle) + '"></div>' +
        '<div class="fld wide"><label for="pz-src">Productos de</label><select id="pz-src" data-pz="source">' + sources.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (pz.source === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>' +
        '</div>' +
        '<div class="pick"><div class="pick-head"><b>Elegí hasta 6</b><span class="num">' + pz.sel.length + '/6</span></div>' +
        ((pool.length + extra.length) ? '<div class="pick-list">' + extra.concat(pool).slice(0, 40).map(function (p) {
          var on = pz.sel.indexOf(p.id) !== -1, dis = !on && pz.sel.length >= 6;
          return '<label class="pick-item' + (on ? ' on' : '') + (dis ? ' dis' : '') + '"><input type="checkbox" data-pick="' + esc(p.id) + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '><img src="' + esc(imgOf(p)) + '" alt=""><span><b>' + esc(p.name) + '</b><small class="num">' + money(priceOf(p)) + (onOffer(p) ? ' · oferta' : '') + '</small></span></label>';
        }).join('') + '</div>' : '<p class="hint">No hay productos con stock en esta selección.</p>') + '</div>' : '') +
      '<div class="poster-prev' + (pz.kind === 'story' ? ' story' : '') + '">' + (pz.url ? '<img src="' + pz.url + '" alt="Vista previa">' : '<div class="empty">Armando la imagen…</div>') + '</div>' +
      '<p class="hint">' + (promo ? 'Mandala por WhatsApp o subila a estados e Instagram. ' : pz.kind === 'a4' ? 'Imprimilo en A4, a color, y pegalo en el puesto. ' : 'Subilo a los estados de WhatsApp o a Instagram. ') +
        (pz.dest === 'catalogo' ? 'El QR abre el catálogo' : 'El QR abre ' + (hasChannel() ? 'nuestro canal de WhatsApp' : 'WhatsApp con un mensaje para sumarse a la lista de difusión')) +
        (pz.code ? ' y el cliente queda a nombre de ' + esc(first) + '.' : '.') + ' El WhatsApp que figura es el del negocio' + (ourWa() ? ' (' + esc(ourWa()) + ')' : '') + '.</p>' +
      (pz.dest === 'canal' && !hasChannel() && isAdmin() ? '<p class="hint">Tip: si creás un canal de WhatsApp, pegá su link en Datos y ajustes → “Link del canal de WhatsApp” y el QR va directo ahí. Los carteles ya impresos siguen funcionando.</p>' : '') +
      '<div class="ctas">' +
      (pz.url ? '<a class="btn btn-main btn-sm" href="' + pz.url + '" download="' + fname + '">Descargar</a>' : '') +
      (pz.url && canShare ? '<button class="btn btn-line btn-sm" type="button" data-act="poster-share">' + ic('share', 18) + 'Compartir por WhatsApp</button>' : '') +
      '</div></div></div>';
  }
  function sharePoster() {
    if (!poster || !poster.url) return;
    fetch(poster.url).then(function (r) { return r.blob(); }).then(function (blob) {
      var isJpg = blob.type === 'image/jpeg';
      var file = new File([blob], (poster.type === 'promo' ? 'promo-' : 'cartel-') + (poster.code || 'general') + (isJpg ? '.jpg' : '.png'), { type: blob.type || 'image/png' });
      var txt = poster.dest === 'catalogo' ? 'Catálogo de ' + cfg.brand.name + ' con precios de depósito: ' + qrTarget(poster) : 'Sumate a las ofertas de ' + cfg.brand.name + ' por WhatsApp: ' + qrTarget(poster);
      if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], text: txt });
      setToast('Tu celular no permite compartir directo. Usá “Descargar”.', true);
    }).catch(function () {});
  }

