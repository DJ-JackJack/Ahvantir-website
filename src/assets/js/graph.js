window.addEventListener('DOMContentLoaded', function () {
  const data = window.__GRAPH_DATA__;
  const container = document.getElementById('graph-container');
  if (!data || !container || typeof d3 === 'undefined') return;

  const placeholder = container.querySelector('.graph-placeholder');
  if (placeholder) placeholder.remove();

  const W = container.clientWidth || 900;
  const H = container.clientHeight || 600;

  const COLORS = {
    history:    '#8b4513',
    locations:  '#2e6b4f',
    factions:   '#4a0f18',
    characters: '#2c4a7c',
    religion:   '#6b3d8b',
    magic:      '#1a6b6b',
    cosmology:  '#5c4a1e',
    culture:    '#4a3a2e',
    default:    '#666',
  };

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`);

  const nodes = data.nodes.map((d) => ({ ...d }));
  const links = (data.links || []).map((l) => ({ ...l }));

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(14));

  const link = svg.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#c4a878')
    .attr('stroke-opacity', 0.5)
    .attr('stroke-width', 1);

  const node = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('cursor', 'pointer')
    .call(
      d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  node.append('circle')
    .attr('r', 6)
    .attr('fill', (d) => COLORS[d.category] || COLORS.default)
    .attr('stroke', '#fdf8ed')
    .attr('stroke-width', 1.5);

  node.append('text')
    .attr('x', 9)
    .attr('y', 4)
    .attr('font-size', '10px')
    .attr('font-family', "'EB Garamond', serif")
    .attr('fill', '#2d1e0e')
    .text((d) => d.title);

  const tooltip = document.getElementById('graph-tooltip');

  node.on('mouseover', (e, d) => {
    if (!tooltip) return;
    tooltip.textContent = d.title;
    tooltip.style.display = 'block';
    tooltip.style.left = e.clientX + 12 + 'px';
    tooltip.style.top = e.clientY - 8 + 'px';
  })
  .on('mousemove', (e) => {
    if (!tooltip) return;
    tooltip.style.left = e.clientX + 12 + 'px';
    tooltip.style.top = e.clientY - 8 + 'px';
  })
  .on('mouseout', () => {
    if (tooltip) tooltip.style.display = 'none';
  })
  .on('click', (e, d) => {
    window.location.href = d.url;
  });

  sim.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  // Category filter
  const filter = document.getElementById('graph-filter');
  if (filter) {
    filter.addEventListener('change', () => {
      const val = filter.value;
      node.attr('opacity', (d) => val === 'all' || d.category === val ? 1 : 0.15);
      link.attr('opacity', (d) => {
        if (val === 'all') return 0.5;
        return (d.source.category === val || d.target.category === val) ? 0.5 : 0.05;
      });
    });
  }
});
