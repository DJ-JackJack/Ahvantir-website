/* player-messages.js — real-time player-to-player messaging
   Loaded on /player/messages/ after Supabase CDN + player.js */
(function () {
  'use strict';

  var db          = null;
  var myProfile   = null;
  var profileMap  = {};          // id → { id, display_name }
  var activeOther = null;        // profile ID of the open conversation
  var conversations = [];        // sorted by latest message
  var realtimeChannel  = null;
  var resubscribeTimer = null;
  var resubscribeDelay = 1000;   // ms; doubles on each failure, capped at 30s
  var refreshTimer     = null;   // debounce handle for scheduleRefresh()

  function qs(sel) { return document.querySelector(sel); }
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function truncate(str, n) {
    str = String(str || '');
    return str.length > n ? str.slice(0, n) + '…' : str;
  }
  function relTime(iso) {
    var s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60)    return 'just now';
    if (s < 3600)  return Math.floor(s / 60)   + 'm ago';
    if (s < 86400) return Math.floor(s / 3600)  + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  function fmtTime(iso) {
    var d = new Date(iso);
    var today = new Date();
    var date = d.toDateString() === today.toDateString()
      ? ''
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ';
    return date + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /* ── Bootstrap ───────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', async function () {
    var session = await window.requireAuth(true);
    if (!session) return;

    db        = window.__supabase;
    myProfile = await window.getProfile();
    if (!myProfile) return;

    await loadProfiles();
    renderShell();
    await refreshConversations();
    subscribeRealtime();
    wireAuthRefresh();

    // Support ?with=UUID deep-link
    var withId = new URLSearchParams(location.search).get('with');
    if (withId) {
      if (!profileMap[withId]) await ensureProfile(withId);
      if (profileMap[withId]) {
        openConversation(withId);
      } else {
        var thread = qs('#messages-thread');
        if (thread) thread.innerHTML =
          '<div class="messages-thread__placeholder">' +
            '<p class="player-error">Could not find the player for this conversation link.</p>' +
          '</div>';
      }
    }
  });

  /* ── Load all player profiles (for names + recipient picker) ── */
  async function loadProfiles() {
    var res = await db.from('profiles').select('id, display_name');
    (res.data || []).forEach(function (p) { profileMap[p.id] = p; });
  }

  /* ── Lazy-fetch a single profile not yet in profileMap (D7) ─── */
  async function ensureProfile(id) {
    if (profileMap[id]) return;
    var res = await db.from('profiles').select('id, display_name').eq('id', id).single();
    if (res.data) profileMap[id] = res.data;
  }

  /* ── Static shell ────────────────────────────────────────────── */
  function renderShell() {
    qs('#player-app').innerHTML =
      '<div class="messages-layout">' +
        '<aside class="messages-sidebar">' +
          '<div class="messages-sidebar__header">' +
            '<span class="messages-sidebar__title">Conversations</span>' +
            '<button class="btn btn--primary btn--sm" id="btn-new-msg">+ New</button>' +
          '</div>' +
          '<ul class="messages-convo-list" id="convo-list" role="list">' +
            '<li class="messages-list-empty">Loading…</li>' +
          '</ul>' +
        '</aside>' +
        '<div class="messages-thread" id="messages-thread">' +
          '<div class="messages-thread__placeholder">' +
            '<span class="messages-thread__placeholder-icon" aria-hidden="true">✉</span>' +
            '<p>Select a conversation or start a new one.</p>' +
          '</div>' +
        '</div>' +
      '</div>';

    qs('#btn-new-msg').addEventListener('click', showNewConvoForm);
  }

  /* ── Refresh conversation list ───────────────────────────────── */
  async function refreshConversations() {
    var res = await db
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at, read_at')
      .or('sender_id.eq.' + myProfile.id + ',recipient_id.eq.' + myProfile.id)
      .order('created_at', { ascending: false });

    if (res.error) return;

    // Group by "other person", keeping only the latest message per convo
    var grouped = {};
    (res.data || []).forEach(function (msg) {
      var otherId = msg.sender_id === myProfile.id ? msg.recipient_id : msg.sender_id;
      if (!grouped[otherId]) {
        grouped[otherId] = { otherId: otherId, latest: msg, unread: 0 };
      }
      if (msg.recipient_id === myProfile.id && !msg.read_at) {
        grouped[otherId].unread++;
      }
    });

    conversations = Object.values(grouped).sort(function (a, b) {
      return new Date(b.latest.created_at) - new Date(a.latest.created_at);
    });

    // Ensure every conversation partner has a name even if they registered after boot (D7)
    await Promise.all(Object.keys(grouped).map(ensureProfile));

    renderConvoList();
    window.loadUnreadBadge && window.loadUnreadBadge();
  }

  /* ── Debounced refresh (D6) — collapses rapid realtime bursts ── */
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshConversations, 300);
  }

  /* ── Render sidebar conversation list ───────────────────────── */
  function renderConvoList() {
    var list = qs('#convo-list');
    if (!list) return;

    if (!conversations.length) {
      list.innerHTML = '<li class="messages-list-empty">No messages yet. Start a new conversation!</li>';
      return;
    }

    list.innerHTML = conversations.map(function (c) {
      var other   = profileMap[c.otherId] || { display_name: 'Unknown' };
      var active  = c.otherId === activeOther ? ' messages-convo--active' : '';
      var preview = (c.latest.sender_id === myProfile.id ? 'You: ' : '') +
                    esc(truncate(c.latest.content, 42));
      return (
        '<li>' +
          '<button class="messages-convo' + active + '" data-id="' + esc(c.otherId) + '" type="button">' +
            '<div class="messages-convo__row">' +
              '<span class="messages-convo__name">' + esc(other.display_name) + '</span>' +
              (c.unread > 0
                ? '<span class="messages-unread-badge" aria-label="' + c.unread + ' unread">' +
                    (c.unread > 9 ? '9+' : c.unread) + '</span>'
                : '') +
              '<span class="messages-convo__time">' + relTime(c.latest.created_at) + '</span>' +
            '</div>' +
            '<div class="messages-convo__preview">' + preview + '</div>' +
          '</button>' +
        '</li>'
      );
    }).join('');

    // Real <button> elements handle Enter/Space natively — only need click
    list.querySelectorAll('[data-id]').forEach(function (btn) {
      btn.addEventListener('click', function () { openConversation(btn.dataset.id); });
    });
  }

  /* ── Open a conversation ─────────────────────────────────────── */
  async function openConversation(otherId) {
    activeOther = otherId;
    history.replaceState({}, '', '/player/messages/?with=' + otherId);
    renderConvoList(); // update active highlight

    var other  = profileMap[otherId] || { display_name: 'Unknown' };
    var thread = qs('#messages-thread');

    thread.innerHTML =
      '<div class="messages-thread__header">' +
        '<span class="messages-thread__title">' + esc(other.display_name) + '</span>' +
      '</div>' +
      '<div class="messages-thread__history" id="thread-history"' +
          ' aria-live="polite" aria-atomic="false">' +
        '<p class="player-loading">Loading…</p>' +
      '</div>' +
      '<div class="messages-thread__compose">' +
        '<div id="msg-send-error" class="messages-send-error" hidden></div>' +
        '<span id="msg-compose-hint" class="sr-only">Press Enter to send. Shift+Enter adds a new line.</span>' +
        '<textarea id="msg-input" class="messages-compose-input"' +
          ' aria-label="Message text" aria-describedby="msg-compose-hint"' +
          ' placeholder="Write a message… (Enter to send, Shift+Enter for new line)"' +
          ' rows="2" maxlength="4000"></textarea>' +
        '<button class="btn btn--primary messages-send-btn" id="btn-send-msg">Send</button>' +
      '</div>';

    qs('#btn-send-msg').addEventListener('click', function () { sendMessage(otherId); });
    qs('#msg-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(otherId); }
    });

    await loadThread(otherId);
    await markRead(otherId);
    var input = qs('#msg-input');
    if (input) input.focus();
  }

  /* ── Load thread history ─────────────────────────────────────── */
  async function loadThread(otherId) {
    var history = qs('#thread-history');
    if (!history) return;

    var res = await db
      .from('messages')
      .select('id, sender_id, content, created_at, read_at')
      .or(
        'and(sender_id.eq.' + myProfile.id + ',recipient_id.eq.' + otherId + '),' +
        'and(sender_id.eq.' + otherId + ',recipient_id.eq.' + myProfile.id + ')'
      )
      .order('created_at', { ascending: true });

    if (res.error) {
      history.innerHTML = '<p class="player-error">Could not load messages.</p>';
      return;
    }

    var msgs = res.data || [];
    if (!msgs.length) {
      history.innerHTML =
        '<p class="messages-thread__empty-hint">No messages yet — say hello!</p>';
      return;
    }

    history.innerHTML = msgs.map(msgBubble).join('');
    scrollBottom();
  }

  /* ── Render a single message bubble ─────────────────────────── */
  function msgBubble(msg) {
    var mine = msg.sender_id === myProfile.id;
    return (
      '<div class="msg-bubble ' + (mine ? 'msg-bubble--mine' : 'msg-bubble--theirs') + '"' +
        ' data-msg-id="' + esc(msg.id) + '">' +
        '<div class="msg-bubble__text">' + esc(msg.content) + '</div>' +
        '<div class="msg-bubble__meta">' + fmtTime(msg.created_at) +
          (mine && msg.read_at ? ' <span title="Read" aria-label="Read">✓✓</span>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function scrollBottom() {
    var h = qs('#thread-history');
    if (h) h.scrollTop = h.scrollHeight;
  }

  /* ── Append one message (optimistic + realtime) ──────────────── */
  function appendBubble(msg) {
    var history = qs('#thread-history');
    if (!history) return;
    // Dedup: realtime reconnect replays can deliver the same message twice (D10)
    if (history.querySelector('[data-msg-id="' + esc(msg.id) + '"]')) return;
    var empty = history.querySelector('.messages-thread__empty-hint');
    if (empty) empty.remove();
    var div = document.createElement('div');
    div.innerHTML = msgBubble(msg);
    history.appendChild(div.firstChild);
    scrollBottom();
  }

  /* ── Send a message ──────────────────────────────────────────── */
  async function sendMessage(otherId) {
    var input  = qs('#msg-input');
    var errBox = qs('#msg-send-error');
    if (!input) return;
    var content = input.value.trim();
    if (!content) return;

    // Disable send button while in flight to prevent double-submit
    var btn = qs('#btn-send-msg');
    if (btn) btn.disabled = true;
    if (errBox) errBox.hidden = true;

    var res = await db.from('messages').insert({
      sender_id:    myProfile.id,
      recipient_id: otherId,
      content:      content
    }).select('id, sender_id, content, created_at, read_at').single();

    if (res.error) {
      // Keep the typed text so the user can retry
      if (errBox) { errBox.textContent = 'Failed to send — please try again.'; errBox.hidden = false; }
    } else {
      // Only clear on success
      input.value = '';
      if (res.data) appendBubble(res.data);
      await refreshConversations();
    }

    if (btn) btn.disabled = false;
    input.focus();
  }

  /* ── Mark received messages as read ─────────────────────────── */
  async function markRead(otherId) {
    // Uses client clock. Functionally fine — only null vs non-null is checked.
    // For exact server timestamps, add a mark_read(sender_uuid) RPC instead.
    await db.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id',    otherId)
      .eq('recipient_id', myProfile.id)
      .is('read_at', null);

    var convo = conversations.find(function (c) { return c.otherId === otherId; });
    if (convo) {
      convo.unread = 0;
      renderConvoList();
      window.loadUnreadBadge && window.loadUnreadBadge();
    }
  }

  /* ── Supabase Realtime subscription ─────────────────────────── */
  function subscribeRealtime() {
    if (realtimeChannel) db.removeChannel(realtimeChannel);
    clearTimeout(resubscribeTimer);

    realtimeChannel = db
      .channel('player-messages:' + myProfile.id)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: 'recipient_id=eq.' + myProfile.id
      }, function (payload) {
        handleIncoming(payload.new);
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          resubscribeDelay = 1000; // reset backoff on clean connect
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Reconnect with exponential backoff (1s → 2s → 4s → … → 30s max)
          resubscribeTimer = setTimeout(function () {
            resubscribeDelay = Math.min(resubscribeDelay * 2, 30000);
            subscribeRealtime();
          }, resubscribeDelay);
        }
      });
  }

  /* ── Token-refresh: keep realtime auth in sync ───────────────── */
  function wireAuthRefresh() {
    db.auth.onAuthStateChange(function (event, session) {
      if (event === 'TOKEN_REFRESHED' && session) {
        db.realtime.setAuth(session.access_token);
      }
    });
    // Recover any missed messages after tab regains focus or network comes back
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') scheduleRefresh();
    });
    window.addEventListener('online', function () { scheduleRefresh(); });
  }

  async function handleIncoming(msg) {
    // Lazy-fetch sender if they registered after this page loaded (D7)
    await ensureProfile(msg.sender_id);
    if (msg.sender_id === activeOther) {
      // The open conversation just got a new message
      appendBubble(msg);
      await markRead(msg.sender_id);
    }
    // Debounced refresh: collapses rapid bursts of incoming messages (D6)
    scheduleRefresh();
  }

  /* ── New conversation form ───────────────────────────────────── */
  function showNewConvoForm() {
    activeOther = null;
    renderConvoList();
    history.replaceState({}, '', '/player/messages/');

    var others = Object.values(profileMap).filter(function (p) {
      return p.id !== myProfile.id;
    });

    var thread = qs('#messages-thread');

    if (!others.length) {
      thread.innerHTML =
        '<div class="messages-thread__placeholder">' +
          '<p>No other players are registered yet.</p>' +
        '</div>';
      return;
    }

    var opts = others.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.display_name) + '</option>';
    }).join('');

    thread.innerHTML =
      '<div class="messages-thread__header">' +
        '<span class="messages-thread__title">New Message</span>' +
      '</div>' +
      '<div class="messages-new-form">' +
        '<label class="messages-new-form__field">' +
          '<span class="messages-new-form__label">To</span>' +
          '<select id="new-recipient" class="messages-recipient-select">' +
            '<option value="">— Choose a player —</option>' + opts +
          '</select>' +
        '</label>' +
        '<textarea id="new-content" class="messages-compose-input" rows="4"' +
          ' aria-label="Message text"' +
          ' placeholder="Write your first message…"' +
          ' maxlength="4000"></textarea>' +
        '<div id="new-send-error" class="messages-send-error" hidden></div>' +
        '<button class="btn btn--primary" id="btn-send-new">Send Message</button>' +
      '</div>';

    // Move focus to the recipient picker so keyboard users can act immediately
    var recipientSelect = qs('#new-recipient');
    if (recipientSelect) recipientSelect.focus();

    qs('#btn-send-new').addEventListener('click', async function () {
      var recipientId = qs('#new-recipient').value;
      var content     = (qs('#new-content').value || '').trim();
      var errBox      = qs('#new-send-error');
      var btn         = qs('#btn-send-new');
      if (!recipientId || !content) return;

      if (btn) btn.disabled = true;
      if (errBox) errBox.hidden = true;

      var res = await db.from('messages').insert({
        sender_id:    myProfile.id,
        recipient_id: recipientId,
        content:      content
      });

      if (res.error) {
        if (errBox) { errBox.textContent = 'Failed to send — please try again.'; errBox.hidden = false; }
        if (btn) btn.disabled = false;
      } else {
        await refreshConversations();
        openConversation(recipientId);
      }
    });
  }
})();
