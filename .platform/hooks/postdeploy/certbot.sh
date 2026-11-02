#!/usr/bin/env bash
set -euo pipefail

DOMAIN="snappick-api.duckdns.org"
EMAIL="shoooongs@gmail.com"

echo "[postdeploy] Ensure certbot"
if ! command -v certbot >/dev/null 2>&1; then
  dnf install -y certbot python3-certbot-nginx
fi

echo "[postdeploy] Install HTTPS certificate for $DOMAIN"
certbot --nginx -n --agree-tos -m "$EMAIL" \
  --keep-until-expiring --redirect -d "$DOMAIN"

echo "[postdeploy] Enable auto renewal"
systemctl enable --now certbot-renew.timer
