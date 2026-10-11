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
 * Stars are referenced by id from stars-bright.js, which is frozen for exactly
 * this reason. Lines are pairs of those ids.
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
    }
  ];
})();
