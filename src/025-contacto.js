  /* ================= contacto ================= */
  var contactType = 'vendedor';
  var contactForm = {};
  var contactSent = null;
  var KINDS = ['Ya vendo o recorro ferias', 'Conozco feriantes o puesteros', 'Quiero empezar de cero', 'Otro'];
  var SOURCES = ['Instagram o Facebook', 'Me invitó otro vendedor', 'Lo vi en una feria', 'Otro'];
  function cv(k) { return contactForm[contactType + '.' + k] || ''; }
  function cfield(label, k, opts) {
    opts = opts || {};
    var id = 'ct-' + k, v = cv(k);
    var input;
    if (opts.options) input = '<select id="' + id + '" data-ct="' + k + '"' + (opts.req ? ' required' : '') + '><option value="">Elegí una opción</option>' + opts.options.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
    else if (opts.area) input = '<textarea id="' + id + '" data-ct="' + k + '" maxlength="600"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + '>' + esc(v) + '</textarea>';
    else input = '<input id="' + id + '" data-ct="' + k + '" type="' + (opts.type || 'text') + '" value="' + esc(v) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.auto ? ' autocomplete="' + opts.auto + '"' : '') + (opts.type === 'tel' ? ' inputmode="tel"' : '') + ' maxlength="' + (opts.max || 120) + '"' + (opts.req ? ' required' : '') + '>';
    return '<div class="fld' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + (opts.req ? '' : ' <span class="opt">(opcional)</span>') + '</label>' + input + '</div>';
  }
  function contactView() {
    var c = cfg.contact;
    var intro = '<div class="contact-head"><span class="eyebrow">Contacto</span><h1 class="h2" style="margin-top:8px">Hablemos</h1>' +
      '<p class="lead" style="margin-top:10px">Elegí qué buscás y dejanos tus datos. Te respondemos por WhatsApp en menos de 48 horas hábiles.</p></div>';
    var switcher = '<div class="ctype" role="tablist" aria-label="Tipo de contacto">' +
      '<button type="button" role="tab" aria-selected="' + (contactType === 'vendedor') + '" class="ctype-btn' + (contactType === 'vendedor' ? ' on' : '') + '" data-act="ctype" data-type="vendedor">' + ic('users', 26) + '<span><b>Quiero ser vendedor</b><small>Recorrer ferias y cobrar comisión</small></span></button>' +
      '<button type="button" role="tab" aria-selected="' + (contactType === 'proveedor') + '" class="ctype-btn' + (contactType === 'proveedor' ? ' on' : '') + '" data-act="ctype" data-type="proveedor">' + ic('truck', 26) + '<span><b>Soy empresa o proveedor</b><small>Fabricantes, importadores y distribuidores</small></span></button>' +
      '</div>';
    var form;
    if (contactSent && contactSent.type === contactType) {
      form = '<div class="panel sent-card">' + ic('check', 40) +
        '<h2>¡Gracias, ' + esc(String(contactSent.name).split(' ')[0]) + '!</h2>' +
        '<p>Recibimos tus datos. Te escribimos por WhatsApp en menos de 48 horas hábiles.</p>' +
        (contactType === 'vendedor' ? '<a class="btn btn-main" href="#catalogo" data-go="catalogo">Mientras tanto, mirá el catálogo</a>' : '<a class="btn btn-line" href="#inicio" data-go="inicio">Volver al inicio</a>') +
        '<button type="button" class="linkbtn" data-act="ct-again">Enviar otra consulta</button></div>';
    } else if (contactType === 'vendedor') {
      form = '<form id="contact-form" class="panel" novalidate>' +
        '<div><h2>Sumate como vendedor</h2><p style="color:var(--ink-2);margin-top:6px">Visitás ferias, le pasás tu link a los feriantes y cobrás comisión por todo lo que compren. No pagás nada para sumarte.</p></div>' +
        (refName ? '<div class="ref-chip">' + ic('users', 18) + '<span>Te invitó <b>' + esc(refName) + '</b></span></div>' : '') +
        '<div class="rules-box open"><b>Así trabajamos</b>' + rulesHtml() + '</div>' +
        '<div class="form-grid">' +
        cfield('Nombre y apellido', 'name', { req: true, auto: 'name', max: 80 }) +
        cfield('WhatsApp', 'phone', { req: true, type: 'tel', auto: 'tel', ph: '11 2345-6789', max: 20 }) +
        cfield('Ferias o zona que recorrés', 'zone', { req: true, ph: 'Ej: feria de Laferrere, La Salada, Isidro Casanova', max: 80 }) +
        cfield('¿Cuál es tu experiencia?', 'kind', { req: true, options: KINDS }) +
        cfield('¿Cómo nos conociste?', 'source', { options: SOURCES }) +
        cfield('Contanos algo más', 'message', { area: true, wide: true, ph: 'Qué productos te interesan, si ya vendés otras cosas…' }) +
        '</div>' +
        '<input type="text" name="website" id="ct-hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">' +
        '<button class="btn btn-main" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Enviando…' : 'Quiero sumarme') + '</button>' +
        '<p class="hint">Usamos tus datos solo para contactarte por esta consulta.</p>' +
        '</form>';
    } else {
      form = '<form id="contact-form" class="panel" novalidate>' +
        '<div><h2>Trabajemos juntos</h2><p style="color:var(--ink-2);margin-top:6px">Compramos bazar, blanquería, cocina, hogar y tecno para una red de feriantes y revendedores de todo Buenos Aires. Contanos qué ofrecés.</p></div>' +
        '<div class="form-grid">' +
        cfield('Empresa', 'company', { req: true, auto: 'organization', max: 80 }) +
        cfield('Tu nombre', 'name', { req: true, auto: 'name', max: 80 }) +
        cfield('WhatsApp', 'phone', { req: true, type: 'tel', auto: 'tel', ph: '11 2345-6789', max: 20 }) +
        cfield('Mail', 'email', { type: 'email', auto: 'email', max: 100 }) +
        cfield('¿Qué productos o marcas ofrecés?', 'products', { req: true, wide: true, ph: 'Ej: ollas de aluminio, blanquería de algodón, marca propia…', max: 200 }) +
        cfield('Condiciones o comentarios', 'message', { area: true, wide: true, ph: 'Pedido mínimo, plazos de entrega, si tenés lista de precios…' }) +
        '</div>' +
        '<input type="text" name="website" id="ct-hp" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">' +
        '<button class="btn btn-main" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Enviando…' : 'Enviar propuesta') + '</button>' +
        '<p class="hint">Revisamos todas las propuestas. Si encaja con lo que buscamos, te contactamos para pedirte lista de precios y muestras.</p>' +
        '</form>';
    }
    var aside = '<aside class="contact-aside">' +
      '<div class="panel"><h3>Escribinos directo</h3>' +
      (digits(c.whatsapp) ? '<a class="btn btn-line" href="' + esc(waLink('Hola ' + cfg.brand.name + '! Tengo una consulta.')) + '" target="_blank" rel="noopener">' + ic('wa') + 'WhatsApp' + (c.whatsappDisplay ? ' ' + esc(c.whatsappDisplay) : '') + '</a>' : '') +
      (c.instagram ? '<p>Instagram: <b>@' + esc(String(c.instagram).replace('@', '')) + '</b></p>' : '') +
      (c.email ? '<p>Mail: <b class="sel">' + esc(c.email) + '</b></p>' : '') +
      '</div>' +
      '<div class="panel"><h3>Visitanos</h3>' +
      '<p>' + ph(c.address, 'Dirección del depósito') + (c.area ? '<br>' + esc(c.area) : '') + '</p>' +
      (c.hours ? '<p style="color:var(--ink-2)">' + esc(c.hours) + '</p>' : '') +
      (mapsUrl() ? '<a class="btn btn-line btn-sm" href="' + esc(mapsUrl()) + '" target="_blank" rel="noopener">' + ic('pin', 18) + 'Cómo llegar</a>' : '') +
      '</div></aside>';
    return '<div class="wrap contact">' + intro + switcher + '<div class="contact-grid"><div class="contact-main">' + form + '</div>' + aside + '</div></div>';
  }
  function submitContact() {
    if (busy) return;
    var hp = document.getElementById('ct-hp');
    var t = contactType;
    var g = function (k) { return String(cv(k) || '').trim(); };
    var req = t === 'vendedor' ? ['name', 'phone', 'zone', 'kind'] : ['company', 'name', 'phone', 'products'];
    for (var i = 0; i < req.length; i++) {
      if (!g(req[i])) { setToast('Completá los campos obligatorios.'); var el = document.getElementById('ct-' + req[i]); if (el) el.focus(); return; }
    }
    if (digits(g('phone')).length < 8) { setToast('Revisá el número de WhatsApp.'); return; }
    if (g('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g('email'))) { setToast('Revisá el mail.'); return; }
    var done = function () {
      busy = false; contactSent = { type: t, name: g('name') };
      Object.keys(contactForm).forEach(function (k) { if (k.indexOf(t + '.') === 0) delete contactForm[k]; });
      render(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (hp && hp.value) { done(); return; } // bot
    var doc = { type: t, name: g('name').slice(0, 80), phone: digits(g('phone')).slice(0, 20), status: 'nuevo', createdAt: window.firebase.firestore.FieldValue.serverTimestamp() };
    if (t === 'vendedor' && refName) doc.ref = refCode;
    ['email', 'company', 'zone', 'kind', 'source', 'products', 'message'].forEach(function (k) {
      var v = g(k); if (v) doc[k] = v.slice(0, k === 'message' ? 600 : k === 'products' ? 200 : 100);
    });
    busy = true; render(true);
    fb.db.collection('leads').add(doc).then(done).catch(function () {
      busy = false; render(true);
      setToast('No se pudo enviar. Probá de nuevo o escribinos por WhatsApp.');
    });
  }

