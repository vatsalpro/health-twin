@echo off
title PregTwin - Maternal Digital Twin Platform
cls
echo ==================================================================
echo   🌸 PregTwin: Maternal Digital Twin Platform
echo   Launching Backend and Frontend servers continuously...
echo ==================================================================
echo.

cd /d "%~dp0"

REM If Git Bash is installed, run the bash script directly with streaming logs
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%~dp0run_app.sh"
    goto end
)

REM Fallback for systems without Git Bash
echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8008...
start "PregTwin Backend (FastAPI)" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8008 --reload"

echo [2/2] Starting Vite Frontend on http://localhost:5173...
start "PregTwin Frontend (Vite)" cmd /k "cd /d %~dp0frontend && npx vite --host 0.0.0.0 --port 5173"

echo.
echo ==================================================================
echo   ✅ Both servers are running continuously!
echo      - Backend API:  http://127.0.0.1:8008
echo      - Frontend UI:  http://localhost:5173
echo.
echo   To stop the servers, close the opened terminal windows.
echo ==================================================================
echo.
pause

:end
