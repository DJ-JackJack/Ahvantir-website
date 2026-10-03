#!/usr/bin/env python3
"""Checks that obsidian-to-md.py never publishes DM-facing callouts.

The website repository is public and the built site is on GitHub Pages, so
anything this converter emits is readable by anyone. Three separate mistakes
have already shipped campaign secrets to players:

  1. [!warning] became a {% dmonly %} shortcode, which Eleventy rendered as a
     collapsed <details>. Collapsed is not hidden. The text was in the HTML, in
     View Source, and in the search index.
  2. [!warning] was never the only DM marker. The vault has ~280 [!note]
     callouts against 12 warnings, and a dozen of those notes are titled
     "DM Canon", "DM Note - True Role", "DM Resolution". They rendered as
     ordinary visible blockquotes. One of them read "not public knowledge".
  3. A greedy "> " continuation swallowed the FOLLOWING callout as part of the
     previous one's body, because a callout's own first line is also a valid
     "> " line. A vault-organisation note sat nested inside a Source footer on
     the live site, invisible to every pass that went looking for callouts.
  4. The title guard only reads a callout's TITLE, and the vault records rulings
     by appending them to the body of each article's "Source" footer. The title
     is innocuous, so 25 dated "DM ruling 2026-09-30: ..." lines were about to
     ship on a sync. Lines are now filtered inside published callouts too.

Each case below is one of those. Run: python3 scripts/test-sync-callouts.py
"""
import importlib.util
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("OBSIDIAN_VAULT_PATH", "unused-by-these-tests")

spec = importlib.util.spec_from_file_location(
    "sync", os.path.join(ROOT, "scripts", "obsidian-to-md.py"))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def convert(body):
    """The same order process_file() applies."""
    body = sync.strip_dm_callouts(body)
    body = sync.strip_unknown_callouts(body)
    body = sync.convert_note_callouts(body)
    return body


SAMPLE = (
    "Public prose here.\n"
    "\n"
    "> [!note] Source\n"
    "> Source: `original` - provenance text.\n"
    "> [!note] Placement\n"
    "> Filed under 30 - Astrology.\n"
    "> [!note] DM Canon - not public knowledge\n"
    "> The seal is weakening and nobody knows.\n"
    "\n"
    "> [!warning] DM Only\n"
    "> A sealed name.\n"
    "\n"
    "> [!resolved] Resolved During Expansion\n"
    "> Review artefact.\n"
    "\n"
    "> [!note] DM Note - True Role\n"
    "> He is the traitor.\n"
    "\n"
    "> [!note] True History\n"
    "> Lore structure, should survive.\n"
    "\n"
    "> [!note] Source\n"
    "> Source: `original` - anchored in `DM canon` - ChatGPT lore session 2026-05-12.\n"
    "> DM ruling 2026-09-30: The Council does not hold the Primordem secret.\n"
    "> Resolved - R3: renamed during the vault review.\n"
    "> Trailing provenance sentence.\n"
    "\n"
    "More public prose.\n"
)

out = convert(SAMPLE)

MUST_BE_GONE = [
    ("adjacent note after a Source footer", "Astrology"),
    ("DM Canon note", "seal is weakening"),
    ("[!warning] block", "sealed name"),
    ("[!resolved] review artefact", "Review artefact"),
    ("DM Note - True Role", "He is the traitor"),
    ("raw callout syntax", "[!"),
    ("DM ruling line inside a Source footer", "does not hold the Primordem"),
    ("review artefact line inside a Source footer", "renamed during the vault review"),
    ("dmonly shortcode", "dmonly"),
]
MUST_SURVIVE = [
    ("Source provenance footer", "provenance text"),
    ("lore-structure callout", "Lore structure"),
    ("provenance that merely mentions DM canon", "ChatGPT lore session"),
    ("trailing provenance line", "Trailing provenance sentence"),
    ("body prose before", "Public prose here"),
    ("body prose after", "More public prose"),
]

failures = []
for label, needle in MUST_BE_GONE:
    if needle in out:
        failures.append("LEAKED: %s (found %r in the output)" % (label, needle))
for label, needle in MUST_SURVIVE:
    if needle not in out:
        failures.append("LOST: %s (expected %r in the output)" % (label, needle))

# Titles the converter must treat as DM-facing, independent of the sample.
for title in ["DM Canon", "DM Note - Research Gap", "DM Resolution - 2026-03-28",
              "dm note", "District Split - R4", "Resolved - R3", "Stub",
              "Placement", "2026-09-30 vault review"]:
    if not sync._is_dm_note(title):
        failures.append("NOT RECOGNISED as DM-facing: %r" % title)

# Titles that are lore and must NOT be dropped.
for title in ["Source", "True History", "Official History", "See Also",
              "The Suppressed Terms", "Public Knowledge"]:
    if sync._is_dm_note(title):
        failures.append("WRONGLY treated as DM-facing: %r" % title)

print("--- converter output ---")
print(out)
print("------------------------")
if failures:
    for f in failures:
        print("  " + f)
    print("\nFAIL: %d problem(s)." % len(failures))
    sys.exit(1)
print("PASS: DM callouts dropped, lore and provenance kept.")
