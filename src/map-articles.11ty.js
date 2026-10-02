/* Builds /map-articles.json — the lookup the maps page uses for marker tooltips
   and (in DM edit mode) the article picker.
 *
 * Why read the source file instead of templateContent: reaching into another
 * template's rendered content from a collection makes this page depend on every
 * article having rendered first, which Eleventy resolves inconsistently and
 * which fails loudly on a cold build. The backlinks collection in .eleventy.js
 * already reads inputPath directly for the same reason, so this follows it.
 *
 * Two kinds of material are removed before the excerpt is taken:
 *   - {% dmonly %} blocks, which are spoilers. This file is public.
 *   - Blockquote blocks. The vault's Obsidian callouts arrive here as
 *     `> **Title**` quotes (DM notes, source attributions), which are metadata
 *     about the article rather than the prose a reader wants in a tooltip.
 */
const fs = require("fs");

const EXCERPT_CHARS = 220;

function sourceBody(inputPath) {
  let raw;
  try {
    raw = fs.readFileSync(inputPath, "utf8");
  } catch (_) {
    return "";
  }
  const m = raw.match(/^---[\r\n][\s\S]*?[\r\n]---[\r\n]?([\s\S]*)$/);
  const body = m ? m[1] : raw;
  // Drop the leading H1 — it repeats the title the tooltip already shows.
  return body.replace(/^\s*#\s+[^\n]*\r?\n/, "");
}

/* The title the DM picks from in the article dropdown. A few articles carry an
   empty `title:` in their frontmatter, and falling straight through to the slug
   puts "aru-mas-map-reference" in a list of proper names. Try the H1 first,
   then a humanised slug, so nothing in the picker is unreadable. */
function titleFor(page) {
  const front = String(page.data.title || "").trim();
  if (front) return front;
  let raw = "";
  try {
    raw = fs.readFileSync(page.inputPath, "utf8");
  } catch (_) { /* fall through to the slug */ }
  const h1 = raw.match(/^[ \t]*#[ \t]+([^\r\n]+)/m);
  if (h1) {
    const text = h1[1]
      .replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (s, t, a) => a || t)
      .replace(/[*_`]+/g, "")
      .trim();
    if (text) return text;
  }
  return String(page.fileSlug || "")
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function toPlainText(md) {
  return String(md || "")
    // Spoilers, in both the shortcode and rendered forms
    .replace(/\{%\s*dmonly\s*%\}[\s\S]*?\{%\s*enddmonly\s*%\}/gi, " ")
    .replace(/<details class="dm-only">[\s\S]*?<\/details>/gi, " ")
    // Whole blockquote blocks (callouts), not just their markers
    .replace(/(?:^[ \t]*>[^\n]*\r?\n?)+/gm, " ")
    // Fenced code, images, then links and wikilinks down to their text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (s, t, a) => a || t)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Headings, emphasis, list bullets, tables, residual HTML
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/[*_~`]+/g, "")
    .replace(/^\s*[-*+]\s+/gm, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(text) {
  if (text.length <= EXCERPT_CHARS) return text;
  return text.slice(0, EXCERPT_CHARS - 1).replace(/\s+\S*$/, "") + "…";
}

module.exports = class {
  data() {
    return {
      permalink: "/map-articles.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render({ collections }) {
    const items = (collections.allArticles || []).map((page) => {
      // A hand-written description beats a mechanical excerpt when one exists.
      const described = toPlainText(page.data.description);
      const body = toPlainText(sourceBody(page.inputPath));
      return {
        slug: page.fileSlug,
        title: titleFor(page),
        url: page.url,
        category: page.data.category || "",
        excerpt: excerpt(described || body),
      };
    });
    return JSON.stringify(items);
  }
};
