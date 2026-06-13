/* play.js — /play/ page: Foundry iframe + lore panel */
(function () {
  'use strict';

  // Update this to the real tunnel hostname once the Cloudflare tunnel is created.
  var FOUNDRY_URL      = 'https://play-tunnel.ahvantir.world';
  var SIGNAL_TIMEOUT   = 8000;   // ms before showing "no signal"
  var MOBILE_BREAKPT   = 768;    // px — Foundry is not usable on mobile
  var MAX_RESULTS      = 25;

  var articles = [];
  var loreOpen = true;
  var signalTimer = null;

  /* ── DOM refs ───────────────────────────────────────────── */
  var iframe       = document.getElementById('play-iframe');
  var loadingEl    = document.getElementById('play-loading');
  var noSignalEl   = document.getElementById('play-no-signal');
  var mobileEl     = document.getElementById('play-mobile');
  var lorePanel    = document.getElementById('play-lore');
  var loreToggle   = document.getElementById('play-lore-toggle');
  var searchInput  = document.getElementById('lore-search-input');
  var resultsList  = document.getElementById('lore-results');
  var searchView   = document.getElementById('lore-search-view');
  var articleView  = document.getElementById('lore-article-view');
  var articleTitle = document.getElementById('lore-article-title');
  var articleBody  = document.getElementById('lore-article-body');
  var articleLink  = document.getElementById('lore-article-link');
  var backBtn      = document.getElementById('lore-back');

  /* ── Session schedule ──────────────────────────────────── */
  function loadSessions() {
    var client = window.__supabase;
    if (!client) return Promise.resolve([]);
    return client
      .from('sessions')
      .select('id, scheduled_at, title, notes')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10)
      .then(function (res) { return res.data || []; })
      .catch(function () { return []; });
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
  }

  function renderNextSession(sessions) {
    var el = document.getElementById('no-signal-next');
    if (!el) return;
    var next = sessions[0];
    if (!next) { el.hidden = true; return; }
    el.textContent = 'Next session: ' + fmtDate(next.scheduled_at) + ' at ' + fmtTime(next.scheduled_at);
    el.hidden = false;
  }

  function renderSchedule(sessions) {
    var el = document.getElementById('schedule-list');
    if (!el) return;
    el.removeAttribute('aria-busy');
    if (!sessions.length) {
      el.innerHTML = '<p class="schedule-empty">No upcoming sessions scheduled.</p>';
      return;
    }
    el.innerHTML = sessions.map(function (s, i) {
      var isNext = i === 0;
      var badge  = isNext ? '<span class="schedule-item__badge">Next Session</span>' : '';
      var title  = s.title ? '<span class="schedule-item__title">'  + esc(s.title)  + '</span>' : '';
      var notes  = s.notes ? '<p class="schedule-item__notes">'     + esc(s.notes)  + '</p>'    : '';
      return '<div class="schedule-item' + (isNext ? ' schedule-item--next' : '') + '">' +
        badge +
        '<p class="schedule-item__date">' + esc(fmtDate(s.scheduled_at)) + '</p>' +
        '<p class="schedule-item__time">' + esc(fmtTime(s.scheduled_at)) + '</p>' +
        title + notes +
      '</div>';
    }).join('');
  }

  /* ── Article index ──────────────────────────────────────── */
  function loadIndex() {
    var el = document.getElementById('play-article-data');
    if (!el) return;
    try { articles = JSON.parse(el.textContent); } catch (_) { articles = []; }
  }

  /* ── Foundry panel states ───────────────────────────────── */
  function showLoading() {
    loadingEl.hidden  = false;
    iframe.hidden     = true;
    noSignalEl.hidden = true;
    mobileEl.hidden   = true;
  }

  function showIframe() {
    loadingEl.hidden  = true;
    iframe.hidden     = false;
    noSignalEl.hidden = true;
    mobileEl.hidden   = true;
  }

  function showNoSignal() {
    if (signalTimer) { clearTimeout(signalTimer); signalTimer = null; }
    loadingEl.hidden  = true;
    iframe.hidden     = true;
    noSignalEl.hidden = false;
    mobileEl.hidden   = true;
  }

  function showMobile() {
    loadingEl.hidden  = true;
    iframe.hidden     = true;
    noSignalEl.hidden = true;
    mobileEl.hidden   = false;
    if (lorePanel)  lorePanel.hidden  = true;
    if (loreToggle) loreToggle.hidden = true;
  }

  /* ── Lore panel toggle ──────────────────────────────────── */
  function setLoreOpen(open) {
    loreOpen = open;
    lorePanel.classList.toggle('play-lore--collapsed', !open);
    loreToggle.textContent = open ? '›' : '‹';
    loreToggle.setAttribute('aria-label', open ? 'Collapse lore panel' : 'Expand lore panel');
    loreToggle.setAttribute('aria-expanded', String(open));
  }

  /* ── Search ─────────────────────────────────────────────── */
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  }

  function runSearch(query) {
    query = query.trim();
    if (!query) {
      resultsList.innerHTML = '<li class="lore-results__hint">Enter a name or keyword.</li>';
      return;
    }

    var terms = norm(query).split(/\s+/).filter(Boolean);
    var hits = articles.filter(function (a) {
      var hay = norm(a.title + ' ' + (a.description || '') + ' ' + (a.tags || []).join(' '));
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    }).slice(0, MAX_RESULTS);

    if (!hits.length) {
      resultsList.innerHTML = '<li class="lore-results__empty">Nothing found for <em>' + esc(query) + '</em>.</li>';
      return;
    }

    resultsList.innerHTML = hits.map(function (a) {
      var snippet = a.description
        ? '<span class="lore-result__desc">' + esc(a.description.slice(0, 100)) + (a.description.length > 100 ? '…' : '') + '</span>'
        : '';
      return '<li class="lore-result">' +
        '<button class="lore-result__btn" type="button"' +
          ' data-url="' + esc(a.url) + '"' +
          ' data-title="' + esc(a.title) + '"' +
          ' data-desc="' + esc(a.description || '') + '">' +
          '<span class="lore-result__title">' + esc(a.title) + '</span>' +
          snippet +
        '</button>' +
        '</li>';
    }).join('');
  }

  function openArticle(url, title, desc) {
    if (articleTitle) articleTitle.textContent = title;
    if (articleBody) {
      articleBody.innerHTML = desc
        ? '<p>' + esc(desc) + '</p>'
        : '<p class="lore-article-nodesc">No summary available for this article.</p>';
    }
    if (articleLink) { articleLink.href = url; }
    searchView.hidden  = true;
    articleView.hidden = false;
  }

  function showSearch() {
    searchView.hidden  = false;
    articleView.hidden = true;
  }

  /* ── Init ───────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', async function () {
    var session = await window.requireAuth(true);
    if (!session) return;

    // Reveal auth-only nav items (play page is outside /player/*)
    var signoutItem = document.getElementById('nav-signout-item');
    var signoutBtn  = document.getElementById('nav-signout');
    var playItem    = document.getElementById('nav-play-item');
    if (signoutItem) signoutItem.hidden = false;
    if (signoutBtn)  signoutBtn.addEventListener('click', function () { window.playerSignOut(); });
    if (playItem)    playItem.hidden    = false;
    if (window.loadUnreadBadge) window.loadUnreadBadge();

    loadIndex();

    // Load session schedule in background — runs regardless of mobile/Foundry state
    loadSessions().then(function (sessions) {
      renderNextSession(sessions);
      renderSchedule(sessions);
    });

    // Allow vertical scroll so the schedule section below is reachable
    document.body.classList.add('play-active');

    if (window.innerWidth < MOBILE_BREAKPT) {
      showMobile();
      return;
    }

    // Detect whether Foundry is reachable via a fetch probe rather than the
    // iframe `load` event. The browser fires `load` even when it renders its
    // own DNS-error page inside the iframe, so `load` alone can't distinguish
    // a working Foundry from an unreachable host. A no-cors fetch throws a
    // NetworkError on DNS/connection failure and resolves (opaque response) when
    // any server actually responds — that distinction is reliable cross-origin.
    var resolved = false;
    var abortCtrl = new AbortController();

    function resolve(show) {
      if (resolved) return;
      resolved = true;
      clearTimeout(signalTimer);
      signalTimer = null;
      abortCtrl.abort();
      show();
    }

    showLoading();
    iframe.src = FOUNDRY_URL;

    signalTimer = setTimeout(function () { resolve(showNoSignal); }, SIGNAL_TIMEOUT);

    fetch(FOUNDRY_URL + '/', {
      mode: 'no-cors',
      cache: 'no-store',
      signal: abortCtrl.signal
    }).then(function () {
      resolve(showIframe);
    }).catch(function () {
      resolve(showNoSignal);
    });

    // Panel toggle
    if (loreToggle) {
      loreToggle.addEventListener('click', function () { setLoreOpen(!loreOpen); });
    }

    // Search
    if (searchInput) {
      var debounce;
      searchInput.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () { runSearch(searchInput.value); }, 180);
      });
    }

    // Result click
    if (resultsList) {
      resultsList.addEventListener('click', function (e) {
        var btn = e.target.closest('.lore-result__btn');
        if (!btn) return;
        openArticle(btn.dataset.url, btn.dataset.title, btn.dataset.desc);
      });
    }

    // Back to search
    if (backBtn) {
      backBtn.addEventListener('click', showSearch);
    }
  });

})();
