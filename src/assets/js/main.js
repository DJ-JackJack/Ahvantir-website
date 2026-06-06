(function () {
  // Mobile nav toggle
  const burger = document.querySelector('.nav__burger');
  const links = document.querySelector('.nav__links');

  if (burger && links) {
    burger.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!burger.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Highlight active nav link
  const path = window.location.pathname;
  document.querySelectorAll('.nav__links a').forEach((a) => {
    if (a.getAttribute('href') !== '/' && path.startsWith(a.getAttribute('href'))) {
      a.style.color = 'var(--burg)';
    }
  });
})();
