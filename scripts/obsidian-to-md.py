#!/usr/bin/env python3
"""
Obsidian → Eleventy markdown converter for Ahvantir Lore.

Reads .md files from OBSIDIAN_VAULT_PATH, converts them,
and writes to src/articles/.

Transformations:
  - Maps Obsidian category values to the 8 website category slugs
  - [!warning] callouts → {% dmonly %}...{% enddmonly %} shortcode blocks
  - [!summary] callouts → description frontmatter field (removed from body)
  - [!note] callouts → styled blockquotes
  - Strips Dataview blocks and inline queries
  - Strips #tags from body text (they live in frontmatter)
  - Strips Templater syntax (<% tp... %>)
  - Skips _Templates, _Meta, .obsidian, Ahvantir V.2 folders
  - Skips articles with status: stub
"""

import os
import re
import sys
from pathlib import Path

VAULT_PATH = os.environ.get("OBSIDIAN_VAULT_PATH", "").lstrip('﻿').strip()
OUTPUT_DIR = Path(__file__).parent.parent / "src" / "articles"
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"

SKIP_DIRS = {"_Templates", "_Meta", ".obsidian", "Ahvantir V.2", "HTML import"}

# Root-level files that are Obsidian boilerplate, not articles
SKIP_FILES = {"Welcome.md", "welcome.md"}

CATEGORY_MAP = {
    "article":           "history",
    "cosmology":         "cosmology",
    "creature":          "culture",
    "culture":           "culture",
    "deity":             "religion",
    "document":          "history",
    "faction":           "factions",
    "historical-figure": "characters",
    "history":           "history",
    "location":          "locations",
    "magic-arcane":      "magic",
    "material":          "magic",
    "npc":               "characters",
    "plane":             "cosmology",
    "species":           "culture",
    "spirit":            "cosmology",
}


def slugify(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"['''’]", "", slug)
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def parse_frontmatter(content: str) -> tuple:
    """Split YAML frontmatter from body. Returns (fm_dict, body_str).

    Handles both inline lists  (tags: [a, b, c])
    and YAML block lists       (tags:\n  - a\n  - b).
    The second form is what Obsidian's built-in YAML linter produces.
    """
    m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)", content, re.DOTALL)
    if not m:
        return {}, content
    fm_raw, body = m.group(1), m.group(2)
    fm: dict = {}
    lines = fm_raw.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if ":" not in line:
            i += 1
            continue
        key, _, val = line.partition(":")
        key = key.strip()
        val = val.strip()

        if val.startswith("[") and val.endswith("]"):
            # Inline list: tags: [a, b, c]
            inner = val[1:-1].strip()
            fm[key] = [v.strip().strip("\"'") for v in inner.split(",") if v.strip()] if inner else []
        elif val == "":
            # Possibly a block list — peek ahead for "  - item" lines
            items = []
            j = i + 1
            while j < len(lines) and re.match(r"^\s+-\s+", lines[j]):
                item = re.sub(r"^\s+-\s+", "", lines[j]).strip().strip("\"'")
                items.append(item)
                j += 1
            if items:
                fm[key] = items
                i = j
                continue
            else:
                fm[key] = ""
        else:
            fm[key] = val.strip("\"'")
        i += 1
    return fm, body


def strip_dataview(content: str) -> str:
    content = re.sub(r"```dataview\n.*?```", "", content, flags=re.DOTALL)
    content = re.sub(r"`=\s*[^`]+`", "", content)
    return content


def strip_inline_tags(content: str) -> str:
    return re.sub(r"(?<!\[)#([a-zA-Z][\w/-]*)", "", content)


def strip_templater(content: str) -> str:
    return re.sub(r"<%[^%>]*%>", "", content)


def _strip_blockquote_prefix(raw: str) -> str:
    """Remove leading '> ' from blockquote body lines."""
    lines = []
    for line in raw.splitlines():
        if line.startswith("> "):
            lines.append(line[2:])
        elif line == ">":
            lines.append("")
        else:
            lines.append(line)
    return "\n".join(lines)


def extract_summary(body: str) -> tuple:
    """Extract [!summary] callout as description. Returns (description, cleaned_body)."""
    description = ""

    def replacer(m):
        nonlocal description
        raw_body = m.group(1)
        text = _strip_blockquote_prefix(raw_body).strip()
        # Collapse to single line for description field
        description = re.sub(r"\s+", " ", text).strip()
        return ""

    cleaned = re.sub(
        r"^> \[!summary\][^\n]*\n((?:> ?[^\n]*\n?)*)",
        replacer,
        body,
        flags=re.MULTILINE | re.IGNORECASE,
    )
    return description, cleaned


def convert_warning_callouts(body: str) -> str:
    """Convert [!warning] callouts to {% dmonly %} shortcode blocks."""
    def replacer(m):
        raw_body = m.group(1)
        inner = _strip_blockquote_prefix(raw_body).strip()
        if not inner:
            return ""
        return "{{% dmonly %}}\n{inner}\n{{% enddmonly %}}".format(inner=inner)

    return re.sub(
        r"^> \[!warning\][^\n]*\n((?:> ?[^\n]*\n?)*)",
        replacer,
        body,
        flags=re.MULTILINE | re.IGNORECASE,
    )


def convert_note_callouts(body: str) -> str:
    """Convert [!note] callouts to styled blockquotes."""
    def replacer(m):
        title = m.group(1).strip()
        raw_body = m.group(2)
        inner_lines = _strip_blockquote_prefix(raw_body).strip()
        # Re-prefix stripped lines as blockquote
        bq_lines = "\n".join(
            "> " + line for line in inner_lines.splitlines() if line.strip()
        )
        if title and bq_lines:
            return f"> **{title}**\n{bq_lines}"
        elif title:
            return f"> **{title}**"
        else:
            return bq_lines

    return re.sub(
        r"^> \[!note\] ?([^\n]*)\n((?:> ?[^\n]*\n?)*)",
        replacer,
        body,
        flags=re.MULTILINE | re.IGNORECASE,
    )


def build_frontmatter(fm: dict, description: str) -> str:
    title = fm.get("title", "")
    category_raw = fm.get("category", "")
    category = CATEGORY_MAP.get(category_raw, category_raw)
    tags = fm.get("tags", [])
    aliases = fm.get("aliases", [])

    lines = ["---"]
    safe_title = title.replace('"', '\\"')
    lines.append(f'title: "{safe_title}"')
    if description:
        safe_desc = description.replace('"', '\\"')
        lines.append(f'description: "{safe_desc}"')
    if category:
        lines.append(f"category: {category}")
    if tags:
        lines.append(f"tags: [{', '.join(tags)}]")
    else:
        lines.append("tags: []")
    if aliases:
        alias_str = ", ".join(f'"{a}"' for a in aliases)
        lines.append(f"aliases: [{alias_str}]")
    lines.append("---")
    return "\n".join(lines)


def process_file(src: Path):
    """Returns (slug, output_content) or None if file should be skipped."""
    raw = src.read_text(encoding="utf-8")

    fm, body = parse_frontmatter(raw)

    # Skip stubs and template files
    if fm.get("status") == "stub":
        return None
    title = fm.get("title", src.stem)
    if "<%" in str(title):
        return None
    # Skip files with no meaningful title (Obsidian placeholders / imports)
    if not str(title).strip():
        return None

    body = strip_templater(body)
    body = strip_dataview(body)
    description, body = extract_summary(body)
    body = convert_warning_callouts(body)
    body = convert_note_callouts(body)
    body = strip_inline_tags(body)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()

    fm_out = build_frontmatter(fm, description)
    output = f"{fm_out}\n\n{body}\n"

    slug = slugify(str(title) or src.stem)
    return slug, output


def write_sync_log(added: list, updated: list, log_lines: list):
    """Write/append today's sync log so recently-added.njk picks it up."""
    import datetime
    log_dir = OUTPUT_DIR.parent.parent / "sync-logs"
    log_dir.mkdir(exist_ok=True)

    today = datetime.date.today().isoformat()
    now   = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    log_path = log_dir / f"{today}.md"

    lines = [f"# Ahvantir Vault Sync — {now}", "", "## Summary", ""]
    total = len(added) + len(updated)
    if total:
        lines.append(f"{total} article(s) changed in this sync.")
    else:
        lines.append("_No article files changed this run._")
    lines += ["", "## Article Changes", ""]

    for slug in added:
        lines.append(f"- **Added:** `{slug}.md`")
    for slug in updated:
        lines.append(f"- **Updated:** `{slug}.md`")
    if not added and not updated:
        lines.append("_None._")

    lines += ["", "## Full Converter Log", "", "```"]
    lines += log_lines
    lines.append("```")
    lines.append("")

    log_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Sync log written: sync-logs/{today}.md")


def main():
    if not VAULT_PATH:
        print("OBSIDIAN_VAULT_PATH not set — nothing to sync.", file=sys.stderr)
        sys.exit(0)

    vault = Path(VAULT_PATH)
    if not vault.exists():
        print(f"Vault path does not exist: {vault}", file=sys.stderr)
        sys.exit(1)

    md_files = [
        f for f in vault.rglob("*.md")
        if not any(skip in f.parts for skip in SKIP_DIRS)
        and f.name not in SKIP_FILES
    ]
    print(f"Found {len(md_files)} markdown files (after folder exclusions).")

    added = []
    updated = []
    skipped = errors = 0
    log_lines = [f"Found {len(md_files)} markdown files (after folder exclusions)."]

    for src in sorted(md_files):
        try:
            result = process_file(src)
        except Exception as e:
            msg = f"ERROR processing {src.name}: {e}"
            print(msg, file=sys.stderr)
            log_lines.append(msg)
            errors += 1
            continue

        if result is None:
            skipped += 1
            continue

        slug, content = result
        dest = OUTPUT_DIR / f"{slug}.md"

        if dest.exists() and dest.read_text(encoding="utf-8") == content:
            continue

        if DRY_RUN:
            print(f"[DRY RUN] Would write: {dest.name}")
            log_lines.append(f"[DRY RUN] Would write: {dest.name}")
        else:
            is_new = not dest.exists()
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content, encoding="utf-8")
            msg = f"Written: {dest.name}"
            print(msg)
            log_lines.append(msg)
            if is_new:
                added.append(slug)
            else:
                updated.append(slug)

    changed = len(added) + len(updated)
    summary = (
        f"{'Would update' if DRY_RUN else 'Updated'} {changed} files. "
        f"Skipped {skipped} stubs. {errors} errors."
    )
    print(summary)
    log_lines.append(summary)

    if not DRY_RUN:
        write_sync_log(added, updated, log_lines)


if __name__ == "__main__":
    main()
