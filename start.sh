#!/bin/bash
echo "Stopping any process on port 3000..."
lsof -ti :3000 | xargs kill -9 2>/dev/null
echo "Bumping version..."
./bump-version.sh
echo "Stopping any process on port 2567..."
lsof -ti :2567 | xargs kill -9 2>/dev/null
echo "Starting app (frontend + Colyseus server)..."
npm run dev:all
