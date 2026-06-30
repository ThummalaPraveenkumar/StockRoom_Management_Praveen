#!/bin/bash
set -e

echo "=== StockRoom — Hotel Raw Material Management ==="
echo ""

# Install if needed
if [ ! -d "backend/node_modules" ]; then
  echo "[setup] Installing backend dependencies..."
  cd backend && npm install && cd ..
fi
if [ ! -d "frontend/node_modules" ]; then
  echo "[setup] Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

echo "[start] Starting backend on http://localhost:3001"
cd backend && npm run dev &
BACKEND_PID=$!

sleep 3

echo "[start] Starting frontend on http://localhost:5173"
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================="
echo "  StockRoom is running!"
echo "========================================="
echo ""
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3001"
echo ""
echo "  Surfaces:"
echo "    Store App (Kavitha): http://localhost:5173/store"
echo "    Chef View (Ramesh):  http://localhost:5173/chef"
echo "    Manager (Arjun):     http://localhost:5173/manager"
echo "    Purchase (Meena):    http://localhost:5173/purchase"
echo ""
echo "  Press Ctrl+C to stop."
echo "========================================="

wait $BACKEND_PID $FRONTEND_PID
