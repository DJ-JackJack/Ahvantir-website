/* map-player-notes.js — a signed-in player's own pins and notes on a map.
 *
 * Private to the player who made them. Nobody else sees them, including the DM.
 * That is enforced by RLS on player_map_markers, not by this file: the table's
 * only policy is `auth.uid() = player_id` for every command, so a row cannot be
 * read or written by anyone else even through the API directly.
 *
 * Inert for anonymous visitors — it checks for a session and stops.
 *
 * Deliberately NOT built on Geoman. The DM editor needs a drawing library for
 * polygons; a player dropping a pin needs a map click, so players never pay for
 * the 290 KB.
 *
 * The pins live in their own Leaflet layer group, NOT in the viewer's
 * FeatureGroup. That group is the DM editor's save hook and Geoman's target,
 * and a player note straying into it would be offered to the DM for editing.
 */
(function () {
  'use strict';

  const db = window.__supabase;
  const C = window.MapCoords;
  if (!db || !C) return;

  const M = () => window.AhvantirMap;

  const PALETTE = ['#076cba', '#c2645a', '#4da23e', '#9f34f8', '#d4aa40', '#27b7b0'];

  let me = null;          // the signed-in user's id
  let group = null;       // L.layerGroup holding this player's pins
  let entries = [];       // { row, layer }
  let placing = false;    // "Add a note" mode
  let panel = null;
  let toggleBtn = null;
  let wiredMap = null;

  /* ---------- small helpers ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* supabase-js resolves rather than throws, and RLS FILTERS rather than
     erroring, so a write that touched nothing comes back as success with an
     empty array. Both are failures here. */
  async function mustWrite(builder, what) {
    const res = await builder.select();
    if (res.error) throw new Error(what + ' failed: ' + res.error.message);
    if (!res.data || !res.data.length) {
      throw new Error(what + ' changed nothing. Your sign-in may have expired; '
        + 'reload the page and try again.');
    }
    return res.data[0];
  }

  function toast(msg, kind) {
    let box = document.getElementById('map-toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'map-toast';
      box.setAttribute('role', 'status');
      (document.getElementById('map-page') || document.body).appendChild(box);
    }
    box.className = 'map-toast is-' + (kind || 'info');
    box.textContent = msg;
    box.hidden = false;
    clearTimeout(box.__t);
    box.__t = setTimeout(() => { box.hidden = true; }, 4000);
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
    const layer = L.circleMarker(C.toLatLng(row.geo_x, row.geo_y, h), {
      radius: 7,
      color: '#15110c',
      weight: 2,
      // A dashed ring so a player's own pin is never mistaken for a DM marker
      // at a glance, without relying on colour alone to say so.
      dashArray: '3 2',
      fillColor: row.color,
      fillOpacity: 0.95,
      className: 'map-mine',
    });
    layer.bindTooltip(tipFor(row), {
      direction: 'top', opacity: 1, className: 'map-tip-wrap',
    });
    layer.on('click', (e) => {
      L.DomEvent.stop(e);          // do not let the map's own click handler fire
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
    if (i >= 0) {
      group.removeLayer(entries[i].layer);
      entries.splice(i, 1);
    }
    return addEntry(row);
  }

  function dropEntry(id) {
    const i = entries.findIndex((e) => e.row.id === id);
    if (i >= 0) {
      group.removeLayer(entries[i].layer);
      entries.splice(i, 1);
    }
  }

  /* ---------- the editor panel ---------- */

  function closePanel() {
    if (panel) { panel.innerHTML = ''; panel.hidden = true; }
  }

  function openPanel(row) {
    const host = document.querySelector('.map-sidebar');
    if (!host) return;
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'map-mynote';
      host.appendChild(panel);
    }
    panel.hidden = false;

    panel.innerHTML =
      '<h3 class="map-mynote__head">My note <span class="map-mynote__private">private to you</span></h3>' +
      '<label class="map-props__row"><span>Label</span>' +
        '<input id="mn-label" type="text" maxlength="120" value="' + esc(row.label) + '"></label>' +
      '<label class="map-props__row"><span>Note</span>' +
        '<textarea id="mn-note" rows="5" maxlength="4000">' + esc(row.note) + '</textarea></label>' +
      '<div class="map-props__row"><span>Colour</span><div class="map-swatches" id="mn-colors">' +
        PALETTE.map((c) => '<button type="button" class="map-swatch' +
          (c === row.color ? ' is-on' : '') + '" data-c="' + c +
          '" style="background:' + c + '" aria-label="' + c + '"></button>').join('') +
      '</div></div>' +
      '<div class="map-props__actions">' +
        '<button type="button" class="map-btn" id="mn-save">Save</button>' +
        '<button type="button" class="map-btn map-btn--danger" id="mn-delete">Delete</button>' +
        '<button type="button" class="map-btn" id="mn-close">Close</button>' +
      '</div>';

    let colour = row.color;
    panel.querySelector('#mn-colors').addEventListener('click', (e) => {
      const b = e.target.closest('.map-swatch');
      if (!b) return;
      colour = b.dataset.c;
      panel.querySelectorAll('.map-swatch').forEach((x) => x.classList.toggle('is-on', x === b));
    });

    panel.querySelector('#mn-close').addEventListener('click', closePanel);

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

    panel.querySelector('#mn-delete').addEventListener('click', async () => {
      const res = await db.from('player_map_markers').delete().eq('id', row.id).select();
      if (res.error) { toast('Could not delete: ' + res.error.message, 'error'); return; }
      dropEntry(row.id);
      closePanel();
      // Deleting is permanent, so hand the content straight back as an undo
      // rather than making the player retype a note they meant to keep.
      const copy = { map_id: row.map_id, geo_x: row.geo_x, geo_y: row.geo_y,
                     label: row.label, note: row.note, color: row.color };
      let box = document.getElementById('map-toast');
      toast('Note deleted', 'warn');
      box = document.getElementById('map-toast');
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'map-toast__action';
      undo.textContent = 'Undo';
      undo.addEventListener('click', async () => {
        box.hidden = true;
        try {
          const back = await mustWrite(
            db.from('player_map_markers').insert(copy), 'Restoring your note');
          addEntry(back);
          toast('Restored', 'ok');
        } catch (err) { toast(err.message, 'error'); }
      });
      box.appendChild(undo);
      clearTimeout(box.__t);
      box.__t = setTimeout(() => { box.hidden = true; }, 12000);
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
      openPanel(row);
    } catch (err) { toast(err.message, 'error'); }
  }

  function setPlacing(on) {
    placing = !!on;
    const page = document.getElementById('map-page');
    if (page) page.classList.toggle('is-placing-note', placing);
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', String(placing));
      toggleBtn.textContent = placing ? 'Click the map…' : 'Add a note';
    }
    if (placing) {
      // The DM editor and this cannot both own map clicks.
      document.dispatchEvent(new CustomEvent('ahvantir:player-notes', { detail: { on: true } }));
    }
  }

  /* ---------- loading ---------- */

  async function loadForCurrentMap() {
    const api = M();
    if (!api || !api.leaflet || !api.mapRow) return;

    if (group) { group.clearLayers(); api.leaflet.removeLayer(group); }
    group = L.layerGroup().addTo(api.leaflet);
    entries = [];
    closePanel();

    const res = await db.from('player_map_markers')
      .select('*')
      .eq('map_id', api.mapRow.id)
      .order('created_at', { ascending: true });
    if (res.error) { toast('Could not load your notes: ' + res.error.message, 'error'); return; }
    (res.data || []).forEach(addEntry);

    if (toggleBtn) {
      const n = entries.length;
      toggleBtn.title = n ? n + ' private note' + (n === 1 ? '' : 's') + ' on this map'
                          : 'Drop a private pin on this map';
    }

    // Bind the click handler once per Leaflet map. The viewer rebuilds the map
    // on every map switch, so the old handler dies with it.
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
    if (!s.data.session) return;        // anonymous: nothing to show, nothing to load
    me = s.data.session.user.id;

    buildToggle();
    await loadForCurrentMap();

    document.addEventListener('ahvantir:map-loaded', loadForCurrentMap);

    // The DM editor taking over means this must let go of the map's clicks.
    document.addEventListener('ahvantir:dm-editing', (e) => {
      if (e.detail && e.detail.on && placing) setPlacing(false);
    });

    db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setPlacing(false);
        closePanel();
        if (group) group.clearLayers();
        entries = [];
        toast('Signed out. Your notes are safe, sign in again to see them.', 'warn');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
