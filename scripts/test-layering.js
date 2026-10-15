#!/usr/bin/env node
/* Stacking-order guard for the mobile navigation drawer.
 *
 * This exists because of a bug that was invisible to every check we had.
 *
 * `.site-header` is `position: sticky` with a `z-index`, which makes it a
 * STACKING CONTEXT. The drawer (`.nav__panel`) lives inside it, so the
 * drawer's own z-index is scoped to that context: however large it is, the
 * whole header subtree still paints at the header's z-index as far as the
 * page is concerned. `.nav__scrim` is a SIBLING of the header, so its
 * z-index is measured against the page.
 *
 * Set the scrim above the header and it covers the drawer. The drawer still
 * looks right -- the scrim is half transparent, so the links show through,
 * dimmed -- but every tap lands on the scrim, which closes the sheet. The
 * navigation appears to do nothing at all, and a screenshot cannot tell you
 * why. It shipped, and a person on a phone found it.
 *
 * So the invariant is asserted directly: the scrim must sit BELOW the header.
 * Checked against the real stylesheet, not a copy of these numbers.
 */

const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'assets', 'css', 'main.css'), 'utf8');

let failed = 0;
const fail = (m) => { console.log('  FAIL  ' + m); failed++; };
const ok = (m) => console.log('  ok    ' + m);

/* Every innermost rule in the file as [selectorText, declarations]. Good
 * enough for this: `[^{}]+` stops at a nested brace, so rules inside a media
 * query come back as their own entries, which is exactly what we want — the
 * drawer's z-index is declared inside one. */
const RULES = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [
  m[1].split('\n').pop().trim(),
  m[2],
]);

/* The LAST z-index declared for a selector. Later rules win, and these are
 * spread between the base blocks and the drawer's media query. */
function zIndexOf(selector) {
  let found = null;
  for (const [sel, body] of RULES) {
    const names = sel.split(',').map((s) => s.trim());
    if (!names.includes(selector)) continue;
    const z = body.match(/(?:^|[;\s])z-index:\s*(-?\d+)/);
    if (z) found = Number(z[1]);
  }
  return found;
}

const header = zIndexOf('.site-header');
const scrim = zIndexOf('.nav__scrim');
const panel = zIndexOf('.nav__panel');

if (header === null) fail('.site-header declares no z-index — this guard cannot check anything');
if (scrim === null) fail('.nav__scrim declares no z-index');
if (panel === null) fail('.nav__panel declares no z-index');

if (header !== null && scrim !== null) {
  if (scrim < header) {
    ok(`scrim (${scrim}) sits below the header (${header}), so the drawer inside it stays tappable`);
  } else {
    fail(
      `.nav__scrim is z-index ${scrim} and .site-header is ${header}. The scrim is a ` +
      `SIBLING of the header, and the header is a stacking context, so a scrim at or ` +
      `above it paints over the drawer and eats every tap. The drawer will still LOOK ` +
      `correct. Put the scrim below the header.`);
  }
}

/* The drawer must still outrank the scrim inside its own context, so that if
 * the header ever stops being a stacking context the order is still right. */
if (panel !== null && scrim !== null) {
  if (panel > scrim) {
    ok(`drawer (${panel}) outranks the scrim (${scrim}) on its own terms too`);
  } else {
    fail(`.nav__panel is ${panel} and .nav__scrim is ${scrim}; the drawer must be the higher of the two`);
  }
}

/* The scrim has to be able to swallow taps meant for the page behind it, so
 * it must not be the thing that is transparent to pointer events. */
const scrimBlock = CSS.match(/\.nav__scrim\s*\{[^}]*\}/g) || [];
if (scrimBlock.some((b) => /pointer-events:\s*none/.test(b))) {
  fail('.nav__scrim sets pointer-events: none — tapping outside the drawer would not close it');
} else {
  ok('scrim still accepts pointer events, so tapping the page closes the drawer');
}

/* Opening the sheet has to make it visible THIS TICK.
 *
 * `visibility` is a discrete property: a plain `transition: visibility 0.26s`
 * does not flip it until halfway through the animation. Nothing inside a
 * `visibility: hidden` subtree can take focus, so the sheet's own focus() ran
 * against a subtree that was still hidden, was silently ignored, and anyone
 * opening the drawer from a keyboard or a screen reader was left outside it.
 *
 * The duration must therefore be 0s on the way in. A delay on the way OUT is
 * correct and expected, so only the .is-open rule is checked. */
for (const name of ['.nav__panel', '.nav__scrim']) {
  const open = RULES.filter(([sel]) =>
    sel.split(',').some((s) => s.trim() === name + '.is-open'));

  if (!open.length) {
    fail(`${name}.is-open has no rule — cannot check how it becomes visible`);
    continue;
  }

  const decl = open.map(([, body]) => body).join(';');
  const vis = decl.match(/transition:[^;]*\bvisibility\s+([\d.]+m?s)/);

  if (!vis) {
    fail(`${name}.is-open does not restate its visibility transition. Without it the ` +
         `base rule's duration applies, visibility flips late, and focus cannot enter.`);
  } else if (parseFloat(vis[1]) !== 0) {
    fail(`${name}.is-open transitions visibility over ${vis[1]}. visibility is discrete, ` +
         `so it will not become visible until mid-animation and focus() into it is ` +
         `silently ignored. It must be 0s on open.`);
  } else {
    ok(`${name} becomes visible immediately on open, so focus can enter it`);
  }
}

console.log();
if (failed) {
  console.error(`FAIL: ${failed} layering check(s) failed.`);
  process.exit(1);
}
console.log('PASS: the drawer sits above its scrim, stays tappable, and can take focus.');
