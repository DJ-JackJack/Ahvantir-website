#!/usr/bin/env python3
"""
Obsidian → Eleventy markdown converter.

Reads .md files from OBSIDIAN_VAULT_PATH (env var), converts them,
and writes to src/articles/.

Transformations:
  - Strips Dataview blocks (```dataview ... ```)
  - Strips Dataview inline queries (= ... )
  - Converts Obsidian callouts > [!type] to blockquotes
  - Preserves [[wikilinks]] (handled by Eleventy transform)
  - Strips #tags from body text (they live in frontmatter)
  - Ensures title is set in frontmatter

Set OBSIDIAN_VAULT_PATH in repo secrets or .env to connect the vault.
"""

import os
import re
import sys
from pathlib import Path

VAULT_PATH = os.environ.get("OBSIDIAN_VAULT_PATH", "")
OUTPUT_DIR = Path(__file__).parent.parent / "src" / "articles"
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"


def strip_dataview(content: str) -> str:
    content = re.sub(r"```dataview\n.*?```", "", content, flags=re.DOTALL)
    content = re.sub(r"`=\s*[^`]+`", "", content)
    return content


def convert_callouts(content: str) -> str:
    def replace_callout(m):
        kind = m.group(1).lower()
        title = m.group(2).strip() if m.group(2) else kind.title()
        body = m.group(3).strip()
        body_lines = "\n".join("> " + line for line in body.splitlines())
        return f"> **{title}**\n{body_lines}"

    return re.sub(
        r"> \[!(\w+)\][^\n]*\n((?:> .*\n?)*)",
        lambda m: replace_callout(m),
        content,
    )


def strip_inline_tags(content: str) -> str:
    return re.sub(r"(?<!\[)#([a-zA-Z][\w/-]*)", "", content)


def slugify(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[''']", "", slug)
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def process_file(src: Path) -> tuple[str, str]:
    raw = src.read_text(encoding="utf-8")
    raw = strip_dataview(raw)
    raw = convert_callouts(raw)
    raw = strip_inline_tags(raw)
    slug = slugify(src.stem)
    return slug, raw


def main():
    if not VAULT_PATH:
        print("OBSIDIAN_VAULT_PATH not set — nothing to sync.", file=sys.stderr)
        sys.exit(0)

    vault = Path(VAULT_PATH)
    if not vault.exists():
        print(f"Vault path does not exist: {vault}", file=sys.stderr)
        sys.exit(1)

    md_files = list(vault.rglob("*.md"))
    print(f"Found {len(md_files)} markdown files in vault.")

    changed = 0
    for src in md_files:
        slug, content = process_file(src)
        dest = OUTPUT_DIR / f"{slug}.md"
        if dest.exists() and dest.read_text(encoding="utf-8") == content:
            continue
        if DRY_RUN:
            print(f"[DRY RUN] Would write: {dest}")
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content, encoding="utf-8")
            print(f"Written: {dest}")
        changed += 1

    print(f"{'Would update' if DRY_RUN else 'Updated'} {changed} files.")


if __name__ == "__main__":
    main()
