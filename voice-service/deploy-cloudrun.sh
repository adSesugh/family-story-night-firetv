#!/usr/bin/env bash
# ==============================================================================
# Deploy XTTS-v2 Voice Cloning Microservice to Google Cloud Run
# Supports NVIDIA L4 GPU acceleration (~400ms inference) or CPU fallback
# ==============================================================================
set -e

SERVICE_NAME="family-story-night-voice"
REGION="${GCP_REGION:-us-central1}"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || echo '')}"

# Default mode is GPU (NVIDIA L4). Pass --cpu to deploy without GPU.
DEPLOY_MODE="gpu"
for arg in "$@"; do
  case $arg in
    --cpu)
      DEPLOY_MODE="cpu"
      shift
      ;;
    --gpu)
      DEPLOY_MODE="gpu"
      shift
      ;;
  esac
done

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No GCP Project ID found."
  echo "Please set your project: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "================================================================="
echo " Deploying ${SERVICE_NAME} to Google Cloud Run"
echo " Project: ${PROJECT_ID}"
echo " Region:  ${REGION}"
echo " Mode:    ${DEPLOY_MODE^^}"
echo "================================================================="

if [ "$DEPLOY_MODE" = "gpu" ]; then
  echo "🚀 Deploying with NVIDIA L4 GPU acceleration..."
  gcloud run deploy "${SERVICE_NAME}" \
    --source . \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --platform managed \
    --memory 16Gi \
    --cpu 4 \
    --gpu 1 \
    --gpu-type nvidia-l4 \
    --no-cpu-throttling \
    --concurrency 4 \
    --min-instances 0 \
    --max-instances 3 \
    --timeout 300s \
    --allow-unauthenticated
else
  echo "⚙️ Deploying with CPU mode..."
  gcloud run deploy "${SERVICE_NAME}" \
    --source . \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --platform managed \
    --memory 8Gi \
    --cpu 4 \
    --concurrency 4 \
    --min-instances 0 \
    --max-instances 3 \
    --timeout 300s \
    --allow-unauthenticated
fi

# Retrieve deployed service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --platform managed --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')

echo ""
echo "================================================================="
echo "✅ Deployed successfully to Cloud Run!"
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "To connect Family Story Night to your Cloud Run voice service:"
echo "Update your server/.env file with:"
echo "VOICE_SERVICE_URL=${SERVICE_URL}"
echo "================================================================="
