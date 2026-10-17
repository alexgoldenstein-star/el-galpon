  /* ================= QR del canal de difusión ================= */
  var canalDone = false;
  function canalCode() { return refName ? refCode : cleanCode(buyer.ref); }
  function canalView() {
    var code = canalCode(), target = canalTarget(code, refName);
    var wa = ourWa();
    return '<section class="canal-go"><div class="wrap"><div class="canal-box">' +
      '<span class="canal-ico">' + ic('megaphone', 34) + '</span>' +
      '<h1 class="h2">Te llevamos a las ofertas de ' + esc(cfg.brand.name) + '</h1>' +
      '<p>' + (hasChannel() ? 'Se abre nuestro canal de WhatsApp: tocá <b>Unirme</b> y listo, te llegan el catálogo y las ofertas de la semana.'
        : 'Se abre WhatsApp con el mensaje listo: tocá <b>Enviar</b> y te sumamos a la lista de difusión.') + '</p>' +
      (!hasChannel() && wa ? '<p class="canal-save">' + ic('info', 18) + '<span>Agendá nuestro número <b class="num">' + esc(wa) + '</b>: sin eso, WhatsApp no te deja recibir las ofertas.</span></p>' : '') +
      (refName && code ? '<div class="ref-chip">' + ic('users', 18) + '<span>Te atiende <b>' + esc(refName) + '</b> · código ' + esc(code) + '</span></div>' : '') +
      '<div class="ctas"><a class="btn btn-main" href="' + esc(target) + '" rel="noopener">' + ic('wa') + (hasChannel() ? 'Abrir el canal' : 'Abrir WhatsApp') + '</a>' +
      '<a class="btn btn-line" href="#catalogo" data-go="catalogo">Ver el catálogo</a></div>' +
      '</div></div></section>';
  }
  function canalRedirect() {
    if (canalDone || !goCanal) return;
    canalDone = true;
    var code = canalCode();
    bump('qr-' + (code || 'general'), 'views');
    render(true);
    setTimeout(function () { if (view === 'canal') window.location.href = canalTarget(code, refName); }, 1600);
  }

