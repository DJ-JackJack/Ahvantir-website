/* Old article URLs that must keep working.
 *
 * An article's URL is slugified from its `title:`, so retitling a note in the
 * vault silently moves its page. Anyone holding the old link gets a 404, and
 * because the sync used to never prune, the usual symptom was worse: the old
 * page stayed up serving stale content forever.
 *
 * GitHub Pages cannot issue a 301, so each entry becomes a tiny page that
 * canonicalises to the new URL and sends the reader on. Search engines honour
 * the rel=canonical; people just arrive.
 *
 * Adding one is a single line here. Keep them: a redirect is cheap and a dead
 * link is not. Only remove one if you are certain nothing points at it.
 */
module.exports = [
  {
    from: "/articles/sunspear-legion/",
    to: "/articles/the-sunspear-legion/",
    // The note was filed as "Sunspear Legion.md" but titled "The Sunspear
    // Legion". 86 wikilinks across 46 notes pointed at the old slug and only
    // resolved because a stale copy of the article was still published there.
    // Vault note renamed and links repointed 2026-10-02.
    why: "retitled: gained its leading 'The'",
  },
];
