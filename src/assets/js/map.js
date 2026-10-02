/* map.js — interactive map viewer.
 *
 * Reads maps and markers from Supabase (public read, DM-only write) and renders
 * them over the map image with Leaflet.
 *
 * Coordinate space: marker coordinates are pixels in the map image, measured
 * from the TOP-LEFT corner. Leaflet's CRS.Simple measures its y axis upward
 * from the bottom, so every conversion goes through toLatLng() below. Keeping
 * one convention in the database and converting once at the boundary is what
 * stops markers landing mirrored, which is the classic failure here.
 */
(function () {
  'use strict';

  const client = window.__supabase;
  const canvas = document.getElementById('map-canvas');
  const statusBox = document.getElementById('map-status');
  const toolbar = document.getElementById('map-toolbar');
  const select = document.getElementById('map-select');
  const toggles = document.getElementById('map-toggles');
  const listEl = document.getElementById('map-marker-list');
  const hintEl = document.getElementById('map-sidebar-hint');
  const LAST_MAP_KEY = 'ahvantir:lastMap';

  if (!canvas || !client || typeof L === 'undefined') return;

  let map = null;
  let overlay = null;
  let layers = [];            // { marker, layer, group }
  let articles = new Map();   // slug -> { title, url, excerpt }
  let hiddenGroups = new Set();

  /* ---------- status panel ---------- */
  function status(title, text) {
    if (!statusBox) return;
    if (title === null) { statusBox.hidden = true; return; }
    statusBox.hidden = false;
    statusBox.innerHTML =
      '<div class="map-status__inner">' +
      '<span class="map-status__icon" aria-hidden="true">🗺</span>' +
      '<p class="map-status__title"></p>' +
      (text ? '<p class="map-status__text"></p>' : '') +
      '</div>';
    statusBox.querySelector('.map-status__title').textContent = title;
    if (text) statusBox.querySelector('.map-status__text').textContent = text;
  }

  /* ---------- data ---------- */
  async function loadArticles() {
    try {
      const res = await fetch('/map-articles.json');
      if (!res.ok) return;
      const rows = await res.json();
      rows.forEach((a) => articles.set(a.slug, a));
    } catch (_) {
      /* Tooltips fall back to the marker's own title. Not worth failing over. */
    }
  }

  function imageUrl(storagePath) {
    return client.storage.from('maps').getPublicUrl(storagePath).data.publicUrl;
  }

  /* ---------- rendering ---------- */
  function toLatLng(x, y, h) { return L.latLng(h - y, x); }

  function snippetFor(m) {
    if (m.snippet_override) return m.snippet_override;
    const a = m.article_slug && articles.get(m.article_slug);
    return a ? a.excerpt : '';
  }

  function articleUrlFor(m) {
    if (!m.article_slug) return null;
    const a = articles.get(m.article_slug);
    return a ? a.url : '/articles/' + m.article_slug + '/';
  }

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
    if (articleUrlFor(m)) {
      const cue = document.createElement('span');
      cue.className = 'map-tip__cue';
      cue.textContent = 'Click to open the article';
      wrap.appendChild(cue);
    }
    return wrap;
  }

  function openArticle(m) {
    const url = articleUrlFor(m);
    if (url) window.open(url, '_blank', 'noopener');
  }

  function drawMarker(m, h) {
    let layer;
    if (m.kind === 'area' && Array.isArray(m.points)) {
      layer = L.polygon(m.points.map((p) => toLatLng(p[0], p[1], h)), {
        color: m.color, fillColor: m.color,
        weight: 2, opacity: 0.85, fillOpacity: 0.35
      });
      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.55 }));
      layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.35 }));
    } else {
      layer = L.circleMarker(toLatLng(m.geo_x, m.geo_y, h), {
        radius: 7, color: '#15110c', weight: 2,
        fillColor: m.color, fillOpacity: 1
      });
    }
    layer.bindTooltip(tooltipHtml(m), { direction: 'top', opacity: 1, className: 'map-tip-wrap' });
    if (articleUrlFor(m)) {
      layer.on('click', () => openArticle(m));
      if (layer.getElement) {
        layer.on('add', () => {
          const el = layer.getElement();
          if (el) el.style.cursor = 'pointer';
        });
      }
    }
    return layer;
  }

  function renderSidebar(markers) {
    listEl.innerHTML = '';
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
        const dot = document.createElement('span');
        dot.className = 'map-marker-item__dot';
        dot.style.background = m.color;
        if (m.kind === 'area') dot.classList.add('is-area');
        btn.appendChild(dot);
        btn.appendChild(document.createTextNode(m.title));
        btn.addEventListener('click', () => focusMarker(m.id));
        li.appendChild(btn);
        ul.appendChild(li);
      });
      listEl.appendChild(ul);
    });
  }

  function focusMarker(id) {
    const entry = layers.find((l) => l.marker.id === id);
    if (!entry || !map) return;
    const layer = entry.layer;
    if (layer.getBounds) map.fitBounds(layer.getBounds(), { maxZoom: map.getZoom() });
    else map.panTo(layer.getLatLng());
    layer.openTooltip();
  }

  function renderToggles(markers) {
    toggles.innerHTML = '';
    const names = [...new Set(markers.map((m) => m.group_name || 'Locations'))];
    if (names.length < 2) return;
    names.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-toggle';
      btn.textContent = name;
      btn.setAttribute('aria-pressed', 'true');
      btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!on));
        if (on) hiddenGroups.add(name); else hiddenGroups.delete(name);
        applyGroupVisibility();
      });
      toggles.appendChild(btn);
    });
  }

  function applyGroupVisibility() {
    layers.forEach(({ layer, group }) => {
      const show = !hiddenGroups.has(group);
      if (show && !map.hasLayer(layer)) layer.addTo(map);
      if (!show && map.hasLayer(layer)) map.removeLayer(layer);
    });
  }

  /* ---------- map loading ---------- */
  async function showMap(row) {
    status('Loading ' + row.title + '…');
    hiddenGroups = new Set();

    const { data: markers, error } = await client
      .from('map_markers')
      .select('*')
      .eq('map_id', row.id)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true });

    if (error) { status('Could not load this map', error.message); return; }

    if (map) { map.remove(); map = null; }
    layers = [];

    const w = row.image_width, h = row.image_height;
    map = L.map(canvas, {
      crs: L.CRS.Simple, minZoom: -5, maxZoom: 4,
      attributionControl: false, zoomControl: true
    });
    const bounds = [[0, 0], [h, w]];
    overlay = L.imageOverlay(imageUrl(row.storage_path), bounds).addTo(map);
    map.fitBounds(bounds);
    map.setMaxBounds(L.latLngBounds(bounds).pad(0.25));

    // Areas first so pins stay clickable on top of them.
    const ordered = (markers || []).slice().sort((a, b) =>
      (a.kind === 'area' ? 0 : 1) - (b.kind === 'area' ? 0 : 1));
    ordered.forEach((m) => {
      const layer = drawMarker(m, h);
      layer.addTo(map);
      layers.push({ marker: m, layer, group: m.group_name || 'Locations' });
    });

    renderToggles(markers || []);
    renderSidebar(markers || []);
    status(null);

    try { localStorage.setItem(LAST_MAP_KEY, row.slug); } catch (_) {}
  }

  /* ---------- boot ---------- */
  async function init() {
    await loadArticles();

    const { data: maps, error } = await client
      .from('maps')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true });

    if (error) {
      status('Could not reach the map library', error.message);
      return;
    }
    if (!maps || !maps.length) {
      status('No maps published yet',
        'Maps appear here once the DM uploads one and marks it published.');
      return;
    }

    select.innerHTML = '';
    maps.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.slug;
      opt.textContent = m.title;
      select.appendChild(opt);
    });
    // Hide the chooser when there is only one map; keep the toolbar for layer toggles.
    if (maps.length < 2) select.closest('.map-switch').hidden = true;
    toolbar.hidden = false;

    let start = maps[0];
    try {
      const last = localStorage.getItem(LAST_MAP_KEY);
      const found = last && maps.find((m) => m.slug === last);
      if (found) start = found;
    } catch (_) {}
    select.value = start.slug;

    select.addEventListener('change', () => {
      const row = maps.find((m) => m.slug === select.value);
      if (row) showMap(row);
    });

    showMap(start);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
