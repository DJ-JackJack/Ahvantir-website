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
    {
      id: 'mother',
      name: 'The Mother',
      provisional: true,
      /* Imwei. Eight stars, all seeded, spanning 22 degrees of right ascension
         and 63 of declination — a tall figure for a deity her own article calls
         a tall woman whose form is the forest. There is a near-vertical spine at
         RA 356-357 (s040 crown, s053, s008) that the shape is hung on, and s047
         and s099 sit at almost the same declination 22 degrees apart, which is
         what suggested arms held level. s008, brightest in the sign at 0.966, is
         the heart rather than an extremity, so the figure's weight is central. */
      stars: ['s040', 's053', 's058', 's075', 's047', 's099', 's008', 's073'],
      lines: [
        ['s040', 's053'],   // the crown, high and alone
        ['s053', 's058'],   // across the shoulders
        ['s053', 's047'],   // the west arm, reaching down
        ['s058', 's099'],   // the east arm, level with it
        ['s058', 's075'],   // growth rising off the east shoulder
        ['s053', 's008'],   // the trunk, down to the heart
        ['s008', 's073']    // and the root below it
      ],
      blurb: 'A crowned figure with arms held level and a bright heart, standing ' +
             'from low in the south almost to the top of the sky. The suns stand ' +
             'among her stars at the northward equinox, so she is lost to ' +
             'daylight on one of the Green Mother\'s four holy days.'
    },
    {
      id: 'child',
      name: 'The Dutiful Child',
      provisional: true,
      /* The Divine Gate. Four stars and not one brighter than 0.569 — the
         faintest sign of the thirteen by a wide margin, which is a fact about
         the seed scatter and not a statement about the Gate. They do make a
         simple four-sided frame, which is at least the right idea for a gate,
         but it is lopsided and dim. This is the figure that most needs a ruling:
         place stars, move the Child, or keep it faint on purpose. */
      stars: ['s149', 's106', 's128', 's150'],
      lines: [
        ['s149', 's106'],   // the lintel
        ['s106', 's128'],   // the eastern post, long and faint
        ['s128', 's150'],   // the threshold
        ['s150', 's149']    // the western post
      ],
      blurb: 'A lopsided frame of four faint stars. Nothing in it is bright, and ' +
             'it has to be looked for.'
    }
  ];
})();
