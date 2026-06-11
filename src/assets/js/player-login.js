/* player-login.js — auth form logic for /player/login/ */
(function () {
  'use strict';
  var db = window.__supabase;

  // Already signed in? Go straight to dashboard (or ?next= destination).
  // Validate next= is a relative path (starts with / but not //) to prevent open redirects.
  function safeNext(params) {
    var n = params.get('next') || '';
    return (n && /^\/(?!\/)/.test(n)) ? n : '/player/dashboard/';
  }

  db.auth.getSession().then(function (r) {
    if (r.data.session) {
      location.replace(safeNext(new URLSearchParams(location.search)));
    }
  });

  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.auth-tab').forEach(function (b) {
        b.classList.remove('auth-tab--active');
      });
      btn.classList.add('auth-tab--active');
      document.getElementById('form-signin').style.display  = btn.dataset.tab === 'signin'   ? '' : 'none';
      document.getElementById('form-register').style.display = btn.dataset.tab === 'register' ? '' : 'none';
      clearStatus();
    });
  });

  function showStatus(msg, type) {
    var el = document.getElementById('auth-status');
    el.textContent = msg;
    el.className = 'auth-status auth-status--' + (type || 'error');
    el.style.display = '';
  }
  function clearStatus() {
    var el = document.getElementById('auth-status');
    el.style.display = 'none';
    el.textContent = '';
  }

  function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  // Sign in
  document.getElementById('form-signin').addEventListener('submit', async function (e) {
    e.preventDefault();
    var email    = document.getElementById('signin-email').value.trim();
    var password = document.getElementById('signin-password').value;
    if (!email)               { showStatus('Please enter your email address.', 'error'); return; }
    if (!isValidEmail(email)) { showStatus('Please enter a valid email address.', 'error'); return; }
    if (!password)            { showStatus('Please enter your password.', 'error'); return; }
    showStatus('Signing in…', 'info');
    var result = await db.auth.signInWithPassword({ email: email, password: password });
    if (result.error) {
      showStatus(result.error.message, 'error');
    } else {
      location.replace(safeNext(new URLSearchParams(location.search)));
    }
  });

  // Register
  document.getElementById('form-register').addEventListener('submit', async function (e) {
    e.preventDefault();
    var name     = document.getElementById('reg-name').value.trim();
    var email    = document.getElementById('reg-email').value.trim();
    var password = document.getElementById('reg-password').value;
    if (!name)                { showStatus('Please enter a display name.', 'error'); return; }
    if (!email)               { showStatus('Please enter your email address.', 'error'); return; }
    if (!isValidEmail(email)) { showStatus('Please enter a valid email address.', 'error'); return; }
    if (password.length < 8)  { showStatus('Password must be at least 8 characters.', 'error'); return; }
    showStatus('Creating account…', 'info');
    var result = await db.auth.signUp({
      email: email,
      password: password,
      options: { data: { display_name: name } }
    });
    if (result.error) {
      showStatus(result.error.message, 'error');
    } else if (result.data.session) {
      location.replace('/player/dashboard/');
    } else {
      showStatus('Confirmation email sent to ' + email + '. Check your inbox (and spam folder), then return here to sign in.', 'info');
    }
  });
})();
