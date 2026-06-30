# Ahvantir Website — Sync & Deploy Runbook

How lore gets from the Obsidian vault onto **ahvantir.world**, how to operate it,
and how to fix it when it breaks. This file is the source of truth — it lives in
the repo, so it's version-controlled and survives a machine loss.

---

## 1. The pipeline in one picture

```
Obsidian vault                scripts/obsidian-to-md.py        git push           GitHub Actions
(local .md files)  ───────►  (converts vault → src/articles)  ─────────►  main  ──────────────►  "Build and Deploy"
                                                                                                  (Eleventy → GitHub Pages)
                                                                                                          │
                                                                                                          ▼
                                                                                                   ahvantir.world
```

Two things run that "convert + push" step on a schedule, plus one watchdog:

| # | Component | Role | Where it runs |
|---|---|---|---|
| 1 | **Obsidian Sync** (GitHub Actions) | **PRIMARY** weekly sync | self-hosted runner on **FENRIS-FOUNDRY** |
| 2 | **Ahvantir Weekly Lore Sync** (PowerShell task) | **COLD STANDBY** (normally disabled) | Windows Task Scheduler, FENRIS-FOUNDRY |
| 3 | **Sync Health Check** (GitHub Actions) | **MONITOR** — emails if sync goes stale | GitHub-hosted runner (cloud) |

Plus **Build and Deploy** (`.github/workflows/deploy.yml`) — builds the Eleventy
site and publishes to GitHub Pages on every push to `main`.

> Both sync mechanisms run on the **same PC** (FENRIS-FOUNDRY) and read the same
> local vault, so neither gives you cloud independence — both need that PC on.
> The **monitor** runs in GitHub's cloud on purpose, so it still works (and can
> warn you) when FENRIS-FOUNDRY is off.

---

## 2. Component reference

### 2.1 Obsidian Sync — PRIMARY  ✅ keep this running
- **File:** `.github/workflows/obsidian-sync.yml`
- **Runner:** `[self-hosted, Windows, X64]` → the `ahvantir-runner` service on FENRIS-FOUNDRY
- **Schedule:** `cron: '0 2 * * 1'` → **Mondays 02:00 UTC** (~Sunday evening local)
- **Commit message:** `chore: sync <date>`
- **Vault path:** from the `OBSIDIAN_VAULT_PATH` GitHub **secret**
- **Notifies:** GitHub emails the owner on failure (this is the early-warning system)
- **Manual run:** `gh workflow run "Obsidian Sync"` (supports a `dry_run` input)

### 2.2 Ahvantir Weekly Lore Sync — COLD STANDBY  ⏸ normally disabled
- **Live script:** `C:\Users\klfal\Desktop\Claude_Directory\ahvantir-weekly-sync.ps1`
- **Canonical copy (this repo):** `scripts/ahvantir-weekly-sync.ps1` — **source of truth**
- **Task name:** `Ahvantir Weekly Lore Sync` (Windows Task Scheduler)
- **Schedule:** Sundays 21:00 local
- **Commit message:** `Weekly lore sync -- <date>`
- **Log:** `C:\Users\klfal\Desktop\Claude_Directory\ahvantir-sync-log.txt`
- **Notifies:** nothing on its own — rely on the monitor (2.3)
- **Purpose:** fallback for when the GitHub runner / Actions sync is down.

### 2.3 Sync Health Check — MONITOR  ✅ keep this running
- **File:** `.github/workflows/sync-health.yml`
- **Runner:** `ubuntu-latest` (GitHub cloud — independent of FENRIS-FOUNDRY)
- **Schedule:** `cron: '0 12 * * *'` → **daily 12:00 UTC**
- **What it does:** finds the most recent **successful** Obsidian Sync run; if it's
  older than `MAX_AGE_DAYS` (default **9**), the job **fails → GitHub emails you**.
- **Manual run:** `gh workflow run "Sync Health Check"`

### 2.4 Build and Deploy
- **File:** `.github/workflows/deploy.yml`
- **Trigger:** every push to `main`
- **What it does:** Eleventy build → GitHub Pages (ahvantir.world). Versioned
  asset URLs (`?v=<hash>`) are added at build time so visitors get fresh CSS/JS.

---

## 3. Operating it

**Check whether lore sync is healthy right now**
```sh
gh run list --workflow "Obsidian Sync" --limit 5     # recent syncs + status
gh run list --workflow "Sync Health Check" --limit 3 # monitor history
gh workflow run "Sync Health Check"                  # force a fresh check
```

**Force a sync now (primary)**
```sh
gh workflow run "Obsidian Sync"
```

**Run the standby by hand** (also how you "test" it)
```powershell
& "C:\Users\klfal\Desktop\Claude_Directory\ahvantir-weekly-sync.ps1"
Get-Content "C:\Users\klfal\Desktop\Claude_Directory\ahvantir-sync-log.txt" -Tail 20
```

**Disable / enable the standby task** (needs an **elevated** PowerShell — right-click → Run as administrator)
```powershell
Disable-ScheduledTask -TaskName "Ahvantir Weekly Lore Sync"   # normal state
Enable-ScheduledTask  -TaskName "Ahvantir Weekly Lore Sync"   # activate fallback
```

**Is the self-hosted runner alive?**
```powershell
Get-Service "actions.runner.*" | Select-Object Name, Status   # want Status = Running
# if stopped:  Start-Service "actions.runner.*"
```

---

## 4. Troubleshooting — symptom → cause → fix

| Symptom | Likely cause | Fix |
|---|---|---|
| **Site/lore hasn't updated; you got a "Sync Health Check" failure email** | Primary sync stopped — usually the self-hosted runner is offline | Start the runner service (`Start-Service "actions.runner.*"`); if the PC was off, just re-run `gh workflow run "Obsidian Sync"`. Stop-gap: enable the standby (3). |
| **Obsidian Sync workflow fails: `Unexpected token` / `Missing closing '}'`** | **Non-ASCII char in the inline PowerShell** (em-dash `—`, box-drawing `─`, smart quotes). PowerShell 5.1 reads the script as ANSI and mangles them. | Replace every non-ASCII char with ASCII (`—`→`--`, `─`→`-`). See §6. |
| **Standby script fails to parse / same `Unexpected token` errors** | Same non-ASCII issue inside `ahvantir-weekly-sync.ps1` | ASCII-ize the script (§6). Keep it ASCII-only forever. |
| **Standby: `FATAL unhandled exception: From https://github.com...`** | `$ErrorActionPreference = "Stop"` + git captured with `2>&1`: git's normal stderr ("From..."/"To...") becomes a terminating error | Keep `$ErrorActionPreference = "Continue"` (it already is). Control flow uses explicit `$LASTEXITCODE` checks. |
| **Standby: `git push ... rejected (non-fast-forward)`** | This clone fell behind `origin/main` (Actions pushed commits it never pulled) | The script now runs `git pull --rebase --autostash origin main` first. If hit manually: `git -C <repo> pull --rebase origin main`, then push. |
| **Standby task fails instantly, no log file written** | **Path mismatch** — the task's `-File` points somewhere the script isn't | Make sure the script sits at exactly the path in the task action. Check: `(Get-ScheduledTask "Ahvantir Weekly Lore Sync").Actions.Arguments` |
| **An article was edited in the vault but never appears on the site** | Article frontmatter has `status: stub` — the converter **skips stubs** | Set `status: complete` (or remove the line) in the vault file, then re-sync. |
| **Dates display one day off, or timeline grouping is wrong** | YAML parsed a bare `YYYY-MM-DD` as a Date object | **Quote dates** in frontmatter: `date_added: "2026-06-14"`. |
| **Article cards render broken (title-less cards, floating tags)** | A `[[wikilink]]` in the article's `description` got expanded inside the card's own `<a>` (nested anchors) | Handled by the `stripWikilinks` filter (`.eleventy.js`). If it recurs, confirm card/meta descriptions pass through that filter. |
| **Users see old CSS/JS after a deploy** | Browser/edge cache; assets are cached 4h | Asset URLs are content-hashed (`?v=...`) so this self-heals on next visit. For an instant check, hard-refresh (`Ctrl+Shift+R`). |
| **Two sync commits per week / duplicate runs** | Both primary and standby are enabled | Disable the standby (3). Only one should run on schedule. |

---

## 5. Updating / changing things

- **Change the primary sync time:** edit the `cron` in `obsidian-sync.yml` (UTC).
- **Change the staleness threshold or check frequency:** edit `MAX_AGE_DAYS` /
  `cron` in `sync-health.yml`.
- **Edit the standby script:** edit **`scripts/ahvantir-weekly-sync.ps1`** (the
  repo copy is source of truth), keep it **ASCII-only**, then copy it to the live
  location:
  ```powershell
  Copy-Item "<repo>\scripts\ahvantir-weekly-sync.ps1" `
            "C:\Users\klfal\Desktop\Claude_Directory\ahvantir-weekly-sync.ps1" -Force
  ```
- **Re-register the standby task from scratch:** the exact `schtasks /Create`
  command is in the comment block at the bottom of the script.
- **Change the vault location:** update the `OBSIDIAN_VAULT_PATH` GitHub secret
  (for Actions) and the `.env` in the repo (for the standby / local runs).

---

## 6. Hard-won gotchas (read before touching PowerShell or frontmatter)

1. **Never put non-ASCII in a `.ps1` or in inline workflow PowerShell.** Em-dashes
   `—`, box-drawing `─`, smart quotes `‘ ’ “ ”`, ellipsis `…` — all of them.
   Windows PowerShell 5.1 reads the file as ANSI (CP1252), mangles multi-byte
   UTF-8 chars, and the script won't even parse. Use ASCII (`--`, `-`, `'`, `"`,
   `...`). This bit us in **both** the workflow and the standby script.
   - Quick audit: `python -c "print([hex(ord(c)) for c in open('file.ps1',encoding='utf-8').read() if ord(c)>127])"`
2. **Capturing git output in PowerShell:** if you use `& git ... 2>&1`, keep
   `$ErrorActionPreference = "Continue"`, or git's normal stderr will throw under
   `"Stop"`.
3. **Quote dates in YAML frontmatter** (`"YYYY-MM-DD"`), or they parse as Date
   objects and break string comparisons / grouping.
4. **`status: stub`** articles are intentionally skipped by `obsidian-to-md.py`.
   Set `status: complete` to publish.
5. **The two sync mechanisms run on the same PC.** Resilience comes from the
   monitor + a ready standby, not from running both at once.

---

## 7. File & location index

| What | Where |
|---|---|
| Vault → markdown converter | `scripts/obsidian-to-md.py` |
| Primary sync workflow | `.github/workflows/obsidian-sync.yml` |
| Standby script (canonical) | `scripts/ahvantir-weekly-sync.ps1` |
| Standby script (live copy) | `C:\Users\klfal\Desktop\Claude_Directory\ahvantir-weekly-sync.ps1` |
| Standby log | `C:\Users\klfal\Desktop\Claude_Directory\ahvantir-sync-log.txt` |
| Health monitor | `.github/workflows/sync-health.yml` |
| Build & deploy | `.github/workflows/deploy.yml` |
| Self-hosted runner service | `actions.runner.DJ-JackJack-Ahvantir-website.ahvantir-runner` on FENRIS-FOUNDRY |
| This runbook | `docs/SYNC_RUNBOOK.md` |
