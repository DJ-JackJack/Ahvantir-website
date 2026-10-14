/* Theme is applied in theme.js, which runs in <head> before first paint.
   This file only handles the toggle, so it can stay at the foot of the page. */
(function () {
  var toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  function label() {
    var dark = document.documentElement.classList.contains('dark');
    toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    toggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }

  toggle.addEventListener('click', function () {
    var dark = document.documentElement.classList.toggle('dark');
    // Writing the key is also what stops theme.js following the OS from here on.
    try { localStorage.setItem('ahvantir-theme', dark ? 'dark' : 'light'); } catch (e) {}
    label();
  });

  label();
})();

/* Mark the current section. aria-current does the work; the styling hangs off
   it rather than off an inline colour, so the rule lives in the stylesheet
   with every other nav state. */
(function () {
  var path = window.location.pathname;
  var links = document.querySelectorAll('.nav a[href], .nav-drawer a[href]');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href');
    if (!href || href === '/' || href.charAt(0) !== '/') continue;
    var active = path.indexOf(href) === 0 ||
      (href === '/player/dashboard/' && path.indexOf('/player/') === 0 &&
       path.indexOf('/player/hall') !== 0);
    if (active) links[i].setAttribute('aria-current', 'page');
  }
})();
