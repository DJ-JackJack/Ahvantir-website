window.addEventListener('DOMContentLoaded', function () {
  var data = window.__GRAPH_DATA__;
  var container = document.getElementById('graph-container');
  if (!data || !container || typeof d3 === 'undefined') return;

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
      .join('path')
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
      })
      .attr('fill',         function (d) { return COLORS[d.cat] || '#888'; })
      .attr('fill-opacity', 0.055)
      .attr('stroke',       function (d) { return COLORS[d.cat] || '#888'; })
      .attr('stroke-opacity', 0.22)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '5 3')
      .attr('stroke-linejoin', 'round');
  }

  // ── Tick ──────────────────────────────────────────────────────
  sim.on('tick', function () {
    link
      .attr('x1', function (d) { return d.source.x; })
      .attr('y1', function (d) { return d.source.y; })
      .attr('x2', function (d) { return d.target.x; })
      .attr('y2', function (d) { return d.target.y; });

    node.attr('transform', function (d) {
      return 'translate(' + d.x + ',' + d.y + ')';
    });

    updateHulls();
  });

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

      labelLayer.selectAll('text, line').attr('opacity', function () {
        // labels are in document order matching categories array
        return 1; // keep all labels visible — they orient the viewer
      });
    });
  }
});
