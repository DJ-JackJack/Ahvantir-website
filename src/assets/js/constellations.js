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
    /* ONE SKELETON, TWO POSTURES.
     *
     * Krys asked that these read as human and resemble each other. Built on one
     * skeleton at two scales they came out *too* alike — the same silhouette
     * twice, which is a photocopy and not a family. So the body plan is still
     * shared and the difference is now carriage:
     *
     *   the Mother   crowned, both arms falling open, feet planted apart
     *   the Child    uncrowned, one arm raised and one lowered, feet drawn in
     *
     * Both differences are canon rather than decoration. Her article gives her
     * hair of living vines and flowering growth, which is the crown. And the
     * Gate "permits passage outward in limited forms ... but not free ingress"
     * — one hand says stop and one hand lets through, which is the whole of
     * what it does, standing in a doorway forever doing it.
     *
     * Eight shared points in the same order — head, left shoulder, right
     * shoulder, left hand, right hand, hips, left foot, right foot — joined by
     * the same nine lines. The Mother carries two further stars for the crown.
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
         s040 and s075 are the crown, added when the pair proved too alike. They
         are her two brightest neighbours, they were already standing above her
         head, and they are uneven — one high and nearly over her, one off to the
         east — which is the right shape for hair of living vines and a wrong
         shape for a diadem. */
      stars: ['s155', 's053', 's058', 's047', 's099', 's156', 's008', 's073',
              's040', 's075'],
      lines: [
        ['s155', 's053'], ['s155', 's058'],   // head to either shoulder
        ['s053', 's058'],                     // across the shoulders
        ['s053', 's047'], ['s058', 's099'],   // both arms, spread and falling
        ['s053', 's156'], ['s058', 's156'],   // the torso closing on the hips
        ['s156', 's008'], ['s156', 's073'],   // the legs, planted apart
        ['s155', 's040'], ['s155', 's075']    // and the crown growing off her head
      ],
      blurb: 'A crowned figure with both arms spread and falling open and her ' +
             'feet planted, reaching from low in the south nearly to the top of ' +
             'the sky. The suns stand among her stars at the northward equinox, ' +
             'so she is lost to daylight on one of the Green Mother\'s four holy days.'
    },
    {
      id: 'child',
      name: 'The Dutiful Child',
      provisional: true,
      /* The Divine Gate. His mother's build at about two thirds her height.
         Sign 8 is the emptiest in the belt and held four stars, no two of which
         could be a pair of shoulders, so six of these eight are placed. Only
         s106 and s150 were already in the right places, and they are the left
         shoulder and the lowered left hand exactly where they stood.
         The posture is the difference between the two figures. His right arm
         goes up and out to s159 while his left falls to s150, and his feet are
         drawn in under him rather than planted. One hand bars and one hand
         allows, which is precisely the Gate's remit — it lets influence out and
         nothing in — and a figure standing in a doorway with its feet together
         is a figure that has been there a long time.
         s149 and s128 are left out. s149 lay west, toward his mother, and
         dropping it is what widens the gap between the two figures from six
         degrees to eleven. */
      stars: ['s157', 's106', 's158', 's150', 's159', 's160', 's161', 's162'],
      lines: [
        ['s157', 's106'], ['s157', 's158'],   // head to either shoulder
        ['s106', 's158'],                     // across the shoulders
        ['s106', 's150'], ['s158', 's159'],   // one arm down, one arm raised
        ['s106', 's160'], ['s158', 's160'],   // the torso closing on the hips
        ['s160', 's161'], ['s160', 's162']    // the legs, drawn in together
      ],
      blurb: 'His mother\'s build at two thirds her height, standing east of her ' +
             'with clear sky between. One arm is raised and one lowered, and his ' +
             'feet are together.'
    }
  ];
})();
