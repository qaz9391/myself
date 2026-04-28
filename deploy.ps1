#!/usr/bin/env pwsh
# ============================================================
# deploy.ps1 — 部署 TradingMonitor 到 VPS
# 使用方法: .\deploy.ps1
# 需求: 本地已有 SSH 連線到 79.143.178.124
# ============================================================

$VPS_IP   = "79.143.178.124"
$VPS_USER = "root"
$VPS_PATH = "/opt/tradingmonitor"
$LOCAL_FRONTEND = ".\frontend"

Write-Host "=== TradingMonitor 部署腳本 ===" -ForegroundColor Cyan

# Step 1: Build SvelteKit
Write-Host "[1/4] 建構 SvelteKit (node adapter)..." -ForegroundColor Yellow
Set-Location $LOCAL_FRONTEND
npm run build
Set-Location ..

# Step 2: Upload via SCP
Write-Host "[2/4] 上傳檔案到 VPS..." -ForegroundColor Yellow
# Upload build output + package.json
scp -r "frontend\build"           "${VPS_USER}@${VPS_IP}:${VPS_PATH}/build"
scp    "frontend\package.json"    "${VPS_USER}@${VPS_IP}:${VPS_PATH}/package.json"
scp    "frontend\package-lock.json" "${VPS_USER}@${VPS_IP}:${VPS_PATH}/package-lock.json"

# Upload .env file (contains API keys)
if (Test-Path "frontend\.env") {
    scp "frontend\.env" "${VPS_USER}@${VPS_IP}:${VPS_PATH}/.env"
    Write-Host "  .env 已上傳" -ForegroundColor Green
}

# Step 3: Install deps on VPS + restart PM2
Write-Host "[3/4] VPS 安裝依賴 + 重啟..." -ForegroundColor Yellow
$remote_cmd = @"
cd ${VPS_PATH}
npm ci --omit=dev
pm2 stop tradingmonitor 2>/dev/null || true
pm2 start build/index.js --name tradingmonitor -- --port 3000
pm2 save
echo '=== 部署完成 ==='
pm2 list
"@
ssh "${VPS_USER}@${VPS_IP}" $remote_cmd

Write-Host "[4/4] 完成！" -ForegroundColor Green
Write-Host ""
Write-Host "網站現在可以訪問: http://${VPS_IP}" -ForegroundColor Cyan
