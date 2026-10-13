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
 * A figure carrying `provisional: true` has no article yet. It still draws, so
 * the shape can be judged in the viewer, but it is not clickable and announces
 * itself as unfinished. Names may be present or not; what must never happen is
 * a name invented here to fill a gap, because the names belong to Krys.
 *
 * ON DRIFT. The Spear changes name at every layer and the other two do not, and
 * that is the system rather than an inconsistency. Krys ruled it on 2026-10-11:
 * where the myth behind a figure is common ground, the name holds; where some-
 * body had a reason to claim the figure, it moves. Marduk's astrologers renamed
 * a warrior because a four-hundred-day-old government needed a heaven that
 * agreed with it. Nobody gains by renaming the Green Mother.
 *
 * So a figure's name chain is evidence. Three different names means the figure
 * was contested and the sky recorded it. One name repeated means every tradition
 * inherited the same story and had no quarrel with it.
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
     * shared and the difference is carriage:
     *
     *   the Mother   both arms falling open, feet planted apart
     *   the Child    one arm raised and one lowered, feet drawn in
     *
     * That difference is canon, not decoration: the Gate "permits passage
     * outward in limited forms ... but not free ingress", so one hand bars and
     * one hand allows, which is the whole of what it does and it has been
     * standing in a doorway doing it since before recorded history.
     *
     * A crown was tried on the Mother and cut — Krys judged the Child's change
     * enough on its own, and he was right that two differentiators was one too
     * many. s040 and s075 stay in the sky above her head as field stars.
     *
     * Eight points each, in the same order — head, left shoulder, right
     * shoulder, left hand, right hand, hips, left foot, right foot — joined by
     * the same nine lines.
     */
    {
      id: 'mother',
      name: 'The Mother',
      article: '/articles/the-mother/',
      /* Imwei. 22 degrees wide by 45 tall. Six of the eight were already there:
         her sign had shoulders, hands and feet in usable places and wanted only
         a head and hips, which are s155 and s156.
         s008, at 0.966 the brightest star in the sign, ends up as a foot rather
         than the heart. That looked wrong until I remembered Rigel.
         Her legs were flipped on 2026-10-11 so the long one falls west. Her feet
         were the only seeded stars that had to move for it: s008 down 8.2 deg
         and s073 up 4.1, sharing the distance rather than either making the
         whole journey, which is why both now read as placed. */
      stars: ['s155', 's053', 's058', 's047', 's099', 's156', 's008', 's073'],
      lines: [
        ['s155', 's053'], ['s155', 's058'],   // head to either shoulder
        ['s053', 's058'],                     // across the shoulders
        ['s053', 's047'], ['s058', 's099'],   // both arms, spread and falling
        ['s053', 's156'], ['s058', 's156'],   // the torso closing on the hips
        ['s156', 's008'], ['s156', 's073']    // the legs, long west, planted apart
      ],
      // Oldest first, and the point is that the line does not move.
      names: [
        { tradition: 'Spirit', name: 'the Mother', note: 'Unchanged. They fought the war she ended, and have never needed another word for her.' },
        { tradition: "Drorn'Duur", name: 'the Mother', note: 'Unchanged. Taken from the spirits whole, as the story was.' },
        { tradition: "Aru'Mas", name: 'the Mother', note: 'Unchanged. There was nothing in her for anyone to claim.' }
      ],
      blurb: 'A standing figure with both arms spread and falling open and her ' +
             'feet planted, reaching from low in the south nearly to the top of ' +
             'the sky. The suns stand among her stars at the northward equinox, ' +
             'so she is lost to daylight on one of the Green Mother\'s four holy days.'
    },
    {
      id: 'child',
      name: 'The Dutiful Child',
      article: '/articles/the-dutiful-child/',
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
        ['s160', 's161'], ['s160', 's162']    // the legs, long west, drawn in together
      ],
      // Oldest first, and the point is that the line does not move.
      names: [
        { tradition: 'Spirit', name: 'the Dutiful Child', note: 'Unchanged. They watched it born and watched it hold.' },
        { tradition: "Drorn'Duur", name: 'the Dutiful Child', note: 'Unchanged. Inherited with its mother and its story.' },
        { tradition: "Aru'Mas", name: 'the Dutiful Child', note: 'Unchanged. It is their own gods it keeps out, and they mean the word anyway.' }
      ],
      blurb: 'His mother\'s build at two thirds her height, standing east of her ' +
             'with clear sky between. One arm is raised and one lowered, and his ' +
             'feet are together.'
    },

    /* ---- the folktale trio, 2026-10-11 ----
     *
     * Three figures from one story, in signs 2, 4 and 6 — spaced round the
     * belt rather than consecutive, so the tale is told across the year and the
     * named sky does not clump.
     *
     * Spaced, but not scattered, and the difference was measured rather than
     * guessed. Two signs six apart NEVER share a sky from Aru'Mas — zero nights
     * a year — and five apart manages only forty-nine. A first attempt put the
     * Cat and the Rooster opposite each other, which would have meant the
     * watchman could never once see the thief. The three now sit two signs apart
     * each, which is close enough that all three stand up together, and far
     * enough that no two are neighbours. The Cat is in the middle, which is
     * where the story puts her.
     *
     * The names hold across all three traditions, and for a different reason
     * than The Mother's do. Hers held because every tradition witnessed the
     * same event. These hold because the spirits WROTE the story and everyone
     * else has been retelling it ever since — Krys's model is Greek myth in
     * modern pop culture.
     *
     * The tale never needed translating either. A lord who holds land and tends
     * what lives on it is not a settler image borrowed by an older story; it is
     * a Claim, which is the oldest arrangement on these islands. Spirits had
     * territory, hierarchy and kept creatures long before anyone landed here.
     * An earlier version of this comment assumed otherwise and was wrong.
     */
    {
      id: 'coy',
      name: 'The Coy',
      article: '/articles/the-rooster-the-coy-and-the-cat/',
      /* Sign 6, and not one star placed. Of all the shapes in this sky this is
         the one that was most nearly already drawn: a pair of stars nine
         degrees apart making a mouth at the western end, a back and a belly
         running east, and s007 and s126 eighteen degrees apart at RA 339
         forking into a tail. Twenty degrees long by twenty-one deep, which is
         about the proportion of an actual fish — the Coy is the only figure
         here that did not have to be stretched to fit its animal. */
      stars: ['s105', 's082', 's111', 's081', 's007', 's126'],
      lines: [
        ['s105', 's082'],   // the mouth
        ['s105', 's111'],   // up over the head to the back
        ['s111', 's007'],   // the back, east to the tail
        ['s082', 's081'],   // the belly
        ['s081', 's126'],   // belly to the lower fork
        ['s007', 's126']    // the tail's trailing edge
      ],
      // Oldest first. The line does not move: see the note above.
      names: [
        { tradition: 'Spirit', name: 'the Coy', note: 'Theirs. They made the story; they still tell it with different scenery.' },
        { tradition: "Drorn'Duur", name: 'the Coy', note: 'Taken up whole, long before the city existed.' },
        { tradition: "Aru'Mas", name: 'the Coy', note: 'Taken up again. Most who use the name could not say where they learned it.' }
      ],
      blurb: 'A fish swimming west, twenty degrees long, its tail forked ' +
             'behind it. Not one of its stars was moved or placed.'
    },
    {
      id: 'cat',
      name: 'The Cat',
      article: '/articles/the-rooster-the-coy-and-the-cat/',
      /* Sign 2, central to the trio. A cat stalking: head low and west — the
         tight knot of s107, s030 and s097 inside four degrees makes a muzzle,
         a head and an ear — then the back rising to s148 and the haunch east.
         Two stars are placed, a foreleg and a raised tail; a quadruped with no
         front leg reads as a snake.
         She deliberately does NOT use s131 and s050, which lie at Dec -30 and
         -35 in the same sign and would have made a longer, lower cat. From
         Aru'Mas a star at Dec -35 never climbs past 20 degrees, so a figure
         reaching down to it is only ever wholly above the horizon for a narrow
         window — and that window did not overlap the Coy's at all. Keeping the
         Cat shallow is what lets her share a sky with the fish she is hunting.
         s043 is absent too: it is the butt of The Spear's haft. */
      stars: ['s107', 's030', 's097', 's148', 's033', 's163', 's166'],
      lines: [
        ['s107', 's030'], ['s030', 's097'],  // muzzle, head, ear
        ['s030', 's148'],                    // neck up to the back
        ['s148', 's033'],                    // the back, down to the haunch
        ['s148', 's163'],                    // the foreleg
        ['s033', 's166']                     // the tail, curling up behind
      ],
      // Oldest first. The line does not move: see the note above.
      names: [
        { tradition: 'Spirit', name: 'the Cat', note: 'Theirs, and the only character in the fable who is never given a reason.' },
        { tradition: "Drorn'Duur", name: 'the Cat', note: 'Unchanged. A fable offers nobody anything to gain by renaming it.' },
        { tradition: "Aru'Mas", name: 'the Cat', note: 'Unchanged, down to the rude verse the children add.' }
      ],
      blurb: 'A cat stalking, head low to the west, back arched, tail curled ' +
             'up behind. Her muzzle, head and ear are three stars inside four degrees.'
    },
    {
      id: 'rooster',
      name: 'The Rooster',
      article: '/articles/the-rooster-the-coy-and-the-cat/',
      /* Sign 4 is the thinnest on the suns' road — four stars — but they are
         all bright and they already stood as a bird: a head high east, a tail
         high west, and the body slung low between them. Four stars are placed:
         a comb, a second foot, and the tail tip that fixed the proportions.
         Built on the four alone the bird was 15 degrees wide by 64 tall, which
         is one to four and stretched even for something that stands upright.
         Carrying the tail out to the western end of the sign, bringing the comb
         down and drawing the feet level gives 24 by 57 — and a tail sweeping
         back and up is the one line a rooster cannot do without. */
      stars: ['s164', 's054', 's051', 's167', 's011', 's003', 's165'],
      lines: [
        ['s164', 's054'],                    // comb above the head
        ['s054', 's051'],                    // the back, head to the tail root
        ['s051', 's167'],                    // and out to the tail tip
        ['s054', 's011'],                    // down the breast
        ['s051', 's011'],                    // the underside, closing the body
        ['s011', 's003'], ['s011', 's165']   // two feet, side by side
      ],
      // Oldest first. The line does not move: see the note above.
      names: [
        { tradition: 'Spirit', name: 'the Rooster', note: 'Theirs. The one who watches, says nothing, and understands by the second day.' },
        { tradition: "Drorn'Duur", name: 'the Rooster', note: 'Unchanged through the whole stone-priest era.' },
        { tradition: "Aru'Mas", name: 'the Rooster', note: 'Unchanged. Four hundred years and nobody improved on it.' }
      ],
      blurb: 'A bird with its head high to the east and its tail high to the ' +
             'west, standing on two feet between them. Watching.'
    }
  ];
})();
