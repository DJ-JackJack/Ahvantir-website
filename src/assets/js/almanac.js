/* almanac.js — the Marducian year, day by day.
 *
 * Ported from the Ahvantir Sky Almanac artifact. Everything is computed from
 * the Foundry calendar's own tables rather than stored: given a day, the moon
 * phases and the sun separation fall out of arithmetic, so any year from 0 to
 * 9999 MC works without a data file.
 *
 * Canon lives in /articles/marducian-calendar/. If the two ever disagree, the
 * article is what a reader is quoting, so fix this to match it.
 *
 * Two things differ from the artifact, both deliberate:
 *   - The palette comes from the site's own tokens, so the page follows the
 *     parchment and dark themes instead of carrying its own.
 *   - The ribbon is keyboard-operable. 386 days cannot each be a tab stop, so
 *     the ribbon is one stop with arrow keys inside it, the same pattern the
 *     relationship graph uses.
 */
(function () {
  'use strict';

  /* ---------- the calendar ---------- */

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
  var PAIR_YEAR = 0, PAIR_PERIOD = 8;   // first recorded Pairing: 0 MC

  function mod(a, b) { return ((a % b) + b) % b; }

  function phaseOf(m, D) {
    var p = mod(D, m.c), i = 0;
    while (p >= m.ph[i]) { p -= m.ph[i]; i++; }
    return { i: i, into: p + 1, len: m.ph[i] };
  }

  // Day 0 is 1 Varenthal, Year 1 — the epoch where Foundry starts all three
  // moons new. Every phase on the page is measured from there.
  function absDay(Y, doy) { return (Y - 1) * YEAR_LEN + (doy - 1); }
  function fromAbs(D) { return { Y: Math.floor(D / YEAR_LEN) + 1, doy: mod(D, YEAR_LEN) + 1 }; }

  function buildYear(Y) {
    var out = [], doy = 0, turn = 0;
    MONTHS.forEach(function (m, mi) {
      for (var d = 1; d <= m.d; d++) {
        doy++;
        var D = absDay(Y, doy);
        out.push({
          Y: Y, doy: doy, mi: mi, d: d, ic: !!m.ic,
          wd: m.ic ? null : turn % 8, D: D,
          ph: MOONS.map(function (mo) { return phaseOf(mo, D); })
        });
        if (!m.ic) turn++;
      }
    });
    return out;
  }

  function dayInfo(Y, doy) {
    var rem = doy, turn = 0;
    for (var mi = 0; mi < MONTHS.length; mi++) {
      var m = MONTHS[mi];
      if (rem <= m.d) return { mi: mi, d: rem, ic: !!m.ic, wd: m.ic ? null : (turn + rem - 1) % 8 };
      rem -= m.d;
      if (!m.ic) turn += m.d;
    }
    return null;
  }

  function fmtLong(Y, doy) {
    var x = dayInfo(Y, doy), m = MONTHS[x.mi];
    return x.ic ? (m.n + ', ' + Y + ' MC') : (WEEK[x.wd] + ', ' + x.d + ' ' + m.n + ' ' + Y + ' MC');
  }
  function fmtShort(Y, doy) {
    var x = dayInfo(Y, doy), m = MONTHS[x.mi];
    return x.ic ? m.n : (x.d + ' ' + m.a);
  }

  /* The suns swing apart and back on an eight-year cycle; |sin| gives one full
     approach-and-separate per period, zero at the Pairing. */
  function sunSep(Y, doy) {
    var t = Y + (doy - 1) / YEAR_LEN - PAIR_YEAR;
    return Math.abs(Math.sin(Math.PI * t / PAIR_PERIOD));
  }
  function nextPairing(Y, doy) {
    var t = Y + (doy - 1) / YEAR_LEN - PAIR_YEAR;
    return PAIR_YEAR + Math.ceil(t / PAIR_PERIOD - 1e-9) * PAIR_PERIOD;
  }

  var fullCount = function (x) { return x.ph.filter(function (p) { return p.i === 4; }).length; };
  var isDark    = function (x) { return x.ph.every(function (p) { return p.i === 0; }); };

  /* ---------- drawing ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // A disc with a lit portion. The terminator is an ellipse whose width tracks
  // the phase angle, which is what makes a crescent bow the right way.
  function moonSVG(k, cssVar, size) {
    var r = 20, c = 22, top = c - r, bot = c + r, lit = '';
    if (k === 4) {
      lit = '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="var(' + cssVar + ')"/>';
    } else if (k !== 0) {
      var wax = k < 4,
          th = (wax ? k : 8 - k) * Math.PI / 4,
          rx = Math.abs(Math.cos(th)) * r,
          gib = th > Math.PI / 2,
          d = wax
            ? 'M' + c + ',' + top + ' A' + r + ',' + r + ' 0 0 1 ' + c + ',' + bot +
              ' A' + rx + ',' + r + ' 0 0 ' + (gib ? 1 : 0) + ' ' + c + ',' + top + 'Z'
            : 'M' + c + ',' + top + ' A' + r + ',' + r + ' 0 0 0 ' + c + ',' + bot +
              ' A' + rx + ',' + r + ' 0 0 ' + (gib ? 0 : 1) + ' ' + c + ',' + top + 'Z';
      lit = '<path d="' + d + '" fill="var(' + cssVar + ')"/>';
    }
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 44 44" aria-hidden="true" focusable="false">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="var(--alm-moon-dark)" stroke="var(--br-mid)" stroke-width="1"/>' +
      lit + '</svg>';
  }

  /* ---------- state ---------- */

  var $ = function (id) { return document.getElementById(id); };
  var page = document.querySelector('.almanac');
  if (!page) return;

  var Y = 439, sel = 1, days = [];
  try {
    var s = JSON.parse(localStorage.getItem('ahv-almanac') || 'null');
    if (s && isFinite(s.Y)) { Y = s.Y; sel = s.sel || 1; }
  } catch (e) { /* private window, blocked storage — defaults are fine */ }
  function save() {
    try { localStorage.setItem('ahv-almanac', JSON.stringify({ Y: Y, sel: sel })); } catch (e) {}
  }

  /* ---------- ribbon ---------- */

  var PX = 3, LEFT = 64, W = LEFT + YEAR_LEN * PX + 8;

  function renderRibbon() {
    var svg = $('alm-ribbon');
    var rowH = 22, gap = 6, y0 = 22;
    var sunY = y0 + 3 * (rowH + gap) + 4, sunH = 30;
    var H = sunY + sunH + 22;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    var s = '', doy = 0;
    MONTHS.forEach(function (m) {
      var x = LEFT + doy * PX;
      if (m.ic) {
        s += '<rect x="' + x + '" y="' + (y0 - 4) + '" width="' + PX + '" height="' + (sunY + sunH - y0 + 8) +
             '" fill="var(--gold-dark)" opacity=".55"/>' +
             '<text class="alm-ribbon__ic" x="' + (x + 1.5) + '" y="' + (H - 6) + '" text-anchor="middle">' + m.a + '</text>';
      } else {
        s += '<line x1="' + x + '" x2="' + x + '" y1="' + (y0 - 14) + '" y2="' + (sunY + sunH + 4) +
             '" stroke="var(--br-light)" stroke-width="1"/>' +
             '<text x="' + (x + 4) + '" y="' + (y0 - 8) + '">' + m.a + '</text>';
      }
      doy += m.d;
    });

    MOONS.forEach(function (mo, k) {
      var y = y0 + k * (rowH + gap);
      s += '<text class="alm-ribbon__row" x="0" y="' + (y + 15) + '">' + mo.n + '</text>';
      days.forEach(function (x) {
        s += '<rect x="' + (LEFT + (x.doy - 1) * PX) + '" y="' + y + '" width="' + PX + '" height="' + rowH +
             '" fill="var(--moon-' + mo.key + ')" fill-opacity="' + Math.max(ILL[x.ph[k].i], 0.06) + '"/>';
      });
    });

    days.forEach(function (x) {
      var fc = fullCount(x), xx = LEFT + (x.doy - 1) * PX;
      if (fc === 3) s += '<rect x="' + xx + '" y="' + (y0 - 3) + '" width="' + PX + '" height="3" fill="var(--gold-dark)"/>';
      else if (fc === 2) s += '<rect x="' + xx + '" y="' + (y0 - 3) + '" width="' + PX + '" height="3" fill="var(--teal-dark)"/>';
      if (isDark(x)) s += '<rect x="' + xx + '" y="' + (y0 + 3 * (rowH + gap) - gap + 1) + '" width="' + PX + '" height="3" fill="var(--ink-ghost)"/>';
    });

    s += '<text class="alm-ribbon__row" x="0" y="' + (sunY + 19) + '">Suns</text>';
    var pts = LEFT + ',' + (sunY + sunH) + ' ';
    days.forEach(function (x) {
      pts += (LEFT + (x.doy - 0.5) * PX) + ',' + (sunY + sunH - sunSep(Y, x.doy) * sunH).toFixed(1) + ' ';
    });
    pts += (LEFT + YEAR_LEN * PX) + ',' + (sunY + sunH);
    s += '<defs><linearGradient id="alm-sg" x1="0" x2="0" y1="0" y2="1">' +
         '<stop offset="0" stop-color="var(--teal-dark)" stop-opacity=".9"/>' +
         '<stop offset="1" stop-color="var(--gold-dark)" stop-opacity=".35"/></linearGradient></defs>' +
         '<rect x="' + LEFT + '" y="' + sunY + '" width="' + (YEAR_LEN * PX) + '" height="' + sunH + '" fill="var(--p-300)"/>' +
         '<polygon points="' + pts + '" fill="url(#alm-sg)"/>' +
         '<text x="' + (LEFT + YEAR_LEN * PX) + '" y="' + (sunY - 3) + '" text-anchor="end">widest ↑</text>' +
         '<rect id="alm-selmark" x="' + (LEFT + (sel - 1) * PX - 1) + '" y="' + (y0 - 6) + '" width="' + (PX + 2) +
         '" height="' + (sunY + sunH - y0 + 10) + '" fill="none" stroke="var(--ink)" stroke-width="1.5"/>';
    svg.innerHTML = s;
  }

  /* ---------- day readout ---------- */

  function nextFull(m, D) {
    if (phaseOf(m, D).i === 4) return 0;
    for (var k = 1; k <= m.c; k++) if (phaseOf(m, D + k).i === 4) return k;
    return null;
  }

  function renderDay() {
    var x = days[sel - 1];
    $('alm-day-head').textContent = fmtLong(Y, sel);
    $('alm-day-sub').textContent = 'Day ' + sel + ' of ' + YEAR_LEN +
      (x.ic ? ' · outside the Turn' : ' · ' + WEEK[x.wd] + ' is day ' + (x.wd + 1) + ' of the Turn');

    var fc = fullCount(x);
    var eyebrow = fc === 3 ? 'All three moons full'
                : fc === 2 ? 'Two moons full'
                : isDark(x) ? 'All three moons new'
                : 'Selected day';
    $('alm-day-eyebrow').textContent = eyebrow;

    $('alm-moons').innerHTML = MOONS.map(function (mo, k) {
      var p = x.ph[k], nf = nextFull(mo, x.D);
      return '<div class="alm-moonrow">' +
        moonSVG(p.i, '--moon-' + mo.key, 44) +
        '<div><div class="alm-moonrow__name" data-moon="' + mo.key + '">' + mo.n + '</div>' +
        '<div class="alm-moonrow__ph">' + PH[p.i] + ' <span class="alm-muted">· ' + mo.dom + '</span></div></div>' +
        '<div class="alm-moonrow__meta">day ' + p.into + ' of ' + p.len + '<br>' +
        (nf === 0 ? 'full now' : 'full in ' + nf + ' d') + '</div></div>';
    }).join('');

    var sep = sunSep(Y, sel);
    var prevSep = sel === 1 ? sunSep(Y - 1, YEAR_LEN) : sunSep(Y, sel - 1);
    $('alm-sepfill').style.width = (sep * 100).toFixed(1) + '%';
    var np = nextPairing(Y, sel);
    var state = sep < 0.1 ? 'The suns are in the Pairing, less than a sun-width apart.'
              : (sep - prevSep < 0 ? 'The suns are drawing together.' : 'The suns are drawing apart.');
    var away = np - (Y + (sel - 1) / YEAR_LEN);
    $('alm-suntext').innerHTML = esc(state) + ' Separation is <span class="alm-mono">' +
      Math.round(sep * 100) + '%</span> of the widest.' +
      (sep < 0.1 ? '' : ' Next Pairing peaks in <span class="alm-mono">' + esc(fmtYearNum(np)) +
        ' MC</span>, about <span class="alm-mono">' + away.toFixed(1) + '</span> years away.');

    var old = page.querySelector('.alm-cell.is-sel, .alm-inter.is-sel');
    if (old) { old.classList.remove('is-sel'); old.removeAttribute('aria-current'); }
    var cur = page.querySelector('[data-doy="' + sel + '"]');
    if (cur) { cur.classList.add('is-sel'); cur.setAttribute('aria-current', 'date'); }
    var mk = $('alm-selmark');
    if (mk) mk.setAttribute('x', LEFT + (sel - 1) * PX - 1);

    // Announce for screen readers: the ribbon is a single control, so moving
    // within it changes nothing a reader would otherwise be told about.
    $('alm-status').textContent = fmtLong(Y, sel) + '. ' + (eyebrow === 'Selected day' ? '' : eyebrow + '. ') +
      MOONS.map(function (mo, k) { return mo.n + ' ' + PH[x.ph[k].i]; }).join(', ') + '.';
  }
  function fmtYearNum(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }

  /* ---------- notable skies ---------- */

  function renderEvents() {
    var runs = [], cur = null;
    days.forEach(function (x) {
      var fc = fullCount(x);
      if (fc >= 2) {
        if (!cur) cur = { s: x.doy, e: x.doy, max: fc, set: {} };
        cur.e = x.doy;
        cur.max = Math.max(cur.max, fc);
        x.ph.forEach(function (p, k) { if (p.i === 4) cur.set[k] = true; });
      } else if (cur) { runs.push(cur); cur = null; }
    });
    if (cur) runs.push(cur);

    var darks = []; cur = null;
    days.forEach(function (x) {
      if (isDark(x)) { if (!cur) cur = { s: x.doy, e: x.doy }; cur.e = x.doy; }
      else if (cur) { darks.push(cur); cur = null; }
    });
    if (cur) darks.push(cur);

    var fulls = MOONS.map(function (mo, k) {
      return days.filter(function (x) { return x.ph[k].i === 4 && phaseOf(mo, x.D - 1).i !== 4; });
    });

    // The three cycles share no small common factor, so a threefold full is
    // rare: LCM(24,43,66) = 11,352 days. Search forward rather than assume one
    // falls in this year.
    var next3 = null, D0 = absDay(Y, 1);
    for (var D = D0; D < D0 + 11352 + YEAR_LEN; D++) {
      if (MOONS.every(function (m) { return phaseOf(m, D).i === 4; })) { next3 = D; break; }
    }
    var next3Html = '';
    if (next3 !== null) {
      var f = fromAbs(next3);
      next3Html = '<div class="alm-callout"><p class="alm-eyebrow">Threefold full</p><p>' +
        (f.Y === Y ? 'This year: ' : 'Next: ') +
        '<button type="button" class="alm-chip alm-chip--three" data-y="' + f.Y + '" data-d="' + f.doy + '">' +
        esc(fmtLong(f.Y, f.doy)) + '</button>' +
        (f.Y === Y ? '' : ' <span class="alm-muted">· ' + (f.Y - Y) + ' years on</span>') +
        '</p><p class="alm-note">The three moons return to the same phases together every 11,352 days, about 29.4 years.</p></div>';
    }

    function chip(doy, cls, inner) {
      return '<button type="button" class="alm-chip ' + (cls || '') + '" data-y="' + Y + '" data-d="' + doy + '">' +
        (inner || esc(fmtShort(Y, doy))) + '</button>';
    }
    function runLabel(r) {
      return r.s === r.e ? esc(fmtShort(Y, r.s)) : esc(fmtShort(Y, r.s)) + '–' + esc(fmtShort(Y, r.e));
    }
    function dotsFor(set) {
      return Object.keys(set).sort().map(function (k) {
        return '<span class="alm-k" data-moon="' + MOONS[k].key + '"></span>';
      }).join('');
    }

    var pairNow = days.some(function (x) { return sunSep(Y, x.doy) < 0.1; });

    $('alm-events').innerHTML =
      '<h2 class="sr-only">Notable skies this year</h2>' +
      '<div class="alm-evgroup"><p class="alm-eyebrow">Notable skies</p><h3>' + Y + ' MC</h3>' +
        (pairNow ? '<div class="alm-callout"><p class="alm-eyebrow">The Pairing</p><p>Solara and Nystara come within a sun-width of each other this year.</p></div>' : '') +
        next3Html +
      '</div>' +
      '<div class="alm-evgroup"><h3>Convergences <span class="alm-mono alm-muted">' + runs.length + '</span></h3>' +
        '<p class="alm-note">Spans when two or three moons share the Full phase.</p>' +
        '<div class="alm-chips">' + (runs.map(function (r) {
          return chip(r.s, r.max === 3 ? 'alm-chip--three' : '', dotsFor(r.set) + ' ' + runLabel(r));
        }).join('') || '<span class="alm-muted">None this year.</span>') + '</div></div>' +
      '<div class="alm-evgroup"><h3>Dark skies <span class="alm-mono alm-muted">' + darks.length + '</span></h3>' +
        '<p class="alm-note">Spans when all three moons are new and only starlight remains.</p>' +
        '<div class="alm-chips">' + (darks.map(function (r) { return chip(r.s, '', runLabel(r)); }).join('') ||
          '<span class="alm-muted">None this year.</span>') + '</div></div>' +
      '<div class="alm-evgroup"><h3>Full moons</h3>' +
        MOONS.map(function (mo, k) {
          return '<div class="alm-fullrow"><span class="alm-fullrow__nm" data-moon="' + mo.key + '">' + mo.n + '</span>' +
            '<div class="alm-chips">' + fulls[k].map(function (x) { return chip(x.doy); }).join('') + '</div></div>';
        }).join('') +
      '</div>' +
      '<div class="alm-evgroup"><h3>Days outside the Turn</h3><div class="alm-chips">' +
        days.filter(function (x) { return x.ic; }).map(function (x) {
          return chip(x.doy, '', esc(MONTHS[x.mi].n) + ' · day ' + x.doy);
        }).join('') + '</div></div>';
  }

  /* ---------- month grids ---------- */

  function renderMonths() {
    var html = '';
    MONTHS.forEach(function (m, mi) {
      var md = days.filter(function (x) { return x.mi === mi; });

      if (m.ic) {
        var xi = md[0];
        html += '<button type="button" class="alm-inter" data-doy="' + xi.doy + '">' +
          '<span class="alm-inter__t"><span class="alm-eyebrow">Day ' + xi.doy + ' · outside the Turn</span>' +
          '<span class="alm-inter__name">' + esc(m.n) + '</span>' +
          '<span class="alm-muted">' + esc(m.desc) + '</span></span>' +
          '<span class="alm-inter__ms">' + MOONS.map(function (mo, k) {
            return '<span class="alm-inter__m">' + moonSVG(xi.ph[k].i, '--moon-' + mo.key, 22) +
              esc(mo.n) + ' ' + PH[xi.ph[k].i] + '</span>';
          }).join('') + '</span></button>';
        return;
      }

      var lead = md[0].wd;
      var cells = WABBR.map(function (w) { return '<div class="alm-wd">' + w + '</div>'; }).join('');
      for (var i = 0; i < lead; i++) cells += '<div class="alm-blank"></div>';

      md.forEach(function (x) {
        var fc = fullCount(x);
        var cls = fc === 3 ? 'is-three' : fc === 2 ? 'is-two' : isDark(x) ? 'is-dark' : '';
        var label = fmtLong(Y, x.doy) + '. ' + MOONS.map(function (mo, k) {
          return mo.n + ' ' + PH[x.ph[k].i];
        }).join(', ');
        cells += '<button type="button" class="alm-cell ' + cls + '" data-doy="' + x.doy +
          '" aria-label="' + esc(label) + '"><span class="alm-cell__n">' + x.d + '</span>' +
          '<span class="alm-cell__dots">' + MOONS.map(function (mo, k) {
            return '<b data-moon="' + mo.key + '" style="opacity:' + Math.max(ILL[x.ph[k].i], 0.15) + '"></b>';
          }).join('') + '</span></button>';
      });

      // Display number skips the two intercalary entries, so the months read 1-9.
      var num = mi < 4 ? mi + 1 : mi < 9 ? mi : mi - 1;
      html += '<article class="alm-month"><header class="alm-month__head">' +
        '<div class="alm-month__row"><h3>' + esc(m.n) + '</h3>' +
        '<span class="alm-mono alm-muted">' + num + ' · ' + m.d + ' days</span></div>' +
        '<p class="alm-month__desc">' + esc(m.desc) + '</p></header>' +
        '<div class="alm-grid8">' + cells + '</div></article>';
    });
    $('alm-months').innerHTML = html;
    $('alm-months-head').textContent = 'The Months of ' + Y + ' MC';
  }

  /* ---------- wiring ---------- */

  function select(d) { sel = d; renderDay(); save(); }

  function step(n) {
    var d = sel + n;
    if (d < 1) { setYear(Y - 1, YEAR_LEN); return; }
    if (d > YEAR_LEN) { setYear(Y + 1, 1); return; }
    select(d);
  }

  function setYear(y, d) {
    y = Math.round(y);
    Y = Math.max(0, Math.min(9999, isFinite(y) ? y : 0));
    if (d) sel = d;
    if (sel > YEAR_LEN) sel = YEAR_LEN;
    $('alm-year').value = Y;
    days = buildYear(Y);
    renderRibbon();
    renderEvents();
    renderMonths();
    renderDay();
    save();
  }

  $('alm-ribbon').addEventListener('click', function (e) {
    var r = e.currentTarget.getBoundingClientRect();
    var d = Math.floor(((e.clientX - r.left) / r.width * W - LEFT) / PX) + 1;
    if (d >= 1 && d <= YEAR_LEN) select(d);
  });

  $('alm-ribbon').addEventListener('keydown', function (e) {
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); step(1); break;
      case 'ArrowLeft':  case 'ArrowUp':   e.preventDefault(); step(-1); break;
      case 'Home':       e.preventDefault(); select(1); break;
      case 'End':        e.preventDefault(); select(YEAR_LEN); break;
      case 'PageUp':     e.preventDefault(); step(-8); break;   // a Turn at a time
      case 'PageDown':   e.preventDefault(); step(8); break;
      default: break;
    }
  });

  // One delegated handler for every day button and chip on the page.
  page.addEventListener('click', function (e) {
    var b = e.target.closest('[data-doy], [data-d]');
    if (!b || !page.contains(b)) return;
    if (b.hasAttribute('data-doy')) { select(+b.getAttribute('data-doy')); return; }
    var y = +b.getAttribute('data-y'), d = +b.getAttribute('data-d');
    if (y !== Y) setYear(y, d); else select(d);
  });

  $('alm-prev-year').addEventListener('click', function () { setYear(Y - 1); });
  $('alm-next-year').addEventListener('click', function () { setYear(Y + 1); });
  $('alm-year').addEventListener('change', function (e) { setYear(+e.target.value); });
  $('alm-prev-day').addEventListener('click', function () { step(-1); });
  $('alm-next-day').addEventListener('click', function () { step(1); });

  setYear(Y, sel);
})();
