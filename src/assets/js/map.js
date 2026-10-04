/* map.js — interactive map viewer.
 *
 * Reads maps and markers from Supabase (public read, DM-only write) and renders
 * them over the map image with Leaflet.
 *
 * All coordinate conversion goes through map-coords.js. Nothing in this file
 * does its own arithmetic on lat/lng; see that file for why.
 *
 * Exposes window.AhvantirMap so map-editor.js can attach DM tooling without
 * this module knowing anything about editing. Visitors never load the editor.
 */
(function () {
  'use strict';

  const client = window.__supabase;
  const C = window.MapCoords;
  const canvas = document.getElementById('map-canvas');
  const statusBox = document.getElementById('map-status');
  const toolbar = document.getElementById('map-toolbar');
  const select = document.getElementById('map-select');
  const toggles = document.getElementById('map-toggles');
  const listEl = document.getElementById('map-marker-list');
  const hintEl = document.getElementById('map-sidebar-hint');
  const searchEl = document.getElementById('map-search');
  const filterStatusEl = document.getElementById('map-filter-status');
  const listToggle = document.getElementById('map-list-toggle');
  const LAST_MAP_KEY = 'ahvantir:lastMap';
  /* A zoom floor low enough that any map fits inside any frame. Used while
     asking Leaflet what "fits" means, because getBoundsZoom clamps its answer to
     the CURRENT minZoom: with the floor already pinned, it can never report a
     zoom below it, and the map stays cropped. */
  const ZOOM_FLOOR = -8;

  if (!canvas || !client || !C || typeof L === 'undefined') return;

  const state = {
    map: null,
    mapRow: null,
    maps: [],
    entries: [],          // { marker, layer, group }
    articles: new Map(),
    hiddenGroups: new Set(),
    labels: [],           // { label, layer, group } — district names on the map
    query: '',            // the search box, lowercased
    selectedId: null,
    editing: false,       // set by the editor; suppresses click-to-open-article
  };

  /* ---------- status ---------- */
  function status(title, text) {
    if (!statusBox) return;
    if (title === null) { statusBox.hidden = true; return; }
    statusBox.hidden = false;
    statusBox.innerHTML =
      '<div class="map-status__inner">' +
      '<span class="map-status__icon" aria-hidden="true">\u{1F5FA}</span>' +
      '<p class="map-status__title"></p>' +
      (text ? '<p class="map-status__text"></p>' : '') +
      '</div>';
    statusBox.querySelector('.map-status__title').textContent = title;
    if (text) statusBox.querySelector('.map-status__text').textContent = text;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ---------- data ---------- */
  async function loadArticles() {
    try {
      const res = await fetch('/map-articles.json');
      if (!res.ok) return;
      (await res.json()).forEach((a) => state.articles.set(a.slug, a));
    } catch (_) {
      /* Tooltips fall back to the marker title. Not worth failing the page over. */
    }
  }

  function imageUrl(storagePath) {
    return client.storage.from('maps').getPublicUrl(storagePath).data.publicUrl;
  }

  function snippetFor(m) {
    if (m.snippet_override) return m.snippet_override;
    const a = m.article_slug && state.articles.get(m.article_slug);
    return a ? a.excerpt : '';
  }

  function articleUrlFor(m) {
    if (!m.article_slug) return null;
    const a = state.articles.get(m.article_slug);
    return a ? a.url : '/articles/' + m.article_slug + '/';
  }

  /* Is a player part-way through dropping one of their own pins?

     A click inside a district reaches BOTH the district and the map. Leaflet
     registers the map container as an event target as well, so
     _findEventTargets returns [district, map] and _fireDOMEvent fires on each
     in turn. Without this guard the district opens its article at the same
     moment the pin lands.

     Read off the DOM rather than through a shared variable: map-player-notes.js
     owns placing mode and already marks it on #map-page, so this needs no
     plumbing between the two files and cannot drift from the class the CSS is
     keyed to. */
  function isPlacingNote() {
    const page = document.getElementById('map-page');
    return !!page && page.classList.contains('is-placing-note');
  }

  /* ---------- rendering ---------- */
  function tooltipHtml(m) {
    const wrap = document.createElement('div');
    wrap.className = 'map-tip';
    const h = document.createElement('strong');
    h.className = 'map-tip__title';
    h.textContent = m.title;
    wrap.appendChild(h);
    const snip = snippetFor(m);
    if (snip) {
      const p = document.createElement('p');
      p.className = 'map-tip__text';
      p.textContent = snip;
      wrap.appendChild(p);
    }
    const cue = document.createElement('span');
    cue.className = 'map-tip__cue';
    cue.textContent = articleUrlFor(m)
      ? 'Click to open the article'
      : 'No article linked yet';
    wrap.appendChild(cue);
    return wrap;
  }

  /* Point markers hold a roughly constant SCREEN size rather than a constant
     map size. At a fixed radius they clump into an unreadable blob at the
     fitted view and then sit as specks once you have zoomed in to read a
     street. */
  function radiusForZoom() {
    if (!state.map) return 6;
    const span = Math.max(state.map.getMaxZoom() - state.map.getMinZoom(), 0.001);
    const t = Math.min(Math.max((state.map.getZoom() - state.map.getMinZoom()) / span, 0), 1);
    return 4.5 + t * 5;
  }

  function updateMarkerSizes() {
    const r = radiusForZoom();
    state.entries.forEach(({ marker, layer }) => {
      if (marker.kind !== 'area' && layer.setRadius) layer.setRadius(r);
    });
  }

  /* District names drawn onto the map.
     Visibility is driven by how wide the district actually renders, not by a
     zoom threshold. A threshold has to be retuned for every screen size and
     every map, and still shows a name over a district too small to hold it;
     measuring the rendered width works the same on a phone and a wide monitor,
     and copes with districts of wildly different sizes on the same map. */
  /* Rebuild the label set from the current entries.
     Labels have to be derived rather than built once, because the DM editor
     adds and removes markers while the map is open: a district drawn mid-session
     would otherwise have no name until reload, and a deleted one would leave its
     name floating over empty ground. */
  function syncLabels() {
    if (!state.map) return;
    const wanted = state.entries.filter((e) => e.marker.kind === 'area');

    // Drop labels whose entry has gone.
    state.labels = state.labels.filter((rec) => {
      if (wanted.some((e) => e.layer === rec.layer)) return true;
      if (state.map.hasLayer(rec.label)) state.map.removeLayer(rec.label);
      return false;
    });

    wanted.forEach((entry) => {
      const existing = state.labels.find((rec) => rec.layer === entry.layer);
      if (existing) {
        existing.group = entry.group;
        existing.label.setContent(entry.marker.title);
        return;
      }
      const label = L.tooltip({
        permanent: true, direction: 'center', interactive: false,
        className: 'map-label', opacity: 1,
      })
        .setLatLng(entry.layer.getBounds().getCenter())
        .setContent(entry.marker.title);
      state.labels.push({ label: label, layer: entry.layer, group: entry.group });
    });
  }

  function updateLabels() {
    if (!state.map) return;
    state.labels.forEach(({ label, layer, group }) => {
      // Re-anchor every time: a polygon the DM drags or reshapes keeps the same
      // layer object, so a position captured at creation would stay behind.
      label.setLatLng(layer.getBounds().getCenter());
      let show = !state.editing
        && !state.hiddenGroups.has(group)
        && state.group.hasLayer(layer);
      if (show) {
        const b = layer.getBounds();
        const nw = state.map.latLngToContainerPoint(b.getNorthWest());
        const se = state.map.latLngToContainerPoint(b.getSouthEast());
        show = (se.x - nw.x) >= 90 && (se.y - nw.y) >= 26;
      }
      const on = state.map.hasLayer(label);
      if (show && !on) label.addTo(state.map);
      if (!show && on) state.map.removeLayer(label);
    });
  }

  function matchesQuery(m) {
    if (!state.query) return true;
    return (m.title || '').toLowerCase().indexOf(state.query) !== -1
        || (m.group_name || '').toLowerCase().indexOf(state.query) !== -1;
  }

  function isVisible(entry) {
    return !state.hiddenGroups.has(entry.group) && matchesQuery(entry.marker);
  }

  function drawMarker(m) {
    const h = state.mapRow.image_height;
    let layer;
    if (m.kind === 'area' && Array.isArray(m.points)) {
      layer = L.polygon(C.ringToLatLngs(m.points, h), {
        color: m.color, fillColor: m.color,
        weight: 2, opacity: 0.85, fillOpacity: 0.35,
      });
      layer.on('mouseover', () => { if (!state.editing) layer.setStyle({ fillOpacity: 0.55 }); });
      layer.on('mouseout', () => { if (!state.editing) layer.setStyle({ fillOpacity: 0.35 }); });
    } else {
      layer = L.circleMarker(C.toLatLng(m.geo_x, m.geo_y, h), {
        radius: radiusForZoom(), color: '#15110c', weight: 2,
        fillColor: m.color, fillOpacity: 1,
      });
    }
    layer.bindTooltip(tooltipHtml(m), {
      direction: 'top', opacity: 1, className: 'map-tip-wrap',
    });
    // The marker id travels with the layer so the editor can map a Geoman event
    // back to a database row without a lookup table that can fall out of sync.
    layer.__markerId = m.id;
    layer.on('click', () => {
      if (state.editing) return;          // the editor handles clicks in edit mode
      if (isPlacingNote()) return;        // the player is dropping a pin, not browsing
      const url = articleUrlFor(m);
      if (url) window.open(url, '_blank', 'noopener');
    });
    return layer;
  }

  function renderSidebar() {
    listEl.innerHTML = '';
    // Announce the result of a filter. The count is self-evident visually and
    // silent otherwise, so searching felt like nothing had happened.
    if (filterStatusEl) {
      const shownNow = state.entries.filter(isVisible).length;
      filterStatusEl.textContent = state.entries.length
        ? shownNow + ' of ' + state.entries.length + ' locations shown'
        : '';
    }
    if (!state.entries.length) {
      hintEl.textContent = 'Nothing has been marked on this map yet.';
      hintEl.hidden = false;
      return;
    }

    const shown = state.entries.filter(isVisible);
    if (!shown.length) {
      hintEl.textContent = state.query
        ? 'Nothing here matches \u201c' + state.query + '\u201d.'
        : 'Every layer is hidden. Turn one back on above.';
      hintEl.hidden = false;
      return;
    }
    hintEl.hidden = true;

    const groups = new Map();
    shown.forEach(({ marker: m }) => {
      const key = m.group_name || 'Locations';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    });

    [...groups.entries()].forEach(([name, items]) => {
      const sec = document.createElement('section');
      sec.className = 'map-group';
      const h = document.createElement('h3');
      h.className = 'map-group-title';
      h.textContent = name;
      sec.appendChild(h);
      const ul = document.createElement('ul');
      ul.className = 'map-marker-group';
      ul.setAttribute('role', 'list');
      items.forEach((m) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'map-marker-item';
        if (m.id === state.selectedId) btn.setAttribute('aria-current', 'true');
        const dot = document.createElement('span');
        dot.className = 'map-marker-item__dot' + (m.kind === 'area' ? ' is-area' : '');
        dot.style.background = m.color;
        btn.appendChild(dot);
        btn.appendChild(document.createTextNode(m.title));
        btn.title = 'Show ' + m.title + ' on the map';
        btn.addEventListener('click', () => api.select(m.id));
        li.appendChild(btn);

        // The keyboard route to the article. Opening one was mouse-only: it
        // hung off a click handler on an SVG path, which is not focusable, and
        // this button only pans the map. A real link also gives middle-click
        // and "open in new tab" for free.
        const url = articleUrlFor(m);
        if (url) {
          const a = document.createElement('a');
          a.className = 'map-marker-item__open';
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = 'Open';
          a.setAttribute('aria-label', 'Open the article for ' + m.title);
          li.appendChild(a);
        }
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      listEl.appendChild(sec);
    });
  }

  function renderToggles() {
    toggles.innerHTML = '';
    const counts = new Map();
    state.entries.forEach((e) => counts.set(e.group, (counts.get(e.group) || 0) + 1));
    const names = [...counts.keys()];
    // One group normally needs no filter UI. But if a group is currently hidden,
    // dropping the chips strands its markers with nothing to turn them back on.
    if (names.length < 2 && !state.hiddenGroups.size) return;

    names.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-toggle';
      btn.setAttribute('aria-pressed', String(!state.hiddenGroups.has(name)));
      // A swatch, but only where the group really has one colour. Districts and
      // Quarters are deliberately multicoloured, and showing the first member's
      // colour there states something untrue about the layer. Those get a
      // mixed-swatch instead.
      const colours = [...new Set(state.entries
        .filter((e) => e.group === name)
        .map((e) => e.marker.color))];
      const dot = document.createElement('span');
      dot.className = 'map-toggle__dot';
      if (colours.length === 1) {
        dot.style.background = colours[0];
      } else {
        dot.classList.add('is-mixed');
        dot.style.background =
          'conic-gradient(' + colours.slice(0, 6).join(',') + ',' + colours[0] + ')';
      }
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(name));
      const n = document.createElement('span');
      n.className = 'map-toggle__count';
      n.textContent = counts.get(name);
      btn.appendChild(n);

      btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!on));
        if (on) state.hiddenGroups.add(name); else state.hiddenGroups.delete(name);
        applyVisibility();
        renderSidebar();
      });
      toggles.appendChild(btn);
    });
  }

  /* Put areas behind and points in front.
     Leaflet draws vector layers in the order they were added to the SVG, so a
     layer re-added by the filter, the search box or an editor save lands on top
     of everything else. A district back on top swallows the pointer events of
     every marker inside it: hover summaries and click-to-open both stop working
     with nothing on screen to explain why. Re-assert the order after any add. */
  function restack() {
    state.entries.forEach((e) => {
      if (e.marker.kind === 'area' && e.layer.bringToBack) e.layer.bringToBack();
    });
    state.entries.forEach((e) => {
      if (e.marker.kind !== 'area' && e.layer.bringToFront) e.layer.bringToFront();
    });
  }

  function applyVisibility() {
    state.entries.forEach((entry) => {
      const show = isVisible(entry);
      const on = state.group.hasLayer(entry.layer);
      if (show && !on) state.group.addLayer(entry.layer);
      if (!show && on) state.group.removeLayer(entry.layer);
    });
    restack();
    updateLabels();
  }

  /* Reset-view and fullscreen, as Leaflet controls so they sit with the zoom
     buttons rather than floating separately over the image. */
  function addMapControls(map) {
    const Bar = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        const bar = L.DomUtil.create('div', 'leaflet-bar map-ctrl');

        function button(label, title, fn) {
          const a = L.DomUtil.create('a', '', bar);
          a.href = '#';
          a.title = title;
          a.setAttribute('role', 'button');
          a.setAttribute('aria-label', title);
          a.innerHTML = label;
          L.DomEvent.on(a, 'click', function (e) {
            L.DomEvent.stop(e);
            fn();
          });
          // An anchor fires click on Enter but not on Space, and role="button"
          // promises that Space works.
          L.DomEvent.on(a, 'keydown', function (e) {
            if (e.key === ' ' || e.key === 'Spacebar') {
              L.DomEvent.stop(e);
              fn();
            }
          });
          return a;
        }

        button('\u2302', 'Reset view', function () {
          if (state.homeBounds) map.fitBounds(state.homeBounds);
        });

        // Element fullscreen does not exist on iPhone Safari. Rather than
        // ship a control that is focusable, labelled and does nothing, leave
        // it out entirely when the platform cannot honour it.
        const stageEl = document.getElementById('map-page');
        if (stageEl && stageEl.requestFullscreen) {
          state.fsButton = button('\u26F6', 'Fullscreen', toggleFullscreen);
        }

        L.DomEvent.disableClickPropagation(bar);
        L.DomEvent.disableScrollPropagation(bar);
        return bar;
      },
    });
    map.addControl(new Bar());
  }

  /* Fullscreen the stage, not the whole page: the locations list below is not
     part of what you want filling a screen, and taking only the frame keeps the
     map's aspect ratio sane. */
  function toggleFullscreen() {
    // The whole page element, not just the frame. Fullscreen puts its target in
    // the top layer and everything else is hidden behind it, so taking only
    // .map-stage left the DM toolbar, the properties panel and every save and
    // error toast invisible to a DM working fullscreen. The locations list is
    // hidden by CSS instead, which gets the same immersive result.
    const stage = document.getElementById('map-page');
    if (!stage) return;
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (stage.requestFullscreen) {
      stage.requestFullscreen().catch(function () {
        /* Refused (permissions policy, or an iOS browser that has no element
           fullscreen). Nothing to recover: the map still works at page size. */
      });
    }
  }

  /* Fills the map chooser from state.maps. Called on boot, and again if the
     editor widens the list to include unpublished maps. */
  function renderMapSelect() {
    const current = select.value;
    select.innerHTML = '';
    state.maps.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.slug;
      opt.textContent = m.is_published ? m.title : m.title + ' (unpublished)';
      select.appendChild(opt);
    });
    const sw = select.closest('.map-switch');
    if (sw) sw.hidden = state.maps.length < 2;
    if (current && state.maps.some((m) => m.slug === current)) select.value = current;
  }

  /* ---------- map loading ---------- */
  /* Every load takes a ticket. Nothing that describes "the map on screen" is
     touched until the query comes back AND this call still holds the newest
     ticket.
     Two ways this bit before: a <select> with focus fires change on every arrow
     key, so arrow-ing through the chooser starts a load per keypress and a slow
     one could finish last and leave state.mapRow describing a map that is not
     drawn; and a failed query used to return after the mutations, leaving
     mapRow, --map-aspect and hiddenGroups pointing at a map that never
     rendered. Either way drawMarker converts coordinates against the wrong
     image_height and the editor writes to the wrong map_id. */
  let loadTicket = 0;

  async function showMap(row) {
    const ticket = ++loadTicket;
    status('Loading ' + row.title + '…');

    const res = await client
      .from('map_markers')
      .select('*')
      .eq('map_id', row.id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true });

    if (ticket !== loadTicket) return;    // a newer load started; drop this one
    if (res.error) { status('Could not load this map', res.error.message); return; }

    state.mapRow = row;
    // Publish this map's shape so the frame can match it on narrow screens.
    // Set before Leaflet is created so it measures the final height.
    const pageEl = document.getElementById('map-page');
    if (pageEl) {
      pageEl.style.setProperty('--map-aspect',
        row.image_width + ' / ' + row.image_height);
    }
    state.hiddenGroups = new Set();
    state.selectedId = null;
    // The frame's accessible name named whichever map loaded first, for every
    // map after it.
    if (canvas) canvas.setAttribute('aria-label', 'Interactive map: ' + row.title);

    if (state.map) { state.map.remove(); state.map = null; }
    state.labels = [];
    state.entries = [];

    const w = row.image_width, h = row.image_height;
    // Zoom is deliberately fine-grained. With the default zoomSnap/zoomDelta of
    // 1, every scroll click DOUBLES the scale, and this image needs eight whole
    // steps from its fitted view, so a single click overshoots the thing you
    // were aiming at. Quarter steps make it controllable.
    //
    // maxZoom 1 is where a raster stops being useful: zoom 0 is one image pixel
    // per screen pixel, so 1 is already 2x and anything beyond is just a
    // blurrier version of the same thing. minZoom is set from the fitted zoom
    // below, once the container size is known, so the map cannot be shrunk
    // smaller than its own frame.
    state.map = L.map(canvas, {
      crs: L.CRS.Simple,
      // A floor low enough that fitBounds can always compute a real fit. Leaflet
      // defaults minZoom to 0 for CRS.Simple, which silently clamps the fit to
      // natural size and leaves the map showing a sliver of a 4962px image. The
      // real floor is applied right after fitBounds, once the fit is known.
      minZoom: ZOOM_FLOOR,
      maxZoom: 1,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 120,
      attributionControl: false,
      zoomControl: true,
      maxBoundsViscosity: 0.85,
    });
    const bounds = [[0, 0], [h, w]];
    // pmIgnore MUST be a constructor option. Geoman attaches itself in a Leaflet
    // init hook, so setting options.pmIgnore afterwards is too late and the layer
    // still gets a .pm — verified against 2.20.2. Without this, a stray click in
    // removal mode deletes the map background out from under every marker.
    state.overlay = L.imageOverlay(imageUrl(row.storage_path), bounds, {
      pmIgnore: true,
    }).addTo(state.map);
    state.map.fitBounds(bounds);
    // Pin the floor to whatever "the whole map fits" turned out to be, so there
    // is no dead zoom range below it where the image floats in empty space.
    state.map.setMinZoom(state.map.getZoom());
    state.map.setMaxBounds(L.latLngBounds(bounds).pad(0.08));
    state.homeBounds = bounds;

    // Everything drawn lives in one FeatureGroup. Geoman re-fires layer events on
    // parent groups, so the editor binds handlers once here rather than per layer.
    state.group = L.featureGroup().addTo(state.map);

    // Areas first so point markers stay clickable on top of them.
    const ordered = (res.data || []).slice().sort(
      (a, b) => (a.kind === 'area' ? 0 : 1) - (b.kind === 'area' ? 0 : 1));
    ordered.forEach((m) => {
      const layer = drawMarker(m);
      state.group.addLayer(layer);
      state.entries.push({ marker: m, layer, group: m.group_name || 'Locations' });
    });

    // District names. Built as standalone tooltips rather than bound to the
    // polygon, because a layer can only carry one tooltip and the hover summary
    // already uses it.
    state.labels = [];
    syncLabels();

    state.map.on('zoomend', function () {
      updateMarkerSizes();
      updateLabels();
    });
    state.map.on('moveend', updateLabels);
    addMapControls(state.map);
    updateMarkerSizes();
    updateLabels();

    // A query may still be sitting in the search box from the previous map.
    // renderSidebar honours it either way, so without this the list is filtered
    // and the map is not.
    applyVisibility();
    renderToggles();
    renderSidebar();
    // Zero markers is a successful response, not a failure. Say which it was, so
    // an RLS mistake that returns nothing does not read as "nothing is marked".
    status(null);

    try { localStorage.setItem(LAST_MAP_KEY, row.slug); } catch (_) {}
    document.dispatchEvent(new CustomEvent('ahvantir:map-loaded', { detail: { row } }));
  }

  /* ---------- the surface the editor attaches to ---------- */
  const api = {
    get leaflet() { return state.map; },
    get group() { return state.group; },
    get mapRow() { return state.mapRow; },
    get maps() { return state.maps; },
    get entries() { return state.entries; },
    get articles() { return state.articles; },
    setEditing(on) {
      state.editing = !!on;
      // updateLabels() keys off state.editing, and nothing else fires when edit
      // mode flips: district names stayed hidden after leaving it until the next
      // pan or zoom. syncLabels also re-anchors names to polygons the DM moved.
      syncLabels();
      updateLabels();
    },
    drawMarker: drawMarker,
    status: status,
    esc: esc,

    select(id) {
      const entry = state.entries.find((e) => e.marker.id === id);
      if (!entry || !state.map) return;
      state.selectedId = id;
      const l = entry.layer;
      if (l.getBounds) state.map.fitBounds(l.getBounds(), { maxZoom: state.map.getZoom() });
      else state.map.panTo(l.getLatLng());
      l.openTooltip();
      // renderSidebar rebuilds every row, so the button the user just activated
      // is destroyed and focus falls to <body>. Put it back on the replacement.
      const refocus = document.activeElement
        && document.activeElement.classList
        && document.activeElement.classList.contains('map-marker-item');
      renderSidebar();
      if (refocus) {
        const again = listEl.querySelector('.map-marker-item[aria-current="true"]');
        if (again) again.focus();
      }
      document.dispatchEvent(new CustomEvent('ahvantir:marker-selected', { detail: entry }));
    },

    /* Add / replace / drop one marker locally after the editor has written it,
       so a successful save never needs a full reload. */
    upsertLocal(marker, layer) {
      const i = state.entries.findIndex((e) => e.marker.id === marker.id);
      if (i >= 0) {
        state.entries[i].marker = marker;
        // The group travels with the row. Without this a DM renaming a marker's
        // group leaves the chips and the list headings disagreeing until reload.
        state.entries[i].group = marker.group_name || 'Locations';
        if (layer) state.entries[i].layer = layer;
      } else {
        state.entries.push({ marker, layer, group: marker.group_name || 'Locations' });
      }
      // The editor re-adds a saved layer unconditionally, so a marker excluded
      // by the current filter would pop back onto the map. applyVisibility puts
      // it back where the filter says it belongs.
      syncLabels();
      applyVisibility();
      renderToggles();
      renderSidebar();
    },
    removeLocal(id) {
      const i = state.entries.findIndex((e) => e.marker.id === id);
      if (i >= 0) {
        if (state.group.hasLayer(state.entries[i].layer)) {
          state.group.removeLayer(state.entries[i].layer);
        }
        state.entries.splice(i, 1);
      }
      syncLabels();
      updateLabels();
      renderToggles();
      renderSidebar();
    },
    /* Widen the chooser to every map, not just the published ones.
       A map is created unpublished, so without this the DM uploads a map and
       then cannot select it, and unpublishing one makes it vanish from under
       the DM who was still marking it up. Only the DM can read these rows;
       for anyone else the query simply returns the published ones again. */
    async includeUnpublished() {
      try { await initDone; } catch (_) {}
      const res = await client.from('maps').select('*')
        .order('sort_order', { ascending: true })
        .order('title', { ascending: true });
      if (res.error || !res.data) return false;
      const hadNone = state.maps.length === 0;
      state.maps = res.data;
      renderMapSelect();
      if (toolbar) toolbar.hidden = false;
      if (hadNone && state.maps.length) {
        select.value = state.maps[0].slug;
        await showMap(state.maps[0]);
      }
      return true;
    },
    reloadCurrent() { if (state.mapRow) return showMap(state.mapRow); },
  };
  window.AhvantirMap = api;

  /* ---------- boot ---------- */
  async function init() {
    await loadArticles();

    if (searchEl) {
      searchEl.addEventListener('input', function () {
        state.query = searchEl.value.trim().toLowerCase();
        applyVisibility();
        renderSidebar();
      });
    }

    if (listToggle) {
      listToggle.addEventListener('click', function () {
        const open = listToggle.getAttribute('aria-expanded') === 'true';
        listToggle.setAttribute('aria-expanded', String(!open));
        listToggle.querySelector('.map-browser__collapse-text').textContent =
          open ? 'Show list' : 'Hide list';
        document.getElementById('map-page').classList.toggle('is-list-collapsed', open);
      });
    }

    // Leaflet measures its container once. Anything that changes the frame's
    // size — a window resize, leaving fullscreen — has to tell it to measure
    // again, or the map keeps rendering at the old size and clicks land in the
    // wrong place.
    const remeasure = function () {
      if (!state.map) return;
      state.map.invalidateSize();
      // Re-derive the zoom floor. It is "the zoom at which this map fits this
      // frame", which depends on the frame's size, so pinning it once at load
      // meant any later resize — a snapped window, devtools, browser zoom, a
      // phone rotating — left the map cropped with no way back out and Reset
      // view unable to fix it.
      if (state.homeBounds) {
        // Unpin before asking. getBoundsZoom clamps to the current minZoom, so
        // querying it while the old floor is still in place just returns the old
        // floor and the map stays cropped after the frame shrinks.
        state.map.setMinZoom(ZOOM_FLOOR);
        const fit = state.map.getBoundsZoom(state.homeBounds);
        if (isFinite(fit)) {
          state.map.setMinZoom(fit);
          if (state.map.getZoom() < fit) state.map.setZoom(fit);
        }
      }
      updateLabels();
    };
    window.addEventListener('resize', remeasure);
    document.addEventListener('fullscreenchange', function () {
      const on = !!document.fullscreenElement;
      document.getElementById('map-page').classList.toggle('is-fullscreen', on);
      if (state.fsButton) {
        const name = on ? 'Exit fullscreen' : 'Fullscreen';
        state.fsButton.title = name;
        // title alone does not change the accessible name once aria-label is set.
        state.fsButton.setAttribute('aria-label', name);
      }
      setTimeout(remeasure, 60);
    });

    // Registered before the early return below: with no published maps the DM
    // can still add one through the editor, and the chooser has to work then.
    select.addEventListener('change', () => {
      const row = state.maps.find((m) => m.slug === select.value);
      if (row) showMap(row);
    });

    const res = await client
      .from('maps')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true });

    if (res.error) { status('Could not reach the map library', res.error.message); return; }
    state.maps = res.data || [];

    if (!state.maps.length) {
      status('No maps published yet',
        'Maps appear here once the DM uploads one and marks it published.');
      document.dispatchEvent(new CustomEvent('ahvantir:map-empty'));
      return;
    }

    renderMapSelect();
    toolbar.hidden = false;

    let start = state.maps[0];
    try {
      const last = localStorage.getItem(LAST_MAP_KEY);
      const found = last && state.maps.find((m) => m.slug === last);
      if (found) start = found;
    } catch (_) {}
    select.value = start.slug;
    await showMap(start);
  }

  let initDone;
  document.addEventListener('DOMContentLoaded', () => { initDone = init(); });
})();
