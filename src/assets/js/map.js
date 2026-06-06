// World map — configure pins here once a map image is added
// Each pin: { id, title, url, x, y }  (x/y as % of image dimensions)
const MAP_PINS = [];

window.addEventListener('DOMContentLoaded', function () {
  const container = document.getElementById('map-container');
  const pinLayer = document.getElementById('map-pins');
  if (!container || !pinLayer || !MAP_PINS.length) return;

  MAP_PINS.forEach((pin) => {
    const el = document.createElement('a');
    el.href = pin.url;
    el.className = 'map-pin';
    el.setAttribute('aria-label', pin.title);
    el.setAttribute('title', pin.title);
    el.style.left = pin.x + '%';
    el.style.top = pin.y + '%';
    el.innerHTML = '<span class="map-pin__dot" aria-hidden="true"></span>';
    pinLayer.appendChild(el);
  });
});
