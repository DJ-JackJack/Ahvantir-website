/* Round-trips every marker in seed-arumas-map.sql through map-coords.js the way
 * an edit does: database -> Leaflet -> database.
 *
 * This exists because the failure it catches is invisible. If one direction of
 * the conversion forgets the y-flip or rounds inconsistently, shapes do not
 * disappear. They drift a pixel or two further toward the opposite edge on
 * every save, which reads as "the map looks slightly off" months later, long
 * after the original geometry is gone. Importing the World Anvil data for this
 * map hit exactly that class of bug and put 32 of 33 markers in the wrong
 * district while every shape still looked plausible.
 *
 * The seed is hand-traced geometry that cannot be reproduced if it is lost, so
 * the assertion is exact equality, repeated over ten save cycles to prove the
 * error does not accumulate.
 *
 * Run: node scripts/test-map-coords.js   (or npm test)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const H = 3508, W = 4962;   // the Aru'Mas map image's real pixel dimensions
const CYCLES = 10;

// Minimal Leaflet stand-in. map-coords.js only ever calls L.latLng, and reads
// getLatLngs() off the layer it is handed.
global.L = { latLng: (lat, lng) => ({ lat, lng }) };
global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'src/assets/js/map-coords.js'), 'utf8'));
const C = global.window.MapCoords;

let failures = 0;
function fail(msg) { failures++; if (failures <= 8) console.error('  ' + msg); }

C.selfTest(H);
console.log('selfTest passed at height ' + H);

const sql = fs.readFileSync(path.join(ROOT, 'scripts/seed-arumas-map.sql'), 'utf8');
const polys = [...sql.matchAll(/'(\[\[\s*-?\d[\s\S]*?\]\])'::jsonb/g)].map((m) => JSON.parse(m[1]));
const points = [...sql.matchAll(/,\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*'#/g)]
  .map((m) => ({ x: Math.round(+m[1]), y: Math.round(+m[2]) }));

if (!polys.length || !points.length) {
  console.error('FAIL: parsed nothing out of the seed file. Has its format changed?');
  process.exit(1);
}
console.log('parsed ' + polys.length + ' polygons and ' + points.length + ' points from the seed');

function tripRing(ring) {
  const latlngs = C.ringToLatLngs(ring, H);
  // getLatLngs() is nested for a real L.Polygon; mirror that here so the test
  // exercises the same unwrapping the editor relies on.
  return C.ringFromLayer({ getLatLngs: () => [latlngs] }, H);
}

let vertices = 0;
polys.forEach((ring, i) => {
  let cur = ring;
  for (let n = 0; n < CYCLES; n++) cur = tripRing(cur);
  if (cur.length !== ring.length) {
    fail('polygon ' + i + ' changed vertex count: ' + ring.length + ' -> ' + cur.length);
    return;
  }
  ring.forEach((p, j) => {
    vertices++;
    if (p[0] < 0 || p[0] > W || p[1] < 0 || p[1] > H) {
      fail('polygon ' + i + ' vertex ' + j + ' is outside the image: ' + JSON.stringify(p));
    }
    if (cur[j][0] !== p[0] || cur[j][1] !== p[1]) {
      fail('polygon ' + i + ' vertex ' + j + ' drifted ' + JSON.stringify(p) +
           ' -> ' + JSON.stringify(cur[j]));
    }
  });
  const bad = C.validate('area', cur, { image_width: W, image_height: H });
  if (bad) fail('validate rejected polygon ' + i + ': ' + bad);
});

points.forEach((p, i) => {
  let cur = p;
  for (let n = 0; n < CYCLES; n++) cur = C.fromLatLng(C.toLatLng(cur.x, cur.y, H), H);
  if (cur.x !== p.x || cur.y !== p.y) {
    fail('point ' + i + ' drifted ' + JSON.stringify(p) + ' -> ' + JSON.stringify(cur));
  }
  if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
    fail('point ' + i + ' is outside the image: ' + JSON.stringify(p));
  }
  const bad = C.validate('point', cur, { image_width: W, image_height: H });
  if (bad) fail('validate rejected point ' + i + ': ' + bad);
});

// The guards are only worth having if they actually fire.
const mustReject = [
  ['area', [[0, 0], [10, 10]], 'a two-corner area'],
  ['area', new Array(501).fill([0, 0]), 'a 501-corner area'],
  ['point', { x: -1, y: 10 }, 'a point off the left edge'],
  ['point', { x: 10, y: H + 1 }, 'a point below the image'],
];
mustReject.forEach(([kind, geom, what]) => {
  if (!C.validate(kind, geom, { image_width: W, image_height: H })) {
    fail('validate ACCEPTED ' + what + ', which it should refuse');
  }
});

console.log('checked ' + vertices + ' polygon vertices and ' + points.length +
            ' points over ' + CYCLES + ' save cycles each');
if (failures) {
  console.error('FAIL: ' + failures + ' problem(s). Do NOT edit map geometry until this passes.');
  process.exit(1);
}
console.log('PASS: no drift, nothing out of bounds, all guards fire');
