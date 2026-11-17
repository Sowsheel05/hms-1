#!/usr/bin/env bash
# ==============================================================================
# One-Step SSL Repair Script for campusly.thehps.in
# Resolves NET::ERR_CERT_COMMON_NAME_INVALID by activating the dedicated
# Let's Encrypt certificate and HTTPS virtual host for campusly.thehps.in.
# ==============================================================================

set -euo pipefail

DOMAIN="campusly.thehps.in"
APP_DIR="/var/www/campusly.thehps.in"

# Privilege helper: invoke sudo if not running directly as root
run_cmd() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

echo "=========================================================="
echo " 1. Checking Certbot"
echo "=========================================================="
if ! command -v certbot >/dev/null 2>&1; then
    echo "Installing Certbot and Nginx plugin..."
    run_cmd apt update && run_cmd apt install -y certbot python3-certbot-nginx
else
    echo "✔ Certbot is installed."
fi

echo "=========================================================="
echo " 2. Verifying SSL Certificate"
echo "=========================================================="
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "Requesting Let's Encrypt Certificate for $DOMAIN..."
    run_cmd certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@thehps.in --keep-until-expiring
else
    echo "✔ SSL Certificate already present for $DOMAIN."
fi

echo "=========================================================="
echo " 3. Activating Production HTTPS Virtual Host"
echo "=========================================================="
if [ -f "$APP_DIR/scripts/campusly.thehps.in.conf" ]; then
    run_cmd cp "$APP_DIR/scripts/campusly.thehps.in.conf" /etc/nginx/sites-available/campusly.thehps.in.conf
fi

run_cmd ln -sf /etc/nginx/sites-available/campusly.thehps.in.conf /etc/nginx/sites-enabled/
run_cmd nginx -t
run_cmd systemctl reload nginx

echo "=========================================================="
echo "✔ SUCCESS: Dedicated SSL Certificate active for $DOMAIN!"
echo "=========================================================="
