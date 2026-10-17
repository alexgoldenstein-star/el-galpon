  /* ================= panel ================= */
  var loginMode = 'login'; // login | signup | reset
  var loginMsg = '';
  var loginEmail = '', loginPass = '', loginName = '', loginPhone = '';
  var pendingProfile = null;   // datos del registro hasta que se guarda la ficha
  function loginPanel() {
    if (!authReady) return '<div class="wrap admin"><div class="panel" style="max-width:460px"><p>Cargando…</p></div></div>';
    if (user) {
      // Sesión iniciada pero sin acceso al panel (solo llega acá si entró por #admin)
      return '<div class="wrap admin"><div class="panel" style="max-width:520px"><h2>Panel</h2>' +
        (user.emailVerified ? '<p>Entraste como <b>' + esc(user.email) + '</b>, pero esa cuenta no tiene acceso al panel. Si sos vendedor o del equipo, pedí que te sumen con este mismo mail.</p>'
          : verifyBox()) +
        '<div class="ctas"><a class="btn btn-main btn-sm" href="#cuenta" data-go="cuenta">Ir a mi cuenta</a><button class="btn btn-line btn-sm" type="button" data-act="logout">Salir</button></div>' +
        (loginMsg ? '<p class="login-msg">' + esc(loginMsg) + '</p>' : '') + '</div></div>';
    }
    var signup = loginMode === 'signup', reset = loginMode === 'reset';
    var title = signup ? 'Creá tu cuenta' : reset ? 'Recuperar contraseña' : 'Ingresá a tu cuenta';
    var sub = signup ? 'Es gratis. Si sos vendedor o del equipo, usá el mismo mail con el que te sumamos.'
      : reset ? 'Te mandamos un link para crear una contraseña nueva.'
      : 'Clientes, vendedores y equipo entran por acá.';
    var form = '<form id="login-form" class="login-form" novalidate>' +
      (signup ? '<div class="fld"><label for="l-name">Tu nombre</label><input id="l-name" autocomplete="name" required value="' + esc(loginName) + '"></div>' +
        '<div class="fld"><label for="l-phone">Tu WhatsApp</label><input id="l-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="11 2345-6789" required value="' + esc(loginPhone) + '"></div>' : '') +
      '<div class="fld"><label for="l-email">Mail</label><input id="l-email" type="email" autocomplete="email" required value="' + esc(loginEmail) + '"></div>' +
      (!reset ? '<div class="fld"><label for="l-pass">Contraseña' + (signup ? ' (mínimo 6 caracteres)' : '') + '</label><input id="l-pass" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" required value="' + esc(loginPass) + '"></div>' : '') +
      '<button class="btn btn-main" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Un momento…' : signup ? 'Crear mi cuenta' : reset ? 'Mandarme el link' : 'Ingresar') + '</button>' +
      '</form>' +
      (loginMsg ? '<p class="login-msg">' + esc(loginMsg) + '</p>' : '') +
      '<div class="login-links">' +
      (loginMode !== 'login' ? '<button type="button" class="linkbtn" data-act="mode" data-mode="login">Ya tengo cuenta: ingresar</button>'
        : '<button type="button" class="linkbtn" data-act="mode" data-mode="signup">No tengo cuenta: crearla</button><button type="button" class="linkbtn" data-act="mode" data-mode="reset">Olvidé mi contraseña</button>') +
      '</div>' +
      (reset ? '' : '<div class="login-sep"><span>o</span></div><button class="btn btn-line" type="button" data-act="login">' + gIcon() + 'Seguir con Google</button>');
    var perks = '<div class="login-perks"><span class="eyebrow">Tu cuenta</span><h2>Seguí tus pedidos sin preguntar</h2><ul class="rules">' +
      ['Mirá en qué estado está cada pedido: recibido, confirmado, listo o entregado.', 'Repetí un pedido anterior con un toque.', 'Tus datos quedan cargados: pedís más rápido.', 'Vendedores: entran a su panel con link, QR, promos y comisiones.'].map(function (x) { return '<li>' + ic('check', 18) + '<span>' + x + '</span></li>'; }).join('') +
      '</ul>' + (refName ? '<div class="ref-chip">' + ic('users', 18) + '<span>Te atiende <b>' + esc(refName) + '</b>: queda guardado en tu cuenta.</span></div>' : '') + '</div>';
    return '<div class="wrap login-wrap"><div class="panel login-card"><h1 class="h2">' + title + '</h1><p class="login-sub">' + sub + '</p>' + form + '</div>' + perks + '</div>';
  }
  function gIcon() {
    return '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  }
  function verifyBox() {
    return '<div class="verify-box"><p><b>¿Sos vendedor o del equipo?</b> Verificá tu mail para entrar a tu panel: te mandamos un link a <b>' + esc(user.email) + '</b> (revisá también correo no deseado).</p>' +
      '<div class="ctas"><button class="btn btn-dark btn-sm" type="button" data-act="verified">Ya verifiqué</button><button class="btn btn-line btn-sm" type="button" data-act="resend">Reenviar mail</button></div></div>';
  }
