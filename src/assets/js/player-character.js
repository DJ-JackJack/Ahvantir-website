/* player-character.js — character sheet view/edit/create
   Loaded on /player/character/ — reads ?id=UUID or ?new=1 from URL. */
(function () {
  'use strict';

  var db = null;
  var currentChar = null;
  var currentProfile = null;
  var isNew = false;
  var charId = null;

  function qs(sel) { return document.querySelector(sel); }

  function val(id) {
    var el = qs('#' + id);
    return el ? el.value : '';
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Allow-list URL schemes before storing or rendering lore links.
  // Blocks javascript: / data: etc. that esc() can't catch in href attributes.
  function safeUrl(u) {
    try {
      var url = new URL(u, location.origin);
      return /^(https?|mailto):$/.test(url.protocol) ? url.href : '#';
    } catch (_) { return '#'; }
  }

  /* ── Bootstrap ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', async function () {
    var session = await window.requireAuth(true);
    if (!session) return;

    db = window.__supabase;
    currentProfile = await window.getProfile();
    if (!currentProfile) return;

    var params = new URLSearchParams(location.search);
    isNew = params.has('new');
    charId = params.get('id');

    if (!isNew && !charId) {
      location.href = '/player/dashboard/';
      return;
    }

    if (isNew) {
      currentChar = { data: defaultData(), is_public: false };
      render(currentChar);
    } else {
      await loadCharacter(charId);
    }
  });

  /* ── Default character data ──────────────────────────────── */
  function defaultData() {
    return {
      name: '', race: '', class_name: '', subclass: '', level: 1,
      background: '', alignment: '',
      backstory: '', appearance: '',
      traits: '', ideals: '', bonds: '', flaws: '',
      lore_links: [],
      pdf_path: null
    };
  }

  /* ── Load from Supabase ──────────────────────────────────── */
  async function loadCharacter(id) {
    qs('#player-app').innerHTML = '<p class="player-loading">Loading character…</p>';

    var result = await db.from('characters').select('*').eq('id', id).single();
    if (result.error || !result.data) {
      qs('#player-app').innerHTML = '<p class="player-error">Character not found or you do not have access.</p>';
      return;
    }

    currentChar = result.data;
    var isOwner = currentChar.player_id === currentProfile.id;
    var isDM    = !!currentProfile.is_dm;

    render(currentChar);
    loadSecret(id);
    loadGallery(id, isOwner, isDM);
    loadPDFViewer(currentChar.data && currentChar.data.pdf_path, isOwner || isDM);
  }

  /* ── Load character secret ───────────────────────────────── */
  async function loadSecret(id) {
    var result = await db
      .from('character_secrets')
      .select('*')
      .eq('character_id', id)
      .maybeSingle();

    var section = qs('#secret-section');
    if (!section) return;

    if (result.error) {
      section.innerHTML = '<p class="player-error">Could not load hidden background.</p>';
      section.classList.remove('hidden');
      return;
    }
    if (result.data) {
      var ta = qs('#secret-content');
      if (ta) ta.value = result.data.content || '';
      var rev = qs('#secret-revealed');
      if (rev) rev.checked = !!result.data.is_revealed;
      section.dataset.secretId = result.data.id;
    }
    section.classList.remove('hidden');
  }

  /* ── Render ──────────────────────────────────────────────── */
  function render(char) {
    var d = Object.assign(defaultData(), char.data || {});
    var isOwner = !char.player_id || char.player_id === currentProfile.id;
    var isDM    = !!currentProfile.is_dm;
    var canEdit = isOwner;

    qs('#player-app').innerHTML = buildHTML(d, char, canEdit, isDM, isOwner);
    attachListeners(canEdit, isOwner, isDM);

    if (d.name) document.title = d.name + ' — Ahvantir';
  }

  /* ── Build HTML ──────────────────────────────────────────── */
  function buildHTML(d, char, canEdit, isDM, isOwner) {
    var ro  = canEdit ? '' : ' readonly';
    var dis = canEdit ? '' : ' disabled';
    var pubChecked = char.is_public ? ' checked' : '';

    /* Header */
    var headerHtml =
      '<div class="char-header">' +
        '<div class="char-header__name">' +
          '<input id="f-name" class="char-name-input" type="text" value="' + esc(d.name) + '" placeholder="Character Name"' + ro + '>' +
        '</div>' +
        '<div class="char-header__actions">' +
          (isOwner
            ? '<label class="visibility-toggle">' +
                '<input type="checkbox" id="f-public"' + pubChecked + dis + '>' +
                '<span class="visibility-toggle__label">Public</span>' +
              '</label>' +
              '<button class="btn btn--primary" id="btn-save" type="button">Save</button>' +
              '<a href="/player/dashboard/" class="btn btn--ghost">Dashboard</a>' +
              '<button class="btn btn--ghost btn--danger" id="btn-delete" type="button">Delete</button>'
            : (isDM ? '<span class="dm-badge">DM View</span>' : '') +
              '<a href="/player/dashboard/" class="btn btn--ghost">Dashboard</a>') +
        '</div>' +
      '</div>';

    /* Identity fields */
    var metaHtml =
      '<div class="char-meta">' +
        metaField('f-race',       'Race',       d.race,       ro) +
        metaField('f-class',      'Class',      d.class_name, ro) +
        metaField('f-subclass',   'Subclass',   d.subclass,   ro) +
        numField( 'f-level',      'Level',      d.level,  1, 20,  ro) +
        metaField('f-background', 'Background', d.background, ro) +
        metaField('f-alignment',  'Alignment',  d.alignment,  ro) +
      '</div>';

    /* Backstory + flavor */
    var flavorHtml =
      '<div class="char-flavor">' +
        '<label class="char-field char-field--full"><span>Backstory</span>' +
          '<textarea id="f-backstory" rows="5"' + ro + '>' + esc(d.backstory) + '</textarea>' +
        '</label>' +
        '<label class="char-field char-field--full"><span>Appearance</span>' +
          '<textarea id="f-appearance" rows="3"' + ro + '>' + esc(d.appearance) + '</textarea>' +
        '</label>' +
        '<div class="char-flavor-grid">' +
          '<label class="char-field"><span>Personality Traits</span><textarea id="f-traits" rows="3"' + ro + '>' + esc(d.traits) + '</textarea></label>' +
          '<label class="char-field"><span>Ideals</span><textarea id="f-ideals" rows="3"' + ro + '>' + esc(d.ideals) + '</textarea></label>' +
          '<label class="char-field"><span>Bonds</span><textarea id="f-bonds" rows="3"' + ro + '>' + esc(d.bonds) + '</textarea></label>' +
          '<label class="char-field"><span>Flaws</span><textarea id="f-flaws" rows="3"' + ro + '>' + esc(d.flaws) + '</textarea></label>' +
        '</div>' +
      '</div>';

    /* Lore links */
    var loreHtml =
      '<div class="char-section">' +
        '<h3 class="char-section__title">Lore Links</h3>' +
        '<p class="char-section__hint">Link this character to articles in the Ahvantir encyclopedia.</p>' +
        buildLoreLinks(d.lore_links || [], canEdit) +
        (canEdit ? '<button class="btn btn--ghost btn--sm" id="btn-add-lore" type="button">+ Add link</button>' : '') +
      '</div>';

    /* Hidden background (deferred — shown by loadSecret) */
    var secretHtml = '';
    if (isOwner || isDM) {
      secretHtml =
        '<div class="char-section char-section--secret hidden" id="secret-section">' +
          '<h3 class="char-section__title">🔒 Hidden Background</h3>' +
          '<p class="char-section__hint">Only visible to you' + (isOwner ? ' and the DM' : '') + '.' +
            (isOwner ? ' Toggle "Revealed" to share with the party.' : '') + '</p>' +
          '<textarea id="secret-content" class="form-input form-input--full" rows="5" ' +
            'placeholder="Hidden backstory, secret motivations…"' + ro + '></textarea>' +
          (isOwner
            ? '<div class="secret-footer">' +
                '<label class="visibility-toggle">' +
                  '<input type="checkbox" id="secret-revealed">' +
                  '<span class="visibility-toggle__label">Revealed to party</span>' +
                '</label>' +
                '<button class="btn btn--primary btn--sm" id="btn-save-secret" type="button">Save Hidden Background</button>' +
              '</div>'
            : '') +
        '</div>';
    }

    /* Portrait gallery */
    var galleryHtml =
      '<div class="char-section gallery-section" id="gallery-section">' +
        '<h3 class="char-section__title">Character Images</h3>' +
        '<p class="char-section__hint">Portraits and reference art — first image shown in the Hall of Heroes.</p>' +
        (char.id
          ? '<div class="gallery-grid" id="gallery-grid">' +
              '<span class="gallery-empty">Loading images…</span>' +
            '</div>' +
            (canEdit
              ? '<div class="gallery-upload-area">' +
                  '<label class="btn btn--ghost btn--sm" for="gallery-file-input">+ Upload Image</label>' +
                  '<input type="file" id="gallery-file-input" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none">' +
                '</div>'
              : '')
          : (canEdit
              ? '<p class="gallery-save-hint">Save your character first, then upload portrait images.</p>'
              : '')) +
      '</div>';

    /* PDF viewer (right column — content filled by loadPDFViewer) */
    var pdfHtml = char.id
      ? '<div class="char-section char-pdf-section">' +
          '<h3 class="char-section__title">Character Sheet PDF</h3>' +
          '<div id="pdf-viewer-container"><p class="char-section__hint">Loading…</p></div>' +
          (canEdit
            ? '<div class="pdf-upload-row">' +
                '<label class="btn btn--ghost btn--sm" for="pdf-file-input" id="pdf-upload-label">Upload Sheet PDF</label>' +
                '<input type="file" id="pdf-file-input" accept="application/pdf" style="display:none">' +
              '</div>'
            : '') +
        '</div>'
      : '<div class="char-section">' +
          '<h3 class="char-section__title">Character Sheet PDF</h3>' +
          '<p class="char-section__hint">Save your character first, then you can upload a PDF sheet.</p>' +
        '</div>';

    return (
      '<div class="char-sheet">' +
        headerHtml +
        '<div class="char-layout">' +
          '<div class="char-layout__form">' +
            metaHtml + galleryHtml + flavorHtml + loreHtml + secretHtml +
          '</div>' +
          '<div class="char-layout__pdf">' +
            pdfHtml +
          '</div>' +
        '</div>' +
        '<div id="char-status" class="char-status" aria-live="polite"></div>' +
      '</div>'
    );
  }

  function metaField(id, label, value, ro) {
    return '<label class="char-field"><span>' + label + '</span>' +
      '<input id="' + id + '" type="text" value="' + esc(value) + '"' + ro + '></label>';
  }

  function numField(id, label, value, min, max, ro) {
    return '<label class="char-field char-field--sm"><span>' + label + '</span>' +
      '<input id="' + id + '" type="number" min="' + min + '" max="' + max + '" value="' + (value || min) + '"' + ro + '></label>';
  }

  function buildLoreLinks(links, canEdit) {
    if (!canEdit && !links.length) return '';
    var items = links.map(function (u, i) {
      if (!canEdit) {
        return '<li><a href="' + safeUrl(u) + '" class="wikilink">' + esc(u) + '</a></li>';
      }
      return '<div class="lore-link-row">' +
        '<input type="url" class="form-input" value="' + esc(u) + '" data-idx="' + i + '" placeholder="https://ahvantir.world/articles/...">' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-remove="' + i + '">✕</button>' +
        '</div>';
    });
    if (!canEdit) return '<ul class="lore-links-list" id="lore-links-list">' + items.join('') + '</ul>';
    return '<div id="lore-links-list">' + items.join('') + '</div>';
  }

  /* ── Listeners ───────────────────────────────────────────── */
  function attachListeners(canEdit, isOwner, isDM) {
    if (!canEdit) return;

    var saveBtn = qs('#btn-save');
    if (saveBtn) saveBtn.addEventListener('click', saveCharacter);

    var delBtn = qs('#btn-delete');
    if (delBtn) delBtn.addEventListener('click', deleteCharacter);

    var addLoreBtn = qs('#btn-add-lore');
    if (addLoreBtn) addLoreBtn.addEventListener('click', addLoreLink);

    attachLoreRemoveListeners();

    var secretSaveBtn = qs('#btn-save-secret');
    if (secretSaveBtn) secretSaveBtn.addEventListener('click', saveSecret);

    var imgInput = qs('#gallery-file-input');
    if (imgInput) imgInput.addEventListener('change', function () {
      if (imgInput.files && imgInput.files[0]) uploadImage(imgInput.files[0]);
      imgInput.value = '';
    });

    var pdfInput = qs('#pdf-file-input');
    if (pdfInput) pdfInput.addEventListener('change', function () {
      if (pdfInput.files && pdfInput.files[0]) uploadPDF(pdfInput.files[0]);
      pdfInput.value = '';
    });
  }

  function attachLoreRemoveListeners() {
    var list = qs('#lore-links-list');
    if (!list) return;
    list.querySelectorAll('[data-remove]').forEach(function (btn) {
      var fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', function () {
        fresh.closest('.lore-link-row').remove();
      });
    });
  }

  function addLoreLink() {
    var list = qs('#lore-links-list');
    if (!list) return;
    var idx = list.children.length;
    var row = document.createElement('div');
    row.className = 'lore-link-row';
    row.innerHTML =
      '<input type="url" class="form-input" data-idx="' + idx + '" placeholder="https://ahvantir.world/articles/...">' +
      '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-remove="' + idx + '">✕</button>';
    list.appendChild(row);
    attachLoreRemoveListeners();
    row.querySelector('input').focus();
  }

  /* ── Collect ─────────────────────────────────────────────── */
  function collectData() {
    var loreLinks = [];
    var list = qs('#lore-links-list');
    if (list) {
      list.querySelectorAll('input[type="url"]').forEach(function (inp) {
        var v = safeUrl(inp.value.trim());
        if (v && v !== '#') loreLinks.push(v);
      });
    }
    var existingData = currentChar && currentChar.data ? currentChar.data : {};
    return {
      name:       val('f-name'),
      race:       val('f-race'),
      class_name: val('f-class'),
      subclass:   val('f-subclass'),
      level:      parseInt(val('f-level'), 10) || 1,
      background: val('f-background'),
      alignment:  val('f-alignment'),
      backstory:  val('f-backstory'),
      appearance: val('f-appearance'),
      traits:     val('f-traits'),
      ideals:     val('f-ideals'),
      bonds:      val('f-bonds'),
      flaws:      val('f-flaws'),
      lore_links: loreLinks,
      pdf_path:   existingData.pdf_path || null
    };
  }

  /* ── Save ────────────────────────────────────────────────── */
  async function saveCharacter() {
    setStatus('Saving…', 'info');
    var pubEl = qs('#f-public');
    var payload = {
      data: collectData(),
      is_public: pubEl ? pubEl.checked : false
    };
    var result;
    if (isNew) {
      payload.player_id = currentProfile.id;
      result = await db.from('characters').insert(payload).select().single();
      if (!result.error && result.data) {
        isNew   = false;
        charId  = result.data.id;
        currentChar = result.data;
        history.replaceState({}, '', '/player/character/?id=' + charId);
        render(currentChar);
        loadSecret(charId);
        loadGallery(charId, true, !!currentProfile.is_dm);
        loadPDFViewer(null, true);
      }
    } else {
      result = await db.from('characters').update(payload).eq('id', charId).select().single();
      if (!result.error && result.data) currentChar = result.data;
    }
    if (result.error) {
      setStatus('Error: ' + result.error.message, 'error');
    } else {
      setStatus('Saved ✓', 'ok');
      setTimeout(function () { setStatus('', ''); }, 3000);
    }
  }

  /* ── Delete ──────────────────────────────────────────────── */
  async function deleteCharacter() {
    if (!charId) { location.href = '/player/dashboard/'; return; }
    if (!confirm('Delete this character? This cannot be undone.')) return;
    await db.from('characters').delete().eq('id', charId);
    location.href = '/player/dashboard/';
  }

  /* ── Save secret ─────────────────────────────────────────── */
  async function saveSecret() {
    var section  = qs('#secret-section');
    var content  = val('secret-content');
    var revealed = !!(qs('#secret-revealed') || {}).checked;
    var existing = section && section.dataset.secretId;

    var payload = {
      character_id: charId,
      player_id:    currentProfile.id,
      content:      content,
      is_revealed:  revealed
    };
    var result = existing
      ? await db.from('character_secrets').update(payload).eq('id', existing)
      : await db.from('character_secrets').insert(payload).select().single();

    if (!existing && !result.error && result.data && section) {
      section.dataset.secretId = result.data.id;
    }
    if (result.error) {
      setStatus('Error saving hidden background: ' + result.error.message, 'error');
    } else {
      setStatus('Hidden background saved ✓', 'ok');
      setTimeout(function () { setStatus('', ''); }, 3000);
    }
  }

  /* ── PDF viewer ──────────────────────────────────────────── */
  async function loadPDFViewer(path, canEdit) {
    var container = qs('#pdf-viewer-container');
    if (!container) return;

    if (!path) {
      container.innerHTML =
        '<p class="pdf-empty">' +
          (canEdit
            ? 'No sheet uploaded yet — use the button below to add one.'
            : 'No character sheet PDF uploaded.') +
        '</p>';
      return;
    }

    var signed = await db.storage.from('character-images').createSignedUrl(path, 3600);
    if (!signed.data || !signed.data.signedUrl) {
      container.innerHTML = '<p class="pdf-empty">Could not load PDF. Try re-uploading.</p>';
      return;
    }

    var url = signed.data.signedUrl;
    var label = qs('#pdf-upload-label');
    if (label) label.textContent = 'Update Sheet PDF';

    container.innerHTML =
      '<iframe class="char-pdf-frame" src="' + esc(url) + '#toolbar=1" ' +
        'title="Character Sheet PDF" loading="lazy"></iframe>' +
      '<a class="pdf-open-link" href="' + esc(url) + '" target="_blank" rel="noopener">Open in new tab ↗</a>';
  }

  async function uploadPDF(file) {
    if (!charId) { setStatus('Save the character first, then upload a PDF.', 'error'); return; }
    if (file.type !== 'application/pdf') { setStatus('Only PDF files are accepted.', 'error'); return; }
    if (file.size > 25 * 1024 * 1024) { setStatus('PDF must be under 25 MB.', 'error'); return; }

    setStatus('Uploading PDF…', 'info');

    var path = currentProfile.id + '/' + charId + '/sheet.pdf';
    var up = await db.storage.from('character-images').upload(path, file, {
      upsert: true,
      contentType: 'application/pdf'
    });
    if (up.error) { setStatus('Upload failed: ' + up.error.message, 'error'); return; }

    var newData = Object.assign({}, currentChar && currentChar.data, { pdf_path: path });
    var upd = await db.from('characters').update({ data: newData }).eq('id', charId).select().single();
    if (upd.error) { setStatus('PDF stored but record update failed.', 'error'); return; }
    if (upd.data) currentChar = upd.data;

    setStatus('Sheet PDF updated ✓', 'ok');
    setTimeout(function () { setStatus('', ''); }, 2500);

    loadPDFViewer(path, true);
  }

  /* ── Image gallery ───────────────────────────────────────── */
  async function loadGallery(id, isOwner, isDM) {
    var grid = qs('#gallery-grid');
    if (!grid) return;

    var result = await db
      .from('character_images')
      .select('*')
      .eq('character_id', id)
      .order('sort_order',  { ascending: true })
      .order('created_at',  { ascending: true });

    if (result.error) { grid.innerHTML = '<span class="gallery-empty">Could not load images.</span>'; return; }

    var rows = result.data || [];
    if (!rows.length) {
      grid.innerHTML = isOwner
        ? '<label class="gallery-empty-cta" for="gallery-file-input">' +
            '<span class="gallery-empty-cta__icon">+</span>' +
            '<span class="gallery-empty-cta__text">Upload your first portrait</span>' +
            '<span class="gallery-empty-cta__sub">JPG, PNG, GIF or WebP · max 8 MB</span>' +
          '</label>'
        : '<span class="gallery-empty">No images uploaded yet.</span>';
      return;
    }

    var canDelete = isOwner || isDM;
    var htmlItems = (await Promise.all(rows.map(async function (row, idx) {
      var signed = await db.storage.from('character-images').createSignedUrl(row.storage_path, 3600);
      if (signed.error || !signed.data) return null;
      var src = signed.data.signedUrl;
      return (
        '<div class="gallery-item' + (isOwner ? ' gallery-item--sortable' : '') + '" ' +
            'data-path="' + esc(row.storage_path) + '" ' +
            'data-img-id="' + esc(row.id) + '"' +
            (isOwner ? ' draggable="true"' : '') + '>' +
          (isOwner
            ? '<span class="gallery-item__handle" aria-hidden="true" title="Drag to reorder">⠿</span>'
            : '') +
          (idx === 0
            ? '<span class="gallery-item__portrait-badge">Portrait</span>'
            : '') +
          '<img src="' + esc(src) + '" alt="' + esc(row.caption || 'Character image') + '" loading="lazy">' +
          (canDelete
            ? '<button class="gallery-item__delete" type="button" title="Delete" ' +
                'data-img-id="' + esc(row.id) + '" data-path="' + esc(row.storage_path) + '">✕</button>'
            : '') +
        '</div>'
      );
    }))).filter(Boolean);

    if (!htmlItems.length) {
      grid.innerHTML = '<span class="gallery-empty">Could not load images — try refreshing.</span>';
      return;
    }
    grid.innerHTML = htmlItems.join('');

    grid.querySelectorAll('.gallery-item img').forEach(function (img) {
      img.addEventListener('click', function () { openLightbox(img.src, img.alt, img); });
    });

    if (canDelete) {
      grid.querySelectorAll('.gallery-item__delete').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          deleteImage(btn.dataset.imgId, btn.dataset.path, id, isOwner, isDM);
        });
      });
    }

    if (isOwner && rows.length > 1) {
      attachDragSort(grid);
    }
  }

  /* ── Drag-to-reorder portrait gallery ───────────────────────── */
  function attachDragSort(grid) {
    var dragSrc = null;

    function sortableItems() {
      return Array.from(grid.querySelectorAll('.gallery-item[draggable]'));
    }

    function syncPortraitBadge() {
      sortableItems().forEach(function (el, idx) {
        var badge = el.querySelector('.gallery-item__portrait-badge');
        if (idx === 0) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'gallery-item__portrait-badge';
            badge.setAttribute('aria-hidden', 'true');
            badge.textContent = 'Portrait';
            el.insertBefore(badge, el.firstChild.nextSibling); // after handle
          }
        } else if (badge) {
          badge.remove();
        }
      });
    }

    async function persistOrder() {
      var items = sortableItems();
      var results = await Promise.all(items.map(function (el, idx) {
        return db.from('character_images')
          .update({ sort_order: idx })
          .eq('id', el.dataset.imgId);
      }));
      if (results.some(function (r) { return r.error; })) {
        throw new Error('one or more sort_order updates failed');
      }
      setStatus('Portrait order saved ✓', 'ok');
      setTimeout(function () { setStatus('', ''); }, 1800);
    }

    grid.addEventListener('dragstart', function (e) {
      var item = e.target.closest('.gallery-item[draggable]');
      if (!item) return;
      dragSrc = item;
      item.classList.add('gallery-item--dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.imgId);
    });

    grid.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var target = e.target.closest('.gallery-item[draggable]');
      if (!target || target === dragSrc) return;
      sortableItems().forEach(function (el) { el.classList.remove('gallery-item--dropzone'); });
      target.classList.add('gallery-item--dropzone');
    });

    grid.addEventListener('dragleave', function (e) {
      var target = e.target.closest('.gallery-item[draggable]');
      if (target) target.classList.remove('gallery-item--dropzone');
    });

    grid.addEventListener('drop', function (e) {
      e.preventDefault();
      var target = e.target.closest('.gallery-item[draggable]');
      sortableItems().forEach(function (el) {
        el.classList.remove('gallery-item--dropzone', 'gallery-item--dragging');
      });
      if (!target || !dragSrc || target === dragSrc) { dragSrc = null; return; }

      // Insert dragged item before the drop target
      grid.insertBefore(dragSrc, target);
      dragSrc = null;

      syncPortraitBadge();
      persistOrder().catch(function () {
        setStatus('Could not save order — try again.', 'error');
      });
    });

    grid.addEventListener('dragend', function () {
      sortableItems().forEach(function (el) {
        el.classList.remove('gallery-item--dragging', 'gallery-item--dropzone');
      });
      dragSrc = null;
    });
  }

  async function uploadImage(file) {
    if (!charId) { setStatus('Save the character first, then upload images.', 'error'); return; }
    if (file.size > 8 * 1024 * 1024) { setStatus('Image must be under 8 MB.', 'error'); return; }

    setStatus('Uploading image…', 'info');
    var ext  = file.name.split('.').pop().toLowerCase();
    var path = currentProfile.id + '/' + charId + '/' + Date.now() + '.' + ext;

    var up = await db.storage.from('character-images').upload(path, file, { upsert: false });
    if (up.error) { setStatus('Upload failed: ' + up.error.message, 'error'); return; }

    var meta = await db.from('character_images').insert({
      character_id: charId,
      player_id:    currentProfile.id,
      storage_path: path,
      caption:      file.name.replace(/\.[^.]+$/, '')
    });
    if (meta.error) { setStatus('Image stored but metadata failed: ' + meta.error.message, 'error'); return; }

    setStatus('Uploaded ✓', 'ok');
    setTimeout(function () { setStatus('', ''); }, 2000);
    loadGallery(charId, true, !!currentProfile.is_dm);
  }

  async function deleteImage(imgId, storagePath, id, isOwner, isDM) {
    if (!confirm('Delete this image? This cannot be undone.')) return;
    var del1 = await db.storage.from('character-images').remove([storagePath]);
    var del2 = await db.from('character_images').delete().eq('id', imgId);
    if (del1.error || del2.error) {
      setStatus('Delete failed — please try again.', 'error');
      return;
    }
    loadGallery(id, isOwner, isDM);
  }

  function openLightbox(src, alt, triggerEl) {
    var existing = qs('.gallery-lightbox');
    if (existing) existing.remove();

    var lb = document.createElement('div');
    lb.className = 'gallery-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', alt || 'Image preview');

    lb.innerHTML =
      '<button class="gallery-lightbox__close" type="button" aria-label="Close lightbox">\xd7</button>' +
      '<img src="' + esc(src) + '" alt="' + esc(alt) + '">';

    function close() {
      lb.remove();
      document.removeEventListener('keydown', onKeydown);
      if (triggerEl) triggerEl.focus();
    }

    function onKeydown(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {
        var focusable = Array.from(lb.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(function (el) { return !el.disabled; });
        if (!focusable.length) { e.preventDefault(); return; }
        var first = focusable[0];
        var last  = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
      }
    }

    lb.addEventListener('click', function (e) {
      if (e.target === lb) close();
    });
    lb.querySelector('.gallery-lightbox__close').addEventListener('click', close);
    lb.querySelector('img').addEventListener('click', function (e) { e.stopPropagation(); });

    document.addEventListener('keydown', onKeydown);
    document.body.appendChild(lb);
    lb.querySelector('.gallery-lightbox__close').focus();
  }

  function setStatus(msg, type) {
    var el = qs('#char-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'char-status' + (type ? ' char-status--' + type : '');
  }
})();
