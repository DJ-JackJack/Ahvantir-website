#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Nothing DM-facing reaches the published articles.

WHY THIS EXISTS, since a test that nobody believes in gets deleted.

test-sync-callouts.py checks the CONVERTER, against a sample string written
into the test. It is a good test and it passed, all day, on 2026-10-17, while
DM material sat in three live pages on ahvantir.world. Nothing looked at what
the converter had actually produced.

Two leaks got through that day, both mine:

  > DM ruling 2026-10-17: **the Cascades lie WEST of Aru'Mas...**
  > Still open: whether the [[First Pact]] should now be dated to that eclipse.

The first was a ruling written as a plain blockquote instead of inside the
[!note] Source callout the converter strips. The vault's convention says to
put it in the callout. A convention is not a guard; I broke it an hour after
writing it down. The second had been live for far longer and opens with a
phrase the converter has never heard of.

So this reads the real files, and it is deliberately broader than the
converter: it flags editorial language the converter does not know how to
strip, which is the whole point. A hit here means EITHER edit the vault text
OR teach obsidian-to-md.py the new phrase. Both are fine. Shipping it is not.

THE DISTINCTION THAT MATTERS. A provenance line that NAMES `DM canon` as a
source is public on purpose and appears in 33 articles:

  > Source: `DM canon` - Assembled from the Current State section of ...

A line that OPENS with a DM marker is a ruling that escaped. So every pattern
here is anchored to the start of the line, after any blockquote markers. On
the current tree that yields zero false positives.

Run: python3 scripts/test-publish-guard.py   (or npm test)
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTICLES = os.path.join(ROOT, "src", "articles")
SRC = os.path.join(ROOT, "src")

# Editorial and DM-facing openers. Two groups, so a failure can say which kind
# it is and what to do about it.
CONVERTER_KNOWS = [
    r"dm\s+(?:ruling|canon|note|resolution)\b",
    r"resolved\b",
    r"todo\b",
]
CONVERTER_DOES_NOT = [
    r"still\s+open\b",
    r"worth\s+settling\b",
    r"worth\s+deciding\b",
    r"open\s+question\b",
    r"unresolved\b",
    r"needs?\s+a\s+ruling\b",
    r"not\s+yet\s+decided\b",
    r"not\s+assumed\s+here\b",
    r"awaiting\s+a\s+ruling\b",
    r"amended\s+the\s+same\s+day\b",
    r"flagged\s+for\s+krys\b",
]

# NOT CHECKED, ON PURPOSE: lines that attribute a decision to Krys by name.
#
# Ten of them are published today, across four astrology articles, inside
# Source callouts: "Krys established the figure, its sign, and ...", "Krys
# ruled that the sky is ours to shape until the constellations are finished".
# They are development commentary on a public page, and they predate this
# guard.
#
# Whether they belong there is Krys's call and he has not made it. A first
# draft of this file flagged "Krys ruled" while letting "Krys established"
# and "Krys also set" through, which is worse than either answer: it enforced
# half a policy that nobody had chosen. A test encodes what has been decided.
# If he rules the attributions come down, the pattern goes in here and the ten
# lines get fixed in the same change.

# Anchored: start of line, past any '>' quoting and an optional bold marker.
LEAD = r"^(?:\s*>\s*)*(?:\*\*|_|\*)?\s*"
RE_KNOWN = re.compile(LEAD + "(?:" + "|".join(CONVERTER_KNOWS) + ")", re.I)
RE_UNKNOWN = re.compile(LEAD + "(?:" + "|".join(CONVERTER_DOES_NOT) + ")", re.I)

# Shapes that should never survive the converter at all.
RE_SURVIVING_CALLOUT = re.compile(r"\[!(warning|danger|caution)\]", re.I)
RE_DMONLY = re.compile(r"\{%\s*dmonly", re.I)

# A template is hand-written and has no business saying any of this.
RE_TEMPLATE_DM = re.compile(r"DM\s+(?:ruling|canon|note|resolution)", re.I)

failures = []
scanned = 0


def check_article(path, rel):
    global scanned
    scanned += 1
    for n, raw in enumerate(io.open(path, encoding="utf-8"), 1):
        line = raw.rstrip("\n")
        if not line.strip():
            continue
        if RE_KNOWN.match(line):
            failures.append((rel, n, "a DM marker the converter knows",
                             line.strip()[:110],
                             "move it inside the [!note] Source callout in the vault"))
        elif RE_UNKNOWN.match(line):
            failures.append((rel, n, "editorial language the converter cannot see",
                             line.strip()[:110],
                             "mark it 'DM note:' in the vault, or teach "
                             "obsidian-to-md.py the phrase"))
        if RE_SURVIVING_CALLOUT.search(line):
            failures.append((rel, n, "a DM-only callout survived conversion",
                             line.strip()[:110],
                             "strip_dm_callouts in obsidian-to-md.py should have "
                             "removed this"))
        if RE_DMONLY.search(line):
            failures.append((rel, n, "a dmonly shortcode reached the output",
                             line.strip()[:110],
                             "these were removed in 2026; the vault copy is the "
                             "only place DM text belongs"))


if not os.path.isdir(ARTICLES):
    sys.exit("FAIL: %s does not exist. Run the sync first." % ARTICLES)

for fn in sorted(os.listdir(ARTICLES)):
    if fn.endswith(".md"):
        check_article(os.path.join(ARTICLES, fn), "src/articles/" + fn)

# A guard that scans nothing passes everything. Pin the floor well under the
# real count so adding or removing articles never trips it, but an empty or
# half-synced directory does.
if scanned < 100:
    sys.exit("FAIL: only %d articles scanned, expected at least 100. "
             "The guard was looking at the wrong place." % scanned)

# Hand-written templates. These are not synced, so there is no legitimate
# reason for one to carry a DM marker at all; no anchoring needed.
templates = 0
for fn in sorted(os.listdir(SRC)):
    if fn.endswith(".njk"):
        templates += 1
        p = os.path.join(SRC, fn)
        for n, raw in enumerate(io.open(p, encoding="utf-8"), 1):
            if RE_TEMPLATE_DM.search(raw):
                failures.append(("src/" + fn, n, "a DM marker in a template",
                                 raw.strip()[:110],
                                 "templates are public verbatim; say it in the "
                                 "vault instead"))

print("Nothing DM-facing in the published articles")
print("  %d articles and %d templates scanned" % (scanned, templates))

if failures:
    print("")
    for rel, n, what, text, fix in failures:
        print("  LEAKED  %s:%d" % (rel, n))
        print("          %s" % what)
        print("          %s" % text)
        print("          fix: %s" % fix)
    print("\nFAIL: %d line(s) of DM material reached the public site." % len(failures))
    sys.exit(1)

print("\nPASS: %d articles carry no DM rulings, notes or planning language." % scanned)
