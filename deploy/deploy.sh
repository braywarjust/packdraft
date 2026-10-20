#!/usr/bin/env bash
# Runs on the server for every push to main (from the GitHub Action), or by hand: bash /opt/packdraft/deploy/deploy.sh
# Backs up the database, updates the code to main, and restarts the app. Pass a build archive (made by GitHub) to use
# it as-is; without one it builds here (fine on bigger servers). The database and uploads (data.nosync) are never
# touched by git.
set -euo pipefail
BUILD="${1:-}"
cd /opt/packdraft
mkdir -p data.nosync/backups
if [ -f data.nosync/packdraft-nba.db ]; then
  sqlite3 data.nosync/packdraft-nba.db ".backup data.nosync/backups/pre-deploy-$(date +%Y%m%d-%H%M%S).db"
  ls -1t data.nosync/backups/pre-deploy-*.db | tail -n +15 | xargs -r rm --   # keep the last 14
fi
git fetch --quiet origin main
git reset --hard "${SHA:-origin/main}"
if [ -n "$BUILD" ]; then
  rm -rf .next.nosync node_modules
  tar -xzf "$BUILD" && rm -f "$BUILD"
else
  npm ci --no-audit --no-fund
  npm run build
fi
sudo systemctl restart packdraft
echo "Deployed $(git log -1 --pretty='%h %s')"
