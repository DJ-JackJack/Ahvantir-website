/* player-notes.js — campaign notes CRUD with auto-save */
(function () {
  'use strict';

  var db = null;
  var profile = null;
  var activeNoteId = null;
  var notes = [];
  var saveTimeout = null;

  function qs(sel) { return document.querySelector(sel); }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ── Bootstrap ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', async function () {
    var session = await window.requireAuth(true);
    if (!session) return;

    db = window.__supabase;
    profile = await window.getProfile();
    if (!profile) return;

    renderShell();
    await loadNotes();
  });

  /* ── Static shell ────────────────────────────────────────── */
  function renderShell() {
    var app = qs('#player-app');
    app.innerHTML =
      '<div class="notes-layout">' +
        '<aside class="notes-sidebar">' +
          '<div class="notes-sidebar__header">' +
            '<h2 class="notes-sidebar__title">Notes</h2>' +
            '<button class="btn btn--primary btn--sm" id="btn-new-note">+ New</button>' +
          '</div>' +
          '<ul class="notes-list" id="notes-list" role="list">' +
            '<li class="notes-list__empty">Loading…</li>' +
          '</ul>' +
          '<div class="notes-sidebar__footer">' +
            '<button class="btn btn--ghost btn--sm" onclick="window.playerSignOut()">Sign Out</button>' +
          '</div>' +
        '</aside>' +
        '<main class="notes-editor" id="notes-editor">' +
          '<p class="notes-editor__placeholder">Select a note or create a new one.</p>' +
        '</main>' +
      '</div>';

    qs('#btn-new-note').addEventListener('click', newNote);
  }

  /* ── Load all notes (titles only) ───────────────────────── */
  async function loadNotes() {
    var result = await db
      .from('campaign_notes')
      .select('id, title, updated_at')
      .eq('player_id', profile.id)
      .order('updated_at', { ascending: false });

    notes = result.data || [];
    renderList();
  }

  /* ── Render sidebar list ─────────────────────────────────── */
  function renderList() {
    var list = qs('#notes-list');
    if (!list) return;

    if (!notes.length) {
      list.innerHTML = '<li class="notes-list__empty">No notes yet.</li>';
      return;
    }

    list.innerHTML = notes.map(function (n) {
      var active = n.id === activeNoteId ? ' notes-list__item--active' : '';
      return '<li class="notes-list__item' + active + '" data-id="' + n.id + '">' +
        '<span class="notes-list__item-title">' + esc(n.title || 'Untitled') + '</span>' +
        '</li>';
    }).join('');

    list.querySelectorAll('[data-id]').forEach(function (li) {
      li.addEventListener('click', function () { openNote(li.dataset.id); });
    });
  }

  /* ── Open a note ─────────────────────────────────────────── */
  async function openNote(id) {
    activeNoteId = id;
    renderList();

    var result = await db
      .from('campaign_notes')
      .select('*')
      .eq('id', id)
      .single();

    if (result.error || !result.data) return;
    renderEditor(result.data);
  }

  /* ── Render editor ───────────────────────────────────────── */
  function renderEditor(note) {
    var editor = qs('#notes-editor');
    editor.innerHTML =
      '<div class="notes-editor__header">' +
        '<input id="note-title" class="notes-editor__title-input" type="text" value="' + esc(note.title) + '" placeholder="Note title">' +
        '<div class="notes-editor__toolbar">' +
          '<span id="note-status" class="note-status" aria-live="polite"></span>' +
          '<button class="btn btn--ghost btn--sm btn--danger" id="btn-delete-note" type="button">Delete</button>' +
        '</div>' +
      '</div>' +
      '<textarea id="note-content" class="notes-editor__content" placeholder="Write your notes here…">' + esc(note.content) + '</textarea>';

    qs('#note-title').addEventListener('input', scheduleSave);
    qs('#note-content').addEventListener('input', scheduleSave);
    qs('#btn-delete-note').addEventListener('click', function () { deleteNote(note.id); });
  }

  /* ── Auto-save with debounce ─────────────────────────────── */
  function scheduleSave() {
    clearTimeout(saveTimeout);
    var status = qs('#note-status');
    if (status) { status.textContent = '…'; status.className = 'note-status note-status--pending'; }
    saveTimeout = setTimeout(saveActive, 1200);
  }

  async function saveActive() {
    if (!activeNoteId) return;
    var titleEl   = qs('#note-title');
    var contentEl = qs('#note-content');
    var title   = titleEl   ? titleEl.value   : 'Untitled';
    var content = contentEl ? contentEl.value : '';

    var result = await db
      .from('campaign_notes')
      .update({ title: title, content: content })
      .eq('id', activeNoteId);

    var status = qs('#note-status');
    if (!status) return;

    if (result.error) {
      status.textContent = 'Error saving';
      status.className = 'note-status note-status--error';
    } else {
      status.textContent = 'Saved ✓';
      status.className = 'note-status note-status--ok';
      setTimeout(function () { if (qs('#note-status')) qs('#note-status').textContent = ''; }, 2000);
      var idx = notes.findIndex(function (n) { return n.id === activeNoteId; });
      if (idx >= 0) { notes[idx].title = title; renderList(); }
    }
  }

  /* ── New note ────────────────────────────────────────────── */
  async function newNote() {
    var result = await db
      .from('campaign_notes')
      .insert({ player_id: profile.id, title: 'New Note', content: '' })
      .select()
      .single();

    if (result.error || !result.data) return;
    notes.unshift(result.data);
    activeNoteId = result.data.id;
    renderList();
    renderEditor(result.data);
    var titleInput = qs('#note-title');
    if (titleInput) { titleInput.select(); }
  }

  /* ── Delete note ─────────────────────────────────────────── */
  async function deleteNote(id) {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    await db.from('campaign_notes').delete().eq('id', id);
    notes = notes.filter(function (n) { return n.id !== id; });
    activeNoteId = null;
    renderList();
    var editor = qs('#notes-editor');
    if (editor) editor.innerHTML = '<p class="notes-editor__placeholder">Select a note or create a new one.</p>';
  }
})();
