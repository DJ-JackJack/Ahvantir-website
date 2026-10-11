/* sky.js — Solara, Nystara and the three moons placed for any hour of any day.
 *
 * Ported from the "Sky over Ahvantir" artifact. The calendar it runs on comes
 * from marducian.js, shared with /almanac/. This file holds the part that is
 * NOT canon: where the bodies are in the sky, which needs disc sizes, orbital
 * inclinations, an axial tilt and an observer's latitude, none of which the
 * lore settles. Those live in MODEL below and are exposed in the page's own
 * "working assumptions" panel, so a reader is never shown an invented number
 * dressed as an established one.
 *
 * What IS canon, from /articles/solara-and-nystara/:
 *   - Solara is the larger disc and warm yellow; Nystara is smaller, blue-white
 *     and hotter.
 *   - They orbit each other, and Nyhexus orbits them both. The pair converges
 *     once a year — that is the Pairing — and how close it gets rides a rhythm
 *     of about eight years. Where they actually are is solved in orbits.js.
 *   - They DO occasionally cross. Krys ruled on 2026-10-10 that the old "neither
 *     star passes in front of the other" could not survive the geometry, since
 *     a planet orbiting the pair must see them edge-on twice a year.
 *   - Every lit object casts two shadows, Solara's warm and soft, Nystara's
 *     sharper and edged toward pale blue. That is the Two Shadows dial.
 *   - The Pale Hour is Nystara up with Solara down. It is named for the quality
 *     of its light, not its length, and runs from minutes to nearly two hours.
 *     Solara alone is just "the warm light" and has no other name.
 *
 * Differences from the artifact, all deliberate:
 *   - No inline script. The site's CSP is script-src 'self'.
 *   - Site fonts and tokens instead of three imported families and a private
 *     palette. The canvas keeps fixed body colours, because a night sky is dark
 *     whichever page theme the reader prefers.
 *   - The canvas is keyboard-operable. Drag-to-turn alone left the whole view
 *     unreachable without a pointer.
 *   - The play loop stops when the page is hidden. requestAnimationFrame does
 *     not fire in a background tab, so a loop left running there resumes by
 *     jumping however many hours the reader was away.
 */
(function () {
  'use strict';

  var page = document.querySelector('.sky');
  if (!page) return;
  var M = window.Marducian;
  if (!M) return;
  var O = window.Orbits;
  if (!O) return;

  var $ = function (id) { return document.getElementById(id); };
  var DEG = Math.PI / 180;
  var YEAR = M.YEAR_LEN, mod = M.mod;

  /* ---------- what this file still owns ----------
   *
   * Nothing about where anything is. Every position, disc size and crossing
   * now comes from orbits.js; this file draws the result. What is left is the
   * names and the colours they are painted in.
   */
  var SUNS = [
    { n: 'Solara',  key: 'solara',  tone: 'Warm, yellow' },
    { n: 'Nystara', key: 'nystara', tone: 'Blue-white' }
  ];
  // The moons' elements live in orbits.js with the suns'. A second copy here
  // is exactly the drift the shared core exists to stop.
  var MOONS = O.MOONS;

  // The observer lives in orbits.js alongside everything else that decides
  // what the sky looks like. This is the same object, not a copy.
  var MODEL = O.OBS;

  // Canvas body colours. Fixed rather than read from tokens: these are the
  // objects' own colours seen against a sky, not UI colour, and must stay
  // legible on both a noon sky and a midnight one.
  var COL = {
    Solara:  [255, 206, 112],
    Nystara: [206, 228, 255],
    Miras:   [150, 214, 238],
    Toris:   [222, 158, 98],
    Keltas:  [214, 214, 224]
  };

  var cssv = function (n) {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  };
  // This site switches theme with a `dark` class on <html>, set by main.js from
  // localStorage before first paint. It does not use data-theme or
  // prefers-color-scheme, so neither is consulted here.
  var isLightTheme = function () {
    return !document.documentElement.classList.contains('dark');
  };

  var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  var smooth = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var rgb = function (c, a) {
    return 'rgba(' + c.map(function (x) { return Math.round(clamp(x, 0, 255)); }).join(',') +
           ',' + (a === undefined ? 1 : a) + ')';
  };
  var lerp3 = function (a, b, t) { return a.map(function (x, i) { return x + (b[i] - x) * t; }); };

  function fmtH(h) {
    if (h == null) return '–';
    h = mod(h, 24);
    var H = Math.floor(h), Mn = Math.round((h - H) * 60);
    if (Mn === 60) { H = (H + 1) % 24; Mn = 0; }
    return String(H).padStart(2, '0') + ':' + String(Mn).padStart(2, '0');
  }
  var CARD = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  var compass = function (az) { return CARD[Math.round(az / 45) % 8]; };
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- where everything is ---------- */

  // Ecliptic longitude/latitude to equatorial, then to the observer's horizon.
  // One copy of the horizon trig, in orbits.js, because the event finder there
  // needs the same answers to say whether a crossing was above the horizon.
  var eclToEq = O.eclToEq, eqToHor = O.eqToHor, altOf = O.altOf, azOf = O.azOf;
  var horToAA = function (h) { return { alt: altOf(h), az: azOf(h) }; };

  // The whole sky for one moment. Y in MC, doy 1..386, h in hours 0..24.
  function skyAt(Y, doy, h) {
    var D = M.absDay(Y, doy);
    var t = D + h / 24;

    // The suns come from the real circumbinary solution in orbits.js, not from
    // a curve fitted to look right. That is what lets them actually meet.
    var S = O.sunsAt(t);
    var lb = S.bary.lon;
    var bary = eclToEq(lb, 0);
    var lst = Math.atan2(bary[1], bary[0]) + (h - 12) * 15 * DEG;

    var out = {
      lst: lst, t: Y + (doy - 1 + h / 24) / YEAR,
      sepDeg: S.sepDeg, touching: S.touching, totalEclipse: S.total,
      front: S.front, bodies: []
    };

    [[S.solara, SUNS[0], S.rhoS], [S.nystara, SUNS[1], S.rhoN]].forEach(function (e) {
      var ecl = e[0], s = e[1];
      var eq = eclToEq(ecl.lon, ecl.lat), hor = eqToHor(eq, lst);
      out.bodies.push({
        kind: 'sun', n: s.n, key: s.key, tone: s.tone,
        r: e[2] / DEG,                       // angular radius, degrees
        eq: eq, hor: hor, alt: altOf(hor), az: azOf(hor)
      });
    });
    out.baryHor = eqToHor(bary, lst);
    O.moonsAt(t, lb).forEach(function (m) {
      var eq = eclToEq(m.lon, m.lat), hor = eqToHor(eq, lst);
      // How far round from the suns the moon is, which is what bows the
      // terminator the right way when it is drawn.
      var cosPsi = eq[0] * bary[0] + eq[1] * bary[1] + eq[2] * bary[2];
      out.bodies.push({ kind: 'moon', n: m.n, key: m.key,
                        r: m.rho / DEG,
                        eq: eq, hor: hor, alt: altOf(hor), az: azOf(hor),
                        cosPsi: cosPsi, illum: (1 - cosPsi) / 2,
                        phase: m.phase });
    });
    return out;
  }

  /* Rise, set, Pale Hour and warm light for a whole day, by sampling every two
     minutes and interpolating the horizon crossings. Sampling rather than
     solving because the two suns and three tilted moons have no tidy inverse,
     and two minutes is finer than the page can display. */
  function dayTable(Y, doy) {
    var step = 1 / 30, n = Math.round(24 / step), rows = [];
    for (var i = 0; i <= n; i++) {
      var h = i * step, s = skyAt(Y, doy, h);
      rows.push({ h: h, alts: s.bodies.map(function (b) { return b.alt + (b.kind === 'sun' ? b.r : 0); }) });
    }
    var events = SUNS.concat(MOONS).map(function () { return { rise: [], set: [] }; });
    for (var j = 1; j < rows.length; j++) {
      /* jshint loopfunc:true */
      (function (row, prev) {
        row.alts.forEach(function (a, k) {
          var p = prev.alts[k];
          if (p < 0 && a >= 0) events[k].rise.push(prev.h + step * (-p) / (a - p));
          if (p >= 0 && a < 0) events[k].set.push(prev.h + step * p / (p - a));
        });
      })(rows[j], rows[j - 1]);
    }
    /* A span's true edge is one of the two suns crossing the horizon, and those
       crossings are already solved exactly above. Measuring a span from the
       samples inside it loses up to one step at each end, which turned an
       eight-minute warm light into six and made the three-minute Pale Hour
       either side of a Pairing vanish altogether. So detect the span by
       sampling, then snap each edge onto the crossing that caused it. */
    var sunEvents = events.slice(0, 2).reduce(function (a, e) {
      return a.concat(e.rise, e.set);
    }, []).sort(function (x, y) { return x - y; });
    var snap = function (h) {
      var best = h, bestD = step * 1.01;
      sunEvents.forEach(function (t) {
        var d = Math.abs(t - h);
        if (d < bestD) { bestD = d; best = t; }
      });
      return best;
    };
    var spans = function (test) {
      var out = [], cur = null;
      rows.forEach(function (r) {
        if (test(r.alts)) { if (!cur) cur = { s: r.h, e: r.h }; cur.e = r.h; }
        else if (cur) { out.push(cur); cur = null; }
      });
      if (cur) out.push(cur);
      return out.map(function (sp) {
        // Only the ends touching a crossing move; a span running to midnight
        // keeps its sampled edge, because no crossing explains it.
        return { s: snap(sp.s), e: snap(sp.e) };
      });
    };
    return {
      events: events,
      up0: rows[0].alts.map(function (a) { return a >= 0; }),
      // Pale Hour: Nystara up, Solara down. Warm light: the reverse.
      pale: spans(function (a) { return a[1] >= 0 && a[0] < 0; }),
      warm: spans(function (a) { return a[0] >= 0 && a[1] < 0; })
    };
  }

  /* ---------- state ---------- */

  var st = {
    Y: 439, doy: M.doyOf(8, 35), h: 18.5,
    view: 'pan', facing: 90, domeRot: 0, pitch: 0,
    fov: 180, fovAuto: true,   // fovAuto until the reader zooms; then theirs
    big: true, playing: false, speed: '60'
  };
  try {
    var saved = JSON.parse(localStorage.getItem('ahv-sky') || 'null');
    if (saved) {
      ['Y', 'doy', 'h', 'view', 'facing', 'domeRot', 'big', 'fov', 'fovAuto', 'pitch'].forEach(function (k) {
        if (saved[k] !== undefined) st[k] = saved[k];
      });
      if (saved.model) {
        ['lat', 'tilt'].forEach(function (k) {
          if (isFinite(saved.model[k])) MODEL[k] = saved.model[k];
        });
        if (isFinite(saved.model.beta)) O.setBeta(saved.model.beta);
      }
    }
  } catch (e) { /* private window, blocked storage — defaults are fine */ }
  function save() {
    try {
      localStorage.setItem('ahv-sky', JSON.stringify({
        Y: st.Y, doy: st.doy, h: st.h, view: st.view, facing: st.facing,
        domeRot: st.domeRot, big: st.big, fov: st.fov, fovAuto: st.fovAuto, pitch: st.pitch,
        model: { lat: MODEL.lat, tilt: MODEL.tilt, beta: O.EL.BETA / DEG }
      }));
    } catch (e) {}
  }

  // A deep link beats any stored state: ?y=439&d=35&h=18.5 drops a reader into
  // one specific sky, which is the point of handing the link to a player.
  (function () {
    var q = new URLSearchParams(window.location.search);
    var y = parseInt(q.get('y'), 10), d = parseInt(q.get('d'), 10), h = parseFloat(q.get('h'));
    if (isFinite(y)) st.Y = clamp(y, 0, 9999);
    if (isFinite(d)) st.doy = clamp(d, 1, YEAR);
    if (isFinite(h)) st.h = mod(h, 24);
  })();

  /* ---------- the starfield ----------
   *
   * Two populations, on two seeds, and the separation is the point.
   *
   *   BRIGHT  a few score stars that carry colour, a glow and, for the fiercest
   *           of them, a cross of light. These are the ones a constellation
   *           would ever be drawn from, so they have their own seed and must
   *           stay put: adding to the faint layer must never move one.
   *   FAINT   many thousands of anonymous points for depth. Nothing will ever
   *           reference them by name, so this layer can be made denser or
   *           thinner whenever we like without breaking anything.
   *
   * Both are seeded, so it is the same sky on every visit and for every reader.
   */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Star colours, warmest to coolest. Real stars run this gamut and a sky drawn
  // in one shade of white looks printed rather than seen.
  var TINTS = [
    [255, 214, 170],   // amber
    [255, 236, 206],   // pale gold
    [248, 246, 240],   // white
    [236, 240, 252],   // the common case, faintly blue
    [214, 228, 255],   // blue-white
    [196, 214, 255]    // hot blue
  ];
  function pickTint(r) {
    // Weighted toward the middle, with a few of each extreme.
    var i = Math.floor(2 + (r * r * 6 - 2));
    return clamp(i, 0, TINTS.length - 1);
  }

  // The river: a tilted great circle, used by both the dense band of stars and
  // the diffuse glow drawn under them.
  var RIVER = (function () {
    var pole = [0.32, -0.55, 0.77], pn = Math.hypot(pole[0], pole[1], pole[2]);
    pole = pole.map(function (x) { return x / pn; });
    var u1 = [pole[1], -pole[0], 0], u1n = Math.hypot(u1[0], u1[1], u1[2]);
    u1 = u1.map(function (x) { return x / u1n; });
    var u2 = [pole[1] * u1[2] - pole[2] * u1[1],
              pole[2] * u1[0] - pole[0] * u1[2],
              pole[0] * u1[1] - pole[1] * u1[0]];
    return { pole: pole, u1: u1, u2: u2 };
  })();
  function onRiver(a, off) {
    var v = [0, 1, 2].map(function (k) {
      return Math.cos(a) * RIVER.u1[k] + Math.sin(a) * RIVER.u2[k] + off * RIVER.pole[k];
    });
    var n = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / n, v[1] / n, v[2] / n];
  }

  /* The bright layer is no longer generated here. It is frozen in
     stars-bright.js, because constellations point at these stars by id and a
     star that moves takes its figure with it. Positions come in as right
     ascension and declination, which is what anyone drawing a figure wants to
     read; the vector is what the renderer wants, so it is built once. */
  var BRIGHT = (window.BrightStars || []).map(function (s) {
    var ra = s.ra * DEG, dec = s.dec * DEG, cd = Math.cos(dec);
    return {
      id: s.id, b: s.b, t: s.t, c: s.c,
      v: [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)]
    };
  });
  var BY_ID = {};
  BRIGHT.forEach(function (s) { BY_ID[s.id] = s; });
  var FIGURES = window.Constellations || [];

  var FAINT = (function () {
    var R = rng(90210), out = [];
    // The general field.
    for (var i = 0; i < 15000; i++) {
      var z = R() * 2 - 1, th = R() * 2 * Math.PI, rr = Math.sqrt(1 - z * z);
      out.push({ v: [rr * Math.cos(th), rr * Math.sin(th), z],
                 b: Math.pow(R(), 2.4) * 0.5, t: R(), c: pickTint(R()) });
    }
    // The river, several times denser than the field it crosses.
    for (var j = 0; j < 9000; j++) {
      var a = R() * 2 * Math.PI, off = (R() + R() + R() - 1.5) * 0.17;
      out.push({ v: onRiver(a, off), b: Math.pow(R(), 3.0) * 0.42, t: R(), c: pickTint(R()) });
    }
    return out;
  })();

  /* ---------- canvas ---------- */

  var cv = $('sky-canvas'), ctx = cv.getContext('2d');
  var box = $('sky-box');
  var W = 0, H = 0, DPR = 1;

  function resize() {
    var r = box.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(r.width * DPR); H = Math.round(r.height * DPR);
    cv.width = W; cv.height = H;
    // Only pick a field of view while the reader has not chosen one.
    if (st.view === 'pan' && st.fovAuto) st.fov = r.width < 700 ? 130 : 180;
    render();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(box);
  else window.addEventListener('resize', resize);

  var P = null;
  function setupProj() {
    if (st.view === 'pan') {
      var sc = W / st.fov, hy = H * 0.8;
      P = {
        sc: sc, hy: hy,
        f: function (alt, az) {
          var d = mod(az - st.facing + 180, 360) - 180;
          // st.pitch lifts the frame: at 0 the horizon sits where it always
          // did, and nothing about the wide view changes.
          return { x: W / 2 + d * sc, y: hy - (alt - st.pitch) * sc,
                   ok: Math.abs(d) < st.fov / 2 + 8 };
        }
      };
    } else {
      var Rr = Math.min(W, H) * 0.44, cx = W / 2, cy = H / 2;
      P = {
        sc: Rr / 90, cx: cx, cy: cy, R: Rr,
        f: function (alt, az) {
          var r = (90 - alt) / 90 * Rr, a = (az - st.domeRot) * DEG;
          return { x: cx - Math.sin(a) * r, y: cy - Math.cos(a) * r, ok: alt > -12 };
        }
      };
    }
  }

  /* How bright and what colour the sky is, given where the two suns are. Each
     sun contributes daylight as it climbs and a twilight wash while it is just
     below the horizon, and the two add, which is why twin daylight reads
     cleaner and cooler than either sun alone. */
  function skyLight(sky) {
    var S = sky.bodies[0], N = sky.bodies[1];
    var dS = smooth(-4, 8, S.alt), dN = smooth(-4, 8, N.alt);
    var tS = smooth(-18, -1, S.alt) * (1 - dS), tN = smooth(-18, -1, N.alt) * (1 - dN);
    var add = function (base, parts) {
      return parts.reduce(function (acc, p) {
        return acc.map(function (x, i) { return x + p[0] * p[1][i]; });
      }, base);
    };
    var zen = add([5, 7, 14], [[dS, [38, 78, 130]], [dN, [22, 52, 95]], [tS, [12, 14, 30]], [tN, [8, 16, 34]]]);
    var hor = add([12, 16, 30], [[dS, [135, 125, 100]], [dN, [80, 100, 115]], [tS * 0.6, [40, 28, 26]], [tN * 0.6, [20, 34, 52]]]);
    return {
      dS: dS, dN: dN, tS: tS, tN: tN, zen: zen, hor: hor,
      day: Math.min(1, dS + dN * 0.8),
      starA: clamp(1 - (dS + dN) * 1.6 - (tS + tN) * 0.55, 0, 1)
    };
  }
  function lightState(S, N) {
    var sUp = S.alt + S.r > 0, nUp = N.alt + N.r > 0;
    if (sUp && nUp) return 'Twin daylight';
    if (nUp) return 'Pale Hour';
    if (sUp) return 'Warm light';
    var m = Math.max(S.alt, N.alt);
    if (m > -6) return 'Twilight';
    if (m > -14) return 'Dusk and dark';
    return 'Night';
  }

  function drawSun(b) {
    var p = P.f(b.alt, b.az);
    if (!p.ok) return null;
    // A floor only so a body is never invisible. Kept small, because at true
    // size a generous floor flattens every disc to the same dot and the
    // proportions — the whole point of looking — go with it.
    var rpx = Math.max(0.6 * DPR, b.r * (st.big ? 3 : 1) * P.sc);
    var c = COL[b.n];
    var glowR = rpx * (b.n === 'Nystara' ? 14 : 11);
    var g = ctx.createRadialGradient(p.x, p.y, rpx * 0.6, p.x, p.y, glowR);
    g.addColorStop(0, rgb(c, 0.75)); g.addColorStop(0.25, rgb(c, 0.18)); g.addColorStop(1, rgb(c, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = rgb(b.n === 'Nystara' ? [240, 248, 255] : [255, 236, 190]);
    ctx.beginPath(); ctx.arc(p.x, p.y, rpx, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = rgb(c, 0.9); ctx.lineWidth = 1.2 * DPR;
    ctx.beginPath(); ctx.arc(p.x, p.y, rpx, 0, 2 * Math.PI); ctx.stroke();
    return { x: p.x, y: p.y, r: rpx };
  }

  function drawMoon(b, sky, L) {
    var p = P.f(b.alt, b.az);
    if (!p.ok) return null;
    var rpx = Math.max(0.6 * DPR, b.r * (st.big ? 3 : 1) * P.sc);
    // Point the terminator at the suns: nudge the moon's direction a little
    // toward the pair's centre and see which way that moves on screen.
    var s = sky.baryHor, m = b.hor;
    var q = [0, 1, 2].map(function (i) { return m[i] + 0.04 * (s[i] - m[i]); });
    var qn = Math.hypot(q[0], q[1], q[2]);
    var qa = horToAA(q.map(function (x) { return x / qn; })), pq = P.f(qa.alt, qa.az);
    var ang = Math.atan2(pq.y - p.y, pq.x - p.x);
    if (!isFinite(ang)) ang = 0;
    var cosPsi = b.cosPsi, rx = rpx * Math.abs(cosPsi), gib = cosPsi < 0;
    var a = 0.45 + 0.55 * (1 - L.day);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
    // The dark limb is opaque, so a moon hides the stars behind it.
    ctx.fillStyle = rgb(lerp3(L.zen, L.hor, 0.4).map(function (x) { return x * 0.55; }), 1);
    ctx.beginPath(); ctx.arc(0, 0, rpx, 0, 2 * Math.PI); ctx.fill();
    if (b.illum > 0.5 && L.day < 0.5) {
      var g = ctx.createRadialGradient(0, 0, rpx, 0, 0, rpx * 5);
      g.addColorStop(0, rgb(COL[b.n], 0.22 * b.illum * (1 - L.day)));
      g.addColorStop(1, rgb(COL[b.n], 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rpx * 5, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.globalAlpha = a; ctx.fillStyle = rgb(COL[b.n]);
    ctx.beginPath();
    ctx.arc(0, 0, rpx, -Math.PI / 2, Math.PI / 2, false);
    if (gib) ctx.ellipse(0, 0, Math.max(rx, 0.01), rpx, 0, Math.PI / 2, 3 * Math.PI / 2, false);
    else ctx.ellipse(0, 0, Math.max(rx, 0.01), rpx, 0, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
    return { x: p.x, y: p.y, r: rpx };
  }

  // A fixed, unremarkable skyline, so the horizon is not a straight rule.
  function hills(az) {
    var a = az * DEG;
    return 1.3 + 0.9 * Math.sin(3 * a + 1) + 0.6 * Math.sin(7 * a + 2.3) +
           0.35 * Math.sin(13 * a + 0.7) + 0.18 * Math.sin(31 * a + 4) +
           1.4 * Math.pow(Math.max(0, Math.sin(a - 0.6)), 6) * 2;
  }

  /* Names, kept apart.
   *
   * Every label used to sit at a fixed offset up and to the right of its disc,
   * which collided the moment two bodies came close — and that is precisely
   * when a reader needs to know which is which: a moon crossing a sun, or
   * Solara and Nystara in the year either side of a Pairing, when they are
   * about a degree apart and the two names land on top of each other.
   *
   * So: lay the boxes out, push any that collide clear, and draw a leader line
   * for the ones that had to move so a displaced name still points at its own
   * disc. There are never more than five, so the quadratic pass is free.
   */
  function drawLabels(placed) {
    var LH = 15 * DPR, PAD = 3 * DPR, GAP = 6 * DPR;
    ctx.font = (13 * DPR) + 'px ' + (cssv('--font-display') || 'serif');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    var labels = placed.filter(function (e) {
      var b = e[0];
      if (b.alt < -1) return false;
      return !(st.view === 'dome' && b.alt < 0);
    }).map(function (e) {
      var b = e[0], r = e[1], w = ctx.measureText(b.n).width;
      // Flip to the left of the disc rather than run off the right edge.
      var flip = r.x + r.r + GAP + w > W - PAD;
      return {
        b: b, w: w, flip: flip,
        home: r.y - r.r - PAD,
        x: flip ? r.x - r.r - GAP - w : r.x + r.r + GAP,
        y: r.y - r.r - PAD,
        ax: r.x, ay: r.y, ar: r.r
      };
    });

    // Suns settle first and keep their natural spot, so when a sun and a moon
    // compete it is the moon that steps aside.
    labels.sort(function (p, q) {
      if ((p.b.kind === 'sun') !== (q.b.kind === 'sun')) return p.b.kind === 'sun' ? -1 : 1;
      return p.y - q.y;
    });

    var done = [];
    var clashes = function (L) {
      return done.some(function (o) {
        return L.x < o.x + o.w + PAD && o.x < L.x + L.w + PAD &&
               L.y - LH < o.y + PAD && o.y - LH < L.y + PAD;
      });
    };
    labels.forEach(function (L) {
      var n = 0;
      while (clashes(L) && n++ < 10) L.y += LH;      // step down out of the way
      if (clashes(L)) {                               // no room below, try above
        L.y = L.home; n = 0;
        while (clashes(L) && n++ < 10) L.y -= LH;
      }
      L.y = clamp(L.y, LH, H - PAD);
      L.moved = Math.abs(L.y - L.home) > LH * 0.5;
      done.push(L);
    });

    done.forEach(function (L) {
      if (L.moved) {
        // From the label's inner edge to the rim of its own disc.
        ctx.strokeStyle = rgb(COL[L.b.n], 0.55);
        ctx.lineWidth = 1 * DPR;
        ctx.beginPath();
        ctx.moveTo(L.flip ? L.x + L.w + PAD : L.x - PAD, L.y - LH * 0.3);
        ctx.lineTo(L.ax + (L.flip ? L.ar : -L.ar), L.ay);
        ctx.stroke();
      }
      ctx.fillStyle = rgb(COL[L.b.n], 0.95);
      ctx.shadowColor = 'rgba(0,0,0,.7)';
      ctx.shadowBlur = 4 * DPR;
      ctx.fillText(L.b.n, L.x, L.y);
      ctx.shadowBlur = 0;
    });
  }

  /* The river, as light rather than as dots. A galaxy is mostly unresolved
     glow; drawing it only as points makes it read as a smear of dust. Soft
     blobs stepped along the great circle, with the dense star band over them. */
  function drawRiverGlow(sky, L) {
    var a = L.starA * 0.5;
    if (a < 0.03) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < 96; k++) {
      var ang = k / 96 * 2 * Math.PI;
      var h = eqToHor(onRiver(ang, 0), sky.lst);
      if (h[2] < -0.12) continue;
      var alt = altOf(h), p = P.f(alt, azOf(h));
      if (!p.ok) continue;
      var rad = Math.max(24 * DPR, 7 * P.sc);
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      var fade = a * smooth(-4, 10, alt);
      g.addColorStop(0, 'rgba(150,160,210,' + (fade * 0.16).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(150,160,210,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
  }

  /* Fifteen thousand points cannot each have their own fillStyle; that is tens
     of thousands of state changes a frame. Instead they are sorted into a few
     buckets of colour and brightness, and each bucket is filled once. */
  var FAINT_STEPS = 5;
  function drawFaint(sky, L) {
    var buckets = [], i, n = TINTS.length * FAINT_STEPS;
    for (i = 0; i < n; i++) buckets.push(null);
    for (i = 0; i < FAINT.length; i++) {
      var s = FAINT[i], h = eqToHor(s.v, sky.lst);
      if (h[2] < -0.02) continue;
      var alt = altOf(h), p = P.f(alt, azOf(h));
      if (!p.ok) continue;
      var tw = 0.78 + 0.22 * Math.sin(s.t * 40 + st.h * 9);
      var a = L.starA * (0.22 + 0.78 * s.b) * tw * smooth(-2, 6, alt);
      if (a < 0.015) continue;
      var lvl = clamp(Math.floor(a * FAINT_STEPS), 0, FAINT_STEPS - 1);
      var bi = s.c * FAINT_STEPS + lvl;
      var path = buckets[bi] || (buckets[bi] = new Path2D());
      var sz = (0.55 + s.b * 1.1) * DPR;
      path.rect(p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
    for (i = 0; i < n; i++) {
      if (!buckets[i]) continue;
      var c = TINTS[Math.floor(i / FAINT_STEPS)];
      var av = ((i % FAINT_STEPS) + 0.5) / FAINT_STEPS;
      ctx.fillStyle = rgb(c, av.toFixed(3));
      ctx.fill(buckets[i]);
    }
  }

  /* The figures.
   *
   * Drawn under the stars so a line never crosses a star's face, and kept
   * deliberately quiet: an aura along the shape and a thin line, enough that a
   * visitor notices something is there without the sky turning into a diagram.
   * The hit region is built here too, so what you can click is exactly what you
   * can see.
   */
  var figureHits = [], figuresUp = [];
  function drawFigures(sky, L) {
    figureHits = [];
    figuresUp = [];
    if (!FIGURES.length) return;

    for (var f = 0; f < FIGURES.length; f++) {
      var fig = FIGURES[f];
      var pts = {}, up = true, framed = true;
      var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;

      for (var i = 0; i < fig.stars.length; i++) {
        var s = BY_ID[fig.stars[i]];
        if (!s) continue;
        var h = eqToHor(s.v, sky.lst);
        var alt = altOf(h), p = P.f(alt, azOf(h));
        /* Two different questions, and conflating them was wrong. Whether the
           figure is UP is about the horizon and has nothing to do with which
           way the reader happens to be facing — it belongs in the list either
           way. Whether it can be DRAWN is about the frame. A figure is only
           drawn whole: half a spear is worse than none, and a partial hit
           region misrepresents what is being clicked. */
        if (h[2] < -0.02) up = false;
        if (!p.ok) framed = false;
        pts[s.id] = p;
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      if (up) figuresUp.push(fig);
      if (!up || !framed || L.starA < 0.05) continue;

      var a = L.starA * (fig._hot ? 0.95 : 0.55);
      var path = new Path2D();
      for (var j = 0; j < fig.lines.length; j++) {
        var A = pts[fig.lines[j][0]], B = pts[fig.lines[j][1]];
        if (!A || !B) continue;
        path.moveTo(A.x, A.y); path.lineTo(B.x, B.y);
      }

      // The aura: the same path, very wide and very soft, laid down first.
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(150,178,228,' + (a * 0.055).toFixed(3) + ')';
      ctx.lineWidth = 16 * DPR;
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(168,196,240,' + (a * 0.09).toFixed(3) + ')';
      ctx.lineWidth = 7 * DPR;
      ctx.stroke(path);
      // The line itself.
      ctx.strokeStyle = 'rgba(198,218,255,' + (a * 0.5).toFixed(3) + ')';
      ctx.lineWidth = (fig._hot ? 1.6 : 1) * DPR;
      ctx.stroke(path);
      ctx.restore();

      if (fig._hot) {
        ctx.font = (13 * DPR) + 'px ' + (cssv('--font-display') || 'serif');
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(214,230,255,' + Math.min(1, a).toFixed(3) + ')';
        ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 5 * DPR;
        ctx.fillText(fig.name, (minX + maxX) / 2, minY - 10 * DPR);
        ctx.shadowBlur = 0;
      }

      figureHits.push({ fig: fig, path: path, box: [minX, minY, maxX, maxY] });
    }
  }

  // Is the pointer on a figure? Generous, because a one-pixel line is not a
  // target: the test is against a fat stroke of the same path.
  function figureAt(x, y) {
    for (var i = 0; i < figureHits.length; i++) {
      var hit = figureHits[i], b = hit.box, pad = 14 * DPR;
      if (x < b[0] - pad || x > b[2] + pad || y < b[1] - pad || y > b[3] + pad) continue;
      ctx.save();
      ctx.lineWidth = 18 * DPR;
      var on = ctx.isPointInStroke(hit.path, x, y);
      ctx.restore();
      if (on) return hit.fig;
    }
    return null;
  }

  // Suns and moons are clickable too. Their drawn discs are recorded each
  // frame in `placed`, so the target is exactly the thing on screen.
  var ARTICLES = {
    Solara: '/articles/solara-and-nystara/',
    Nystara: '/articles/solara-and-nystara/',
    // The moons have no articles of their own yet; the calendar is where they
    // are described. Point them somewhere true rather than somewhere broken.
    Miras: '/articles/marducian-calendar/',
    Toris: '/articles/marducian-calendar/',
    Keltas: '/articles/marducian-calendar/'
  };
  var bodyHits = [];
  function bodyAt(x, y) {
    for (var i = 0; i < bodyHits.length; i++) {
      var h = bodyHits[i], r = Math.max(h.r, 9 * DPR);
      if ((x - h.x) * (x - h.x) + (y - h.y) * (y - h.y) <= r * r) return h;
    }
    return null;
  }

  /* A four-armed glint: two tapered spindles crossed. Drawn as a path rather
     than as bars so the arms come to a point, which is what makes the shape
     read as a star instead of a plus sign. */
  function glint(x, y, len, w, rot) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -len); ctx.lineTo(w, 0); ctx.lineTo(0, len); ctx.lineTo(-w, 0);
    ctx.closePath();
    ctx.moveTo(-len, 0); ctx.lineTo(0, -w); ctx.lineTo(len, 0); ctx.lineTo(0, w);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* The bright layer, drawn one at a time because each is meant to be noticed.
   *
   * These used to carry a solid core up to six pixels across with a wide halo,
   * which at any normal field of view is indistinguishable from a small moon —
   * Keltas is about eight. The fix is the true difference between the two: a
   * star is a point source and has no disc to resolve, while a moon is an
   * actual face in the sky. So the core here is a dot that barely grows with
   * brightness, and everything else a bright star has — long arms, a tight
   * halo, a hard shimmer — is light spilling off a point. Moons keep their
   * disc, their phase and their broad soft glow, and never twinkle.
   *
   * It falls out of this that zooming in grows the moons and leaves the stars
   * alone, which is also what a real sky does.
   */
  function drawBright(sky, L) {
    for (var i = 0; i < BRIGHT.length; i++) {
      var s = BRIGHT[i], h = eqToHor(s.v, sky.lst);
      if (h[2] < -0.02) continue;
      var alt = altOf(h), p = P.f(alt, azOf(h));
      if (!p.ok) continue;

      // Scintillation, and much harder than the faint layer's. A moon sitting
      // beside one of these is conspicuously steady.
      var tw = 0.62 + 0.38 * Math.sin(s.t * 40 + st.h * 23);
      var a = L.starA * s.b * tw * smooth(-2, 7, alt);
      if (a < 0.02) continue;
      var c = TINTS[s.c];

      // A dot. Brightness is in the arms, not in the area.
      var core = (0.45 + s.b * 0.8) * DPR;
      var arm = (2.5 + s.b * s.b * 16) * DPR * (0.85 + 0.15 * tw);

      // Tight halo: a star's bloom clings to the point. A moon's is broad.
      var halo = core * 3.5;
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, halo);
      g.addColorStop(0, rgb(c, (a * 0.55).toFixed(3)));
      g.addColorStop(1, rgb(c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(p.x - halo, p.y - halo, halo * 2, halo * 2);

      // Every star in this layer gets arms; that is the mark of the layer.
      ctx.fillStyle = rgb(c, (a * 0.5).toFixed(3));
      glint(p.x, p.y, arm, Math.max(0.35 * DPR, core * 0.5), 0);
      // The fiercest get a second, shorter pair on the diagonal.
      if (s.b > 0.86) {
        ctx.fillStyle = rgb(c, (a * 0.22).toFixed(3));
        glint(p.x, p.y, arm * 0.5, Math.max(0.3 * DPR, core * 0.4), Math.PI / 4);
      }

      ctx.fillStyle = rgb(c, Math.min(1, a * 1.4).toFixed(3));
      ctx.beginPath();
      ctx.arc(p.x, p.y, core, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  function render() {
    if (!W) return;
    setupProj();
    var sky = skyAt(st.Y, st.doy, st.h);
    var L = skyLight(sky);
    var S = sky.bodies[0], N = sky.bodies[1];
    ctx.clearRect(0, 0, W, H);

    if (st.view === 'pan') {
      /* Keyed to altitude rather than to a fixed fraction of the canvas, so it
         stays right when the view tilts up. Altitude at any row is
         pitch + (hy - y)/sc; the colour runs from the horizon shade at 0 to the
         zenith shade at 90, and the whole canvas is covered because the
         horizon may now be well below the bottom edge. */
      var g = ctx.createLinearGradient(0, 0, 0, H);
      for (var gi = 0; gi <= 8; gi++) {
        var gy = gi / 8;
        var galt = st.pitch + (P.hy - gy * H) / P.sc;
        var f = clamp(galt / 90, 0, 1);
        g.addColorStop(gy, rgb(lerp3(L.hor, L.zen, f)));
      }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.arc(P.cx, P.cy, P.R, 0, 2 * Math.PI); ctx.clip();
      var gd = ctx.createRadialGradient(P.cx, P.cy, 0, P.cx, P.cy, P.R);
      gd.addColorStop(0, rgb(L.zen));
      gd.addColorStop(0.7, rgb(lerp3(L.zen, L.hor, 0.5)));
      gd.addColorStop(1, rgb(L.hor));
      ctx.fillStyle = gd; ctx.fillRect(0, 0, W, H);
    }

    // A wash of colour around each sun, warm for Solara and blue for Nystara.
    [[S, L.tS, L.dS, [255, 140, 60]], [N, L.tN, L.dN, [120, 180, 255]]].forEach(function (e) {
      var b = e[0], tw = e[1], dy = e[2], c = e[3];
      var strength = tw * 0.65 + (b.alt < 12 && b.alt > -2 ? dy * 0.35 : 0);
      if (strength < 0.01) return;
      var p = P.f(Math.max(b.alt, -4), b.az), rad = 70 * P.sc;
      var cy = st.view === 'pan' ? P.hy : p.y;
      var g2 = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, rad);
      g2.addColorStop(0, rgb(c, 0.55 * strength)); g2.addColorStop(1, rgb(c, 0));
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    });

    if (L.starA > 0.01) {
      drawRiverGlow(sky, L);
      drawFaint(sky, L);
      drawFigures(sky, L);
      drawBright(sky, L);
    } else {
      // Daylight: nothing is drawn, but the figures are still up there and
      // still belong in the list.
      drawFigures(sky, L);
    }

    var placed = [];
    bodyHits = [];
    sky.bodies.filter(function (b) { return b.kind === 'sun'; })
      .forEach(function (b) { var r = drawSun(b); if (r) placed.push([b, r]); });
    sky.bodies.filter(function (b) { return b.kind === 'moon'; })
      .sort(function (a, b) { return b.r - a.r; })
      .forEach(function (b) { var r = drawMoon(b, sky, L); if (r) placed.push([b, r]); });
    placed.forEach(function (e) {
      if (e[0].alt < -0.5) return;
      bodyHits.push({ n: e[0].n, x: e[1].x, y: e[1].y, r: e[1].r, href: ARTICLES[e[0].n] });
    });

    if (st.view === 'pan') {
      var light = Math.min(1, L.day + (L.tS + L.tN) * 0.25);
      ctx.fillStyle = rgb(lerp3([8, 9, 13], [44, 46, 50], light));
      // Through the projection, so the skyline drops away when you look up.
      ctx.beginPath(); ctx.moveTo(0, H);
      for (var x = 0; x <= W; x += 3 * DPR) {
        var az = st.facing + (x - W / 2) / P.sc;
        ctx.lineTo(x, P.f(hills(mod(az, 360)), az).y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.font = (11 * DPR) + 'px ' + (cssv('--font-mono') || 'monospace');
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(236,230,214,.75)';
      for (var az2 = 0; az2 < 360; az2 += 45) {
        var pc = P.f(0, az2);
        if (!pc.ok) continue;
        ctx.fillText(compass(az2), pc.x, H - 12 * DPR);
        ctx.fillRect(pc.x - 0.5 * DPR, pc.y + 6 * DPR, 1 * DPR, 6 * DPR);
      }
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(236,230,214,.35)';
      [30, 60].forEach(function (a) {
        var y = P.f(a, st.facing).y;
        if (y > 20 * DPR) { ctx.fillRect(0, y, 10 * DPR, 1 * DPR); ctx.fillText(a + '°', 14 * DPR, y + 4 * DPR); }
      });
    } else {
      ctx.restore();
      ctx.strokeStyle = 'rgba(236,230,214,.45)'; ctx.lineWidth = 1.2 * DPR;
      ctx.beginPath(); ctx.arc(P.cx, P.cy, P.R, 0, 2 * Math.PI); ctx.stroke();
      ctx.font = (12 * DPR) + 'px ' + (cssv('--font-mono') || 'monospace');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(236,230,214,.8)';
      for (var az3 = 0; az3 < 360; az3 += 45) {
        var pd = P.f(-9, az3);
        ctx.fillText(compass(az3), pd.x, pd.y);
      }
      ctx.textBaseline = 'alphabetic';
    }

    drawLabels(placed);

    updateText(sky, L);
  }

  /* ---------- the day's ephemeris ---------- */

  var table = null, tableKey = '';
  function ensureTable() {
    var k = st.Y + '|' + st.doy + '|' + MODEL.lat + '|' + MODEL.tilt + '|' + O.EL.BETA;
    if (k !== tableKey) { table = dayTable(st.Y, st.doy); tableKey = k; drawLightBand(); renderEph(); }
  }

  // The strip behind the hour slider, coloured by what the sky looks like at
  // each ten-minute step. It makes the Pale Hour visible as a band rather than
  // a number.
  function drawLightBand() {
    var stops = [];
    for (var i = 0; i <= 144; i++) {
      var L = skyLight(skyAt(st.Y, st.doy, i / 6));
      stops.push(rgb(lerp3(L.zen, L.hor, 0.45)) + ' ' + (i / 144 * 100).toFixed(2) + '%');
    }
    $('sky-band').style.background = 'linear-gradient(90deg, ' + stops.join(',') + ')';
  }

  function renderEph() {
    var D = M.absDay(st.Y, st.doy);
    var rows = SUNS.concat(MOONS);
    $('sky-eph').innerHTML = rows.map(function (body, k) {
      var ev = table.events[k];
      var rise = ev.rise.length ? ev.rise.map(fmtH).join(', ') : (table.up0[k] ? 'up all day' : 'none');
      var set = ev.set.length ? ev.set.map(fmtH).join(', ') : (table.up0[k] ? '–' : 'none');
      var moon = k >= 2 ? MOONS[k - 2] : null;
      var ph = moon ? M.PH[M.phaseOf(moon, D).i] : body.tone;
      var tok = moon ? '--moon-' + moon.key : '--' + body.key;
      return '<tr><td><span class="sky-nm"><i class="sky-sw" style="background:var(' + tok + ')"></i>' +
        esc(body.n) + '</span></td>' +
        '<td class="sky-num"><button type="button" class="sky-aim" id="sky-now' + k + '" ' +
          'data-i="' + k + '" title="Point the view at ' + esc(body.n) + '"></button></td>' +
        '<td class="sky-num">' + esc(rise) + '</td>' +
        '<td class="sky-num">' + esc(set) + '</td>' +
        '<td>' + esc(ph) + (moon ? ' <span class="sky-lit" id="sky-ill' + k + '"></span>' : '') + '</td></tr>';
    }).join('');

    var pills = [];
    table.pale.forEach(function (s) {
      if (s.e - s.s >= 1 / 60) pills.push('<span class="sky-pill sky-pill--pale">Pale Hour ' +
        fmtH(s.s) + '–' + fmtH(s.e) + ' · ' + Math.round((s.e - s.s) * 60) + ' min</span>');
    });
    table.warm.forEach(function (s) {
      if (s.e - s.s >= 1 / 60) pills.push('<span class="sky-pill sky-pill--warm">Warm light ' +
        fmtH(s.s) + '–' + fmtH(s.e) + ' · ' + Math.round((s.e - s.s) * 60) + ' min</span>');
    });
    pills.push('<span class="sky-pill">Suns ' + skyAt(st.Y, st.doy, 12).sepDeg.toFixed(1) + '° apart</span>');
    var ss = table.events[0].set[0], ns = table.events[1].set[0];
    if (ss != null && ns != null) {
      pills.push('<span class="sky-pill">' + (ss < ns ? 'Nystara closes the day' : 'Solara closes the day') + '</span>');
    }
    $('sky-pills').innerHTML = pills.join('');
    $('sky-eph-head').textContent = M.fmtLong(st.Y, st.doy);
  }

  function updateText(sky, L) {
    ensureTable();
    var S = sky.bodies[0], N = sky.bodies[1];
    $('sky-hud-date').textContent = M.fmtLong(st.Y, st.doy) + ' · ' + fmtH(st.h);

    var up = sky.bodies.filter(function (b) { return b.kind === 'moon' && b.alt > 0; }).length;
    var fulls = sky.bodies.filter(function (b) { return b.kind === 'moon' && b.phase === 4; }).length;
    var extra = up ? ' · ' + up + ' moon' + (up > 1 ? 's' : '') + ' up' : '';
    if (fulls === 3) extra += ' · three full moons';
    // The rarest thing this sky can show, so it leads the rest.
    if (sky.touching) {
      var behind = sky.front === 'Solara' ? 'Nystara' : 'Solara';
      extra = ' · ' + sky.front + (sky.totalEclipse ? ' covers ' : ' crosses ') + behind + extra;
    }
    sky.bodies.filter(function (b) { return b.kind === 'moon'; }).forEach(function (m) {
      sky.bodies.filter(function (b) { return b.kind === 'sun'; }).forEach(function (s) {
        var c = m.hor[0] * s.hor[0] + m.hor[1] * s.hor[1] + m.hor[2] * s.hor[2];
        if (Math.acos(Math.min(1, c)) / DEG < m.r + s.r && s.alt > -1) extra += ' · ' + m.n + ' crosses ' + s.n;
      });
    });
    var state = lightState(S, N) + extra;
    $('sky-hud-state').textContent = state;
    var fovEl = $('sky-hud-fov');
    if (fovEl) {
      fovEl.textContent = st.view === 'dome' ? 'Whole sky'
        : (st.fov >= 170 ? 'Full horizon · discs ' + (st.big ? '×3' : 'true size')
           : st.fov.toFixed(st.fov < 10 ? 1 : 0) + '° across · discs ' + (st.big ? '×3' : 'true size'));
    }
    $('sky-clock').textContent = fmtH(st.h);
    if (document.activeElement !== $('sky-hour')) $('sky-hour').value = st.h;

    sky.bodies.forEach(function (b, k) {
      var el = $('sky-now' + k);
      if (!el) return;
      el.textContent = b.alt > -0.5 ? Math.round(b.alt) + '° ' + compass(b.az) : 'below';
      el.dataset.alt = b.alt.toFixed(3);
      el.dataset.az = b.az.toFixed(3);
      el.disabled = b.alt <= -0.5;
      var il = $('sky-ill' + k);
      if (il) il.textContent = Math.round(b.illum * 100) + '% lit';
    });

    // One live region rather than many: a screen reader needs the moment and
    // the light, not every cell of the table on every frame.
    if (!st.playing) $('sky-status').textContent = M.fmtLong(st.Y, st.doy) + ', ' + fmtH(st.h) + '. ' + state + '.';
    drawSizes(sky);
    drawFigureList();
    drawDial(sky);
  }

  /* The same figures the canvas just drew, as links.
     A canvas cannot be tabbed into, so anything the sky can open has to be
     openable here too or it is only available to people with a mouse. */
  function drawFigureList() {
    var el = $('sky-figures');
    if (!el) return;
    var up = figuresUp;
    if (!up.length) {
      el.innerHTML = '<li class="sky-figure sky-figure--none">No figure is wholly above the horizon just now.</li>';
      return;
    }
    el.innerHTML = up.map(function (f) {
      var names = (f.names || []).map(function (n) {
        return '<span class="sky-figure__alias">' + esc(n.name) + ' <i>' + esc(n.tradition) + '</i></span>';
      }).join('');
      return '<li class="sky-figure"><a href="' + esc(f.article) + '">' + esc(f.name) + '</a>' +
             (names ? '<span class="sky-figure__aliases">' + names + '</span>' : '') + '</li>';
    }).join('');
  }

  /* The five bodies in proportion to one another, at this moment. The sky above
     may be magnified three times so that anything is visible at all; this strip
     never is, so the comparison stays honest. Miras is the widest thing in the
     sky and sets the scale. */
  function drawSizes(sky) {
    var el = $('sky-sizes');
    if (!el) return;
    var items = sky.bodies.map(function (b) {
      return { n: b.n, key: b.key, dia: b.r * 2 };
    });
    var widest = Math.max.apply(null, items.map(function (i) { return i.dia; }));
    el.innerHTML = items.map(function (i) {
      var px = Math.max(4, Math.round(i.dia / widest * 68));
      var tok = i.key === 'solara' || i.key === 'nystara' ? '--' + i.key : '--moon-' + i.key;
      return '<span class="sky-size">' +
        '<span class="sky-size__disc" style="width:' + px + 'px;height:' + px + 'px;background:var(' + tok + ')"></span>' +
        '<span class="sky-size__name">' + esc(i.n) + '</span>' +
        '<span class="sky-size__num">' + i.dia.toFixed(2) + '&deg;</span></span>';
    }).join('');
  }

  /* ---------- the two shadows ---------- */

  var dcv = $('sky-dial'), dctx = dcv.getContext('2d');
  function drawDial(sky) {
    var Wd = dcv.width, c = Wd / 2, R0 = Wd * 0.44;
    dctx.clearRect(0, 0, Wd, Wd);
    dctx.fillStyle = cssv('--p-200') || '#efe7d6';
    dctx.beginPath(); dctx.arc(c, c, R0, 0, 2 * Math.PI); dctx.fill();
    dctx.strokeStyle = cssv('--br-light') || '#d8cdb6';
    dctx.lineWidth = 2;
    [1, 2, 3].forEach(function (k) { dctx.beginPath(); dctx.arc(c, c, R0 * k / 3, 0, 2 * Math.PI); dctx.stroke(); });
    dctx.fillStyle = cssv('--ink-ghost') || '#816650';
    dctx.font = '22px ' + (cssv('--font-mono') || 'monospace');
    dctx.textAlign = 'center'; dctx.textBaseline = 'middle';
    dctx.fillText('N', c, c - R0); dctx.fillText('S', c, c + R0);
    dctx.fillText('E', c + R0, c); dctx.fillText('W', c - R0, c);

    var notes = [], lightUI = isLightTheme();
    dctx.save();
    dctx.beginPath(); dctx.arc(c, c, R0 - 4, 0, 2 * Math.PI); dctx.clip();
    // Multiply on a pale dial so two overlapping shadows darken each other,
    // which is the whole point of the pair.
    dctx.globalCompositeOperation = lightUI ? 'multiply' : 'source-over';
    sky.bodies.filter(function (b) { return b.kind === 'sun'; }).forEach(function (b) {
      if (b.alt <= 0.3) return;
      var ratio = 1 / Math.tan(b.alt * DEG);
      var len = Math.min(3, ratio), dir = (b.az + 180) * DEG;
      var ex = c + Math.sin(dir) * len * R0 / 3, ey = c - Math.cos(dir) * len * R0 / 3;
      dctx.strokeStyle = b.n === 'Solara'
        ? (lightUI ? 'rgba(150,95,30,.55)' : 'rgba(233,180,76,.45)')
        : (lightUI ? 'rgba(40,80,140,.55)' : 'rgba(170,205,250,.45)');
      dctx.lineWidth = 22; dctx.lineCap = 'round';
      dctx.beginPath(); dctx.moveTo(c, c); dctx.lineTo(ex, ey); dctx.stroke();
      notes.push((b.n === 'Solara' ? 'Warm' : 'Blue-edged') + ' shadow from ' + b.n + ', ' +
                 ratio.toFixed(1) + ' times the post’s height, toward ' + compass(mod(b.az + 180, 360)));
    });
    dctx.restore();
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = cssv('--ink') || '#2b2118';
    dctx.beginPath(); dctx.arc(c, c, 9, 0, 2 * Math.PI); dctx.fill();
    $('sky-dial-note').textContent = notes.length
      ? notes.join('. ') + '.'
      : 'No sun above the horizon, so the post casts no sun shadow.';
  }

  /* ---------- controls ---------- */

  var msel = $('sky-month'), dsel = $('sky-day');
  M.MONTHS.forEach(function (m, i) {
    var o = document.createElement('option');
    o.value = i; o.textContent = m.n;
    msel.appendChild(o);
  });

  function syncDate() {
    var x = M.dayInfo(st.Y, st.doy);
    $('sky-year').value = st.Y;
    msel.value = x.mi;
    dsel.innerHTML = '';
    for (var d = 1; d <= M.MONTHS[x.mi].d; d++) {
      var o = document.createElement('option');
      o.value = d; o.textContent = d;
      dsel.appendChild(o);
    }
    dsel.value = x.d;
    dsel.disabled = M.MONTHS[x.mi].d === 1;
  }
  function setDate(Y, doy) {
    var n = M.normalise(Y, doy);
    st.Y = clamp(Math.round(n.Y), 0, 9999); st.doy = n.doy;
    syncDate(); render(); save();
  }
  function setHour(h) { st.h = mod(h, 24); render(); save(); }

  $('sky-year').addEventListener('change', function (e) { setDate(+e.target.value || 0, st.doy); });
  $('sky-prev-year').onclick = function () { setDate(st.Y - 1, st.doy); };
  $('sky-next-year').onclick = function () { setDate(st.Y + 1, st.doy); };
  msel.addEventListener('change', function () { setDate(st.Y, M.doyOf(+msel.value, 1)); });
  dsel.addEventListener('change', function () { setDate(st.Y, M.doyOf(+msel.value, +dsel.value)); });
  $('sky-prev-day').onclick = function () { setDate(st.Y, st.doy - 1); };
  $('sky-next-day').onclick = function () { setDate(st.Y, st.doy + 1); };
  $('sky-hour').addEventListener('input', function (e) { st.h = +e.target.value; render(); });
  $('sky-hour').addEventListener('change', save);

  function setView(v) {
    st.view = v;
    box.classList.toggle('is-dome', v === 'dome');
    $('sky-view-pan').setAttribute('aria-pressed', String(v === 'pan'));
    $('sky-view-dome').setAttribute('aria-pressed', String(v === 'dome'));
    resize(); save();
  }
  $('sky-view-pan').onclick = function () { setView('pan'); };
  $('sky-view-dome').onclick = function () { setView('dome'); };
  [['sky-face-n', 0], ['sky-face-e', 90], ['sky-face-s', 180], ['sky-face-w', 270]].forEach(function (e) {
    $(e[0]).onclick = function () {
      if (st.view === 'dome') st.domeRot = e[1]; else st.facing = e[1];
      render(); save();
    };
  });

  /* Point the view at a body. The ephemeris rows carry where each one is, so
     clicking a row swings the frame onto it — which is the only practical way
     to find something once the field of view is down to a degree or two. */
  function aimAt(alt, az) {
    if (st.view === 'dome') { st.domeRot = az; }
    else { st.facing = az; st.pitch = clamp(alt, -15, 88); }
    render();
    save();
  }
  $('sky-eph').addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.sky-aim') : null;
    if (!btn || btn.disabled) return;
    var alt = parseFloat(btn.dataset.alt), az = parseFloat(btn.dataset.az);
    if (isFinite(alt) && isFinite(az)) aimAt(alt, az);
  });

  /* Zoom. Without it "true size" is a promise the page cannot keep: across the
     whole horizon a sun is four pixels wide. Narrowing the field of view is
     what makes an accurate disc something you can actually look at. */
  var FOV_MIN = 1.5, FOV_MAX = 180;
  function setFov(f) {
    if (st.view !== 'pan') return;
    st.fov = clamp(f, FOV_MIN, FOV_MAX);
    st.fovAuto = false;
    render();
    save();
  }
  function zoom(factor) { setFov(st.fov * factor); }
  function resetFov() {
    st.fovAuto = true;
    st.pitch = 0;
    var r = box.getBoundingClientRect();
    st.fov = r.width < 700 ? 130 : 180;
    render();
    save();
  }

  // Wheel zooms rather than scrolling the page, but only over the sky.
  cv.addEventListener('wheel', function (e) {
    if (st.view !== 'pan') return;
    e.preventDefault();
    zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });

  function turn(by) {
    if (st.view === 'dome') st.domeRot = mod(st.domeRot + by, 360);
    else st.facing = mod(st.facing + by, 360);
    render(); save();
  }

  // Drag to turn.
  var drag = null;
  cv.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY, p: st.pitch,
             f: st.view === 'pan' ? st.facing : st.domeRot };
    cv.setPointerCapture(e.pointerId);
    cv.classList.add('is-dragging');
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = (e.clientX - drag.x) * DPR;
    if (st.view === 'pan') {
      st.facing = mod(drag.f - dx / P.sc, 360);
      var dy = (e.clientY - drag.y) * DPR;
      st.pitch = clamp(drag.p + dy / P.sc, -15, 88);
    } else {
      st.domeRot = mod(drag.f - dx / (P.R / 90) * 0.6, 360);
    }
    render();
  });
  /* Clicking the sky. A drag that turns the view is not a click, so the
     distance travelled decides which it was. */
  var DRAG_SLOP = 4;
  function openFor(target) {
    if (target && target.href) window.location.href = target.href;
  }
  cv.addEventListener('pointerup', function (e) {
    if (drag && (Math.abs(e.clientX - drag.x) > DRAG_SLOP || Math.abs(e.clientY - drag.y) > DRAG_SLOP)) return;
    var r = cv.getBoundingClientRect();
    var x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
    var body = bodyAt(x, y);
    if (body) { openFor(body); return; }
    var fig = figureAt(x, y);
    if (fig) window.location.href = fig.article;
  });

  // Light the figure under the pointer, and say that it can be clicked.
  cv.addEventListener('pointermove', function (e) {
    if (drag) return;
    var r = cv.getBoundingClientRect();
    var x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
    var body = bodyAt(x, y), fig = body ? null : figureAt(x, y);
    var want = body ? body.n : (fig ? fig.name : null);
    cv.style.cursor = want ? 'pointer' : '';
    cv.title = want ? ('Open ' + want) : '';
    var changed = false;
    FIGURES.forEach(function (f) {
      var hot = (f === fig);
      if (!!f._hot !== hot) { f._hot = hot; changed = true; }
    });
    if (changed) render();
  });
  cv.addEventListener('pointerleave', function () {
    var changed = false;
    FIGURES.forEach(function (f) { if (f._hot) { f._hot = false; changed = true; } });
    cv.style.cursor = ''; cv.title = '';
    if (changed) render();
  });

  var endDrag = function () { if (drag) { drag = null; cv.classList.remove('is-dragging'); save(); } };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  /* Keyboard. The sky was pointer-only in the artifact, which put the entire
     view out of reach without a mouse. Left and right turn, up and down move
     the clock, page keys change the day, and space plays. */
  cv.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var big = e.shiftKey;
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); turn(big ? -15 : -5); break;
      case 'ArrowRight': e.preventDefault(); turn(big ? 15 : 5); break;
      case 'ArrowUp':
        e.preventDefault();
        if (big) { st.pitch = clamp(st.pitch + st.fov / 12, -15, 88); render(); save(); }
        else setHour(st.h + 0.25);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (big) { st.pitch = clamp(st.pitch - st.fov / 12, -15, 88); render(); save(); }
        else setHour(st.h - 0.25);
        break;
      case 'PageUp':     e.preventDefault(); setDate(st.Y, st.doy + 1); break;
      case 'PageDown':   e.preventDefault(); setDate(st.Y, st.doy - 1); break;
      case 'Home':       e.preventDefault(); if (st.view === 'dome') { st.domeRot = 0; } else { st.facing = 0; st.pitch = 0; } render(); save(); break;
      case '+':
      case '=':          e.preventDefault(); zoom(1 / 1.4); break;
      case '-':
      case '_':          e.preventDefault(); zoom(1.4); break;
      case '0':          e.preventDefault(); resetFov(); break;
      case ' ':
      case 'Spacebar':   e.preventDefault(); togglePlay(); break;
      default: return;
    }
  });

  /* ---------- play ---------- */

  var lastT = 0, acc = 0, raf = 0;
  function tick(t) {
    if (!st.playing) return;
    var dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0;
    lastT = t;
    if (st.speed === 'day') {
      acc += dt;
      if (acc >= 1) { acc = 0; setDate(st.Y, st.doy + 1); }
    } else {
      st.h += dt * (+st.speed) / 60;
      if (st.h >= 24) { st.h -= 24; setDate(st.Y, st.doy + 1); } else render();
    }
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    st.playing = on;
    $('sky-play').textContent = on ? 'Pause' : 'Play';
    $('sky-play').setAttribute('aria-pressed', String(on));
    if (on) { lastT = 0; acc = 0; raf = requestAnimationFrame(tick); }
    else { if (raf) cancelAnimationFrame(raf); raf = 0; save(); }
  }
  function togglePlay() { setPlaying(!st.playing); }
  $('sky-play').onclick = togglePlay;
  $('sky-speed').addEventListener('change', function (e) { st.speed = e.target.value; });

  // requestAnimationFrame does not fire in a hidden tab. Without this the loop
  // is simply suspended and resumes by jumping the whole time the reader was
  // away, which looks like a bug in the clock.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && st.playing) setPlaying(false);
  });

  /* ---------- the working assumptions ---------- */

  $('sky-lat').value = MODEL.lat;
  $('sky-tilt').value = MODEL.tilt;
  $('sky-spread').value = (O.EL.BETA / DEG).toFixed(0);
  $('sky-big').checked = st.big;
  $('sky-lat').addEventListener('change', function (e) { MODEL.lat = clamp(+e.target.value || 0, -80, 80); tableKey = ''; render(); save(); });
  $('sky-tilt').addEventListener('change', function (e) { MODEL.tilt = clamp(+e.target.value || 0, 0, 60); tableKey = ''; render(); save(); });
  $('sky-spread').addEventListener('change', function (e) {
    O.setBeta(clamp(+e.target.value || 45, 0, 89)); tableKey = ''; render(); save();
  });
  $('sky-big').addEventListener('change', function (e) { st.big = e.target.checked; render(); save(); });

  // A link a reader can hand to someone else, pinned to what they are looking at.
  $('sky-share').addEventListener('click', function () {
    var url = window.location.origin + window.location.pathname +
              '?y=' + st.Y + '&d=' + st.doy + '&h=' + st.h.toFixed(2);
    $('sky-share-out').value = url;
    $('sky-share-out').hidden = false;
    $('sky-share-out').select();
  });

  // The dial is painted from tokens, so flipping the theme has to repaint it.
  // Watching the class, because that is what the site's toggle changes.
  new MutationObserver(render).observe(document.documentElement,
    { attributes: true, attributeFilter: ['class'] });

  syncDate();
  box.classList.toggle('is-dome', st.view === 'dome');
  $('sky-view-pan').setAttribute('aria-pressed', String(st.view === 'pan'));
  $('sky-view-dome').setAttribute('aria-pressed', String(st.view === 'dome'));
  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
})();
