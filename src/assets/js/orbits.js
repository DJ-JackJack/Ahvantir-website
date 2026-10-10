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
    sepFraction: sepFraction, nextClosePairing: nextClosePairing,
    toEcl: toEcl
  };
})();
