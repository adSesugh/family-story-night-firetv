"""
Kokoro-82M Voice Manager
Manages voice vectors, custom blends, voice cloning, and audio synthesis with speech marks.
"""

import os
import io
import json
import re
import time
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import soundfile as sf
import torch
from kokoro import KPipeline

VOICES_DIR = os.path.join(os.path.dirname(__file__), "voices")
os.makedirs(VOICES_DIR, exist_ok=True)

# Standard stock voices in Kokoro-82M (English)
BUILTIN_VOICES = {
    "af_bella": {"name": "Bella", "gender": "female", "accent": "American", "desc": "Warm & soothing soprano, perfect for bedtime"},
    "af_sarah": {"name": "Sarah", "gender": "female", "accent": "American", "desc": "Gentle, caring storyteller"},
    "af_nicole": {"name": "Nicole", "gender": "female", "accent": "American", "desc": "Whispering & soft cadence"},
    "af_sky": {"name": "Sky", "gender": "female", "accent": "American", "desc": "Bright, sweet, youthful"},
    "am_adam": {"name": "Adam", "gender": "male", "accent": "American", "desc": "Calm, grounded narrator"},
    "am_michael": {"name": "Michael", "gender": "male", "accent": "American", "desc": "Deep, reassuring baritone"},
    "am_echo": {"name": "Echo", "gender": "male", "accent": "American", "desc": "Rich, resonant presence"},
    "bf_emma": {"name": "Emma", "gender": "female", "accent": "British", "desc": "Classic storybook narrator"},
    "bf_isabella": {"name": "Isabella", "gender": "female", "accent": "British", "desc": "Poetic, gentle cadence"},
    "bm_george": {"name": "George", "gender": "male", "accent": "British", "desc": "Warm, grandfatherly storyteller"},
    "bm_lewis": {"name": "Lewis", "gender": "male", "accent": "British", "desc": "Refined, melodic tone"},
}

# Mapping from Family Story Night base voices to optimal Kokoro counterparts
POLLY_TO_KOKORO_MAP = {
    "joanna": "af_bella",
    "matthew": "am_michael",
    "emma": "bf_emma",
    "ivy": "af_sky",
}

class KokoroVoiceManager:
    def __init__(self, lang_code: str = "a"):
        print("[KokoroVoiceManager] Initializing KPipeline (lang_code='a')...")
        self.lang_code = lang_code
        self.pipeline = KPipeline(lang_code=lang_code)
        self.cached_voices: Dict[str, torch.Tensor] = {}
        self.sample_rate = 24000
        print("[KokoroVoiceManager] Kokoro pipeline ready.")

    def get_voice_tensor(self, voice_name: str) -> torch.Tensor:
        """Loads a voice vector from memory, custom directory, or pipeline."""
        voice_key = voice_name.lower().strip()

        # Check memory cache
        if voice_key in self.cached_voices:
            return self.cached_voices[voice_key]

        # Check custom saved voices (.pt file in voices/ directory)
        custom_path = os.path.join(VOICES_DIR, f"{voice_key}.pt")
        if os.path.exists(custom_path):
            print(f"[KokoroVoiceManager] Loading custom voice vector from: {custom_path}")
            tensor = torch.load(custom_path, map_location="cpu")
            self.cached_voices[voice_key] = tensor
            return tensor

        # Map Polly voice names if passed
        resolved = POLLY_TO_KOKORO_MAP.get(voice_key, voice_name)

        # Load from Kokoro repo / cache
        try:
            tensor = self.pipeline.load_voice(resolved)
            self.cached_voices[voice_key] = tensor
            return tensor
        except Exception as e:
            print(f"[KokoroVoiceManager] Could not load voice '{voice_name}', falling back to 'af_bella': {e}")
            fallback = self.pipeline.load_voice("af_bella")
            self.cached_voices[voice_key] = fallback
            return fallback

    def list_all_voices(self) -> List[Dict[str, Any]]:
        """Returns list of all built-in and custom cloned voices."""
        voices = []

        # 1. Built-in stock voices
        for vid, info in BUILTIN_VOICES.items():
            voices.append({
                "id": vid,
                "name": info["name"],
                "gender": info["gender"],
                "accent": info["accent"],
                "description": info["desc"],
                "is_custom": False,
            })

        # 2. Custom saved cloned voices
        for file_name in os.listdir(VOICES_DIR):
            if file_name.endswith(".json"):
                meta_path = os.path.join(VOICES_DIR, file_name)
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        voices.append(meta)
                except Exception as err:
                    print(f"[KokoroVoiceManager] Error reading voice metadata {file_name}: {err}")

        return voices

    def clone_or_blend_voice(
        self,
        voice_id: str,
        name: str,
        role: str = "Family",
        base_voice: str = "af_bella",
        blend_weights: Optional[Dict[str, float]] = None,
        audio_sample_base64: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Creates and persists a new custom Kokoro voice vector.
        Supports linear blend weighting across base voices (e.g. 70% Mom + 30% Sarah).
        """
        clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", voice_id.lower().strip())
        resolved_base = POLLY_TO_KOKORO_MAP.get(base_voice.lower(), base_voice)

        # Compute voice vector
        if blend_weights and isinstance(blend_weights, dict) and len(blend_weights) > 0:
            total_weight = sum(blend_weights.values()) or 1.0
            blended_tensor = None
            for v_name, weight in blend_weights.items():
                norm_weight = weight / total_weight
                v_tensor = self.get_voice_tensor(v_name)
                if blended_tensor is None:
                    blended_tensor = norm_weight * v_tensor
                else:
                    blended_tensor = blended_tensor + (norm_weight * v_tensor)
            final_tensor = blended_tensor
        else:
            # Default to baseline voice vector
            final_tensor = self.get_voice_tensor(resolved_base).clone()

        # Save voice vector (.pt)
        pt_path = os.path.join(VOICES_DIR, f"{clean_id}.pt")
        torch.save(final_tensor, pt_path)
        self.cached_voices[clean_id] = final_tensor

        # Save metadata (.json)
        metadata = {
            "id": clean_id,
            "name": name or f"{role}'s Voice",
            "role": role,
            "base_voice": resolved_base,
            "is_custom": True,
            "has_audio_sample": bool(audio_sample_base64),
            "created_at": time.time(),
        }
        json_path = os.path.join(VOICES_DIR, f"{clean_id}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        print(f"[KokoroVoiceManager] Successfully created & saved voice clone: {clean_id} ({name})")
        return metadata

    def synthesize(
        self,
        text: str,
        voice_name: str = "af_bella",
        speed: float = 0.95
    ) -> Tuple[np.ndarray, List[Dict[str, Any]], int]:
        """
        Synthesizes text into 24kHz audio and generates karaoke-compatible speech marks.
        Returns: (audio_numpy_array, speech_marks_list, duration_ms)
        """
        clean_text = text.strip()
        if not clean_text:
            return np.zeros(0, dtype=np.float32), [], 0

        voice_tensor = self.get_voice_tensor(voice_name)

        # Generate audio chunks
        generator = self.pipeline(clean_text, voice=voice_tensor, speed=speed)

        all_audio_chunks = []
        speech_marks = []
        current_time_ms = 0
        current_char_offset = 0

        for chunk_idx, (graphemes, phonemes, audio_chunk) in enumerate(generator):
            if audio_chunk is None or len(audio_chunk) == 0:
                continue

            chunk_np = audio_chunk.numpy() if isinstance(audio_chunk, torch.Tensor) else np.array(audio_chunk)
            all_audio_chunks.append(chunk_np)

            chunk_duration_ms = int((len(chunk_np) / self.sample_rate) * 1000)

            # Match words in chunk graphemes to build speech marks
            chunk_str = str(graphemes) if graphemes else ""
            words = list(re.finditer(r"\b\w+(?:['’]\w+)?\b", chunk_str))

            if words:
                word_duration_ms = chunk_duration_ms / len(words)
                for w_idx, match in enumerate(words):
                    word_val = match.group(0)
                    word_time = current_time_ms + int(w_idx * word_duration_ms)

                    # Find position of word in original text
                    char_pos = clean_text.find(word_val, current_char_offset)
                    if char_pos != -1:
                        char_start = char_pos
                        char_end = char_pos + len(word_val)
                        current_char_offset = char_end
                    else:
                        char_start = current_char_offset
                        char_end = current_char_offset + len(word_val)

                    speech_marks.append({
                        "time": word_time,
                        "type": "word",
                        "start": char_start,
                        "end": char_end,
                        "value": word_val,
                    })

            current_time_ms += chunk_duration_ms

        if not all_audio_chunks:
            return np.zeros(0, dtype=np.float32), [], 0

        full_audio = np.concatenate(all_audio_chunks)
        total_duration_ms = int((len(full_audio) / self.sample_rate) * 1000)

        return full_audio, speech_marks, total_duration_ms
