# PregTwin Platform Launcher
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   PREGTWIN: MATERNAL DIGITAL TWIN RESEARCH PLATFORM      " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

# Check Python and Node
Write-Host "[1/3] Verifying environment dependencies..." -ForegroundColor Yellow
$py = python --version
$node = node --version
Write-Host "      Found: $py, $node" -ForegroundColor Green

# Launch Backend in new window
Write-Host "[2/3] Launching FastAPI Backend on http://127.0.0.1:8008..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8008 --reload"

# Launch Frontend in new window
Write-Host "[3/3] Launching Vite React Frontend on http://localhost:5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "PregTwin platform launched successfully!" -ForegroundColor Green
Write-Host "Visit: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Clinician Login: dr.elena@pregtwin.org / Clinician2026!" -ForegroundColor White
Write-Host "Patient Login:   maya.lin@pregtwin.org / Patient2026!" -ForegroundColor White
