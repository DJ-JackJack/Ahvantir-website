/* player-dm-view.js — campaign overview for /player/dm-view/ */
(function () {
  'use strict';
  var db = window.__supabase;

  document.addEventListener('DOMContentLoaded', async function () {
    var session = await window.requireAuth(true);
    if (!session) return;

    var profile = await window.getProfile();
    if (!profile || !profile.is_dm) {
      var appEl = document.getElementById('dm-app');
      if (appEl) appEl.innerHTML = '<p class="player-error">DM access is required to view this page. Redirecting to your dashboard…</p>';
      setTimeout(function () { location.replace('/player/dashboard/'); }, 2500);
      return;
    }

    await loadDMView();
  });

  async function loadDMView() {
    var app = document.getElementById('dm-app');

    var [profilesResult, charsResult] = await Promise.all([
      db.from('profiles').select('id, display_name, created_at').eq('is_dm', false),
      db.from('characters')
        .select('id, player_id, is_public, data, updated_at')
        .order('updated_at', { ascending: false })
    ]);

    var players = profilesResult.data || [];
    var allChars = charsResult.data || [];

    var charsByPlayer = {};
    allChars.forEach(function (c) {
      if (!charsByPlayer[c.player_id]) charsByPlayer[c.player_id] = [];
      charsByPlayer[c.player_id].push(c);
    });

    var totalPublic = allChars.filter(function (c) { return c.is_public; }).length;

    var statsHtml =
      '<div class="dm-stats">' +
        dmStat(players.length, 'Players') +
        dmStat(allChars.length, 'Characters') +
        dmStat(totalPublic, 'Public') +
      '</div>';

    var groupsHtml = '';
    if (!players.length) {
      groupsHtml = '<p class="dash-empty">No players have registered yet.</p>';
    } else {
      players.sort(function (a, b) {
        var aCount = (charsByPlayer[a.id] || []).length;
        var bCount = (charsByPlayer[b.id] || []).length;
        if (bCount !== aCount) return bCount - aCount;
        return a.display_name.localeCompare(b.display_name);
      });

      groupsHtml = players.map(function (p) {
        var chars = charsByPlayer[p.id] || [];

        var charRowsHtml = chars.length
          ? chars.map(function (c) {
              var d = c.data || {};
              var name = d.name || '(Unnamed)';
              var sub  = [d.race, d.class_name].filter(Boolean).join(' ');
              var level = d.level ? 'Lv ' + d.level : '';
              var subLine = [sub, level].filter(Boolean).join(' · ');
              return (
                '<div class="dm-char-row">' +
                  '<div class="dm-char-row__name">' +
                    '<a href="/player/character/?id=' + c.id + '">' + esc(name) + '</a>' +
                  '</div>' +
                  '<div class="dm-char-row__sub">' + esc(subLine) + '</div>' +
                  '<div class="dm-char-row__badge">' +
                    (c.is_public
                      ? '<span class="badge badge--teal">Public</span>'
                      : '<span class="badge">Private</span>') +
                  '</div>' +
                  '<div class="dm-char-row__updated">' + relativeTime(c.updated_at) + '</div>' +
                '</div>'
              );
            }).join('')
          : '<p class="dm-no-chars">No characters yet.</p>';

        return (
          '<div class="dm-player-group">' +
            '<div class="dm-player-group__header">' +
              '<span class="dm-player-group__name">' + esc(p.display_name) + '</span>' +
              '<span class="dm-player-group__count">' +
                chars.length + ' character' + (chars.length !== 1 ? 's' : '') +
              '</span>' +
            '</div>' +
            '<div class="dm-player-group__chars">' + charRowsHtml + '</div>' +
          '</div>'
        );
      }).join('');
    }

    var sessionSectionHtml =
      '<section class="dash-section" id="dm-sessions-section">' +
        '<div class="dash-section__header">' +
          '<h2 class="dash-section__title">Session Schedule</h2>' +
          '<button class="btn btn--ghost btn--sm" id="btn-add-session" type="button">+ Add Session</button>' +
        '</div>' +
        '<div id="dm-session-form-wrap" hidden>' +
          '<form class="dm-session-form" id="dm-session-form" novalidate>' +
            '<div class="dm-session-form__row">' +
              '<label class="form-label" for="s-dt">Date &amp; Time</label>' +
              '<input class="form-input" type="datetime-local" id="s-dt" required>' +
              '<span class="form-hint">Your local time — players see it in their own timezone.</span>' +
            '</div>' +
            '<div class="dm-session-form__row">' +
              '<label class="form-label" for="s-title">Title <span class="form-label__hint">optional</span></label>' +
              '<input class="form-input form-input--full" type="text" id="s-title" placeholder="Episode 23: Into the Depths" maxlength="120">' +
            '</div>' +
            '<div class="dm-session-form__row">' +
              '<label class="form-label" for="s-notes">Notes <span class="form-label__hint">optional</span></label>' +
              '<textarea class="form-input form-input--full" id="s-notes" rows="2" placeholder="Reminders or announcements for players…"></textarea>' +
            '</div>' +
            '<div class="dm-session-form__actions">' +
              '<button class="btn btn--primary btn--sm" type="submit" id="s-submit">Save Session</button>' +
              '<button class="btn btn--ghost btn--sm" type="button" id="s-cancel">Cancel</button>' +
              '<span class="dm-session-form__msg" id="s-msg"></span>' +
            '</div>' +
          '</form>' +
        '</div>' +
        '<div id="dm-sessions-list"><p class="player-loading">Loading…</p></div>' +
      '</section>';

    app.innerHTML =
      statsHtml +
      '<section class="dash-section">' +
        '<div class="dash-section__header">' +
          '<h2 class="dash-section__title">Party Roster</h2>' +
          '<a href="/player/hall-of-heroes/" class="btn btn--ghost btn--sm">Hall of Heroes</a>' +
        '</div>' +
        groupsHtml +
      '</section>' +
      sessionSectionHtml +
      '<div class="dash-footer">' +
        '<a href="/player/dashboard/" class="btn btn--ghost btn--sm">My Dashboard</a>' +
        '<button class="btn btn--ghost btn--sm" id="btn-signout" type="button">Sign Out</button>' +
      '</div>';

    app.querySelector('#btn-signout').addEventListener('click', function () { window.playerSignOut(); });

    bindSessionUI();
    await loadAndRenderSessions();
  }

  /* ── Session management ──────────────────────────────────────── */

  function bindSessionUI() {
    var formWrap  = document.getElementById('dm-session-form-wrap');
    var form      = document.getElementById('dm-session-form');
    var submitBtn = document.getElementById('s-submit');
    var msg       = document.getElementById('s-msg');

    document.getElementById('btn-add-session').addEventListener('click', function () {
      formWrap.hidden = false;
      document.getElementById('s-dt').focus();
    });

    document.getElementById('s-cancel').addEventListener('click', function () {
      form.reset();
      formWrap.hidden = true;
      msg.textContent = '';
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var dtVal    = document.getElementById('s-dt').value;
      var titleVal = document.getElementById('s-title').value.trim();
      var notesVal = document.getElementById('s-notes').value.trim();

      if (!dtVal) {
        setMsg(msg, 'Please pick a date and time.', true);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
      msg.textContent = '';

      var res = await db.from('sessions').insert({
        scheduled_at: new Date(dtVal).toISOString(),
        title: titleVal || null,
        notes: notesVal || null
      });

      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Session';

      if (res.error) {
        setMsg(msg, 'Error: ' + res.error.message, true);
        return;
      }

      form.reset();
      formWrap.hidden = true;
      msg.textContent = '';
      await loadAndRenderSessions();
    });
  }

  async function loadAndRenderSessions() {
    var list = document.getElementById('dm-sessions-list');
    if (!list) return;

    var res = await db
      .from('sessions')
      .select('id, scheduled_at, title, notes')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(20);

    var sessions = res.data || [];

    if (!sessions.length) {
      list.innerHTML = '<p class="dash-empty">No upcoming sessions scheduled.</p>';
      return;
    }

    list.innerHTML = sessions.map(function (s, i) {
      var isNext   = i === 0;
      var titleHtml = s.title ? '<span class="dm-session-row__title">' + esc(s.title) + '</span>' : '';
      var notesHtml = s.notes ? '<p class="dm-session-row__notes">'   + esc(s.notes) + '</p>'   : '';
      return '<div class="dm-session-row' + (isNext ? ' dm-session-row--next' : '') + '">' +
        '<div class="dm-session-row__info">' +
          (isNext ? '<span class="dm-session-row__badge">Next</span>' : '') +
          '<span class="dm-session-row__date">' + esc(fmtDate(s.scheduled_at)) + '</span>' +
          '<span class="dm-session-row__time">' + esc(fmtTime(s.scheduled_at)) + '</span>' +
          titleHtml + notesHtml +
        '</div>' +
        '<button class="btn btn--danger btn--sm dm-session-row__del" data-id="' + esc(s.id) + '" type="button">Delete</button>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.dm-session-row__del').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        btn.textContent = '…';
        btn.disabled = true;
        await db.from('sessions').delete().eq('id', btn.dataset.id);
        await loadAndRenderSessions();
      });
    });
  }

  function setMsg(el, text, isError) {
    el.textContent = text;
    el.classList.toggle('dm-session-form__msg--error', !!isError);
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

  function dmStat(val, label) {
    return (
      '<div class="dm-stat">' +
        '<span class="dm-stat__val">' + val + '</span>' +
        '<span class="dm-stat__label">' + label + '</span>' +
      '</div>'
    );
  }

  function relativeTime(iso) {
    if (!iso) return '';
    var diff = Date.now() - new Date(iso).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 2)  return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24)  return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 8)  return days + 'd ago';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
