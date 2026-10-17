  /* ================= estado ================= */
  var app = document.getElementById('app');
  var OWNERS = (window.GALPON_ADMINS || []).map(function (e) { return String(e).toLowerCase().trim(); });
  var fb = null;                 // { auth, db, storage }
  var cfg = null;                // datos del negocio (site/main)
  var products = [];             // colección products
  var needSeed = { cfg: false, products: false };
  var user = null, role = null;  // role: owner | admin | editor | null
  var authReady = false;
  var orders = null, ordersErr = '';
  var team = null;
  var view = 'inicio', adminTab = 'pedidos';
  var cat = 'Todo', query = '';
  var cart = {}, buyer = { name: '', barrio: '', phone: '' };
  var cartOpen = false, detailId = null, share = null;
  var editing = null;            // borrador de producto en edición
  var cfgDraft = null;           // borrador de datos del negocio
  var busy = false, toast = '';
  var sending = false, lastOrder = null;
  var sellerCode = null;         // si role === 'seller'
  var sellers = null, sellersMap = {}, clientsMap = null, payouts = null, statsMap = null;
  var sellerData = null, sellerForm = null;
  var refCode = '', refName = '';
  var customer = null, myOrders = null, custForm = null; // cuenta de cliente
  var goCanal = false;           // entró por el QR del canal (?go=canal)
  try { goCanal = new URLSearchParams(location.search).get('go') === 'canal'; } catch (e) {}

  try { cart = JSON.parse(sessionStorage.getItem('galpon-cart') || '{}') || {}; } catch (e) { cart = {}; }
  try { buyer = JSON.parse(localStorage.getItem('galpon-buyer') || 'null') || buyer; } catch (e) {}
  try { lastOrder = JSON.parse(sessionStorage.getItem('galpon-last-order') || 'null'); } catch (e) {}
  if (!buyer.mode) buyer.mode = 'retiro';
  (function captureRef() {
    var code = '';
    try { code = new URLSearchParams(location.search).get('v') || ''; } catch (e) {}
    code = cleanCode(code);
    try {
      if (code) localStorage.setItem('galpon-ref', JSON.stringify({ code: code, at: Date.now() }));
      var r = JSON.parse(localStorage.getItem('galpon-ref') || 'null');
      if (r && r.code && Date.now() - r.at < 90 * 864e5) refCode = r.code;
    } catch (e) { refCode = code; }
    if (code) { buyer.ref = code; try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {} }
    if (!buyer.ref && refCode) buyer.ref = refCode;
  })();
  function cleanCode(c) { return String(c || '').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '').slice(0, 12); }

  function readHash() {
    var h = (location.hash || '').replace('#', '');
    if (h.indexOf('producto-') === 0) { view = 'catalogo'; detailId = h.slice(9); return; }
    if (h === 'catalogo' || h === 'admin' || h === 'inicio' || h === 'contacto' || h === 'cuenta') view = h;
    if (h === 'ingresar' || h === 'mis-pedidos') view = 'cuenta';
    if (h === 'como-trabajamos' || h === 'garantias') view = 'como';
    if (h === 'proveedores') { view = 'contacto'; contactType = 'proveedor'; }
    if (h === 'vender') { view = 'contacto'; contactType = 'vendedor'; }
  }
  readHash();

