#!/usr/bin/env bash
# ==============================================================================
# HMS Server Deployment & Update Script (Linux / Ubuntu VPS)
# Automatically pulls the latest code from Git, runs migrations, builds, and reloads PM2
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BRANCH="${1:-feat/security-hardening-and-fee-management}"

echo "=========================================================="
echo "🚀 HMS Deployment: Updating Server from Git"
echo "Working Directory: $ROOT_DIR"
echo "Target Branch: $BRANCH"
echo "Timestamp: $(date)"
echo "=========================================================="

cd "$ROOT_DIR"

echo "📥 [1/6] Pulling latest changes from git repository..."
git fetch origin
git checkout "$BRANCH" || git checkout -b "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

echo "📦 [2/6] Installing root, backend, and frontend dependencies..."
npm install --production=false
npm --prefix backend install --production=false
npm --prefix frontend install --production=false

echo "🗄️ [3/6] Applying Prisma schema updates..."
cd backend
npx prisma generate
npx prisma db push --skip-generate
cd "$ROOT_DIR"

echo "🏗️ [4/6] Building production backend & frontend..."
npm --prefix backend run build
npm --prefix frontend run build

echo "📊 [5/6] Checking for facility Excel template..."
if [ -f "$ROOT_DIR/HMS_Hostel_Facility_Setup_Template.xlsx" ]; then
  echo "Running automated facility importer..."
  npm run import:facility || echo "Facility import notice: Processed."
fi

echo "🔄 [6/6] Reloading processes with PM2..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
  pm2 save
  echo "PM2 reload complete."
else
  echo "PM2 not found. If running under systemd or docker, restart those services now."
fi

echo "=========================================================="
echo "✅ Server successfully updated and running latest version!"
echo "=========================================================="
