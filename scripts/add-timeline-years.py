#!/usr/bin/env python3
"""
Add timeline_year and timeline_date frontmatter to articles with confirmed
historical anchors in the Marducian Calendar (MC).

Run from the repo root:
    python scripts/add-timeline-years.py
"""

import re
from pathlib import Path

ARTICLES_DIR = Path(__file__).parent.parent / "src" / "articles"

# slug → (timeline_year, timeline_date)
# Dates derived from History of Ahvantir (DM canon, 2026-05-13)
TIMELINE = {
    # Pre-founding
    "drornduur":                        (-275, "~Year -275 MC"),
    "massacre-of-cascading-leaves":     (-7,   "~Year -7 MC"),
    "battle-of-hallowed-hollow":        (-7,   "~Year -7 MC"),

    # Year 0: The Founding / First Pact
    "founding-of-arumas":               (0,    "Year 0 MC"),
    "first-pact":                       (0,    "Year 0 MC"),
    "spiritsway-passage":               (0,    "Year 0 MC"),
    "marducian-calendar":               (0,    "Year 0 MC"),
    "the-primordem":                    (0,    "Year 0 MC"),
    "marduk-sunspear":                  (0,    "Year 0 MC"),
    "he-who-was-forgotten":             (0,    "Year 0 MC"),

    # Early city (1–42 MC)
    "ilyrana-vael-cryptex-recordings":  (1,    "Year 1 MC"),
    "adobban-demoranza":                (2,    "~Year 2 MC"),
    "the-church-of-the-threefold-path": (2,    "~Year 2 MC"),
    "order-of-valor":                   (3,    "~Year 3 MC"),
    "order-of-wisdom":                  (3,    "~Year 3 MC"),
    "order-of-harmony":                 (3,    "~Year 3 MC"),

    # Middle history (~100–400 MC)
    "ilderas-dynasty":                  (150,  "~Year 150 MC"),
    "ilderas-public-archive":           (150,  "~Year 150 MC"),
    "shattered-strand":                 (200,  "~Year 200 MC"),
    "captain-varrick":                  (200,  "~Year 200 MC"),
    "arielle":                          (200,  "~Year 200 MC"),

    # Recent history
    "the-order-of-the-platinum-chalice": (399, "~Year 399 MC"),
}


def add_timeline_fields(path: Path, year: int, date_label: str) -> bool:
    """
    Insert timeline_year and timeline_date into YAML frontmatter.
    Returns True if the file was modified.
    """
    raw = path.read_text(encoding="utf-8")

    # Check if already set
    if "timeline_year:" in raw:
        print(f"  SKIP (already has timeline_year): {path.name}")
        return False

    # Split on first frontmatter block
    m = re.match(r"^(---\r?\n)(.*?)(\r?\n---\r?\n?)(.*)", raw, re.DOTALL)
    if not m:
        print(f"  SKIP (no frontmatter): {path.name}")
        return False

    open_fence, fm_body, close_fence, body = m.groups()

    # Append timeline fields before closing ---
    addition = f'timeline_year: {year}\ntimeline_date: "{date_label}"\n'
    new_raw = open_fence + fm_body + "\n" + addition + close_fence + body
    path.write_text(new_raw, encoding="utf-8")
    return True


def main():
    updated = 0
    for slug, (year, date_label) in sorted(TIMELINE.items()):
        path = ARTICLES_DIR / f"{slug}.md"
        if not path.exists():
            print(f"  MISSING: {slug}.md")
            continue
        changed = add_timeline_fields(path, year, date_label)
        if changed:
            print(f"  Added year={year:>5} to {slug}.md")
            updated += 1

    print(f"\nDone. {updated} articles updated.")


if __name__ == "__main__":
    main()
