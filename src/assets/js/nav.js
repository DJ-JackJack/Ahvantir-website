/* The navigation drawer and the account menu.

   The site had neither. Twelve links sat in one wrapping flex row, which on a
   phone meant six rows of them -- 355px of navigation above every page before
   any content. There was no way to collapse it because there was nothing to
   collapse into.

   Both controls here follow the same shape: a button whose aria-expanded is
   the single source of truth, Escape closes, focus goes somewhere sensible on
   open and comes back on close. */
(function () {
  'use strict';

  var BP = 1024; // keep in step with --bp-nav in main.css

  function wide() {
    return window.matchMedia('(min-width: ' + (BP + 1) + 'px)').matches;
  }

  /* Elements that can actually be tabbed to right now. Recomputed per open
     rather than cached: the account section grows a Sign out item once the
     player signs in, and a stale list would skip it. */
  function focusables(root) {
    var all = root.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest('[hidden]')) continue;
      if (!el.offsetWidth && !el.offsetHeight) continue;
      out.push(el);
    }
    return out;
  }

  /* ---------------------------------------------------------- the drawer -- */
  (function () {
    var burger = document.getElementById('nav-burger');
    var panel  = document.getElementById('nav-panel');
    var scrim  = document.getElementById('nav-scrim');
    if (!burger || !panel || !scrim) return;

    var open = false;

    function setOpen(next) {
      if (next === open) return;
      open = next;

      panel.classList.toggle('is-open', open);
      scrim.classList.toggle('is-open', open);
      document.body.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');

      if (open) {
        var f = focusables(panel);
        if (f.length) f[0].focus();
      } else {
        burger.focus();
      }
    }

    burger.addEventListener('click', function () { setOpen(!open); });
    scrim.addEventListener('click', function () { setOpen(false); });

    /* Tab must not walk out of the sheet and into the page behind it, which
       is still rendered and still full of links. */
    panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !open) return;
      var f = focusables(panel);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setOpen(false);
    });

    /* Rotating a phone, or dragging a desktop window narrow and back, can
       cross the breakpoint while the sheet is open. Above it the sheet's
       styles no longer apply, so a lingering body scroll lock would be a
       page that cannot be scrolled and nothing on screen to explain why. */
    var mq = window.matchMedia('(min-width: ' + (BP + 1) + 'px)');
    var onChange = function (e) { if (e.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  })();

  /* --------------------------------------------------- the account menu -- */
  (function () {
    var trigger = document.getElementById('account-trigger');
    var menu    = document.getElementById('account-menu');
    if (!trigger || !menu) return;

    var open = false;

    function setOpen(next) {
      /* Below the breakpoint the trigger is display:none and the menu is a
         plain list inside the sheet. Toggling `hidden` there would fight the
         stylesheet, so the control simply does not operate. */
      if (!wide()) return;
      open = next;
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!open);
      if (open) {
        var f = focusables(menu);
        if (f.length) f[0].focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!open) return;
      if (!menu.contains(e.target) && e.target !== trigger) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !open) return;
      setOpen(false);
      trigger.focus();
    });

    /* Leaving the menu by Tab closes it, which is what a reader means by
       tabbing past it. */
    menu.addEventListener('focusout', function (e) {
      if (!open) return;
      if (!e.relatedTarget) return;
      if (!menu.contains(e.relatedTarget) && e.relatedTarget !== trigger) setOpen(false);
    });

    /* Crossing into the sheet's territory with the dropdown open would leave
       `hidden` set on a list the sheet expects to show. */
    var mq = window.matchMedia('(min-width: ' + (BP + 1) + 'px)');
    var onChange = function (e) {
      if (e.matches) { menu.hidden = true; open = false; trigger.setAttribute('aria-expanded', 'false'); }
      else { menu.hidden = false; open = false; trigger.setAttribute('aria-expanded', 'false'); }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
    onChange(mq);
  })();
})();
