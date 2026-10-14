#!/bin/bash
# Double-click this file in Finder to start PackDraft and open it in your browser.
cd "$(dirname "$0")" || exit 1

PORT=3000
URL="http://localhost:$PORT"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js isn't installed. Get it from https://nodejs.org (version 22.5 or newer), then try again."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

# Already running? Just open it.
if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "PackDraft is already running at $URL"
  open "$URL"
  exit 0
fi

if [ ! -d node_modules ]; then
  echo "First run: installing dependencies..."
  npm install || { read -n 1 -s -r -p "Install failed. Press any key to close..."; exit 1; }
fi

# Start from a clean build cache so a stale .next folder can never break the app.
rm -rf .next

# Open the browser once the server answers.
( until curl -s -o /dev/null "$URL"; do sleep 1; done; open "$URL" ) &

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null)
echo "Starting PackDraft at $URL"
[ -n "$LAN_IP" ] && echo "Friends on your Wi-Fi can use http://$LAN_IP:$PORT"
echo "Close this window (or press Ctrl+C) to stop the server."
echo
npm run dev -- -p $PORT
