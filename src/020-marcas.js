  /* ================= marcas ================= */
  function brandsSection() {
    var list = (cfg.brands || []).filter(function (b) { return b && (b.logo || b.name); });
    if (!list.length) return '';
    var item = function (b) {
      return '<li class="brand">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="' + esc(b.name || 'Marca') + '" loading="lazy">' : '<span class="brand-word">' + esc(b.name) + '</span>') + '</li>';
    };
    var moving = list.length >= 4;
    var reps = moving ? Math.max(1, Math.ceil(10 / list.length)) : 1, seq = [];
    for (var r = 0; r < reps; r++) seq = seq.concat(list);
    var row = seq.map(item).join('');
    return '<section class="brands-sec" aria-label="Marcas con las que trabajamos"><div class="wrap">' +
      '<p class="brands-title">Trabajamos con marcas que la gente ya conoce</p></div>' +
      '<div class="marquee' + (moving ? ' moving' : '') + '"><ul class="marquee-track">' + row +
      (moving ? '</ul><ul class="marquee-track" aria-hidden="true">' + row : '') + '</ul></div></section>';
  }

