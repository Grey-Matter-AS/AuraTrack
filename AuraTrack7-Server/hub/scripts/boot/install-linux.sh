#!/bin/sh
# Starts AuraTrack Hub when you log in (a systemd user service), and keeps it running. Run once, from the folder that holds hub.mjs.
# Needs Node 24 or newer. To use https, put the paths of your certificate and key in HUB_CERT and HUB_KEY below.
set -eu
DIR="$(cd "$(dirname "$0")" && pwd)"
HUB="${HUB_FILE:-$DIR/hub.mjs}"
[ -f "$HUB" ] || { echo "Cannot find hub.mjs at $HUB. Build it first: pnpm build"; exit 1; }
NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "Node 24 or newer is needed (https://nodejs.org)"; exit 1; }
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/auratrack-hub.service" <<UNIT
[Unit]
Description=AuraTrack Hub
After=network-online.target

[Service]
ExecStart=$NODE $HUB
Restart=on-failure
RestartSec=5
Environment=HUB_PORT=8420
# Environment=HUB_CERT=/path/to/cert.pem
# Environment=HUB_KEY=/path/to/key.pem

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now auratrack-hub.service
echo "AuraTrack Hub is running. Status page: http://localhost:8420/status"
echo "Check it with: systemctl --user status auratrack-hub"
echo "To keep it running when you are logged out: loginctl enable-linger $USER"
