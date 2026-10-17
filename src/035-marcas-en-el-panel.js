  /* ================= marcas en el panel ================= */
  function brandsAdmin() {
    var list = cfgDraft.brands || [];
    return '<div class="panel"><h2>Marcas que trabajamos</h2>' +
      '<p>Aparecen en un carrusel en el inicio. Subí el logo en PNG (mejor con fondo transparente). Con 4 marcas o más el carrusel se mueve solo.</p>' +
      '<div class="blist">' + list.map(function (b, i) {
        return '<div class="bitem"><div class="bthumb">' + (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : '<span>Sin logo</span>') + '</div>' +
          '<div class="fld"><label for="bn-' + i + '">Nombre</label><input id="bn-' + i + '" data-brand-name="' + i + '" value="' + esc(b.name) + '"></div>' +
          '<div class="bbtns"><label class="upload">' + ic('camera', 16) + (b.logo ? 'Cambiar logo' : 'Subir logo') + '<input type="file" accept="image/*" data-brand-logo="' + i + '"></label>' +
          '<button class="del" type="button" data-act="brand-del" data-i="' + i + '">Quitar</button></div></div>';
      }).join('') + '</div>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="brand-add" style="align-self:flex-start">' + ic('plus', 18) + 'Agregar marca</button></div>';
  }
  function fitImage(src, maxW, maxH) {
    return loadImg(src).then(function (im) {
      var r = Math.min(1, maxW / im.naturalWidth, maxH / im.naturalHeight);
      var w = Math.round(im.naturalWidth * r), h = Math.round(im.naturalHeight * r);
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(im, 0, 0, w, h);
      return cv.toDataURL('image/png');
    });
  }

  function footer() {
    var c = cfg.contact;
    var ig = c.instagram ? '@' + String(c.instagram).replace('@', '') : '';
    return '<footer><div class="wrap foot">' +
      '<div><b>' + esc(cfg.brand.name) + '</b><div>' + esc(cfg.brand.tagline) + '</div></div>' +
      '<nav class="foot-links" aria-label="Enlaces"><a href="#catalogo" data-go="catalogo">Catálogo</a><a href="#vender" data-act="contact-go" data-type="vendedor">Quiero vender</a><a href="#proveedores" data-act="contact-go" data-type="proveedor">Proveedores</a><a href="#como-trabajamos" data-go="como">Cómo trabajamos</a><a href="#contacto" data-go="contacto">Contacto</a></nav>' +
      '<div>' + (c.address ? esc(c.address) + (c.area ? ', ' + esc(c.area) : '') + '<br>' : '') +
      (ourWa() ? 'WhatsApp ' + esc(ourWa()) : '') +
      (ig ? (c.whatsappDisplay || c.whatsapp ? ' · ' : '') + 'Instagram ' + esc(ig) : '') + '</div>' +
      '</div></footer>';
  }

  function cartbar() {
    var t = cartTotals();
    if (!t.count || cartOpen || view === 'admin' || detailId) return '';
    return '<div class="cartbar"><div class="cartbar-in">' +
      '<div class="cartbar-info num"><b>' + t.count + ' producto' + (t.count > 1 ? 's' : '') + ' · ' + money(t.total) + '</b><br><span class="g">Ganás ' + money(t.gain) + ' vendiendo al sugerido</span></div>' +
      '<button class="btn btn-main btn-sm" type="button" data-act="open-cart">Ver mi pedido</button>' +
      '</div></div>';
  }

  function detailModal() {
    if (!detailId) return '';
    var p = prodById(detailId);
    if (!p) return '';
    return '<div class="modal-wrap" data-act="close-detail"><div class="modal detail" role="dialog" aria-modal="true" aria-label="' + esc(p.name) + '" data-stop="1">' +
      '<button class="x x-float" type="button" data-act="close-detail" aria-label="Cerrar">' + ic('x') + '</button>' +
      '<div class="detail-pic"><img src="' + esc(imgOf(p)) + '" alt="' + esc(p.name) + '">' + stockBadge(p) + '</div>' +
      '<div class="detail-body">' +
      '<span class="card-cat">' + catLabel(p) + '</span>' +
      '<h2 style="font-size:28px">' + esc(p.name) + '</h2>' +
      (p.sku ? '<span class="pcode">Código ' + esc(p.sku) + '</span>' : '') +
      (p.desc ? '<p style="color:var(--ink-2);font-size:17px;white-space:pre-line">' + (p.combo ? '<b>Incluye:</b> ' : '') + esc(p.desc) + '</p>' : '') +
      '<div class="detail-prices">' +
      '<div><span class="price-lbl">Tu precio' + (onOffer(p) ? ' · oferta hasta el ' + ddmm(p.offerUntil) : '') + '</span><span class="price-row">' + priceHtml(p) + '</span></div>' +
      '<div><span class="price-lbl">Precio sugerido de venta</span><span class="price num" style="color:var(--ink-2)">' + money(p.sug) + '</span></div>' +
      '</div>' +
      '<div class="gain-box"><span>Ganás por unidad</span><b class="num">' + money(gain(p)) + '</b></div>' +
      qtyControl(p, true) +
      '<button class="share" type="button" data-act="share" data-id="' + esc(p.id) + '">' + ic('share', 16) + 'Imagen para compartir en mis estados</button>' +
      '<a class="share" href="https://wa.me/?text=' + encodeURIComponent(p.name + ' por mayor en ' + cfg.brand.name + ': ' + location.origin + '/p/' + p.id) + '" target="_blank" rel="noopener">' + ic('wa', 16) + 'Pasarle este producto a otro feriante</a>' +
      ((cart[p.id] || 0) > 0 ? '<button class="btn btn-dark btn-sm" type="button" data-act="open-cart">Ver mi pedido</button>' : '') +
      '</div></div></div>';
  }

  function checkoutState() {
    var t = cartTotals(), short = Math.max(0, (Number(cfg.settings.minOrder) || 0) - t.total);
    var envio = effMode() === 'envio';
    var zoneOk = !envio || !!zoneByName(buyer.zone);
    var addrOk = !envio || String(buyer.address || '').trim().length >= 5;
    var nameOk = !!String(buyer.name || '').trim(), phoneOk = digits(buyer.phone).length >= 8;
    var hint = !digits(cfg.contact.whatsapp) ? 'Falta cargar el WhatsApp del negocio en el panel.'
      : short ? ''
      : !nameOk ? 'Escribí tu nombre para enviar el pedido.'
      : !phoneOk ? 'Escribí tu WhatsApp para que te avisemos cuando esté listo.'
      : !zoneOk ? 'Elegí tu zona de envío.'
      : !addrOk ? 'Escribí la dirección de entrega.'
      : 'Se abre WhatsApp con el pedido escrito: solo tocás Enviar.';
    return { ready: !!(t.count && !short && nameOk && phoneOk && zoneOk && addrOk && digits(cfg.contact.whatsapp)), hint: hint };
  }
  function orderRef() { return refName ? refCode : (cleanCode(buyer.ref) || (isSeller() && sellerCode ? sellerCode : '')); }
  function deliveryFields() {
    if (!shipOn()) return '';
    var zones = cfg.shipping.zones, envio = effMode() === 'envio', z = zoneByName(buyer.zone);
    return '<fieldset class="dmode"><legend>¿Cómo lo recibís?</legend>' +
      '<label class="dopt' + (!envio ? ' on' : '') + '"><input type="radio" id="dm-retiro" name="dmode" value="retiro" data-buyer="mode"' + (!envio ? ' checked' : '') + '><span><b>Retiro en el depósito</b><small>Sin costo</small></span></label>' +
      '<label class="dopt' + (envio ? ' on' : '') + '"><input type="radio" id="dm-envio" name="dmode" value="envio" data-buyer="mode"' + (envio ? ' checked' : '') + '><span><b>Envío</b><small>Según tu zona</small></span></label>' +
      '</fieldset>' +
      (envio ? '<div class="fields">' +
        '<div class="fld" style="grid-column:1 / -1"><label for="b-zone">Zona de envío</label><select id="b-zone" data-buyer="zone"><option value="">Elegí tu zona</option>' +
        zones.map(function (zz) { return '<option value="' + esc(zz.name) + '"' + (zz.name === buyer.zone ? ' selected' : '') + '>' + esc(zz.name) + ' · ' + money(zz.cost) + (zz.eta ? ' · ' + esc(zz.eta) : '') + '</option>'; }).join('') + '</select></div>' +
        '<div class="fld" style="grid-column:1 / -1"><label for="b-address">Dirección de entrega</label><input id="b-address" data-buyer="address" value="' + esc(buyer.address || '') + '" autocomplete="street-address" placeholder="Calle, número, entre calles"></div>' +
        '</div>' + (cfg.shipping.note ? '<small class="hint">' + esc(cfg.shipping.note) + '</small>' : '') : '');
  }
  function refField() {
    if (isSeller() && sellerCode && !refName && !buyer.ref) return '<div class="ref-chip">' + ic('users', 18) + '<span>Este pedido queda a tu nombre · código <b>' + esc(sellerCode) + '</b></span></div>';
    if (refName) return '<div class="ref-chip">' + ic('users', 18) + '<span>Te atiende <b>' + esc(refName) + '</b> · código ' + esc(refCode) + '</span></div>';
    return '<div class="fld"><label for="b-ref">Código de vendedor <span class="opt">(opcional)</span></label><input id="b-ref" data-buyer="ref" value="' + esc(buyer.ref || '') + '" maxlength="12" autocapitalize="characters" placeholder="Si te recomendó alguien"></div>';
  }

  function drawer() {
    if (!cartOpen) return '';
    if (lastOrder && !cartLines().length) {
      return '<div class="scrim" data-act="close-cart"><aside class="drawer" role="dialog" aria-modal="true" aria-label="Pedido enviado" data-stop="1">' +
        '<div class="drawer-head"><h2>Pedido #' + esc(lastOrder.code) + '</h2><button class="x" type="button" data-act="close-cart" aria-label="Cerrar">' + ic('x') + '</button></div>' +
        '<div class="drawer-body"><div class="sent">' + ic('check', 40) +
        '<h3>¡Listo! Tu pedido quedó registrado</h3>' +
        '<p>Si WhatsApp no se abrió o no lo enviaste, tocá el botón para mandarlo. Te confirmamos stock y día de retiro.</p>' +
        '<a class="btn btn-main" href="' + esc(lastOrder.link) + '" target="_blank" rel="noopener">' + ic('wa') + 'Abrir WhatsApp de nuevo</a>' +
        (lastOrder.id && payable({ status: 'nuevo', id: lastOrder.id }) ? '<button class="btn btn-dark" type="button" data-act="pay-mp" data-id="' + esc(lastOrder.id) + '">Pagar ahora con Mercado Pago</button>' : '') +
        (isClient() ? '<a class="btn btn-line btn-sm" href="#cuenta" data-go="cuenta">Ver el estado en Mi cuenta</a>' : '') +
        '<button class="btn btn-line btn-sm" type="button" data-act="new-order">Hacer otro pedido</button>' +
        '</div></div></aside></div>';
    }
    var lines = cartLines(), t = cartTotals();
    var min = Number(cfg.settings.minOrder) || 0;
    var short = Math.max(0, min - t.total);
    var body = lines.length ? lines.map(function (l) {
      return '<div class="line"><img src="' + esc(imgOf(l.p)) + '" alt=""><div class="line-info"><b>' + esc(l.p.name) + '</b><span class="num">' + money(priceOf(l.p)) + ' c/u · ganás ' + money(gain(l.p) * l.q) + '</span></div>' +
        '<div class="mini-qty"><button type="button" data-act="dec" data-id="' + esc(l.p.id) + '" aria-label="Quitar uno">−</button><span class="num">' + l.q + '</span><button type="button" data-act="inc" data-id="' + esc(l.p.id) + '" aria-label="Agregar uno">+</button></div></div>';
    }).join('') : '<div class="empty">Tu pedido está vacío. Sumá productos desde el catálogo.</div>';
    var cs = checkoutState(); var ready = cs.ready, hint = cs.hint;
    return '<div class="scrim" data-act="close-cart"><aside class="drawer" role="dialog" aria-modal="true" aria-label="Mi pedido" data-stop="1">' +
      '<div class="drawer-head"><h2>Mi pedido</h2><button class="x" type="button" data-act="close-cart" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="drawer-body">' + body + '</div>' +
      (lines.length ? '<div class="drawer-foot">' +
        (short ? '<div class="min-warn num">Te faltan ' + money(short) + ' para el pedido mínimo de ' + money(min) + '.</div>' : '') +
        '<div class="fields"><div class="fld"><label for="b-name">Tu nombre</label><input id="b-name" data-buyer="name" value="' + esc(buyer.name) + '" autocomplete="name"></div>' +
        '<div class="fld"><label for="b-phone">Tu WhatsApp</label><input id="b-phone" data-buyer="phone" type="tel" inputmode="tel" value="' + esc(buyer.phone || '') + '" autocomplete="tel" placeholder="11 2345-6789"></div>' +
        '<div class="fld" style="grid-column:1 / -1"><label for="b-barrio">Barrio o feria</label><input id="b-barrio" data-buyer="barrio" value="' + esc(buyer.barrio) + '"></div></div>' +
        deliveryFields() + refField() +
        '<div class="totals num">' +
        '<div class="tot"><span>Productos</span><span>' + money(t.total) + '</span></div>' +
        (shipOn() ? '<div class="tot"><span>' + (effMode() === 'envio' ? 'Envío' + (buyer.zone ? ' a ' + esc(buyer.zone) : '') : 'Retiro en el depósito') + '</span><span>' + (effMode() === 'envio' ? (zoneByName(buyer.zone) ? (shipOffPct() && shipBase() ? '<s class="muted">' + money(shipBase()) + '</s> ' : '') + (shippingCost() ? money(shippingCost()) : 'Sin cargo') : 'Elegí la zona') : 'Sin costo') + '</span></div>' : '') +
        (shipOn() && effMode() === 'envio' && shipOffPct() && shipBase() ? '<div class="tot g"><span>Beneficio nivel ' + esc(myLevel().name) + '</span><span>−' + money(shipBase() - shippingCost()) + '</span></div>' : '') +
        '<div class="tot big"><span>Total a pagar</span><b>' + money(t.total + shippingCost()) + '</b></div>' +
        '<div class="tot g"><span>Tu ganancia vendiendo al sugerido</span><span>' + money(t.gain) + '</span></div>' +
        '</div>' +
        '<button id="send-order" class="btn btn-main" type="button" data-act="send-order"' + (ready && !sending ? '' : ' disabled') + '>' + ic('wa') + (sending ? 'Enviando…' : 'Enviar pedido por WhatsApp') + '</button>' +
        '<small id="send-hint" style="color:var(--ink-3)">' + esc(hint) + '</small>' +
        (isClient() ? '<small class="acct-hint">' + ic('check', 14) + 'Queda guardado en Mi cuenta, con su estado.</small>'
          : !user && fb ? '<small class="acct-hint">¿Querés seguir tus pedidos? <a href="#cuenta" data-go="cuenta">Ingresá o creá tu cuenta</a> antes de enviarlo.</small>' : '') +
        '</div>' : '') +
      '</aside></div>';
  }

  function shareModal() {
    if (!share) return '';
    var p = prodById(share.id);
    if (!p) return '';
    return '<div class="modal-wrap" data-act="close-share" style="z-index:50"><div class="modal" role="dialog" aria-modal="true" aria-label="Compartir producto" data-stop="1">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="font-size:22px">Para tus estados</h2><button class="x" type="button" data-act="close-share" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      (share.img ? '<img src="' + share.img + '" alt="Imagen para compartir: ' + esc(p.name) + '">' : '<div class="empty">Preparando imagen…</div>') +
      '<p style="font-size:14px;color:var(--ink-2)">Mantené apretada la imagen para guardarla. Muestra tu precio de venta, nunca el de depósito.</p>' +
      '<div class="copybox" id="share-text">' + esc(share.text) + '</div>' +
      '<button class="btn btn-dark btn-sm" type="button" data-act="copy-share">Copiar texto</button>' +
      '</div></div>';
  }

