/* orbits.js — where Solara and Nystara actually are.
 *
 * This replaces the hand-tuned sine the sky projection used to place the suns.
 * That fudge could never let the two discs touch, which contradicted nothing
 * until Krys ruled (2026-10-10) that they do converge, and that the sky should
 * be plotted properly so cosmic alignments can be a factor in play.
 *
 * THE GEOMETRY
 *
 *   Solara and Nystara orbit their common centre of mass, period P_BIN years.
 *   Nyhexus orbits that same centre once per Marducian year, on a plane tilted
 *   BETA from theirs.
 *
 * Three consequences fall out of that and none of them are authored:
 *
 *   1. The suns converge and separate ONCE A YEAR. The planet sweeps its line
 *      of sight through a full circle every year, which dominates the binary's
 *      own slow turn. This is the Pairing, and it is annual.
 *   2. How CLOSE each Pairing gets rides a longer rhythm, because the binary's
 *      orientation rotates underneath the annual cycle. Some years the pair
 *      closes to less than a sun-width; some years they stay ten degrees apart.
 *   3. Twice a year the planet crosses the suns' orbital plane and sees them
 *      exactly edge-on. When a deep Pairing lands on one of those crossings,
 *      one sun passes in front of the other. With BETA at 45 degrees that is
 *      about one eclipse every sixteen years.
 *
 * P_BIN is deliberately NOT a whole number of years. At exactly sixteen the
 * conjunctions lock to the plane crossings and every single Pairing becomes a
 * flawless eclipse — the resonance makes the rare thing routine.
 *
 * Classic script exposing a global, matching marducian.js and map-coords.js.
 * Tested by scripts/test-orbits.js.
 */
(function () {
  'use strict';

  var M = window.Marducian;
  if (!M) return;

  var DEG = Math.PI / 180;
  var YEAR = M.YEAR_LEN;

  /* The elements. Ruled 2026-10-10; before that the suns had no real orbit. */
  var EL = {
    P_BIN: 16.37,     // years for the suns to circle each other. Not a whole
                      // number on purpose — see above.
    MU: 0.20,         // Nystara's share of the system mass. Low enough to keep
                      // Nyhexus outside the instability zone at D below.
    D: 3.1,           // the planet's orbital radius, in binary separations.
                      // Set by canon's widest apparent gap of about 19 degrees.
    BETA: 45 * DEG,   // tilt between the planet's orbit and the suns'. The one
                      // number chosen for feel rather than derived: it sets how
                      // often an eclipse happens.
    R_SOL: 0.45,      // angular radius in degrees at the mean distance
    R_NYS: 0.28,
    SOLSTICE: 152     // longest day, mid-Cindralis
  };

  // Phase of the binary at day 0, chosen so a deep Pairing falls in 0 MC and
  // the era still means what the calendar says it means.
  var WB0 = 3.2812;

  // Planet's orbital phase at day 0, fixed by the solstice: the sun must reach
  // its northernmost point on day SOLSTICE.
  var TH0 = -Math.PI / 2 - 2 * Math.PI * (EL.SOLSTICE - 0.5) / YEAR;

  var basis;
  function rebuild() {
    var b = EL.BETA;
    basis = { e1: [1, 0, 0], e2: [0, Math.cos(b), Math.sin(b)], nrm: [0, -Math.sin(b), Math.cos(b)] };
  }
  rebuild();

  // The tilt is the one element chosen for feel, so it is worth letting a
  // reader move it and watch the eclipses get rarer.
  function setBeta(deg) { EL.BETA = deg * DEG; rebuild(); }

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { return Math.sqrt(dot(a, a)); }
  function unit(a) { var n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function angle(u, v) { return Math.acos(Math.max(-1, Math.min(1, dot(u, v)))); }

  // A direction in space, expressed in the planet's own orbital frame.
  function toEcl(u) {
    return { lon: Math.atan2(dot(u, basis.e2), dot(u, basis.e1)), lat: Math.asin(dot(u, basis.nrm)) };
  }

  /* Everything about the two suns at an absolute day (fractional = time of
     day). Day 0 is 1 Varenthal, Year 1, the same epoch the moons use. */
  function sunsAt(t) {
    var yr = t / YEAR;
    var wb = 2 * Math.PI * yr / EL.P_BIN + WB0;
    var d = [Math.cos(wb), Math.sin(wb), 0];
    var rS = [-EL.MU * d[0], -EL.MU * d[1], 0];
    var rN = [(1 - EL.MU) * d[0], (1 - EL.MU) * d[1], 0];
    var th = 2 * Math.PI * yr + TH0;
    var p = [0, 1, 2].map(function (k) {
      return EL.D * (Math.cos(th) * basis.e1[k] + Math.sin(th) * basis.e2[k]);
    });

    var vS = sub(rS, p), vN = sub(rN, p);
    var dS = norm(vS), dN = norm(vN);
    var uS = unit(vS), uN = unit(vN);
    // Angular radii shrink and grow a little as the planet swings around.
    var rhoS = EL.R_SOL * DEG * EL.D / dS, rhoN = EL.R_NYS * DEG * EL.D / dN;
    var psi = angle(uS, uN);

    return {
      solara: toEcl(uS), nystara: toEcl(uN),
      bary: toEcl(unit([-p[0], -p[1], -p[2]])),
      rhoS: rhoS, rhoN: rhoN,
      sep: psi, sepDeg: psi / DEG,
      touching: psi < rhoS + rhoN,
      total: psi < Math.abs(rhoS - rhoN),
      // The nearer sun is the one in front.
      front: dS < dN ? 'Solara' : 'Nystara'
    };
  }

  /* The annual Pairing: the day in a given year when the two come closest.
     Returned depth is in degrees. Coarse pass then refine, because the minimum
     is smooth and a day-by-day scan over a year is cheap. */
  function pairingOf(Y) {
    var d0 = M.absDay(Y, 1), best = null;
    for (var i = 0; i < YEAR; i++) {
      var s = sunsAt(d0 + i);
      if (!best || s.sepDeg < best.sepDeg) best = { t: d0 + i, sepDeg: s.sepDeg };
    }
    // Hold the coarse answer still while refining around it. Reading best.t
    // inside the loop walks the search away a fraction of a day at a time, and
    // over forty-nine steps it drifts clean out of the year it was asked about.
    var base = best.t, lo = d0, hi = d0 + YEAR - 1 / 24;
    for (var h = -24; h <= 24; h++) {
      // Stay inside the year being asked about. Some years the closest approach
      // sits right on the boundary, and the true minimum is hours into the next
      // year — that one belongs to the next year's Pairing, not this one.
      var t = Math.max(lo, Math.min(hi, base + h / 24));
      var s2 = sunsAt(t);
      if (s2.sepDeg < best.sepDeg) best = { t: t, sepDeg: s2.sepDeg };
    }
    var f = M.fromAbs(Math.floor(best.t));
    return { Y: f.Y, doy: f.doy, t: best.t, sepDeg: best.sepDeg, close: best.sepDeg < 0.9 };
  }

  /* The next time one sun actually crosses the other, from a given day.
     Steps in hours because an eclipse can be over inside a day. */
  function nextEclipse(fromT, limitYears) {
    var end = fromT + (limitYears || 60) * YEAR;
    var step = 1 / 6;
    var inIt = false, ep = null;
    for (var t = fromT; t < end; t += step) {
      var s = sunsAt(t);
      if (s.touching) {
        if (!inIt) { inIt = true; ep = { start: t, min: s.sepDeg, total: s.total, front: s.front }; }
        if (s.sepDeg < ep.min) { ep.min = s.sepDeg; ep.peak = t; ep.front = s.front; }
        if (s.total) ep.total = true;
        ep.end = t;
      } else if (inIt) {
        var f = M.fromAbs(Math.floor(ep.peak !== undefined ? ep.peak : ep.start));
        ep.Y = f.Y; ep.doy = f.doy;
        ep.hours = (ep.end - ep.start) * 24;
        return ep;
      }
    }
    return null;
  }

  /* ---------- the observer ----------
   *
   * Where a body sits on the sky is one question; whether it was above the
   * horizon in Aru'Mas at the time is another, and events need both. sky.js
   * drives these same numbers when the reader moves the latitude slider.
   */
  var OBS = { lat: 40, tilt: 23 };

  function eclToEq(lon, lat) {
    var e = OBS.tilt * DEG, cb = Math.cos(lat);
    var x = cb * Math.cos(lon), y0 = cb * Math.sin(lon), z0 = Math.sin(lat);
    return [x, y0 * Math.cos(e) - z0 * Math.sin(e), y0 * Math.sin(e) + z0 * Math.cos(e)];
  }
  // returns [East, North, Up]
  function eqToHor(v, lst) {
    var phi = OBS.lat * DEG, c = Math.cos(lst), s = Math.sin(lst);
    var xp = v[0] * c + v[1] * s, yp = -v[0] * s + v[1] * c, z = v[2];
    return [yp, z * Math.cos(phi) - xp * Math.sin(phi), z * Math.sin(phi) + xp * Math.cos(phi)];
  }
  function altOf(h) { return Math.asin(Math.max(-1, Math.min(1, h[2]))) / DEG; }
  function azOf(h) { return M.mod(Math.atan2(h[0], h[1]) / DEG, 360); }

  // Sidereal angle for a moment, given where the suns are.
  function lstAt(t, lbSun) {
    var h = (t - Math.floor(t)) * 24;
    var eq = eclToEq(lbSun, 0);
    return Math.atan2(eq[1], eq[0]) + (h - 12) * 15 * DEG;
  }
  // Altitude in degrees of an ecliptic direction, at a moment.
  function altAt(t, lon, lat, lbSun) {
    return altOf(eqToHor(eclToEq(lon, lat), lstAt(t, lbSun)));
  }

  /* ---------- the moons ----------
   *
   * Canon fixes each moon's cycle and its phase table, and fixes all three new
   * on 1 Varenthal Year 1. It says nothing about how big they look or how their
   * orbits are tilted, and those are what decide whether a moon ever crosses a
   * sun or another moon. They are set here deliberately rather than inherited.
   *
   *   rho   angular radius on the sky, in degrees. Compare Solara at 0.45 and
   *         Nystara at 0.28: a moon with rho above 0.45 can cover either sun
   *         outright, below 0.28 it can only ever graze them.
   *   inc   tilt of the moon's orbit against the planet's own. A moon with no
   *         tilt would cross a sun every single cycle; the tilt is what makes
   *         crossings occasional.
   *   nodeP the time for the line of nodes to turn right round. This is what
   *         stops crossings settling into a fixed season and repeating forever
   *         on the same dates.
   *
   * Distance order follows the cycles — Miras nearest, Keltas furthest — so
   * when two moons meet, the shorter-cycle one passes in front.
   */
  var MOON_EL = {
    miras:  { rho: 0.46, inc: 8.0,  nodeP: 940,  node0: 40,  depth: 0 },
    toris:  { rho: 0.42, inc: 6.0,  nodeP: 1630, node0: 200, depth: 1 },
    keltas: { rho: 0.34, inc: 11.0, nodeP: 2710, node0: 310, depth: 2 }
  };

  var MOONS = M.MOONS.map(function (mo) {
    var e = MOON_EL[mo.key], m = {};
    for (var k in mo) if (Object.prototype.hasOwnProperty.call(mo, k)) m[k] = mo[k];
    m.rho = e.rho * DEG; m.inc = e.inc * DEG;
    m.nodeP = e.nodeP; m.node0 = e.node0 * DEG; m.depth = e.depth;
    return m;
  });

  /* Where each moon stands, given where the suns are. Phase is measured from
     the sunward direction, so it stays in step with the Foundry tables; the
     tilt then lifts the moon off the ecliptic by its own amount. */
  function moonsAt(t, lbSun) {
    var Dd = Math.floor(t), frac = t - Dd;
    return MOONS.map(function (m) {
      var pc = M.mod(Dd, m.c) + frac;
      // Elongation from the sun. Zero in the middle of the New window, which
      // is where the phase tables put a true conjunction.
      var el = 2 * Math.PI * (pc - m.ph[0] / 2) / m.c;
      var lon = lbSun + el;
      var node = m.node0 - 2 * Math.PI * t / m.nodeP;
      var lat = m.inc * Math.sin(lon - node);
      return {
        n: m.n, key: m.key, depth: m.depth, rho: m.rho,
        lon: lon, lat: lat,
        phase: M.phaseOf(m, Dd).i,
        illum: (1 - Math.cos(el)) / 2
      };
    });
  }

  // Angle between two ecliptic directions.
  function between(a, b) {
    var ca = Math.cos(a.lat), cb = Math.cos(b.lat);
    var d = ca * cb * Math.cos(a.lon - b.lon) + Math.sin(a.lat) * Math.sin(b.lat);
    return Math.acos(Math.max(-1, Math.min(1, d)));
  }

  /* Everything crossing everything else, at one moment. The suns are passed in
     so a caller that already has them does not pay for them twice. */
  function crossingsAt(t, S) {
    S = S || sunsAt(t);
    var ms = moonsAt(t, S.bary.lon);
    var suns = [
      { n: 'Solara', dir: S.solara, rho: S.rhoS },
      { n: 'Nystara', dir: S.nystara, rho: S.rhoN }
    ];
    var out = [];
    ms.forEach(function (m) {
      suns.forEach(function (s) {
        var a = between(m, s.dir);
        if (a < m.rho + s.rho) {
          out.push({ kind: 'moon-sun', moon: m.n, other: s.n, sep: a,
                     total: m.rho > s.rho && a < m.rho - s.rho });
        }
      });
    });
    for (var i = 0; i < ms.length; i++) {
      for (var j = i + 1; j < ms.length; j++) {
        var a2 = between(ms[i], ms[j]);
        if (a2 < ms[i].rho + ms[j].rho) {
          var near = ms[i].depth < ms[j].depth ? ms[i] : ms[j];
          var far = near === ms[i] ? ms[j] : ms[i];
          out.push({ kind: 'moon-moon', moon: near.n, other: far.n, sep: a2,
                     total: near.rho > far.rho && a2 < near.rho - far.rho });
        }
      }
    }
    return out;
  }

  /* Walk an episode minute by minute to get its real edges and peak. The
     half-hourly scan only tells us roughly where it is. */
  function refine(ep) {
    var fine = 1 / 1440, lo = ep.start - 1 / 48, hi = ep.end + 1 / 48;
    var first = null, last = null, best = null;
    for (var t = lo; t <= hi; t += fine) {
      var S = sunsAt(t);
      var hit = null;
      crossingsAt(t, S).forEach(function (c) {
        if (c.kind === ep.kind && c.moon === ep.a && c.other === ep.b) hit = c;
      });
      if (hit) {
        if (first === null) first = t;
        last = t;
        if (!best || hit.sep < best.sep) best = { t: t, sep: hit.sep, total: hit.total };
        if (hit.total) ep.total = true;
      }
    }
    if (first !== null) {
      ep.start = first; ep.end = last;
      ep.peak = best.t; ep.min = best.sep;
    }
  }

  /* Every crossing in a span of time, gathered into episodes.
   *
   * A crossing lasts hours, so the scan steps in hours and groups consecutive
   * hits on the same pair into one event with a peak. Each is marked visible
   * only if the bodies stood above Aru'Mas's horizon at some point during it:
   * an eclipse that happened under everyone's feet is not an event the city
   * had, and a DM asking when the next one falls means the next one they SEE.
   *
   * Costly across centuries, so ask for the span you need. A year is cheap.
   */
  function eventsBetween(fromT, toT) {
    /* Half-hourly. A moon takes an hour or two to cross a sun, so a coarser
       step walks straight over the short ones and reports nonsense durations
       for the rest. Each episode it does find is then re-walked minute by
       minute, below, to get an honest peak and length. */
    var step = 1 / 48, open = {}, done = [];
    for (var t = fromT; t < toT; t += step) {
      var S = sunsAt(t);
      var lb = S.bary.lon;
      var live = {};
      /* jshint loopfunc:true */
      crossingsAt(t, S).forEach(function (c) {
        var key = c.kind + ':' + c.moon + '>' + c.other;
        live[key] = true;
        var ep = open[key];
        if (!ep) {
          ep = open[key] = {
            kind: c.kind, a: c.moon, b: c.other,
            start: t, peak: t, min: c.sep, total: c.total, visible: false
          };
        }
        if (c.sep < ep.min) { ep.min = c.sep; ep.peak = t; }
        if (c.total) ep.total = true;
        ep.end = t;
        if (!ep.visible) {
          // Check the moon; in a crossing the other body is right beside it.
          var ms = moonsAt(t, lb);
          for (var i = 0; i < ms.length; i++) {
            if (ms[i].n === c.moon && altAt(t, ms[i].lon, ms[i].lat, lb) > 0) {
              ep.visible = true;
              break;
            }
          }
        }
      });
      Object.keys(open).forEach(function (k) {
        if (!live[k]) {
          var ep = open[k];
          refine(ep);
          var f = M.fromAbs(Math.floor(ep.peak));
          ep.Y = f.Y; ep.doy = f.doy;
          ep.hours = (ep.end - ep.start) * 24;
          done.push(ep);
          delete open[k];
        }
      });
    }
    return done;
  }

  // Everything crossing in one year, soonest first. What an almanac wants.
  function eventsInYear(Y) {
    return eventsBetween(M.absDay(Y, 1), M.absDay(Y + 1, 1))
      .sort(function (p, q) { return p.peak - q.peak; });
  }

  // Widest the pair ever gets, for scaling a chart against something fixed.
  var WIDEST = 18.5;

  /* 0 at touching, 1 at the widest the suns ever stand. What the almanac's
     ribbon draws, so the curve means the same thing year to year. */
  function sepFraction(Y, doy) {
    return Math.min(1, sunsAt(M.absDay(Y, doy)).sepDeg / WIDEST);
  }

  /* The next year whose Pairing closes to under a sun-width. Those are the
     ones worth putting in an almanac; most years the pair never gets near. */
  function nextClosePairing(Y, doy) {
    var from = M.absDay(Y, doy);
    for (var y = Y; y < Y + 40; y++) {
      var p = pairingOf(y);
      if (p.close && p.t >= from) return p;
    }
    return null;
  }

  window.Orbits = {
    EL: EL, DEG: DEG, WIDEST: WIDEST, setBeta: setBeta,
    sunsAt: sunsAt, pairingOf: pairingOf, nextEclipse: nextEclipse,
    MOONS: MOONS, MOON_EL: MOON_EL, moonsAt: moonsAt,
    OBS: OBS, eclToEq: eclToEq, eqToHor: eqToHor, altOf: altOf, azOf: azOf,
    lstAt: lstAt, altAt: altAt,
    crossingsAt: crossingsAt, between: between,
    eventsBetween: eventsBetween, eventsInYear: eventsInYear,
    sepFraction: sepFraction, nextClosePairing: nextClosePairing,
    toEcl: toEcl
  };
})();
