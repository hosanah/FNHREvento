# Script para verificar a instalação do Oracle Instant Client
# Execute com: powershell -ExecutionPolicy Bypass -File test-oracle-client.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verificação do Oracle Instant Client" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$instantClientPath = "C:\oracle\instantclient_19_11"
$requiredFiles = @("oci.dll", "oraociei19.dll")

# Verificar se o diretório existe
Write-Host "1. Verificando diretório do Instant Client..." -ForegroundColor Yellow
if (Test-Path $instantClientPath) {
    Write-Host "   ✓ Diretório encontrado: $instantClientPath" -ForegroundColor Green
} else {
    Write-Host "   ✗ Diretório NÃO encontrado: $instantClientPath" -ForegroundColor Red
    Write-Host "   → Baixe e extraia o Oracle Instant Client para este caminho" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Verificar arquivos necessários
Write-Host "2. Verificando arquivos necessários..." -ForegroundColor Yellow
$missingFiles = @()
foreach ($file in $requiredFiles) {
    $filePath = Join-Path $instantClientPath $file
    if (Test-Path $filePath) {
        Write-Host "   ✓ $file encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $file NÃO encontrado" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "   → Arquivos faltando: $($missingFiles -join ', ')" -ForegroundColor Yellow
    Write-Host "   → Verifique se o download do Basic Package está completo" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Verificar PATH do sistema
Write-Host "3. Verificando PATH do sistema..." -ForegroundColor Yellow
$systemPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($systemPath -like "*$instantClientPath*") {
    Write-Host "   ✓ Instant Client está no PATH do sistema" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Instant Client NÃO está no PATH do sistema" -ForegroundColor Yellow
    Write-Host "   → Isso é opcional, mas recomendado" -ForegroundColor Gray
}

Write-Host ""

# Verificar Visual C++ Redistributable
Write-Host "4. Verificando Visual C++ Redistributable..." -ForegroundColor Yellow
$vcRedist = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* |
            Where-Object { $_.DisplayName -like "*Visual C++*Redistributable*" -and $_.DisplayName -like "*x64*" }

if ($vcRedist) {
    Write-Host "   ✓ Visual C++ Redistributable instalado" -ForegroundColor Green
    foreach ($vc in $vcRedist) {
        Write-Host "     - $($vc.DisplayName) ($($vc.DisplayVersion))" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ Visual C++ Redistributable NÃO encontrado" -ForegroundColor Red
    Write-Host "   → Baixe em: https://aka.ms/vs/17/release/vc_redist.x64.exe" -ForegroundColor Yellow
}

Write-Host ""

# Verificar arquivo .env.production
Write-Host "5. Verificando arquivo .env.production..." -ForegroundColor Yellow
$envFile = Join-Path $PSScriptRoot ".env.production"
if (Test-Path $envFile) {
    Write-Host "   ✓ Arquivo .env.production encontrado" -ForegroundColor Green

    $envContent = Get-Content $envFile -Raw
    if ($envContent -match "ORACLE_CLIENT_LIB_DIR") {
        Write-Host "   ✓ ORACLE_CLIENT_LIB_DIR configurado" -ForegroundColor Green
    } else {
        Write-Host "   ✗ ORACLE_CLIENT_LIB_DIR NÃO configurado no .env.production" -ForegroundColor Red
    }
} else {
    Write-Host "   ✗ Arquivo .env.production NÃO encontrado" -ForegroundColor Red
    Write-Host "   → Crie o arquivo com as configurações necessárias" -ForegroundColor Yellow
}

Write-Host ""

# Verificar web.config
Write-Host "6. Verificando web.config..." -ForegroundColor Yellow
$webConfig = Join-Path $PSScriptRoot "web.config"
if (Test-Path $webConfig) {
    Write-Host "   ✓ Arquivo web.config encontrado" -ForegroundColor Green

    $webConfigContent = Get-Content $webConfig -Raw
    if ($webConfigContent -match "ORACLE_CLIENT_LIB_DIR") {
        Write-Host "   ✓ ORACLE_CLIENT_LIB_DIR configurado no web.config" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ ORACLE_CLIENT_LIB_DIR NÃO configurado no web.config" -ForegroundColor Yellow
        Write-Host "   → Adicione a variável de ambiente na seção <environmentVariables>" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ Arquivo web.config NÃO encontrado" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resumo da Verificação" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($missingFiles.Count -eq 0 -and (Test-Path $instantClientPath)) {
    Write-Host "✓ Oracle Instant Client está instalado corretamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos passos:" -ForegroundColor Yellow
    Write-Host "1. Copie os arquivos do backend para o IIS" -ForegroundColor White
    Write-Host "2. Execute: iisreset" -ForegroundColor White
    Write-Host "3. Teste o backend em: http://localhost:3000/health" -ForegroundColor White
} else {
    Write-Host "✗ Há problemas na instalação do Oracle Instant Client" -ForegroundColor Red
    Write-Host ""
    Write-Host "Revise os itens marcados com ✗ acima" -ForegroundColor Yellow
}

Write-Host ""
