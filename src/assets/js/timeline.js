window.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('timeline-h');
  if (!el) return;

  // Scroll to roughly the middle of the timeline on load so earlier history is accessible
  // (most timelines start at the beginning — leave at 0 unless entries are very short)

  // ── Drag-to-scroll (mouse) ──────────────────────────────────────
  var isDragging = false;
  var startX = 0;
  var scrollOrigin = 0;

  el.addEventListener('mousedown', function (e) {
    // Ignore clicks on links/buttons inside the cards
    if (e.target.closest('a, button')) return;
    isDragging = true;
    el.classList.add('is-dragging');
    startX = e.pageX;
    scrollOrigin = el.scrollLeft;
    e.preventDefault();
  });

  window.addEventListener('mouseup', function () {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove('is-dragging');
  });

  window.addEventListener('mousemove', function (e) {
    if (!isDragging) return;
    var dx = e.pageX - startX;
    el.scrollLeft = scrollOrigin - dx;
  });

  // ── Keyboard navigation ─────────────────────────────────────────
  el.setAttribute('tabindex', '0');
  el.addEventListener('keydown', function (e) {
    var step = 240;
    if (e.key === 'ArrowRight') { el.scrollLeft += step; e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { el.scrollLeft -= step; e.preventDefault(); }
  });

  // ── Hide scroll hint once user has scrolled ─────────────────────
  var hint = document.querySelector('.timeline-h__hint');
  if (hint) {
    el.addEventListener('scroll', function () {
      hint.style.opacity = '0';
    }, { once: true });
  }
});
