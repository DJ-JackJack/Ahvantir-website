/* Directory data for src/articles/.
 *
 * Replaces the old articles.json so that `draft` can actually do something.
 *
 * The collections in .eleventy.js filter on !p.data.draft, which only removes
 * a draft from listings. Eleventy still WRITES its page, so a draft article was
 * live at its own URL, readable by anyone with the link and indexed by the site
 * search. Verified by building one: the page existed at /articles/<slug>/ and
 * its text was in the Pagefind index while the article appeared nowhere in any
 * listing. That is the worst shape for a mistake like this, because the DM sees
 * it missing from the index and concludes it is not published.
 *
 * Returning permalink:false stops the page being written at all, and excluding
 * drafts from collections keeps them out of /play/, the graph and the search
 * index too.
 */
module.exports = {
  layout: "article",
  tags: [],
  backlinks: [],

  eleventyComputed: {
    // No article sets its own permalink, so the default shape is reproduced
    // here rather than inherited. If one ever needs a custom URL, add it here.
    permalink: (data) =>
      data.draft ? false : `/articles/${data.page.fileSlug}/`,

    eleventyExcludeFromCollections: (data) =>
      data.draft ? true : data.eleventyExcludeFromCollections,
  },
};
