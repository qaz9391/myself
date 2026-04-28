#!/bin/bash
# ============================================================
# TradingMonitor VPS 初始化腳本
# 主機: 79.143.178.124 (Contabo, Ubuntu)
# 跑法: 貼進 root 終端機，一次搞定
# ============================================================
set -e

echo "========================================"
echo "[1/7] 系統更新..."
echo "========================================"
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git ufw nginx certbot python3-certbot-nginx

echo "========================================"
echo "[2/7] 安裝 Node.js 20 LTS..."
echo "========================================"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v

echo "========================================"
echo "[3/7] 安裝 PM2 (程序管理)..."
echo "========================================"
npm install -g pm2
pm2 startup systemd -u root --hp /root

echo "========================================"
echo "[4/7] 設定防火牆..."
echo "========================================"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
ufw status

echo "========================================"
echo "[5/7] 建立應用目錄..."
echo "========================================"
mkdir -p /opt/tradingmonitor
chown root:root /opt/tradingmonitor

echo "========================================"
echo "[6/7] 設定 Nginx 反代..."
echo "========================================"
cat > /etc/nginx/sites-available/tradingmonitor << 'NGINX_CONF'
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/tradingmonitor /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl enable nginx

echo "========================================"
echo "[7/7] 完成！"
echo "========================================"
echo ""
echo "下一步："
echo "  1. 從 Windows 把專案上傳: scp -r 或 git clone"
echo "  2. cd /opt/tradingmonitor/frontend"
echo "  3. npm install && npm run build"
echo "  4. pm2 start 'node build/index.js' --name tradingmonitor -- --port 3000"
echo "  5. pm2 save"
echo ""
echo "系統資訊:"
echo "  Node: $(node -v)"
echo "  PM2:  $(pm2 -v)"
echo "  Nginx: $(nginx -v 2>&1)"
echo ""
echo "現在可以訪問: http://79.143.178.124"
