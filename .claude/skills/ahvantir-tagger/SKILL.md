---
name: ahvantir-tagger
description: |
  Analyzes Ahvantir Lore articles from the Obsidian vault, applies the correct
  tags and category to the frontmatter based on content, then syncs, builds,
  and pushes the changes to the website.

  Use this skill whenever the user says things like:
  - "tag this article" / "add tags to [article]"
  - "auto-tag" / "tag all untagged articles"
  - "the tags are wrong/missing on [article]"
  - "tag it and push it" / "tag and sync"
  - any request involving tagging Obsidian vault articles before publishing

  Works in two modes: single file (user names the article) or batch (all
  vault articles that are missing or have empty tags).
---

# Ahvantir Tagger

Tags articles in the Obsidian vault with the correct Ahvantir taxonomy terms,
then syncs and publishes them to the website.

## Paths (hardcoded for this project)

```
VAULT      = C:\Users\klfal\Documents\Claude\Projects\Ahvantir Lore\
SYNC_SCRIPT= C:\Users\klfal\Desktop\Claude_Directory\Ahvantir-website\scripts\obsidian-to-md.py
WEBSITE    = C:\Users\klfal\Desktop\Claude_Directory\Ahvantir-website\
```

---

## Step 1 — Determine mode

**Single-file mode**: The user named a specific article (e.g. "tag Claims and
Wardens"). Find the matching `.md` file in the vault — do a case-insensitive
search if the name isn't an exact match.

**Batch mode**: The user said "all", "untagged", or didn't name a specific file.
Find every `.md` in the vault (excluding `_Templates/`, `_Meta/`, `.obsidian/`,
`Ahvantir V.2/`, `HTML import/`) where `tags` is absent, empty (`[]`), or
contains only `stub`/`draft`.

---

## Step 2 — Read the taxonomy reference

Before tagging, read `references/tag-taxonomy.md` in this skill's directory.
It lists every known tag, what it covers, and which content signals should
trigger it. Use it as your primary lookup. You don't need to memorize it
now — load it when you're ready to tag.

---

## Step 3 — Analyze and tag each article

For each target file:

### 3a. Parse the frontmatter
Read the file. If there is **no YAML frontmatter at all**, add a minimal block
before tagging:
```yaml
---
title: "<H1 heading or filename>"
category: history
tags: []
status: draft
---
```

### 3b. Determine the category
Check whether the existing `category` value is one of the eight valid website
categories. If it's wrong, empty, or uses an old Obsidian single-word value,
set it to the correct one:

| Correct value | Old Obsidian equivalent | For content about |
|---|---|---|
| `history`   | `article`, `document`, `history` | Events, documents, historical records |
| `cosmology` | `cosmology`, `plane`, `spirit`   | Planes, spirits, cosmic entities, the Primordem |
| `culture`   | `culture`, `creature`, `species` | Species, customs, society, creatures |
| `religion`  | `deity`, `religion`              | Deities, temples, religious orders |
| `factions`  | `faction`                        | Organizations, guilds, military, criminal groups |
| `characters`| `npc`, `historical-figure`       | Named NPCs, historical figures, the royal family |
| `locations` | `location`                       | Cities, districts, buildings, regions |
| `magic`     | `magic-arcane`, `material`       | Spells, materials, arcane systems |

Write the **correct value** directly in the vault frontmatter (e.g. `factions`,
not `faction`). The sync script will pass it through as-is.

### 3c. Choose tags
Read the full article body. Apply every tag from the taxonomy that the content
genuinely references — don't pad. Apply these judgment rules:

- **Specificity wins**: prefer `hearthstone` over just `aru-mas` if the content
  is specifically about that district.
- **Infer new tags** for proper nouns that don't have a taxonomy entry yet (e.g.
  a named NPC, a specific battle, a named location not in the taxonomy list).
  Use lowercase-with-hyphens format. New tags are fine — the taxonomy is a
  floor, not a ceiling.
- **Don't add `stub`** unless the article is clearly incomplete (a few sentences,
  placeholder text). `draft` is for works-in-progress with real content.
- **`dm-only`**: add this if the article has `[!warning]` callouts, a
  `dm_only: true` key, or content that reads like secret/spoiler information.

### 3d. Rewrite the frontmatter
Update the `tags` list and `category` in the vault `.md` file in place.
Preserve all other frontmatter fields exactly. Show the user what changed:

```
Claims and Wardens.md
  category: (unchanged) cosmology
  tags: [] → [spirits, wardens, claims, pacts, blood-debt]
```

---

## Step 4 — Sync to the website

Run the sync script from the website repo directory:

```bash
OBSIDIAN_VAULT_PATH="C:/Users/klfal/Documents/Claude/Projects/Ahvantir Lore" \
  python3 scripts/obsidian-to-md.py
```

The sync script supports both inline tags (`tags: [a, b, c]`) and YAML block-list
tags (`tags:\n  - a\n  - b`) — whichever format Obsidian wrote is fine. **Do not
manually convert between formats.**

Check the output for errors. If a file was skipped because of `status: stub`,
note that — it's expected behaviour.

---

## Step 5 — Build the site

```bash
npm run build
```

from the website directory. Confirm it finishes without errors.

---

## Step 6 — Commit and push

Stage only the article files that changed:

```bash
git add src/articles/<slug>.md   # repeat for each changed file
git commit -m "Auto-tag: <article name(s)>\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

For batch runs, list all tagged articles in the commit message.

---

## Error handling

| Problem | What to do |
|---|---|
| Vault file not found | Tell the user the exact path searched; ask them to confirm the filename |
| Sync skips a file | Expected if `status: stub`; mention it but continue |
| Build fails | Show the error output; don't push until the build is clean |
| Push blocked by classifier | Stop and ask the user to confirm the push |
