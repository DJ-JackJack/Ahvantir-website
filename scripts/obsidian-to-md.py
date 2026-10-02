#!/usr/bin/env python3
"""
Obsidian → Eleventy markdown converter for Ahvantir Lore.

Reads .md files from OBSIDIAN_VAULT_PATH, converts them,
and writes to src/articles/.

Transformations:
  - Maps Obsidian category values to the 8 website category slugs
  - [!warning] callouts are DROPPED: they are DM-only and the site is public
  - [!summary] callouts → description frontmatter field (removed from body)
  - [!note] callouts → styled blockquotes
  - Strips Dataview blocks and inline queries
  - Strips #tags from body text (they live in frontmatter)
  - Strips Templater syntax (<% tp... %>)
  - Skips _Templates, _Meta, .obsidian, Ahvantir V.2 folders
  - Skips articles with status: stub
"""

import datetime
import os
import re
import sys
from pathlib import Path

# Auto-load .env from the repo root so `python3 scripts/obsidian-to-md.py`
# works without manually setting OBSIDIAN_VAULT_PATH each time.
_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _key, _, _val = _line.partition("=")
        _key = _key.strip()
        _val = _val.strip()
        if len(_val) >= 2 and _val[0] == _val[-1] and _val[0] in ('"', "'"):
            _val = _val[1:-1]  # strip matched quotes, preserving interior content
        elif " #" in _val:
            _val = _val[:_val.index(" #")].strip()  # strip trailing inline comment
        os.environ.setdefault(_key, _val)

VAULT_PATH = os.environ.get("OBSIDIAN_VAULT_PATH", "").lstrip('﻿').strip()
OUTPUT_DIR = Path(__file__).parent.parent / "src" / "articles"
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"
# Pruning deletes files. Refuse if a run would remove more than this share of
# the site, which nearly always means the vault path is wrong rather than that
# the DM deleted a fifth of their lore.
PRUNE_LIMIT = 0.20
FORCE_PRUNE = os.environ.get("FORCE_PRUNE", "false").lower() == "true"

SKIP_DIRS = {"_Templates", "_Meta", ".obsidian", "Ahvantir V.2", "HTML import"}

# Root-level files that are Obsidian boilerplate, not articles
SKIP_FILES = {"Welcome.md", "welcome.md"}

# Frontmatter fields that are set manually on the website side and must
# survive every sync (they don't exist in the Obsidian vault files).
PRESERVE_FIELDS = {"timeline_year", "timeline_date", "timeline_pending", "date_added"}

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
    slug = re.sub(r"['‘’]", "", slug)
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


def strip_dm_callouts(body: str) -> str:
    """Drop [!warning] callouts entirely. They are DM-only.

    These used to become {% dmonly %} shortcode blocks, which Eleventy rendered
    as a collapsed <details> element. Collapsed is not hidden: the text shipped
    inside the public HTML, one click or one View Source away, and the site
    search indexed it. The website repository is public as well, so the raw
    markdown was readable on GitHub regardless of what the build did.

    There is nothing to replace them with. The vault is the canonical copy and
    keeps every callout, and the DM reads them in Obsidian. The public site
    simply should not contain them.
    """
    return re.sub(
        r"^> \[!warning\][^\n]*\n((?:> ?[^\n]*\n?)*)",
        "",
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


def build_frontmatter(fm: dict, description: str, preserved: dict = None) -> str:
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
    # Re-emit website-specific fields that don't exist in the Obsidian vault.
    # Date values are quoted so YAML parsers keep them as strings, not Date objects.
    if preserved:
        for key in sorted(preserved.keys()):
            val = preserved[key]
            if key == "date_added":
                lines.append(f'{key}: "{val}"')
            else:
                lines.append(f"{key}: {val}")
    lines.append("---")
    return "\n".join(lines)


def process_file(src: Path, preserved_fm: dict = None):
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
    body = strip_dm_callouts(body)
    body = convert_note_callouts(body)
    body = strip_inline_tags(body)
    body = re.sub(r"\n{3,}", "\n\n", body).strip()

    fm_out = build_frontmatter(fm, description, preserved=preserved_fm)
    output = f"{fm_out}\n\n{body}\n"

    slug = slugify(str(title) or src.stem)
    return slug, output


def write_sync_log(added: list, updated: list, log_lines: list):
    """Write/append today's sync log so recently-added.njk picks it up."""
    log_dir = OUTPUT_DIR.parent.parent / "sync-logs"
    log_dir.mkdir(exist_ok=True)

    today = datetime.date.today().isoformat()
    now   = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    log_path = log_dir / f"{today}.md"

    lines = ["<!-- ahvantir-sync-log-v1 -->", "", f"# Ahvantir Vault Sync — {now}", "", "## Summary", ""]
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
        sys.exit(1)

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
    slug_map = {}  # slug -> source filename; detect collisions across this run
    log_lines = [f"Found {len(md_files)} markdown files (after folder exclusions)."]
    today_str = datetime.date.today().isoformat()

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

        if slug in slug_map:
            msg = f"WARN slug collision: '{slug}' claimed by both '{slug_map[slug]}' and '{src.name}' — skipping '{src.name}'"
            print(msg, file=sys.stderr)
            log_lines.append(msg)
            errors += 1
            continue
        slug_map[slug] = src.name

        dest = OUTPUT_DIR / f"{slug}.md"

        # Preserve website-specific frontmatter that lives only in the output
        # files and doesn't exist in the Obsidian vault (e.g. timeline_year,
        # date_added). New files get date_added stamped with today's date.
        if dest.exists():
            existing_fm, _ = parse_frontmatter(dest.read_text(encoding="utf-8"))
            preserved = {f: existing_fm[f] for f in PRESERVE_FIELDS if f in existing_fm}
        else:
            preserved = {"date_added": today_str}

        if preserved:
            result2 = process_file(src, preserved_fm=preserved)
            if result2 is not None:
                _, content = result2

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

    # Remove published articles whose vault source has gone away.
    #
    # This step did not exist: the sync only ever added and overwrote. An
    # article therefore stayed on the public site forever once generated.
    # Deleting it from the vault did nothing, and renaming it published the new
    # slug while quietly leaving the old one in place. An internal working
    # document stayed public that way long after it had left the vault.
    #
    # The guard matters because this deletes files. If OBSIDIAN_VAULT_PATH is
    # wrong, or a run fails part way, slug_map collapses and an unguarded prune
    # would wipe the site in a commit made by the weekly job. Refusing to prune
    # is always recoverable; that is not.
    removed = []
    on_disk = sorted(path.stem for path in OUTPUT_DIR.glob("*.md"))
    orphans = [slug for slug in on_disk if slug not in slug_map]

    # Never delete an article other articles still point at.
    #
    # Output filenames are slugified from the `title:` field, but the website
    # slugifies a [[wikilink]] from its link text, which in Obsidian is the
    # vault FILENAME. When the two differ the inbound links only resolve
    # because an older copy is still sitting there under the filename-derived
    # slug. "Sunspear Legion.md" retitled to "The Sunspear Legion" is the live
    # example: a dozen articles link [[Sunspear Legion]], and pruning the stale
    # copy would turn every one of them into a 404.
    #
    # Reporting it is the right move rather than deleting or silently keeping
    # it. The fix is a rename in the vault or an alias, and that is the DM's
    # call, not this script's.
    if orphans:
        inbound = {}
        for path in OUTPUT_DIR.glob("*.md"):
            if path.stem in orphans:
                continue
            text = path.read_text(encoding="utf-8")
            for target in re.findall(r"\[\[([^\]|#]+)", text):
                inbound.setdefault(slugify(target.strip()), set()).add(path.stem)
        linked = [slug for slug in orphans if inbound.get(slug)]
        for slug in linked:
            who = sorted(inbound[slug])
            msg = (
                f"KEEPING orphan '{slug}.md': it has no vault source, but "
                f"{len(who)} article(s) still link to it ({', '.join(who[:5])}"
                f"{', ...' if len(who) > 5 else ''}). Rename it in the vault or "
                f"update those links, then it will prune cleanly."
            )
            print(msg, file=sys.stderr)
            log_lines.append(msg)
        orphans = [slug for slug in orphans if slug not in inbound or not inbound[slug]]
    if orphans:
        share = len(orphans) / max(len(on_disk), 1)
        if share > PRUNE_LIMIT and not FORCE_PRUNE:
            msg = (
                f"REFUSING to prune {len(orphans)} of {len(on_disk)} articles "
                f"({share:.0%} of the site, limit {PRUNE_LIMIT:.0%}). This almost "
                f"always means the vault path is wrong or this run failed part "
                f"way. Set FORCE_PRUNE=true if the deletion really is intended."
            )
            print(msg, file=sys.stderr)
            log_lines.append(msg)
            errors += 1
        else:
            for slug in orphans:
                victim = OUTPUT_DIR / f"{slug}.md"
                if DRY_RUN:
                    msg = f"[DRY RUN] Would remove (no vault source): {victim.name}"
                else:
                    victim.unlink()
                    msg = f"Removed (no vault source): {victim.name}"
                print(msg)
                log_lines.append(msg)
                removed.append(slug)

    changed = len(added) + len(updated)
    summary = (
        f"{'Would update' if DRY_RUN else 'Updated'} {changed} files. "
        f"Removed {len(removed)}. Skipped {skipped} stubs. {errors} errors."
    )
    print(summary)
    log_lines.append(summary)

    if not DRY_RUN:
        write_sync_log(added, updated, log_lines)


if __name__ == "__main__":
    main()
