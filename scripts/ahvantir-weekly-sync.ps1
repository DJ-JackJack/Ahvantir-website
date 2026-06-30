#Requires -Version 5.1
<#
.SYNOPSIS
    Weekly Ahvantir lore sync -- reads Obsidian vault, converts articles,
    commits changes, and pushes to GitHub, triggering a site rebuild.

.DESCRIPTION
    Designed for Windows Task Scheduler. Runs every Sunday at 21:00.
    Logs everything to ahvantir-sync-log.txt next to this script.

    Step 1: Run scripts/obsidian-to-md.py (reads vault, writes src/articles/)
    Step 2: Check git status -- exit cleanly if nothing changed
    Step 3: git add -A / git commit / git push origin main

.NOTES
    Register with Task Scheduler using the schtasks command at the bottom of this file.
    Requires Git and Python 3 on PATH. Git Credential Manager must already have
    credentials stored (run `git push` manually once if unsure).
#>

Set-StrictMode -Version Latest
# NOTE: keep this at "Continue", not "Stop". Every git call below is captured
# with `2>&1`, and git writes normal progress ("From https://...", "To
# https://...") to stderr. Under "Stop", PowerShell 5.1 turns those benign
# stderr lines into terminating errors and the run dies mid-sync. Control flow
# here is driven by explicit $LASTEXITCODE checks after each command, and the
# outer try/catch still catches genuine exceptions.
$ErrorActionPreference = "Continue"

# --- Paths --------------------------------------------------------------------

$RepoPath   = "C:\Users\klfal\Desktop\Claude_Directory\Ahvantir-website"
$SyncScript = Join-Path $RepoPath "scripts\obsidian-to-md.py"
$LogFile    = "C:\Users\klfal\Desktop\Claude_Directory\ahvantir-sync-log.txt"

# --- Logging ------------------------------------------------------------------

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO","WARN","ERROR")][string]$Level = "INFO"
    )
    $ts   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $line
}

function Write-LogBlock {
    param([string[]]$Lines, [string]$Prefix = "       ")
    foreach ($line in $Lines) {
        if ($line -ne $null -and $line.ToString().Trim() -ne "") {
            Write-Log "$Prefix$($line.ToString().Trim())"
        }
    }
}

# --- Entry point --------------------------------------------------------------

# Always write a run-start separator so the log is easy to scan
Add-Content -Path $LogFile -Value "" -Encoding UTF8
Add-Content -Path $LogFile -Value ("-" * 72) -Encoding UTF8
Write-Log "Ahvantir weekly lore sync -- starting"

$exitCode = 0

try {

    # -- 1. Sanity-check paths ------------------------------------------------

    if (-not (Test-Path $RepoPath -PathType Container)) {
        Write-Log "Repo path not found: $RepoPath" ERROR
        exit 1
    }

    if (-not (Test-Path $SyncScript -PathType Leaf)) {
        Write-Log "Sync script not found: $SyncScript" ERROR
        exit 1
    }

    Write-Log "Repo   : $RepoPath"
    Write-Log "Script : $SyncScript"
    Write-Log "Log    : $LogFile"

    # -- 2. Locate Python -----------------------------------------------------
    # The npm 'sync' script uses 'python3'; try that first, fall back to 'python'.

    $Python = $null
    foreach ($candidate in @("python3", "python")) {
        if (Get-Command $candidate -ErrorAction SilentlyContinue) {
            $Python = $candidate
            break
        }
    }

    if (-not $Python) {
        Write-Log "Python not found on PATH -- install Python 3 and ensure it is on PATH." ERROR
        exit 1
    }

    $pyVersion = & $Python --version 2>&1
    Write-Log "Python : $pyVersion ($Python)"

    # -- 3. Run the sync script -----------------------------------------------

    Write-Log "Running obsidian-to-md.py ..."

    Push-Location $RepoPath
    try {
        $syncOutput = & $Python scripts\obsidian-to-md.py 2>&1
        $syncExit   = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    Write-LogBlock -Lines ($syncOutput | ForEach-Object { $_.ToString() }) -Prefix "  [py] "

    if ($syncExit -ne 0) {
        Write-Log "obsidian-to-md.py exited with code $syncExit" ERROR
        exit 1
    }

    Write-Log "Sync script finished OK (exit 0)"

    # -- 3b. Reconcile with origin --------------------------------------------
    # This clone can fall behind origin/main (e.g. commits pushed by the
    # GitHub Actions sync that this clone never pulled). Without this, a later
    # `git push` would be rejected as non-fast-forward. Pull --rebase with
    # --autostash so the converter's just-written changes are set aside, the
    # branch fast-forwards onto origin, then the changes are reapplied.

    Push-Location $RepoPath
    try {
        Write-Log "Reconciling local clone with origin/main ..."
        $pullOut  = & git pull --rebase --autostash origin main 2>&1
        $pullExit = $LASTEXITCODE
        Write-LogBlock -Lines ($pullOut | ForEach-Object { $_.ToString() }) -Prefix "  [git] "
        if ($pullExit -ne 0) {
            Write-Log "git pull --rebase failed (exit $pullExit) -- resolve manually before next run" ERROR
            exit 1
        }
        Write-Log "Reconciled with origin/main -- OK"
    }
    finally {
        Pop-Location
    }

    # -- 4. Check for git changes ---------------------------------------------

    Push-Location $RepoPath
    try {

        $gitStatus     = & git status --porcelain 2>&1
        $gitStatusExit = $LASTEXITCODE

        if ($gitStatusExit -ne 0) {
            Write-Log "git status failed (exit $gitStatusExit): $gitStatus" ERROR
            exit 1
        }

        # Filter to non-empty lines
        $changedLines = @($gitStatus | Where-Object { $_.ToString().Trim() -ne "" })

        if ($changedLines.Count -eq 0) {
            Add-Content -Path $LogFile -Value "=== Ahvantir Lore Sync -- $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===" -Encoding UTF8
            Add-Content -Path $LogFile -Value "No changes -- nothing to commit." -Encoding UTF8
            Add-Content -Path $LogFile -Value "===" -Encoding UTF8
            Write-Log "Ahvantir weekly lore sync -- complete (no changes)"
            exit 0
        }

        # -- 5. Stage ---------------------------------------------------------

        $addOut  = & git add -A 2>&1
        $addExit = $LASTEXITCODE

        if ($addExit -ne 0) {
            Write-Log "git add -A failed (exit $addExit): $addOut" ERROR
            exit 1
        }
        Write-Log "git add -A -- OK"

        # -- 5b. Build change summary from staged index ------------------------
        # git diff --name-status --cached emits A (added) or M (modified) per file.

        $diffOut  = & git diff --name-status --cached 2>&1
        $runStamp = Get-Date -Format "yyyy-MM-dd HH:mm"
        $newFiles = @()
        $modFiles = @()

        foreach ($entry in $diffOut) {
            $s = $entry.ToString().Trim()
            if ($s -match '^([AM])\s+(.+)$') {
                if ($Matches[1] -eq "A") { $newFiles += $Matches[2].Trim() }
                else                     { $modFiles += $Matches[2].Trim() }
            }
        }

        $totalChanged = $newFiles.Count + $modFiles.Count
        Add-Content -Path $LogFile -Value "=== Ahvantir Lore Sync -- $runStamp ===" -Encoding UTF8
        Add-Content -Path $LogFile -Value "Articles updated ($totalChanged):" -Encoding UTF8
        foreach ($f in $newFiles) { Add-Content -Path $LogFile -Value "  + $f (new)"      -Encoding UTF8 }
        foreach ($f in $modFiles) { Add-Content -Path $LogFile -Value "  ~ $f (modified)" -Encoding UTF8 }

        # -- 6. Commit --------------------------------------------------------

        $dateStr    = Get-Date -Format "yyyy-MM-dd"
        $commitMsg  = "Weekly lore sync -- $dateStr"

        $commitOut  = & git commit -m $commitMsg 2>&1
        $commitExit = $LASTEXITCODE

        if ($commitExit -ne 0) {
            Write-Log "git commit failed (exit $commitExit): $commitOut" ERROR
            exit 1
        }
        Write-LogBlock -Lines ($commitOut | ForEach-Object { $_.ToString() }) -Prefix "  [git] "
        Write-Log "git commit -- OK"

        # -- 7. Push ----------------------------------------------------------

        Write-Log "Pushing to origin/main ..."
        $pushOut  = & git push origin main 2>&1
        $pushExit = $LASTEXITCODE

        Write-LogBlock -Lines ($pushOut | ForEach-Object { $_.ToString() }) -Prefix "  [git] "

        if ($pushExit -ne 0) {
            Write-Log "git push failed (exit $pushExit)" ERROR
            exit 1
        }

        Write-Log "git push -- OK"
        Add-Content -Path $LogFile -Value "Committed and pushed. Build triggered." -Encoding UTF8
        Add-Content -Path $LogFile -Value "===" -Encoding UTF8
        Write-Log "Ahvantir weekly lore sync -- complete ($totalChanged file(s) pushed, GitHub Actions deploying ahvantir.world)"

    }
    finally {
        Pop-Location
    }

}
catch {
    # Catch-all: write the full exception to the log and exit non-zero
    Write-Log "FATAL unhandled exception: $_" ERROR
    $exitCode = 1
}

exit $exitCode

<#
================================================================================
  WINDOWS TASK SCHEDULER -- REGISTRATION COMMAND
  Run this in an Administrator PowerShell once to register the weekly task.
================================================================================

schtasks /Create /TN "Ahvantir Weekly Lore Sync" /TR "powershell.exe -NonInteractive -ExecutionPolicy Bypass -File \"C:\Users\klfal\Desktop\Claude_Directory\ahvantir-weekly-sync.ps1\"" /SC WEEKLY /D SUN /ST 21:00 /RU "klfal" /F

  Flags:
    /TN   Task name (visible in Task Scheduler GUI)
    /TR   Command to run
    /SC   Schedule type: weekly
    /D    Day: Sunday
    /ST   Start time: 21:00 (9 PM)
    /RU   Run as this user (uses Git Credential Manager automatically)
    /F    Force-overwrite if task already exists

  Useful follow-up commands:
    Verify:   schtasks /Query /TN "Ahvantir Weekly Lore Sync" /FO LIST
    Test run: schtasks /Run /TN "Ahvantir Weekly Lore Sync"
    Remove:   schtasks /Delete /TN "Ahvantir Weekly Lore Sync" /F
================================================================================
#>
