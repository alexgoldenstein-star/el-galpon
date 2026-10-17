  /* ================= render ================= */
  function render(keepScroll) {
    if (!cfg) return;
    var y = window.scrollY;
    var active = document.activeElement && document.activeElement.id;
    if (view === 'admin' && isClient()) { view = 'cuenta'; setHash('cuenta'); }
    if (view === 'cuenta' && (isStaff() || isSeller())) view = 'admin';
    var main = view === 'como' ? comoView() : view === 'canal' ? canalView() : view === 'catalogo' ? catalog() : view === 'admin' ? adminView() : view === 'cuenta' ? accountView() : view === 'contacto' ? contactView() : landing();
    var t = cartTotals();
    document.body.classList.toggle('has-cart', !!t.count && view !== 'admin');
    document.body.classList.toggle('lock', !!(cartOpen || detailId || share || editing || poster || importer || catPdf || drawRes || catMgr || labels));
    app.innerHTML = header() + offlineBar() + '<main>' + main + '</main>' + (view === 'admin' ? '' : footer()) +
      (view === 'admin' || view === 'canal' ? '' : '<a class="wa-float" href="' + esc(waLink('Hola ' + cfg.brand.name + '!')) + '" target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp">' + ic('wa', 30) + '</a>') +
      cartbar() + (view === 'admin' ? '' : detailModal()) + drawer() + shareModal() + productEditor() + posterModal() + importModal() + catsModal() + labelsModal() + catalogModal() + drawModal();
    if (keepScroll) window.scrollTo(0, y);
    if (view === 'admin' && isSeller()) drawQR();
    if (active) {
      var el = document.getElementById(active);
      if (el && typeof el.focus === 'function') {
        el.focus({ preventScroll: true });
        if (el.setSelectionRange && (el.type === 'search' || el.type === 'text')) { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
      }
    }
  }
  function setHash(h) { try { history.replaceState(null, '', h ? '#' + h : location.pathname); } catch (e) {} }
  function go(v) {
    view = v; cartOpen = false; share = null; detailId = null;
    setHash(v === 'como' ? 'como-trabajamos' : v); render(); window.scrollTo(0, 0);
    if (v === 'admin' && isStaff() && orders === null) loadOrders();
    if (v === 'cuenta' && isClient()) loadMyOrders();
  }

