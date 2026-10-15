const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");

// Cache-busting: short content hash per asset, computed from the source file.
// The hash only changes when the file's bytes change, so unchanged assets keep
// their URL (and stay cached) while edited ones get a fresh URL automatically.
const _assetHashes = new Map();
function assetHash(url) {
  if (_assetHashes.has(url)) return _assetHashes.get(url);
  let h = "";
  try {
    const fp = path.join(__dirname, "src", url.replace(/^\//, ""));
    h = crypto.createHash("sha1").update(fs.readFileSync(fp)).digest("hex").slice(0, 8);
  } catch (_) {
    h = ""; // asset missing — leave the URL unversioned rather than break the build
  }
  _assetHashes.set(url, h);
  return h;
}


/* Plain text out of a fragment of rendered HTML, normalised far enough that
   two spellings of the same heading compare equal: tags gone, entities
   resolved, wikilink brackets unwrapped, and every apostrophe variant folded
   to one. Aru'Mas is written three ways across this vault (straight quote,
   curly quote, and inside a [[wikilink]]) and all three have to match. */
function htmlToText(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (m, target, alias) =>
      alias || String(target).split("#")[0])
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[\u2018\u2019\u02bc\u055a\ufffd]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* The id markdown-it-anchor gives a heading, using its default slugify so
   the anchors we emit match the ids actually in the HTML. Deliberately NOT
   toSlug: that strips punctuation, while these ids keep parentheses and
   percent-encode non-ASCII, e.g. "The Landing War (-13 to 0 MC)" becomes
   the-landing-war-(-13-to-0-mc). */
function toHeadingId(str) {
  return encodeURIComponent(
    String(str).trim().toLowerCase().replace(/\s+/g, "-")
  );
}

/* Split an Obsidian wikilink target into page and heading.
   [[Page#Heading]] points at a section of Page, not at a page named
   "Page#Heading". Flattening the two was turning correct vault links into
   404s on the site. */
function splitTarget(target) {
  const i = String(target).indexOf("#");
  if (i === -1) return { page: target, heading: "" };
  return { page: target.slice(0, i), heading: target.slice(i + 1) };
}

function toSlug(str) {
  return String(str)
    .toLowerCase()
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

module.exports = function (eleventyConfig) {
  // Passthrough
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/CNAME");

  // Markdown
  /* The anchor used to be a pilcrow, rendered in accent red and visible at
     all times beside every heading in every article. A pilcrow marks a
     paragraph, not a link to one, and permanently-on anchors are clutter the
     reader did not ask for: the convention since is a quiet glyph that
     appears on hover or keyboard focus. The CSS keeps it at opacity 0 until
     then; `aria-hidden` plus a real label keeps it sensible to a screen
     reader, which should hear "Link to this section", not "pilcrow". */
  const md = markdownIt({ html: true, linkify: true, typographer: true }).use(
    markdownItAnchor,
    {
      permalink: markdownItAnchor.permalink.linkInsideHeader({
        symbol:
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" ' +
          'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
          'stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
          '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' +
          '</svg>' +
          // The glyph is aria-hidden, so without this the link has no
          // accessible name at all and a screen reader announces a bare
          // "link" -- 2,198 of them across the articles. The span is
          // visually hidden, not display:none, so it is still announced.
          '<span class="sr-only">Link to this section</span>',
        placement: "after",
        ariaHidden: false,
      }),
    }
  );
  eleventyConfig.setLibrary("md", md);

  // Wikilink transform: [[Title]] or [[Title|Alias]]
  // The alternation matches <script>...</script> blocks first (returned unchanged)
  // so wikilinks embedded in JSON data inside <script> elements are never expanded.
  eleventyConfig.addTransform("wikilinks", function (content, outputPath) {
    // outputPath is `false`, not a string, for a page with permalink:false
    // (how a draft is kept unwritten). Optional chaining does not guard a
    // boolean, so `false?.endsWith` threw and failed the whole build.
    if (typeof outputPath !== "string" || !outputPath.endsWith(".html")) return content;
    return content.replace(
      /(<script\b[\s\S]*?<\/script>)|\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
      (match, scriptBlock, target, alias) => {
        if (scriptBlock !== undefined) return scriptBlock;
        const { page, heading } = splitTarget(target);
        // With no alias, read it as Obsidian does: "Page > Heading",
        // rather than the raw "Page#Heading".
        const text = alias || (heading ? page + " \u203a " + heading : page);
        const slug = toSlug(page);
        const anchor = heading ? "#" + toHeadingId(heading) : "";
        // [[#Heading]] with no page is a link inside the current article.
        if (!slug) {
          return `<a href="${anchor}" class="wikilink">${escHtml(text)}</a>`;
        }
        return `<a href="/articles/${slug}/${anchor}" class="wikilink" data-target="${slug}">${escHtml(text)}</a>`;
      }
    );
  });

  // Strip wikilink markup to plain text for preview/meta contexts:
  //   [[Target]]        -> Target
  //   [[Target|Alias]]  -> Alias
  // Descriptions double as card-preview text and <meta name="description">
  // content. The site-wide wikilink transform would otherwise expand a [[..]]
  // there into an <a>, which nests illegally inside a card's own <a> (breaking
  // the card layout) and corrupts the meta tag's content attribute. Article
  // *bodies* are unaffected — they still render wikilinks as real links.

  /* Every one of the 244 articles opens with an `# H1` repeating its own
     title, because that is how they are written in Obsidian, where the page
     has no title furniture of its own. On the site the layout already prints
     the title, so each article showed its name twice, forty pixels apart --
     and the second one took the page's only <h1>, leaving two.

     Stripped only when it really is the title: a leading heading that says
     something else is the author's and stays. The build reports any it
     declines to strip, so a mismatch is visible rather than silent. */
  const _keptLeadingH1 = [];
  eleventyConfig.addFilter("dropLeadingTitle", function (content, title) {
    if (!content) return content;
    const m = String(content).match(/^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>\s*/i);
    if (!m) return content;
    /* The permalink anchor markdown-it-anchor puts INSIDE the heading is not
       part of the heading's text. It carries a visually-hidden label for
       screen readers, so leaving it in made every heading compare as
       "<title> Link to this section", nothing matched its title, and all 244
       duplicate headings came back. The build said so, loudly, which is what
       that report is for. */
    const bare = m[1].replace(/<a\b[^>]*class="header-anchor"[\s\S]*?<\/a>/gi, "");
    const heading = htmlToText(bare);
    if (heading && heading !== htmlToText(title)) {
      _keptLeadingH1.push(`${title}  ->  ${m[1].replace(/<[^>]*>/g, "").trim()}`);
      return content;
    }
    return String(content).slice(m[0].length);
  });

  eleventyConfig.on("eleventy.after", () => {
    if (_keptLeadingH1.length) {
      console.log(
        `[articles] ${_keptLeadingH1.length} leading heading(s) kept — they do ` +
        `not match their article title:\n  ` + _keptLeadingH1.join("\n  ")
      );
    }
  });

  /* A contents list for the sidebar, read back out of the rendered HTML so it
     can never drift from the headings actually on the page. H2 and H3 only:
     H1 is the title, and H4 and below are too fine to navigate by. The ids are
     markdown-it-anchor's own, so the links land. */
  eleventyConfig.addFilter("tableOfContents", function (content) {
    const out = [];
    const re = /<(h[23])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = re.exec(String(content || "")))) {
      // The anchor link markdown-it-anchor puts inside the heading is not
      // part of the heading's text.
      const text = m[3].replace(/<a\b[^>]*class="header-anchor"[\s\S]*?<\/a>/gi, "");
      const label = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      if (label) out.push({ level: Number(m[1][1]), id: m[2], text: label });
    }
    return out;
  });

  /* Nunjucks has no array slice of its own -- its `slice` splits a list into
     N chunks, which is a different thing. The sidebar needs a first run and
     the remainder. */
  eleventyConfig.addFilter("take", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("drop", (arr, n) => (arr || []).slice(n));

  eleventyConfig.addFilter("stripWikilinks", function (str) {
    if (!str) return "";
    return String(str).replace(
      /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
      (m, target, alias) => {
        if (alias) return alias;
        const { page, heading } = splitTarget(target);
        return heading ? page + " \u203a " + heading : page;
      }
    );
  });

  // Cache-bust transform: append ?v=<hash> to local /assets/*.css and *.js URLs
  // so visitors always get the current file after a deploy without a hard
  // refresh, while unchanged assets keep their cached URL. Runs on HTML output;
  // external (CDN) URLs and anything already carrying a query string are skipped.
  eleventyConfig.addTransform("cacheBustAssets", function (content, outputPath) {
    // outputPath is `false`, not a string, for a page with permalink:false
    // (how a draft is kept unwritten). Optional chaining does not guard a
    // boolean, so `false?.endsWith` threw and failed the whole build.
    if (typeof outputPath !== "string" || !outputPath.endsWith(".html")) return content;
    return content.replace(
      /(href|src)="(\/assets\/(?:css|js)\/[^"?]+\.(?:css|js))"/g,
      (match, attr, url) => {
        const h = assetHash(url);
        return h ? `${attr}="${url}?v=${h}"` : match;
      }
    );
  });

  // DM-only content: dropped, not hidden.
  //
  // This used to render a collapsed <details class="dm-only"> block. Collapsed
  // is not hidden. The text shipped in the public HTML, was one click away, was
  // in View Source, and was indexed by the site search. The sync script no
  // longer emits this shortcode at all; it remains defined only so that an
  // article still carrying it from an older sync renders nothing rather than
  // failing the build. If you want DM material on the site, it has to be
  // fetched at runtime behind the Supabase is_dm() check, not baked in here.
  eleventyConfig.addPairedShortcode("dmonly", function () {
    return "";
  });

  // Collections
  eleventyConfig.addCollection("allArticles", function (api) {
    return api
      .getFilteredByGlob("src/articles/**/*.md")
      .filter((p) => !p.data.draft)
      .sort((a, b) =>
        (a.data.title || "").localeCompare(b.data.title || "")
      );
  });

  eleventyConfig.addCollection("allArticlesByDateAdded", function (api) {
    // YAML parses bare YYYY-MM-DD as a Date object (UTC midnight); normalize to string.
    function normDate(v) {
      if (!v) return "0000-00-00";
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v);
    }
    return api
      .getFilteredByGlob("src/articles/**/*.md")
      .filter((p) => !p.data.draft)
      .sort((a, b) => {
        const da = normDate(a.data.date_added);
        const db = normDate(b.data.date_added);
        if (db > da) return 1;
        if (db < da) return -1;
        return (a.data.title || "").localeCompare(b.data.title || "");
      });
  });

  eleventyConfig.addCollection("timeline", function (api) {
    return api
      .getFilteredByGlob("src/articles/**/*.md")
      .filter((p) => p.data.timeline_year != null)
      .sort((a, b) => a.data.timeline_year - b.data.timeline_year);
  });

  // Backlinks — mutate page.data before render
  eleventyConfig.addCollection("withBacklinks", function (api) {
    const all = api
      .getFilteredByGlob("src/articles/**/*.md")
      .filter((p) => !p.data.draft);

    const pageMap = new Map();
    for (const page of all) {
      pageMap.set(page.fileSlug, page);
      page.data.backlinks = [];
    }

    for (const page of all) {
      /* Read the body from disk via page.inputPath, which is public, documented
         Eleventy API. The previous fallback reached into
         page.template.frontMatter.content — an internal that no version promise
         covers, and which an Eleventy upgrade could change or remove without
         warning. Worse, it was silent: if it ever returned something different
         from the file, backlinks would quietly go missing with no sign why.

         An unreadable article is a real problem, so say so and carry on with an
         empty body rather than guessing at the content. */
      let raw = "";
      try {
        const src = fs.readFileSync(page.inputPath, "utf8");
        // Strip YAML frontmatter (--- ... ---) to get the markdown body
        const m = src.match(/^---[\r\n][\s\S]*?[\r\n]---[\r\n]?([\s\S]*)$/);
        raw = m ? m[1] : src;
      } catch (err) {
        console.warn(
          `[backlinks] could not read ${page.inputPath}: ${err.message}. ` +
          `Links out of this article will be missing.`);
      }
      const links = [...raw.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g)];
      for (const [, title] of links) {
        // Same split as the transform: a section link belongs to its PAGE.
        // Without this every [[Page#Heading]] counted as a link to a
        // nonexistent "page-heading" article and warned on every build.
        const slug = toSlug(splitTarget(title).page);
        const target = pageMap.get(slug);
        if (target) {
          const already = target.data.backlinks.some(
            (b) => b.url === page.url
          );
          if (!already) {
            target.data.backlinks.push({
              title: page.data.title || page.fileSlug,
              url: page.url,
            });
          }
        } else {
          console.warn(`[wikilink] unresolved: [[${title}]] (slug: "${slug}") in ${page.fileSlug}`);
        }
      }
    }

    return all;
  });

  // Filters
  // Strip HTML for search index. Removes dm-only blocks first so spoiler
  // content never leaks into the client-side article search payload.
  eleventyConfig.addFilter("striptags", (str) => {
    if (!str) return "";
    return String(str)
      .replace(/<details class="dm-only">[\s\S]*?<\/details>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/¶/g, "")
      .replace(/\s+/g, " ")
      .trim();
  });

  // Group a collection array by a frontmatter field, preserving encounter order.
  // Returns [{key, items}] — used by recently-added.njk to group by date_added.
  // Normalizes YAML Date objects (parsed from bare YYYY-MM-DD) to ISO strings so
  // Date instances from different articles group correctly (objects compare by ref).
  eleventyConfig.addFilter("groupByField", function (arr, field) {
    const groups = [];
    const keyMap = new Map();
    for (const item of arr) {
      let val = item.data && item.data[field];
      if (val instanceof Date) val = val.toISOString().slice(0, 10);
      // Use explicit null/undefined check so 0 and "" are valid keys, not "Unknown"
      const key = (val !== undefined && val !== null) ? val : "Unknown";
      if (!keyMap.has(key)) {
        const group = { key, items: [] };
        groups.push(group);
        keyMap.set(key, group);
      }
      keyMap.get(key).items.push(item);
    }
    return groups;
  });

  eleventyConfig.addFilter("toSlug", toSlug);
  eleventyConfig.addFilter("joinSlugs", (arr) => (arr || []).map(toSlug).join(" "));
  // Safe JSON for embedding in <script> blocks: encode <, >, & as Unicode escapes
  // so </script> sequences in string values can never terminate the script element.
  eleventyConfig.addFilter("jsonscript", (val) =>
    JSON.stringify(val)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
  );
  // Safe JSON for the relationship graph: serialises nodes+links from collections
  eleventyConfig.addFilter("graphJson", function (collections) {
    const nodes = (collections.allArticles || []).map((a) => ({
      id: a.url,
      title: a.data.title || a.fileSlug,
      url: a.url,
      category: a.data.category || "uncategorized",
    }));
    const links = [];
    for (const article of collections.withBacklinks || []) {
      for (const bl of article.data.backlinks || []) {
        links.push({ source: bl.url, target: article.url });
      }
    }
    return JSON.stringify({ nodes, links })
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");
  });
  eleventyConfig.addFilter("articleUrl", (title) => `/articles/${toSlug(title)}/`);
  eleventyConfig.addFilter("dateDisplay", (date) => {
    if (!date) return "";
    // YAML parses bare YYYY-MM-DD as a Date object at UTC midnight, which shifts
    // one day in US timezones. Extract UTC parts and construct a local-noon Date
    // so the displayed date always matches what was written in frontmatter.
    let d;
    if (date instanceof Date) {
      d = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0);
    } else {
      const s = String(date);
      d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : new Date(s);
    }
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });
  eleventyConfig.addFilter("keys", (obj) => Object.keys(obj || {}));
  eleventyConfig.addFilter("values", (obj) => Object.values(obj || {}));

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
      layouts: "_includes/layouts",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    // "11ty.js" powers src/map-articles.11ty.js, the article lookup the maps
    // page uses for marker tooltips. Without it listed here Eleventy skips the file.
    templateFormats: ["njk", "md", "html", "11ty.js"],
  };
};
