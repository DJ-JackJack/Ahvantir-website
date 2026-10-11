/* Writes the bright layer out to src/assets/js/stars-bright.js, once.
 *
 * Until now the bright stars were a side effect of a loop: change the count,
 * the order or the generator and every one of them moves. That was fine while
 * they were anonymous. It stops being fine the moment a constellation points
 * at one, because the figure would silently follow the stars wherever they
 * went.
 *
 * So this is run once and its output is committed. The generator below is kept
 * byte-identical to the one that produced the sky people have already been
 * looking at, so freezing changes nothing visible. After this, sky.js reads the
 * file and this script is history — rerunning it should produce the same file,
 * and scripts/test-orbits.js checks that the file still matches.
 *
 * The faint layer is deliberately NOT frozen. Nothing will ever name one of
 * those, so it stays procedural and free to change.
 *
 * Run: node scripts/freeze-stars.js
 */
const fs = require('fs');
const path = require('path');

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function pickTint(r) { return clamp(Math.floor(2 + (r * r * 6 - 2)), 0, 5); }

const R = rng(4391);
const out = [];
for (let i = 0; i < 150; i++) {
  const z = R() * 2 - 1, th = R() * 2 * Math.PI, rr = Math.sqrt(1 - z * z);
  const b = 0.52 + 0.48 * Math.pow(R(), 1.7);
  out.push({ v: [rr * Math.cos(th), rr * Math.sin(th), z], b: b, t: R(), c: pickTint(R()) });
}
out.sort((p, q) => q.b - p.b);

const DEG = 180 / Math.PI;
const rows = out.map((s, i) => {
  const ra = ((Math.atan2(s.v[1], s.v[0]) * DEG) + 360) % 360;
  const dec = Math.asin(s.v[2]) * DEG;
  // id by rank, so s001 is the brightest star in the sky and stays so.
  const id = 's' + String(i + 1).padStart(3, '0');
  return '  { id: "' + id + '", ra: ' + ra.toFixed(4) + ', dec: ' + dec.toFixed(4) +
         ', b: ' + s.b.toFixed(4) + ', c: ' + s.c + ', t: ' + s.t.toFixed(4) + ' }';
});

const body = `/* stars-bright.js — the named sky, frozen.
 *
 * Generated once by scripts/freeze-stars.js and committed. DO NOT regenerate
 * casually: constellations point at these ids, and moving a star moves every
 * figure drawn from it. The faint layer is still procedural and still free.
 *
 * Ordered brightest first, so s001 is the brightest star over Ahvantir.
 * Positions are right ascension and declination in degrees; b is brightness,
 * c indexes the tint table in sky.js, t is a twinkle phase.
 *
 * ${out.length} stars.
 */
window.BrightStars = [
${rows.join(',\n')}
];
`;

const dest = path.join(__dirname, '..', 'src', 'assets', 'js', 'stars-bright.js');
fs.writeFileSync(dest, body);
console.log('wrote ' + out.length + ' stars to ' + path.relative(path.join(__dirname, '..'), dest));
console.log('brightest: ' + out[0].b.toFixed(3) + '   faintest: ' + out[out.length - 1].b.toFixed(3));
