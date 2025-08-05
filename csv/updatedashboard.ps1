# === Define paths ===
$repoPath = "C:\Users\cheun\OneDrive\Documents\GitHub\dashboard"

# Source CSVs (your Excel exports here)
$sourceRacecard = "C:\Users\cheun\OneDrive\APIPROJ\Dashboard\csv\racecard.csv"
$sourceDropOdds = "C:\Users\cheun\OneDrive\APIPROJ\Dashboard\csv\dropodds.csv"

# Destination CSVs inside your GitHub repo folder
$destinationRacecard = "C:\Users\cheun\OneDrive\Documents\GitHub\dashboard\csv\racecard.csv"
$destinationDropOdds = "C:\Users\cheun\OneDrive\Documents\GitHub\dashboard\csv\dropodds.csv"

# === Copy updated CSV files ===
Copy-Item -Path $sourceRacecard -Destination $destinationRacecard -Force
Copy-Item -Path $sourceDropOdds -Destination $destinationDropOdds -Force

# === Change directory to your GitHub repo root ===
Set-Location $repoPath

# === Git operations: add, commit, and push ===
git add "csv\racecard.csv"
git add "csv\dropodds.csv"

# Commit with current timestamp
git commit -m "Auto update racecard & dropodds - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

# Push to GitHub
git push origin main
