/* map-editor.js — DM-only editing for /map/.
 *
 * Loaded on the public page but inert for everyone except the DM. The drawing
 * library (~290 KB) is fetched only after the DM check passes, so visitors
 * never download it.
 *
 * The client-side DM check is a convenience for the UI. RLS is the real gate,
 * and every write here assumes the server may still refuse.
 *
 * Notes on Leaflet-Geoman that this file depends on, all checked against the
 * 2.20.2 source rather than the docs:
 *   - Layer events do NOT propagate to the map. map.on('pm:edit') never fires.
 *     They ARE re-fired on parent FeatureGroups, so edit handlers bind to the
 *     viewer's group.
 *   - pm:create and pm:remove fire on the MAP. pm:remove also fires on the
 *     layer, but binding it on the group is a race: the layer is detached from
 *     the group before the event fires.
 *   - pm:update is NOT the save hook. It only fires when edit mode is switched
 *     off, and not at all if the page is closed first.
 *   - Dragging a point marker fires BOTH pm:edit and pm:dragend. Writes are
 *     de-duplicated per layer per tick.
 *   - With allowSelfIntersection:false a rejected vertex drag reverts the shape
 *     and fires pm:layerreset INSTEAD of pm:edit, so nothing would be saved and
 *     the DM would not know why.
 */
(function () {
  'use strict';

  const db = window.__supabase;
  const C = window.MapCoords;
  if (!db || !C) return;

  const GEOMAN_JS = 'https://cdn.jsdelivr.net/npm/@geoman-io/leaflet-geoman-free@2.20.2/dist/leaflet-geoman.min.js';
  const GEOMAN_JS_SRI = 'sha384-pXNWPiDuE2DMvhW70luPUxtqU3gGa3Fn+Q4CckIXyA9ZcnByNj6FgpHi8Km45rcc';
  const GEOMAN_CSS = 'https://cdn.jsdelivr.net/npm/@geoman-io/leaflet-geoman-free@2.20.2/dist/leaflet-geoman.css';
  const GEOMAN_CSS_SRI = 'sha384-++juJE6hRzkkV4Ri9H2C+3yjCTdEk4PaZxptm3cpgKKjuMcAHErn35Q/0sGitZCR';

  const PALETTE = ['#c9a227', '#c2645a', '#5e9e8f', '#7b1d2a', '#076cba',
                   '#9f34f8', '#f87834', '#4da23e', '#27b7b0', '#980154'];

  let ui = null;              // the DM bar
  let panel = null;           // the properties panel
  let editing = false;        // DM tools showing
  const inFlight = new Set(); // marker ids with an unsaved write in flight
  const writeGuard = new Set();  // layers already saved this tick

  const M = () => window.AhvantirMap;

  /* ================= gate ================= */

  async function isDM() {
    const s = await db.auth.getSession();
    if (!s.data.session) return false;
    // Ask the database rather than trust a cached profile row. RLS FILTERS, so
    // an expired token or the wrong account produces "0 rows affected" on every
    // write and no error at all. An editor that looks like it is saving and is
    // not is worse than no editor, so the controls are never rendered unless
    // the server itself says yes.
    const r = await db.rpc('is_dm');
    return !r.error && r.data === true;
  }

  function loadAsset(tag, attrs) {
    return new Promise((resolve, reject) => {
      const el = document.createElement(tag);
      Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('Could not load ' + (attrs.src || attrs.href)));
      document.head.appendChild(el);
    });
  }

  async function loadGeoman() {
    if (window.L && L.PM) return;
    await loadAsset('link', {
      rel: 'stylesheet', href: GEOMAN_CSS,
      integrity: GEOMAN_CSS_SRI, crossorigin: 'anonymous',
    });
    await loadAsset('script', {
      src: GEOMAN_JS, integrity: GEOMAN_JS_SRI, crossorigin: 'anonymous',
    });
    if (!window.L || !L.PM) throw new Error('Drawing tools failed to initialise.');
  }

  /* ================= writes ================= */

  /* Every write goes through here.
   *
   * supabase-js resolves rather than throws, so a 401, a constraint violation
   * and an RLS denial all look like success to a naive caller. The denial case
   * is the dangerous one: it returns an empty array and no error. Both are
   * treated as failures. */
  async function mustWrite(builder, what) {
    const res = await builder.select();
    if (res.error) throw new Error(what + ' failed: ' + res.error.message);
    if (!res.data || !res.data.length) {
      throw new Error(
        what + ' changed nothing. Either another tab saved first, or your ' +
        'session is no longer signed in as the DM. Reload before trying again.');
    }
    return res.data[0];
  }

  function toast(msg, kind, action) {
    let box = document.getElementById('map-toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'map-toast';
      box.setAttribute('role', 'status');
      document.body.appendChild(box);
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

  /* ================= geometry <-> rows ================= */

  function geometryOf(layer, mapRow) {
    const h = mapRow.image_height;
    return (layer instanceof L.Polygon)
      ? C.ringFromLayer(layer, h)
      : C.fromLatLng(layer.getLatLng(), h);
  }

  function patchFor(kind, geometry) {
    return kind === 'area'
      ? { points: geometry }
      : { geo_x: geometry.x, geo_y: geometry.y };
  }

  /* Swap a layer for a freshly built one so colour, tooltip and the id tag all
     match what the viewer would have drawn from the row. */
  function replaceLayer(oldLayer, row) {
    const api = M();
    if (oldLayer && api.group.hasLayer(oldLayer)) api.group.removeLayer(oldLayer);
    const layer = api.drawMarker(row);
    api.group.addLayer(layer);
    api.upsertLocal(row, layer);
    enablePmOn(layer);
    return layer;
  }

  /* Write a layer's current geometry back to its row.
     Conditioned on the updated_at we last read: if another tab saved first,
     zero rows come back and mustWrite throws rather than silently discarding
     that tab's work. */
  async function saveGeometry(layer) {
    const api = M();
    const mapRow = api.mapRow;
    const entry = api.entries.find((e) => e.layer === layer);
    if (!entry || !mapRow) return;
    const marker = entry.marker;
    const geometry = geometryOf(layer, mapRow);

    const bad = C.validate(marker.kind, geometry, mapRow);
    if (bad) {
      toast(bad + ' Reverting.', 'error');
      replaceLayer(layer, marker);   // put the saved shape back on screen
      return;
    }

    inFlight.add(marker.id);
    try {
      const row = await mustWrite(
        db.from('map_markers')
          .update(patchFor(marker.kind, geometry))
          .eq('id', marker.id)
          .eq('updated_at', marker.updated_at),
        'Saving ' + marker.title);
      entry.marker = row;
      toast('Saved ' + row.title, 'ok');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      inFlight.delete(marker.id);
    }
  }

  /* Collapses the two events a dragged point marker fires into one write. */
  function saveGeometryOnce(layer) {
    const id = L.Util.stamp(layer);
    if (writeGuard.has(id)) return;
    writeGuard.add(id);
    setTimeout(() => writeGuard.delete(id), 0);
    saveGeometry(layer);
  }

  /* ================= create / delete ================= */

  async function createMarker(layer, shape) {
    const api = M();
    const mapRow = api.mapRow;
    if (!mapRow) return;
    const kind = shape === 'Polygon' ? 'area' : 'point';
    const geometry = geometryOf(layer, mapRow);

    const bad = C.validate(kind, geometry, mapRow);
    if (bad) { toast(bad, 'error'); api.group.removeLayer(layer); return; }

    try {
      const row = await mustWrite(
        db.from('map_markers').insert(Object.assign({
          map_id: mapRow.id, kind: kind,
          title: kind === 'area' ? 'New area' : 'New marker',
          color: PALETTE[0], group_name: '',
        }, patchFor(kind, geometry))),
        'Creating the marker');
      replaceLayer(layer, row);
      renderPanel(api.entries.find((e) => e.marker.id === row.id));
      toast('Created. Give it a title and link an article.', 'ok');
    } catch (err) {
      api.group.removeLayer(layer);
      toast(err.message, 'error');
    }
  }

  /* Soft delete. A hand-traced district runs to ninety-odd vertices and there
     is no way to redraw it faithfully, so a misclick in removal mode must not
     be final. The row is stamped rather than removed, the public policy hides
     stamped rows, and Undo clears the stamp. */
  async function deleteMarker(layer) {
    const api = M();
    const entry = api.entries.find((e) => e.layer === layer);
    if (!entry) return;
    const marker = entry.marker;
    const fromMapId = api.mapRow && api.mapRow.id;

    try {
      await mustWrite(
        db.from('map_markers')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', marker.id),
        'Deleting ' + marker.title);
      api.removeLocal(marker.id);
      if (panel && panel.dataset.markerId === marker.id) clearPanel();

      toast('Deleted ' + marker.title, 'warn', {
        label: 'Undo',
        fn: async () => {
          try {
            const row = await mustWrite(
              db.from('map_markers').update({ deleted_at: null }).eq('id', marker.id),
              'Restoring ' + marker.title);
            // The DM may have switched maps while the toast was up. The row is
            // restored either way; only redraw it if its map is still open.
            const now = M();
            if (now.mapRow && now.mapRow.id === fromMapId) replaceLayer(null, row);
            toast('Restored ' + row.title, 'ok');
          } catch (err) { toast(err.message, 'error'); }
        },
      });
    } catch (err) {
      toast(err.message, 'error');
      api.reloadCurrent();   // the layer is gone from the map but not the table
    }
  }

  /* ================= properties panel ================= */

  function clearPanel() {
    if (panel) {
      panel.innerHTML = '';
      panel.hidden = true;
      delete panel.dataset.markerId;
    }
  }

  function renderPanel(entry) {
    if (!entry) return;
    const api = M();
    const m = entry.marker;
    if (!panel) {
      const host = document.querySelector('.map-sidebar');
      if (!host) return;
      panel = document.createElement('div');
      panel.className = 'map-props';
      host.appendChild(panel);
    }
    panel.hidden = false;
    panel.dataset.markerId = m.id;

    const articles = [...api.articles.values()].sort((a, b) => a.title.localeCompare(b.title));
    const groups = [...new Set(api.entries.map((e) => e.marker.group_name).filter(Boolean))];
    const esc = api.esc;

    panel.innerHTML =
      '<h3 class="map-props__head">Marker <span class="map-props__kind">' + esc(m.kind) + '</span></h3>' +
      '<label class="map-props__row"><span>Title</span>' +
        '<input id="mp-title" type="text" value="' + esc(m.title) + '"></label>' +
      '<label class="map-props__row"><span>Article</span>' +
        '<select id="mp-article"><option value="">(none)</option>' +
        articles.map((a) => '<option value="' + esc(a.slug) + '"' +
          (a.slug === m.article_slug ? ' selected' : '') + '>' + esc(a.title) + '</option>').join('') +
        '</select></label>' +
      '<label class="map-props__row"><span>Group</span>' +
        '<input id="mp-group" type="text" list="mp-groups" value="' + esc(m.group_name || '') + '">' +
        '<datalist id="mp-groups">' +
        groups.map((g) => '<option value="' + esc(g) + '">').join('') + '</datalist></label>' +
      '<label class="map-props__row"><span>Summary override</span>' +
        '<textarea id="mp-snippet" rows="3" placeholder="Leave empty to use the article’s own opening.">' +
        esc(m.snippet_override || '') + '</textarea></label>' +
      '<div class="map-props__row"><span>Colour</span><div class="map-swatches" id="mp-colors">' +
        PALETTE.map((c) => '<button type="button" class="map-swatch' + (c === m.color ? ' is-on' : '') +
          '" data-c="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('') +
        '</div></div>' +
      '<div class="map-props__actions">' +
        '<button type="button" class="map-btn" id="mp-save">Save details</button>' +
      '</div>';

    let colour = m.color;
    panel.querySelector('#mp-colors').addEventListener('click', (e) => {
      const b = e.target.closest('.map-swatch');
      if (!b) return;
      colour = b.dataset.c;
      panel.querySelectorAll('.map-swatch').forEach((x) => x.classList.toggle('is-on', x === b));
    });

    panel.querySelector('#mp-save').addEventListener('click', async () => {
      const patch = {
        title: panel.querySelector('#mp-title').value.trim() || 'Untitled',
        article_slug: panel.querySelector('#mp-article').value || null,
        group_name: panel.querySelector('#mp-group').value.trim(),
        snippet_override: panel.querySelector('#mp-snippet').value.trim() || null,
        color: colour,
      };
      inFlight.add(m.id);
      try {
        const row = await mustWrite(
          db.from('map_markers').update(patch)
            .eq('id', m.id).eq('updated_at', m.updated_at),
          'Saving ' + patch.title);
        const cur = M().entries.find((e) => e.marker.id === row.id);
        replaceLayer(cur && cur.layer, row);
        renderPanel(M().entries.find((e) => e.marker.id === row.id));
        toast('Saved ' + row.title, 'ok');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        inFlight.delete(m.id);
      }
    });
  }

  /* ================= edit mode ================= */

  /* Geoman does not retro-fit a layer added after a global mode was switched
     on, so a marker created or replaced mid-session has to be told. Driven off
     Geoman's own state rather than our `editing` flag, which only means the DM
     bar is showing. */
  function enablePmOn(layer) {
    const map = M().leaflet;
    if (!layer || !layer.pm || !map || !map.pm) return;
    if (map.pm.globalEditModeEnabled && map.pm.globalEditModeEnabled()) {
      layer.pm.enable({ allowSelfIntersection: false });
    }
    if (map.pm.globalDragModeEnabled && map.pm.globalDragModeEnabled()) {
      layer.pm.enableLayerDrag();
    }
  }

  function setEditing(on) {
    const api = M();
    const map = api.leaflet;
    editing = on;
    api.setEditing(on);
    document.querySelector('.map-page').classList.toggle('is-editing', on);
    if (ui) ui.querySelector('#dm-edit').setAttribute('aria-pressed', String(on));
    if (!map || !map.pm) return;

    if (on) {
      map.pm.setGlobalOptions({
        layerGroup: api.group,
        snappable: true,
        snapDistance: 20,
        allowSelfIntersection: false,
      });
      map.pm.addControls({
        position: 'topleft',
        drawMarker: true, drawPolygon: true,
        editMode: true, dragMode: true, removalMode: true,
        drawPolyline: false, drawRectangle: false, drawCircle: false,
        drawCircleMarker: false, drawText: false,
        cutPolygon: false, rotateMode: false,
      });
    } else {
      if (map.pm.controlsVisible && map.pm.controlsVisible()) map.pm.removeControls();
      map.pm.disableGlobalEditMode();
      map.pm.disableGlobalDragMode();
      map.pm.disableGlobalRemovalMode();
      clearPanel();
    }
  }

  /* Bound once per Leaflet map. The viewer destroys and rebuilds the map when
     the DM switches maps, so these handlers die with it and are re-bound. */
  function wireMap(map, group) {
    map.on('pm:create', (e) => createMarker(e.layer, e.shape));

    // pm:remove fires on the layer and on the map. Binding it on the group is a
    // race: the layer is detached from the group before the event fires.
    map.on('pm:remove', (e) => deleteMarker(e.layer));

    // pm:edit fires on the layer and is re-fired on parent groups. This is the
    // save hook: vertex drags, vertex deletion and marker drags all land here.
    group.on('pm:edit', (e) => saveGeometryOnce(e.layer));
    group.on('pm:dragend', (e) => saveGeometryOnce(e.layer));

    // A self-intersecting vertex drag is reverted and fires this INSTEAD of
    // pm:edit, so nothing is saved and the shape on screen is not what the DM
    // just dragged. Say so rather than let it look like a failed save.
    group.on('pm:layerreset', () => {
      toast('That corner would have crossed another edge, so the shape was put back.', 'warn');
    });
  }

  /* ================= map upload ================= */

  async function uploadMap(file, title) {
    // Read the real pixel dimensions first. The maps row defines the coordinate
    // space every marker on it lives in, so a wrong height silently displaces
    // every shape that is ever drawn on this map.
    let dims;
    const objectUrl = URL.createObjectURL(file);
    try {
      dims = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error('That file could not be read as an image.'));
        img.src = objectUrl;
      });
    } catch (err) {
      toast(err.message, 'error');
      return;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }

    const slug = title.toLowerCase().replace(/['‘’]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) { toast('Give the map a name with some letters in it.', 'error'); return; }
    // Never overwrite in place. A stalled upload over a live key would destroy
    // the image every marker on that map is positioned against.
    const path = slug + '/' + Date.now() + '-' + file.name.replace(/[^\w.-]/g, '_');

    toast('Uploading ' + file.name + '…', 'info');
    const up = await db.storage.from('maps').upload(path, file, {
      upsert: false, contentType: file.type || 'image/jpeg',
    });
    if (up.error) { toast('Upload failed: ' + up.error.message, 'error'); return; }

    try {
      const row = await mustWrite(
        db.from('maps').insert({
          slug: slug, title: title, storage_path: path,
          image_width: dims.w, image_height: dims.h, is_published: false,
        }),
        'Creating the map');
      toast('Uploaded ' + row.title + ' (' + dims.w + '×' + dims.h +
            '). Only you can see it until you publish it.', 'ok');
      await M().includeUnpublished();
    } catch (err) {
      // The image reached the bucket but has no row, most often because the
      // slug is already taken. Remove it rather than leave an orphan behind.
      await db.storage.from('maps').remove([path]);
      toast(err.message, 'error');
    }
  }

  /* ================= DM bar ================= */

  function syncPublishButton() {
    if (!ui) return;
    const btn = ui.querySelector('#dm-publish');
    const row = M().mapRow;
    btn.disabled = !row;
    btn.textContent = row && row.is_published ? 'Unpublish map' : 'Publish map';
  }

  function buildUI() {
    const host = document.getElementById('map-toolbar');
    if (!host) return;
    // The viewer leaves the toolbar hidden when no map is published. For the DM
    // that is exactly the moment the Upload button is needed.
    host.hidden = false;

    ui = document.createElement('div');
    ui.className = 'map-dm';
    ui.innerHTML =
      '<span class="map-dm__badge">DM</span>' +
      '<button type="button" class="map-btn" id="dm-edit" aria-pressed="false">Edit mode</button>' +
      '<button type="button" class="map-btn" id="dm-publish" disabled>Publish map</button>' +
      '<label class="map-btn map-btn--file">Upload map' +
        '<input type="file" id="dm-upload" accept="image/*" hidden></label>';
    host.appendChild(ui);

    ui.querySelector('#dm-edit').addEventListener('click', () => setEditing(!editing));

    ui.querySelector('#dm-publish').addEventListener('click', async () => {
      const row = M().mapRow;
      if (!row) return;
      try {
        const next = await mustWrite(
          db.from('maps').update({ is_published: !row.is_published }).eq('id', row.id),
          'Updating the map');
        toast(next.is_published
          ? 'Players can see this map now.'
          : 'Hidden from players. It is still here for you.', 'ok');
        await M().includeUnpublished();
        syncPublishButton();
      } catch (err) { toast(err.message, 'error'); }
    });

    ui.querySelector('#dm-upload').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const title = window.prompt('Name this map', file.name.replace(/\.[^.]+$/, ''));
      if (title && title.trim()) uploadMap(file, title.trim());
    });
  }

  /* ================= boot ================= */

  async function boot() {
    if (!M()) return;                 // the viewer did not start; nothing to edit
    if (!(await isDM())) return;      // visitors and players: nothing loads
    try {
      await loadGeoman();
    } catch (err) {
      toast(err.message + ' Editing is unavailable.', 'error');
      return;
    }

    buildUI();

    // Bound once, not per map: the viewer rebuilds the Leaflet map on every map
    // switch, and re-registering these each time would stack duplicates.
    db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setEditing(false);
        toast('Your session ended. Sign in again to keep editing.', 'error');
      }
    });
    window.addEventListener('beforeunload', (e) => {
      if (inFlight.size) { e.preventDefault(); e.returnValue = ''; }
    });

    document.addEventListener('ahvantir:map-loaded', attach);
    document.addEventListener('ahvantir:marker-selected', (e) => {
      if (editing) renderPanel(e.detail);
    });

    await M().includeUnpublished();

    // Geoman attaches itself through Leaflet init hooks, so it only ever reaches
    // the map object and the layers that are created AFTER its script runs. By
    // the time the DM check and the download have finished, the viewer has
    // normally built both, which leaves map.pm undefined and every existing
    // marker uneditable. The condition is tested directly rather than inferred
    // from the ordering, because the map can also appear while Geoman is still
    // downloading. Rebuilding the current map is cheap: one marker query.
    if (M().leaflet && !M().leaflet.pm) await M().reloadCurrent();

    attach();   // in case the map finished loading before the DM check did
  }

  function attach() {
    const api = M();
    if (!api || !api.leaflet || !api.mapRow) return;
    syncPublishButton();
    if (api.leaflet.__dmWired) return;   // this map instance is already wired

    // Prove the coordinate conversion against this map's height before any
    // shape can be written with it.
    try {
      C.selfTest(api.mapRow.image_height);
    } catch (err) {
      toast('Editing disabled: ' + err.message, 'error');
      return;
    }
    if (!api.leaflet.pm) {
      toast('The drawing tools did not attach to this map. Reload the page.', 'error');
      return;
    }

    api.leaflet.__dmWired = true;
    clearPanel();
    wireMap(api.leaflet, api.group);
    if (editing) setEditing(true);   // re-add controls to the rebuilt map
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
