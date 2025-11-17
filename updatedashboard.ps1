# === Define paths ===
$repoPath = "C:\Users\cheun\OneDrive\Documents\GitHub\dashboard"

# Source CSVs (your Excel exports here)
$sourceRacecard    = "C:\Users\cheun\OneDrive\APIPROJ\Dashboard\csv\racecard.csv"
$sourceDropOdds    = "C:\Users\cheun\OneDrive\APIPROJ\Dashboard\csv\dropodds.csv"
$sourceDropOdds2   = "C:\Users\cheun\OneDrive\APIPROJ\Dashboard\csv\dropodds2.csv"
$sourceRacecard2   = "C:\Users\cheun\OneDrive\APIPROJ\Dashboard\csv\racecard2.csv"
$sourceRaceform2   = "C:\Users\cheun\OneDrive\APIPROJ\Dashboard\csv\raceform2.csv"
$sourceResult      = "C:\Users\cheun\OneDrive\APIPROJ\Dashboard\csv\RESULT.csv"   # ⭐ NEW

# Destination CSVs inside GitHub repo folder
$destinationRacecard    = "$repoPath\csv\racecard.csv"
$destinationDropOdds    = "$repoPath\csv\dropodds.csv"
$destinationDropOdds2   = "$repoPath\csv\dropodds2.csv"
$destinationRacecard2   = "$repoPath\csv\racecard2.csv"
$destinationRaceform2   = "$repoPath\csv\raceform2.csv"
$destinationResult      = "$repoPath\csv\RESULT.csv"    # ⭐ NEW

# === Change directory to your GitHub repo root ===
Set-Location $repoPath

# === Pull latest from GitHub to avoid rejected push ===
git pull origin main --rebase

# === Copy updated CSV files ===
Copy-Item -Path $sourceRacecard  -Destination $destinationRacecard -Force
Copy-Item -Path $sourceDropOdds  -Destination $destinationDropOdds -Force
Copy-Item -Path $sourceDropOdds2 -Destination $destinationDropOdds2 -Force
Copy-Item -Path $sourceRacecard2 -Destination $destinationRacecard2 -Force
Copy-Item -Path $sourceRaceform2 -Destination $destinationRaceform2 -Force
Copy-Item -Path $sourceResult    -Destination $destinationResult -Force   # ⭐ NEW

# === Stage changes ===
git add "csv\racecard.csv"
git add "csv\dropodds.csv"
git add "csv\dropodds2.csv"
git add "csv\racecard2.csv"
git add "csv\raceform2.csv"
git add "csv\RESULT.csv"   # ⭐ NEW

# === Commit and push only if changes exist ===
if (-not (git diff --cached --quiet)) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "Auto update all CSVs - $timestamp"
    git push origin main
    Write-Host "Changes pushed to GitHub."
} else {
    Write-Host "No changes detected. Nothing to commit."
}


