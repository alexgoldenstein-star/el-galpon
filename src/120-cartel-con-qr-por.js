  /* ================= cartel con QR por vendedor ================= */
  var poster = null; // { code, name, phone, kind: 'a4' | 'story', showPhone, url, busy }
  function loadQRLib() {
    return new Promise(function (res, rej) {
      if (window.QRCode) { res(); return; }
      var sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      sc.onload = function () { res(); }; sc.onerror = rej;
      document.head.appendChild(sc);
    });
  }
  function qrCanvas(text, size) {
    var div = document.createElement('div');
    new window.QRCode(div, { text: text, width: size, height: size, colorDark: '#1E2A5A', colorLight: '#FFFFFF', correctLevel: window.QRCode.CorrectLevel.H });
    return div.querySelector('canvas');
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function fmtPhone(p) {
    var d = digits(p);
    if (d.indexOf('549') === 0) d = d.slice(3); else if (d.indexOf('54') === 0 && d.length === 12) d = d.slice(2);
    if (d.length === 10 && d.indexOf('11') === 0) return '11 ' + d.slice(2, 6) + '-' + d.slice(6);
    if (d.length === 10) return d.slice(0, 3) + ' ' + d.slice(3, 6) + '-' + d.slice(6);
    return p || '';
  }
  function makePoster(pz) {
    var story = pz.kind === 'story';
    var W = story ? 1080 : 1654, H = story ? 1920 : 2339, s = W / 1080;
    var link = qrTarget(pz);
    var D = '"Bricolage Grotesque", Figtree, system-ui, sans-serif', B = 'Figtree, system-ui, sans-serif';
    var fontsReady = document.fonts ? Promise.all([
      document.fonts.load('800 80px "Bricolage Grotesque"'), document.fonts.load('700 40px Figtree'), document.fonts.load('500 40px Figtree')
    ]).catch(function () {}) : Promise.resolve();
    return Promise.all([loadQRLib(), fontsReady]).then(function () {
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      var qr = qrCanvas(link, 800);
      var minQR = W * (story ? 0.52 : 0.46);
      var t = s, qrSize = 0;
      for (var i = 0; i < 8; i++) { qrSize = drawPoster(g, t); if (qrSize >= minQR) break; t *= 0.92; }
      drawPoster(g, t, qr);
      return cv.toDataURL('image/png');

      function drawPoster(g, t, qrImg) {
        var NAVY = '#1E2A5A', ORANGE = '#FF6B1A', CREAM = '#FFF8F0', GREEN = '#15803D', M = 72 * s;
        g.setTransform(1, 0, 0, 1, 0, 0); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.fillStyle = CREAM; g.fillRect(0, 0, W, H);
        var top = (story ? 250 : 210) * t;
        g.fillStyle = ORANGE; g.fillRect(0, 0, W, top);
        var ls = 104 * t, lx = M, ly = top / 2 - ls / 2;
        g.fillStyle = NAVY; rrect(g, lx, ly, ls, ls, 24 * t); g.fill();
        g.save(); g.translate(lx + ls * 0.16, ly + ls * 0.16); g.scale(ls / 30, ls / 30);
        g.strokeStyle = ORANGE; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(1, 9.5); g.lineTo(10, 3); g.lineTo(19, 9.5); g.moveTo(3, 8.5); g.lineTo(3, 19); g.lineTo(17, 19); g.lineTo(17, 8.5); g.moveTo(7, 19); g.lineTo(7, 13); g.lineTo(13, 13); g.lineTo(13, 19); g.stroke();
        g.restore();
        g.fillStyle = NAVY; g.textBaseline = 'middle';
        g.font = '800 ' + Math.round(76 * t) + 'px ' + D;
        g.fillText(cfg.brand.name, lx + ls + 28 * t, top / 2 + 2 * t);
        g.textBaseline = 'alphabetic';
        var y = top + 140 * t;
        g.fillStyle = NAVY; g.font = '800 ' + Math.round(104 * t) + 'px ' + D;
        ['Precios de depósito', 'para tu puesto'].forEach(function (ln) { g.fillText(ln, M, y); y += 108 * t; });
        y += 4 * t;
        g.fillStyle = '#4A5380'; g.font = '600 ' + Math.round(36 * t) + 'px ' + B;
        y += wrapText(g, (cfg.categories || []).slice(0, 7).join(' · '), M, y, W - 2 * M, 48 * t, 2) * 48 * t + 34 * t;
        [
          'Ves tu ganancia en cada producto antes de comprar',
          'Pedís por WhatsApp en un minuto',
          shipOn() ? 'Retirás en el depósito o te lo enviamos' : 'Retirás en el depósito, sin vueltas'
        ].forEach(function (b) {
          var cx = M + 22 * t, cy = y - 13 * t;
          g.fillStyle = GREEN; g.beginPath(); g.arc(cx, cy, 22 * t, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#FFFFFF'; g.lineWidth = 5 * t; g.lineCap = 'round'; g.lineJoin = 'round';
          g.beginPath(); g.moveTo(cx - 10 * t, cy); g.lineTo(cx - 3 * t, cy + 8 * t); g.lineTo(cx + 11 * t, cy - 8 * t); g.stroke();
          g.fillStyle = NAVY; g.font = '600 ' + Math.round(36 * t) + 'px ' + B;
          y += wrapText(g, b, M + 64 * t, y, W - 2 * M - 64 * t, 46 * t, 2) * 46 * t + 22 * t;
        });
        var bottomBand = 150 * t;
        var cardX = M, cardW = W - 2 * M, cardY = y + 16 * t, cardH = H - bottomBand - 56 * t - cardY;
        var wa = ourWa();
        var infoH = ((pz.code ? 180 : 40) + (wa ? 64 : 0)) * t;
        var qrSize = Math.min(cardW - 120 * t, cardH - 130 * t - infoH);
        if (!qrImg) return qrSize;
        // la tarjeta se ajusta al contenido y queda centrada en el espacio libre
        var used = 130 * t + qrSize + infoH;
        cardY = cardY + Math.max(0, (cardH - used) / 2); cardH = used;
        g.fillStyle = 'rgba(30,42,90,0.10)'; rrect(g, cardX + 6 * t, cardY + 10 * t, cardW, cardH, 40 * t); g.fill();
        g.fillStyle = '#FFFFFF'; rrect(g, cardX, cardY, cardW, cardH, 40 * t); g.fill();
        g.strokeStyle = '#F0DCC8'; g.lineWidth = 3 * t; rrect(g, cardX, cardY, cardW, cardH, 40 * t); g.stroke();
        g.textAlign = 'center';
        g.fillStyle = NAVY; g.font = '800 ' + Math.round(52 * t) + 'px ' + D;
        g.fillText(pz.dest === 'catalogo' ? 'Escaneá y mirá el catálogo' : 'Escaneá y recibí las ofertas', W / 2, cardY + 82 * t);
        var qy = cardY + 116 * t;
        g.imageSmoothingEnabled = false;
        g.drawImage(qrImg, (W - qrSize) / 2, qy, qrSize, qrSize);
        g.imageSmoothingEnabled = true;
        var iy = qy + qrSize + 66 * t, nextY = qy + qrSize + 20 * t;
        g.textAlign = 'center';
        if (pz.code) {
          var pre = 'Te atiende ', nm = String(pz.name || '').split(' ')[0];
          g.font = '800 ' + Math.round(46 * t) + 'px ' + D; var wName = g.measureText(nm).width;
          g.font = '500 ' + Math.round(40 * t) + 'px ' + B; var wPre = g.measureText(pre).width;
          var st = W / 2 - (wPre + wName) / 2;
          g.textAlign = 'left'; g.fillStyle = '#4A5380'; g.fillText(pre, st, iy);
          g.fillStyle = NAVY; g.font = '800 ' + Math.round(46 * t) + 'px ' + D; g.fillText(nm, st + wPre, iy);
          g.textAlign = 'center';
          var chip = 'Código ' + pz.code;
          g.font = '800 ' + Math.round(34 * t) + 'px ' + B;
          var cw = g.measureText(chip).width + 52 * t, chy = iy + 26 * t;
          g.fillStyle = NAVY; rrect(g, W / 2 - cw / 2, chy, cw, 60 * t, 30 * t); g.fill();
          g.fillStyle = '#FFFFFF'; g.fillText(chip, W / 2, chy + 42 * t);
          nextY = chy + 60 * t;
        }
        if (wa) { g.fillStyle = GREEN; g.font = '800 ' + Math.round(38 * t) + 'px ' + B; g.fillText('WhatsApp ' + wa, W / 2, nextY + 54 * t); }
        g.fillStyle = NAVY; g.fillRect(0, H - bottomBand, W, bottomBand);
        g.fillStyle = '#FFFFFF'; g.font = '700 ' + Math.round(36 * t) + 'px ' + B;
        g.fillText(location.host.replace(/^www\./, '') + (pz.code ? '/?v=' + pz.code : ''), W / 2, H - bottomBand / 2 - 4 * t);
        g.fillStyle = '#C9CFE6'; g.font = '500 ' + Math.round(27 * t) + 'px ' + B;
        g.fillText('Sin cuota ni inscripción · ' + (cfg.brand.tagline || ''), W / 2, H - bottomBand / 2 + 38 * t);
        return qrSize;
      }
    });
  }
