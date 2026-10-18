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
 * ON DRIFT. Where the myth behind a figure is common ground the name holds;
 * where somebody had a reason to claim the figure, it moves. Krys ruled that on
 * 2026-10-11. Marduk's astrologers renamed a warrior because a four-hundred-
 * day-old government needed a heaven that agreed with it. Nobody gains by
 * renaming the Green Mother.
 *
 * ON WHAT IS MISSING, AND WHY SOME OF IT IS NOT. Krys ruled on 2026-10-17 that
 * full chains "wouldn't, and arguably couldn't be that clean. Some are simply
 * taken from the original spirit myth directly, and the ones that weren't went
 * through a culture that was essentially driven nearly to extinction and
 * systematically removed from records."
 *
 * He ruled twice, because the first version of this comment turned that into
 * an absolute and the truth is not one: "Much of the Drorn'Durrs culture was
 * buried, and purposefully so, the early leadership of Aru'Mas didn't want
 * their new homelands history to begin with the bloody, and near complete,
 * genocide of the lands former people. But no one can perfectly erase the
 * past, and Ahvantir is a land of inquisitive and exploratory people and some
 * kept pieces of the Drorn'Durrs story from vanishing."
 *
 * Two deliberate acts, then, not one accident. A city buried a history it did
 * not want to open with, and people went on keeping pieces of it anyway, at
 * some cost -- their own article has scholars, historians and spirit-binders
 * who still find their inquiries "discouraged by institutions with reasons to
 * keep the founding story intact."
 *
 * So read a `names` array for what it is and not for what it lacks:
 *
 *   THREE NAMES is uncommon, and is somebody's doing rather than luck. It
 *   means the figure was contested AND that the middle reading was kept by
 *   someone who meant to keep it. The Spear is the one that has it.
 *
 *   ONE NAME REPEATED means the story was common ground. These were ruled
 *   individually; the Mother is the Mother in all three mouths because Krys
 *   said so, not because the field was filled in three times.
 *
 *   NO ARRAY AT ALL is the ordinary state of this sky and is NOT a to-do. A
 *   figure with one name is finished. It is not, however, a closed door: if a
 *   Drorn'Duur reading for one of these ever turns up it will arrive the way
 *   they do -- somebody kept it -- and not as a blank being filled in.
 *
 * The mistake this comment used to invite, and which I made for six days, is
 * reading an absent name as a silence waiting on Krys. It is not. But nor is
 * it proof of nothing having been there, and swinging to THAT was the second
 * mistake, made and corrected inside an hour on 2026-10-17.
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
    },

    /* ---- the seven remaining signs, named by Krys 2026-10-17 ----
     *
     * He gave a name and a reading for each; the geometry below is mine and is
     * meant to be redrawn. Every figure is built from stars that were already
     * in the sign -- nothing was moved to flatter a shape -- except the Sword,
     * which had nothing to build from and is noted in stars-bright.js.
     *
     * ONE NAME EACH, AND THAT IS THE FINISHED STATE. These carry the single
     * name Krys gave and are not waiting on chains. Some are the spirit myth
     * taken over directly; for the rest the Drorn'Duur reading was buried with
     * the Drorn'Duur, deliberately, by a city that preferred a different
     * founding story. Buried is not the same as gone -- see ON WHAT IS
     * MISSING at the top of this file -- but it is not ours to dig up.
     *
     * The Crown and the Sword are still plainly Aru'Mas claims on a sky older
     * than the city, which is worth knowing when they are written up. It is an
     * observation about what the names say. It is not a missing field.
     */
    {
      id: 'hand',
      name: 'The Hand',
      article: '/articles/the-hand/',
      /* A hand reaching up with the fingers spread: wrist low, knuckles on
         s004 (the brightest here), three digits rising and a thumb thrown
         west. Sixteen stars sit in this sign and eight are used, which keeps the
         fingers distinct instead of crowding them.

         A caution for whoever writes this up, because I got it wrong once.
         This sign's story has Marduk casting his spear to pin the Hand of
         Gahr to the heavens. The figure Aru'Mas calls THE SPEAR is not that
         weapon. It is an older figure under two older names, claimed for
         Marduk long afterwards, at the sealing of 0 MC. The two share a
         character and nothing else.

         So do not go looking for the one to point at the other, and do not
         report it as a finding when it does not. I measured the angle between
         them, found 53 degrees, and offered it as evidence against the myth —
         which was measuring the distance between two things that were never
         claimed to touch. */
      stars: ['s110', 's086', 's004', 's140', 's041', 's025', 's092', 's057'],
      lines: [
        ['s110', 's086'], ['s086', 's004'],
        ['s004', 's140'], ['s140', 's041'],
        ['s004', 's092'], ['s092', 's057'],
        ['s086', 's025']
      ],
      blurb: 'A hand open and reaching, knuckles on the brightest star in the ' +
             'sign and the thumb thrown west. Named for the Hand of Gahr.'
    },

    {
      id: 'lady',
      name: 'The Lady',
      article: '/articles/the-lady/',
      /* Narrow at the head and spreading to a hem, with the veil swept to one
         side only -- which is what keeps her from reading the same mirrored.
         s002 is the Ladies Gaze and sits at the top, because a figure nobody
         can identify should still be looking at you.

         Built first from all seven usable stars in the sign and cut back to
         five. s113 at dec +35.7 and s129 at -29.6 made her sixty-five degrees
         tall -- taller than anything else in the sky, where the established
         six run five to fifty-seven. At forty-seven she is exactly the
         Mother's height, which for a second standing woman is the right
         company to keep. */
      stars: ['s002', 's038', 's139', 's087', 's121'],
      lines: [
        ['s002', 's038'], ['s038', 's087'], ['s087', 's121'],
        ['s002', 's139'], ['s139', 's121']
      ],
      blurb: 'A veiled figure, narrow at the head and spreading to a hem, with ' +
             'the Ladies Gaze at the top. Thieves and night travellers both ' +
             'have reason to address her.'
    },

    {
      id: 'dreamer',
      name: 'The Dreamer',
      article: '/articles/the-dreamer/',
      /* Reclining, head east and feet west, with one arm fallen away south.
         That dropped arm is a thirty-nine degree reach and it is the whole
         figure: without it this is a line of stars, and with it somebody is
         asleep. */
      stars: ['s095', 's026', 's076', 's119', 's098', 's014'],
      lines: [
        ['s095', 's026'], ['s026', 's076'],
        ['s026', 's119'], ['s119', 's098'],
        ['s026', 's014']
      ],
      blurb: 'A sleeper lying with the head east and one arm fallen away ' +
             'beneath. The sign of Nodd, named after the Shattered Strand.'
    },

    {
      id: 'serpent',
      name: 'The Coiled Serpent',
      provisional: true,
      /* One unbroken line through all six usable stars in the sign, and the
         only figure here that needed no choosing: the stars already lie in an
         S. Head high in the north, body doubling back twice, tail south. */
      stars: ['s010', 's069', 's037', 's055', 's028', 's015'],
      lines: [
        ['s010', 's069'], ['s069', 's037'], ['s037', 's055'],
        ['s055', 's028'], ['s028', 's015']
      ],
      blurb: 'A single winding line, head raised in the north and the body ' +
             'doubling back twice to a tail in the south. Medicine, renewal ' +
             'and grace.'
    },

    {
      id: 'crown',
      name: 'The Crown',
      article: '/articles/the-crown/',
      /* Points and valleys, west to east. The sign is the richest unclaimed
         one -- fourteen catalogue stars -- so this uses only the six that
         alternate cleanly and leaves the rest as field.

         It comes out taller than a crown ought to be, thirty-five degrees by
         fifteen, because the stars here are spread in declination and not in
         right ascension. Marduk called the Crown the heaviest burden fate
         could place on a man, so an imposing one is not the worst outcome,
         but this is the figure most likely to want redrawing. */
      stars: ['s045', 's144', 's104', 's065', 's134', 's042'],
      lines: [
        ['s045', 's144'], ['s144', 's104'], ['s104', 's065'],
        ['s065', 's134'], ['s134', 's042']
      ],
      blurb: 'A band of points and valleys running west to east, rising to its ' +
             'highest at the eastern end. The duty of the royal house.'
    },

    {
      id: 'dancer',
      name: 'The Dancer',
      article: '/articles/the-dancer/',
      /* Mid-step and deliberately lopsided: one arm flung east to s109, one
         leg kicked east to s017, the other foot planted southwest. A dancer
         caught symmetrical is a dancer standing still. */
      stars: ['s052', 's048', 's022', 's089', 's109', 's061', 's006', 's017'],
      lines: [
        ['s052', 's048'], ['s052', 's022'],
        ['s022', 's109'], ['s022', 's089'], ['s089', 's061'],
        ['s048', 's061'], ['s061', 's006'], ['s061', 's017']
      ],
      blurb: 'A figure mid-step, one arm flung east and one leg kicked after ' +
             'it. At its height the city keeps the Festival of Folly.'
    },

    {
      id: 'sword',
      name: 'The Sword',
      article: '/articles/the-sword/',
      /* Laid down, not raised. Krys's reading is the weapons set aside between
         spirits and humans, so the blade lies flat across the sign: point west
         on s001 -- Piercers Point, the brightest star in the sky -- and the
         hilt east, nearest the Spear's own sign.

         Five of its six stars are placed; see stars-bright.js. This sign had
         nothing else to build from. */
      stars: ['s001', 's168', 's169', 's170', 's171', 's172'],
      lines: [
        ['s001', 's168'], ['s168', 's169'],
        ['s170', 's169'], ['s169', 's171'],
        ['s169', 's172']
      ],
      blurb: 'A sword lying flat, point west on the brightest star in the sky ' +
             'and the hilt east. The weapons laid down, and the promise not to ' +
             'take them up again.'
    }
  ];
})();
