# AuraTrack Hub in Docker (optional: for a Raspberry Pi or NAS). Build from the repository root:
#   pnpm build && docker build -f AuraTrack7-Server/hub/Dockerfile -t auratrack-hub .
# Run:  docker run -d --restart unless-stopped -p 8420:8420 -v auratrack-hub:/data auratrack-hub
# Put it behind https (Tailscale, or your own certificate: mount it and set HUB_CERT and HUB_KEY).
FROM node:24-slim
WORKDIR /app
COPY AuraTrack7-Server/hub/dist/hub.mjs ./hub.mjs
COPY AuraTrack7-PWA/dist ./app
ENV HUB_PORT=8420 HUB_DATA=/data HUB_BACKUPS=/data/backups HUB_APP=/app/app
VOLUME /data
EXPOSE 8420
USER node
CMD ["node", "hub.mjs"]
