  /* ================= promo con productos ================= */
  function loadImgSafe(src) {
    return new Promise(function (res) {
      if (!src) { res(null); return; }
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); }; im.onerror = function () { res(null); };
      im.src = src;
    });
  }
  function promoPool(source) {
    var avail = products.filter(function (p) { return p.stock !== 'out'; });
    if (source === 'ofertas') return avail.filter(onOffer);
    if (source === 'destacados') return avail.filter(function (p) { return p.featured; });
    if (source === 'combos') return avail.filter(function (p) { return p.combo; });
    if (source && source.indexOf('cat:') === 0) { var c = source.slice(4); return avail.filter(function (p) { return p.cat === c; }); }
    return avail;
  }
  function promoDefaults() {
    var src = products.some(function (p) { return onOffer(p) && p.stock !== 'out'; }) ? 'ofertas' : 'destacados';
    var sel = promoPool(src).slice(0, 6).map(function (p) { return p.id; });
    if (sel.length < 4) promoPool('todo').forEach(function (p) { if (sel.length < 6 && sel.indexOf(p.id) === -1) sel.push(p.id); });
    return { source: src, sel: sel, title: src === 'ofertas' ? '¡Ofertas para tu puesto!' : '¡Precios de depósito!', subtitle: 'Comprá barato, revendé y ganá' };
  }
  function seeded(n) { var x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function burst(g, cx, cy, r1, r2, pts, fill) {
    g.beginPath();
    for (var i = 0; i < pts * 2; i++) { var r = i % 2 ? r2 : r1, a = Math.PI * i / pts - Math.PI / 2; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
    g.closePath(); g.fillStyle = fill; g.fill();
  }
  function fitFont(g, text, weight, family, size, maxW, min) {
    var sz = size;
    while (sz > min) { g.font = weight + ' ' + Math.round(sz) + 'px ' + family; if (g.measureText(text).width <= maxW) break; sz -= 2; }
    return sz;
  }
  function makePromo(pz) {
    var story = pz.kind !== 'square';
    var W = 1080, H = story ? 1920 : 1350;
    var D = '"Bricolage Grotesque", Figtree, system-ui, sans-serif', B = 'Figtree, system-ui, sans-serif';
    var NAVY = '#1E2A5A', ORANGE = '#FF6B1A', YELLOW = '#FFD23F', GREEN = '#15803D', CREAM = '#FFF8F0';
    var items = pz.sel.map(prodById).filter(Boolean).slice(0, 6);
    var fontsReady = document.fonts ? Promise.all([document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('700 40px Figtree'), document.fonts.load('600 40px Figtree')]).catch(function () {}) : Promise.resolve();
    return Promise.all([loadQRLib(), fontsReady, Promise.all(items.map(function (p) { return loadImgSafe(p.img); }))]).then(function (r) {
      var imgs = r[2];
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      // fondo con rayos y papelitos
      g.fillStyle = ORANGE; g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, story ? 330 : 260);
      for (var k = 0; k < 18; k++) { g.rotate(Math.PI / 9); g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-90, -1600); g.lineTo(90, -1600); g.closePath(); g.fill(); }
      g.restore();
      var conf = ['#FFD23F', '#FFFFFF', '#1E2A5A', '#15803D'];
      for (var c = 0; c < 46; c++) {
        var cx = seeded(c) * W, cy = seeded(c + 99) * H * (story ? 0.24 : 0.22) + 8, sz = 8 + seeded(c + 7) * 14;
        g.save(); g.translate(cx, cy); g.rotate(seeded(c + 3) * Math.PI); g.fillStyle = conf[c % 4]; g.globalAlpha = 0.85; g.fillRect(-sz / 2, -sz / 4, sz, sz / 2); g.restore();
      }
      // marca
      var M = 56, ls = 92;
      g.fillStyle = NAVY; rrect(g, M, 44, ls, ls, 22); g.fill();
      g.save(); g.translate(M + ls * 0.16, 44 + ls * 0.16); g.scale(ls / 30, ls / 30);
      g.strokeStyle = ORANGE; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(1, 9.5); g.lineTo(10, 3); g.lineTo(19, 9.5); g.moveTo(3, 8.5); g.lineTo(3, 19); g.lineTo(17, 19); g.lineTo(17, 8.5); g.moveTo(7, 19); g.lineTo(7, 13); g.lineTo(13, 13); g.lineTo(13, 19); g.stroke();
      g.restore();
      g.fillStyle = '#FFFFFF'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = '800 64px ' + D;
      g.fillText(cfg.brand.name, M + ls + 22, 44 + ls / 2 + 2);
      // sello
      var bx = W - 150, by = 112;
      burst(g, bx, by, 104, 86, 18, YELLOW);
      g.save(); g.translate(bx, by); g.rotate(-0.12); g.fillStyle = NAVY; g.textAlign = 'center';
      g.font = '800 30px ' + D; g.fillText('PRECIOS', 0, -18); g.fillText('DE DEPÓSITO', 0, 18); g.restore();
      // titular en cinta
      var ty = story ? 300 : 236, tw = W - 2 * M;
      g.save(); g.translate(W / 2, ty); g.rotate(-0.03);
      var fs = fitFont(g, pz.title, '800', D, story ? 96 : 84, tw - 70, 44);
      var th = fs * 1.35;
      g.fillStyle = 'rgba(30,42,90,0.35)'; rrect(g, -tw / 2 + 8, -th / 2 + 10, tw, th, 22); g.fill();
      g.fillStyle = '#FFFFFF'; rrect(g, -tw / 2, -th / 2, tw, th, 22); g.fill();
      g.fillStyle = NAVY; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 ' + Math.round(fs) + 'px ' + D;
      g.fillText(pz.title, 0, 4);
      g.restore();
      g.textBaseline = 'alphabetic'; g.textAlign = 'center'; g.fillStyle = '#FFFFFF';
      var ss = fitFont(g, pz.subtitle, '700', B, story ? 42 : 38, W - 2 * M, 26);
      g.font = '700 ' + Math.round(ss) + 'px ' + B; g.fillText(pz.subtitle, W / 2, ty + th / 2 + (story ? 76 : 64));
      // grilla de productos
      var bottomH = story ? 300 : 230;
      var gTop = ty + th / 2 + (story ? 120 : 96), gBot = H - bottomH - 36;
      var n = Math.max(1, items.length);
      var cols = story ? (n === 1 ? 1 : 2) : (n <= 2 ? n : n <= 4 ? 2 : 3);
      var rows = Math.ceil(n / cols), gap = 24;
      var cw = (W - 2 * M - gap * (cols - 1)) / cols, ch = (gBot - gTop - gap * (rows - 1)) / rows;
      items.forEach(function (p, i) {
        var col = i % cols, row = Math.floor(i / cols);
        var lastRow = row === rows - 1, inRow = lastRow ? n - row * cols : cols;
        var offX = lastRow && inRow < cols ? (cols - inRow) * (cw + gap) / 2 : 0;
        var x = M + offX + col * (cw + gap), y = gTop + row * (ch + gap);
        var f = Math.min(cw / 460, ch / 520), pad = 16 * f;
        g.fillStyle = 'rgba(30,42,90,0.28)'; rrect(g, x + 5, y + 8, cw, ch, 26); g.fill();
        g.fillStyle = '#FFFFFF'; rrect(g, x, y, cw, ch, 26); g.fill();
        var infoH = pad + 2 * 34 * f + 8 * f + 60 * f + 10 * f + 46 * f + pad;
        var ih = Math.max(60, Math.min(cw - 2 * pad, ch - infoH - pad));
        var iw = cw - 2 * pad, ix = x + pad, iy = y + pad;
        g.save(); rrect(g, ix, iy, iw, ih, 18); g.clip();
        var im = imgs[i];
        if (im) {
          var sc = Math.max(iw / im.naturalWidth, ih / im.naturalHeight), dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
          g.drawImage(im, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
        } else {
          g.fillStyle = CREAM; g.fillRect(ix, iy, iw, ih);
          g.fillStyle = '#E8A57A'; g.textAlign = 'center'; g.font = '800 ' + Math.round(ih * 0.4) + 'px ' + D;
          g.fillText(String(p.name).charAt(0).toUpperCase(), ix + iw / 2, iy + ih * 0.64);
        }
        g.restore();
        if (onOffer(p)) {
          g.fillStyle = YELLOW; rrect(g, ix + 12 * f, iy + 12 * f, 150 * f, 46 * f, 23 * f); g.fill();
          g.fillStyle = NAVY; g.textAlign = 'center'; g.font = '800 ' + Math.round(26 * f) + 'px ' + D; g.fillText('OFERTA', ix + 12 * f + 75 * f, iy + 12 * f + 32 * f);
        } else if (p.combo) {
          g.fillStyle = NAVY; rrect(g, ix + 12 * f, iy + 12 * f, 140 * f, 46 * f, 23 * f); g.fill();
          g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.font = '800 ' + Math.round(26 * f) + 'px ' + D; g.fillText('COMBO', ix + 12 * f + 70 * f, iy + 12 * f + 32 * f);
        }
        var yy = iy + ih + 12 * f + 30 * f;
        g.textAlign = 'left'; g.fillStyle = NAVY; g.font = '700 ' + Math.round(29 * f) + 'px ' + B;
        var nl = wrapText(g, p.name, ix, yy, iw, 34 * f, 2);
        yy += (nl - 1) * 34 * f + 66 * f;
        g.font = '800 ' + Math.round(58 * f) + 'px ' + D; g.fillStyle = NAVY;
        var priceTxt = money(priceOf(p)); g.fillText(priceTxt, ix, yy);
        if (onOffer(p)) {
          var pw = g.measureText(priceTxt).width;
          g.font = '600 ' + Math.round(28 * f) + 'px ' + B; g.fillStyle = '#6B7299';
          var old = money(p.price), ow = g.measureText(old).width, ox = ix + pw + 14 * f;
          if (ox + ow <= ix + iw) { g.fillText(old, ox, yy); g.fillRect(ox, yy - 10 * f, ow, 3 * f); }
        }
        if (gain(p) > 0) {
          var gt = 'Ganás ' + money(gain(p));
          g.font = '800 ' + Math.round(26 * f) + 'px ' + B;
          var gw = g.measureText(gt).width + 28 * f, gy = yy + 16 * f;
          g.fillStyle = '#DCFCE7'; rrect(g, ix, gy, gw, 44 * f, 22 * f); g.fill();
          g.fillStyle = GREEN; g.fillText(gt, ix + 14 * f, gy + 31 * f);
        }
      });
      // franja inferior
      g.fillStyle = NAVY; g.fillRect(0, H - bottomH, W, bottomH);
      g.fillStyle = YELLOW; g.fillRect(0, H - bottomH, W, 10);
      var qs = bottomH - 70, qx = M, qy = H - bottomH + 40;
      g.fillStyle = '#FFFFFF'; rrect(g, qx - 10, qy - 10, qs + 20, qs + 20, 16); g.fill();
      var qr = qrCanvas(qrTarget(pz), 600);
      g.imageSmoothingEnabled = false; g.drawImage(qr, qx, qy, qs, qs); g.imageSmoothingEnabled = true;
      var tx = qx + qs + 44, maxTW = W - tx - M, top0 = H - bottomH;
      g.textAlign = 'left'; g.fillStyle = '#FFFFFF';
      var l1 = pz.dest === 'catalogo' ? 'Escaneá y mirá el catálogo' : 'Escaneá y recibí las ofertas';
      g.font = '800 ' + Math.round(fitFont(g, l1, '800', D, story ? 48 : 40, maxTW, 24)) + 'px ' + D;
      g.fillText(l1, tx, top0 + (story ? 86 : 70));
      var wa = ourWa();
      if (wa) {
        var wt = 'WhatsApp ' + wa;
        g.fillStyle = YELLOW; g.font = '800 ' + Math.round(fitFont(g, wt, '800', B, story ? 40 : 34, maxTW, 22)) + 'px ' + B;
        g.fillText(wt, tx, top0 + (story ? 140 : 116));
      }
      var site = location.host.replace(/^www\./, '') + (pz.code ? '/?v=' + pz.code : '');
      g.fillStyle = '#C9CFE6'; g.font = '600 ' + Math.round(fitFont(g, site, '600', B, story ? 30 : 26, maxTW, 18)) + 'px ' + B;
      g.fillText(site, tx, top0 + (story ? 184 : 154));
      if (pz.code) {
        var chip = 'Código ' + pz.code + (pz.name ? ' · ' + String(pz.name).split(' ')[0] : '');
        var chH = story ? 50 : 40;
        g.font = '800 ' + Math.round(story ? 28 : 24) + 'px ' + B;
        var cwid = Math.min(maxTW, g.measureText(chip).width + 40), cyy = top0 + (story ? 210 : 174);
        g.fillStyle = ORANGE; rrect(g, tx, cyy, cwid, chH, chH / 2); g.fill(); g.fillStyle = NAVY; g.fillText(chip, tx + 20, cyy + chH * 0.68);
      }
      return cv.toDataURL('image/jpeg', 0.9);
    });
  }

  function qrTarget(pz) { return pz.dest === 'catalogo' ? (pz.code ? sellerLink(pz.code) : location.origin + '/#catalogo') : canalLink(pz.code); }
