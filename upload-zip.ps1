param(
    [string]$VPS_IP   = "79.143.178.124",
    [string]$VPS_USER = "root",
    [string]$VPS_PATH = "/opt/tradingmonitor"
)

Write-Host "--- Fast ZIP Upload & Deploy ---" -ForegroundColor Cyan

# Step 1: Upload ZIP
Write-Host "[1/3] Uploading build.zip..."
scp -o StrictHostKeyChecking=no build.zip "${VPS_USER}@${VPS_IP}:${VPS_PATH}/"

# Step 2: Extract & Clean
Write-Host "[2/3] Extracting on VPS..."
$remoteScript = @"
cd ${VPS_PATH}
apt-get install -y unzip > /dev/null 2>&1
unzip -o build.zip
rm build.zip
"@
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" $remoteScript

# Step 3: Restart
Write-Host "[3/3] Restarting PM2..."
$restartScript = @"
cd ${VPS_PATH}
npm ci --omit=dev --silent
pm2 delete tradingmonitor 2>/dev/null || true
PORT=3000 pm2 start build/index.js --name tradingmonitor
pm2 save
"@
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" $restartScript

Write-Host "Done! http://${VPS_IP}" -ForegroundColor Green
