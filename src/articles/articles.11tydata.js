const fs = require("fs");

/* A description for an article that does not declare one.
 *
 * 26 of the 244 articles set `description` in their front matter. The other
 * 218 fell through to the site-wide blurb, which meant every one of them
 * shared a single sentence as its <meta name="description"> and as the text
 * under its title in a Discord embed or a search result. Two hundred pages
 * described identically is worse than no description at all: it tells a
 * search engine the pages are duplicates.
 *
 * Taken from the article's own opening paragraph, which is where an
 * encyclopedia entry says what its subject is. Read from the markdown rather
 * than the rendered HTML because the data cascade runs before templates do.
 *
 * Deliberately NOT written into `description`: that key drives the standfirst
 * printed under the title, and a lead paragraph that merely repeats the
 * sentence below it is the duplication this whole pass has been removing.
 * This is a separate key that only the <head> reads.
 */
function openingSentence(inputPath) {
  let raw;
  try {
    raw = fs.readFileSync(inputPath, "utf8");
  } catch (_) {
    return "";
  }

  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

  let para = "";
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) {
      if (para) break;      // blank line after text ends the paragraph
      continue;
    }
    // Headings, quotes, tables, lists, fences and Obsidian callouts are not
    // the opening sentence; skip them until real prose starts.
    if (/^(#{1,6}\s|>|\||```|:::|!\[|[-*+]\s|\d+\.\s)/.test(t)) {
      if (para) break;
      continue;
    }
    para += (para ? " " : "") + t;
  }
  if (!para) return "";

  const text = para
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (m, target, alias) =>
      alias || String(target).split("#")[0])          // wikilinks to their text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")          // markdown links
    .replace(/[*_`]/g, "")                            // emphasis and code ticks
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= 160) return text;
  // Cut at a word boundary so the preview does not end mid-word.
  const cut = text.slice(0, 157);
  const space = cut.lastIndexOf(" ");
  return (space > 80 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, "") + "\u2026";
}

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
    // What the <head> hands to a crawler or a link preview. The author's own
    // description wins when there is one.
    socialDescription: (data) =>
      data.description || openingSentence(data.page.inputPath),

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
