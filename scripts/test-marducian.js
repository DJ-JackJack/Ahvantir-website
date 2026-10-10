/* Checks the shared Marducian calendar core against the article that is canon,
 * and checks that it is still the ONLY copy.
 *
 * The second half is the point. /almanac/ and /almanac/sky/ both need these
 * tables, and the failure mode of a duplicated calendar is not a crash — it is
 * two pages quietly disagreeing about which weekday a date falls on, months
 * after someone edited one of them. So this asserts that neither almanac.js nor
 * sky.js defines MONTHS or MOONS of its own.
 *
 * Numbers here come from /articles/marducian-calendar/. If a DM ruling changes
 * the calendar, the article changes first and this test is what tells you which
 * code to follow it with.
 *
 * Run: node scripts/test-marducian.js   (or npm test)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JS = (f) => path.join(ROOT, 'src/assets/js', f);

global.window = {};
eval(fs.readFileSync(JS('marducian.js'), 'utf8'));
const M = global.window.Marducian;

let pass = 0;
const fails = [];
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ok    ' + label); }
  else { fails.push(label + (detail ? '  — ' + detail : '')); console.log('  FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}
function eq(label, got, want) {
  ok(label, got === want, got === want ? '' : `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}

console.log('\nThe year');
eq('a year is 386 days', M.YEAR_LEN, 386);
const monthDays = M.MONTHS.reduce((a, m) => a + m.d, 0);
eq('the months total 386', monthDays, 386);
eq('six months of 43', M.MONTHS.filter(m => m.d === 43).length, 6);
eq('three months of 42', M.MONTHS.filter(m => m.d === 42).length, 3);
eq('two days outside the Turn', M.MONTHS.filter(m => m.ic).length, 2);
eq('nine months proper', M.MONTHS.filter(m => !m.ic).length, 9);
eq('the nine months total 384', M.MONTHS.filter(m => !m.ic).reduce((a, m) => a + m.d, 0), 384);

console.log('\nThe intercalary days land where the article says');
eq('Cindrafel is day 173', M.doyOf(M.MONTHS.findIndex(m => m.n === 'Cindrafel'), 1), 173);
eq('Noctharis is day 344', M.doyOf(M.MONTHS.findIndex(m => m.n === 'Noctharis'), 1), 344);
ok('Cindrafel is outside the Turn', M.dayInfo(439, 173).wd === null);
ok('Noctharis is outside the Turn', M.dayInfo(439, 344).wd === null);

console.log('\nThe Turn');
eq('a Turn is eight days', M.TURN_LEN, 8);
eq('eight weekday names', M.WEEK.length, 8);
eq('384 days of Turn divide exactly', 384 % 8, 0);
// "Every year opens on Solkir" — and it only keeps doing so because the two
// intercalary days sit outside the count. Checked across a Pairing cycle.
let opensOK = true, badYear = null;
for (let Y = 0; Y <= 40; Y++) {
  if (M.dayInfo(Y, 1).wd !== 0) { opensOK = false; badYear = Y; break; }
}
ok('every year from 0 to 40 MC opens on Solkir', opensOK, badYear === null ? '' : `${badYear} MC did not`);
eq('Solkir is the first weekday', M.WEEK[0], 'Solkir');
eq('Alkir is the last', M.WEEK[7], 'Alkir');

console.log('\nday-of-year round trip');
let rtOK = true, rtBad = null;
for (let doy = 1; doy <= M.YEAR_LEN; doy++) {
  const x = M.dayInfo(439, doy);
  if (!x || M.doyOf(x.mi, x.d) !== doy) { rtOK = false; rtBad = doy; break; }
}
ok('all 386 days survive dayInfo -> doyOf', rtOK, rtBad === null ? '' : `day ${rtBad} did not`);

console.log('\nThe moons');
eq('three moons', M.MOONS.length, 3);
[['Miras', 24], ['Toris', 43], ['Keltas', 66]].forEach(([n, c]) => {
  const m = M.MOONS.find(x => x.n === n);
  eq(`${n} runs ${c} days`, m.c, c);
  eq(`${n}'s phase lengths sum to its cycle`, m.ph.reduce((a, b) => a + b, 0), c);
  eq(`${n} has eight phases`, m.ph.length, 8);
});
eq('eight phase names', M.PH.length, 8);
// Day 0 is 1 Varenthal Year 1, the Foundry epoch where all three start new.
const epoch = M.absDay(1, 1);
eq('the epoch is day 0', epoch, 0);
ok('all three moons are new at the epoch',
   M.MOONS.every(m => M.phaseOf(m, epoch).i === 0));

console.log('\nThe moons realign on the stated cycle');
/* The article says the moons "return to the same phases together only once
 * every 11,352 days". That is REALIGNMENT — every moon back at the start of its
 * own cycle at once — and 11352 = 2^3 * 3 * 11 * 43 is the least common
 * multiple of 24, 43 and 66.
 *
 * It is not the same thing as all three reading "New" on one day. New is a
 * window three, six and eight days wide, so three New phases overlap far more
 * often than the cycles realign. The almanac ribbon's "all three new" marker is
 * that overlap, which is why it appears several times a century rather than
 * once. Both are tested, because conflating them is the easy mistake — I made
 * it writing this test. */
const LCM = 11352;
eq('11,352 is the least common multiple of the three cycles',
   M.MOONS.reduce((a, m) => (a * m.c) / ((x, y) => { while (y) { [x, y] = [y, x % y]; } return x; })(a, m.c), 1),
   LCM);
let realign = null;
for (let D = 1; D <= LCM; D++) {
  if (M.MOONS.every(m => M.mod(D, m.c) === 0)) { realign = D; break; }
}
eq('the cycles first realign after exactly 11,352 days', realign, LCM);
ok('and all three read New there, as at the epoch',
   M.MOONS.every(m => M.phaseOf(m, epoch + LCM).i === 0));
ok('11,352 days is about 29.4 years', Math.abs(LCM / M.YEAR_LEN - 29.4) < 0.1,
   (LCM / M.YEAR_LEN).toFixed(2) + ' years');
// The overlap of the three New windows is a different, more frequent event.
const firstOverlapAfterEpoch = (() => {
  for (let D = 3; D < LCM; D++) {   // day 0-2 is the epoch's own run
    if (M.MOONS.every(m => M.phaseOf(m, D).i === 0)) return D;
  }
  return null;
})();
ok('three New phases overlap again well before the cycles realign',
   firstOverlapAfterEpoch !== null && firstOverlapAfterEpoch < LCM,
   'next all-new day is ' + firstOverlapAfterEpoch);

// The Pairing used to live here as a sine with an eight-year period. It is now
// solved from real orbits in orbits.js and tested by scripts/test-orbits.js;
// this file is the calendar and nothing else.
ok('the calendar no longer carries a sun model',
   M.sunSep === undefined && M.nextPairing === undefined && M.PAIR_PERIOD === undefined);

console.log('\nYear boundaries');
eq('day 0 rolls back a year', JSON.stringify(M.normalise(439, 0)), JSON.stringify({ Y: 438, doy: 386 }));
eq('day 387 rolls forward', JSON.stringify(M.normalise(439, 387)), JSON.stringify({ Y: 440, doy: 1 }));
eq('a day in range is untouched', JSON.stringify(M.normalise(439, 35)), JSON.stringify({ Y: 439, doy: 35 }));
const back = M.fromAbs(M.absDay(439, 200));
eq('absDay and fromAbs round trip', JSON.stringify(back), JSON.stringify({ Y: 439, doy: 200 }));

console.log('\nThis is the only copy');
// A page that grows its own tables stops tracking the article, and nothing
// visible breaks when it does. Both consumers must read the shared core.
for (const f of ['almanac.js', 'sky.js']) {
  const src = fs.readFileSync(JS(f), 'utf8');
  ok(`${f} does not define its own MONTHS`, !/\bvar\s+MONTHS\s*=\s*\[/.test(src));
  ok(`${f} does not define its own MOONS array`, !/\bvar\s+MOONS\s*=\s*\[\s*\{\s*n:/.test(src));
  ok(`${f} does not define its own WEEK`, !/\bvar\s+WEEK\s*=\s*\[/.test(src));
  ok(`${f} reads window.Marducian`, /window\.Marducian/.test(src));
}

console.log('');
if (fails.length) {
  console.error(`FAIL: ${fails.length} of ${pass + fails.length} checks failed.`);
  fails.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log(`PASS: ${pass} Marducian calendar checks.`);
