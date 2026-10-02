# What is public, and how to keep DM material out of it

**This repository is public and the built site is on GitHub Pages. Article
pages are not gated at all.** The Supabase login and its `is_dm()` check only
cover the play area. Anything that reaches `src/articles/` is public twice
over: on the site, and as raw markdown on github.com.

The vault is the private, canonical copy. The site is a players' lore wiki
generated from it.

## Writing DM-only material in the vault

Use a callout the sync drops:

```markdown
> [!warning] Anything at all
> Dropped entirely. Never reaches the site.

> [!note] DM Canon — the part players must not know
> Dropped: any [!note] whose TITLE starts with "DM".
```

What the title has to look like is in `DM_NOTE_TITLES` in
`scripts/obsidian-to-md.py`. It currently drops titles starting with `DM`, plus
review artefacts (`Resolved …`, `District Split …`, `Placement`, `Stub`,
anything mentioning a vault review or "not public knowledge").

**A title the list does not match is published.** `> [!note] The Truth` ships.
When in doubt, start the title with `DM`.

## What does NOT protect anything

| Looks protective | What it actually does |
|---|---|
| `{% dmonly %}` | Nothing. Kept only as a no-op so old files still build. |
| A collapsed `<details>` | Collapsed is not hidden. It is in the HTML and was in the search index. |
| `dm_only: true` frontmatter | Draws a banner. Hides nothing. |
| A `dm-only` tag | Nothing acts on it. |
| Not linking to an article | Unlinked is still public at its URL. |
| Writing a secret in plain prose under a `## True History` heading | Published like any other paragraph. |

`draft: true` now genuinely prevents publication — see
`src/articles/articles.11tydata.js`. It did not before: the page was written
and indexed, and only hidden from listings, which is the worst shape for a
mistake because the article looks unpublished.

## Deleting

The sync prunes articles whose vault source has gone, so deleting or renaming
in the vault now reaches the site. Two guards:

- It refuses to prune if a run would remove more than 20% of the site
  (`PRUNE_LIMIT`), which nearly always means `OBSIDIAN_VAULT_PATH` is wrong.
  `FORCE_PRUNE=true` overrides.
- It never deletes an article other articles still link to, because output
  filenames come from `title:` while wikilinks resolve from their link text,
  which in Obsidian is the vault *filename*. Where those differ, a stale copy
  may be the only reason inbound links work. The script reports it and leaves
  it alone.

To delete something immediately, remove it from the vault **and** from
`src/articles/` in the same commit. Note that neither removes it from this
repository's public git history.

## Before you trust a change

```bash
npm test
```

`scripts/test-sync-callouts.py` covers the three ways DM material has reached
players so far, including the subtle one: a greedy `> ` run used to swallow the
*next* callout as part of the previous one's body, so a note nested behind a
Source footer was invisible to every pass that looked for callouts.

A useful sweep of the built site:

```bash
npm run build:prod
grep -ril "dm-only\|dmonly\|DM Canon\|DM Note\|not public knowledge" _site/articles/
```

Expect hits only in the `> **Source**` provenance footers, which mention things
like "DM canon session 2026-05-13" as a *source type*. Whether those footers
belong on a public site at all is an open question — they expose internal
filenames and authoring history on ~235 pages.
