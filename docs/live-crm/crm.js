/**
 * BioLabs Research CRM — shared page shell (phase 3, 2026-09-05).
 * Loaded by every migrated page after crm-utils.js and before auth.js:
 *     <script src="crm-utils.js"></script>
 *     <script src="crm.js"></script>
 *     <script src="auth.js"></script>
 * Ordinary script, not a module. Everything lives inside one IIFE and only the names below reach the page,
 * so a page may still declare its own `const API`, `let token`, ... without colliding.
 *
 *   api(path, opts)          fetch with Bearer, JSON in/out, 401 -> login, errors -> toast + throw
 *                            opts: {method, body, headers, toast:false, on401:'throw' (keep the session), raw:true (get the Response)}
 *   toast(msg, type, ms)     also exported as showToast(msg, type)
 *   confirmDialog(msg, opts) Promise<boolean> on the crm.css modal (pages that use native confirm() keep it)
 *   fmtMoney(n) fmtDate(v)   the formatters copied across pages until now
 *   renderNav(activeKey)     the single menu; call it as the first line of the page script
 *   logout()                 POST /api/logout, clear the session, go to the login page
 *   initPwa()                service worker + install banner + standalone splash (runs by itself)
 */
(function (global) {
  'use strict';

  var LOGIN_URL = '/crm/login.html';

  function token() {
    try { return localStorage.getItem('crm_token') || ''; } catch (e) { return ''; }
  }
  function clearSession() {
    try { localStorage.removeItem('crm_token'); localStorage.removeItem('crm_user'); } catch (e) {}
  }

  /* ── toast ───────────────────────────────────────────────────────────── */
  function toastEl() {
    var el = document.getElementById('crm-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'crm-toast';
      el.className = 'toast';
      (document.body || document.documentElement).appendChild(el);
    }
    return el;
  }
  function toast(msg, type, ms) {
    var el = toastEl();
    el.textContent = msg === null || msg === undefined ? '' : String(msg);
    el.className = 'toast show ' + (type || 'success');
    if (el._crmTimer) clearTimeout(el._crmTimer);
    el._crmTimer = setTimeout(function () { el.className = 'toast'; }, ms || 3000);
  }

  /* ── api ─────────────────────────────────────────────────────────────── */
  function hasHeader(h, name) {
    for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k) && k.toLowerCase() === name) return true;
    return false;
  }
  function apiError(msg, status, showToast) {
    var e = new Error(msg);
    e.status = status;
    if (showToast) toast(msg, 'error');
    return e;
  }
  async function api(path, opts) {
    opts = opts || {};
    var showToast = opts.toast !== false;
    var headers = { 'Authorization': 'Bearer ' + token() };
    if (opts.headers) for (var k in opts.headers) if (Object.prototype.hasOwnProperty.call(opts.headers, k)) headers[k] = opts.headers[k];
    var init = { method: opts.method || 'GET', headers: headers };
    var body = opts.body;
    if (body !== undefined && body !== null) {
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        init.body = body;                       // let the browser set multipart/form-data with its boundary
      } else {
        if (!hasHeader(headers, 'content-type')) headers['Content-Type'] = 'application/json';
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
    }

    var res;
    try {
      res = await fetch(path, init);
    } catch (e) {
      throw apiError('Cannot reach the server', 0, showToast);
    }

    // on401:'throw' — the caller knows a 401 can mean something other than a dead session (a wrong current
    // password, say): keep the session, fall through and report the server's own message below.
    if (res.status === 401 && opts.on401 !== 'throw') {
      clearSession();
      global.location.href = LOGIN_URL;         // no toast: the page is leaving anyway
      throw apiError('Session expired', 401, false);
    }
    // nginx or a restarting backend, not an expired session: the body is usually HTML, so do not parse it.
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw apiError('Server unavailable — please try again in a minute', res.status, showToast);
    }
    // raw: hand a successful response over unread (the caller wants its headers); errors still need the body.
    if (res.ok && opts.raw) return res;

    var text = '';
    try { text = await res.text(); } catch (e) { text = ''; }
    var data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }

    if (!res.ok) {
      var msg = data && data.error ? String(data.error) : 'HTTP ' + res.status;
      throw apiError(msg, res.status, showToast);
    }
    return data;
  }

  /* ── confirm dialog ──────────────────────────────────────────────────── */
  function confirmDialog(msg, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay open';
      overlay.innerHTML =
        '<div class="modal" style="width:420px">' +
          '<div class="modal-header"><div class="modal-info"><div class="modal-title"></div></div></div>' +
          '<div class="modal-footer"><div class="modal-footer-left"></div><div class="modal-footer-right">' +
            '<button type="button" class="btn-cancel" data-crm-confirm="0"></button>' +
            '<button type="button" class="btn btn-primary" data-crm-confirm="1"></button>' +
          '</div></div>' +
        '</div>';
      overlay.querySelector('.modal-title').textContent = msg === null || msg === undefined ? '' : String(msg);
      overlay.querySelector('[data-crm-confirm="0"]').textContent = opts.cancel || 'Cancel';
      overlay.querySelector('[data-crm-confirm="1"]').textContent = opts.ok || 'OK';

      function close(value) {
        document.removeEventListener('keydown', onKey, true);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(value);
      }
      function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(false); } }
      overlay.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-crm-confirm]') : null;
        if (btn) return close(btn.getAttribute('data-crm-confirm') === '1');
        if (e.target === overlay) close(false);
      });
      document.addEventListener('keydown', onKey, true);
      (document.body || document.documentElement).appendChild(overlay);
      var ok = overlay.querySelector('[data-crm-confirm="1"]');
      if (ok && ok.focus) ok.focus();
    });
  }

  /* ── formatters ──────────────────────────────────────────────────────── */
  function fmtMoney(n) { return '$' + Number(n || 0).toFixed(2); }
  function fmtDate(v) {
    if (!v) return 'never';
    var d = new Date(v);
    return isNaN(d.getTime()) ? 'never' : d.toLocaleString();
  }

  /* ── navigation ──────────────────────────────────────────────────────── */
  // One list for every page. `m: 1` = nav-mobile-hidden (not shown in the mobile bottom bar),
  // `admin: 1` = data-admin-only (auth.js hides it for non-admins); phase 7: Users is the only admin-only item.
  // Owner's flags, phase 3: communications.html and automations.html are static mock-ups and stay out of
  // the menu (HIDE_MOCKUPS); activity-log.html had no link at all and is added under Reports (ORPHANS = menu).
  var NAV = [
    { title: 'CRM', items: [
      { key: 'dashboard',    icon: '📊', label: 'Dashboard' },
      { key: 'leads',        icon: '👥', label: 'All Leads' },
      { key: 'orders',       icon: '📦', label: 'Orders' },
      { key: 'reports',      icon: '📈', label: 'Reports', m: 1 },
      { key: 'activity-log', icon: '📜', label: 'Activity Log', m: 1 },
      // M1 (2026-09-08): Campaigns and Segments left the menu and Marketing took their place. The two
      // pages are still on disk and still reachable by address — they belong to another author and are
      // not ours to delete; they are out of the menu because the panel behind them showed columns the
      // API never fills and three buttons that do nothing. Communications and Automations were already
      // out (phase 3 mock-ups).
      { key: 'marketing',    icon: '📣', label: 'Marketing' },
      // M2 (2026-09-08): our own Segments page. Not the agent's segments.html — that one builds rules over lead
      // fields the lead does not have and never reaches Customer.io (see the inventory, §4); this one segments the
      // same attributes the shop already sends and keeps a manual segment in Customer.io in step with them.
      { key: 'marketing-segments', icon: '🎯', label: 'Segments', m: 1 },
      { key: 'marketing-emails', icon: '📝', label: 'Emails', m: 1 },
      { key: 'marketing-newsletter', icon: '📨', label: 'Newsletter', m: 1 },
      { key: 'account',      icon: '👤', label: 'My Account' },
      { key: 'users',        icon: '🔑', label: 'Users', m: 1, admin: 1 }
    ] },
    { title: 'SALES', items: [
      { key: 'sales-dashboard',    icon: '💰', label: 'Sales Dashboard', m: 1 },
      { key: 'sales-entry',        icon: '🧾', label: 'Add Sale', m: 1 },
      { key: 'customers',          icon: '🧑‍🤝‍🧑', label: 'Customers' },
      { key: 'quotations',         icon: '📋', label: 'Quotations', m: 1 },
      { key: 'suppliers',          icon: '🏭', label: 'Suppliers', m: 1 },
      { key: 'supplier-statement', icon: '🧾', label: 'Supplier Statements', m: 1 },
      { key: 'purchase-orders',    icon: '🚚', label: 'Purchase Orders', m: 1 },
      { key: 'representatives',    icon: '👔', label: 'Representatives', m: 1 },
      { key: 'expenses',           icon: '💸', label: 'Expenses', m: 1 },
      { key: 'damaged-items',      icon: '⚠️', label: 'Damaged Items', m: 1 }
    ] },
    { title: 'STORE', items: [
      { key: 'inventory',      icon: '🏪', label: 'Products' },
      { key: 'store-orders',   icon: '🛒', label: 'Store Orders', m: 1 },
      { key: 'processors', icon: '🏦', label: 'Processors', m: 1, admin: 1 },
      { key: 'psp-clearing', icon: '💳', label: 'PSP Clearing', m: 1 },
      { key: 'abandoned-checkout', icon: '🧾', label: 'Abandoned checkout', m: 1 },
      { key: 'crypto-orders', icon: '🪙', label: 'Crypto payments', m: 1 },
      { key: 'store-messages', icon: '✉️', label: 'Messages', m: 1, id: 'nav-store-messages',
        extra: '<span class="nav-badge" id="msgBadgeNav" style="display:none"></span>' },
      { key: 'site-texts',     icon: '📄', label: 'Site texts', m: 1 },
      { key: 'store-settings', icon: '⚙️', label: 'Store Settings', m: 1 }
    ] }
  ];

  var LOGO_HTML =
    '<a href="/crm/dashboard.html" class="sidebar-logo">' +
      '<div class="logo-img"><img src="/crm/assets/biolabs-logo.png" alt="BioLabs Research" style="width:42px;height:42px;border-radius:12px;object-fit:cover;" /></div>' +
      '<div class="logo-text-box">' +
        '<div class="logo-name">BioLabs</div>' +
        '<div class="logo-tagline">Research CRM</div>' +
      '</div>' +
    '</a>';

  function currentKey() {
    var last = String(global.location.pathname || '').split('/').pop() || '';
    return last.replace(/\.html$/i, '') || 'dashboard';
  }

  function navItemHtml(item, active) {
    var cls = 'nav-item';
    if (item.m) cls += ' nav-mobile-hidden';
    if (item.key === active) cls += ' active';
    return '<a href="/crm/' + item.key + '.html"' +
      (item.id ? ' id="' + item.id + '"' : '') +
      (item.admin ? ' data-admin-only' : '') +
      ' class="' + cls + '">' +
      '<span class="nav-icon">' + item.icon + '</span> ' + item.label +
      (item.extra || '') + '</a>';
  }

  function renderNav(activeKey) {
    var box = document.getElementById('crm-nav');
    if (!box) return;
    var active = activeKey || currentKey();
    var html = LOGO_HTML + '<nav class="nav">';
    for (var s = 0; s < NAV.length; s++) {
      html += '<div class="nav-section-label">' + NAV[s].title + '</div>';
      for (var i = 0; i < NAV[s].items.length; i++) html += navItemHtml(NAV[s].items[i], active);
    }
    html += '<div class="sidebar-spacer"></div>' +
      '<a href="#" class="nav-mobile-hidden nav-item nav-signout" onclick="logout()"><span class="nav-icon">🚪</span> Sign Out</a>' +
      '</nav>';
    box.innerHTML = html;
  }

  /* ── logout ──────────────────────────────────────────────────────────── */
  function logout() {
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      clearSession();
      global.location.href = LOGIN_URL;
    }
    var ctl = null;
    try { ctl = new AbortController(); } catch (e) { ctl = null; }
    var timer = setTimeout(function () {
      if (ctl) { try { ctl.abort(); } catch (e) {} }
      finish();
    }, 2000);
    var init = { method: 'POST', headers: { 'Authorization': 'Bearer ' + token() } };
    if (ctl) init.signal = ctl.signal;
    Promise.resolve()
      .then(function () { return fetch('/api/logout', init); })
      .catch(function () {})
      .then(function () { clearTimeout(timer); finish(); });
    return false;
  }

  /* ── PWA: service worker, install banner, standalone splash ──────────── */
  var SPLASH_HTML =
    '<div id="pwa-splash"><div class="pwa-splash-logo-wrap">' +
      '<img src="/crm/assets/biolabs-logo.png" alt="BioLabs Research">' +
    '</div></div>';
  var BANNER_HTML =
    '<div id="pwa-install-banner">' +
      '<div class="pwa-banner-icon">📱</div>' +
      '<div class="pwa-banner-body">' +
        '<div class="pwa-banner-title">Install BioLabs Research</div>' +
        '<div class="pwa-banner-text">Add to home screen</div>' +
      '</div>' +
      '<div class="pwa-banner-btns">' +
        '<button class="pwa-banner-yes" onclick="showPWASteps()">Install</button>' +
        '<button class="pwa-banner-no" onclick="dismissPWA()">✕</button>' +
      '</div>' +
    '</div>' +
    '<div class="pwa-steps" id="pwa-steps">' +
      '<b>How to install:</b><br>' +
      '1. Tap the <b>Share</b> button (↑)<br>' +
      '2. Scroll down and tap <b>"Add to Home Screen"</b><br>' +
      '3. Tap <b>"Add"</b> - Done!<br>' +
      '<br>' +
      '<span style="font-size:11px;opacity:0.7;">Android: Chrome menu (⋮) → "Add to Home screen"</span>' +
    '</div>';

  function isStandalone() {
    return (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }

  function initSw() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) { r.update(); });
    }).catch(function () {});
    navigator.serviceWorker.register('/crm/sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (nw) {
          nw.addEventListener('statechange', function () {
            if (nw.state === 'activated') { global.location.reload(); }
          });
        }
      });
    }).catch(function () {});
  }

  function initSplash() {
    if (!isStandalone()) return;                // the page keeps no splash markup when not installed
    if (!document.body) { onReady(initSplash); return; }
    document.body.insertAdjacentHTML('beforeend', SPLASH_HTML);
    var splash = document.getElementById('pwa-splash');
    if (!splash) return;
    splash.classList.add('show');
    global.addEventListener('load', function () {
      setTimeout(function () {
        splash.classList.add('fade-out');
        setTimeout(function () { splash.style.display = 'none'; }, 450);
      }, 500);
    });
  }

  function initBanner() {
    // Only pages that carried the install banner before the shell (dashboard) declare <body data-pwa-banner>; the
    // other pages never showed it and keep their green FAB unobstructed.
    if (!document.body || !document.body.hasAttribute('data-pwa-banner') || document.getElementById('pwa-install-banner')) return;
    document.body.insertAdjacentHTML('beforeend', BANNER_HTML);
    global.dismissPWA = function () {
      var b = document.getElementById('pwa-install-banner');
      if (b) b.classList.remove('show');
      try { sessionStorage.setItem('pwa-dismissed', '1'); } catch (e) {}
    };
    global.showPWASteps = function () {
      var s = document.getElementById('pwa-steps');
      if (s) s.classList.add('show');
    };
    var isMobile = global.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    var dismissed = '';
    try { dismissed = sessionStorage.getItem('pwa-dismissed') || ''; } catch (e) {}
    if (isMobile && !dismissed && !isStandalone()) {
      setTimeout(function () {
        var b = document.getElementById('pwa-install-banner');
        if (b) b.classList.add('show');
      }, 3000);
    }
  }

  function initPwa() {
    initSw();
    initSplash();                                // as early as the old inline splash markup
    onReady(initBanner);                         // banner sat at the end of <body> before
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ── exports ─────────────────────────────────────────────────────────── */
  global.api = api;
  global.toast = toast;
  global.showToast = toast;
  global.confirmDialog = confirmDialog;
  global.fmtMoney = fmtMoney;
  global.fmtDate = fmtDate;
  global.renderNav = renderNav;
  global.logout = logout;
  global.initPwa = initPwa;

  initPwa();
  // Safety net: a page that forgets renderNav('<key>') in its script still gets the menu.
  onReady(function () {
    var box = document.getElementById('crm-nav');
    if (box && !box.innerHTML.trim()) renderNav();
  });
})(window);
