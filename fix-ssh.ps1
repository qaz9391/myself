param(
    [string]$VPS_IP = "79.143.178.124",
    [string]$VPS_USER = "root"
)

$sshDir = "$env:USERPROFILE\.ssh"
$pubKeyPath = "$sshDir\id_ed25519.pub"

Write-Host "=== SSH Key Fix Tool (No-Chinese Version) ===" -ForegroundColor Cyan

# 1. Check if key exists
if (-not (Test-Path $pubKeyPath)) {
    Write-Host "Key not found. Generating new key..." -ForegroundColor Yellow
    ssh-keygen -t ed25519 -f "$sshDir\id_ed25519" -N '""' -q
}

# 2. Read key
$pubKey = Get-Content $pubKeyPath
Write-Host "Key loaded. Ready to push..."

# 3. Push key
Write-Host "Please enter your VPS password when prompted (allen93914):" -ForegroundColor Green
$remoteCmd = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$pubKey' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_IP}" $remoteCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== SUCCESS! Handshake Complete ===" -ForegroundColor Green
    Write-Host "Now you can run: ./upload-zip.ps1"
} else {
    Write-Host "Push failed. Please check your VPS password." -ForegroundColor Red
}
