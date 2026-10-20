@echo off
echo Starting PregTwin Backend (FastAPI on http://127.0.0.1:8008)...
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8008 --reload
pause
