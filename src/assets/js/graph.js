window.addEventListener('DOMContentLoaded', function () {
  var _graphEl = document.getElementById('graph-data');
  var data = _graphEl ? JSON.parse(_graphEl.textContent) : window.__GRAPH_DATA__;
  var container = document.getElementById('graph-container');
  if (!data || !container) return;
  if (typeof d3 === 'undefined') {
    var ph = container.querySelector('.graph-placeholder');
    if (ph) ph.innerHTML = '<span aria-hidden="true">◎</span><p>The graph could not load. <a href="">Reload the page</a> to try again.</p>';
    return;
  }

  var placeholder = container.querySelector('.graph-placeholder');
  if (placeholder) placeholder.remove();

  var W = container.clientWidth  || 960;
  var H = container.clientHeight || 650;

  // ── Province colours (parchment-appropriate) ──────────────────
  var COLORS = {
    history:    '#8b4513',
    locations:  '#2e6b4f',
    factions:   '#7b1d2a',
    characters: '#2c4a7c',
    religion:   '#6b3d8b',
    magic:      '#1a6b6b',
    cosmology:  '#5c4a1e',
    culture:    '#6b5030',
    default:    '#777',
  };

  var LABELS = {
    history:    'History',
    locations:  'Locations',
    factions:   'Factions',
    characters: 'Characters',
    religion:   'Religion & Orders',
    magic:      'Magic & Arcane',
    cosmology:  'Cosmology',
    culture:    'Culture & Society',
    default:    'Other',
  };

  // ── Data ──────────────────────────────────────────────────────
  var nodes = data.nodes.map(function (d) { return Object.assign({}, d); });
  var links = (data.links || []).map(function (l) { return Object.assign({}, l); });

  // Discover categories in data order
  var catSeen = Object.create(null);
  var categories = [];
  nodes.forEach(function (n) {
    var c = n.category || 'default';
    if (!catSeen[c]) { catSeen[c] = true; categories.push(c); }
  });

  // ── Cluster centres — arranged in a circle ────────────────────
  var cx = W / 2, cy = H / 2;
  var clusterR = Math.min(W, H) * 0.30;
  var clusterCenters = Object.create(null);
  categories.forEach(function (cat, i) {
    var angle = (i / categories.length) * 2 * Math.PI - Math.PI / 2;
    clusterCenters[cat] = {
      x: cx + clusterR * Math.cos(angle),
      y: cy + clusterR * Math.sin(angle)
    };
  });

  // ── SVG ───────────────────────────────────────────────────────
  var svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H)
    .attr('viewBox', '0 0 ' + W + ' ' + H);

  // Layers — order matters: hulls → links → nodes → labels
  var hullLayer  = svg.append('g').attr('class', 'province-hulls');
  var linkLayer  = svg.append('g');
  var nodeLayer  = svg.append('g');
  var labelLayer = svg.append('g').attr('class', 'province-labels');

  // ── Province labels (fixed at initial cluster centres) ────────
  categories.forEach(function (cat) {
    var c = clusterCenters[cat];
    var color = COLORS[cat] || COLORS.default;
    var label = LABELS[cat] || cat;

    // Decorative rule above the text
    labelLayer.append('line')
      .attr('x1', c.x - 28).attr('y1', c.y - 16)
      .attr('x2', c.x + 28).attr('y2', c.y - 16)
      .attr('stroke', color).attr('stroke-opacity', 0.35)
      .attr('stroke-width', 0.8);

    labelLayer.append('text')
      .attr('x', c.x).attr('y', c.y - 4)
      .attr('text-anchor', 'middle')
      .attr('font-family', "'Cinzel', 'Palatino Linotype', serif")
      .attr('font-size', '9.5px')
      .attr('letter-spacing', '0.1em')
      .attr('fill', color)
      .attr('fill-opacity', 0.55)
      .attr('pointer-events', 'none')
      .text(label.toUpperCase());
  });

  // ── Links ─────────────────────────────────────────────────────
  var link = linkLayer.selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#c4a878')
    .attr('stroke-opacity', 0.3)
    .attr('stroke-width', 0.7);

  // ── Nodes ─────────────────────────────────────────────────────
  var node = nodeLayer.selectAll('g')
    .data(nodes)
    .join('g')
    .attr('cursor', 'pointer')
    .call(
      d3.drag()
        .on('start', function (e, d) {
          if (!e.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', function (e, d) { d.fx = e.x; d.fy = e.y; })
        .on('end',  function (e, d) {
          if (!e.active) sim.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
    );

  node.append('circle')
    .attr('r', 5)
    .attr('fill', function (d) { return COLORS[d.category] || COLORS.default; })
    .attr('fill-opacity', 0.8)
    .attr('stroke', '#fdf8ed')
    .attr('stroke-width', 1);

  /* Each node is a link, and now says so. The accessible name carries the
     category as well, because "Heartspire" on its own does not tell a
     screen-reader user what kind of thing they are about to open. */
  node
    .attr('role', 'link')
    .attr('aria-label', function (d) {
      var cat = LABELS[d.category || 'default'] || d.category || '';
      return cat ? d.title + ' — ' + cat : d.title;
    });

  // ── Tooltip ───────────────────────────────────────────────────
  var tooltip = document.getElementById('graph-tooltip');

  node
    .on('mouseover', function (e, d) {
      if (!tooltip) return;
      var cat = d.category || 'default';
      // Use textContent for data-derived values to prevent XSS via article titles
      tooltip.innerHTML = '<span class="graph-tooltip__title"></span><span class="graph-tooltip__cat"></span>';
      tooltip.querySelector('.graph-tooltip__title').textContent = d.title || '';
      tooltip.querySelector('.graph-tooltip__cat').textContent   = LABELS[cat] || cat;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    })
    .on('mousemove', function (e) {
      if (!tooltip) return;
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    })
    .on('mouseout', function () {
      if (tooltip) tooltip.style.display = 'none';
    })
    .on('click', function (e, d) { window.location.href = d.url; });

  /* ── Keyboard access ──────────────────────────────────────────
     The graph was mouse-only: no tabindex, no key handling, so every one of
     these articles was unreachable without a pointer.

     Roving tabindex rather than tabindex="0" on each node. There are 239 of
     them, and putting all 239 in the tab sequence would trade one barrier for
     another — anyone tabbing to the footer would have to pass the entire graph.
     So the graph is ONE tab stop, and arrow keys move between nodes inside it,
     which is the usual pattern for a composite widget.

     Movement follows data order, not screen position: the layout is a live
     force simulation, so "the node to the right" is not stable from one second
     to the next, while data order is the same on every visit. */
  var focusIdx = 0;

  function visibleNodes() {
    // The filter dims rather than removes, so "visible" means not dimmed.
    return node.nodes().filter(function (el) {
      return parseFloat(el.getAttribute('opacity') || '1') > 0.5;
    });
  }

  function setRoving(target) {
    var els = node.nodes();
    for (var i = 0; i < els.length; i++) {
      els[i].setAttribute('tabindex', els[i] === target ? '0' : '-1');
    }
  }

  /* Only one node is tabbable at a time; the rest are reachable by arrow key. */
  function resetRoving() {
    var vis = visibleNodes();
    var first = vis.length ? vis[0] : node.nodes()[0];
    focusIdx = 0;
    setRoving(first);
  }
  resetRoving();

  function showTipFor(el, d) {
    if (!tooltip) return;
    var cat = d.category || 'default';
    tooltip.innerHTML = '<span class="graph-tooltip__title"></span><span class="graph-tooltip__cat"></span>';
    tooltip.querySelector('.graph-tooltip__title').textContent = d.title || '';
    tooltip.querySelector('.graph-tooltip__cat').textContent   = LABELS[cat] || cat;
    // Anchor to the node itself. A keyboard user has no pointer to anchor to,
    // and the mouse path's clientX/clientY would leave the tip wherever the
    // mouse happened to be sitting.
    var r = el.getBoundingClientRect();
    tooltip.style.display = 'block';
    tooltip.style.left = (r.right + 10) + 'px';
    tooltip.style.top  = (r.top - 6) + 'px';
  }

  function moveFocus(delta) {
    var vis = visibleNodes();
    if (!vis.length) return;
    focusIdx = (focusIdx + delta + vis.length) % vis.length;
    var el = vis[focusIdx];
    setRoving(el);
    el.focus();
  }

  node
    .on('focus', function (e, d) {
      var vis = visibleNodes();
      var i = vis.indexOf(this);
      if (i !== -1) focusIdx = i;
      setRoving(this);
      showTipFor(this, d);
    })
    .on('blur', function () {
      if (tooltip) tooltip.style.display = 'none';
    })
    .on('keydown', function (e, d) {
      switch (e.key) {
        case 'Enter':
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          window.location.href = d.url;
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault(); moveFocus(1); break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault(); moveFocus(-1); break;
        case 'Home':
          e.preventDefault(); focusIdx = -1; moveFocus(1); break;
        case 'End':
          e.preventDefault(); focusIdx = 0; moveFocus(-1); break;
        default:
          break;
      }
    });

  // ── Custom cluster force ──────────────────────────────────────
  function clusterForce(alpha) {
    nodes.forEach(function (d) {
      var center = clusterCenters[d.category || 'default'] || { x: cx, y: cy };
      d.vx += (center.x - d.x) * alpha * 0.18;
      d.vy += (center.y - d.y) * alpha * 0.18;
    });
  }

  // ── Simulation ────────────────────────────────────────────────
  var sim = d3.forceSimulation(nodes)
    .force('link',      d3.forceLink(links).id(function (d) { return d.id; }).distance(22).strength(0.4))
    .force('charge',    d3.forceManyBody().strength(-35))
    .force('cluster',   clusterForce)
    .force('collision', d3.forceCollide(8))
    .alphaDecay(0.025);

  // ── Convex hull update ────────────────────────────────────────
  function updateHulls() {
    var hullData = [];
    categories.forEach(function (cat) {
      var pts = [];
      nodes.forEach(function (n) {
        if ((n.category || 'default') === cat && n.x != null) pts.push([n.x, n.y]);
      });
      if (pts.length < 3) return;
      var hull = d3.polygonHull(pts);
      if (hull) hullData.push({ cat: cat, hull: hull });
    });

    hullLayer.selectAll('path')
      .data(hullData, function (d) { return d.cat; })
      .join(function (enter) {
        /* Colour, opacity and dash pattern depend only on the category, which
           never changes for a given hull. Setting them on enter rather than on
           every update saves seven attribute writes per hull per redraw — with
           eight hulls and hundreds of redraws that was tens of thousands of
           writes doing nothing. Only `d` actually changes as the sim moves. */
        return enter.append('path')
          .attr('fill',           function (d) { return COLORS[d.cat] || '#888'; })
          .attr('fill-opacity',   0.055)
          .attr('stroke',         function (d) { return COLORS[d.cat] || '#888'; })
          .attr('stroke-opacity', 0.22)
          .attr('stroke-width',   1.5)
          .attr('stroke-dasharray', '5 3')
          .attr('stroke-linejoin', 'round');
      })
      .attr('d', function (d) {
        // Expand hull outward by 20px for breathing room
        var mx = d3.mean(d.hull, function (p) { return p[0]; });
        var my = d3.mean(d.hull, function (p) { return p[1]; });
        var expanded = d.hull.map(function (p) {
          var dx = p[0] - mx, dy = p[1] - my;
          var len = Math.sqrt(dx * dx + dy * dy) || 1;
          return [p[0] + (dx / len) * 20, p[1] + (dy / len) * 20];
        });
        return 'M' + expanded.join('L') + 'Z';
      });
  }

  /* ── Tick ──────────────────────────────────────────────────────
     Hulls are recomputed every HULL_EVERY ticks, not every tick.

     Each pass scans all 239 nodes once per category to collect points, then
     builds a convex hull and re-expands it. Measured at 0.254ms per pass here,
     and the simulation takes 273 ticks to settle from alpha 1 at alphaDecay
     0.025 — about 69ms of hull maths per page load, before the DOM writes.

     Every third tick is indistinguishable to the eye, because the hull is a
     loose 20px-expanded boundary around a cluster that is itself drifting
     slowly. The 'end' handler below guarantees the settled state is exact, so
     throttling costs nothing in the final rendering. */
  var HULL_EVERY = 3;
  var tickCount = 0;

  sim.on('tick', function () {
    link
      .attr('x1', function (d) { return d.source.x; })
      .attr('y1', function (d) { return d.source.y; })
      .attr('x2', function (d) { return d.target.x; })
      .attr('y2', function (d) { return d.target.y; });

    node.attr('transform', function (d) {
      return 'translate(' + d.x + ',' + d.y + ')';
    });

    if (tickCount++ % HULL_EVERY === 0) updateHulls();
  });

  // The last throttled pass can be up to two ticks stale, so settle it exactly
  // once the simulation stops. Also covers the sim being restarted by a drag.
  sim.on('end', updateHulls);

  // ── Category filter ───────────────────────────────────────────
  var filter = document.getElementById('graph-filter');
  if (filter) {
    filter.addEventListener('change', function () {
      var val = filter.value;

      node.attr('opacity', function (d) {
        return val === 'all' || (d.category || 'default') === val ? 1 : 0.08;
      });

      link.attr('opacity', function (d) {
        if (val === 'all') return 0.3;
        var sc = d.source.category || 'default';
        var tc = d.target.category || 'default';
        return sc === val || tc === val ? 0.5 : 0.02;
      });

      hullLayer.selectAll('path').attr('opacity', function (d) {
        return val === 'all' || d.cat === val ? 1 : 0.1;
      });

      // Filtering dims nodes, so the tabbable one may now be a dimmed node the
      // keyboard should skip. Put the tab stop back on the first visible node.
      resetRoving();

      var statusEl = document.getElementById('graph-filter-status');
      if (statusEl) {
        statusEl.textContent = val === 'all'
          ? 'Showing all categories'
          : 'Showing: ' + filter.options[filter.selectedIndex].text;
      }
    });
  }
});
