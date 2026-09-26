"""
Kokoro-82M Voice Microservice (FastAPI)
Provides local high-speed neural TTS and voice cloning for Family Story Night.
"""

import io
import base64
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import soundfile as sf
import numpy as np

from voice_manager import KokoroVoiceManager
from xtts_manager import XTTSVoiceManager

app = FastAPI(
    title="Family Story Night - Voice Microservice",
    description="Local high-fidelity text-to-speech with XTTS-v2 zero-shot voice cloning and Kokoro-82M instant engine",
    version="2.0.0",
)

# Enable CORS for local Vite frontend and Node backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Voice Managers
kokoro_manager = KokoroVoiceManager()
xtts_manager = XTTSVoiceManager.get_instance()

class CloneVoiceRequest(BaseModel):
    voice_id: str = Field(..., description="Unique ID for this custom voice (e.g. custom_mom_123)")
    name: str = Field(..., description="Display name for the voice (e.g. Mom's Bedtime Voice)")
    role: str = Field("Family", description="Role: Mom, Dad, Grandma, etc.")
    base_voice: str = Field("af_bella", description="Baseline voice name")
    blend_weights: Optional[Dict[str, float]] = Field(None, description="Optional weights dictionary for multi-voice blending")
    audio_sample: Optional[str] = Field(None, description="Optional base64/data URL of recorded audio clip")

class SynthesizeRequest(BaseModel):
    text: str = Field(..., description="Bedtime story text to read out loud")
    voice_id: str = Field("af_bella", description="Voice ID or custom voice ID")
    base_voice: Optional[str] = Field(None, description="Fallback baseline voice if voice_id is custom")
    speed: float = Field(0.95, description="Speaking speed (0.8 = slow bedtime, 1.0 = normal)")
    audio_sample: Optional[str] = Field(None, description="Optional audio sample for voice cloning/personalization")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "engines": ["Kokoro-82M", "XTTS-v2"],
        "sample_rate": 24000,
        "device": "cpu",
    }

@app.get("/voices")
def list_voices():
    return {"voices": kokoro_manager.list_all_voices()}

@app.post("/clone")
def clone_voice(req: CloneVoiceRequest):
    try:
        metadata = kokoro_manager.clone_or_blend_voice(
            voice_id=req.voice_id,
            name=req.name,
            role=req.role,
            base_voice=req.base_voice,
            blend_weights=req.blend_weights,
            audio_sample_base64=req.audio_sample,
        )
        return {"status": "success", "voice": metadata}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))

@app.post("/synthesize")
def synthesize(req: SynthesizeRequest, request: Request):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    target_voice = req.voice_id or req.base_voice or "af_bella"
    target_lower = target_voice.lower().strip()

    # Determine if this request should be routed to XTTS-v2 (true zero-shot custom voice)
    is_custom = target_lower.startswith("custom") or bool(req.audio_sample) or xtts_manager.has_speaker_wav(target_lower)
    has_wav = xtts_manager.has_speaker_wav(target_lower) or bool(req.audio_sample)

    try:
        if is_custom and has_wav:
            print(f"[synthesize] Routing '{target_voice}' to XTTS-v2 Zero-Shot Voice Cloner (no base voice)...")
            audio_np, speech_marks, duration_ms = xtts_manager.synthesize_custom_voice(
                text=req.text,
                voice_id=target_voice,
                audio_sample=req.audio_sample,
                speed=req.speed,
            )
            sample_rate = xtts_manager.sample_rate
            engine_used = "xtts-v2"
        else:
            print(f"[synthesize] Routing '{target_voice}' to Kokoro-82M instant engine...")
            audio_np, speech_marks, duration_ms = kokoro_manager.synthesize(
                text=req.text,
                voice_name=target_voice,
                base_voice=req.base_voice,
                speed=req.speed,
                audio_sample=req.audio_sample,
            )
            sample_rate = kokoro_manager.sample_rate
            engine_used = "kokoro-82m"

        # Encode audio as 24kHz WAV
        bio = io.BytesIO()
        sf.write(bio, audio_np, sample_rate, format="WAV")
        wav_bytes = bio.getvalue()

        # Check if caller wants raw binary audio stream (Accept: audio/*)
        accept_header = request.headers.get("accept", "")
        if "audio/" in accept_header:
            return Response(
                content=wav_bytes,
                media_type="audio/wav",
                headers={
                    "X-Duration-Ms": str(duration_ms),
                    "X-Voice-Id": target_voice,
                    "X-Engine": engine_used,
                }
            )

        # Otherwise return standard JSON format with base64 audio and karaoke speech marks
        audio_b64 = base64.b64encode(wav_bytes).decode("utf-8")
        return {
            "status": "success",
            "voice_id": target_voice,
            "engine": engine_used,
            "duration_ms": duration_ms,
            "sample_rate": sample_rate,
            "speech_marks": speech_marks,
            "audio_base64": f"data:audio/wav;base64,{audio_b64}",
        }
    except Exception as err:
        print(f"[synthesize] Error with primary engine for '{target_voice}': {err}")
        # If XTTS encountered an issue, fallback smoothly to Kokoro
        if is_custom:
            print(f"[synthesize] Fallback to Kokoro for '{target_voice}'...")
            try:
                audio_np, speech_marks, duration_ms = kokoro_manager.synthesize(
                    text=req.text,
                    voice_name=target_voice,
                    base_voice=req.base_voice,
                    speed=req.speed,
                    audio_sample=req.audio_sample,
                )
                bio = io.BytesIO()
                sf.write(bio, audio_np, kokoro_manager.sample_rate, format="WAV")
                wav_bytes = bio.getvalue()
                audio_b64 = base64.b64encode(wav_bytes).decode("utf-8")
                return {
                    "status": "success",
                    "voice_id": target_voice,
                    "engine": "kokoro-fallback",
                    "duration_ms": duration_ms,
                    "sample_rate": kokoro_manager.sample_rate,
                    "speech_marks": speech_marks,
                    "audio_base64": f"data:audio/wav;base64,{audio_b64}",
                }
            except Exception as kokoro_err:
                raise HTTPException(status_code=500, detail=f"Synthesis error: {str(kokoro_err)}")

        raise HTTPException(status_code=500, detail=f"Synthesis error: {str(err)}")

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8880))
    uvicorn.run(app, host="0.0.0.0", port=port)

