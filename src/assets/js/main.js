// Apply saved theme before first paint to avoid flash
(function () { try { if (localStorage.getItem('ahvantir-theme') === 'dark') document.documentElement.classList.add('dark'); } catch (_) {} }());

(function () {
  // Dark mode toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const isDark = document.documentElement.classList.toggle('dark');
      try { localStorage.setItem('ahvantir-theme', isDark ? 'dark' : 'light'); } catch (_) {}
      themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    });
    // Sync aria-label to initial state
    if (document.documentElement.classList.contains('dark')) {
      themeToggle.setAttribute('aria-label', 'Switch to light mode');
    }
  }
})();

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

    // Keyboard: Escape closes nav; Tab cycles focus within open nav
    document.addEventListener('keydown', (e) => {
      if (!links.classList.contains('open')) return;

      if (e.key === 'Escape') {
        links.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        burger.focus();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = [burger, ...Array.from(links.querySelectorAll('a, button:not([hidden]'))];
        const idx = focusable.indexOf(document.activeElement);
        if (e.shiftKey) {
          if (idx <= 0) { e.preventDefault(); focusable[focusable.length - 1].focus(); }
        } else {
          if (idx === -1 || idx === focusable.length - 1) { e.preventDefault(); focusable[0].focus(); }
        }
      }
    });
  }

  // Highlight active nav link
  const path = window.location.pathname;
  document.querySelectorAll('.nav__links a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === '/') return;
    const active = path.startsWith(href) ||
      (href === '/player/dashboard/' && path.startsWith('/player/') && !path.startsWith('/player/hall'));
    if (active) a.style.color = 'var(--burg)';
  });
})();
