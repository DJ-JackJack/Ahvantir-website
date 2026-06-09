/* article-links.js
   Fetches public characters that have linked to this article and injects
   them into the sidebar "Linked Characters" section.

   No SDK needed — reads the Supabase session from localStorage and calls
   the PostgREST REST API directly. Silently does nothing if the user is
   not logged in or no characters link here. */

(function () {
  'use strict';

  var SUPABASE_URL  = 'https://fbfqeijisvckwmkqzjtd.supabase.co';
  var SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnFlaWppc3Zja3dta3F6anRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTI4MzMsImV4cCI6MjA5NjM2ODgzM30.UzGAdE12QnFEKvsTsuA2UiiV-1qUu0f0b_VQUMCdXnI';
  var SESSION_KEY   = 'sb-fbfqeijisvckwmkqzjtd-auth-token';

  document.addEventListener('DOMContentLoaded', function () {
    // Non-blocking — we don't want a failed query to affect article reading
    runQuery().catch(function () {});
  });

  async function runQuery() {
    // ── 1. Get session token from localStorage ────────────────────
    var token = getToken();
    if (!token) return;

    // ── 2. Canonical URL for matching lore_links ──────────────────
    //    Normalise to origin + pathname with trailing slash, no query/hash.
    var url = window.location.origin + window.location.pathname;
    if (!url.endsWith('/')) url += '/';

    // ── 3. Query via PostgREST ────────────────────────────────────
    //    Filter: data @> '{"lore_links":["<url>"]}'::jsonb
    var filter = 'cs.' + JSON.stringify({ lore_links: [url] });
    var endpoint =
      SUPABASE_URL + '/rest/v1/characters' +
      '?is_public=eq.true' +
      '&data=' + encodeURIComponent(filter) +
      '&select=id,data';

    var resp = await fetch(endpoint, {
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + token
      }
    });

    if (!resp.ok) return;
    var chars = await resp.json();
    if (!Array.isArray(chars) || !chars.length) return;

    // ── 4. Inject into sidebar ────────────────────────────────────
    var section = document.getElementById('char-links-section');
    var list    = document.getElementById('char-links-list');
    if (!section || !list) return;

    list.innerHTML = chars.map(function (c) {
      var d    = c.data || {};
      var name = d.name || 'Unknown Hero';
      var sub  = [
        d.level ? 'Level ' + d.level : '',
        d.race,
        d.class_name
      ].filter(Boolean).join(' · ');

      return (
        '<li>' +
          '<a href="/player/character/?id=' + esc(c.id) + '">' + esc(name) + '</a>' +
          (sub ? '<br><span class="backlink-sub">' + esc(sub) + '</span>' : '') +
        '</li>'
      );
    }).join('');

    section.hidden = false;
  }

  /* Read the access token from the Supabase localStorage entry.
     Returns null if no session exists or the token has expired. */
  function getToken() {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    var session;
    try { session = JSON.parse(raw); } catch (e) { return null; }

    // Supabase v2 stores a flat object with access_token + expires_at
    var token     = session && session.access_token;
    var expiresAt = session && session.expires_at;

    if (!token) return null;

    // Bail out if the token has already expired — no point attempting a
    // 401 round-trip (the SDK will refresh it next time the user visits a
    // /player/ page with the full client loaded)
    if (expiresAt && Date.now() / 1000 > expiresAt) return null;

    return token;
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }
})();
