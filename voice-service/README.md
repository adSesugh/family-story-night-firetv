# Kokoro-82M Voice Microservice

High-speed, offline neural text-to-speech (TTS) and voice cloning microservice for **Family Story Night**, powered by [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M).

---

## Features
- **Ultra-Compact & Fast**: Runs locally on CPU/Metal with 82 million parameters.
- **Voice Cloning & Blending**: Supports custom voice vectors (`.pt`) and multi-voice weighting (e.g., Mom's voice, Dad's bedtime register).
- **Karaoke Word Timing**: Generates exact millisecond word-level speech marks for real-time glowing text highlighting.
- **FastAPI REST API**: Ready for integration with Node.js and client applications.

---

## Directory Structure
```
voice-service/
├── .venv/            # Dedicated Python 3.12 virtual environment
├── requirements.txt  # Pinned dependencies (Kokoro 0.9.4, PyTorch, FastAPI, SoundFile)
├── app.py            # FastAPI service (port 8880)
├── voice_manager.py  # Kokoro pipeline, voice vector blending, and speech-marks alignment
└── voices/           # Persisted custom voice vector files (.pt, .json)
```

---

## How to Run

From the root of the project:
```bash
cd voice-service
.venv/bin/python app.py
```
The service will start on **`http://localhost:8880`**.

---

## API Endpoints

### 1. Health Check
```bash
curl http://localhost:8880/health
```
```json
{
  "status": "ok",
  "engine": "Kokoro-82M",
  "sample_rate": 24000,
  "device": "cpu"
}
```

### 2. Synthesize Speech with Speech Marks (Karaoke)
```bash
curl -X POST http://localhost:8880/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The stars are glowing softly in the quiet night sky.",
    "voice_id": "af_bella",
    "speed": 0.95
  }'
```
Response:
```json
{
  "status": "success",
  "voice_id": "af_bella",
  "duration_ms": 3200,
  "sample_rate": 24000,
  "speech_marks": [
    { "time": 0, "type": "word", "start": 0, "end": 3, "value": "The" },
    { "time": 250, "type": "word", "start": 4, "end": 9, "value": "stars" }
  ],
  "audio_base64": "data:audio/wav;base64,..."
}
```

### 3. Create a Voice Clone or Blend
```bash
curl -X POST http://localhost:8880/clone \
  -H "Content-Type: application/json" \
  -d '{
    "voice_id": "custom_mom_1",
    "name": "Mom'\''s Bedtime Voice",
    "role": "Mom",
    "base_voice": "af_bella",
    "blend_weights": {
      "af_bella": 0.7,
      "af_sarah": 0.3
    }
  }'
```

---

## Family Story Night Integration
In `server/.env`, set:
```env
KOKORO_VOICE_SERVICE_URL=http://localhost:8880
```
When configured, custom family voice clones and Kokoro voices are synthesized through this service, and cached in the SQLite database (`server/data/family_story_night.db`) for instant replay.

---

## ☁️ Google Cloud Run Deployment

The service includes a production-ready, containerized configuration optimized specifically for Google Cloud Run:
- **Instant Cold Starts (<2s)**: Model weights (`Kokoro-82M`) and core bedtime voice vectors are pre-cached in the Docker build layer.
- **Dynamic Port Binding**: Automatically binds to `${PORT}` (default `8080` on Cloud Run, `8880` locally).
- **Minimal Footprint**: Operates comfortably on **2 vCPU** and **2 GiB RAM** with CPU inference.

### Option A: One-Command Deployment (Cloud Shell or Local CLI)

From `voice-service/`:
```bash
./deploy-cloudrun.sh
```
Or directly via `gcloud`:
```bash
gcloud run deploy family-story-night-voice \
  --source . \
  --region us-central1 \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 10 \
  --min-instances 0 \
  --max-instances 5 \
  --allow-unauthenticated
```

### Option B: Deploy via Google Cloud Console (Web UI)
1. Go to **Google Cloud Console > Cloud Run > Create Service**.
2. Select **Continuously deploy from a repository** (or upload from source).
3. Set the build type to use the included `Dockerfile` inside `voice-service/`.
4. Under **Container > Variables & Secrets**:
   - Container port: `8080`
   - Memory: `2 GiB` (minimum 1 GiB)
   - CPU: `2`
5. Click **Create**.

### Connecting to Family Story Night
Once deployed, copy your Cloud Run HTTPS URL (e.g. `https://family-story-night-voice-xyz.a.run.app`) and update your backend `.env`:
```env
KOKORO_VOICE_SERVICE_URL=https://family-story-night-voice-xyz.a.run.app
```
