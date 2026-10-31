$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js не найден. Установите Node.js и откройте PowerShell заново." }

# Refresh PATH from Windows registry so newly installed commands are visible here.
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machinePath;$userPath;$env:LOCALAPPDATA\Microsoft\WinGet\Links;$env:LOCALAPPDATA\Microsoft\WindowsApps"

if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "Не найден winget. Установите mkcert для Windows и повторите запуск."
    }
    Write-Host "Устанавливаю mkcert..."
    winget install --id FiloSottile.mkcert -e --accept-package-agreements --accept-source-agreements
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath;$env:LOCALAPPDATA\Microsoft\WinGet\Links;$env:LOCALAPPDATA\Microsoft\WindowsApps"
}
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    throw "Команда mkcert не найдена. Закройте PowerShell, откройте его снова и повторите .\setup-local.ps1."
}

$ip = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } | ForEach-Object { $_.IPv4Address.IPAddress } | Where-Object { $_ -notlike "169.254.*" } | Select-Object -First 1
if (-not $ip) { throw "Не удалось определить локальный IP. Проверьте Wi-Fi и команду ipconfig." }

New-Item -ItemType Directory -Force -Path ".\certs" | Out-Null
Write-Host "Проверяю локальный центр сертификации Windows..."
# Для Chrome и Edge достаточно хранилища Windows; Java keystore не используется.
$previousTrustStores = $env:TRUST_STORES
$env:TRUST_STORES = "system"
mkcert -install
$installExitCode = $LASTEXITCODE
if ($null -eq $previousTrustStores) { Remove-Item Env:TRUST_STORES -ErrorAction SilentlyContinue }
else { $env:TRUST_STORES = $previousTrustStores }
if ($installExitCode -ne 0) { throw "Не удалось установить сертификат в хранилище Windows. Проверьте права пользователя." }

Write-Host "Создаю HTTPS-сертификат для IP $ip..."
mkcert -cert-file ".\certs\fallguard.pem" -key-file ".\certs\fallguard-key.pem" localhost 127.0.0.1 ::1 $ip
if ($LASTEXITCODE -ne 0) { throw "Не удалось создать HTTPS-сертификат." }

$caRoot = (mkcert -CAROOT).Trim()
Copy-Item (Join-Path $caRoot "rootCA.pem") ".\rootCA.crt" -Force
Write-Host ""
Write-Host "На компьютере: https://localhost:8443"
Write-Host ("На телефоне: https://" + $ip + ":8443")
Write-Host "Скопируйте rootCA.crt на Android и установите как сертификат CA."
Write-Host "Телефон и компьютер должны быть подключены к одной Wi-Fi сети."
Write-Host ""
npm start
