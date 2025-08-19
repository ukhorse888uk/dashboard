# === Define paths ===
$repoPath = "C:\Users\cheun\OneDrive\Documents\GitHub\dashboard"

# Source CSVs (your Excel exports here)
$sourceRacecard = "C:\Users\cheun\OneDrive\APIPROJ\Dashboard\csv\racecard.csv"
$sourceDropOdds = "C:\Users\cheun\OneDrive\APIPROJ\Dashboard\csv\dropodds.csv"

# Destination CSVs inside your GitHub repo folder
$destinationRacecard = "$repoPath\csv\racecard.csv"
$destinationDropOdds = "$repoPath\csv\dropodds.csv"

# === Copy updated CSV files ===
Copy-Item -Path $sourceRacecard -Destination $destinationRacecard -Force
Copy-Item -Path $sourceDropOdds -Destination $destinationDropOdds -Force

# === Change directory to your GitHub repo root ===
Set-Location $repoPath

# === Git operations: pull latest first to avoid rejected push ===
git pull origin main --rebase

# === Stage changes ===
git add "csv\racecard.csv"
git add "csv\dropodds.csv"

# === Commit with current timestamp if there are changes ===
if (-not (git diff --cached --quiet)) {
    git commit -m "Auto update racecard & dropodds - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git push origin main
} else {
    Write-Host "No changes to commit."
}

