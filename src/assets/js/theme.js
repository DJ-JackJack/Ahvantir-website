/* Runs in <head>, synchronously, BEFORE the stylesheet and before first paint.
   It used to live at the foot of main.js, which meant the page had already
   painted light by the time the class landed: every navigation flashed white
   for a dark-mode reader. Nothing here touches the DOM beyond <html>, so it
   costs one class toggle and no layout.

   An explicit choice wins. With no choice on record we follow the operating
   system, which is what a reader who has set their machine to dark already
   expects, and we keep following it until they pick a side. */
(function () {
  var KEY = 'ahvantir-theme';
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}

  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var dark = stored ? stored === 'dark' : !!(mq && mq.matches);
  document.documentElement.classList.toggle('dark', dark);

  /* Only while no explicit choice exists. Once the reader has used the
     toggle, the system flipping at sunset must not override them. */
  if (!stored && mq && mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      var still = null;
      try { still = localStorage.getItem(KEY); } catch (_) {}
      if (!still) document.documentElement.classList.toggle('dark', e.matches);
    });
  }
})();
