/* constellations.js — the figures, and who calls them what.
 *
 * One geometry per figure. The shape is the sky's own and does not change; what
 * changes is who is looking and what they call it. Each figure therefore
 * carries a stack of names rather than belonging to a tradition, because the
 * traditions here are sedimentary and not separate: the spirits named these
 * first, the Drorn'Duur inherited and re-read them, and Aru'Mas inherited again
 * and re-read them once more. A figure almost never changes character across
 * that chain — a warrior stays a warrior — and the places where it does are the
 * interesting ones.
 *
 * Spirits do not change, so the oldest layer is not archaeology: a Warden still
 * uses its own name for these and has done since before the city existed. The
 * oldest reading is the one most easily checked, and the newest the one most
 * easily caught.
 *
 * Stars are referenced by id from stars-bright.js. Lines are pairs of those ids.
 * That file is editable while the figures are being invented, which is why ids
 * are stable labels and must never be renumbered: a renumbering would move every
 * figure here at once.
 *
 * A figure carrying `provisional: true` is a GEOMETRY SKETCH and nothing more.
 * Its shape is a proposal, it has no article, and it has no chain of names,
 * because the names belong to Krys and inventing them is the one thing this
 * project does not do. Such a figure still draws, so the shape can be judged in
 * the viewer, but it is not clickable and announces itself as unfinished.
 */
(function () {
  'use strict';

  window.Constellations = [
    {
      id: 'spear',
      name: 'The Spear',
      article: '/articles/the-spear/',
      /* s019 is the point, and the only star here that was not chosen: it is
         the brightest in this part of the sky and it sits eight degrees from
         where the suns merged in 0 MC. The rest were moved or placed to make
         the blade and straighten the haft. */
      stars: ['s019', 's153', 's151', 's152', 's029', 's136', 's043'],
      lines: [
        // the blade: a leaf closing on the haft
        ['s019', 's151'], ['s151', 's153'], ['s153', 's152'], ['s152', 's019'],
        // the haft, straight from the blade to the butt
        ['s153', 's029'], ['s029', 's136'], ['s136', 's043']
      ],
      // Oldest first.
      names: [
        { tradition: 'Spirit', name: 'the Lancer', note: 'Still current. The Wardens have not stopped using it.' },
        { tradition: "Drorn'Duur", name: 'the Warrior', note: 'Inherited from the spirits and re-read; the figure kept its character.' },
        { tradition: "Aru'Mas", name: 'the Spear', note: 'Claimed for Marduk after the sealing of 0 MC.' }
      ],
      blurb: 'A long shaft along the ecliptic with a bright point at its head, ' +
             'aimed at the patch of sky where the two suns merged in 0 MC. The ' +
             'suns stand inside it every 34 Lochenvir.'
    },

    /* ---- provisional sketches, 2026-10-11 ----
     *
     * Krys named these two and set their signs. Both grow out of one event: the
     * end of the Divine War, where Imwei gave of herself and the Divine Gate was
     * born rather than built, carrying the nature of both its parents.
     *
     * The shapes below are mine and are meant to be redrawn. No stars were moved
     * or placed for either — these are the stars that were already there, so what
     * the viewer shows is the raw material rather than a flattered version of it.
     */
    /* ONE SKELETON, TWO FIGURES.
     *
     * Krys asked that these read as human, resemble each other, and stand
     * further apart. The resemblance is therefore structural rather than a
     * matter of drawing: both carry the same eight points in the same order —
     * head, left shoulder, right shoulder, left hand, right hand, hips, left
     * foot, right foot — and the same nine lines joining them. Change the
     * skeleton in one and it must change in the other.
     *
     * What differs is scale. The Child is built at 65% of the Mother, which is
     * what makes one of them a child without either stopping being a person.
     */
    {
      id: 'mother',
      name: 'The Mother',
      provisional: true,
      /* Imwei. 22 degrees wide by 45 tall. Six of the eight were already there:
         her sign had shoulders, hands and feet in usable places and wanted only
         a head and hips, which are s155 and s156.
         s008, at 0.966 the brightest star in the sign, ends up as a foot rather
         than the heart. That looked wrong until I remembered Rigel.
         Her two brightest neighbours, s040 and s075, stand just above her head
         and are deliberately NOT in the figure. They would make a crown — which
         her article supports, hair of living vines and flowering growth — but a
         crown is exactly the kind of flourish that stops her resembling her son.
         Adding them back is two lines and is the first thing to try if the pair
         ever look too alike. */
      stars: ['s155', 's053', 's058', 's047', 's099', 's156', 's008', 's073'],
      lines: [
        ['s155', 's053'], ['s155', 's058'],   // head to either shoulder
        ['s053', 's058'],                     // across the shoulders
        ['s053', 's047'], ['s058', 's099'],   // the arms, spread and falling
        ['s053', 's156'], ['s058', 's156'],   // the torso closing on the hips
        ['s156', 's008'], ['s156', 's073']    // and the legs
      ],
      blurb: 'A standing figure with her arms spread and falling open, reaching ' +
             'from low in the south nearly to the top of the sky. The suns stand ' +
             'among her stars at the northward equinox, so she is lost to ' +
             'daylight on one of the Green Mother\'s four holy days.'
    },
    {
      id: 'child',
      name: 'The Dutiful Child',
      provisional: true,
      /* The Divine Gate. The same figure at 65% — 14 degrees wide by 29 tall.
         Sign 8 is the emptiest in the belt and held four stars, no two of which
         could be a pair of shoulders, so six of these eight are placed. Only
         s106 and s150 were already in the right places, and they are the left
         shoulder and left hand exactly where they stood.
         s149 and s128 are left out. s149 lay west, toward his mother, and
         dropping it is what widens the gap between the two figures from six
         degrees to eleven. */
      stars: ['s157', 's106', 's158', 's150', 's159', 's160', 's161', 's162'],
      lines: [
        ['s157', 's106'], ['s157', 's158'],   // head to either shoulder
        ['s106', 's158'],                     // across the shoulders
        ['s106', 's150'], ['s158', 's159'],   // the arms, spread and falling
        ['s106', 's160'], ['s158', 's160'],   // the torso closing on the hips
        ['s160', 's161'], ['s160', 's162']    // and the legs
      ],
      blurb: 'The same figure as his mother and two thirds her height, standing ' +
             'east of her with clear sky between them.'
    }
  ];
})();
