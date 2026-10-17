  /* ================= imágenes ================= */
  function loadImg(src) {
    return new Promise(function (res, rej) { var im = new Image(); im.crossOrigin = 'anonymous'; im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
  }
  function readFile(file) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(file); });
  }
  function cropTo(src, ratio, maxW) {
    return loadImg(src).then(function (im) {
      var sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
      if (sw / sh > ratio) { var nw = sh * ratio; sx = (sw - nw) / 2; sw = nw; } else { var nh = sw / ratio; sy = (sh - nh) / 2; sh = nh; }
      var tw = Math.min(maxW, Math.round(sw)), th = Math.round(tw / ratio);
      var cv = document.createElement('canvas'); cv.width = tw; cv.height = th;
      cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, tw, th);
      return cv.toDataURL('image/jpeg', 0.78);
    });
  }
  function dataUrlToBlob(u) {
    var parts = u.split(','), bin = atob(parts[1]), arr = new Uint8Array(bin.length);
    var mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function uploadImage(dataUrl) {
    var png = dataUrl.indexOf('data:image/png') === 0;
    var ref = fb.storage.ref('img/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + (png ? '.png' : '.jpg'));
    return ref.put(dataUrlToBlob(dataUrl), { contentType: png ? 'image/png' : 'image/jpeg', cacheControl: 'public,max-age=31536000' })
      .then(function () { return ref.getDownloadURL(); })
      .catch(function () { return dataUrl; }); // sin Storage, la foto queda dentro del documento
  }
  function processUpload(file, ratio, max) {
    return readFile(file).then(function (src) { return cropTo(src, ratio, max); }).then(uploadImage);
  }
  function wrapCount(g, text, maxW) {
    var n = 1, line = '';
    String(text).split(' ').forEach(function (w) { var t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { n++; line = w; } else line = t; });
    return n;
  }
  function wrapText(g, text, x, y, maxW, lh, maxLines) {
    var words = String(text).split(' '), line = '', lines = [];
    words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach(function (l, i) { g.fillText(l, x, y + i * lh); });
    return Math.min(lines.length, maxLines);
  }
  function makeShareImage(p) {
    return loadImg(p.img).then(function (im) {
      var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      g.fillStyle = '#FFF8F0'; g.fillRect(0, 0, W, H);
      var s = Math.min(im.naturalWidth, im.naturalHeight);
      g.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, W, 960);
      g.fillStyle = '#1E2A5A'; g.fillRect(0, 960, W, H - 960);
      g.fillStyle = '#FF6B1A'; g.fillRect(0, 960, W, 14);
      g.fillStyle = '#FFFFFF'; g.font = '700 54px Figtree, system-ui, sans-serif';
      var n = wrapText(g, p.name, 64, 1056, W - 128, 62, 2);
      g.fillStyle = '#FF6B1A'; g.font = '800 104px "Bricolage Grotesque", Figtree, system-ui, sans-serif';
      g.fillText(money(p.sug), 64, 1056 + n * 62 + 96);
      g.fillStyle = '#C9CFE6'; g.font = '600 36px Figtree, system-ui, sans-serif';
      g.fillText('Pedímelo por WhatsApp', 64, H - 56);
      return cv.toDataURL('image/jpeg', 0.86);
    });
  }

