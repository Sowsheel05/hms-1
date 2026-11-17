<#
.SYNOPSIS
    HMS Server Deployment & Update Script (Windows Server)
    Automatically updates repository, executes database schema push, runs facility import, builds, and restarts services.
#>

param (
    [string]$Branch = "feat/security-hardening-and-fee-management"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🚀 HMS Deployment: Updating Windows Server from Git" -ForegroundColor Cyan
Write-Host "Directory: $RootDir" -ForegroundColor Gray
Write-Host "Branch: $Branch" -ForegroundColor Gray
Write-Host "Time: $(Get-Date)" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

Set-Location -Path $RootDir

Write-Host "📥 [1/6] Pulling latest changes from git..." -ForegroundColor Yellow
git fetch origin
git checkout $Branch
git reset --hard "origin/$Branch"

Write-Host "📦 [2/6] Installing dependencies..." -ForegroundColor Yellow
npm install
npm --prefix backend install
npm --prefix frontend install

Write-Host "🗄️ [3/6] Applying Prisma schema updates..." -ForegroundColor Yellow
Set-Location -Path "$RootDir\backend"
npx prisma generate
npx prisma db push --skip-generate
Set-Location -Path $RootDir

Write-Host "🏗️ [4/6] Building backend & frontend..." -ForegroundColor Yellow
npm --prefix backend run build
npm --prefix frontend run build

Write-Host "📊 [5/6] Checking for facility Excel template..." -ForegroundColor Yellow
if (Test-Path "$RootDir\HMS_Hostel_Facility_Setup_Template.xlsx") {
    Write-Host "Running automated facility importer..." -ForegroundColor Green
    npm run import:facility
}

Write-Host "🔄 [6/6] Reloading PM2 services..." -ForegroundColor Yellow
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    pm2 reload ecosystem.config.js --env production
    pm2 save
    Write-Host "PM2 reload complete." -ForegroundColor Green
} else {
    Write-Host "PM2 not found. Restart your local Node service or task scheduler." -ForegroundColor Yellow
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "✅ Server successfully updated and running latest version!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
