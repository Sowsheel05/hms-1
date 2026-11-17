#!/usr/bin/env bash
# ==============================================================================
# Isolated VPS Setup Script for Campusly (campusly.thehps.in)
# Designed specifically to run alongside existing services without interrupting them.
# ==============================================================================

set -euo pipefail

DOMAIN="campusly.thehps.in"
APP_DIR="/var/www/campusly.thehps.in"
APP_PORT="5025"
DB_NAME="campusly_production"
DB_USER="campusly_user"
DB_PASS="${DB_PASS:-$(openssl rand -hex 16 2>/dev/null || date +%s | sha256sum | head -c 32)}"
REPO_URL="https://github.com/harsha-perfect-solutions/hms.git"
SSH_PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINIOmb5iPgw/ZIxIC4RiKmaslRyhchR7y3QTAhpRFR/4 github-actions-campusly-hms"

echo "=========================================================="
echo " 1. Verifying & Authorizing CI/CD SSH Deploy Key"
echo "=========================================================="
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

if ! grep -q "github-actions-campusly-hms" ~/.ssh/authorized_keys; then
    echo "$SSH_PUBKEY" >> ~/.ssh/authorized_keys
    echo "✔ Added GitHub Actions deploy key to ~/.ssh/authorized_keys."
else
    echo "✔ Deploy key already exists in ~/.ssh/authorized_keys."
fi

# Ensure github-runner user (if present) has passwordless sudo for automated deployments
if id "github-runner" >/dev/null 2>&1; then
    echo "github-runner ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/github-runner
    chmod 440 /etc/sudoers.d/github-runner
    echo "✔ Sudo permissions granted for github-runner."
fi

echo "=========================================================="
echo " 2. Checking Dependencies (Non-destructive)"
echo "=========================================================="
# Install Git and curl if missing
command -v git >/dev/null 2>&1 || (apt update && apt install -y git curl)

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo "✔ Node.js is already installed ($(node -v))."
fi

# Check PM2
if ! command -v pm2 >/dev/null 2>&1; then
    echo "Installing PM2 globally..."
    npm install -g pm2
else
    echo "✔ PM2 is already installed ($(pm2 -v))."
fi

# Check Nginx
if ! command -v nginx >/dev/null 2>&1; then
    echo "Installing Nginx..."
    apt install -y nginx
else
    echo "✔ Nginx is already installed."
fi

# Check Certbot
if ! command -v certbot >/dev/null 2>&1; then
    echo "Installing Certbot..."
    apt install -y certbot python3-certbot-nginx
else
    echo "✔ Certbot is already installed."
fi

# Check PostgreSQL
if ! command -v psql >/dev/null 2>&1; then
    echo "Installing PostgreSQL..."
    apt install -y postgresql postgresql-contrib
else
    echo "✔ PostgreSQL is already installed."
fi

echo "=========================================================="
echo " 3. Isolated Database Setup (No interference with existing DBs)"
echo "=========================================================="
sudo -u postgres psql -c "DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN
    CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';
  ELSE
    ALTER USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';
  END IF;
END
\$\$;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
echo "✔ PostgreSQL database '$DB_NAME' and user '$DB_USER' configured."

echo "=========================================================="
echo " 4. Port Availability Check ($APP_PORT)"
echo "=========================================================="
if ss -tuln | grep -q ":$APP_PORT "; then
    echo "Note: Port $APP_PORT is currently occupied (might be previous run of hms-backend or another app)."
else
    echo "✔ Port $APP_PORT is free."
fi

echo "=========================================================="
echo " 5. Clone / Initialize Project at $APP_DIR"
echo "=========================================================="
mkdir -p "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
    echo "Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
else
    echo "✔ Repository already present at $APP_DIR."
fi

cd "$APP_DIR"

# Ensure backend uploads directory exists
mkdir -p backend/uploads/complaints

echo "=========================================================="
echo " 6. Bootstrap HTTP Nginx Virtual Host"
echo "=========================================================="
cat << 'EOF' > /etc/nginx/sites-available/campusly.thehps.in.conf
server {
    listen 80;
    listen [::]:80;
    server_name campusly.thehps.in;

    root /var/www/campusly.thehps.in/frontend/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

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

    location ~ ^/api/(student/events|management/events-stream) {
        proxy_pass http://127.0.0.1:5025;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding off;
    }

    location /uploads/ {
        alias /var/www/campusly.thehps.in/backend/uploads/;
        expires 30d;
        access_log off;
    }
}
EOF

ln -sf /etc/nginx/sites-available/campusly.thehps.in.conf /etc/nginx/sites-enabled/

echo "Testing Nginx syntax..."
nginx -t

echo "Reloading Nginx..."
systemctl reload nginx

echo "=========================================================="
echo " 7. Obtaining SSL Certificate for $DOMAIN"
echo "=========================================================="
certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@thehps.in --keep-until-expiring || {
    echo "Warning: Certbot encountered an issue. Please verify DNS A record propagation for $DOMAIN and rerun certbot manually."
}

echo "=========================================================="
echo " 8. Activating Full HTTPS Nginx Configuration"
echo "=========================================================="
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    if [ -f "$APP_DIR/scripts/campusly.thehps.in.conf" ]; then
        cp "$APP_DIR/scripts/campusly.thehps.in.conf" /etc/nginx/sites-available/campusly.thehps.in.conf
    fi
    nginx -t
    systemctl reload nginx
    echo "✔ Production HTTPS virtual host active."
fi

echo "=========================================================="
echo " Setup complete! Ready for automated CI/CD pushes."
echo "=========================================================="
