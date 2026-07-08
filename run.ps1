# ==============================================================================
# Dual-Stream Deepfake App — Master Start Script
# ==============================================================================
# This script launches the Python FastAPI backend and Next.js frontend
# in separate, concurrent terminal windows on Windows.
# ==============================================================================

Clear-Host
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting Deepfake Complete Web App Development Stack" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# Find the appropriate virtual environment path
$venvPath = ""
if (Test-Path ".\deepfake-backend\venv") {
    $venvPath = "venv"
} elseif (Test-Path ".\deepfake-backend\env") {
    $venvPath = "env"
} elseif (Test-Path ".\deepfake-backend\.venv") {
    $venvPath = ".venv"
}

# 1. Start backend in a new window
Write-Host "[1/2] Launching FastAPI Backend Server..." -ForegroundColor Yellow
if ($venvPath) {
    Write-Host "      Detected virtual environment: $venvPath" -ForegroundColor Gray
    $backendCmd = "cd .\deepfake-backend; .\$venvPath\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
} else {
    Write-Host "      No local virtual environment detected. Launching with global Python interpreter..." -ForegroundColor DarkYellow
    $backendCmd = "cd .\deepfake-backend; uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
}

Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "
  `$Host.UI.RawUI.WindowTitle = 'Dual-Stream Backend Service (Port 8000)';
  $backendCmd
"

# 2. Start frontend in a new window
Write-Host "[2/2] Launching Next.js Frontend Server..." -ForegroundColor Yellow
$frontendCmd = "cd .\deepfake-scanner-web; npm.cmd run dev"

Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "
  `$Host.UI.RawUI.WindowTitle = 'Next.js Frontend Service (Port 3000)';
  $frontendCmd
"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Development Stack Running Successfully!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  - Backend API: http://127.0.0.1:8000" -ForegroundColor Gray
Write-Host "  - Frontend App: http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to close this launcher menu (services will keep running)..." -ForegroundColor DarkGray
Read-Host
