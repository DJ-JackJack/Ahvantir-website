#!/usr/bin/env node
/* Backlinks guard.
 *
 * Backlinks are computed in .eleventy.js by reading each article off disk and
 * scanning it for [[wikilinks]], then mutating page.data.backlinks before
 * render. That is more machinery than most of the build, it depends on Eleventy
 * collection behaviour, and when it breaks it breaks SILENTLY: the "Mentioned
 * In" box simply stops appearing. Nothing else would notice.
 *
 * So this checks the rendered output rather than the logic. If the collection
 * API changes under us, or the frontmatter split stops matching, or the layout
 * drops the section, the pages themselves are what show it.
 *
 * It reads _site, so run a build first. It is wired after the build in CI and
 * will tell you if the directory is missing.
 */

const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', '_site');
const ARTICLES = path.join(SITE, 'articles');

if (!fs.existsSync(ARTICLES)) {
  console.error('FAIL: _site/articles not found. Run `npm run build` first.');
  process.exit(1);
}

const pages = fs.readdirSync(ARTICLES, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => ({
    slug: e.name,
    file: path.join(ARTICLES, e.name, 'index.html'),
  }))
  .filter((p) => fs.existsSync(p.file));

let failed = 0;
const fail = (msg) => { console.log('  FAIL  ' + msg); failed++; };
const ok   = (msg) => console.log('  ok    ' + msg);

/* ---------- 1. the section renders at all ---------- */

const withBacklinks = [];
for (const p of pages) {
  const html = fs.readFileSync(p.file, 'utf8');
  if (/<h3[^>]*>\s*Mentioned In\s*<\/h3>/.test(html)) withBacklinks.push({ p, html });
}

if (!withBacklinks.length) {
  fail('no article renders a "Mentioned In" section — backlinks are not reaching the page');
} else {
  ok(`${withBacklinks.length} of ${pages.length} articles render "Mentioned In"`);
}

/* ---------- 2. the links in it are real ----------
   A backlink pointing at a page that does not exist means the slug logic in the
   collection and the slug logic for permalinks have drifted apart — the exact
   failure that produced dead wikilinks before. */

/* Match the WHOLE href, not just its first path segment. Matching only the
   segment let a corrupted url like /articles/foo/ghost/ pass, because "foo" is
   a real slug — the check said "points at pages that exist" about a URL that
   404s. Compare the full path against the pages actually built. */
const builtPaths = new Set(pages.map((p) => `/articles/${p.slug}/`));
let checkedLinks = 0;
let deadLinks = 0;

for (const { p, html } of withBacklinks) {
  const section = html.match(
    /<h3[^>]*>\s*Mentioned In\s*<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/);
  if (!section) continue;
  const hrefs = [...section[1].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  for (const h of hrefs) {
    checkedLinks++;
    if (!builtPaths.has(h)) {
      deadLinks++;
      if (deadLinks <= 3) {
        fail(`${p.slug}: "Mentioned In" points at ${h}, which was not built`);
      }
    }
  }
}
if (deadLinks > 3) fail(`…and ${deadLinks - 3} more dead backlinks`);

if (checkedLinks && !deadLinks) {
  ok(`all ${checkedLinks} backlinks point at pages that exist`);
} else if (!checkedLinks) {
  fail('no backlink hrefs found to check');
}

/* ---------- 3. backlinks are reciprocal ----------
   If B is listed as mentioning A, then B's own page must contain a link to A.
   This is what catches the collection silently returning stale or empty data:
   the section could still render from a previous shape while being wrong.
   One sampled pair is enough — the failure is systemic, not per-article. */

const sample = withBacklinks[0];
if (sample) {
  const section = sample.html.match(
    /<h3[^>]*>\s*Mentioned In\s*<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/);
  const first = section && section[1].match(/href="\/articles\/([^/"]+)\//);
  if (!first) {
    fail('could not read a backlink to check reciprocity');
  } else {
    const sourceSlug = first[1];
    const sourceFile = path.join(ARTICLES, sourceSlug, 'index.html');
    const sourceHtml = fs.readFileSync(sourceFile, 'utf8');
    const expected = `/articles/${sample.p.slug}/`;
    if (sourceHtml.includes(`href="${expected}"`)) {
      ok(`reciprocal: ${sourceSlug} does link to ${sample.p.slug}`);
    } else {
      fail(`${sample.p.slug} claims ${sourceSlug} mentions it, ` +
           `but ${sourceSlug} has no link to ${expected}`);
    }
  }
}

if (failed) {
  console.error(`\nFAIL: ${failed} backlink check(s) failed.`);
  process.exit(1);
}
console.log('\nPASS: backlinks render, resolve, and are reciprocal.');
