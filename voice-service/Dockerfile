# ==============================================================================
# Kokoro-82M Voice Microservice - Production Dockerfile for Google Cloud Run
# ==============================================================================

FROM python:3.12-slim-bookworm

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    HF_HOME=/root/.cache/huggingface

# Install system dependencies required for Kokoro TTS, phonemizer, and audio export
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download Kokoro-82M model weights and core bedtime stock voices
# Baking these into the Docker layer ensures near-instant Cloud Run cold starts (<2s)
RUN python -c "\
from kokoro import KPipeline; \
p = KPipeline(lang_code='a'); \
voices = ['af_bella', 'af_sarah', 'af_nicole', 'af_sky', 'am_adam', 'am_michael', 'am_echo', 'bf_emma', 'bf_isabella', 'bm_george', 'bm_lewis']; \
for v in voices: \
    try: \
        p.load_voice(v); \
    except Exception as e: \
        print(f'Cache voice {v}: {e}'); \
print('Kokoro weights pre-cached successfully.')"

# Copy source code and default voice vectors
COPY . .

# Ensure voices directory exists and is writable
RUN mkdir -p /app/voices

# Expose default Cloud Run port
EXPOSE 8080

# Cloud Run Container Health Check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Start Uvicorn bound to Cloud Run's dynamic $PORT
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1
