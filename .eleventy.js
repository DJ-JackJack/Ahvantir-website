const fs = require("fs");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const md = markdownIt({ html: true, linkify: true, typographer: true }).use(
    markdownItAnchor,
    {
      permalink: markdownItAnchor.permalink.linkInsideHeader({
        symbol: "¶",
        placement: "after",
      }),
    }
  );
  eleventyConfig.setLibrary("md", md);

  // Wikilink transform: [[Title]] or [[Title|Alias]]
  // The alternation matches <script>...</script> blocks first (returned unchanged)
  // so wikilinks embedded in JSON data inside <script> elements are never expanded.
  eleventyConfig.addTransform("wikilinks", function (content, outputPath) {
    if (!outputPath?.endsWith(".html")) return content;
    return content.replace(
      /(<script\b[\s\S]*?<\/script>)|\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g,
      (match, scriptBlock, target, alias) => {
        if (scriptBlock !== undefined) return scriptBlock;
        const text = alias || target;
        const slug = toSlug(target);
        return `<a href="/articles/${slug}/" class="wikilink" data-target="${slug}">${escHtml(text)}</a>`;
      }
    );
  });

  // DM-only spoiler shortcode
  eleventyConfig.addPairedShortcode("dmonly", function (content) {
    return `<details class="dm-only">
      <summary class="dm-only__toggle">
        <span class="dm-only__icon" aria-hidden="true">🔒</span>
        DM Only — Contains Spoilers
      </summary>
      <div class="dm-only__content">${content}</div>
    </details>`;
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
      let raw;
      try {
        const src = fs.readFileSync(page.inputPath, "utf8");
        // Strip YAML frontmatter (--- ... ---) to get the markdown body
        const m = src.match(/^---[\r\n][\s\S]*?[\r\n]---[\r\n]?([\s\S]*)$/);
        raw = m ? m[1] : src;
      } catch (_) {
        raw = String(page.template?.frontMatter?.content || "");
      }
      const links = [...raw.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g)];
      for (const [, title] of links) {
        const slug = toSlug(title);
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
      const key = val || "Unknown";
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
    templateFormats: ["njk", "md", "html"],
  };
};
