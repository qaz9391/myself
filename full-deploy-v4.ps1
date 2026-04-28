param(
    [string]$VPS_IP   = "79.143.178.124",
    [string]$VPS_USER = "root",
    [string]$VPS_PATH = "/opt/tradingmonitor"
)

Write-Host "--- TradingMonitor V4 Pro: Full Auto Deploy ---" -ForegroundColor Cyan

# Step 1: Initialize Environment
Write-Host "[1/4] Initializing Remote Environment (Node.js & PM2)..."
$initScript = @'
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq curl unzip ufw
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
fi
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
fi
mkdir -p /opt/tradingmonitor
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
'@
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" $initScript

# Step 2: Upload build.zip
Write-Host "[2/4] Uploading build.zip..."
scp -o StrictHostKeyChecking=no build.zip "${VPS_USER}@${VPS_IP}:${VPS_PATH}/"

# Step 3: Extract & Install Deps
Write-Host "[3/4] Extracting & Installing Dependencies..."
$extractScript = @"
cd ${VPS_PATH}
unzip -o build.zip
rm build.zip
npm ci --omit=dev --silent
"@
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" $extractScript

# Step 4: Launch
Write-Host "[4/4] Launching with PM2..."
$launchScript = @"
cd ${VPS_PATH}
pm2 delete tradingmonitor 2>/dev/null || true
PORT=3000 pm2 start build/index.js --name tradingmonitor
pm2 save
"@
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" $launchScript

Write-Host "--- SUCCESS! ---" -ForegroundColor Green
Write-Host "Your V4 Pro is live at: http://${VPS_IP}"
