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
  ok(f.name + ': carries its chain of names oldest first', (f.names || []).length >= 2,
     (f.names || []).map(n => n.name).join(' -> '));
  ok(f.name + ': points at an article', /^\/articles\/[a-z0-9-]+\/$/.test(f.article), f.article);
});

console.log('');
if (fails.length) {
  console.error(`FAIL: ${fails.length} of ${pass + fails.length} checks failed.`);
  fails.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log(`PASS: ${pass} orbital checks.`);
