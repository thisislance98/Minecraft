#!/bin/bash

# Deployment Script for Minecraft Clone
# Usage: ./deploy.sh

set -e # Exit on error

PROJECT_ID="trackit-8b903"
REGION="us-central1"
SERVICE_NAME="minecraft-server"
IMAGE_TAG="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "========================================"
echo "Deploying to Project: $PROJECT_ID"
echo "========================================"

# 1. Build Frontend
echo "[1/3] Building Frontend..."
npm run build

# 2. Build and Deploy Backend
echo "[2/3] Building Backend Image..."
# Always load environment variables from server/.env
if [ -f server/.env ]; then
    echo "Loading environment variables from server/.env..."
    set -a  # automatically export all variables
    source server/.env
    set +a
elif [ -f .env ]; then
    echo "Loading environment variables from .env..."
    set -a
    source .env
    set +a
fi

# Verify key environment variables
echo "Checking environment variables..."
[ -n "$OPENROUTER_API_KEY" ] && echo "  OPENROUTER_API_KEY: set" || echo "  OPENROUTER_API_KEY: NOT SET"
[ -n "$OPENROUTER_MODEL" ] && echo "  OPENROUTER_MODEL: $OPENROUTER_MODEL" || echo "  OPENROUTER_MODEL: NOT SET"
[ -n "$AI_PROVIDER" ] && echo "  AI_PROVIDER: $AI_PROVIDER" || echo "  AI_PROVIDER: NOT SET"

# Create temporary cloudbuild.yaml
cat > cloudbuild.yaml <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: [ 'build', '-t', '$IMAGE_TAG', '-f', 'server/Dockerfile', '.' ]
images:
  - '$IMAGE_TAG'
EOF

# Submit build to Cloud Build (context is root)
gcloud builds submit --config cloudbuild.yaml . --project $PROJECT_ID
rm cloudbuild.yaml

echo "[2/3] Deploying to Cloud Run..."
# Deploy with environment variables
# Note: This simply passes the current shell's environment variables.
# For production, consider using Secret Manager.
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_TAG \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --project $PROJECT_ID \
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY,OPENROUTER_API_KEY=$OPENROUTER_API_KEY,OPENROUTER_MODEL=$OPENROUTER_MODEL,AI_PROVIDER=$AI_PROVIDER,OPENROUTER_VILLAGER_MODEL=$OPENROUTER_VILLAGER_MODEL,STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET"

# 3. Deploy Hosting
echo "[3/3] Deploying to Firebase Hosting..."
firebase deploy --only hosting --project $PROJECT_ID

echo "========================================"
echo "Deployment Complete!"
echo "App URL: https://$PROJECT_ID.web.app"
echo "========================================"
