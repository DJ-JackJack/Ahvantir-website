/* player.js — Supabase client init + auth utilities
   Load AFTER the Supabase CDN script on every /player/* page. */
(function () {
  'use strict';

  var SUPABASE_URL = document.querySelector('meta[name="supabase-url"]').content;
  var SUPABASE_KEY = document.querySelector('meta[name="supabase-anon-key"]').content;

  var client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.__supabase = client;

  /* Redirect to /player/login/ if no active session.
     Pass withRedirect=true to bounce the user back after sign-in. */
  window.requireAuth = async function (withRedirect) {
    var result = await client.auth.getSession();
    if (!result.data.session) {
      var next = withRedirect
        ? '?next=' + encodeURIComponent(location.pathname + location.search)
        : '';
      location.replace('/player/login/' + next);
      return null;
    }
    return result.data.session;
  };

  /* Return the current user's profiles row, or null. */
  window.getProfile = async function () {
    var userResult = await client.auth.getUser();
    if (!userResult.data.user) return null;
    var profileResult = await client
      .from('profiles')
      .select('*')
      .eq('id', userResult.data.user.id)
      .single();
    return profileResult.data || null;
  };

  /* Sign out and redirect to login. */
  window.playerSignOut = async function () {
    await client.auth.signOut();
    location.href = '/player/login/';
  };

  /* Update the nav unread-message badge on any /player/* page. */
  window.loadUnreadBadge = async function () {
    var userResult = await client.auth.getUser();
    if (!userResult.data.user) return;
    var myId = userResult.data.user.id;

    var res = await client
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', myId)
      .is('read_at', null);

    var badge = document.getElementById('nav-msg-badge');
    if (!badge) return;
    var count = res.count || 0;
    if (count > 0) {
      var label = count + ' unread message' + (count !== 1 ? 's' : '');
      badge.textContent  = count > 9 ? '9+' : String(count);
      badge.setAttribute('aria-label', label);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  };

  // Auto-load the badge and reveal sign-out button on every /player/* page
  document.addEventListener('DOMContentLoaded', function () {
    if (location.pathname.startsWith('/player/')) {
      client.auth.getSession().then(function (res) {
        if (!res.data.session) return;
        window.loadUnreadBadge();
        var signoutItem = document.getElementById('nav-signout-item');
        var signoutBtn  = document.getElementById('nav-signout');
        if (signoutItem) signoutItem.hidden = false;
        if (signoutBtn)  signoutBtn.addEventListener('click', function () { window.playerSignOut(); });
      });
    }
  });
})();
