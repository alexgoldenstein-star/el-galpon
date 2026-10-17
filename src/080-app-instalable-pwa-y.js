  /* ================= app instalable (PWA) y modo sin señal ================= */
  var installEvt = null, isStandalone = false, offline = !navigator.onLine;
  try { isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) {}
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; render(true); });
  window.addEventListener('appinstalled', function () { installEvt = null; isStandalone = true; logAudit('ajustes', 'App instalada'); render(true); });
  window.addEventListener('online', function () { offline = false; render(true); showToast('Volvió la conexión.'); });
  window.addEventListener('offline', function () { offline = true; render(true); });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/[?&]nosw=1/.test(location.search)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
  function installDismissed() { try { return Number(localStorage.getItem('galpon-install-x') || 0) > Date.now(); } catch (e) { return false; } }
  function installCard(ctx) {
    if (isStandalone || installDismissed() || (!installEvt && !isIOS)) return '';
    return '<div class="install-card">' + '<img src="/icons/icon-192.png" alt="" width="48" height="48">' +
      '<div><b>Instalá El Galpón en tu celular</b><span>' + (installEvt ? 'Abrís el catálogo con un toque, como una app, y funciona aunque haya poca señal.' : 'En el iPhone: tocá Compartir y después “Agregar a inicio”.') + '</span></div>' +
      (installEvt ? '<button class="btn btn-main btn-sm" type="button" data-act="install">Instalar</button>' : '') +
      '<button class="x sm" type="button" data-act="install-x" aria-label="Ahora no">' + ic('x', 16) + '</button></div>';
  }
  function offlineBar() { return offline ? '<div class="offline-bar">' + ic('info', 16) + 'Sin conexión: estás viendo el catálogo guardado. Para enviar el pedido necesitás señal.</div>' : ''; }
  // vendedor: armar un pedido para uno de sus clientes en segundos
  function sellerOrderFor(c) {
    buyer.name = c.name || ''; buyer.phone = c.phone ? fmtPhone(c.phone) : ''; buyer.barrio = c.barrio || ''; buyer.ref = sellerCode || buyer.ref;
    persistCart(); catMode = 'list'; cart = {}; persistCart();
    go('catalogo'); showToast('Armando un pedido para ' + String(c.name || '').split(' ')[0] + '. Al enviarlo queda a tu nombre.');
  }
