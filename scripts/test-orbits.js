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

console.log('');
if (fails.length) {
  console.error(`FAIL: ${fails.length} of ${pass + fails.length} checks failed.`);
  fails.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log(`PASS: ${pass} orbital checks.`);
