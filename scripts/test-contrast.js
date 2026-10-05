#!/usr/bin/env node
/* Colour-contrast guard (WCAG 2.1 AA).
 *
 * Reads the real token values out of main.css and checks the pairs that carry
 * body text. Hard-coding the hexes here would only test this file against
 * itself; parsing the stylesheet means editing a token is what the test sees.
 *
 * The point is the SURFACE. The nav "Player" link had already been darkened
 * once, with a comment claiming it met AA "on parchment" — true, but that link
 * never sits on parchment. It sits on the header gradient, where it measured
 * 2.92:1. A ratio is meaningless without naming the background it was taken
 * against, so every case below names one.
 *
 * Only text pairs are listed. Decorative colour has no ratio to meet, and
 * padding this list with borders and dividers would train people to ignore it.
 */

const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'assets', 'css', 'main.css'), 'utf8');

const AA_NORMAL = 4.5;   // body text
const AA_LARGE  = 3.0;   // >=24px, or >=18.66px bold

/* ---------- colour maths ---------- */

function parseHex(hex) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error('not a hex colour: ' + hex);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ---------- read the tokens as the browser would ----------
   :root wins for light, html.dark overrides for dark. Taking the LAST match of
   each name inside its block mirrors the cascade, so a token redefined further
   down the block is read the way it actually renders. */

function blockBody(selector) {
  const m = CSS.match(new RegExp(selector + '\\s*\\{([\\s\\S]*?)\\n\\}', 'm'));
  if (!m) throw new Error('no ' + selector + ' block found in main.css');
  return m[1];
}

function tokens(selector) {
  const body = blockBody(selector);
  const out = {};
  const re = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g;
  let m;
  while ((m = re.exec(body)) !== null) out[m[1]] = m[2];
  return out;
}

const light = tokens(':root');
const dark  = Object.assign({}, light, tokens('html\\.dark'));

/* The nav link must not be a hardcoded literal: the header is light in one
   theme and dark in the other, so a fixed colour cannot clear both. It was a
   literal, and measured 1.75:1 in dark mode where a dark gold vanishes into a
   dark header. Keep it a token. */
if (/\.nav__player-link\s*\{[^}]*color:\s*#[0-9a-fA-F]{3,6}/.test(CSS)) {
  console.error(
    'FAIL: .nav__player-link uses a hardcoded colour. The header inverts between\n' +
    '      themes, so this must be a token that inverts with it.');
  process.exit(1);
}

/* ---------- the cases ----------
   Surfaces were taken from the rendered pages, not assumed: each token was
   matched against the computed background of the elements actually using it. */

function cases(t, mode) {
  return [
    // --ink-ghost dresses ~70 pieces of secondary text: map hints and counts,
    // captions, dates, placeholders. It lands on the page and body surfaces.
    [`${mode}: --ink-ghost on --p-100`, t['--ink-ghost'], t['--p-100'], AA_NORMAL],
    [`${mode}: --ink-ghost on --p-200`, t['--ink-ghost'], t['--p-200'], AA_NORMAL],

    // Links and tags.
    [`${mode}: --teal-dark on --p-100`, t['--teal-dark'], t['--p-100'], AA_NORMAL],
    [`${mode}: --teal-dark on --p-200`, t['--teal-dark'], t['--p-200'], AA_NORMAL],

    // .btn--primary is --p-100 text on a --teal-dark fill.
    [`${mode}: btn--primary label`, t['--p-100'], t['--teal-dark'], AA_NORMAL],

    // Body text proper.
    [`${mode}: --ink on --p-200`, t['--ink'], t['--p-200'], AA_NORMAL],
    [`${mode}: --ink-faded on --p-200`, t['--ink-faded'], t['--p-200'], AA_NORMAL],

    // The cryptex band is dark in BOTH themes, so this pair does not flip.
    // --ink-ghost is tuned for parchment and fails here, which is why the band
    // has its own muted token.
    [`${mode}: --ink-muted-dark on --cryptex-band`,
      t['--ink-muted-dark'], t['--cryptex-band'], AA_NORMAL],

    // The nav link spans the header gradient, so it must clear BOTH stops —
    // and it must be checked in both themes, because the header inverts.
    [`${mode}: nav Player on header top (--p-300)`,
      t['--nav-player'], t['--p-300'], AA_NORMAL],
    [`${mode}: nav Player on header bottom (--p-400)`,
      t['--nav-player'], t['--p-400'], AA_NORMAL],
  ];
}

const all = [].concat(cases(light, 'light'), cases(dark, 'dark'));

let failed = 0;
for (const [label, fg, bg, need] of all) {
  if (!fg || !bg) {
    console.log(`  MISSING  ${label} — token not found in main.css`);
    failed++;
    continue;
  }
  const r = contrast(fg, bg);
  const ok = r >= need;
  if (!ok) failed++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(46)} ${fg} on ${bg}  ` +
    `${r.toFixed(2)}:1 (needs ${need})`);
}

/* Guard the band itself. It is painted with a literal-backed token because it
   used to use --ink-soft — a TEXT token — which flips to a light colour in dark
   mode and inverted the band's soft edges there.

   Scoped with [^}]* so the search cannot run past the closing brace into a
   later rule that legitimately uses --ink-soft. */
if (/\.cryptex-section\s*\{[^}]*var\(--ink-soft\)/.test(CSS)) {
  console.log('  FAIL  .cryptex-section paints with --ink-soft, which flips in dark mode');
  failed++;
} else {
  console.log('  ok    .cryptex-section does not paint with a text token');
}

if (failed) {
  console.error(`\nFAIL: ${failed} contrast check(s) below WCAG AA.`);
  process.exit(1);
}
console.log(`\nPASS: ${all.length + 1} contrast checks meet WCAG AA.`);
