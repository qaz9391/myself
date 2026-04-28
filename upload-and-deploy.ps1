param(
    [string]$VPS_IP   = "79.143.178.124",
    [string]$VPS_USER = "root",
    [string]$VPS_PATH = "/opt/tradingmonitor"
)

Write-Host "--- TradingMonitor VPS Deploy Tool ---" -ForegroundColor Cyan

# Step 0: SSH Key
$sshKeyPath = "$env:USERPROFILE\.ssh\id_ed25519"
if (-not (Test-Path $sshKeyPath)) {
    Write-Host "[0/5] Generating SSH Key..."
    ssh-keygen -t ed25519 -f $sshKeyPath -N "" -q
}

# Step 1: Push Key
Write-Host "[1/5] Setting up SSH Key (Password needed once)..."
$pubKey = Get-Content "$sshKeyPath.pub"
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$pubKey' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

# Step 2: Init VPS
Write-Host "[2/5] Initializing VPS environment..."
$setupScript = @'
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq curl nginx ufw
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
fi
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
    pm2 startup systemd -u root --hp /root > /dev/null 2>&1
fi
mkdir -p /opt/tradingmonitor
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
cat > /etc/nginx/sites-available/tradingmonitor << 'NGINX'
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/tradingmonitor /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
'@
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" $setupScript

# Step 3: Upload
Write-Host "[3/5] Uploading build files..."
ssh "${VPS_USER}@${VPS_IP}" "rm -rf ${VPS_PATH}/build"
scp -r "frontend/build" "${VPS_USER}@${VPS_IP}:${VPS_PATH}/"
scp "frontend/package.json" "${VPS_USER}@${VPS_IP}:${VPS_PATH}/"
scp "frontend/package-lock.json" "${VPS_USER}@${VPS_IP}:${VPS_PATH}/"
if (Test-Path "frontend/.env") {
    scp "frontend/.env" "${VPS_USER}@${VPS_IP}:${VPS_PATH}/.env"
}

# Step 4: Start
Write-Host "[4/5] Starting service..."
$startScript = @"
cd ${VPS_PATH}
npm ci --omit=dev --silent
pm2 delete tradingmonitor 2>/dev/null || true
PORT=3000 pm2 start build/index.js --name tradingmonitor
pm2 save
"@
ssh "${VPS_USER}@${VPS_IP}" $startScript

Write-Host "[5/5] Success! Site: http://${VPS_IP}" -ForegroundColor Green
