// Timeline page enhancements — animate entries on scroll
window.addEventListener('DOMContentLoaded', function () {
  const entries = document.querySelectorAll('.timeline-entry');
  if (!entries.length) return;

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (items) => {
        items.forEach((item) => {
          if (item.isIntersecting) {
            item.target.style.opacity = '1';
            item.target.style.transform = 'translateX(0)';
            obs.unobserve(item.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );

    entries.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-16px)';
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      obs.observe(el);
    });
  }
});
