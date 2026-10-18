/* Checks the circumbinary model behind /almanac/ and /almanac/sky/.
 *
 * These are not arbitrary numbers to lock in. Each one is a property the sky is
 * supposed to have, and each would be easy to break by nudging an element:
 *
 *   - the suns reach about 18.5 degrees apart, which is what gives the Pale
 *     Hour its "nearly two hours" maximum;
 *   - they close once a YEAR, not once a decade, because the planet carries the
 *     observer around them in that time;
 *   - how close each Pairing gets rides a rhythm of about eight years, which is
 *     the cycle the calendar's era is counted in;
 *   - 0 MC is a deep Pairing, so the era still means what the article says;
 *   - eclipses happen, but stay rare.
 *
 * The last one is the whole reason this file exists. The binary period is
 * deliberately not a whole number of years: at exactly sixteen, conjunction
 * locks to the planet's plane crossing and EVERY Pairing becomes a perfect
 * eclipse. That regression is silent in the drawing and obvious here.
 *
 * Run: node scripts/test-orbits.js   (or npm test)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const JS = (f) => path.join(ROOT, 'src/assets/js', f);

global.window = {};
eval(fs.readFileSync(JS('marducian.js'), 'utf8'));
eval(fs.readFileSync(JS('orbits.js'), 'utf8'));
const M = global.window.Marducian;
const O = global.window.Orbits;

let pass = 0;
const fails = [];
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ok    ' + label); }
  else { fails.push(label + (detail ? '  — ' + detail : '')); console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}

console.log('\nThe pair as seen from the ground');
let lo = 99, hi = 0;
for (let d = M.absDay(430, 1); d < M.absDay(460, 1); d += 1) {
  const s = O.sunsAt(d);
  lo = Math.min(lo, s.sepDeg); hi = Math.max(hi, s.sepDeg);
}
ok('they never stand more than about 18.5° apart', hi > 18 && hi < 19, hi.toFixed(2) + '°');
ok('and they do come together', lo < 0.5, 'closest in 30 yr: ' + lo.toFixed(2) + '°');

console.log('\nThe Pairing is annual');
let annual = true, worst = null;
for (let Y = 430; Y <= 460; Y++) {
  const p = O.pairingOf(Y);
  if (p.Y !== Y) { annual = false; worst = Y; }
}
ok('every year has exactly one closest approach', annual, worst ? 'year ' + worst + ' did not' : '');
// Within one year the gap must both open wide and close, or it is not a cycle.
const seps = [];
for (let d = M.absDay(439, 1); d < M.absDay(440, 1); d++) seps.push(O.sunsAt(d).sepDeg);
ok('and the gap opens and closes inside a single year',
   Math.max(...seps) - Math.min(...seps) > 5,
   `439 MC ran ${Math.min(...seps).toFixed(1)}° to ${Math.max(...seps).toFixed(1)}°`);

console.log('\nDepth rides the eight-year rhythm');
const depths = [];
for (let Y = 420; Y <= 480; Y++) depths.push({ Y, d: O.pairingOf(Y).sepDeg });
/* Two tiers, and they are different things. A DEEP Pairing (inside a couple of
   degrees) is the eight-yearly beat the era counts. A CLOSE one (inside a
   sun-width) is rarer still, and is roughly when an eclipse becomes possible. */
const deepYears = depths.filter(x => x.d < 2).map(x => x.Y);
const gaps = deepYears.slice(1).map((y, i) => y - deepYears[i]).filter(g => g > 1);
ok('deep Pairings come round every eight years or so',
   gaps.length > 0 && gaps.every(g => g >= 6 && g <= 10), 'gaps: ' + gaps.join(', '));
const close = depths.filter(x => x.d < 0.9).map(x => x.Y);
ok('and a sun-width Pairing is rarer than that',
   close.length > 0 && close.length < deepYears.length, 'close years: ' + close.join(', '));

console.log('\nThe era still means something');
const p0 = O.pairingOf(0);
ok('0 MC holds a deep Pairing', p0.sepDeg < 0.9, p0.sepDeg.toFixed(3) + '°');

console.log('\nEclipses: real, but rare');
const first = O.nextEclipse(M.absDay(439, 1), 60);
ok('one happens within the next 60 years', !!first,
   first ? `${M.fmtLong(first.Y, first.doy)}, ${first.total ? 'total' : 'partial'}` : 'none found');
if (first) {
  ok('it lasts hours to days, not an instant', first.hours > 1 && first.hours < 400, first.hours.toFixed(0) + ' h');
  ok('one sun is named as the nearer', first.front === 'Solara' || first.front === 'Nystara', first.front);
}
// Count them over a long span.
let t = M.absDay(400, 1), n = 0, lastT = t;
const SPAN = 200;
while (true) {
  const e = O.nextEclipse(t, 400);
  if (!e || e.Y > 400 + SPAN) break;
  n++; t = e.end + 1; lastT = t;
}
const per = n ? SPAN / n : Infinity;
ok('they stay rare — between one a decade and one a lifetime',
   per >= 8 && per <= 60, `${n} in ${SPAN} yr, one every ${per.toFixed(0)} yr`);

console.log('\nThe resonance guard');
/* If the binary period is a whole number of years, conjunction and the planet's
   plane crossing lock together and every Pairing becomes a flawless eclipse.
   That is the failure this element was chosen to avoid, so prove it still can. */
ok('the binary period is not a whole number of years',
   Math.abs(O.EL.P_BIN - Math.round(O.EL.P_BIN)) > 0.05, O.EL.P_BIN + ' yr');
const deep = depths.filter(x => x.d < 0.2).length;
ok('not every Pairing is a deep one', deep < depths.length / 4,
   `${deep} of ${depths.length} years closed inside 0.2°`);

console.log('\nThe tilt is the dial');
const before = O.EL.BETA;
O.setBeta(5);
let n5 = 0, t5 = M.absDay(400, 1);
while (true) { const e = O.nextEclipse(t5, 100); if (!e || e.Y > 440) break; n5++; t5 = e.end + 1; }
O.setBeta(before / O.DEG);
ok('a shallower orbit gives more eclipses', n5 > n, `${n5} in 40 yr at 5°, against ${n} in ${SPAN} yr at 45°`);
ok('and the tilt is restored afterwards', Math.abs(O.EL.BETA - before) < 1e-9);

console.log('\nThe moons');
ok('three moons, matching the calendar', O.MOONS.length === 3);
ok('each carries a tilt, a disc and a turning line of nodes',
   O.MOONS.every(m => m.inc > 0 && m.rho > 0 && m.nodeP > 0));

/* Only Miras is wider than Solara, and only barely. That margin is the whole
   reason a total eclipse of the warm sun happens twice a century instead of
   every few years, so it is worth a guard: widening Miras by a tenth of a
   degree would quietly turn the rarest event in the sky into a regular one. */
const miras = O.MOONS.filter(m => m.n === 'Miras')[0];
const rSol = O.EL.R_SOL * O.DEG, rNys = O.EL.R_NYS * O.DEG;
ok('Miras is the only moon that can cover Solara at all',
   miras.rho > rSol && O.MOONS.filter(m => m.rho > rSol).length === 1);
ok('and it clears Solara only barely', (miras.rho - rSol) / O.DEG < 0.05,
   ((miras.rho - rSol) / O.DEG).toFixed(3) + ' deg of margin');
ok('every moon can cover Nystara, the smaller disc',
   O.MOONS.every(m => m.rho > rNys));
ok('the moons run near to far in cycle order, so the nearer passes in front',
   O.MOONS[0].depth === 0 && O.MOONS[1].depth === 1 && O.MOONS[2].depth === 2);

console.log('\nCrossings');
const yr = O.eventsInYear(439);
ok('a year has crossings in it', yr.length > 0, yr.length + ' in 439 MC');
ok('each lasts a real stretch of time, not one sample',
   yr.every(e => e.hours > 0 && e.hours < 48),
   'longest ' + Math.max.apply(null, yr.map(e => e.hours)).toFixed(1) + ' h');
ok('each names two different bodies', yr.every(e => e.a && e.b && e.a !== e.b));
ok('each is dated in the year asked for', yr.every(e => e.Y === 439));

/* The finder scans every half hour and then re-walks each hit by the minute.
   Without that refinement a crossing shorter than the scan step reports a
   duration of zero and the almanac prints nonsense, which is how this was
   found. A duration that is not a multiple of thirty minutes proves the
   refinement still runs. */
const offGrid = yr.some(e => Math.abs((e.hours * 2) - Math.round(e.hours * 2)) > 0.02);
ok('and durations are refined below the scan step', offGrid,
   yr.map(e => (e.hours * 60).toFixed(0) + 'm').join(' '));

console.log('\nThe frozen sky');
global.window.BrightStars = undefined;
eval(fs.readFileSync(JS('stars-bright.js'), 'utf8'));
const STARS = global.window.BrightStars;
ok('the bright layer is a catalogue we can edit', Array.isArray(STARS) && STARS.length >= 150,
   STARS ? STARS.length + ' stars, ' + STARS.filter(s => s.o === 'placed').length + ' of them placed by hand' : 'missing');
ok('every star has an id, a place and a brightness',
   STARS.every(s => /^s\d{3}$/.test(s.id) && isFinite(s.ra) && isFinite(s.dec) && s.b > 0));
ok('ids are unique', new Set(STARS.map(s => s.id)).size === STARS.length);
/* The ids were handed out by brightness rank when the catalogue was seeded,
   so s001 was the brightest star in the sky. That ordering cannot survive
   hand-placed stars, and the fix is NOT to renumber: constellations point at
   these ids, and renumbering would move every figure at once. So an id is a
   stable label and nothing more, and the invariant that matters is that one
   is never reused or recycled. */
ok('ids are well formed', STARS.every(s => /^s\d{3}$/.test(s.id)));
ok('and none is reused', new Set(STARS.map(s => s.id)).size === STARS.length);

/* This used to re-run the generator and demand the file match it exactly.
   That guard belongs to a FINISHED sky. While the constellations are being
   invented the catalogue is deliberately editable — a star may be moved to
   make a figure read, or added where a shape needs a point — so the check is
   now that the catalogue hangs together, not that it has never changed.

   When the figures are done, this is where the lock goes back: pin the file by
   checksum so nothing can move a star under a constellation by accident. */
ok('positions are sane', STARS.every(s => s.ra >= 0 && s.ra < 360 && s.dec > -90 && s.dec < 90));
ok('brightnesses are in range', STARS.every(s => s.b > 0 && s.b <= 1));
ok('tints are real', STARS.every(s => Number.isInteger(s.c) && s.c >= 0 && s.c <= 5));
ok('every star records whether it was seeded or placed',
   STARS.every(s => s.o === 'seed' || s.o === 'placed'),
   STARS.filter(s => s.o === 'placed').length + ' placed by hand so far');
// Two stars in the same spot would draw as one and make a figure look broken.
const tooClose = [];
for (let i = 0; i < STARS.length; i++) {
  for (let j = i + 1; j < STARS.length; j++) {
    const dd = STARS[i].dec - STARS[j].dec;
    let dr = Math.abs(STARS[i].ra - STARS[j].ra); if (dr > 180) dr = 360 - dr;
    dr *= Math.cos(STARS[i].dec * Math.PI / 180);
    if (Math.hypot(dr, dd) < 0.35) tooClose.push(STARS[i].id + '/' + STARS[j].id);
  }
}
ok('no two bright stars sit on top of each other', tooClose.length === 0, tooClose.join(' '));

console.log('\nThe figures');
global.window.Constellations = undefined;
eval(fs.readFileSync(JS('constellations.js'), 'utf8'));
const FIGS = global.window.Constellations;
ok('there is at least one figure', FIGS.length > 0, FIGS.map(f => f.name).join(', '));
const ids = new Set(STARS.map(s => s.id));
FIGS.forEach(f => {
  ok(f.name + ': every star it names exists', f.stars.every(id => ids.has(id)),
     f.stars.filter(id => !ids.has(id)).join(', ') || '');
  ok(f.name + ': every line joins two of its own stars',
     f.lines.every(l => l.length === 2 && f.stars.indexOf(l[0]) >= 0 && f.stars.indexOf(l[1]) >= 0));
  ok(f.name + ': the lines connect the whole figure', (function () {
    // no star left stranded off the shape
    const seen = {};
    f.lines.forEach(l => { seen[l[0]] = 1; seen[l[1]] = 1; });
    return f.stars.every(id => seen[id]);
  })());
  /* Names, when a figure has them, are Krys's and are never invented to satisfy
     a test. What IS checked is that a chain is well formed and ordered oldest
     first, that every tradition is one of the three, and that a provisional
     figure has no article pointing nowhere. */
  const names = f.names || [];
  if (names.length) {
    ok(f.name + ': names are well formed', names.length >= 2 &&
       names.every(n => n && typeof n.name === 'string' && n.name &&
                        ['Spirit', "Drorn'Duur", "Aru'Mas"].indexOf(n.tradition) >= 0),
       names.map(n => n.name).join(' -> '));
    ok(f.name + ': names run oldest tradition first',
       names.map(n => ['Spirit', "Drorn'Duur", "Aru'Mas"].indexOf(n.tradition))
            .every((v, i, a) => i === 0 || v > a[i - 1]),
       names.map(n => n.tradition).join(' -> '));
    /* Drift is evidence, so it must be legible: either every layer kept the
       same name or every layer changed it. A chain where two match and one
       does not is almost always a half-finished edit rather than a ruling. */
    const distinct = new Set(names.map(n => n.name.toLowerCase())).size;
    ok(f.name + ': drift is all-or-nothing', distinct === 1 || distinct === names.length,
       distinct === 1 ? 'held across every tradition' : 'renamed at every layer');
  }
  if (f.provisional) {
    ok(f.name + ': declares itself provisional', f.provisional === true, 'no article yet');
    ok(f.name + ': does not point at an article it has not got', !f.article);
  } else {
    /* A finished figure needs an article. It does NOT need a name chain.
       This check used to demand two names of anything not provisional, which
       encoded the premise Krys overturned on 2026-10-17: that a chain is
       always there to be had. Most are not. Some figures were taken from the
       spirit myth directly and never moved; for others the Drorn'Duur reading
       was buried with the Drorn'Duur, on purpose, by a city that wanted a
       different founding story. One name is a finished figure.

       The shape of a chain is still guarded above, for the figures that have
       one. What is not guarded, and must not be, is its existence. */
    ok(f.name + ': points at an article', /^\/articles\/[a-z0-9-]+\/$/.test(f.article), f.article);
    ok(f.name + ': any names it does carry are a real chain',
       names.length === 0 || names.length >= 2,
       names.length ? names.map(n => n.name).join(' -> ') : 'one name, which is finished');
  }
});

console.log('\nThe thirteen signs');
const SG = O.SIGNS;
ok('there are thirteen of them', SG.n === 13);
ok('each is 360/13 degrees wide', Math.abs(O.signWidth() - 360 / 13) < 1e-9,
   O.signWidth().toFixed(4) + ' deg');
ok('the anchor is where it was set', Math.abs(SG.anchor - 178.0) < 1e-9, String(SG.anchor));
ok('signOf and signBounds agree', (function () {
  for (let k = 1; k <= SG.n; k++) {
    const b = O.signBounds(k);
    // a hair inside each end of the sign
    if (O.signOf(b[0] + 0.01) !== k) return false;
    if (O.signOf(global.window.Marducian.mod(b[1] - 0.01, 360)) !== k) return false;
  }
  return true;
})());
ok('the signs tile the circle without gap or overlap', (function () {
  const seen = new Set();
  for (let ra = 0; ra < 360; ra += 0.25) {
    const k = O.signOf(ra);
    if (!(k >= 1 && k <= SG.n)) return false;
    seen.add(k);
  }
  return seen.size === SG.n;
})());

/* The anchor exists to put the merging of 0 MC inside The Spear's sign. If a
   future edit moves it, this is what says so out loud. */
{
  const M2 = global.window.Marducian;
  const S = O.sunsAt(M2.absDay(0, M2.doyOf(6, 34)) + 0.5);
  const eq = O.eclToEq(S.bary.lon, 0);
  const ra = O.raOf(eq);
  ok('the merging of 0 MC falls in sign 1, which is the anchor\'s whole purpose',
     O.signOf(ra) === 1, '34 Lochenvir sits at RA ' + ra.toFixed(1) + ', sign ' + O.signOf(ra));
}

/* Each figure sits in its own sign, which is what lets the viewer name the sign
   a body stands in. Two figures sharing one would make that ambiguous. */
{
  const byId = {};
  STARS.forEach(s => { byId[s.id] = s; });
  const signs = new Map();
  let clash = '';
  FIGS.forEach(f => {
    let x = 0, y = 0, z = 0;
    f.stars.forEach(id => {
      const s = byId[id], ra = s.ra * Math.PI / 180, dec = s.dec * Math.PI / 180, cd = Math.cos(dec);
      x += cd * Math.cos(ra); y += cd * Math.sin(ra); z += Math.sin(dec);
    });
    const n = Math.hypot(x, y, z);
    const k = O.signOf(O.raOf([x / n, y / n, z / n]));
    if (signs.has(k)) clash += f.name + ' shares sign ' + k + ' with ' + signs.get(k) + '; ';
    signs.set(k, f.name);
  });
  ok('no two figures claim the same sign', clash === '', clash ||
     [...signs.entries()].sort((a, b) => a[0] - b[0]).map(e => e[0] + ':' + e[1]).join(', '));
}

/* Degrees. A figure has to be tellable from its own reflection in AT LEAST ONE
   axis, not in both: most things worth drawing — a spear, a fish, a bird seen
   side on — are naturally symmetric about their long axis, and that is not a
   fault. What would be a fault is a figure you cannot orient at all. The bar is
   set just under The Spear, which is the tightest at 2.3 and is the one case
   where the symmetry is the subject's own. */
const MIRROR_FLOOR = 2.0;

console.log('\nThe picture agrees with the event list');
global.window.DiscScale = undefined;
eval(fs.readFileSync(JS('disc-scale.js'), 'utf8'));
const DS = global.window.DiscScale;

/* The one promise the drawing makes. Discs are magnified so they are visible at
   all; the gaps are magnified with them so that a drawn overlap is a real one.
   This has been got wrong twice, in opposite directions, so it is pinned here
   rather than left to the eye. */
ok('a drawn overlap happens exactly when a true one does', (function () {
  const sc = 7.9, dpr = 2, anchor = { ok: true, x: 400, y: 300 };
  for (const [r1, r2] of [[0.431, 0.328], [0.46, 0.431], [0.34, 0.28], [0.46, 0.34]]) {
    const R = r1 + r2, c = R * sc;
    for (const g of [1, 2, 3, 4.5]) {
      for (let s = 0; s < 6 * R; s += R / 60) {
        const p = { ok: true, x: anchor.x + s * sc, y: anchor.y };
        const q = DS.spreadPoint(p, anchor, c, g);
        const drawn = Math.hypot(q.x - anchor.x, q.y - anchor.y);
        if ((drawn < g * R * sc - 1e-9) !== (s < R - 1e-9)) return false;
      }
    }
  }
  return true;
})());

ok('and the drawn gap never goes backwards as two bodies close', (function () {
  const sc = 7.9, anchor = { ok: true, x: 0, y: 0 }, R = 0.76, c = R * sc;
  for (const g of [1, 2, 3, 4.5]) {
    let prev = -1;
    for (let s = 0; s < 8 * R; s += R / 200) {
      const q = DS.spreadPoint({ ok: true, x: s * sc, y: 0 }, anchor, c, g);
      const d = Math.hypot(q.x, q.y);
      if (d < prev - 1e-9) return false;
      prev = d;
    }
  }
  return true;
})());

ok('one shared scale, so the discs keep their proportions', (function () {
  const radii = [0.431, 0.328, 0.46, 0.42, 0.34];
  for (const sc of [0.4, 2, 7.9, 60, 400]) {
    for (const base of [1, 3]) {
      const g = DS.discScale(radii, base, sc, 2);
      if (g < base - 1e-9) return false;
      // the smallest disc stays visible...
      if (Math.min(...radii) * g * sc < DS.MIN_DISC * 2 - 1e-6) return false;
      // ...and every disc is the same multiple of its true size
      const ratio = (radii[0] * g * sc) / (radii[2] * g * sc);
      if (Math.abs(ratio - radii[0] / radii[2]) > 1e-12) return false;
    }
  }
  return true;
})());

/* The same promise, against the real sky rather than a sweep: a full year of
   every pair, asking the drawing and crossingsAt() the same question. */
ok('a year of the real sky, drawing and event list in step', (function () {
  const M2 = global.window.Marducian, sc = 7.9, dpr = 2;
  let checked = 0;
  for (let k = 0; k < M2.YEAR_LEN * 24; k += 1) {
    const t = M2.absDay(439, 1) + k / 24;
    const S = O.sunsAt(t), lb = S.bary.lon;
    const bodies = [
      { n: 'Solara', eq: O.eclToEq(S.solara.lon, S.solara.lat), r: S.rhoS / O.DEG },
      { n: 'Nystara', eq: O.eclToEq(S.nystara.lon, S.nystara.lat), r: S.rhoN / O.DEG },
    ];
    for (const m of O.moonsAt(t, lb)) {
      bodies.push({ n: m.n, eq: O.eclToEq(m.lon, m.lat), r: m.rho / O.DEG });
    }
    const g = DS.discScale(bodies.map((b) => b.r), 3, sc, dpr);
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const dot = a.eq[0] * b.eq[0] + a.eq[1] * b.eq[1] + a.eq[2] * b.eq[2];
        const sep = Math.acos(Math.max(-1, Math.min(1, dot))) / O.DEG;
        const R = a.r + b.r;
        const q = DS.spreadPoint({ ok: true, x: sep * sc, y: 0 }, { ok: true, x: 0, y: 0 }, R * sc, g);
        const drawnOverlap = Math.hypot(q.x, q.y) < g * R * sc - 1e-9;
        if (drawnOverlap !== (sep < R - 1e-9)) return false;
        checked++;
      }
    }
  }
  return checked > 90000;
})(), 'every pair, every hour of 439 MC');

console.log('\nThe figures as shapes');

/* A figure that is its own mirror image is a weak one: it reads the same
   flipped, so it cannot tell you which way up the sky is or which way it is
   facing. Beas measures this on Rolara after a player complained some of his
   constellations were too symmetrical, and the measure is worth having.
   Reported rather than tightly bounded, because The Dutiful Child was BUILT as
   his mother's reflection and is supposed to score low. */
function mirrorMisfit(pts) {
  // Everything in a flat frame centred on the figure, in degrees.
  const out = {};
  for (const [name, flip] of [['left to right', (p) => [-p[0], p[1]]],
                              ['top to bottom', (p) => [p[0], -p[1]]]]) {
    let sum = 0;
    for (const p of pts) {
      const q = flip(p);
      let best = Infinity;
      for (const o of pts) best = Math.min(best, Math.hypot(q[0] - o[0], q[1] - o[1]));
      sum += best;
    }
    out[name] = sum / pts.length;
  }
  return out;
}
// The measure catches a true mirror image.
ok('the mirror measure reads a perfect reflection as zero',
   mirrorMisfit([[-3, 1], [3, 1], [0, -4]])['left to right'] < 1e-9);

{
  const byId = {};
  STARS.forEach((s) => { byId[s.id] = s; });
  const rows = [];
  FIGS.forEach((f) => {
    // Flatten onto a plane touching the sky at the figure's middle.
    const vs = f.stars.map((id) => {
      const s = byId[id], ra = s.ra * Math.PI / 180, dec = s.dec * Math.PI / 180, cd = Math.cos(dec);
      return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
    });
    let c = [0, 0, 0];
    vs.forEach((v) => { c = [c[0] + v[0], c[1] + v[1], c[2] + v[2]]; });
    const cn = Math.hypot(...c); c = c.map((x) => x / cn);
    let e1 = [-c[1], c[0], 0];
    const e1n = Math.hypot(...e1);
    e1 = e1n < 1e-9 ? [1, 0, 0] : e1.map((x) => x / e1n);
    const e2 = [c[1] * e1[2] - c[2] * e1[1], c[2] * e1[0] - c[0] * e1[2], c[0] * e1[1] - c[1] * e1[0]];
    const pts = vs.map((v) => [
      (v[0] * e1[0] + v[1] * e1[1] + v[2] * e1[2]) * 180 / Math.PI,
      (v[0] * e2[0] + v[1] * e2[1] + v[2] * e2[2]) * 180 / Math.PI,
    ]);
    const m = mirrorMisfit(pts);
    rows.push({ name: f.name, best: Math.max(m['left to right'], m['top to bottom']) });
  });
  rows.sort((a, b) => a.best - b.best);
  ok('every figure can be told from its own reflection',
     rows.length > 0 && rows[0].best > MIRROR_FLOOR,
     rows.map((r) => r.name + ' ' + r.best.toFixed(1)).join(', '));
}

console.log('\nHow much is covered');

/* The lens area, against values that can be worked out by hand. */
ok('two circles apart cover nothing', O.overlapArea(1, 1, 3) === 0);
ok('a small disc wholly inside a big one covers its own face',
   Math.abs(O.overlapArea(2, 1, 0.5) - Math.PI) < 1e-12);
ok('two unit circles one apart overlap by the known amount',
   Math.abs(O.overlapArea(1, 1, 1) - (2 * Math.PI / 3 - Math.sqrt(3) / 2)) < 1e-12,
   O.overlapArea(1, 1, 1).toFixed(6));

/* Coverage against the event list, which is the pair that has to agree. */
{
  const M2 = global.window.Marducian;
  let bad = '', checked = 0, deepest = 0, deepWhen = null;
  for (let k = 0; k < M2.YEAR_LEN * 24; k++) {
    const t = M2.absDay(439, 1) + k / 24;
    const S = O.sunsAt(t);
    const c = O.coverageAt(t, S);
    const touching = O.crossingsAt(t, S).some((x) => x.kind === 'moon-sun' || x.other === 'Solara' || x.other === 'Nystara');
    const any = c.Solara > 0 || c.Nystara > 0;
    if (any && !touching) bad = 'covered but nothing is touching at t=' + t.toFixed(3);
    if (c.Solara < 0 || c.Solara > 1 || c.Nystara < 0 || c.Nystara > 1) bad = 'out of range at t=' + t.toFixed(3);
    if (c.light < 0 || c.light > 1) bad = 'light out of range at t=' + t.toFixed(3);
    const d = Math.max(c.Solara, c.Nystara);
    if (d > deepest) { deepest = d; deepWhen = t; }
    checked++;
  }
  ok('coverage never appears without something in the way, and stays in range',
     bad === '' && checked > 9000, bad || (checked + ' hours'));
  const f = M2.fromAbs(Math.floor(deepWhen));
  ok('the year has a deepest moment and the model can name it', deepest > 0,
     M2.fmtShort(f.Y, f.doy) + ', ' + (100 * deepest).toFixed(0) + '% covered');
}

/* Coverage rises as an occulter closes in: no jumps, no going backwards. */
ok('coverage climbs as the bodies close and never steps back', (function () {
  let prev = -1;
  for (let d = 2; d >= 0; d -= 0.002) {
    const f = O.overlapArea(0.45, 0.46, d) / (Math.PI * 0.45 * 0.45);
    if (f < prev - 1e-12) return false;
    prev = f;
  }
  return Math.abs(prev - 1) < 1e-9;    // ends wholly hidden
})());

/* Every event the almanac prints carries a depth, and a total one is total. */
{
  const evs = O.eventsInYear(439);
  const bad = evs.filter((e) => !(e.covered >= 0 && e.covered <= 1));
  ok('every crossing in a year carries a depth between none and all',
     evs.length > 0 && bad.length === 0, evs.length + ' crossings');
  const totals = evs.filter((e) => e.total);
  ok('and a crossing called total really does hide the far body',
     totals.every((e) => e.covered > 0.999),
     totals.length + ' total, deepest partial ' +
     (100 * Math.max(0, ...evs.filter((e) => !e.total).map((e) => e.covered))).toFixed(0) + '%');
}

console.log('\nBrightness as a chart counts it');
ok('the scale runs the right way: lower is brighter', O.magOf(1) < O.magOf(0.5) && O.magOf(0.5) < O.magOf(0));
ok('it meets its two anchors', Math.abs(O.magOf(0) - O.MAG.faintest) < 1e-9 &&
   Math.abs(O.magOf(1) - O.MAG.brightest) < 1e-9,
   O.MAG.brightest + ' at the top, ' + O.MAG.faintest + ' at the naked-eye limit');
ok('no catalogued star falls below the naked-eye limit',
   STARS.every((s) => O.magOf(s.b) < O.MAG.faintest),
   'faintest is ' + Math.max(...STARS.map((s) => O.magOf(s.b))).toFixed(2));
ok('and the sky is about three times as bright as Earth\'s, on purpose',
   STARS.filter((s) => O.magOf(s.b) < 2).length > 100,
   STARS.filter((s) => O.magOf(s.b) < 2).length + ' stars beat magnitude 2; Earth has about 50');

ok('a moon brightens as more of it is lit', (function () {
  const r = O.MOON_EL.miras.rho;
  let prev = Infinity;
  for (let i = 1; i <= 100; i++) {
    const m = O.moonMagOf(r, i / 100);
    if (m > prev) return false;
    prev = m;
  }
  return Math.abs(prev - O.MAG.fullMiras) < 1e-9;
})());
ok('and a wider moon beats a narrower one at the same phase',
   O.moonMagOf(O.MOON_EL.miras.rho, 0.5) < O.moonMagOf(O.MOON_EL.keltas.rho, 0.5),
   'half Miras ' + O.moonMagOf(O.MOON_EL.miras.rho, 0.5).toFixed(2) +
   ' against half Keltas ' + O.moonMagOf(O.MOON_EL.keltas.rho, 0.5).toFixed(2));

console.log('\nThe air in the way');
global.window.Air = undefined;
eval(fs.readFileSync(JS('air.js'), 'utf8'));
const AIR = global.window.Air;

/* The air mass itself. These three numbers are not ours to choose — they are
   what Kasten and Young's fit returns, and they are the check that the formula
   was transcribed rather than remembered. */
ok('one atmosphere at the zenith', Math.abs(AIR.airmass(90) - 1) < 0.002,
   AIR.airmass(90).toFixed(4));
ok('about five and a half at ten degrees', Math.abs(AIR.airmass(10) - 5.6) < 0.1,
   AIR.airmass(10).toFixed(2));
ok('about thirty-eight at the horizon', Math.abs(AIR.airmass(0) - 38) < 1,
   AIR.airmass(0).toFixed(1));
ok('and it only ever grows on the way down', (function () {
  let prev = 0;
  for (let h = 90; h >= -1.5; h -= 0.25) {
    const x = AIR.airmass(h);
    if (!(x > prev) || !isFinite(x)) return false;
    prev = x;
  }
  return true;
})());

/* The whole point of splitting a star between an alpha and a colour is that the
   split is exact. Multiply them back together and every channel must land on
   the flux the extinction law asks for — including the red one, which would
   otherwise clip at 255 and quietly turn the effect off at the altitudes where
   it matters most. */
const fluxErr = (function () {
  const k = [AIR.EXT.R, AIR.EXT.G, AIR.EXT.B];
  let worst = 0;
  for (const c of [[255, 214, 170], [248, 246, 240], [196, 214, 255]]) {
    for (const h of [90, 60, 40, 25, 15, 10, 6, 3, 1, 0]) {
      const air = AIR.point(c, h), x = AIR.airmass(h) - 1;
      for (let i = 0; i < 3; i++) {
        const want = c[i] * Math.pow(10, -0.4 * k[i] * x);
        worst = Math.max(worst, Math.abs(2.5 * Math.log10((air.a * air.c[i]) / want)));
      }
    }
  }
  return worst;
})();
/* A thousandth of a magnitude, which is nothing: the only error in here is the
   hue shift being skipped within a fiftieth of an air mass of the zenith, where
   it is worth less than a ten-thousandth. Anywhere it IS applied the split is
   exact to the last bit. */
ok('a star loses exactly what the law says, channel by channel',
   fluxErr < 0.001, 'worst channel is out by ' + fluxErr.toExponential(1) + ' magnitudes');
ok('nothing overhead is touched at all', (function () {
  const c = [248, 246, 240], air = AIR.point(c, 90);
  return Math.abs(air.a - 1) < 2e-3 && air.c.every((v, i) => Math.abs(v - c[i]) < 1e-6);
})());
ok('and the colour it leaves is always drawable', (function () {
  for (const h of [90, 30, 10, 3, 0, -1]) {
    const air = AIR.point([248, 246, 240], h);
    if (!air.c.every((v) => v >= -1e-9 && v <= 255.0001)) return false;
  }
  return true;
})());

/* The reddening, stated as the thing a reader would notice: a white star low
   down is orange. Measured as red against blue, which is near one for white
   and climbs without bound as the blue is stripped away. */
const redBlue = (h) => { const c = AIR.point([248, 246, 240], h).c; return c[0] / c[2]; };
ok('a white star reddens steadily as it sets', (function () {
  let prev = 0;
  for (const h of [90, 60, 40, 25, 15, 10, 6, 3, 1]) {
    if (!(redBlue(h) > prev)) return false;
    prev = redBlue(h);
  }
  return prev > 20;
})(), 'red beats blue ' + redBlue(1).toFixed(0) + ' to one at a degree up, ' +
     redBlue(10).toFixed(1) + ' to one at ten');

/* A disc is the other half of the contract: it keeps its opacity and takes a
   softened dimming, because the eye opens up. The test is that it still goes
   obviously red, and that it never goes BLACK — which honest linear dimming
   would do, and which is the whole reason SOFT exists. */
ok('a setting sun turns red without going out', (function () {
  const c = AIR.disc([255, 236, 190], 1);
  return c[0] > 140 && c[1] < 110 && c[2] < 30;
})(), AIR.disc([255, 236, 190], 1).map((v) => Math.round(v)).join(','));
ok('a sun overhead keeps its own colour', (function () {
  const c = [255, 236, 190], o = AIR.disc(c, 90);
  return o.every((v, i) => Math.abs(v - c[i]) < 1e-6);
})());
ok('and even Nystara, who starts blue, ends red', (function () {
  const c = AIR.disc([240, 248, 255], 1);
  return c[0] > c[1] * 2 && c[0] > c[2] * 4;
})(), AIR.disc([240, 248, 255], 1).map((v) => Math.round(v)).join(','));

/* The sky's own colour. `hue` turns a colour without touching how bright it
   is, because the sky's brightness is already carried by how high its sun is
   — dimming here would count the same loss twice. Holding the peak channel
   fixed is also what keeps the last few degrees usable: multiply instead and
   the red ratio, which is into the thousands near the ground, saturates every
   altitude below about five degrees to the same flat red. */
ok('turning a colour never changes how bright it is', (function () {
  for (const c of [[135, 125, 100], [80, 100, 115], [20, 34, 52]]) {
    const peak = Math.max.apply(null, c);
    for (const h of [90, 40, 20, 9, 5, 2, 0, -1.5]) {
      const o = AIR.hue(c, h);
      if (Math.abs(Math.max.apply(null, o) - peak) > 1e-9) return false;
      if (o.some((v) => v < -1e-9 || v > 255.0001)) return false;
    }
  }
  return true;
})());
ok('and the horizon wash keeps every step of its way to red', (function () {
  let prev = Infinity;
  for (const h of [29, 20, 12, 9, 5, 2, 0]) {
    const g = AIR.hue([135, 125, 100], h)[1];
    if (!(g < prev - 1)) return false;     // a visible step each time, not a plateau
    prev = g;
  }
  return prev < 5;
})(), 'green runs ' + [29, 12, 5, 0].map((h) =>
  h + '°:' + Math.round(AIR.hue([135, 125, 100], h)[1])).join('  '));

/* The sky gradient. The point of keying it to the air is that the brightening
   is a BAND near the ground rather than the whole lower half of the sky, so
   that is what the test says. */
ok('the horizon glow is a band, not half the sky', (function () {
  const m = AIR.horizonMix;
  if (m(90) !== 0) return false;
  for (let h = 90; h >= 0.1; h -= 0.1) if (!(m(h) <= m(h - 0.1) + 1e-12)) return false;
  // Thirty degrees up is plainly sky; the old linear mix called it two thirds
  // horizon. Ten degrees up is plainly in the glow.
  return m(30) < 0.3 && m(10) > 0.4 && m(0) > 0.85 && m(0) < 1;
})(), 'mix is ' + [30, 20, 10, 0].map((h) =>
  h + '°:' + AIR.horizonMix(h).toFixed(2)).join('  ') +
  ', against linear 0.67 0.78 0.89 1.00');

/* The city's own glow rides on the air mass itself rather than on the excess
   over the zenith, and that distinction is the whole test: a city lights the
   air directly overhead too, so a dome that fell to nothing at the zenith
   would be claiming it does not. The ratio it does claim — about ten to one,
   horizon against overhead — is the number a reader could argue with, so it
   is the number pinned here. */
ok('the city lights the whole sky, the low sky most', (function () {
  const g = AIR.glowMix;
  if (!(g(90) > 0.02)) return false;                  // never nothing overhead
  for (let h = 90; h >= 0.1; h -= 0.1) if (!(g(h) <= g(h - 0.1) + 1e-12)) return false;
  const ratio = g(0) / g(90);
  return ratio > 8 && ratio < 12 && g(0) < 1;
})(), 'the horizon is ' + (AIR.glowMix(0) / AIR.glowMix(90)).toFixed(1) +
     ' times the zenith; ' + [90, 30, 10, 0].map((h) =>
       h + '°:' + AIR.glowMix(h).toFixed(2)).join('  '));
ok('and it rises higher than the twilight band does, relative to each', (function () {
  // Relative to their own horizon value: the glow still has an eighth of its
  // strength at sixty degrees, where the sky's own band has a twentieth.
  const gr = AIR.glowMix(60) / AIR.glowMix(0), br = AIR.horizonMix(60) / AIR.horizonMix(0);
  return gr > br;
})(), 'at 60° the glow holds ' + (AIR.glowMix(60) / AIR.glowMix(0) * 100).toFixed(0) +
     '% of its horizon strength, the sky band ' +
     (AIR.horizonMix(60) / AIR.horizonMix(0) * 100).toFixed(0) + '%');

/* The faint layer's two concessions. The table has to agree with the law it
   stands in for, and the bands have to be ordered — a lookup that returned them
   out of sequence would paint the low sky in high-sky colours, which is exactly
   the sort of fault that looks almost right. */
/* The bar is a fifth of a magnitude, and only where a star could still be seen
   at all. Lower than that the table cannot keep up and does not need to: below
   about two degrees the air is taking five magnitudes and more, every star in
   the layer has already fallen under the alpha cut, and nothing is drawn for
   the table to be wrong about. */
const dimErr = (function () {
  let worst = 0;
  for (let h = -1.5; h <= 90; h += 0.05) {
    const want = Math.pow(10, -0.4 * AIR.EXT.G * (AIR.airmass(h) - 1));
    if (want <= 0.01) continue;
    worst = Math.max(worst, Math.abs(2.5 * Math.log10(AIR.dimAt(h) / want)));
  }
  return worst;
})();
ok('the dimming table matches the arithmetic it replaces',
   dimErr < 0.2, 'worst reading is out by ' + dimErr.toFixed(3) + ' magnitudes');
ok('the colour bands run high sky to low, in order', (function () {
  for (let i = 1; i < AIR.BAND_AT.length; i++) {
    if (!(AIR.BAND_AT[i] < AIR.BAND_AT[i - 1])) return false;
  }
  for (let h = 90; h >= 0.1; h -= 0.1) {
    const b = AIR.bandAt(h);
    if (b < 0 || b >= AIR.BAND_AT.length) return false;
    if (b > AIR.bandAt(h - 0.1)) return false;
  }
  return AIR.bandAt(90) === 0 && AIR.bandAt(0) === AIR.BAND_AT.length - 1;
})());
ok('and every banded tint is a real colour', (function () {
  const T = [[255, 214, 170], [255, 236, 206], [248, 246, 240],
             [236, 240, 252], [214, 228, 255], [196, 214, 255]];
  const bands = AIR.tintBands(T);
  if (bands.length !== AIR.BAND_AT.length) return false;
  return bands.every((row) => row.length === T.length &&
    row.every((c) => c.length === 3 && c.every((v) => v >= 0 && v <= 255.0001)));
})());

console.log('');
if (fails.length) {
  console.error(`FAIL: ${fails.length} of ${pass + fails.length} checks failed.`);
  fails.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log(`PASS: ${pass} orbital checks.`);
