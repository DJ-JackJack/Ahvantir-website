/* map-player-notes.js — a signed-in player's own pins and notes on a map.
 *
 * Private to the player who made them, the DM included. Enforced by RLS on
 * player_map_markers, whose only policy is `auth.uid() = player_id` for every
 * command, so a row cannot be read or written by anyone else even through the
 * API directly. Uploaded pin images live in a PRIVATE storage bucket and are
 * fetched through short-lived signed URLs for the same reason.
 *
 * Inert for anonymous visitors: it checks for a session and stops before
 * issuing a single query.
 *
 * Two Leaflet details this file exists around:
 *
 *   1. A click on an interactive layer reaches the layer AND the map, both.
 *      Leaflet registers the map container in _targets alongside each layer, so
 *      _findEventTargets walks up from the clicked element and returns
 *      [district, map]; _fireDOMEvent then fires on every entry in turn. (The
 *      `if (!targets.length)` fallback in that function is a different path, for
 *      a click that hit no layer at all — not the only way the map hears one.)
 *
 *      So placing a pin inside a district used to open the district's article at
 *      the same moment. The guard that prevents it is isPlacingNote() in map.js,
 *      which makes the district handler stand down while placing; the
 *      pointer-events rule in main.css is the cursor affordance, not the fix.
 *      Anything relying on a layer click NOT reaching the map is wrong here.
 *   2. Vector layers draw in the order they were added, and the viewer
 *      re-stacks its own markers whenever a filter changes. Player pins
 *      therefore live in their OWN PANE above the overlay pane, rather than in
 *      the shared one, so nothing can bury them and make them unclickable.
 */
(function () {
  'use strict';

  const db = window.__supabase;
  const C = window.MapCoords;
  if (!db || !C) return;

  const M = () => window.AhvantirMap;

  const PALETTE = ['#076cba', '#c2645a', '#4da23e', '#9f34f8', '#d4aa40', '#27b7b0'];
  const PANE = 'playerNotes';
  const ICON_PX = 96;          // uploads are downscaled to this, longest side
  const BUCKET = 'player-markers';

  let me = null;
  let group = null;
  let entries = [];            // { row, layer }
  let placing = false;
  let panel = null;
  let listEl = null;
  let toggleBtn = null;
  let wiredMap = null;
  const signed = new Map();    // icon_path -> signed URL, per page load

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* supabase-js resolves rather than throws, and RLS filters rather than
     erroring, so a write that touched nothing returns success with no rows.
     Both are failures. */
  async function mustWrite(builder, what) {
    const res = await builder.select();
    if (res.error) throw new Error(what + ' failed: ' + res.error.message);
    if (!res.data || !res.data.length) {
      throw new Error(what + ' changed nothing. Your sign-in may have expired; '
        + 'reload the page and try again.');
    }
    return res.data[0];
  }

  function toast(msg, kind, action) {
    let box = document.getElementById('map-toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'map-toast';
      box.setAttribute('role', 'status');
      (document.getElementById('map-page') || document.body).appendChild(box);
    }
    box.className = 'map-toast is-' + (kind || 'info');
    box.textContent = '';
    const span = document.createElement('span');
    span.textContent = msg;
    box.appendChild(span);
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'map-toast__action';
      b.textContent = action.label;
      b.addEventListener('click', () => { box.hidden = true; action.fn(); });
      box.appendChild(b);
    }
    box.hidden = false;
    clearTimeout(box.__t);
    box.__t = setTimeout(() => { box.hidden = true; }, action ? 12000 : 4500);
  }

  /* ---------- icons ---------- */

  /* Downscale in the browser before upload. A player picking a photo should not
     have to think about size, and the map should not have to carry it: this
     caps every pin at ICON_PX on its longest side and re-encodes to PNG, which
     also normalises whatever format came in. */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, ICON_PX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cv.toBlob((blob) => {
          if (!blob) { reject(new Error('That image could not be processed.')); return; }
          resolve({ blob: blob, w: w, h: h });
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('That file could not be read as an image.'));
      };
      img.src = url;
    });
  }

  /* The bucket is private, so every icon needs a signed URL. Signed in one
     batch per map load rather than one request per pin. */
  async function signIcons(paths) {
    const want = paths.filter((p) => p && !signed.has(p));
    if (!want.length) return;
    const res = await db.storage.from(BUCKET).createSignedUrls(want, 3600);
    if (res.error) return;                 // pins fall back to a coloured dot
    (res.data || []).forEach((r) => {
      if (r.signedUrl && !r.error) signed.set(r.path, r.signedUrl);
    });
  }

  /* ---------- drawing ---------- */

  function tipFor(row) {
    const wrap = document.createElement('div');
    wrap.className = 'map-tip';
    const h = document.createElement('strong');
    h.className = 'map-tip__title';
    h.textContent = row.label || 'My note';
    wrap.appendChild(h);
    if (row.note) {
      const p = document.createElement('p');
      p.className = 'map-tip__text';
      p.textContent = row.note.length > 220 ? row.note.slice(0, 219) + '…' : row.note;
      wrap.appendChild(p);
    }
    const cue = document.createElement('span');
    cue.className = 'map-tip__cue';
    cue.textContent = 'Your note · click to edit';
    wrap.appendChild(cue);
    return wrap;
  }

  function drawPin(row) {
    const h = M().mapRow.image_height;
    const at = C.toLatLng(row.geo_x, row.geo_y, h);
    const url = row.icon_path && signed.get(row.icon_path);
    let layer;

    if (url) {
      layer = L.marker(at, {
        pane: PANE,
        icon: L.icon({
          iconUrl: url,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          className: 'map-mine-icon',
        }),
        keyboard: false,
      });
    } else {
      layer = L.circleMarker(at, {
        pane: PANE,
        radius: 7,
        color: '#15110c',
        weight: 2,
        // A dashed ring, so a player's own pin reads differently from a DM
        // marker without relying on colour alone.
        dashArray: '3 2',
        fillColor: row.color,
        fillOpacity: 0.95,
        className: 'map-mine',
      });
    }

    layer.bindTooltip(tipFor(row), {
      direction: 'top', opacity: 1, className: 'map-tip-wrap',
    });
    layer.on('click', (e) => {
      L.DomEvent.stop(e);
      openPanel(row);
    });
    return layer;
  }

  function addEntry(row) {
    const layer = drawPin(row);
    group.addLayer(layer);
    entries.push({ row: row, layer: layer });
    return layer;
  }

  function replaceEntry(row) {
    const i = entries.findIndex((e) => e.row.id === row.id);
    if (i >= 0) { group.removeLayer(entries[i].layer); entries.splice(i, 1); }
    const layer = addEntry(row);
    renderList();
    return layer;
  }

  function dropEntry(id) {
    const i = entries.findIndex((e) => e.row.id === id);
    if (i >= 0) { group.removeLayer(entries[i].layer); entries.splice(i, 1); }
    renderList();
  }

  /* ---------- the list of my notes ---------- */

  function renderList() {
    const host = document.querySelector('.map-sidebar');
    if (!host) return;
    if (!listEl) {
      listEl = document.createElement('div');
      listEl.className = 'map-mynotes';
      host.appendChild(listEl);
    }
    if (!entries.length) { listEl.hidden = true; listEl.innerHTML = ''; return; }
    listEl.hidden = false;

    listEl.innerHTML =
      '<h3 class="map-mynote__head">My notes <span class="map-mynote__private">'
      + entries.length + ' on this map, private to you</span></h3>'
      + '<ul class="map-mynotes__list" role="list"></ul>';

    const ul = listEl.querySelector('ul');
    entries.forEach(({ row }) => {
      const li = document.createElement('li');

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'map-marker-item';
      const dot = document.createElement('span');
      dot.className = 'map-marker-item__dot';
      dot.style.background = row.color;
      if (row.icon_path) dot.classList.add('is-image');
      open.appendChild(dot);
      open.appendChild(document.createTextNode(row.label || 'Untitled note'));
      open.addEventListener('click', () => {
        const e = entries.find((x) => x.row.id === row.id);
        if (e) {
          M().leaflet.panTo(e.layer.getLatLng());
          e.layer.openTooltip();
        }
        openPanel(row);
      });
      li.appendChild(open);

      // Delete from the list as well as from the pin. A pin can be hard to hit
      // on a busy map, and a note you cannot reach is a note you cannot remove.
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'map-mynotes__del';
      del.title = 'Delete this note';
      del.setAttribute('aria-label', 'Delete ' + (row.label || 'untitled note'));
      del.textContent = '✕';
      del.addEventListener('click', () => removeNote(row));
      li.appendChild(del);

      ul.appendChild(li);
    });
  }

  /* ---------- delete ---------- */

  async function removeNote(row) {
    const res = await db.from('player_map_markers').delete().eq('id', row.id).select();
    if (res.error) { toast('Could not delete: ' + res.error.message, 'error'); return; }
    dropEntry(row.id);
    if (panel && panel.dataset.id === row.id) closePanel();

    const copy = {
      map_id: row.map_id, geo_x: row.geo_x, geo_y: row.geo_y,
      label: row.label, note: row.note, color: row.color, icon_path: row.icon_path,
    };
    toast('Note deleted', 'warn', {
      label: 'Undo',
      fn: async () => {
        try {
          const back = await mustWrite(
            db.from('player_map_markers').insert(copy), 'Restoring your note');
          addEntry(back);
          renderList();
          toast('Restored', 'ok');
        } catch (err) { toast(err.message, 'error'); }
      },
    });
    // The image is deliberately left in storage until the undo window closes,
    // so restoring brings the picture back too rather than a broken pin.
    if (row.icon_path) {
      setTimeout(async () => {
        const still = entries.some((e) => e.row.icon_path === row.icon_path);
        if (!still) await db.storage.from(BUCKET).remove([row.icon_path]);
      }, 13000);
    }
  }

  /* ---------- the editor panel ---------- */

  function closePanel() {
    if (!panel) return;
    // Hand focus back before emptying the panel, or closing with Esc from
    // inside it would drop focus to the document and lose keyboard position.
    const inside = panel.contains(document.activeElement);
    panel.innerHTML = '';
    panel.hidden = true;
    delete panel.dataset.id;
    if (inside && toggleBtn) toggleBtn.focus({ preventScroll: true });
  }

  function openPanel(row) {
    /* Inside the map frame, NOT in the sidebar.

       The sidebar sits below the map since the layout change, so a panel opened
       there appeared off-screen on a wide display — and worse, two existing
       rules hid it outright: `.is-list-collapsed .map-sidebar:not(:has(.map-props))`
       (this panel is .map-mynote, so the exception missed it) and
       `:fullscreen .map-browser { display: none }`. Mounting in the stage puts
       the editor where the player is looking and takes it out of the scope of
       both rules, rather than carving a third and fourth exception into them. */
    const host = document.querySelector('.map-stage');
    if (!host) return;
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'map-mynote';
      // Bound once, on the element rather than the document: openPanel replaces
      // innerHTML on every re-render, so anything bound inside would stack up a
      // fresh listener per call.
      panel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); closePanel(); }
      });
      host.appendChild(panel);
    }
    // Only move focus when this is a fresh open. openPanel also re-renders in
    // place after a save or an image upload, and focusing then would pull the
    // cursor out of whatever the player was typing.
    const fresh = panel.hidden || panel.dataset.id !== String(row.id);
    panel.hidden = false;
    panel.dataset.id = row.id;

    const iconUrl = row.icon_path && signed.get(row.icon_path);
    panel.innerHTML =
      '<h3 class="map-mynote__head">My note <span class="map-mynote__private">private to you</span></h3>' +
      '<label class="map-props__row"><span>Label</span>' +
        '<input id="mn-label" type="text" maxlength="120" value="' + esc(row.label) + '"></label>' +
      '<label class="map-props__row"><span>Note</span>' +
        '<textarea id="mn-note" rows="5" maxlength="4000">' + esc(row.note) + '</textarea></label>' +
      '<div class="map-props__row"><span>Colour</span>' +
        '<div class="map-swatches" id="mn-colors">' +
          PALETTE.map((c) => '<button type="button" class="map-swatch' +
            (c === row.color ? ' is-on' : '') + '" data-c="' + c +
            '" style="background:' + c + '" aria-label="' + c + '"></button>').join('') +
          '<label class="map-swatch map-swatch--custom" title="Any other colour">' +
            '<input type="color" id="mn-custom" value="' + esc(row.color) + '">' +
          '</label>' +
        '</div></div>' +
      '<div class="map-props__row"><span>Pin image</span>' +
        '<div class="map-mynote__icon">' +
          (iconUrl
            ? '<img src="' + esc(iconUrl) + '" alt="" class="map-mynote__preview">'
            : '<span class="map-mynote__noicon">No image</span>') +
          '<label class="map-btn map-btn--file">Upload' +
            '<input type="file" id="mn-icon" accept="image/*" hidden></label>' +
          (row.icon_path ? '<button type="button" class="map-btn" id="mn-icon-clear">Remove</button>' : '') +
        '</div>' +
        '<small class="map-mynote__hint">Any image. It is shrunk to ' + ICON_PX +
        'px and kept private to you.</small>' +
      '</div>' +
      '<div class="map-props__actions">' +
        '<button type="button" class="map-btn" id="mn-save">Save</button>' +
        '<button type="button" class="map-btn map-btn--danger" id="mn-delete">Delete</button>' +
        '<button type="button" class="map-btn" id="mn-close">Close</button>' +
      '</div>';

    let colour = row.color;
    const swatches = panel.querySelector('#mn-colors');
    swatches.addEventListener('click', (e) => {
      const b = e.target.closest('.map-swatch[data-c]');
      if (!b) return;
      colour = b.dataset.c;
      panel.querySelectorAll('.map-swatch').forEach((x) => x.classList.toggle('is-on', x === b));
    });
    panel.querySelector('#mn-custom').addEventListener('input', (e) => {
      colour = e.target.value;
      panel.querySelectorAll('.map-swatch[data-c]').forEach((x) => x.classList.remove('is-on'));
    });

    panel.querySelector('#mn-close').addEventListener('click', closePanel);
    panel.querySelector('#mn-delete').addEventListener('click', () => removeNote(row));

    // A pin the player just dropped is unlabelled, so the Label field is where
    // they need to be. Guarded by `fresh` so a re-render does not steal focus.
    if (fresh) {
      const first = panel.querySelector('#mn-label');
      if (first) first.focus({ preventScroll: true });
    }

    panel.querySelector('#mn-icon').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        toast('Preparing the image…', 'info');
        const small = await shrink(file);
        const path = me + '/' + (crypto.randomUUID ? crypto.randomUUID()
                                 : String(Date.now()) + Math.random().toString(16).slice(2)) + '.png';
        const up = await db.storage.from(BUCKET).upload(path, small.blob, {
          contentType: 'image/png', upsert: false,
        });
        if (up.error) { toast('Upload failed: ' + up.error.message, 'error'); return; }
        const saved = await mustWrite(
          db.from('player_map_markers').update({ icon_path: path }).eq('id', row.id),
          'Saving your pin image');
        const old = row.icon_path;
        await signIcons([path]);
        replaceEntry(saved);
        openPanel(saved);
        if (old) await db.storage.from(BUCKET).remove([old]);
        toast('Pin image set', 'ok');
      } catch (err) { toast(err.message, 'error'); }
    });

    const clear = panel.querySelector('#mn-icon-clear');
    if (clear) {
      clear.addEventListener('click', async () => {
        try {
          const saved = await mustWrite(
            db.from('player_map_markers').update({ icon_path: null }).eq('id', row.id),
            'Removing your pin image');
          if (row.icon_path) await db.storage.from(BUCKET).remove([row.icon_path]);
          replaceEntry(saved);
          openPanel(saved);
          toast('Back to a coloured pin', 'ok');
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    panel.querySelector('#mn-save').addEventListener('click', async () => {
      try {
        const saved = await mustWrite(
          db.from('player_map_markers').update({
            label: panel.querySelector('#mn-label').value.trim(),
            note: panel.querySelector('#mn-note').value,
            color: colour,
          }).eq('id', row.id),
          'Saving your note');
        replaceEntry(saved);
        toast('Saved', 'ok');
        closePanel();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ---------- placing ---------- */

  async function placeAt(latlng) {
    const mapRow = M().mapRow;
    const p = C.fromLatLng(latlng, mapRow.image_height);
    const bad = C.validate('point', p, mapRow);
    if (bad) { toast(bad, 'error'); return; }
    try {
      const row = await mustWrite(
        db.from('player_map_markers').insert({
          map_id: mapRow.id, geo_x: p.x, geo_y: p.y,
          label: '', note: '', color: PALETTE[0],
        }),
        'Adding your note');
      addEntry(row);
      renderList();
      openPanel(row);
    } catch (err) { toast(err.message, 'error'); }
  }

  function setPlacing(on) {
    placing = !!on;
    const page = document.getElementById('map-page');
    // The class does the real work: while it is on, CSS makes every other map
    // layer click-through so the click reaches the map rather than being eaten
    // by a district polygon.
    if (page) page.classList.toggle('is-placing-note', placing);
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', String(placing));
      toggleBtn.textContent = placing ? 'Click the map…' : 'Add a note';
    }
    if (placing) {
      document.dispatchEvent(new CustomEvent('ahvantir:player-notes', { detail: { on: true } }));
    }
  }

  /* ---------- loading ---------- */

  async function loadForCurrentMap() {
    const api = M();
    if (!api || !api.leaflet || !api.mapRow) return;

    // A pane of its own, above the overlay pane the districts and DM markers
    // share. Without this the viewer's re-stacking can bury a player's pin
    // under a district, where it cannot be clicked, opened or deleted.
    if (!api.leaflet.getPane(PANE)) {
      const pane = api.leaflet.createPane(PANE);
      pane.style.zIndex = 620;
    }

    if (group) { group.clearLayers(); api.leaflet.removeLayer(group); }
    group = L.layerGroup().addTo(api.leaflet);
    entries = [];
    closePanel();

    const res = await db.from('player_map_markers')
      .select('*')
      .eq('map_id', api.mapRow.id)
      .order('created_at', { ascending: true });
    if (res.error) { toast('Could not load your notes: ' + res.error.message, 'error'); return; }

    const rows = res.data || [];
    await signIcons(rows.map((r) => r.icon_path));
    rows.forEach(addEntry);
    renderList();

    if (toggleBtn) {
      const n = entries.length;
      toggleBtn.title = n ? n + ' private note' + (n === 1 ? '' : 's') + ' on this map'
                          : 'Drop a private pin on this map';
    }

    if (wiredMap !== api.leaflet) {
      api.leaflet.on('click', (e) => {
        if (!placing) return;
        setPlacing(false);
        placeAt(e.latlng);
      });
      wiredMap = api.leaflet;
    }
  }

  /* ---------- boot ---------- */

  function buildToggle() {
    const host = document.getElementById('map-toolbar');
    if (!host || toggleBtn) return;
    const wrap = document.createElement('div');
    wrap.className = 'map-mine-bar';
    wrap.innerHTML =
      '<span class="map-mine-bar__badge" title="Only you can see these">✎</span>' +
      '<button type="button" class="map-btn" id="mine-add" aria-pressed="false">Add a note</button>';
    host.appendChild(wrap);
    toggleBtn = wrap.querySelector('#mine-add');
    toggleBtn.addEventListener('click', () => setPlacing(!placing));
    host.hidden = false;
  }

  async function boot() {
    if (!M()) return;
    const s = await db.auth.getSession();
    if (!s.data.session) return;
    me = s.data.session.user.id;

    buildToggle();
    await loadForCurrentMap();

    document.addEventListener('ahvantir:map-loaded', loadForCurrentMap);
    document.addEventListener('ahvantir:dm-editing', (e) => {
      if (e.detail && e.detail.on && placing) setPlacing(false);
    });

    db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setPlacing(false);
        closePanel();
        if (listEl) { listEl.hidden = true; listEl.innerHTML = ''; }
        if (group) group.clearLayers();
        entries = [];
        signed.clear();
        toast('Signed out. Your notes are safe, sign in again to see them.', 'warn');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
