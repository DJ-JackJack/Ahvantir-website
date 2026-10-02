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
  const LAST_MAP_KEY = 'ahvantir:lastMap';

  if (!canvas || !client || !C || typeof L === 'undefined') return;

  const state = {
    map: null,
    mapRow: null,
    maps: [],
    entries: [],          // { marker, layer, group }
    articles: new Map(),
    hiddenGroups: new Set(),
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
        radius: 7, color: '#15110c', weight: 2,
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
      const url = articleUrlFor(m);
      if (url) window.open(url, '_blank', 'noopener');
    });
    return layer;
  }

  function renderSidebar() {
    listEl.innerHTML = '';
    const markers = state.entries.map((e) => e.marker);
    if (!markers.length) {
      hintEl.textContent = 'Nothing has been marked on this map yet.';
      hintEl.hidden = false;
      return;
    }
    hintEl.hidden = true;

    const groups = new Map();
    markers.forEach((m) => {
      const key = m.group_name || 'Locations';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    });

    [...groups.entries()].forEach(([name, items]) => {
      if (state.hiddenGroups.has(name)) return;
      const h = document.createElement('h3');
      h.className = 'map-group-title';
      h.textContent = name;
      listEl.appendChild(h);
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
        btn.addEventListener('click', () => api.select(m.id));
        li.appendChild(btn);
        ul.appendChild(li);
      });
      listEl.appendChild(ul);
    });
  }

  function renderToggles() {
    toggles.innerHTML = '';
    const names = [...new Set(state.entries.map((e) => e.group))];
    if (names.length < 2) return;
    names.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-toggle';
      btn.textContent = name;
      btn.setAttribute('aria-pressed', String(!state.hiddenGroups.has(name)));
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

  function applyVisibility() {
    state.entries.forEach(({ layer, group }) => {
      const show = !state.hiddenGroups.has(group);
      const on = state.group.hasLayer(layer);
      if (show && !on) state.group.addLayer(layer);
      if (!show && on) state.group.removeLayer(layer);
    });
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
  async function showMap(row) {
    status('Loading ' + row.title + '…');
    state.mapRow = row;
    state.hiddenGroups = new Set();
    state.selectedId = null;

    const res = await client
      .from('map_markers')
      .select('*')
      .eq('map_id', row.id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true });

    if (res.error) { status('Could not load this map', res.error.message); return; }

    if (state.map) { state.map.remove(); state.map = null; }
    state.entries = [];

    const w = row.image_width, h = row.image_height;
    state.map = L.map(canvas, {
      crs: L.CRS.Simple, minZoom: -5, maxZoom: 4,
      attributionControl: false, zoomControl: true,
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
    state.map.setMaxBounds(L.latLngBounds(bounds).pad(0.25));

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
    setEditing(on) { state.editing = !!on; },
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
      renderSidebar();
      document.dispatchEvent(new CustomEvent('ahvantir:marker-selected', { detail: entry }));
    },

    /* Add / replace / drop one marker locally after the editor has written it,
       so a successful save never needs a full reload. */
    upsertLocal(marker, layer) {
      const i = state.entries.findIndex((e) => e.marker.id === marker.id);
      if (i >= 0) {
        state.entries[i].marker = marker;
        if (layer) state.entries[i].layer = layer;
      } else {
        state.entries.push({ marker, layer, group: marker.group_name || 'Locations' });
      }
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
