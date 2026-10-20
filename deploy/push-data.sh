#!/usr/bin/env bash
# Run once on your Mac to move everything to the server: every account and PIN, leagues, teams, logos, Pack Points,
# slabs, chat, uploads. Usage:
#
#   bash deploy/push-data.sh ubuntu@<server-ip>
#
# It snapshots the live database safely (even while the app runs), copies it with your uploads and the session secret
# (so everyone stays logged in), and restarts the app on the server with it. After this, the server is the real copy:
# play there, not on your Mac.
set -euo pipefail
TARGET="${1:?usage: push-data.sh ubuntu@<server-ip>}"
cd "$(dirname "$0")/.."
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/data"
sqlite3 data/packdraft-nba.db ".backup '$STAGE/data/packdraft-nba.db'"
cp data/.secret "$STAGE/data/" 2>/dev/null || true
for d in uploads thumbs slabs library; do [ -d "data/$d" ] && cp -R "data/$d" "$STAGE/data/"; done
tar -C "$STAGE/data" -czf "$STAGE/packdraft-data.tgz" .
echo "==> Copying $(du -h "$STAGE/packdraft-data.tgz" | cut -f1) to $TARGET"
scp "$STAGE/packdraft-data.tgz" "$TARGET:/tmp/packdraft-data.tgz"
ssh "$TARGET" 'set -e
  sudo systemctl stop packdraft
  cd /opt/packdraft/data.nosync
  [ -f packdraft-nba.db ] && mkdir -p backups && mv packdraft-nba.db "backups/replaced-$(date +%Y%m%d-%H%M%S).db" || true
  rm -f packdraft-nba.db-wal packdraft-nba.db-shm
  tar -xzf /tmp/packdraft-data.tgz && rm /tmp/packdraft-data.tgz
  sudo systemctl start packdraft
  echo "Data restored. Users: $(sqlite3 packdraft-nba.db "SELECT COUNT(*) FROM users"), leagues: $(sqlite3 packdraft-nba.db "SELECT COUNT(*) FROM leagues")"'
