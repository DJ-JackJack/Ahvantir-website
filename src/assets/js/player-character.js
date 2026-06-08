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

  function modStr(score) {
    var mod = Math.floor(((score || 10) - 10) / 2);
    return (mod >= 0 ? '+' : '') + mod;
  }

  function val(id) {
    var el = qs('#' + id);
    return el ? el.value : '';
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
      ability_scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      hp: { max: 1, current: 1, temp: 0 },
      ac: 10, speed: 30, proficiency_bonus: 2,
      backstory: '', appearance: '', traits: '',
      ideals: '', bonds: '', flaws: '',
      lore_links: []
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
    var isDM = !!currentProfile.is_dm;
    render(currentChar);
    loadSecret(id);
    loadGallery(id, isOwner, isDM);
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

    if (result.data) {
      var ta = qs('#secret-content');
      if (ta) ta.value = result.data.content || '';
      var rev = qs('#secret-revealed');
      if (rev) rev.checked = !!result.data.is_revealed;
      section.dataset.secretId = result.data.id;
    }
    section.classList.remove('hidden');
  }

  /* ── Render full sheet ───────────────────────────────────── */
  function render(char) {
    var d = Object.assign(defaultData(), char.data || {});
    d.ability_scores = Object.assign({ str:10,dex:10,con:10,int:10,wis:10,cha:10 }, d.ability_scores || {});
    d.hp = Object.assign({ max:1, current:1, temp:0 }, d.hp || {});

    var isOwner = !char.player_id || char.player_id === currentProfile.id;
    var isDM = !!currentProfile.is_dm;
    var canEdit = isOwner;

    qs('#player-app').innerHTML = buildHTML(d, char, canEdit, isDM, isOwner);
    attachListeners(canEdit, isOwner);
    updateModifiers();

    // Update page title to character name
    if (d.name) document.title = d.name + ' — Ahvantir';
  }

  /* ── Build form HTML ─────────────────────────────────────── */
  function buildHTML(d, char, canEdit, isDM, isOwner) {
    var ab = d.ability_scores;
    var hp = d.hp;
    var ro = canEdit ? '' : ' readonly';
    var dis = canEdit ? '' : ' disabled';
    var pubChecked = char.is_public ? ' checked' : '';

    var abilityBoxes = ['str','dex','con','int','wis','cha'].map(function (s) {
      return '<div class="ability-box">' +
        '<span class="ability-box__label">' + s.toUpperCase() + '</span>' +
        '<input class="ability-box__input" id="f-' + s + '" type="number" min="1" max="30" value="' + (ab[s] || 10) + '"' + ro + '>' +
        '<span class="ability-box__mod" id="mod-' + s + '">' + modStr(ab[s]) + '</span>' +
        '</div>';
    }).join('');

    var loreLinksHtml = buildLoreLinks(d.lore_links || [], canEdit);

    var secretHtml = '';
    if (isOwner || isDM) {
      secretHtml = '<div class="char-section char-section--secret hidden" id="secret-section">' +
        '<h3 class="char-section__title">🔒 Hidden Background</h3>' +
        '<p class="char-section__hint">Only visible to you' + (isOwner ? ' and the DM' : '') + '. ' +
          (isOwner ? 'Toggle "Revealed" to share with the party.' : '') + '</p>' +
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

    var ddbHtml = canEdit
      ? '<div class="char-section">' +
        '<h3 class="char-section__title">D&amp;D Beyond Import</h3>' +
        '<p class="char-section__hint">Paste a D&amp;D Beyond character URL to pre-fill this form.</p>' +
        '<div class="ddb-row">' +
        '<input id="ddb-url" type="url" class="form-input" placeholder="https://www.dndbeyond.com/characters/12345678">' +
        '<button class="btn btn--ghost btn--sm" id="btn-ddb" type="button">Import</button>' +
        '</div>' +
        '<p id="ddb-msg" class="char-section__hint" style="display:none"></p>' +
        '</div>'
      : '';

    return '<div class="char-sheet">' +

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
              '<button class="btn btn--primary" id="btn-save">Save</button>' +
              '<a href="/player/dashboard/" class="btn btn--ghost">Dashboard</a>' +
              '<button class="btn btn--ghost btn--danger" id="btn-delete" type="button">Delete</button>'
            : (isDM ? '<span class="dm-badge">👁 DM View</span>' : '') +
              '<a href="/player/dashboard/" class="btn btn--ghost">Dashboard</a>')  +
        '</div>' +
      '</div>' +

      '<div class="char-meta">' +
        metaField('f-race',       'Race',       d.race,       ro) +
        metaField('f-class',      'Class',      d.class_name, ro) +
        metaField('f-subclass',   'Subclass',   d.subclass,   ro) +
        numField( 'f-level',      'Level',      d.level,  1, 20,  ro) +
        metaField('f-background', 'Background', d.background, ro) +
        metaField('f-alignment',  'Alignment',  d.alignment,  ro) +
      '</div>' +

      '<div class="char-scores">' + abilityBoxes + '</div>' +

      '<div class="char-combat">' +
        numField('f-hp-max', 'HP Max',     hp.max,     1, 9999, ro) +
        numField('f-hp-cur', 'HP Current', hp.current, 0, 9999, ro) +
        numField('f-hp-tmp', 'Temp HP',    hp.temp,    0, 9999, ro) +
        numField('f-ac',     'AC',         d.ac,       1, 99,   ro) +
        numField('f-speed',  'Speed',      d.speed,    0, 999,  ro) +
        numField('f-prof',   'Prof Bonus', d.proficiency_bonus, 2, 6, ro) +
      '</div>' +

      '<div class="char-flavor">' +
        '<label class="char-field char-field--full"><span>Backstory</span><textarea id="f-backstory" rows="4"' + ro + '>' + esc(d.backstory) + '</textarea></label>' +
        '<label class="char-field char-field--full"><span>Appearance</span><textarea id="f-appearance" rows="3"' + ro + '>' + esc(d.appearance) + '</textarea></label>' +
        '<div class="char-flavor-grid">' +
          '<label class="char-field"><span>Personality Traits</span><textarea id="f-traits" rows="3"' + ro + '>' + esc(d.traits) + '</textarea></label>' +
          '<label class="char-field"><span>Ideals</span><textarea id="f-ideals" rows="3"' + ro + '>' + esc(d.ideals) + '</textarea></label>' +
          '<label class="char-field"><span>Bonds</span><textarea id="f-bonds" rows="3"' + ro + '>' + esc(d.bonds) + '</textarea></label>' +
          '<label class="char-field"><span>Flaws</span><textarea id="f-flaws" rows="3"' + ro + '>' + esc(d.flaws) + '</textarea></label>' +
        '</div>' +
      '</div>' +

      '<div class="char-section">' +
        '<h3 class="char-section__title">Lore Links</h3>' +
        '<p class="char-section__hint">Link to Ahvantir articles by URL.</p>' +
        loreLinksHtml +
        (canEdit ? '<button class="btn btn--ghost btn--sm" id="btn-add-lore" type="button">+ Add link</button>' : '') +
      '</div>' +

      secretHtml +
      ddbHtml +

      (char.id
        ? '<div class="char-section gallery-section" id="gallery-section">' +
          '<h3 class="char-section__title">Character Images</h3>' +
          '<p class="char-section__hint">Portraits, art, and reference images for this character.</p>' +
          '<div class="gallery-grid" id="gallery-grid">' +
            '<span class="gallery-empty">Loading images…</span>' +
          '</div>' +
          (canEdit
            ? '<div class="gallery-upload-area">' +
              '<label class="btn btn--ghost btn--sm" for="gallery-file-input">+ Upload Image</label>' +
              '<input type="file" id="gallery-file-input" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none">' +
              '</div>'
            : '') +
          '</div>'
        : '') +

      '<div id="char-status" class="char-status" aria-live="polite"></div>' +
    '</div>';
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
        return '<li><a href="' + esc(u) + '" class="wikilink">' + esc(u) + '</a></li>';
      }
      return '<div class="lore-link-row">' +
        '<input type="url" class="form-input" value="' + esc(u) + '" data-idx="' + i + '" placeholder="https://ahvantir.world/articles/...">' +
        '<button class="btn btn--ghost btn--sm btn--danger" type="button" data-remove="' + i + '">✕</button>' +
        '</div>';
    });
    if (!canEdit) return '<ul class="lore-links-list" id="lore-links-list">' + items.join('') + '</ul>';
    return '<div id="lore-links-list">' + items.join('') + '</div>';
  }

  /* ── Event listeners ─────────────────────────────────────── */
  function attachListeners(canEdit, isOwner) {
    ['str','dex','con','int','wis','cha'].forEach(function (s) {
      var inp = qs('#f-' + s);
      if (inp) inp.addEventListener('input', updateModifiers);
    });

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

    var ddbBtn = qs('#btn-ddb');
    if (ddbBtn) ddbBtn.addEventListener('click', ddbImport);

    var fileInput = qs('#gallery-file-input');
    if (fileInput) fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) uploadImage(fileInput.files[0]);
      fileInput.value = '';
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

  function updateModifiers() {
    ['str','dex','con','int','wis','cha'].forEach(function (s) {
      var inp = qs('#f-' + s);
      var mod = qs('#mod-' + s);
      if (inp && mod) mod.textContent = modStr(parseInt(inp.value, 10) || 10);
    });
  }

  /* ── Collect form data ───────────────────────────────────── */
  function collectData() {
    var loreLinks = [];
    var list = qs('#lore-links-list');
    if (list) {
      list.querySelectorAll('input[type="url"]').forEach(function (inp) {
        var v = inp.value.trim();
        if (v) loreLinks.push(v);
      });
    }
    return {
      name:       val('f-name'),
      race:       val('f-race'),
      class_name: val('f-class'),
      subclass:   val('f-subclass'),
      level:      parseInt(val('f-level'), 10) || 1,
      background: val('f-background'),
      alignment:  val('f-alignment'),
      ability_scores: {
        str: parseInt(val('f-str'), 10) || 10,
        dex: parseInt(val('f-dex'), 10) || 10,
        con: parseInt(val('f-con'), 10) || 10,
        int: parseInt(val('f-int'), 10) || 10,
        wis: parseInt(val('f-wis'), 10) || 10,
        cha: parseInt(val('f-cha'), 10) || 10
      },
      hp: {
        max:     parseInt(val('f-hp-max'), 10) || 1,
        current: parseInt(val('f-hp-cur'), 10) || 1,
        temp:    parseInt(val('f-hp-tmp'), 10) || 0
      },
      ac:               parseInt(val('f-ac'), 10) || 10,
      speed:            parseInt(val('f-speed'), 10) || 30,
      proficiency_bonus: parseInt(val('f-prof'), 10) || 2,
      backstory:  val('f-backstory'),
      appearance: val('f-appearance'),
      traits:     val('f-traits'),
      ideals:     val('f-ideals'),
      bonds:      val('f-bonds'),
      flaws:      val('f-flaws'),
      lore_links: loreLinks
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
        isNew = false;
        charId = result.data.id;
        currentChar = result.data;
        history.replaceState({}, '', '/player/character/?id=' + charId);
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
    var section = qs('#secret-section');
    var content = val('secret-content');
    var isRevealed = !!(qs('#secret-revealed') || {}).checked;
    var existingId = section && section.dataset.secretId;

    var payload = {
      character_id: charId,
      player_id: currentProfile.id,
      content: content,
      is_revealed: isRevealed
    };
    var result;
    if (existingId) {
      result = await db.from('character_secrets').update(payload).eq('id', existingId);
    } else {
      result = await db.from('character_secrets').insert(payload).select().single();
      if (!result.error && result.data && section) {
        section.dataset.secretId = result.data.id;
      }
    }
    if (result.error) {
      setStatus('Error saving hidden background: ' + result.error.message, 'error');
    } else {
      setStatus('Hidden background saved ✓', 'ok');
      setTimeout(function () { setStatus('', ''); }, 3000);
    }
  }

  /* ── Image gallery ──────────────────────────────────────────
     Loads from character_images table, renders thumbnails,
     handles upload via Supabase Storage and delete. */

  async function loadGallery(id, isOwner, isDM) {
    var grid = qs('#gallery-grid');
    if (!grid) return;

    var result = await db
      .from('character_images')
      .select('*')
      .eq('character_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (result.error) {
      grid.innerHTML = '<span class="gallery-empty">Could not load images.</span>';
      return;
    }

    var rows = result.data || [];
    if (!rows.length) {
      grid.innerHTML = '<span class="gallery-empty">No images uploaded yet.</span>';
      return;
    }

    var canDelete = isOwner || isDM;

    var html = await Promise.all(rows.map(async function (row) {
      var signed = await db.storage
        .from('character-images')
        .createSignedUrl(row.storage_path, 3600);
      var src = signed.data ? signed.data.signedUrl : '';
      return '<div class="gallery-item" data-path="' + esc(row.storage_path) + '" data-img-id="' + esc(row.id) + '">' +
        '<img src="' + esc(src) + '" alt="' + esc(row.caption || 'Character image') + '" loading="lazy">' +
        (canDelete
          ? '<button class="gallery-item__delete" type="button" title="Delete image" data-img-id="' + esc(row.id) + '" data-path="' + esc(row.storage_path) + '">✕</button>'
          : '') +
        '</div>';
    }));

    grid.innerHTML = html.join('');

    // Click image to lightbox
    grid.querySelectorAll('.gallery-item img').forEach(function (img) {
      img.addEventListener('click', function () { openLightbox(img.src, img.alt); });
    });

    // Delete buttons
    if (canDelete) {
      grid.querySelectorAll('.gallery-item__delete').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          deleteImage(btn.dataset.imgId, btn.dataset.path, id, isOwner, isDM);
        });
      });
    }
  }

  async function uploadImage(file) {
    if (!charId) { setStatus('Save the character first, then upload images.', 'error'); return; }
    var MAX = 8 * 1024 * 1024;
    if (file.size > MAX) { setStatus('Image must be under 8 MB.', 'error'); return; }

    setStatus('Uploading…', 'info');
    var ext  = file.name.split('.').pop().toLowerCase();
    var path = currentProfile.id + '/' + charId + '/' + Date.now() + '.' + ext;

    var up = await db.storage.from('character-images').upload(path, file, { upsert: false });
    if (up.error) { setStatus('Upload failed: ' + up.error.message, 'error'); return; }

    var meta = await db.from('character_images').insert({
      character_id:  charId,
      player_id:     currentProfile.id,
      storage_path:  path,
      caption:       file.name.replace(/\.[^.]+$/, '')
    });

    if (meta.error) { setStatus('Image saved but metadata failed: ' + meta.error.message, 'error'); return; }

    setStatus('Uploaded ✓', 'ok');
    setTimeout(function () { setStatus('', ''); }, 2000);

    var isOwner = true;
    var isDM    = !!currentProfile.is_dm;
    loadGallery(charId, isOwner, isDM);
  }

  async function deleteImage(imgId, storagePath, charIdLocal, isOwner, isDM) {
    if (!confirm('Delete this image? This cannot be undone.')) return;
    await db.storage.from('character-images').remove([storagePath]);
    await db.from('character_images').delete().eq('id', imgId);
    loadGallery(charIdLocal, isOwner, isDM);
  }

  function openLightbox(src, alt) {
    var existing = document.querySelector('.gallery-lightbox');
    if (existing) existing.remove();
    var lb = document.createElement('div');
    lb.className = 'gallery-lightbox';
    lb.innerHTML =
      '<button class="gallery-lightbox__close" type="button" aria-label="Close">×</button>' +
      '<img src="' + esc(src) + '" alt="' + esc(alt) + '">';
    lb.addEventListener('click', function () { lb.remove(); });
    lb.querySelector('img').addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(lb);
  }

  /* ── DDB import ──────────────────────────────────────────── */
  async function ddbImport() {
    var urlInput = qs('#ddb-url');
    var msg = qs('#ddb-msg');
    var url = urlInput ? urlInput.value.trim() : '';
    var match = url.match(/dndbeyond\.com\/characters\/(\d+)/);
    msg.style.display = 'block';
    if (!match) {
      msg.textContent = 'Please enter a valid D&D Beyond character URL (e.g. https://www.dndbeyond.com/characters/12345678).';
      return;
    }

    msg.textContent = 'Fetching from D&D Beyond…';

    var session = (await db.auth.getSession()).data.session;
    var resp = await fetch('https://fbfqeijisvckwmkqzjtd.supabase.co/functions/v1/ddb-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (session ? session.access_token : '')
      },
      body: JSON.stringify({ characterId: match[1] })
    });

    var result = await resp.json();

    if (result.error) {
      msg.textContent = '⚠ ' + result.error;
      return;
    }

    var d = result.data;

    // Pre-fill all form fields
    fillField('f-name',       d.name);
    fillField('f-race',       d.race);
    fillField('f-class',      d.class_name);
    fillField('f-subclass',   d.subclass);
    fillField('f-level',      d.level);
    fillField('f-background', d.background);
    fillField('f-alignment',  d.alignment);
    fillField('f-str',        d.ability_scores.str);
    fillField('f-dex',        d.ability_scores.dex);
    fillField('f-con',        d.ability_scores.con);
    fillField('f-int',        d.ability_scores.int);
    fillField('f-wis',        d.ability_scores.wis);
    fillField('f-cha',        d.ability_scores.cha);
    fillField('f-hp-max',     d.hp.max);
    fillField('f-hp-cur',     d.hp.current);
    fillField('f-hp-tmp',     d.hp.temp);
    fillField('f-ac',         d.ac);
    fillField('f-speed',      d.speed);
    fillField('f-prof',       d.proficiency_bonus);
    fillField('f-backstory',  d.backstory);
    fillField('f-appearance', d.appearance);
    fillField('f-traits',     d.traits);
    fillField('f-ideals',     d.ideals);
    fillField('f-bonds',      d.bonds);
    fillField('f-flaws',      d.flaws);

    updateModifiers();

    if (d.name) document.title = d.name + ' — Ahvantir';

    msg.textContent = '✓ Imported! AC was set to 10 — adjust it manually then click Save.';
  }

  function fillField(id, value) {
    var el = qs('#' + id);
    if (el && value !== undefined && value !== null && value !== '') {
      el.value = value;
    }
  }

  function setStatus(msg, type) {
    var el = qs('#char-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'char-status' + (type ? ' char-status--' + type : '');
  }
})();
