#!/bin/bash

# Auto-increment version script for Minecraft Clone
# This script increments the build number (last number in v1.0.XX)

FILE="index.html"

# Extract current version from the file (macOS compatible)
CURRENT_VERSION=$(grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' "$FILE" | head -1)

if [ -z "$CURRENT_VERSION" ]; then
    echo "Could not find version in $FILE"
    exit 1
fi

# Parse version parts
MAJOR=$(echo "$CURRENT_VERSION" | cut -d'.' -f1 | tr -d 'v')
MINOR=$(echo "$CURRENT_VERSION" | cut -d'.' -f2)
BUILD=$(echo "$CURRENT_VERSION" | cut -d'.' -f3)

# Increment build number
NEW_BUILD=$((BUILD + 1))
NEW_VERSION="v${MAJOR}.${MINOR}.${NEW_BUILD}"

# Replace version in file (macOS compatible sed)
sed -i '' "s/$CURRENT_VERSION/$NEW_VERSION/g" "$FILE"

echo "Version bumped: $CURRENT_VERSION -> $NEW_VERSION"
