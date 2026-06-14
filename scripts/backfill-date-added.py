#!/usr/bin/env python3
"""
One-time backfill: stamp date_added frontmatter on all existing articles
that don't already have it, using the git first-commit date for each file.

Run from the repo root:  python3 scripts/backfill-date-added.py

Articles with no git history get FALLBACK_DATE (the initial import date).
"""

import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT    = Path(__file__).parent.parent
ARTICLES_DIR = REPO_ROOT / "src" / "articles"
FALLBACK_DATE = "2026-06-06"   # date of "feat: import 204 Obsidian articles"


def get_git_first_commit_date(filepath: Path) -> str | None:
    rel = filepath.relative_to(REPO_ROOT).as_posix()
    try:
        result = subprocess.run(
            ["git", "log", "--diff-filter=A", "--follow", "--format=%as", "--", rel],
            capture_output=True, text=True, cwd=REPO_ROOT
        )
        lines = [l.strip() for l in result.stdout.strip().splitlines() if l.strip()]
        return lines[-1] if lines else None
    except Exception:
        return None


def inject_date_added(filepath: Path, date_str: str) -> bool:
    content = filepath.read_text(encoding="utf-8")
    m = re.match(r"^(---[ \t]*\r?\n)([\s\S]*?)(\r?\n---[ \t]*\r?\n?)([\s\S]*)$", content)
    if not m:
        return False
    opening, fm_body, closing, rest = m.group(1), m.group(2), m.group(3), m.group(4)
    if re.search(r"^date_added\s*:", fm_body, re.MULTILINE):
        return False  # already present
    new_content = opening + fm_body + f'\ndate_added: "{date_str}"' + closing + rest
    filepath.write_text(new_content, encoding="utf-8")
    return True


def main():
    files = sorted(ARTICLES_DIR.glob("*.md"))
    print(f"Found {len(files)} articles in {ARTICLES_DIR}")

    stamped = already = skipped = 0
    for f in files:
        content = f.read_text(encoding="utf-8")
        if "date_added:" in content:
            already += 1
            continue

        date = get_git_first_commit_date(f)
        if not date:
            date = FALLBACK_DATE
            source = "fallback"
        else:
            source = "git"

        if inject_date_added(f, date):
            print(f"  [{source}] {f.name}: {date}")
            stamped += 1
        else:
            print(f"  SKIP (no frontmatter): {f.name}", file=sys.stderr)
            skipped += 1

    print(f"\nDone. Stamped: {stamped}  Already had date: {already}  Skipped: {skipped}")


if __name__ == "__main__":
    main()
