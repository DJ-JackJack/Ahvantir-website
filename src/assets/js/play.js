/* play.js — /play/ page: Foundry iframe + lore panel */
(function () {
  'use strict';

  // Update this to the real tunnel hostname once the Cloudflare tunnel is created.
  var FOUNDRY_URL      = 'https://play-tunnel.ahvantir.world';
  var SIGNAL_TIMEOUT   = 8000;   // ms before showing "no signal"
  var MOBILE_BREAKPT   = 768;    // px — Foundry is not usable on mobile
  var MAX_RESULTS      = 25;
  var NOTES_SAVE_DELAY = 1500;   // ms debounce for note autosave

  var articles    = [];
  var bookmarks   = new Set();
  var currentArticleUrl = '';
  var loreOpen    = true;
  var signalTimer = null;

  /* ── DOM refs ───────────────────────────────────────────── */
  var iframe       = document.getElementById('play-iframe');
  var loadingEl    = document.getElementById('play-loading');
  var noSignalEl   = document.getElementById('play-no-signal');
  var mobileEl     = document.getElementById('play-mobile');
  var lorePanel    = document.getElementById('play-lore');
  var loreToggle   = document.getElementById('play-lore-toggle');
  var searchInput    = document.getElementById('lore-search-input');
  var resultsList    = document.getElementById('lore-results');
  var searchView     = document.getElementById('lore-search-view');
  var articleView    = document.getElementById('lore-article-view');
  var articleTitle   = document.getElementById('lore-article-title');
  var articleBody    = document.getElementById('lore-article-body');
  var articleLink    = document.getElementById('lore-article-link');
  var backBtn        = document.getElementById('lore-back');
  var bookmarkBtn    = document.getElementById('lore-bookmark-btn');
  var loreBookmarks  = document.getElementById('lore-bookmarks');
  var loreBookmarkList = document.getElementById('lore-bookmark-list');
  var tabSearch       = document.getElementById('tab-search');
  var tabNotes        = document.getElementById('tab-notes');
  var notesView       = document.getElementById('lore-notes-view');
  var notesListView   = document.getElementById('notes-list-view');
  var notesEditorView = document.getElementById('notes-editor-view');
  var notesSearch     = document.getElementById('notes-search');
  var notesNewBtn     = document.getElementById('notes-new-btn');
  var notesCards      = document.getElementById('notes-cards');
  var notesEmpty      = document.getElementById('notes-empty');
  var notesNoResults  = document.getElementById('notes-no-results');
  var notesBackBtn    = document.getElementById('notes-back-btn');
  var notesDeleteBtn  = document.getElementById('notes-delete-btn');
  var notesTitleInput = document.getElementById('notes-title-input');
  var notesContentInput = document.getElementById('notes-content-input');
  var notesSaveStatus = document.getElementById('notes-save-status');

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
      var hay = norm(a.title + ' ' + (a.description || '') + ' ' + (a.tags || []).join(' ') + ' ' + (a.body || ''));
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

  function updateBookmarkBtn() {
    if (!bookmarkBtn) return;
    var starred = bookmarks.has(currentArticleUrl);
    bookmarkBtn.textContent = starred ? '★' : '☆';
    bookmarkBtn.setAttribute('aria-pressed', String(starred));
    bookmarkBtn.classList.toggle('lore-bookmark-btn--active', starred);
    bookmarkBtn.setAttribute('title', starred ? 'Remove bookmark' : 'Bookmark this article');
  }

  function renderBookmarkList() {
    if (!loreBookmarkList) return;
    var query = searchInput ? searchInput.value.trim() : '';
    var pinned = articles.filter(function (a) { return bookmarks.has(a.url); });
    if (loreBookmarks) loreBookmarks.hidden = query.length > 0 || pinned.length === 0;
    loreBookmarkList.innerHTML = pinned.map(function (a) {
      return '<li class="lore-bookmark-item">' +
        '<button class="lore-bookmark-item__btn" type="button"' +
          ' data-url="' + esc(a.url) + '"' +
          ' data-title="' + esc(a.title) + '"' +
          ' data-desc="' + esc(a.description || '') + '">' +
          esc(a.title) +
        '</button>' +
        '<button class="lore-bookmark-item__rm" type="button" data-url="' + esc(a.url) + '" aria-label="Remove bookmark">×</button>' +
      '</li>';
    }).join('');
  }

  function openArticle(url, title, desc) {
    currentArticleUrl = url;
    if (articleTitle) articleTitle.textContent = title;
    if (articleBody) {
      articleBody.innerHTML = desc
        ? '<p>' + esc(desc) + '</p>'
        : '<p class="lore-article-nodesc">No summary available for this article.</p>';
    }
    if (articleLink) { articleLink.href = url; }
    updateBookmarkBtn();
    searchView.hidden  = true;
    articleView.hidden = false;
  }

  function showSearch() {
    searchView.hidden  = false;
    articleView.hidden = true;
    renderBookmarkList();
  }

  /* ── Tab switching ──────────────────────────────────────── */
  function switchTab(tab) {
    var isSearch = tab === 'search';
    if (tabSearch) {
      tabSearch.classList.toggle('lore-tab--active', isSearch);
      tabSearch.setAttribute('aria-selected', String(isSearch));
    }
    if (tabNotes) {
      tabNotes.classList.toggle('lore-tab--active', !isSearch);
      tabNotes.setAttribute('aria-selected', String(!isSearch));
    }
    if (searchView)  searchView.hidden  = !isSearch;
    if (articleView) articleView.hidden = true;
    if (notesView)   notesView.hidden   = isSearch;
    if (!isSearch) showNotesList();
  }

  /* ── Notes (per-card system) ───────────────────────────────── */
  var notesAll          = [];
  var notesCurrent      = null;   // {id, title, content} | null for a new unsaved note
  var notesSaveTimer    = null;
  var notesDeleteArmed  = false;
  var notesDeleteTimer  = null;

  function fmtNoteDate(iso) {
    if (!iso) return '';
    var d    = new Date(iso);
    var now  = new Date();
    var days = Math.floor((now - d) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    var opts = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString('en-US', opts);
  }

  function setNotesStatus(text, state) {
    if (!notesSaveStatus) return;
    notesSaveStatus.textContent = text;
    notesSaveStatus.className   = 'notes-save-status' + (state ? ' notes-save-status--' + state : '');
  }

  function renderNoteCards(notes) {
    if (!notesCards) return;
    notesCards.innerHTML = notes.map(function (n) {
      var headline = n.title || (n.content.split('\n')[0]) || '(empty)';
      var preview  = n.title ? (n.content.split('\n')[0] || '') : (n.content.split('\n')[1] || '');
      return '<li class="note-card" data-id="' + esc(n.id) + '" role="button" tabindex="0">' +
        '<div class="note-card__title">' + esc(headline) + '</div>' +
        (preview ? '<div class="note-card__preview">' + esc(preview) + '</div>' : '') +
        '<div class="note-card__date">' + esc(fmtNoteDate(n.updated_at)) + '</div>' +
        '</li>';
    }).join('');
  }

  function applyNotesFilter(query) {
    var q    = query.trim().toLowerCase();
    var hits = q ? notesAll.filter(function (n) {
      return (n.title + ' ' + n.content).toLowerCase().indexOf(q) !== -1;
    }) : notesAll;
    renderNoteCards(hits);
    if (notesEmpty)     notesEmpty.hidden     = !(!q && !notesAll.length);
    if (notesNoResults) notesNoResults.hidden = !(q && !hits.length);
  }

  function showNotesList() {
    if (notesListView)   notesListView.hidden   = false;
    if (notesEditorView) notesEditorView.hidden = true;
    applyNotesFilter(notesSearch ? notesSearch.value : '');
  }

  function showNoteEditor(note) {
    notesCurrent = note ? { id: note.id, title: note.title, content: note.content } : null;
    if (notesTitleInput)   notesTitleInput.value   = note ? (note.title   || '') : '';
    if (notesContentInput) notesContentInput.value = note ? (note.content || '') : '';
    setNotesStatus('', '');
    notesDeleteArmed = false;
    clearTimeout(notesDeleteTimer);
    if (notesDeleteBtn) {
      notesDeleteBtn.textContent = 'Delete';
      notesDeleteBtn.classList.remove('notes-delete-btn--armed');
    }
    if (notesListView)   notesListView.hidden   = true;
    if (notesEditorView) notesEditorView.hidden = false;
    if (notesContentInput) notesContentInput.focus();
  }

  async function loadAllNotes(userId) {
    var client = window.__supabase;
    if (!client || !userId) return;
    var res = await client
      .from('player_notes')
      .select('id, title, content, updated_at')
      .eq('player_id', userId)
      .order('updated_at', { ascending: false });
    notesAll = res.data || [];
    if (notesListView && !notesListView.hidden) showNotesList();
  }

  async function persistCurrentNote(userId) {
    var client = window.__supabase;
    if (!client || !userId) return;
    var title   = notesTitleInput   ? notesTitleInput.value   : '';
    var content = notesContentInput ? notesContentInput.value : '';

    if (notesCurrent && notesCurrent.id) {
      var res = await client
        .from('player_notes')
        .update({ title: title, content: content, updated_at: new Date().toISOString() })
        .eq('id', notesCurrent.id)
        .eq('player_id', userId);
      if (res.error) { setNotesStatus('Error saving', 'error'); return; }
      for (var i = 0; i < notesAll.length; i++) {
        if (notesAll[i].id === notesCurrent.id) {
          notesAll[i].title      = title;
          notesAll[i].content    = content;
          notesAll[i].updated_at = new Date().toISOString();
          break;
        }
      }
      notesCurrent.title   = title;
      notesCurrent.content = content;
    } else {
      if (!title.trim() && !content.trim()) return;
      var res = await client
        .from('player_notes')
        .insert({ player_id: userId, title: title, content: content })
        .select('id, updated_at')
        .single();
      if (res.error) { setNotesStatus('Error saving', 'error'); return; }
      notesCurrent = { id: res.data.id, title: title, content: content };
      notesAll.unshift({ id: res.data.id, title: title, content: content, updated_at: res.data.updated_at });
    }
    setNotesStatus('Saved ✓', 'ok');
    setTimeout(function () { setNotesStatus('', ''); }, 2000);
  }

  function scheduleNoteSave(userId) {
    clearTimeout(notesSaveTimer);
    setNotesStatus('…', 'pending');
    notesSaveTimer = setTimeout(function () { persistCurrentNote(userId); }, NOTES_SAVE_DELAY);
  }

  async function deleteCurrentNote(userId) {
    var client = window.__supabase;
    if (!notesCurrent || !notesCurrent.id || !client || !userId) {
      notesCurrent = null;
      showNotesList();
      return;
    }
    var id  = notesCurrent.id;
    await client.from('player_notes').delete().eq('id', id).eq('player_id', userId);
    notesAll    = notesAll.filter(function (n) { return n.id !== id; });
    notesCurrent = null;
    showNotesList();
  }

  /* ── Bookmarks ─────────────────────────────────────────── */
  async function loadBookmarks(userId) {
    var client = window.__supabase;
    if (!client || !userId) return;
    var res = await client
      .from('player_bookmarks')
      .select('article_url')
      .eq('player_id', userId);
    bookmarks = new Set((res.data || []).map(function (r) { return r.article_url; }));
    renderBookmarkList();
  }

  async function toggleBookmark(userId) {
    var client = window.__supabase;
    if (!client || !userId || !currentArticleUrl) return;
    if (bookmarks.has(currentArticleUrl)) {
      bookmarks.delete(currentArticleUrl);
      await client
        .from('player_bookmarks')
        .delete()
        .eq('player_id', userId)
        .eq('article_url', currentArticleUrl);
    } else {
      bookmarks.add(currentArticleUrl);
      await client
        .from('player_bookmarks')
        .insert({ player_id: userId, article_url: currentArticleUrl });
    }
    updateBookmarkBtn();
    renderBookmarkList();
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

    // Tab listeners — attach unconditionally before any async work that could throw
    if (tabSearch) tabSearch.addEventListener('click', function () { switchTab('search'); });
    if (tabNotes)  tabNotes.addEventListener('click',  function () { switchTab('notes'); });

    var userId = session.user ? session.user.id : null;
    if (userId) {
      loadAllNotes(userId);
      loadBookmarks(userId);

      // Notes: new note button
      if (notesNewBtn) {
        notesNewBtn.addEventListener('click', function () { showNoteEditor(null); });
      }

      // Notes: open card in editor (click or Enter/Space on keyboard)
      if (notesCards) {
        notesCards.addEventListener('click', function (e) {
          var card = e.target.closest('.note-card');
          if (!card) return;
          var id   = card.dataset.id;
          var note = notesAll.find(function (n) { return n.id === id; });
          if (note) showNoteEditor(note);
        });
        notesCards.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          var card = e.target.closest('.note-card');
          if (!card) return;
          e.preventDefault();
          var id   = card.dataset.id;
          var note = notesAll.find(function (n) { return n.id === id; });
          if (note) showNoteEditor(note);
        });
      }

      // Notes: live search filter
      if (notesSearch) {
        notesSearch.addEventListener('input', function () { applyNotesFilter(notesSearch.value); });
      }

      // Notes: editor — back button
      if (notesBackBtn) {
        notesBackBtn.addEventListener('click', function () {
          clearTimeout(notesSaveTimer);
          persistCurrentNote(userId).then(showNotesList);
        });
      }

      // Notes: editor — delete with two-tap confirm
      if (notesDeleteBtn) {
        notesDeleteBtn.addEventListener('click', function () {
          if (!notesDeleteArmed) {
            notesDeleteArmed = true;
            notesDeleteBtn.textContent = 'Sure?';
            notesDeleteBtn.classList.add('notes-delete-btn--armed');
            notesDeleteTimer = setTimeout(function () {
              notesDeleteArmed = false;
              notesDeleteBtn.textContent = 'Delete';
              notesDeleteBtn.classList.remove('notes-delete-btn--armed');
            }, 2500);
          } else {
            clearTimeout(notesDeleteTimer);
            deleteCurrentNote(userId);
          }
        });
      }

      // Notes: editor — autosave on input
      if (notesTitleInput) {
        notesTitleInput.addEventListener('input', function () { scheduleNoteSave(userId); });
      }
      if (notesContentInput) {
        notesContentInput.addEventListener('input', function () { scheduleNoteSave(userId); });
      }

      // Bookmark toggle button in article view
      if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', function () { toggleBookmark(userId); });
      }

      // Bookmark list — open article or remove bookmark
      if (loreBookmarkList) {
        loreBookmarkList.addEventListener('click', function (e) {
          var openBtn = e.target.closest('.lore-bookmark-item__btn');
          if (openBtn) {
            openArticle(openBtn.dataset.url, openBtn.dataset.title, openBtn.dataset.desc);
            return;
          }
          var rmBtn = e.target.closest('.lore-bookmark-item__rm');
          if (rmBtn) {
            currentArticleUrl = rmBtn.dataset.url;
            toggleBookmark(userId);
          }
        });
      }
    }

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
        debounce = setTimeout(function () {
          runSearch(searchInput.value);
          renderBookmarkList();
        }, 180);
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
