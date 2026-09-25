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

app = FastAPI(
    title="Family Story Night - Kokoro-82M Voice Microservice",
    description="Local high-fidelity text-to-speech with custom voice cloning and word-level speech marks",
    version="1.0.0",
)

# Enable CORS for local Vite frontend and Node backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Voice Manager
manager = KokoroVoiceManager()

class CloneVoiceRequest(BaseModel):
    voice_id: str = Field(..., description="Unique ID for this custom voice (e.g. custom_mom_123)")
    name: str = Field(..., description="Display name for the voice (e.g. Mom's Bedtime Voice)")
    role: str = Field("Family", description="Role: Mom, Dad, Grandma, etc.")
    base_voice: str = Field("af_bella", description="Baseline Kokoro/Polly voice name")
    blend_weights: Optional[Dict[str, float]] = Field(None, description="Optional weights dictionary for multi-voice blending")
    audio_sample: Optional[str] = Field(None, description="Optional base64/data URL of recorded audio clip")

class SynthesizeRequest(BaseModel):
    text: str = Field(..., description="Bedtime story text to read out loud")
    voice_id: str = Field("af_bella", description="Voice ID or custom voice ID")
    base_voice: Optional[str] = Field(None, description="Fallback baseline voice if voice_id is custom")
    speed: float = Field(0.95, description="Speaking speed (0.8 = slow bedtime, 1.0 = normal)")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "Kokoro-82M",
        "sample_rate": manager.sample_rate,
        "device": "cpu",
    }

@app.get("/voices")
def list_voices():
    return {"voices": manager.list_all_voices()}

@app.post("/clone")
def clone_voice(req: CloneVoiceRequest):
    try:
        metadata = manager.clone_or_blend_voice(
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

    try:
        audio_np, speech_marks, duration_ms = manager.synthesize(
            text=req.text,
            voice_name=target_voice,
            base_voice=req.base_voice,
            speed=req.speed,
        )

        # Encode audio as 24kHz WAV
        bio = io.BytesIO()
        sf.write(bio, audio_np, manager.sample_rate, format="WAV")
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
                }
            )

        # Otherwise return standard JSON format with base64 audio and karaoke speech marks
        audio_b64 = base64.b64encode(wav_bytes).decode("utf-8")
        return {
            "status": "success",
            "voice_id": target_voice,
            "duration_ms": duration_ms,
            "sample_rate": manager.sample_rate,
            "speech_marks": speech_marks,
            "audio_base64": f"data:audio/wav;base64,{audio_b64}",
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Synthesis error: {str(err)}")

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8880))
    uvicorn.run(app, host="0.0.0.0", port=port)
