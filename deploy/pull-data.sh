#!/usr/bin/env bash
# Copy the LIVE database (and uploads) down to your Mac, so localhost runs on real data while you build and test a
# feature. Your Mac's copy is only for testing: nothing you do on localhost reaches the live site.
#
#   bash deploy/pull-data.sh            (stop the local dev server first, then start it again after)
set -euo pipefail
HOST="${HOST:-ubuntu@129.153.53.112}"
KEY="${SSH_KEY:-$HOME/.ssh/packdraft_oracle}"
cd "$(dirname "$0")/.."
ssh -i "$KEY" "$HOST" 'cd /opt/packdraft/data.nosync && sqlite3 packdraft-nba.db ".backup /tmp/pd-pull.db" && tar -czf /tmp/pd-pull.tgz -C /tmp pd-pull.db -C /opt/packdraft/data.nosync uploads && rm /tmp/pd-pull.db'
scp -i "$KEY" "$HOST:/tmp/pd-pull.tgz" /tmp/pd-pull.tgz
ssh -i "$KEY" "$HOST" 'rm -f /tmp/pd-pull.tgz'
mkdir -p data/backups
[ -f data/packdraft-nba.db ] && mv data/packdraft-nba.db "data/backups/local-$(date +%Y%m%d-%H%M%S).db"
rm -f data/packdraft-nba.db-wal data/packdraft-nba.db-shm
tar -xzf /tmp/pd-pull.tgz -C data && mv data/pd-pull.db data/packdraft-nba.db && rm /tmp/pd-pull.tgz
echo "Local copy now matches the live site. Start the dev server and test away."
