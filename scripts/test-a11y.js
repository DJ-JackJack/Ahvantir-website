#!/usr/bin/env node
/* Structural accessibility guard over every built page.
 *
 * Written after a change of mine put 2,198 unusable links on the site in one
 * commit. The heading permalinks had been a "¶" character; replacing them
 * with an SVG marked aria-hidden left every one of them with no accessible
 * name at all, so a screen reader announced "link" and nothing else, on every
 * heading of every article. It looked better than what it replaced, and
 * nothing caught it, because nothing was looking.
 *
 * These are the checks that can be made from the built HTML alone. They are
 * not a substitute for using the site with a keyboard, which is how the
 * drawer's focus bug was found -- they are the floor beneath it.
 *
 * Run against _site, so `npm run build` has to have happened. It is wired
 * into test:built alongside the backlink check for that reason.
 */

const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', '_site');

if (!fs.existsSync(SITE)) {
  console.error('FAIL: _site not found. Run `npm run build` first.');
  process.exit(1);
}

/* Every built page, minus the generated search index and the asset tree. */
function pages(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'pagefind' || e.name === 'assets') continue;
      pages(path.join(dir, e.name), acc);
    } else if (e.name.endsWith('.html')) {
      acc.push(path.join(dir, e.name));
    }
  }
  return acc;
}

const found = new Map();       // kind -> [detail, ...]
const note = (kind, detail) => {
  if (!found.has(kind)) found.set(kind, []);
  found.get(kind).push(detail);
};

const text = (html) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

const files = pages(SITE);

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(SITE, file).replace(/\\/g, '/');

  // A redirect stub is a meta-refresh, not a document.
  if (/http-equiv="refresh"/.test(html)) continue;

  /* Exactly one h1. Two means something is printing the title twice; zero
     means a screen reader's heading list opens empty. Both have happened. */
  const h1s = html.match(/<h1\b/g) || [];
  if (h1s.length !== 1) note('pages without exactly one <h1>', `${rel} has ${h1s.length}`);

  /* Heading levels may not skip: an h4 under an h2 reads as a missing
     section to anyone navigating by heading. */
  let prev = 0;
  for (const m of html.matchAll(/<h([1-6])\b/g)) {
    const lvl = Number(m[1]);
    if (prev && lvl > prev + 1) {
      note('heading level skipped', `${rel}: h${lvl} follows h${prev}`);
      break;
    }
    prev = lvl;
  }

  /* An <img> with no alt attribute at all. alt="" is a deliberate choice and
     is left alone; a missing attribute is an oversight. */
  for (const m of html.matchAll(/<img\b([^>]*)>/g)) {
    if (!/\salt\s*=/.test(m[1])) note('<img> with no alt', `${rel}: ${m[1].trim().slice(0, 60)}`);
  }

  /* Two elements with the same id. getElementById returns the first, so the
     second is unreachable to every script that looks for it. */
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set(), dupes = new Set();
  for (const id of ids) (seen.has(id) ? dupes : seen).add(id);
  if (dupes.size) note('duplicate id', `${rel}: ${[...dupes].slice(0, 4).join(', ')}`);

  /* A link or button with no text, no aria-label and no alt'd image has no
     name to announce. This is the check that would have caught the anchors. */
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const [, attrs, inner] = m;
    if (/aria-hidden="true"/.test(attrs)) continue;
    if (text(inner)) continue;
    if (/aria-label(ledby)?=/.test(attrs)) continue;
    if (/<img[^>]*\salt="[^"]+"/.test(inner)) continue;
    note('link with no accessible name', `${rel}: <a${attrs.trim().slice(0, 60)}>`);
  }

  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const [, attrs, inner] = m;
    if (text(inner) || /aria-label(ledby)?=/.test(attrs)) continue;
    note('button with no accessible name', `${rel}: <button${attrs.trim().slice(0, 60)}>`);
  }

  if (!/<html[^>]*\slang=/.test(html)) note('no lang on <html>', rel);
}

/* ---------- report ---------- */

let failed = 0;
for (const [kind, rows] of found) {
  failed += rows.length;
  console.log(`  FAIL  ${kind} — ${rows.length}`);
  for (const r of rows.slice(0, 5)) console.log(`          ${r}`);
  if (rows.length > 5) console.log(`          …and ${rows.length - 5} more`);
}

console.log();
if (failed) {
  console.error(`FAIL: ${failed} accessibility problem(s) across ${files.length} pages.`);
  process.exit(1);
}
console.log(`PASS: ${files.length} pages — one h1 each, no skipped levels, every link and button named.`);
