/* air.js — what the atmosphere takes out of the light on its way down.
 *
 * A star at the zenith is seen through one atmosphere's depth. At ten degrees
 * it is seen through five and a half, and at the horizon through something like
 * thirty-eight. That is the whole reason the last hand's breadth of any sky is
 * empty on even a clear night, and the reason that whatever is still standing
 * in it has gone orange.
 *
 * Both effects come out of one quantity — the air mass — and the cheap standard
 * approximation for it is Kasten and Young's (1989). It is close enough at
 * every altitude and, unlike the naive 1/sin(h), it stays finite at the
 * horizon.
 *
 * ASSUMPTION, and it is the only one here: Ahvantir's air behaves like ours.
 * Nothing in the vault says what the air is made of or how deep it is. The
 * alternative was what stood before this file: stars holding full brightness
 * and full colour right down to the horizon, which is not neutral — it is the
 * stranger claim, made silently. The coefficients below are the usual
 * sea-level ones, in magnitudes lost per air mass. Blue is scattered away
 * hardest and red least, and that asymmetry is the entire reason a setting sun
 * is red.
 *
 * Everything is measured RELATIVE TO THE ZENITH. A star overhead comes out of
 * here drawn exactly as it was before any of this existed; what this adds is
 * only the loss on the way down. So the star catalogue's brightnesses keep
 * meaning what they meant, and nothing needed re-tuning to accommodate this.
 *
 * Classic script exposing a global, matching marducian.js, orbits.js and
 * disc-scale.js. Tested by scripts/test-orbits.js.
 */
(function () {
  'use strict';

  var DEG = Math.PI / 180;

  // Magnitudes lost per air mass, per channel.
  var EXT = { R: 0.15, G: 0.28, B: 0.45 };

  /* Kasten and Young. Below about -1.7 degrees the fit turns over and would
     return a negative air mass; nothing is ever drawn that low, since bodies
     are culled nearer -1.15, but the clamp means no caller can be handed a
     nonsense number. */
  function airmass(alt) {
    var h = Math.max(alt, -1.5);
    return 1 / (Math.sin(h * DEG) + 0.50572 * Math.pow(h + 6.07995, -1.6364));
  }

  /* A POINT SOURCE — a star — is drawn as a colour times an alpha, and those
     two can carry the effect between them exactly. The alpha takes the green
     channel's loss; the colour takes the ratios between the channels, which is
     the hue shift and nothing else.
     *
     * The one subtlety is the clip. Reddening means multiplying the red channel
     * UP, and red is usually already near the top of the range, so a naive
     * implementation clamps at 255 and the star goes yellow and stops there —
     * which is not what a star near the horizon looks like. Instead, when the
     * red channel would pass 255 the whole colour is scaled down by that factor
     * and the alpha scaled up by the same one. The product is unchanged, so the
     * physics is exact, and the colour is now free to run all the way to red.
     */
  function point(c, alt) {
    var x = airmass(alt) - 1;
    var dim = Math.pow(10, -0.4 * EXT.G * x);
    if (x < 0.02) return { a: dim, c: c };
    var o = [c[0] * Math.pow(10, -0.4 * (EXT.R - EXT.G) * x), c[1],
             c[2] * Math.pow(10, -0.4 * (EXT.B - EXT.G) * x)];
    var peak = Math.max(o[0], o[1], o[2]);
    if (peak > 255) {
      var k = 255 / peak;
      o = [o[0] * k, o[1] * k, o[2] * k];
      dim *= peak / 255;
    }
    return { a: dim, c: o };
  }

  /* A DISC — a sun or a moon — has no alpha to carry anything, and should not
     be given one: a setting sun does not become transparent, it becomes a dim
     red coin. It also must not take the full dimming, because the eye is not a
     photometer. Solara loses four or five magnitudes on her way down and is
     still far and away the brightest thing in the sky, because the pupil opens
     and because everything around her is dimming with her.
     *
     * So a disc takes the colour shift at full strength — that is what makes a
     * sunset a sunset — and the fourth root of the dimming, which is about as
     * dark as the eye will report it. The exponent is the one number in this
     * file chosen for looks rather than derived, and it is doing the job a
     * tone-mapping curve does in a renderer that has one.
     */
  var SOFT = 0.25;
  function disc(c, alt) {
    var x = airmass(alt) - 1;
    if (x < 0.02) return c;
    var k = Math.pow(Math.pow(10, -0.4 * EXT.G * x), SOFT);
    return [c[0] * Math.pow(10, -0.4 * (EXT.R - EXT.G) * x) * k,
            c[1] * k,
            c[2] * Math.pow(10, -0.4 * (EXT.B - EXT.G) * x) * k];
  }

  /* Fifteen thousand faint stars cannot each have an air mass computed and a
     fillStyle set for them every frame. Two concessions, and only for that
     layer:
     *
     * The dimming comes from a table at quarter-degree steps, which is finer
     * than a pixel at any field of view the viewer offers.
     *
     * The colour is banded. A band costs a draw bucket, and a quarter of a
     * magnitude of hue shift is invisible on a dot a pixel across — so eight
     * bands, packed close together low down where a single degree changes
     * everything and spread out above, where it changes almost nothing. The
     * bright layer is a hundred and seventy stars drawn one at a time and does
     * the arithmetic properly.
     */
  var LO = -2, STEP = 0.25;
  var DIM = (function () {
    var t = [];
    for (var i = 0; LO + i * STEP <= 90.001; i++) {
      t.push(Math.pow(10, -0.4 * EXT.G * (airmass(LO + i * STEP) - 1)));
    }
    return t;
  })();
  function dimAt(alt) {
    var i = Math.round((alt - LO) / STEP);
    return DIM[i < 0 ? 0 : (i >= DIM.length ? DIM.length - 1 : i)];
  }

  // The lower edge of each colour band, and the altitude its colour is taken
  // at. The last band has no floor; everything below three degrees is drawn
  // the colour of two.
  var BAND_LO = [40, 25, 18, 13, 9, 6, 3];
  var BAND_AT = [60, 31, 21, 15, 11, 7.4, 4.3, 2.0];
  function bandAt(alt) {
    for (var i = 0; i < BAND_LO.length; i++) if (alt >= BAND_LO[i]) return i;
    return BAND_LO.length;
  }
  // Every tint, reddened once per band. Built at load, read every frame.
  function tintBands(tints) {
    return BAND_AT.map(function (a) {
      return tints.map(function (c) { return point(c, a).c; });
    });
  }

  var API = {
    EXT: EXT, SOFT: SOFT,
    airmass: airmass, point: point, disc: disc,
    dimAt: dimAt, bandAt: bandAt, BAND_AT: BAND_AT, tintBands: tintBands
  };
  if (typeof window !== 'undefined') window.Air = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
