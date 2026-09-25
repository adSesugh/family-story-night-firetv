#!/usr/bin/env bash
# ==============================================================================
# Deploy Kokoro-82M Voice Microservice to Google Cloud Run
# ==============================================================================
set -e

# Configuration (customize these if desired)
SERVICE_NAME="family-story-night-voice"
REGION="${GCP_REGION:-us-central1}"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo '')}"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No GCP Project ID found."
  echo "Please set GCP_PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "================================================================="
echo " Deploying ${SERVICE_NAME} to Google Cloud Run"
echo " Project: ${PROJECT_ID}"
echo " Region:  ${REGION}"
echo "================================================================="

# Deploy directly from source via Cloud Build & Cloud Run
gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 10 \
  --min-instances 0 \
  --max-instances 5 \
  --timeout 120s \
  --allow-unauthenticated

# Retrieve deployed service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --platform managed --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')

echo ""
echo "✅ Deployed successfully!"
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Next step: Add this URL to your server/.env file:"
echo "KOKORO_VOICE_SERVICE_URL=${SERVICE_URL}"
