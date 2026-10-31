$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is missing. Install Node.js LTS and reopen PowerShell." }
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) { winget install --id FiloSottile.mkcert -e --accept-package-agreements --accept-source-agreements }
  else { throw "Install mkcert for Windows, then run this script again." }
}
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) { throw "Close and reopen PowerShell, then run this script again." }
$ip = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | ForEach-Object { $_.IPv4Address.IPAddress } | Where-Object { $_ -notlike "169.254.*" } | Select-Object -First 1
if (-not $ip) { throw "Could not find a local network IP. Check ipconfig and Wi-Fi." }
New-Item -ItemType Directory -Force -Path ".\certs" | Out-Null
mkcert -install
mkcert -cert-file ".\certs\fallguard.pem" -key-file ".\certs\fallguard-key.pem" localhost 127.0.0.1 ::1 $ip
$caRoot = (mkcert -CAROOT).Trim()
Copy-Item (Join-Path $caRoot "rootCA.pem") ".\rootCA.crt" -Force
Write-Host ""
Write-Host "PC URL: https://localhost:8443"
Write-Host ("PHONE URL: https://" + $ip + ":8443")
Write-Host "Copy rootCA.crt to your Android phone and install it as a CA certificate."
Write-Host "Android settings usually: Security > Encryption & credentials > Install a certificate > CA certificate."
Write-Host "Only install the certificate generated on your own PC."
Write-Host ""
npm start