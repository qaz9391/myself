param(
    [string]$VPS_IP   = "79.143.178.124",
    [string]$VPS_USER = "root",
    [string]$VPS_PATH = "/opt/tradingmonitor"
)

Write-Host "--- TradingMonitor TAR Deploy Script ---" -ForegroundColor Cyan

# 1. Build
Write-Host "[1/3] Building latest code..." -ForegroundColor Yellow
cd frontend
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit }

# 2. Compress with TAR (CRITICAL: fixes Windows backslash bug)
Write-Host "[2/3] Compressing build folder using tar..." -ForegroundColor Yellow
if (Test-Path "build.tar.gz") { Remove-Item "build.tar.gz" -Force }
tar -czf build.tar.gz build
cd ..

# 3. Upload & Restart
Write-Host "[3/3] Uploading and Restarting (requires password: allen93914)..." -ForegroundColor Yellow
scp -o PubkeyAuthentication=no "frontend\build.tar.gz" "${VPS_USER}@${VPS_IP}:${VPS_PATH}/build.tar.gz"
scp -o PubkeyAuthentication=no "frontend\.env" "${VPS_USER}@${VPS_IP}:${VPS_PATH}/.env"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Upload complete. Extracting and restarting..." -ForegroundColor Yellow
    ssh -o PubkeyAuthentication=no "${VPS_USER}@${VPS_IP}" "cd ${VPS_PATH} && rm -rf build && tar -xzf build.tar.gz && rm build.tar.gz && pm2 restart tradingmonitor --update-env"
    Write-Host "--- Deploy Complete! Check http://${VPS_IP} ---" -ForegroundColor Green
} else {
    Write-Host "Upload failed." -ForegroundColor Red
}
