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
 *   - They orbit each other on roughly eight Marducian years, the first
 *     recorded Pairing in 0 MC.
 *   - Neither star ever passes in front of the other, and at the Pairing they
 *     sit "separated by less than a sun-width". Those two sentences together
 *     pin the closest approach: wider than the two radii summed, or one would
 *     eclipse the other, and narrower than a disc. See MODEL.meet.
 *   - Every lit object casts two shadows, Solara's warm and soft, Nystara's
 *     sharper and edged toward pale blue. That is the Two Shadows dial.
 *   - The Pale Hour is Nystara up with Solara down, twenty minutes to nearly
 *     two hours. Solara alone is just "the warm light" and has no other name.
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

  var $ = function (id) { return document.getElementById(id); };
  var DEG = Math.PI / 180;
  var YEAR = M.YEAR_LEN, mod = M.mod;

  /* ---------- the model: everything here is invented ----------
   *
   * r is an angular radius in degrees. The moons' inc/nodeP/node0 give each one
   * a slightly tilted orbit with a slowly turning line of nodes, which is what
   * stops all three sharing one path across the sky. Any moon seen crossing a
   * sun's face is therefore a result of these numbers, not a lore event.
   */
  var SUNS = [
    { n: 'Solara',  r: 0.45, key: 'solara',  tone: 'Warm, yellow' },
    { n: 'Nystara', r: 0.28, key: 'nystara', tone: 'Blue-white' }
  ];
  var MOON_MODEL = {
    miras:  { r: 0.50, inc: 5.0, nodeP: 940,  node0: 40 },
    toris:  { r: 0.42, inc: 3.4, nodeP: 1630, node0: 200 },
    keltas: { r: 0.34, inc: 7.2, nodeP: 2710, node0: 310 }
  };
  // Canon moons, each given its drawing parameters. Order follows marducian.js.
  var MOONS = M.MOONS.map(function (mo) {
    var m = {};
    for (var k in mo) if (Object.prototype.hasOwnProperty.call(mo, k)) m[k] = mo[k];
    var p = MOON_MODEL[mo.key];
    m.r = p.r; m.inc = p.inc; m.nodeP = p.nodeP; m.node0 = p.node0;
    return m;
  });

  var MODEL = {
    lat: 40,        // Aru'Mas's latitude. Sets day length and how high the suns climb.
    tilt: 23,       // Axial tilt.
    spread: 19,     // Widest separation of the suns, in degrees.
    // Closest approach at the Pairing. Must exceed 0.73 (the summed radii, where
    // one disc would start to cover the other) and stay under 0.90 (Solara's
    // full width), which is the window canon leaves open.
    meet: 0.80,
    alpha: 32,      // Tilt of the pair's separation against the ecliptic.
    q: 0.35,        // Mass split, so the two swing about a common centre.
    solstice: 152   // Longest day: mid-Cindralis, matching the month descriptions.
  };

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
  function eclToEq(lon, lat) {
    var e = MODEL.tilt * DEG, cb = Math.cos(lat);
    var x = cb * Math.cos(lon), y0 = cb * Math.sin(lon), z0 = Math.sin(lat);
    return [x, y0 * Math.cos(e) - z0 * Math.sin(e), y0 * Math.sin(e) + z0 * Math.cos(e)];
  }
  // returns [East, North, Up]
  function eqToHor(v, lst) {
    var phi = MODEL.lat * DEG, c = Math.cos(lst), s = Math.sin(lst);
    var xp = v[0] * c + v[1] * s, yp = -v[0] * s + v[1] * c, z = v[2];
    return [yp, z * Math.cos(phi) - xp * Math.sin(phi), z * Math.sin(phi) + xp * Math.cos(phi)];
  }
  var altOf = function (h) { return Math.asin(clamp(h[2], -1, 1)) / DEG; };
  var azOf = function (h) { return mod(Math.atan2(h[0], h[1]) / DEG, 360); };
  var horToAA = function (h) { return { alt: altOf(h), az: azOf(h) }; };

  // The whole sky for one moment. Y in MC, doy 1..386, h in hours 0..24.
  function skyAt(Y, doy, h) {
    var df = doy - 1 + h / 24;
    var lb = 2 * Math.PI * (df - (MODEL.solstice - 0.5)) / YEAR + Math.PI / 2;
    var t = Y + df / YEAR;
    var a = MODEL.alpha * DEG,
        sp = Math.sin(Math.PI * t / M.PAIR_PERIOD) * MODEL.spread * DEG,
        mt = Math.cos(Math.PI * t / M.PAIR_PERIOD) * MODEL.meet * DEG;
    var sx = sp * Math.cos(a) - mt * Math.sin(a), sy = sp * Math.sin(a) + mt * Math.cos(a);
    var bary = eclToEq(lb, 0);
    var lst = Math.atan2(bary[1], bary[0]) + (h - 12) * 15 * DEG;
    var out = { lst: lst, t: t, sepDeg: Math.hypot(sx, sy) / DEG, bodies: [] };
    var w = [-MODEL.q, 1 - MODEL.q];
    SUNS.forEach(function (s, i) {
      var eq = eclToEq(lb + w[i] * sx, w[i] * sy), hor = eqToHor(eq, lst);
      out.bodies.push({ kind: 'sun', n: s.n, r: s.r, key: s.key, tone: s.tone,
                        eq: eq, hor: hor, alt: altOf(hor), az: azOf(hor) });
    });
    out.baryHor = eqToHor(bary, lst);
    var D = M.absDay(Y, doy);
    MOONS.forEach(function (m) {
      var pc = mod(D, m.c) + h / 24;
      var e = 2 * Math.PI * (pc - m.ph[0] / 2) / m.c;
      var lm = lb + e;
      var node = (m.node0 * DEG) - 2 * Math.PI * (D + h / 24) / m.nodeP;
      var bm = m.inc * DEG * Math.sin(lm - node);
      var eq = eclToEq(lm, bm), hor = eqToHor(eq, lst);
      var cosPsi = eq[0] * bary[0] + eq[1] * bary[1] + eq[2] * bary[2];
      out.bodies.push({ kind: 'moon', n: m.n, r: m.r, key: m.key,
                        eq: eq, hor: hor, alt: altOf(hor), az: azOf(hor),
                        cosPsi: cosPsi, illum: (1 - cosPsi) / 2,
                        phase: M.phaseOf(m, D).i });
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
    view: 'pan', facing: 90, domeRot: 0, fov: 180,
    big: true, playing: false, speed: '60'
  };
  try {
    var saved = JSON.parse(localStorage.getItem('ahv-sky') || 'null');
    if (saved) {
      ['Y', 'doy', 'h', 'view', 'facing', 'domeRot', 'big'].forEach(function (k) {
        if (saved[k] !== undefined) st[k] = saved[k];
      });
      if (saved.model) ['lat', 'tilt', 'spread'].forEach(function (k) {
        if (isFinite(saved.model[k])) MODEL[k] = saved.model[k];
      });
    }
  } catch (e) { /* private window, blocked storage — defaults are fine */ }
  function save() {
    try {
      localStorage.setItem('ahv-sky', JSON.stringify({
        Y: st.Y, doy: st.doy, h: st.h, view: st.view, facing: st.facing,
        domeRot: st.domeRot, big: st.big,
        model: { lat: MODEL.lat, tilt: MODEL.tilt, spread: MODEL.spread }
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

  /* ---------- the starfield ---------- */

  // Seeded so the constellations are the same sky every visit, and the same
  // sky for every reader. A random field would make the page's own screenshots
  // disagree with itself.
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var R = rng(4391);
  var STARS = [];
  for (var si = 0; si < 1100; si++) {
    var z = R() * 2 - 1, th = R() * 2 * Math.PI, rr = Math.sqrt(1 - z * z);
    STARS.push({ v: [rr * Math.cos(th), rr * Math.sin(th), z], b: Math.pow(R(), 3.2), t: R() });
  }
  // A faint river of stars along a tilted great circle.
  (function () {
    var pole = [0.32, -0.55, 0.77], pn = Math.hypot(pole[0], pole[1], pole[2]);
    pole = pole.map(function (x) { return x / pn; });
    var u1 = [pole[1], -pole[0], 0], u1n = Math.hypot(u1[0], u1[1], u1[2]);
    u1 = u1.map(function (x) { return x / u1n; });
    var u2 = [pole[1] * u1[2] - pole[2] * u1[1],
              pole[2] * u1[0] - pole[0] * u1[2],
              pole[0] * u1[1] - pole[1] * u1[0]];
    for (var i = 0; i < 900; i++) {
      var a = R() * 2 * Math.PI, off = (R() + R() + R() - 1.5) * 0.16;
      var v = [0, 1, 2].map(function (k) { return Math.cos(a) * u1[k] + Math.sin(a) * u2[k] + off * pole[k]; });
      var nn = Math.hypot(v[0], v[1], v[2]);
      STARS.push({ v: v.map(function (x) { return x / nn; }), b: Math.pow(R(), 5) * 0.7, t: R(), band: true });
    }
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
    if (st.view === 'pan') st.fov = r.width < 700 ? 130 : 180;
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
          return { x: W / 2 + d * sc, y: hy - alt * sc, ok: Math.abs(d) < st.fov / 2 + 8 };
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
    var rpx = Math.max(3 * DPR, b.r * (st.big ? 3 : 1) * P.sc);
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
    var rpx = Math.max(2.2 * DPR, b.r * (st.big ? 3 : 1) * P.sc);
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

  function render() {
    if (!W) return;
    setupProj();
    var sky = skyAt(st.Y, st.doy, st.h);
    var L = skyLight(sky);
    var S = sky.bodies[0], N = sky.bodies[1];
    ctx.clearRect(0, 0, W, H);

    if (st.view === 'pan') {
      var g = ctx.createLinearGradient(0, 0, 0, P.hy);
      g.addColorStop(0, rgb(L.zen));
      g.addColorStop(0.75, rgb(lerp3(L.zen, L.hor, 0.55)));
      g.addColorStop(1, rgb(L.hor));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, P.hy + 2);
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
      for (var i = 0; i < STARS.length; i++) {
        var s = STARS[i], h = eqToHor(s.v, sky.lst);
        if (h[2] < -0.05) continue;
        var aa = horToAA(h), p = P.f(aa.alt, aa.az);
        if (!p.ok) continue;
        var tw = 0.75 + 0.25 * Math.sin(s.t * 40 + st.h * 9);
        var a = L.starA * (s.band ? 0.25 + s.b : 0.25 + 0.75 * s.b) * tw * smooth(-2, 6, aa.alt);
        if (a < 0.02) continue;
        var sz = (s.band ? 0.7 : 0.6 + s.b * 1.8) * DPR;
        ctx.fillStyle = 'rgba(232,236,248,' + a.toFixed(3) + ')';
        ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
    }

    var placed = [];
    sky.bodies.filter(function (b) { return b.kind === 'sun'; })
      .forEach(function (b) { var r = drawSun(b); if (r) placed.push([b, r]); });
    sky.bodies.filter(function (b) { return b.kind === 'moon'; })
      .sort(function (a, b) { return b.r - a.r; })
      .forEach(function (b) { var r = drawMoon(b, sky, L); if (r) placed.push([b, r]); });

    if (st.view === 'pan') {
      var light = Math.min(1, L.day + (L.tS + L.tN) * 0.25);
      ctx.fillStyle = rgb(lerp3([8, 9, 13], [44, 46, 50], light));
      ctx.beginPath(); ctx.moveTo(0, H);
      for (var x = 0; x <= W; x += 3 * DPR) {
        var az = st.facing + (x - W / 2) / P.sc;
        ctx.lineTo(x, P.hy - hills(mod(az, 360)) * P.sc);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.font = (11 * DPR) + 'px ' + (cssv('--font-mono') || 'monospace');
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(236,230,214,.75)';
      for (var az2 = 0; az2 < 360; az2 += 45) {
        var pc = P.f(0, az2);
        if (!pc.ok) continue;
        ctx.fillText(compass(az2), pc.x, H - 12 * DPR);
        ctx.fillRect(pc.x - 0.5 * DPR, P.hy + 6 * DPR, 1 * DPR, 6 * DPR);
      }
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(236,230,214,.35)';
      [30, 60].forEach(function (a) {
        var y = P.hy - a * P.sc;
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
    var k = st.Y + '|' + st.doy + '|' + MODEL.lat + '|' + MODEL.tilt + '|' + MODEL.spread;
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
        '<td class="sky-num" id="sky-now' + k + '"></td>' +
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
    sky.bodies.filter(function (b) { return b.kind === 'moon'; }).forEach(function (m) {
      sky.bodies.filter(function (b) { return b.kind === 'sun'; }).forEach(function (s) {
        var c = m.hor[0] * s.hor[0] + m.hor[1] * s.hor[1] + m.hor[2] * s.hor[2];
        if (Math.acos(Math.min(1, c)) / DEG < m.r + s.r && s.alt > -1) extra += ' · ' + m.n + ' crosses ' + s.n;
      });
    });
    var state = lightState(S, N) + extra;
    $('sky-hud-state').textContent = state;
    $('sky-clock').textContent = fmtH(st.h);
    if (document.activeElement !== $('sky-hour')) $('sky-hour').value = st.h;

    sky.bodies.forEach(function (b, k) {
      var el = $('sky-now' + k);
      if (!el) return;
      el.textContent = b.alt > -0.5 ? Math.round(b.alt) + '° ' + compass(b.az) : 'below';
      var il = $('sky-ill' + k);
      if (il) il.textContent = Math.round(b.illum * 100) + '% lit';
    });

    // One live region rather than many: a screen reader needs the moment and
    // the light, not every cell of the table on every frame.
    if (!st.playing) $('sky-status').textContent = M.fmtLong(st.Y, st.doy) + ', ' + fmtH(st.h) + '. ' + state + '.';
    drawDial(sky);
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

  function turn(by) {
    if (st.view === 'dome') st.domeRot = mod(st.domeRot + by, 360);
    else st.facing = mod(st.facing + by, 360);
    render(); save();
  }

  // Drag to turn.
  var drag = null;
  cv.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, f: st.view === 'pan' ? st.facing : st.domeRot };
    cv.setPointerCapture(e.pointerId);
    cv.classList.add('is-dragging');
  });
  cv.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = (e.clientX - drag.x) * DPR;
    if (st.view === 'pan') st.facing = mod(drag.f - dx / P.sc, 360);
    else st.domeRot = mod(drag.f - dx / (P.R / 90) * 0.6, 360);
    render();
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
      case 'ArrowUp':    e.preventDefault(); setHour(st.h + (big ? 1 : 0.25)); break;
      case 'ArrowDown':  e.preventDefault(); setHour(st.h - (big ? 1 : 0.25)); break;
      case 'PageUp':     e.preventDefault(); setDate(st.Y, st.doy + 1); break;
      case 'PageDown':   e.preventDefault(); setDate(st.Y, st.doy - 1); break;
      case 'Home':       e.preventDefault(); if (st.view === 'dome') st.domeRot = 0; else st.facing = 0; render(); save(); break;
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
  $('sky-spread').value = MODEL.spread;
  $('sky-big').checked = st.big;
  $('sky-lat').addEventListener('change', function (e) { MODEL.lat = clamp(+e.target.value || 0, -80, 80); tableKey = ''; render(); save(); });
  $('sky-tilt').addEventListener('change', function (e) { MODEL.tilt = clamp(+e.target.value || 0, 0, 60); tableKey = ''; render(); save(); });
  $('sky-spread').addEventListener('change', function (e) { MODEL.spread = clamp(+e.target.value || 2, 2, 40); tableKey = ''; render(); save(); });
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
