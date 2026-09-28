# XTTS-v2 Voice Cloning Microservice

Production-grade, neural zero-shot voice cloning and text-to-speech (TTS) microservice for **Family Story Night**, powered by [Coqui XTTS-v2](https://huggingface.co/coqui/XTTS-v2).

---

## Architecture & Performance Overview

| Environment | Hardware | Latency per Page (~15s audio) | Real-Time Factor (RTF) |
|---|---|---|---|
| **Local (MacBook)** | Intel i7 CPU (4-core) | ~17s (down from 85s with latent caching) | ~1.1x |
| **Cloud Run (GPU)** | NVIDIA L4 GPU (24GB VRAM) | **~400ms – 800ms** | **~0.03x (Instant)** |

### Optimization Highlights
1. **Speaker Latent Caching (`.pt`)**: When a voice is cloned from a 10s audio sample, conditioning latents (`gpt_cond_latent` and `speaker_embedding`) are extracted once (~0.6s) and cached in memory and on disk. Subsequent story pages bypass disk I/O and spectrogram re-computation completely.
2. **Container Model Pre-caching**: The Docker image bakes model weights directly into `/root/.local/share/tts/` so Cloud Run cold boots in <3 seconds without fetching weights over the internet.
3. **Seamless CPU/GPU Dual Support**: The code auto-detects `torch.cuda.is_available()` to seamlessly switch between local CPU and Cloud Run NVIDIA GPUs.

---

## Directory Structure

```
voice-service/
├── Dockerfile              # Production Dockerfile with CUDA 12.1 and pre-cached XTTS weights
├── cloudbuild.yaml         # Automated Cloud Build & Cloud Run pipeline
├── deploy-cloudrun.sh      # Turnkey Cloud Run deployment script (GPU and CPU modes)
├── requirements.txt        # Pinned dependencies (TTS, PyTorch, FastAPI, SoundFile)
├── app.py                  # FastAPI service (port 8880)
├── xtts_manager.py         # Latent caching, audio decoding, and karaoke speech marks
└── voices/                 # Persisted custom voice WAV samples and cached .pt latents
```

---

## Local Development

From the project root or `voice-service` directory:
```bash
cd voice-service
.venv_xtts/bin/python app.py
```
The service will start on **`http://localhost:8880`**.

---

## Deploying to Google Cloud Run

### Prerequisites
1. Ensure the `gcloud` CLI is installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
2. Enable Cloud Run and Cloud Build APIs:
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com
   ```

### 1. One-Command GPU Deployment (Recommended)
Cloud Run offers NVIDIA L4 GPUs in `us-central1` with 0 min-instances (scales to 0 when not in use):
```bash
cd voice-service
./deploy-cloudrun.sh
```
*(Alternatively, for CPU-only deployment: `./deploy-cloudrun.sh --cpu`)*

### 2. Connect Your App
Once deployed, copy the service URL output by the script and paste it into `server/.env`:
```env
VOICE_SERVICE_URL=https://family-story-night-voice-xxxxxx.a.run.app
```
Restart your Node server (`npm run dev`) and voice generation across the entire app will run via your ultra-fast Cloud Run GPU service!
