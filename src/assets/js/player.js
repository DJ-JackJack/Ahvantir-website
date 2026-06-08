/* player.js — Supabase client init + auth utilities
   Load AFTER the Supabase CDN script on every /player/* page. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://fbfqeijisvckwmkqzjtd.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnFlaWppc3Zja3dta3F6anRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTI4MzMsImV4cCI6MjA5NjM2ODgzM30.UzGAdE12QnFEKvsTsuA2UiiV-1qUu0f0b_VQUMCdXnI';

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
})();
