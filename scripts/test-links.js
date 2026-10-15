#!/usr/bin/env node
/* Every internal link on the built site, resolved against what was built.
 *
 * The backlink test already checks the "Mentioned in" lists. This checks
 * everything else: navigation, breadcrumbs, cards, and above all the
 * wikilinks in article prose, which are written by hand in Obsidian and
 * therefore drift whenever a note is renamed.
 *
 * A dead wikilink is invisible while writing. Obsidian resolves [[Nightblades]]
 * against the vault; the site resolves it against whichever notes were
 * published. The two disagree quietly.
 *
 * KNOWN_MISSING below is a baseline, not an excuse. Each entry is an article
 * referenced in the lore that has not been written. They are listed so the
 * number cannot grow without someone noticing, and the test fails BOTH ways:
 * a new dead link is a regression, and a baseline entry that now resolves is
 * a line to delete from this list.
 */

const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', '_site');

/* Referenced in article prose, never written. Not bugs in the code -- gaps in
 * the lore. Delete a line when its article appears. */
const KNOWN_MISSING = [
  '/articles/arcanum-cryptex/',
  '/articles/citadel-of-solara/',
  '/articles/day-of-unity/',
  '/articles/dreamwalkers/',
  '/articles/elarion-vale/',
  '/articles/elendra-vale/',
  '/articles/kallian-sayn/',
  '/articles/miryen-sayn/',
  '/articles/nightblades/',
  '/articles/pathite-pantheon/',
];

if (!fs.existsSync(SITE)) {
  console.error('FAIL: _site not found. Run `npm run build` first.');
  process.exit(1);
}

const built = new Set();
const pages = [];

(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'pagefind') continue;
      walk(p);
      continue;
    }
    const rel = '/' + path.relative(SITE, p).replace(/\\/g, '/');
    built.add(rel);
    if (rel.endsWith('/index.html')) built.add(rel.slice(0, -'index.html'.length));
    if (e.name.endsWith('.html') && !p.includes(`${path.sep}assets${path.sep}`)) pages.push(p);
  }
})(SITE);

const SKIP = /^(https?:|mailto:|tel:|javascript:|#)/;
const broken = new Map();   // target -> Set of pages linking to it
let checked = 0;

for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(SITE, file).replace(/\\/g, '/');
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    const href = m[1];
    if (SKIP.test(href)) continue;
    const target = href.split('#')[0].split('?')[0];
    if (!target.startsWith('/')) continue;
    checked++;
    if (built.has(target)) continue;
    if (built.has(target.replace(/\/$/, '') + '/index.html')) continue;
    if (!broken.has(target)) broken.set(target, new Set());
    broken.get(target).add(rel);
  }
}

let failed = 0;
const fail = (m) => { console.log('  FAIL  ' + m); failed++; };
const ok = (m) => console.log('  ok    ' + m);

const known = new Set(KNOWN_MISSING);
const unexpected = [...broken.keys()].filter((t) => !known.has(t)).sort();
const healed = KNOWN_MISSING.filter((t) => !broken.has(t));

if (unexpected.length) {
  for (const t of unexpected.slice(0, 8)) {
    const from = [...broken.get(t)].sort();
    fail(`${t} does not exist — linked from ${from.length} page(s), e.g. ${from[0]}`);
  }
  if (unexpected.length > 8) fail(`…and ${unexpected.length - 8} more dead targets`);
} else {
  ok(`${checked} internal links across ${pages.length} pages all resolve, bar the known gaps`);
}

if (healed.length) {
  for (const t of healed) {
    fail(`${t} now exists — remove it from KNOWN_MISSING in this file`);
  }
} else if (KNOWN_MISSING.length) {
  ok(`${KNOWN_MISSING.length} known unwritten articles, all still unwritten`);
}

console.log();
if (failed) {
  console.error(`FAIL: ${failed} link problem(s).`);
  process.exit(1);
}
console.log('PASS: no dead internal links beyond the recorded lore gaps.');
