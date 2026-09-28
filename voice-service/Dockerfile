# ==============================================================================
# XTTS-v2 Voice Cloning Microservice - Production Dockerfile for Google Cloud Run
# ==============================================================================

FROM python:3.10-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    COQUI_TOS_AGREED=1

# Install system dependencies required for audio synthesis & conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies with PyTorch CUDA 12.1 support
# (Automatically runs on NVIDIA L4 GPU when attached, or falls back to CPU cleanly)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch==2.2.2 torchaudio==2.2.2 --index-url https://download.pytorch.org/whl/cu121 && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download XTTS-v2 model weights into the image layer for instant Cloud Run boots (<3s)
RUN python -c "\
from huggingface_hub import snapshot_download; \
import os; \
target = os.path.expanduser('~/.local/share/tts/tts_models--multilingual--multi-dataset--xtts_v2'); \
os.makedirs(target, exist_ok=True); \
print(f'Pre-caching XTTS-v2 checkpoint to {target}...'); \
snapshot_download(repo_id='coqui/XTTS-v2', local_dir=target, local_dir_use_symlinks=False); \
print('XTTS-v2 model cached successfully.')"

# Copy source code and custom voice references
COPY . .

# Ensure voices directory exists and is writable
RUN mkdir -p /app/voices

# Expose default Cloud Run port
EXPOSE 8080

# Cloud Run Container Health Check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Start Uvicorn bound to Cloud Run dynamic $PORT
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1
