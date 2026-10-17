  /* ================= arranque ================= */
  app.innerHTML = '<div class="wrap" style="padding-block:80px;text-align:center;color:var(--ink-2)">Cargando…</div>';
  function loadStatic() { return fetch('data.json', { cache: 'no-store' }).then(function (r) { return r.json(); }); }
  function fromStatic(d) {
    var c = clone(d); var ps = c.products || []; delete c.products; return { cfg: c, products: ps };
  }
  function start() {
    if (goCanal) { view = 'canal'; cartOpen = false; }
    else if (lastOrder && !cartLines().length) cartOpen = true;
    render();
  }
  if (!(window.firebase && window.GALPON_FIREBASE)) {
    loadStatic().then(function (d) { var s = fromStatic(d); cfg = s.cfg; products = s.products; start(); });
    return;
  }
  window.firebase.initializeApp(window.GALPON_FIREBASE);
  initAppCheck();
  fb = { auth: window.firebase.auth(), db: window.firebase.firestore(), storage: window.firebase.storage() };
  // guarda una copia local de lo que se ve (catálogo, pedidos) para abrir rápido y sin señal
  if (fb.db.enablePersistence) fb.db.enablePersistence({ synchronizeTabs: true }).catch(function () {});

  Promise.all([
    fb.db.collection('site').doc('main').get().catch(function () { return null; }),
    fb.db.collection('products').orderBy('order').get().catch(function () { return null; })
  ]).then(function (res) {
    var siteSnap = res[0], prodSnap = res[1];
    var needStatic = !(siteSnap && siteSnap.exists) || !(prodSnap && !prodSnap.empty);
    return (needStatic ? loadStatic() : Promise.resolve(null)).then(function (st) {
      var s = st ? fromStatic(st) : null;
      if (siteSnap && siteSnap.exists) {
        cfg = siteSnap.data();
        if (Array.isArray(cfg.products) && !(prodSnap && !prodSnap.empty)) { s = { products: cfg.products }; }
        delete cfg.products;
      } else { cfg = s.cfg; needSeed.cfg = true; }
      if (prodSnap && !prodSnap.empty) products = prodSnap.docs.map(function (d) { var p = d.data(); p.id = d.id; return p; });
      else { products = s.products; needSeed.products = true; }
      cfg.contact = cfg.contact || {}; cfg.settings = cfg.settings || { minOrder: 0 }; cfg.captions = cfg.captions || {}; cfg.images = cfg.images || {};
      cfg.commissions = Object.assign(clone(COMM_DEFAULT), cfg.commissions || {});
      cfg.shipping = Object.assign({ enabled: false, zones: [], note: '' }, cfg.shipping || {});
      cfg.loyalty = Object.assign(clone(LOYAL_DEFAULT), cfg.loyalty || {}); cfg.loyalty.raffle = Object.assign(clone(LOYAL_DEFAULT.raffle), cfg.loyalty.raffle || {});
      cfg.payments = Object.assign(clone(PAY_DEFAULT), cfg.payments || {});
      cfg.notify = Object.assign({ auto: true }, cfg.notify || {});
      cfg.trust = Object.assign(clone(TRUST_DEFAULT), cfg.trust || {});
      cfg.subcats = cfg.subcats || {};
      cfg.tiers = Object.assign(clone(TIERS_DEFAULT), cfg.tiers || {});
      loadCounters();
      loadServerStatus();
      start();
      var rc = cleanCode(buyer.ref || refCode);
      if (rc) fb.db.collection('codes').doc(rc).get().then(function (d) {
        if (d.exists && d.data().active !== false) { refCode = rc; refName = d.data().name || rc; buyer.ref = rc; }
        else { refCode = ''; refName = ''; try { localStorage.removeItem('galpon-ref'); } catch (e) {} }
        render(true); canalRedirect();
      }).catch(function () { canalRedirect(); });
      else canalRedirect();
      fb.auth.getRedirectResult().catch(function (err) { if (err && err.code) { loginMsg = authError(err); render(true); } });
      fb.auth.onAuthStateChanged(function (u) {
        user = u; role = null; authReady = true; customer = null; myOrders = null; custForm = null;
        if (!u) { orders = null; team = null; sellerData = null; sellerCode = null; render(true); return; }
        resolveRole(u);
      });
    });
  }).catch(function () {
    app.innerHTML = '<div class="wrap" style="padding-block:80px;text-align:center">No se pudo cargar el catálogo. Recargá la página.</div>';
  });
  // Una sola puerta de entrada: dueño y equipo (mail verificado) van al panel; el resto, a su cuenta de cliente.
  function resolveRole(u) {
    role = null;
    if (!u.emailVerified) { afterLogin(); return; }
    var em = String(u.email || '').toLowerCase();
    if (OWNERS.indexOf(em) !== -1) { role = 'owner'; afterLogin(); return; }
    fb.db.collection('team').doc(em).get().then(function (d) {
      var r = d.exists ? d.data() : null;
      role = r && (r.role === 'admin' || r.role === 'editor' || (r.role === 'seller' && r.sellerCode)) ? r.role : null;
      sellerCode = role === 'seller' ? r.sellerCode : null;
      afterLogin();
    }).catch(function () { afterLogin(); });
  }
  function afterLogin() {
    if (!role) role = 'client';
    if (isClient()) { loadCustomer(); loadMyOrders(); if (view === 'admin') { view = 'cuenta'; setHash('cuenta'); } }
    else if (view === 'cuenta') { view = 'admin'; setHash('admin'); }
    if (isStaff()) { loadOrders(); loadSellers(); loadClients(); if (adminTab === 'equipo') loadTeam(); if (adminTab === 'productos') loadStats(); }
    if (isAdmin()) { loadLeads(); loadPayouts(); }
    if (isSeller()) loadSellerData();
    render(true);
  }
})();
