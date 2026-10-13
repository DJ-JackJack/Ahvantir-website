/* disc-scale.js — how big a disc is drawn, and where.
 *
 * Two pure functions, pulled out of sky.js so they can be tested. They exist to
 * keep one promise: AN OVERLAP ON SCREEN IS ALWAYS A REAL ONE. The event list
 * in orbits.js decides what is touching what from true angular radii, and the
 * picture has to agree with it, on the same page, at the same minute.
 *
 * That promise was broken twice before this file existed. First the radii were
 * magnified three times while the gaps between bodies were left alone, so a
 * moon two degrees from a sun was painted sitting on it — 170 pair-hours a year
 * of transits that were not happening. Then the fix shrank a disc as its
 * neighbour closed in, which kept the picture honest by taking the
 * magnification away at exactly the moment anyone wanted to look.
 *
 * What is here is Beas's answer, read out of the Rolara sky's source: magnify
 * the GAP by the same factor as the discs, and only in the neighbourhood where
 * an overlap is possible. The trick that makes it work — and the one I failed
 * to find on my own — is to interpolate the drawn DISTANCE linearly between two
 * fixed points rather than blending the scale factor, which is what keeps it
 * monotonic as two bodies converge.
 *
 * Classic script exposing a global, matching marducian.js and orbits.js.
 * Tested by scripts/test-orbits.js.
 */
(function () {
  'use strict';

  // No disc is ever drawn smaller than this, in device pixels.
  var MIN_DISC = 3;

  /* One scale for every disc, never one per body.
   *
   * A floor applied to each disc separately flattens the small ones up to the
   * size of the large and takes the proportions with it — and the proportions
   * are the whole point of looking at a sky with two suns of different sizes.
   * Raising the single shared factor instead keeps every disc true to every
   * other, however small the view makes them.
   *
   *   radii   true angular radii in degrees, one per body
   *   base    1 for true size, 3 for the magnified view
   *   sc      pixels per degree
   *   dpr     device pixel ratio
   */
  function discScale(radii, base, sc, dpr) {
    var least = Infinity;
    for (var i = 0; i < radii.length; i++) if (radii[i] < least) least = radii[i];
    if (!isFinite(least) || least <= 0 || !(sc > 0)) return base;
    return Math.max(base, (MIN_DISC * dpr) / (least * sc));
  }

  /* Push a point away from an anchor so that a magnified overlap is a true one.
   *
   *   p, anchor   screen points
   *   c           the on-screen distance at which the TRUE discs just touch,
   *               i.e. (r1 + r2) * pixels-per-degree
   *   g           the factor the radii are being drawn at
   *
   * Inside c the offset is multiplied by g, exactly as the radii are, so the
   * drawn discs meet precisely when the true ones do. From c out to 2gc the
   * drawn offset eases back to the truth, and past 2gc nothing moves at all.
   * A body is therefore never displaced by more than about (g-1)*c, and only
   * ever beside something it is nearly touching.
   */
  function spreadPoint(p, anchor, c, g) {
    var dx = p.x - anchor.x, dy = p.y - anchor.y;
    var s = Math.sqrt(dx * dx + dy * dy);
    var S = 2 * Math.max(g, 1) * c;
    if (Math.abs(g - 1) < 1e-6 || !s || s >= S || !(c > 0)) return p;
    var drawn = s <= c ? g * s : g * c + (s - c) * (S - g * c) / (S - c);
    return { ok: p.ok, x: anchor.x + dx * drawn / s, y: anchor.y + dy * drawn / s };
  }

  window.DiscScale = { MIN_DISC: MIN_DISC, discScale: discScale, spreadPoint: spreadPoint };
})();
