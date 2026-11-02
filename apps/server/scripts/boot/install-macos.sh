#!/bin/sh
# Starts AuraTrack Hub when you log in (a launchd agent), and keeps it running. Run once, next to hub.mjs. Needs Node 24 or newer.
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
HUB="${HUB_FILE:-$DIR/hub.mjs}"
[ -f "$HUB" ] || { echo "Cannot find hub.mjs at $HUB. Build it first: pnpm build"; exit 1; }
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "Node 24 or newer is needed (https://nodejs.org)"; exit 1; }
PLIST="$HOME/Library/LaunchAgents/com.auratrack.hub.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.auratrack.hub</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$HUB</string></array>
  <key>EnvironmentVariables</key><dict><key>HUB_PORT</key><string>8420</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/auratrack-hub.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/auratrack-hub.log</string>
</dict></plist>
PLIST
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "AuraTrack Hub is running. Status page: http://localhost:8420/status"
