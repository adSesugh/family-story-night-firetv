"""
XTTS-v2 Voice Microservice (FastAPI)
Provides true zero-shot voice cloning for Family Story Night conditioned directly on speaker WAV waveforms.
"""

import io
import os
import base64
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import soundfile as sf
import numpy as np

from xtts_manager import XTTSVoiceManager

app = FastAPI(
    title="Family Story Night - Voice Microservice",
    description="Zero-shot voice cloning powered by Coqui XTTS-v2",
    version="3.0.0",
)

# Enable CORS for local Vite frontend and Node backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize XTTS Voice Manager
xtts_manager = XTTSVoiceManager.get_instance()


class CloneVoiceRequest(BaseModel):
    voice_id: str = Field(..., description="Unique ID for this custom voice (e.g. custom_mom_123)")
    name: str = Field(..., description="Display name for the voice (e.g. Mom's Bedtime Voice)")
    role: str = Field("Family", description="Role: Mom, Dad, Grandma, etc.")
    audio_sample: Optional[str] = Field(None, description="Base64/data URL of recorded audio clip")
    base_voice: Optional[str] = Field(None, description="Ignored; kept for backward compatibility")
    blend_weights: Optional[Dict[str, float]] = Field(None, description="Ignored; kept for backward compatibility")


class SynthesizeRequest(BaseModel):
    text: str = Field(..., description="Bedtime story text to read out loud")
    voice_id: str = Field(..., description="Custom voice ID (e.g. custom_dad_123)")
    base_voice: Optional[str] = Field(None, description="Ignored; kept for backward compatibility")
    speed: float = Field(0.95, description="Speaking speed (0.8 = slow bedtime, 1.0 = normal)")
    audio_sample: Optional[str] = Field(None, description="Optional audio sample data URL if not yet saved on disk")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "XTTS-v2",
        "sample_rate": xtts_manager.sample_rate,
        "device": "cpu",
    }


@app.get("/voices")
def list_voices():
    return {"voices": xtts_manager.list_custom_voices()}


@app.post("/clone")
def clone_voice(req: CloneVoiceRequest):
    try:
        saved_path = None
        if req.audio_sample:
            saved_path = xtts_manager.save_speaker_wav(req.voice_id, req.audio_sample)

        return {
            "status": "success",
            "voice": {
                "id": req.voice_id,
                "name": req.name,
                "role": req.role,
                "engine": "xtts-v2",
                "has_sample": bool(saved_path or xtts_manager.has_speaker_wav(req.voice_id)),
            },
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@app.post("/synthesize")
def synthesize(req: SynthesizeRequest, request: Request):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    target_voice = req.voice_id.strip()

    try:
        print(f"[synthesize] Synthesizing '{target_voice}' with XTTS-v2 zero-shot cloner...")
        audio_np, speech_marks, duration_ms = xtts_manager.synthesize_custom_voice(
            text=req.text,
            voice_id=target_voice,
            audio_sample=req.audio_sample,
            speed=req.speed,
        )
        sample_rate = xtts_manager.sample_rate

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
                    "X-Engine": "xtts-v2",
                },
            )

        # Otherwise return standard JSON format with base64 audio and karaoke speech marks
        audio_b64 = base64.b64encode(wav_bytes).decode("utf-8")
        return {
            "status": "success",
            "voice_id": target_voice,
            "engine": "xtts-v2",
            "duration_ms": duration_ms,
            "sample_rate": sample_rate,
            "speech_marks": speech_marks,
            "audio_base64": f"data:audio/wav;base64,{audio_b64}",
        }
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as err:
        print(f"[synthesize] Synthesis error for '{target_voice}': {err}")
        raise HTTPException(status_code=500, detail=f"Synthesis error: {str(err)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8880))
    uvicorn.run(app, host="0.0.0.0", port=port)
