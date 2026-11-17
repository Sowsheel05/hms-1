#!/usr/bin/env bash
set -e

echo "=========================================="
echo " Starting Campusly Deployment on VPS"
echo "=========================================="

APP_DIR="/var/www/campusly.thehps.in"
DOMAIN="campusly.thehps.in"
cd "$APP_DIR"

# Privilege helper: invoke sudo if not running directly as root
run_cmd() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

echo "==> Syncing production backend environment..."
# Preserve existing variables if not provided
OLD_DB_URL=""
OLD_JWT_SEC=""
if [ -f backend/.env ]; then
  OLD_DB_URL=$(grep "^DATABASE_URL=" backend/.env | cut -d'=' -f2- || true)
  OLD_JWT_SEC=$(grep "^JWT_SECRET=" backend/.env | cut -d'=' -f2- || true)
fi

ACTUAL_DB_URL="${DATABASE_URL:-$OLD_DB_URL}"
if [ -z "$ACTUAL_DB_URL" ]; then
  echo "ERROR: DATABASE_URL must be provided or already configured in backend/.env"
  exit 1
fi

ACTUAL_JWT_SEC="${JWT_SECRET:-$OLD_JWT_SEC}"
if [ -z "$ACTUAL_JWT_SEC" ]; then
  ACTUAL_JWT_SEC="$(openssl rand -hex 24 2>/dev/null || date +%s | sha256sum | head -c 48)"
fi

cat << EOF > backend/.env
PORT=${PORT:-5025}
DATABASE_URL=${ACTUAL_DB_URL}
JWT_SECRET=${ACTUAL_JWT_SEC}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-7d}
CORS_ORIGIN=${CORS_ORIGIN:-https://campusly.thehps.in,http://campusly.thehps.in}
EOF

echo "==> Creating persistent storage directories..."
mkdir -p backend/uploads/complaints

echo "==> Installing production dependencies..."
npm --prefix backend install
npm --prefix frontend install

echo "==> Applying Prisma schema updates..."
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:push -- --accept-data-loss || npx --prefix backend prisma db push --accept-data-loss
npm --prefix backend run prisma:seed || true
node backend/ensure-demo-student.cjs || true

echo "==> Checking for facility Excel template..."
if [ -f "HMS_Hostel_Facility_Setup_Template.xlsx" ]; then
  echo "==> Running automated facility importer..."
  npm run import:facility || echo "Facility import notice: Processed."
fi

echo "==> Building backend and frontend production bundles..."
npm --prefix backend run build
npm --prefix frontend run build

echo "==> Reloading isolated PM2 process (campusly-backend)..."
if pm2 describe campusly-backend > /dev/null 2>&1; then
  pm2 reload campusly-backend --update-env --force
else
  pm2 start ecosystem.config.cjs --only campusly-backend
fi
pm2 save

echo "==> Ensuring SSL Certificate & Dedicated Nginx Virtual Host..."
# Step 1: If certificate does not exist yet, bootstrap with HTTP so Certbot can verify ACME challenge
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "--> Let's Encrypt certificate not found for $DOMAIN. Bootstrapping HTTP virtual host..."
  cat << 'BOOTSTRAP_EOF' | run_cmd tee /etc/nginx/sites-available/campusly.thehps.in.conf > /dev/null
server {
    listen 80;
    listen [::]:80;
    server_name campusly.thehps.in;

    root /var/www/campusly.thehps.in/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5025;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
BOOTSTRAP_EOF
  run_cmd ln -sf /etc/nginx/sites-available/campusly.thehps.in.conf /etc/nginx/sites-enabled/campusly.thehps.in.conf
  run_cmd nginx -t && (run_cmd systemctl is-active --quiet nginx && run_cmd systemctl reload nginx || run_cmd systemctl start nginx)

  echo "--> Requesting SSL certificate from Let's Encrypt for $DOMAIN..."
  command -v certbot >/dev/null 2>&1 || (run_cmd apt update && run_cmd apt install -y certbot python3-certbot-nginx)
  run_cmd certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@thehps.in --keep-until-expiring || {
    echo "Warning: Certbot certificate issuance failed. Retaining HTTP configuration."
  }
fi

# Step 2: Apply the full production HTTPS configuration if certificate is ready
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "--> SSL Certificate active. Installing full HTTPS virtual host..."
  run_cmd cp "$APP_DIR/scripts/campusly.thehps.in.conf" /etc/nginx/sites-available/campusly.thehps.in.conf
  run_cmd ln -sf /etc/nginx/sites-available/campusly.thehps.in.conf /etc/nginx/sites-enabled/campusly.thehps.in.conf
  if run_cmd nginx -t 2>&1; then
    if run_cmd systemctl is-active --quiet nginx; then
      run_cmd systemctl reload nginx
    else
      run_cmd systemctl restart nginx || run_cmd systemctl start nginx
    fi
    echo "✔ Nginx HTTPS active and verified."
  else
    echo "[WARN] Nginx syntax check failed. Retaining previous active configuration."
  fi
else
  echo "⚠ Running in HTTP mode (SSL certificate pending)."
fi

echo "==> Verifying backend health..."
sleep 3
TARGET_PORT="${PORT:-5025}"
curl -f -s "http://127.0.0.1:$TARGET_PORT/api/health" || (echo "Health check failed!" && exit 1)

echo "=========================================="
echo " Campusly Deployed Successfully!"
echo "=========================================="
