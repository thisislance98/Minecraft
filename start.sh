#!/bin/bash
echo "Stopping any process on port 3000..."
lsof -ti :3000 | xargs kill -9 2>/dev/null
echo "Stopping any process on port 2567..."
lsof -ti :2567 | xargs kill -9 2>/dev/null

if [ "$1" == "--no-server" ]; then
    echo "Starting in CUSTOM CLIENT-ONLY mode..."
    echo "Skipping server startup."
    echo "Starting app (frontend only)..."
    npm run dev
else
    echo "Bumping version..."
    ./bump-version.sh
    echo "Starting app (frontend + Socket.IO server)..."
    npm run dev:all
fi
