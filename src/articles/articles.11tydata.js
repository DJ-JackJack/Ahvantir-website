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
    // Reproducing the default URL shape, because a computed permalink is the
    // only way to stop a draft being written at all.
    //
    // This file governs EVERY file in src/articles/, and eleventyComputed beats
    // a page's own frontmatter. The Articles index used to live here as
    // index.njk, so it lost its declared `permalink: /articles/` and was
    // rebuilt at /articles/articles/ — fileSlug for an index file being the
    // directory name — which 404'd the site's main nav link while every
    // individual article still worked. Guarding on the file extension instead
    // only made it worse: reading data.permalink from inside the computed
    // permalink is self-referential, and Eleventy then failed the build with
    // "Having trouble writing to false" while still writing the draft.
    //
    // The index now lives at src/articles-index.njk, outside this directory, so
    // this rule applies only to the generated articles and needs no exceptions.
    permalink: (data) =>
      data.draft ? false : `/articles/${data.page.fileSlug}/`,

    eleventyExcludeFromCollections: (data) =>
      data.draft ? true : data.eleventyExcludeFromCollections,
  },
};
