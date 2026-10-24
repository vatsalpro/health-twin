#!/usr/bin/env bash

# ==============================================================================
# 🌸 PregTwin Platform: Continuous Backend & Frontend Runner
# Automatically starts FastAPI Backend (8008) and Vite Frontend (5173).
# Runs continuously until stopped with Ctrl+C.
# ==============================================================================

# Determine repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================================================="
echo "🌸 PregTwin: Maternal Digital Twin Platform"
echo "   Starting Backend (FastAPI) and Frontend (Vite) continuously..."
echo "=================================================================="
echo ""

# Cleanup trap to gracefully terminate both servers on exit/interrupt
cleanup() {
    echo ""
    echo "Shutting down PregTwin servers..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Start FastAPI Backend in background
echo "🚀 [1/2] Starting FastAPI Backend on http://127.0.0.1:8008..."
cd "$SCRIPT_DIR/backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8008 --reload &
BACKEND_PID=$!

# 2. Start Vite Frontend in background
echo "⚡ [2/2] Starting Vite Frontend on http://localhost:5173..."
cd "$SCRIPT_DIR/frontend"
npx vite --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "=================================================================="
echo "✅ Both servers are running continuously!"
echo "   - Backend API:  http://127.0.0.1:8008"
echo "   - Frontend UI:  http://localhost:5173"
echo "   - API Docs:     http://127.0.0.1:8008/docs"
echo ""
echo "   Press Ctrl+C at any time to stop both servers."
echo "=================================================================="
echo ""

# Keep running continuously, streaming logs to terminal
wait
