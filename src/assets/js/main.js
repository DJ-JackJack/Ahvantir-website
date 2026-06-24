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
