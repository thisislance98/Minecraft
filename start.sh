#!/bin/bash
echo "Stopping any process on port 3000..."
lsof -ti :3000 | xargs kill -9 2>/dev/null
echo "Bumping version..."
./bump-version.sh
echo "Starting app on port 3000..."
npm run dev -- --port 3000
