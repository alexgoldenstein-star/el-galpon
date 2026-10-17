  /* ================= comisiones y envíos en el panel ================= */
  function parseCats(txt) { return String(txt || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function commissionsAdmin() {
    var c = cfgDraft.commissions, byCat = c.byCat || {};
    var cats = cfg.categories || [];
    return '<div class="panel"><h2>Comisiones de vendedores</h2>' +
      '<p>Se muestran tal cual en la página para vendedores y en el panel de cada uno. Los cambios aplican a los pedidos que se entreguen desde ahora.</p>' +
      '<div class="form-grid">' +
      f('Comisión general (%)', 'commissions.base', { type: 'number' }) +
      f('Extra por vendedor sumado (%)', 'commissions.override', { type: 'number', help: '0 = sin extra por sumar vendedores' }) +
      f('Meses de extra por cada vendedor sumado', 'commissions.overrideMonths', { type: 'number' }) +
      f('Meses que un cliente queda asignado', 'commissions.clientMonths', { type: 'number', help: 'Se cuentan desde su última compra.' }) +
      f('Frecuencia de liquidación', 'commissions.payEvery', { ph: 'cada 15 días' }) +
      '</div>' +
      '<h3 class="sub-h">Comisión por rubro</h3><p class="hint">Vacío = usa la comisión general (' + esc(c.base) + '%).</p>' +
      '<div class="form-grid">' + cats.map(function (cat, i) {
        var v = byCat[cat];
        return '<div class="fld"><label for="cc-' + i + '">' + esc(cat) + ' (%)</label><input id="cc-' + i + '" type="number" inputmode="decimal" min="0" step="0.5" data-ccat="' + esc(cat) + '" value="' + (v === undefined || v === null ? '' : esc(v)) + '" placeholder="' + esc(c.base) + '"></div>';
      }).join('') + '</div></div>';
  }
  function shippingAdmin() {
    var sh = cfgDraft.shipping, zones = sh.zones || [];
    return '<div class="panel"><h2>Envíos</h2>' +
      '<label class="check"><input type="checkbox" data-c="shipping.enabled"' + (sh.enabled ? ' checked' : '') + '>Ofrecer envío además del retiro en el depósito</label>' +
      '<p class="hint">El cliente elige su zona en el carrito y el costo se suma al total. El envío no suma comisión.</p>' +
      '<div class="zlist">' + zones.map(function (z, i) {
        return '<div class="zrow">' +
          '<div class="fld"><label for="zn-' + i + '">Zona</label><input id="zn-' + i + '" data-zone="' + i + '" data-zf="name" value="' + esc(z.name) + '" placeholder="Ej: Lanús y Lomas"></div>' +
          '<div class="fld"><label for="zc-' + i + '">Costo ($)</label><input id="zc-' + i + '" type="number" inputmode="numeric" min="0" data-zone="' + i + '" data-zf="cost" value="' + esc(z.cost) + '"></div>' +
          '<div class="fld"><label for="ze-' + i + '">Demora</label><input id="ze-' + i + '" data-zone="' + i + '" data-zf="eta" value="' + esc(z.eta || '') + '" placeholder="Ej: 24 a 48 hs"></div>' +
          '<button class="del" type="button" data-act="zone-del" data-i="' + i + '">Quitar</button></div>';
      }).join('') + '</div>' +
      '<button class="btn btn-line btn-sm" type="button" data-act="zone-add" style="align-self:flex-start">' + ic('plus', 18) + 'Agregar zona</button>' +
      '<div class="form-grid">' + f('Aclaración para el cliente (opcional)', 'shipping.note', { wide: true, ph: 'Ej: entregamos martes y viernes por la tarde' }) + '</div>' +
      '</div>';
  }

