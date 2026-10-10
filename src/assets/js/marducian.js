/* marducian.js — the Marducian calendar, shared.
 *
 * Extracted from almanac.js when the sky projection at /almanac/sky/ needed the
 * same tables. Two copies of MONTHS and MOONS is exactly the failure this world
 * has been audited for: nothing breaks loudly when they drift, the two pages
 * just quietly disagree about what day it is.
 *
 * This file is CANON ONLY. Month lengths, weekday names, moon cycles and the
 * Foundry phase tables all come from /articles/marducian-calendar/, and if the
 * two ever disagree the article wins, because the article is what a reader is
 * quoting. Anything invented for the sake of drawing a picture — disc sizes,
 * orbital inclinations, the observer's latitude — lives in sky.js, labelled as
 * a working assumption. Keeping the line here means the model can be retuned
 * without anyone wondering whether they just edited canon.
 *
 * Classic script exposing a global, matching map-coords.js. Tested by
 * scripts/test-marducian.js, which evals this file in node.
 */
(function () {
  'use strict';

  // Intercalary days are modelled as one-day "months" (ic: true) so that a day
  // number maps to a position without a separate special case everywhere.
  var MONTHS = [
    { n: 'Varenthal',  a: 'Var', d: 43, desc: 'Thawing and early growth as winter retreats.' },
    { n: 'Ossandrel',  a: 'Oss', d: 43, desc: 'Rain and renewal, when seeds are sown and rivers swell.' },
    { n: 'Thirivale',  a: 'Thi', d: 43, desc: 'Full spring when blossoms peak and life is at its most vibrant.' },
    { n: 'Cindralis',  a: 'Cin', d: 43, desc: 'Heat and storms as the suns blaze high and passions flare.' },
    { n: 'Cindrafel',  a: 'Cfl', d: 1, ic: true, desc: "The burning's end. The blaze of Cindralis breaks and the harvest begins." },
    { n: 'Embrathen',  a: 'Emb', d: 42, desc: 'Harvest begins and warmth mellows into golden days.' },
    { n: 'Lochenvir',  a: 'Loc', d: 42, desc: 'Cooling winds and fading leaves mark the onset of autumn.' },
    { n: 'Draelthorn', a: 'Dra', d: 43, desc: 'Frost returns and stillness settles over the land.' },
    { n: 'Myrnselt',   a: 'Myr', d: 43, desc: 'Deep winter and the longest nights, when dreams and memory dominate.' },
    { n: 'Noctharis',  a: 'Noc', d: 1, ic: true, desc: "The night's keeping. A vigil of remembrance through the longest dark." },
    { n: 'Keltharyn',  a: 'Kel', d: 42, desc: 'Dormant season when the soil rests and seeds lie in wait.' }
  ];
  var WEEK  = ['Solkir', 'Nyskir', 'Mirakir', 'Torkir', 'Kelkir', 'Orkir', 'Veskir', 'Alkir'];
  var WABBR = ['Sol', 'Nys', 'Mir', 'Tor', 'Kel', 'Ork', 'Ves', 'Alk'];

  // ph: how many days each phase lasts, in PH order. They are uneven because a
  // cycle rarely divides by eight; Foundry's tables decide where the remainder
  // goes and this copies them exactly.
  var MOONS = [
    { n: 'Miras',  c: 24, ph: [3, 3, 3, 3, 3, 3, 3, 3],  key: 'miras',  dom: 'change and emotional tides' },
    { n: 'Toris',  c: 43, ph: [6, 5, 6, 5, 6, 5, 6, 4],  key: 'toris',  dom: 'labour and growth' },
    { n: 'Keltas', c: 66, ph: [8, 8, 8, 8, 8, 8, 8, 10], key: 'keltas', dom: 'dreams, prophecy and death' }
  ];
  var PH  = ['New', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
             'Full', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  var ILL = [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25];
  var YEAR_LEN = 386;
  var TURN_LEN = 8;

  function mod(a, b) { return ((a % b) + b) % b; }

  function phaseOf(m, D) {
    var p = mod(D, m.c), i = 0;
    while (p >= m.ph[i]) { p -= m.ph[i]; i++; }
    return { i: i, into: p + 1, len: m.ph[i] };
  }

  // Day 0 is 1 Varenthal, Year 1 — the epoch where Foundry starts all three
  // moons new. Every phase on either page is measured from there.
  function absDay(Y, doy) { return (Y - 1) * YEAR_LEN + (doy - 1); }
  function fromAbs(D) { return { Y: Math.floor(D / YEAR_LEN) + 1, doy: mod(D, YEAR_LEN) + 1 }; }

  // Day-of-year for a month index and a day within it. mi is 0-based over
  // MONTHS, so the intercalary days are addressable like any other.
  function doyOf(mi, d) {
    var s = 0;
    for (var i = 0; i < mi; i++) s += MONTHS[i].d;
    return s + d;
  }

  function dayInfo(Y, doy) {
    var rem = doy, turn = 0;
    for (var mi = 0; mi < MONTHS.length; mi++) {
      var m = MONTHS[mi];
      if (rem <= m.d) return { mi: mi, d: rem, ic: !!m.ic, wd: m.ic ? null : (turn + rem - 1) % TURN_LEN };
      rem -= m.d;
      if (!m.ic) turn += m.d;
    }
    return null;
  }

  function buildYear(Y) {
    var out = [], doy = 0, turn = 0;
    MONTHS.forEach(function (m, mi) {
      for (var d = 1; d <= m.d; d++) {
        doy++;
        var D = absDay(Y, doy);
        out.push({
          Y: Y, doy: doy, mi: mi, d: d, ic: !!m.ic,
          wd: m.ic ? null : turn % TURN_LEN, D: D,
          ph: MOONS.map(function (mo) { return phaseOf(mo, D); })
        });
        if (!m.ic) turn++;
      }
    });
    return out;
  }

  function fmtLong(Y, doy) {
    var x = dayInfo(Y, doy), m = MONTHS[x.mi];
    return x.ic ? (m.n + ', ' + Y + ' MC') : (WEEK[x.wd] + ', ' + x.d + ' ' + m.n + ' ' + Y + ' MC');
  }
  function fmtShort(Y, doy) {
    var x = dayInfo(Y, doy), m = MONTHS[x.mi];
    return x.ic ? m.n : (x.d + ' ' + m.a);
  }

  /* The suns used to be placed here by a sine with an eight-year period. That
     model is retired: it could never let the two discs touch, and on 2026-10-10
     Krys ruled that they do converge. Where the suns actually are now comes out
     of orbits.js, which solves the real circumbinary geometry. This file stays
     what it says it is — the calendar. */

  function fullCount(x) { return x.ph.filter(function (p) { return p.i === 4; }).length; }
  function isDark(x) { return x.ph.every(function (p) { return p.i === 0; }); }

  // Clamp a (year, day-of-year) pair into range, rolling over year boundaries.
  // Both pages step by a day from the ends of a year, so this lives here.
  function normalise(Y, doy) {
    while (doy < 1) { Y--; doy += YEAR_LEN; }
    while (doy > YEAR_LEN) { Y++; doy -= YEAR_LEN; }
    return { Y: Y, doy: doy };
  }

  window.Marducian = {
    MONTHS: MONTHS, WEEK: WEEK, WABBR: WABBR, MOONS: MOONS, PH: PH, ILL: ILL,
    YEAR_LEN: YEAR_LEN, TURN_LEN: TURN_LEN,
    mod: mod, phaseOf: phaseOf, absDay: absDay, fromAbs: fromAbs,
    doyOf: doyOf, dayInfo: dayInfo, buildYear: buildYear,
    fmtLong: fmtLong, fmtShort: fmtShort,
    fullCount: fullCount, isDark: isDark, normalise: normalise
  };
})();
