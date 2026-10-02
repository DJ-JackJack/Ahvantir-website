/* map-coords.js — the ONLY place the map's two coordinate systems meet.
 *
 * Database:  pixels in the map image, origin TOP-LEFT, y increasing downward.
 * Leaflet:   L.CRS.Simple, where lat increases UPWARD from the bottom and lng
 *            is the horizontal axis. So lat = imageHeight - y, lng = x.
 *
 * Why this is its own file. The conversion is crossed four times in a single
 * edit (database to Leaflet on load, Leaflet to database on save, then again on
 * the next load). If one direction forgets the flip, shapes do not vanish, they
 * drift toward the opposite edge a little further on every save, which reads as
 * "the map is slightly off" rather than as a bug. Importing the World Anvil data
 * earlier in this project hit exactly that class of error and put every district
 * in the wrong place while every shape still looked plausible.
 *
 * Rules for anyone editing this file:
 *   - imageHeight comes from the `maps` row, never from the loaded <img>. A
 *     re-exported image with different dimensions must not silently move every
 *     saved marker.
 *   - These functions are pure. No Leaflet map, no DOM, no database.
 *   - If you change one, change the other, and run selfTest().
 */
(function () {
  'use strict';

  /* Database pixel -> Leaflet LatLng. */
  function toLatLng(x, y, imageHeight) {
    return L.latLng(imageHeight - y, x);
  }

  /* Leaflet LatLng -> database pixel. Rounded to whole pixels: the source data
     is integer pixels, and float drift would make every save a diff. */
  function fromLatLng(latlng, imageHeight) {
    return { x: Math.round(latlng.lng), y: Math.round(imageHeight - latlng.lat) };
  }

  /* A polygon's outer ring, as [[x, y], ...] in database pixels.
     L.Polygon.getLatLngs() is NESTED: [[LatLng, ...]] for a simple polygon and
     [outer, hole, ...] when it has holes. Taking [0] is deliberate — this
     schema stores a single ring and does not support holes. */
  function ringFromLayer(layer, imageHeight) {
    var rings = layer.getLatLngs();
    var outer = Array.isArray(rings[0]) ? rings[0] : rings;
    return outer.map(function (ll) {
      var p = fromLatLng(ll, imageHeight);
      return [p.x, p.y];
    });
  }

  /* [[x, y], ...] -> the LatLng array Leaflet wants. */
  function ringToLatLngs(points, imageHeight) {
    return points.map(function (p) { return toLatLng(p[0], p[1], imageHeight); });
  }

  /* Is this geometry safe to save? Returns null when fine, else a reason.
     Catches the two shapes that save cleanly and then cannot be recovered in
     the UI: a point dragged off the image, and a polygon whose vertices have
     been deleted down below three. */
  function validate(kind, geometry, mapRow) {
    var w = mapRow.image_width, h = mapRow.image_height;
    if (kind === 'point') {
      if (!geometry || typeof geometry.x !== 'number' || typeof geometry.y !== 'number') {
        return 'Marker has no position.';
      }
      if (geometry.x < 0 || geometry.x > w || geometry.y < 0 || geometry.y > h) {
        return 'Marker is outside the map image. Drag it back inside before saving.';
      }
      return null;
    }
    if (!Array.isArray(geometry) || geometry.length < 3) {
      return 'An area needs at least three corners.';
    }
    if (geometry.length > 500) {
      return 'An area cannot have more than 500 corners (this one has ' + geometry.length + ').';
    }
    for (var i = 0; i < geometry.length; i++) {
      var p = geometry[i];
      if (!Array.isArray(p) || p.length !== 2 ||
          typeof p[0] !== 'number' || typeof p[1] !== 'number' ||
          !isFinite(p[0]) || !isFinite(p[1])) {
        return 'Corner ' + (i + 1) + ' is not a valid position.';
      }
    }
    return null;
  }

  /* Round-trips a set of known points and throws if any fails to come back.
     Called once when the editor boots, so a broken conversion is caught before
     the DM has drawn anything rather than after they have saved over good data. */
  function selfTest(imageHeight) {
    var cases = [[0, 0], [4962, 3508], [3112, 338], [1793, 2392], [1, imageHeight - 1]];
    for (var i = 0; i < cases.length; i++) {
      var x = cases[i][0], y = cases[i][1];
      var back = fromLatLng(toLatLng(x, y, imageHeight), imageHeight);
      if (back.x !== x || back.y !== y) {
        throw new Error('map-coords round trip failed: (' + x + ',' + y + ') came back as (' +
                        back.x + ',' + back.y + ') at height ' + imageHeight);
      }
    }
    return true;
  }

  window.MapCoords = {
    toLatLng: toLatLng,
    fromLatLng: fromLatLng,
    ringFromLayer: ringFromLayer,
    ringToLatLngs: ringToLatLngs,
    validate: validate,
    selfTest: selfTest,
  };
})();
