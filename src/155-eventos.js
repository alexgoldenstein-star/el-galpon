  /* ================= eventos ================= */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var goEl = t.closest('[data-go]');
    if (goEl) { e.preventDefault(); go(goEl.getAttribute('data-go')); return; }
    var a = t.closest('[data-act]');
    if (!a) return;
    var act = a.getAttribute('data-act');
    if (/^close-/.test(act) && a !== t && t.closest('[data-stop]') && !t.closest('.x') && a.tagName !== 'BUTTON') return;
    var id = a.getAttribute('data-id');
    switch (act) {
      case 'inc': { var p = prodById(id); if (p && p.stock !== 'order' && tracked(p) && (cart[id] || 0) >= Number(p.qty)) { showToast('De ' + p.name + ' quedan ' + Number(p.qty) + ' unidades.'); break; } if (p && p.stock !== 'out') { if (!cart[id]) bump(id, 'adds'); cart[id] = (cart[id] || 0) + 1; if (lastOrder) { lastOrder = null; try { sessionStorage.removeItem('galpon-last-order'); } catch (er) {} } persistCart(); render(true); } break; }
      case 'dec': cart[id] = Math.max(0, (cart[id] || 0) - 1); if (!cart[id]) delete cart[id]; persistCart(); render(true); break;
      case 'detail': detailId = id; bump(id, 'views'); setHash('producto-' + id); render(true); break;
      case 'close-detail': detailId = null; setHash(view); render(true); break;
      case 'open-cart': detailId = null; cartOpen = true; render(true); break;
      case 'close-cart': cartOpen = false; render(true); break;
      case 'new-order': lastOrder = null; try { sessionStorage.removeItem('galpon-last-order'); } catch (er) {} cartOpen = false; go('catalogo'); break;
      case 'send-order': sendOrder(); break;
      case 'sub': sub = a.getAttribute('data-sub') || ''; render(true); break;
      case 'catmode': catMode = a.getAttribute('data-mode'); try { localStorage.setItem('galpon-catmode', catMode); } catch (er) {} render(true); break;
      case 'repeat-last': { var lo = (myOrders || []).filter(function (o) { return o.status !== 'cancelado'; })[0]; if (lo) repeatOrder(lo); break; }
      case 'cat-tree': applySuggestedTree(); break;
      case 'sub-add': { var sm = a.getAttribute('data-main'), inp = document.getElementById('subnew-' + catSlug(sm)), sv = cleanCatName(inp && inp.value);
        if (sv.length < 2) { showToast('Escribí el subrubro.'); break; }
        if (subsOf(sm).some(function (x) { return norm(x) === norm(sv); })) { showToast('Ese subrubro ya existe.'); break; }
        saveSubs(sm, subsOf(sm).concat([sv]), null); break; }
      case 'sub-del': { var dm = a.getAttribute('data-main'), ds = a.getAttribute('data-sub'), n2 = products.filter(function (p) { return p.cat === dm && p.sub === ds; }).length;
        if (a.getAttribute('data-confirm') !== '1') { a.setAttribute('data-confirm', '1'); a.textContent = n2 ? '¿Quitar? ' + n2 + ' productos quedan sin subrubro' : '¿Quitar?'; break; }
        var rms = {}; rms[ds] = ''; saveSubs(dm, subsOf(dm).filter(function (x) { return x !== ds; }), rms); break; }
      case 'sub-ren': { var rm2 = a.getAttribute('data-main'), rs = a.getAttribute('data-sub'); catMgr.subEdit = { main: rm2, sub: rs, val: rs }; render(true); setTimeout(function () { var el = document.getElementById('sub-edit'); if (el) { el.focus(); el.select(); } }, 0); break; }
      case 'sub-ren-ok': { var se = catMgr.subEdit, nv = cleanCatName(se.val); if (nv.length < 2 || nv === se.sub) { catMgr.subEdit = null; render(true); break; }
        if (subsOf(se.main).some(function (x) { return x !== se.sub && norm(x) === norm(nv); })) { showToast('Ese subrubro ya existe.'); break; }
        var rr = {}; rr[se.sub] = nv; saveSubs(se.main, subsOf(se.main).map(function (x) { return x === se.sub ? nv : x; }), rr); break; }
      case 'sub-up': { var um = a.getAttribute('data-main'), ui2 = Number(a.getAttribute('data-i')), ul2 = subsOf(um).slice(); if (ui2 < 1) break; var t2 = ul2[ui2]; ul2[ui2] = ul2[ui2 - 1]; ul2[ui2 - 1] = t2; saveSubs(um, ul2, null); break; }
      case 'cat-open': catMgr.open = catMgr.open === a.getAttribute('data-main') ? '' : a.getAttribute('data-main'); render(true); break;
      case 'e-sub-create': if (editing) { var esn = cleanCatName(editing._newSubVal); if (esn.length < 2) break; var em = editing.cat; saveSubs(em, subsOf(em).indexOf(esn) === -1 ? subsOf(em).concat([esn]) : subsOf(em), null, function () { editing.sub = esn; editing._newSub = false; editing._newSubVal = ''; }); } break;
      case 'cat': {
        cat = a.getAttribute('data-cat'); sub = ''; render(true);
        var tb = document.querySelector('.toolbar');
        if (tb && !a.classList.contains('chip')) window.scrollTo({ top: tb.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        break;
      }
      case 'cat-all': cat = 'Todo'; query = ''; render(true); break;
      case 'share': {
        var sp = prodById(id);
        share = { id: id, img: '', text: sp.name + (sp.desc ? '\n' + sp.desc : '') + '\nPrecio: ' + money(sp.sug) + '\nPedímelo por acá y te lo consigo.' };
        render(true);
        makeShareImage(sp).then(function (u) { if (share && share.id === id) { share.img = u; render(true); } })
          .catch(function () { if (share && share.id === id) { share.img = sp.img; render(true); } });
        break;
      }
      case 'close-share': share = null; render(true); break;
      case 'copy-share':
        try {
          navigator.clipboard.writeText(share.text).then(function () { a.textContent = 'Copiado'; }, function () { selectText('share-text'); a.textContent = 'Seleccionado: copialo'; });
        } catch (err) { selectText('share-text'); a.textContent = 'Seleccionado: copialo'; }
        break;
      case 'login': {
        var prov = new window.firebase.auth.GoogleAuthProvider();
        prov.setCustomParameters({ prompt: 'select_account' });
        loginMsg = '';
        fb.auth.signInWithPopup(prov).catch(function (err) {
          if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment')) fb.auth.signInWithRedirect(prov);
          else if (err && err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') { loginMsg = authError(err); render(true); }
        });
        break;
      }
      case 'mode': loginMode = a.getAttribute('data-mode'); loginMsg = ''; render(true); break;
      case 'resend':
        if (user) user.sendEmailVerification().then(function () { loginMsg = 'Te reenviamos el mail de verificación.'; render(true); }).catch(function (e) { loginMsg = authError(e); render(true); });
        break;
      case 'verified':
        if (user) user.reload().then(function () { return fb.auth.currentUser.getIdToken(true); }).then(function () {
          user = fb.auth.currentUser;
          if (!user.emailVerified) { loginMsg = 'Todavía no figura verificado. Abrí el link del mail y probá de nuevo.'; render(true); return; }
          loginMsg = ''; resolveRole(user);
        }).catch(function (e) { loginMsg = authError(e); render(true); });
        break;
      case 'logout': loginMsg = ''; loginMode = 'login'; fb.auth.signOut(); if (view === 'admin') go('cuenta'); break;
      case 'save-profile': saveProfile(); break;
      case 'repeat-order': { var ro = (myOrders || []).filter ? myOrders.filter(function (o) { return o.id === id; })[0] : null; if (ro) repeatOrder(ro); break; }
      case 'contact-go': e.preventDefault(); contactType = a.getAttribute('data-type'); contactSent = null; go('contacto'); break;
      case 'ctype': contactType = a.getAttribute('data-type'); render(true); break;
      case 'ct-again': contactSent = null; render(true); break;
      case 'lfilter': leadFilter = a.getAttribute('data-f'); render(true); break;
      case 'brand-add': cfgDraft.brands = (cfgDraft.brands || []).concat([{ name: '', logo: '' }]); render(true); setTimeout(function () { var el = document.getElementById('bn-' + (cfgDraft.brands.length - 1)); if (el) el.focus(); }, 0); break;
      case 'brand-del': {
        var bi = Number(a.getAttribute('data-i'));
        if (a.getAttribute('data-confirm') !== '1') { a.setAttribute('data-confirm', '1'); a.textContent = '¿Quitar? Tocá de nuevo'; break; }
        cfgDraft.brands.splice(bi, 1); render(true); break;
      }
      case 'tab': adminTab = a.getAttribute('data-tab'); if (adminTab === 'equipo' && !team) loadTeam(); if (adminTab === 'negocio' && !cfgDraft) cfgDraft = cfgBase(); if (adminTab === 'productos') loadStats(); render(); break;
      case 'seller-new': sellerForm = { name: '', phone: '', code: '', zone: '', recruitedBy: '', email: '' }; render(true); setTimeout(function () { var el = document.getElementById('sf-name'); if (el) el.focus(); }, 0); break;
      case 'seller-cancel': sellerForm = null; render(true); break;
      case 'seller-save': saveSeller(); break;
      case 'seller-toggle': toggleSeller(a.getAttribute('data-code')); break;
      case 'seller-access': giveAccess(a.getAttribute('data-code')); break;
      case 'payout': liquidate(a.getAttribute('data-code'), a); break;
      case 'poster': openPoster(a.getAttribute('data-code') || '', a.getAttribute('data-type') || 'qr'); break;
      case 'poster-type': if (poster && poster.type !== a.getAttribute('data-type')) { poster.type = a.getAttribute('data-type'); poster.kind = poster.type === 'promo' ? 'story' : 'a4'; buildPoster(); } break;
      case 'close-poster': poster = null; render(true); break;
      case 'poster-dest': if (poster && poster.dest !== a.getAttribute('data-dest')) { poster.dest = a.getAttribute('data-dest'); buildPoster(); } break;
      case 'poster-kind': if (poster && poster.kind !== a.getAttribute('data-kind')) { poster.kind = a.getAttribute('data-kind'); buildPoster(); } break;
      case 'poster-share': sharePoster(); break;
      case 'lead-seller': {
        var ld = (leads || []).filter(function (l) { return l.id === id; })[0]; if (!ld) break;
        sellerForm = { name: ld.name || '', phone: ld.phone || '', code: suggestCode(ld.name), zone: ld.zone || '', recruitedBy: ld.ref && sellersMap[ld.ref] ? ld.ref : '', email: ld.email || '', leadId: ld.id };
        adminTab = 'vendedores'; render(); setTimeout(function () { var el = document.getElementById('new-seller'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
        break;
      }
      case 'copy': {
        var txt = a.getAttribute('data-text');
        var ok = function () { var old = a.textContent; a.textContent = 'Copiado'; setTimeout(function () { a.textContent = old; }, 1600); };
        try { navigator.clipboard.writeText(txt).then(ok, function () { var inp = a.parentNode.querySelector('input'); if (inp) { inp.focus(); inp.select(); } }); }
        catch (er) { var inp2 = a.parentNode.querySelector('input'); if (inp2) { inp2.focus(); inp2.select(); } }
        break;
      }
      case 'zone-add': cfgDraft.shipping.zones = (cfgDraft.shipping.zones || []).concat([{ name: '', cost: 0, eta: '' }]); render(true); setTimeout(function () { var el = document.getElementById('zn-' + (cfgDraft.shipping.zones.length - 1)); if (el) el.focus(); }, 0); break;
      case 'zone-del': cfgDraft.shipping.zones.splice(Number(a.getAttribute('data-i')), 1); render(true); break;
      case 'load-orders': orders = null; render(true); loadOrders(); break;
      case 'ofilter': oFilter = a.getAttribute('data-f'); render(true); break;
      case 'seed': seed(); break;
      case 'export-x': exportProducts(false); break;
      case 'template-x': exportProducts(true); break;
      case 'close-import': if (!importer || !importer.busy) { importer = null; render(true); } break;
      case 'do-import': doImport(); break;
      case 'print-rem': { var pr = (orders || []).filter(function (o) { return o.id === id; })[0]; if (pr) printRemitos([pr]); break; }
      case 'print-rem-all': printRemitos(filteredOrders().filter(function (o) { return o.status !== 'cancelado'; })); break;
      case 'print-pick': printPicking(filteredOrders()); break;
      case 'catpdf': openCatPdf(a.getAttribute('data-code') || ''); break;
      case 'close-catpdf': if (catPdf && !catPdf.busy) { if (catPdf.url) URL.revokeObjectURL(catPdf.url); catPdf = null; render(true); } break;
      case 'catpdf-go': buildCatPdf(); break;
      case 'catpdf-share': shareCatPdf(); break;
      case 'catpdf-dest': if (catPdf && !catPdf.busy) { catPdf.dest = a.getAttribute('data-dest'); catPdf.url = null; render(true); } break;
      case 'bases': drawRes = { bases: true }; render(true); break;
      case 'close-draw': drawRes = null; render(true); break;
      case 'draw': {
        var dmk = a.getAttribute('data-month');
        if (a.getAttribute('data-confirm') !== '1') { a.setAttribute('data-confirm', '1'); a.textContent = (lastDraw && lastDraw.month === dmk ? 'Ya hay ganador: ¿sortear de nuevo?' : '¿Sortear ' + monthName(dmk) + '? Tocá de nuevo'); break; }
        runDraw(dmk); break;
      }
      case 'redeem-open': redeemFor = a.getAttribute('data-ph') || null; render(true); break;
      case 'redeem': redeem(a.getAttribute('data-ph'), Number(a.getAttribute('data-i'))); break;
      case 'free-chance': freeChance(); break;
      case 'rw-add': cfgDraft.loyalty.rewards.push({ pts: 500, label: '' }); render(true); break;
      case 'rw-del': cfgDraft.loyalty.rewards.splice(Number(a.getAttribute('data-i')), 1); render(true); break;
      case 'pay-mp': payMP(id, a); break;
      case 'pay-link': { var po = (orders || []).filter(function (o) { return o.id === id; })[0]; if (po) payLink(po, a); break; }
      case 'pay-manual': { var pm = (orders || []).filter(function (o) { return o.id === id; })[0]; if (pm) payManual(pm, a); break; }
      case 'cats': catMgr = { edit: -1, del: -1, newVal: '' }; render(true); setTimeout(function () { var el = document.getElementById('cat-new'); if (el) el.focus(); }, 0); break;
      case 'close-cats': if (catMgr && !catMgr.busy) { catMgr = null; render(true); } break;
      case 'cat-cancel': catMgr.edit = -1; catMgr.del = -1; render(true); break;
      case 'cat-edit': catMgr.edit = Number(a.getAttribute('data-i')); catMgr.del = -1; catMgr.editVal = cfg.categories[catMgr.edit]; render(true); setTimeout(function () { var el = document.getElementById('cat-edit'); if (el) { el.focus(); el.select(); } }, 0); break;
      case 'cat-rename': {
        var ri = Number(a.getAttribute('data-i')), oldN = cfg.categories[ri], newN = cleanCatName(catMgr.editVal);
        if (newN.length < 2) { showToast('Escribí el nombre del rubro.'); break; }
        if (newN === oldN) { catMgr.edit = -1; render(true); break; }
        if (catExists(newN, ri)) { showToast('Ya hay un rubro con ese nombre.'); break; }
        var nl = cfg.categories.slice(); nl[ri] = newN; var rm = {}; rm[oldN] = newN;
        saveCats(nl, rm, function () { showToast('Rubro renombrado' + (catCount(newN) ? ': ' + catCount(newN) + ' productos actualizados.' : '.')); });
        break;
      }
      case 'cat-up': case 'cat-down': {
        var ui = Number(a.getAttribute('data-i')), uj = ui + (act === 'cat-up' ? -1 : 1), ul = cfg.categories.slice();
        if (uj < 0 || uj >= ul.length) break;
        var tmp = ul[ui]; ul[ui] = ul[uj]; ul[uj] = tmp; saveCats(ul, null); break;
      }
      case 'cat-del': { catMgr.del = Number(a.getAttribute('data-i')); catMgr.edit = -1; var dc = cfg.categories[catMgr.del]; catMgr.moveTo = cfg.categories.filter(function (x) { return x !== dc; })[0] || ''; render(true); break; }
      case 'cat-del-ok': {
        var di = Number(a.getAttribute('data-i')), dn = cfg.categories[di], dl = cfg.categories.filter(function (x, k) { return k !== di; }), drm = {};
        if (catCount(dn)) { var mv = (document.getElementById('cat-move') || {}).value || catMgr.moveTo; if (!mv) break; drm[dn] = mv; }
        saveCats(dl, drm, function () { showToast('Rubro “' + dn + '” eliminado' + (drm[dn] ? '; sus productos pasaron a ' + drm[dn] + '.' : '.')); });
        break;
      }
      case 'e-cat-create': if (editing) addCat(editing._newCatVal, function (n) { editing.cat = n; editing._newCat = false; editing._newCatVal = ''; }); break;
      case 'labels': openLabels(); break;
      case 'close-labels': labels = null; render(true); break;
      case 'lab-size': labels.size = a.getAttribute('data-size'); render(true); break;
      case 'lab-print': printLabels(); break;
      case 'play-yt': { var vc = a.closest('.video-card'); if (vc) vc.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(vc.getAttribute('data-yt')) + '?autoplay=1&rel=0" title="Video del depósito" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>'; break; }
      case 'g-add': cfgDraft.trust.guarantees.push({ t: '', d: '' }); render(true); break;
      case 'g-del': cfgDraft.trust.guarantees.splice(Number(a.getAttribute('data-i')), 1); render(true); break;
      case 'tl-add': cfgDraft.tiers.levels.push({ name: '', min: 0, shipOff: 0, ptsMult: 1, perk: '' }); render(true); break;
      case 'tl-del': cfgDraft.tiers.levels.splice(Number(a.getAttribute('data-i')), 1); render(true); break;
      case 'recalc-tiers': recalcTiers(a); break;
      case 'audit-reload': auditList = null; errList = null; render(true); break;
      case 'audit-f': auditFilter = a.getAttribute('data-f') || ''; render(true); break;
      case 'backup': exportAll(a); break;
      case 'install': if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; render(true); }).catch(function () {}); } break;
      case 'install-x': try { localStorage.setItem('galpon-install-x', String(Date.now() + 14 * 864e5)); } catch (er) {} render(true); break;
      case 'seller-order': {
        var key = a.getAttribute('data-ph'), sc2 = null;
        (sellerData && sellerData.orders || []).forEach(function (o) { if (!sc2 && (digits(o.phone) === key || o.name === key)) sc2 = { name: o.name, phone: o.phone, barrio: o.barrio }; });
        if (sc2) sellerOrderFor(sc2); break;
      }
      case 'plow': pLow = !pLow; render(true); break;
      case 'new-prod': editing = blankProduct(); render(true); break;
      case 'cat-go': e.preventDefault(); cat = a.getAttribute('data-cat'); go('catalogo'); break;
      case 'edit-prod': { var ep = prodById(id); if (ep) { editing = clone(ep); render(true); } break; }
      case 'close-edit': editing = null; render(true); break;
      case 'save-prod': saveProduct(false); break;
      case 'save-prod-next': saveProduct(true); break;
      case 'del-prod': deleteProduct(); break;
      case 'cfg-save': saveCfg(); break;
      case 'cfg-discard': cfgDraft = cfgBase(); render(true); break;
      case 'add-member': addMember(); break;
      case 'del-member':
        if (a.getAttribute('data-confirm') !== '1') { a.setAttribute('data-confirm', '1'); a.textContent = '¿Quitar? Tocá de nuevo'; break; }
        fb.db.collection('team').doc(id).delete().then(function () { team = null; loadTeam(); setToast('Quitado del equipo.'); logAudit('equipo', 'Quitó a ' + id); }).catch(function () { setToast('No se pudo quitar.'); });
        break;
    }
  });
  function selectText(id) {
    var el = document.getElementById(id); if (!el) return;
    var r = document.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function refreshCfgBar() {
    var sb = document.querySelector('.savebar');
    if (!sb || !cfgDraft) return;
    var changed = JSON.stringify(cfgDraft) !== JSON.stringify(cfgBase());
    sb.querySelector('.savebar-msg').innerHTML = changed ? '<b>Tenés cambios sin publicar.</b>' : 'Todo publicado.';
    sb.querySelectorAll('button').forEach(function (b) { b.disabled = !changed || busy; });
  }
  function setPath(obj, path, value) {
    var parts = path.split('.'), o = obj;
    for (var i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null) o[parts[i]] = {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = value;
  }
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'q') { query = t.value; render(true); return; }
    if ((t.id === 'pz-title' || t.id === 'pz-sub') && poster) { poster[t.id === 'pz-title' ? 'title' : 'subtitle'] = t.value; buildPoster(700); return; }
    if (t.id === 'pq') { pq = t.value; render(true); return; }
    if (t.hasAttribute('data-ct')) { contactForm[contactType + '.' + t.getAttribute('data-ct')] = t.value; return; }
    if (t.hasAttribute('data-brand-name') && cfgDraft) { cfgDraft.brands[Number(t.getAttribute('data-brand-name'))].name = t.value; refreshCfgBar(); return; }
    if (t.id === 'rq') { rq = t.value; render(true); return; }
    if (t.hasAttribute('data-sf') && sellerForm) {
      var sk = t.getAttribute('data-sf');
      sellerForm[sk] = sk === 'code' ? cleanCode(t.value) : t.value;
      if (sk === 'code') { sellerForm._codeTouched = true; if (t.value !== sellerForm.code) t.value = sellerForm.code; }
      if (sk === 'name' && !sellerForm._codeTouched) { sellerForm.code = suggestCode(t.value); var ce = document.getElementById('sf-code'); if (ce) ce.value = sellerForm.code; }
      return;
    }
    if (t.hasAttribute('data-ccat') && cfgDraft) {
      var cc = t.getAttribute('data-ccat'); cfgDraft.commissions.byCat = cfgDraft.commissions.byCat || {};
      if (t.value === '') delete cfgDraft.commissions.byCat[cc]; else cfgDraft.commissions.byCat[cc] = Number(t.value);
      refreshCfgBar(); return;
    }
    if (t.hasAttribute('data-zone') && cfgDraft) {
      var zi = Number(t.getAttribute('data-zone')), zf = t.getAttribute('data-zf');
      cfgDraft.shipping.zones[zi][zf] = zf === 'cost' ? (Number(t.value) || 0) : t.value;
      refreshCfgBar(); return;
    }
    if (t.id === 'l-email') { loginEmail = t.value; return; }
    if (t.id === 'l-pass') { loginPass = t.value; return; }
    if (t.id === 'l-name') { loginName = t.value; return; }
    if (t.id === 'cat-new' && catMgr) { catMgr.newVal = t.value; return; }
    if (t.id === 'cat-edit' && catMgr) { catMgr.editVal = t.value; return; }
    if (t.id === 'cat-move' && catMgr) { catMgr.moveTo = t.value; return; }
    if (t.id === 'e-newcat' && editing) { editing._newCatVal = t.value; return; }
    if (t.id === 'e-newsub' && editing) { editing._newSubVal = t.value; return; }
    if (t.id === 'sub-edit' && catMgr && catMgr.subEdit) { catMgr.subEdit.val = t.value; return; }
    if (t.id === 'e-sub' && editing && t.value === '__newsub') { editing._newSub = true; render(true); setTimeout(function () { var el = document.getElementById('e-newsub'); if (el) el.focus(); }, 0); return; }
    if (t.id === 'e-cat' && editing && t.value !== '__new') { editing.cat = t.value; if (subsOf(t.value).indexOf(editing.sub) === -1) editing.sub = ''; render(true); return; }
    if (t.id === 'e-cat' && editing && t.value === '__new') { editing._newCat = true; render(true); setTimeout(function () { var el = document.getElementById('e-newcat'); if (el) el.focus(); }, 0); return; }
    if (t.id === 'lab-copies' && labels) { labels.copies = Math.min(24, Math.max(1, Math.round(Number(t.value) || 1))); var lb = document.querySelector('[data-act=lab-print]'); if (lb) lb.textContent = 'Imprimir ' + (labels.sel.length * labels.copies) + ' etiquetas'; return; }
    if (t.id === 'lab-q' && labels) { labels.q = t.value; render(true); return; }
    if (t.hasAttribute('data-g') && cfgDraft) { cfgDraft.trust.guarantees[Number(t.getAttribute('data-g'))][t.getAttribute('data-gf')] = t.value; refreshCfgBar(); return; }
    if (t.hasAttribute('data-tl') && cfgDraft) { var tlf = t.getAttribute('data-tf'); cfgDraft.tiers.levels[Number(t.getAttribute('data-tl'))][tlf] = tlf === 'name' || tlf === 'perk' ? t.value : Number(t.value) || 0; refreshCfgBar(); return; }
    if (t.hasAttribute('data-ff')) { freeForm[t.getAttribute('data-ff')] = t.value; return; }
    if (t.hasAttribute('data-rw') && cfgDraft) { var rwi = Number(t.getAttribute('data-rw')), rwf = t.getAttribute('data-rf'); cfgDraft.loyalty.rewards[rwi][rwf] = rwf === 'pts' ? (Number(t.value) || 0) : t.value; refreshCfgBar(); return; }
    if (t.id === 'l-phone') { loginPhone = t.value; return; }
    if (t.hasAttribute('data-cf') && custForm) { custForm[t.getAttribute('data-cf')] = t.value; if (t.tagName === 'SELECT') render(true); return; }
    if (t.hasAttribute('data-buyer')) {
      var bk = t.getAttribute('data-buyer');
      buyer[bk] = bk === 'ref' ? cleanCode(t.value) : t.value; persistCart();
      if (bk === 'mode' || bk === 'zone') { render(true); return; }
      var btn = document.getElementById('send-order'), hint = document.getElementById('send-hint');
      var cs = checkoutState();
      if (btn) btn.disabled = !cs.ready;
      if (hint) hint.textContent = cs.hint;
      return;
    }
    if (t.hasAttribute('data-e') && editing) {
      var k = t.getAttribute('data-e');
      editing[k] = t.type === 'checkbox' ? t.checked : (k === 'qty' ? (t.value === '' ? null : Number(t.value)) : t.type === 'number' ? (Number(t.value) || 0) : t.value);
      var g = document.getElementById('e-gain'); if (g) g.textContent = 'Ganancia del revendedor: ' + money(gain(editing));
      var oh = document.getElementById('e-offer-hint'); if (oh) oh.textContent = offerHint(editing);
      if (k === 'sku') { var sh = document.getElementById('e-sku-hint'); if (sh) { var tk = skuTaken(cleanSku(editing.sku), editing.id); sh.textContent = tk ? 'Ese SKU ya lo tiene otro producto.' : 'El que usás en el depósito. Aparece en cada pedido.'; sh.classList.toggle('warn', tk); } }
      if (k === 'combo' || k === 'stock') render(true);
      return;
    }
    if (t.hasAttribute('data-c') && cfgDraft) {
      setPath(cfgDraft, t.getAttribute('data-c'), t.type === 'checkbox' ? t.checked : (t.type === 'number' ? (Number(t.value) || 0) : t.value));
      refreshCfgBar();
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type === 'checkbox' || t.tagName === 'SELECT') t.dispatchEvent(new Event('input', { bubbles: true }));
    if (t.id === 'rsort') { rSort = t.value; render(true); return; }
    if (t.hasAttribute('data-catpdf') && catPdf) { var cc2 = t.getAttribute('data-catpdf'), ci = catPdf.cats.indexOf(cc2); if (t.checked && ci === -1) catPdf.cats.push(cc2); if (!t.checked && ci !== -1) catPdf.cats.splice(ci, 1); catPdf.url = null; render(true); return; }
    if (t.hasAttribute('data-lab') && labels) { var lid2 = t.getAttribute('data-lab'), lix = labels.sel.indexOf(lid2); if (t.checked && lix === -1) labels.sel.push(lid2); if (!t.checked && lix !== -1) labels.sel.splice(lix, 1); render(true); return; }
    if (t.id === 'catpdf-stock' && catPdf) { catPdf.onlyStock = t.checked; catPdf.url = null; render(true); return; }
    if (t.hasAttribute('data-pick') && poster) {
      var pid = t.getAttribute('data-pick'), ix = poster.sel.indexOf(pid);
      if (t.checked && ix === -1 && poster.sel.length < 6) poster.sel.push(pid);
      if (!t.checked && ix !== -1) poster.sel.splice(ix, 1);
      buildPoster(150); return;
    }
    if (t.id === 'pz-src' && poster) {
      poster.source = t.value; poster.sel = promoPool(t.value).slice(0, 6).map(function (p) { return p.id; });
      buildPoster(); return;
    }
    if (t.hasAttribute('data-rnote') && fb) {
      var rk = t.getAttribute('data-rnote'), nv = t.value.slice(0, 300);
      fb.db.collection('resellers').doc(rk).set({ note: nv, updatedBy: user ? user.email : '', updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).then(function () {
        notes = notes || {}; notes[rk] = { note: nv }; setToast('Nota guardada.', true);
      }).catch(function () { setToast('No se pudo guardar la nota.', true); });
      return;
    }
    if (t.hasAttribute('data-quick') && fb) {
      var qp = prodById(t.getAttribute('data-id')), field = t.getAttribute('data-quick');
      if (!qp) return;
      var val = field === 'stock' ? t.value : field === 'qty' ? (t.value === '' ? null : Math.max(0, Math.round(Number(t.value) || 0))) : (Number(t.value) || 0);
      if (field !== 'stock' && field !== 'qty' && !(val > 0)) { t.value = qp[field]; setToast('El precio tiene que ser mayor a 0.', true); return; }
      var upd = {}; upd[field] = val;
      if (field === 'qty' || field === 'stock') upd.stock = deriveStock(Object.assign({}, qp, upd));
      fb.db.collection('products').doc(qp.id).update(upd).then(function () {
        var oldV = qp[field]; logAudit(field === 'price' || field === 'sug' ? 'precio' : 'stock', qp.name + ': ' + ({ price: 'precio', sug: 'sugerido', qty: 'unidades', stock: 'stock' }[field] || field) + ' ' + (oldV == null ? '—' : oldV) + ' → ' + (val == null ? '—' : val), { pid: qp.id });
        Object.assign(qp, upd); setToast('Guardado: ' + qp.name + (field === 'stock' && tracked(qp) && upd.stock !== val ? ' (el stock se calcula con las unidades)' : ''), true);
        if (upd.stock !== undefined) render(true);
      }).catch(function () { t.value = qp[field]; setToast('No se pudo guardar el cambio.', true); });
      return;
    }
    if (t.hasAttribute('data-lead') && fb) {
      var lid = t.getAttribute('data-lead'), lst = t.value;
      fb.db.collection('leads').doc(lid).update({ status: lst }).then(function () {
        (leads || []).forEach(function (l) { if (l.id === lid) l.status = lst; }); render(true);
      }).catch(function () { setToast('No se pudo cambiar el estado.'); });
      return;
    }
    if (t.hasAttribute('data-order') && fb) {
      var oid = t.getAttribute('data-order');
      var ord = (orders || []).filter(function (o) { return o.id === oid; })[0];
      if (ord) changeStatus(ord, t.value, t);
      return;
    }
    if (t.hasAttribute('data-assign') && fb) {
      var aid = t.getAttribute('data-assign');
      var ao = (orders || []).filter(function (o) { return o.id === aid; })[0];
      if (ao) assignSeller(ao, t.value, t);
      return;
    }
    if (t.hasAttribute('data-import') && t.files && t.files[0]) { readExcel(t.files[0]); t.value = ''; return; }
    if (t.type === 'file' && t.files && t.files[0]) {
      var file = t.files[0];
      if (t.hasAttribute('data-edit-img') && editing) {
        var ed = editing; ed._uploading = true; render(true);
        processUpload(file, 1, 900).then(function (u) { ed.img = u; ed._uploading = false; render(true); })
          .catch(function () { ed._uploading = false; setToast('No se pudo leer esa imagen. Probá con JPG o PNG.'); });
      } else if (t.hasAttribute('data-brand-logo') && cfgDraft) {
        var bidx = Number(t.getAttribute('data-brand-logo'));
        setToast('Subiendo logo…');
        readFile(file).then(function (src) { return fitImage(src, 480, 240); }).then(uploadImage).then(function (u) {
          cfgDraft.brands[bidx].logo = u; setToast('Logo listo. Tocá “Guardar y publicar”.');
        }).catch(function () { setToast('No se pudo leer ese logo. Probá con PNG o JPG.'); });
      } else if (t.hasAttribute('data-cfg-img') && cfgDraft) {
        var key = t.getAttribute('data-cfg-img');
        setToast('Subiendo foto…');
        processUpload(file, key === 'hero' ? 1.5 : 1, key === 'hero' ? 1400 : 900).then(function (u) {
          cfgDraft.images[key] = u; setToast('Foto lista. Tocá “Guardar y publicar”.');
        }).catch(function () { setToast('No se pudo leer esa imagen.'); });
      }
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'login-form') { e.preventDefault(); emailLogin(); }
    if (e.target && e.target.id === 'contact-form') { e.preventDefault(); submitContact(); }
    if (e.target && e.target.id === 'cat-add-form') { e.preventDefault(); if (catMgr && !catMgr.busy) addCat(catMgr.newVal, function () { catMgr.newVal = ''; }); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (labels) labels = null; else if (catMgr && !catMgr.busy) catMgr = null; else if (poster) poster = null; else if (editing) editing = null; else if (share) share = null; else if (detailId) { detailId = null; setHash(view); } else if (cartOpen) cartOpen = false; else return;
    render(true);
  });
  window.addEventListener('hashchange', function () {
    var prev = view; readHash();
    if (!(location.hash || '').match(/^#producto-/)) detailId = null;
    render(prev === view);
  });

