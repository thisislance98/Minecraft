#!/bin/bash
echo "Check & Stop processes on port 3000..."
PIDS_3000=$(lsof -ti :3000)
if [ -n "$PIDS_3000" ]; then
    echo "Killing processes on 3000: $PIDS_3000"
    kill -9 $PIDS_3000
else
    echo "No process found on port 3000."
fi

echo "Check & Stop processes on port 2567..."
PIDS_2567=$(lsof -ti :2567)
if [ -n "$PIDS_2567" ]; then
    echo "Killing processes on 2567: $PIDS_2567"
    kill -9 $PIDS_2567
else
    echo "No process found on port 2567."
fi

sleep 1

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
