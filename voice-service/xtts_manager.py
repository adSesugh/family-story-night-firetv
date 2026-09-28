"""
XTTS-v2 Voice Manager for True Zero-Shot Voice Cloning
Conditioned directly on the user's recorded audio sample waveform (.wav).
No base voice scaffolding (no Joanna / Matthew / Bella fallback).
"""

import os
import io
import re
import time
import base64
import tempfile
import subprocess
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import soundfile as sf
import torch

# Agree to Coqui public model license non-interactively
os.environ["COQUI_TOS_AGREED"] = "1"

VOICES_DIR = os.path.join(os.path.dirname(__file__), "voices")
os.makedirs(VOICES_DIR, exist_ok=True)


def decode_audio_sample(audio_sample_base64: str) -> Optional[Tuple[np.ndarray, int]]:
    """
    Decodes a base64 audio sample (data URI or raw base64).
    Supports WAV, OGG, FLAC directly via soundfile,
    with ffmpeg or macOS afconvert fallback for WebM/MP4/CAF containers.
    Returns: (mono_float32_samples, sample_rate) or None.
    """
    if not audio_sample_base64:
        return None

    clean_b64 = re.sub(r"^data:audio/[^;]+;base64,", "", audio_sample_base64.strip())
    try:
        raw_bytes = base64.b64decode(clean_b64)
    except Exception as e:
        print(f"[XTTSVoiceManager] Base64 decode error: {e}")
        return None

    if len(raw_bytes) < 100:
        return None

    # 1. Try reading directly with soundfile (works for WAV, FLAC, OGG)
    try:
        data, sr = sf.read(io.BytesIO(raw_bytes))
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        return data.astype(np.float32), int(sr)
    except Exception:
        pass

    # 2. Fallback using ffmpeg or macOS afconvert for WebM, MP4, AAC, or CAF
    try:
        with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as in_file:
            in_file.write(raw_bytes)
            in_path = in_file.name

        out_path = in_path + ".wav"
        try:
            # Try ffmpeg first (standard in Linux/Docker/Cloud Run and brew)
            cmd = ["ffmpeg", "-y", "-i", in_path, "-ac", "1", "-ar", "24000", out_path]
            res = subprocess.run(cmd, capture_output=True, timeout=10)
            if res.returncode != 0 and os.path.exists("/usr/bin/afconvert"):
                # Fallback to macOS native afconvert
                subprocess.run(
                    ["/usr/bin/afconvert", "-f", "WAVE", "-d", "LEI16", in_path, out_path],
                    capture_output=True,
                    timeout=5,
                )

            if os.path.exists(out_path) and os.path.getsize(out_path) > 100:
                data, sr = sf.read(out_path)
                if data.ndim > 1:
                    data = np.mean(data, axis=1)
                return data.astype(np.float32), int(sr)
        finally:
            if os.path.exists(in_path):
                os.remove(in_path)
            if os.path.exists(out_path):
                os.remove(out_path)
    except Exception as conv_err:
        print(f"[XTTSVoiceManager] Audio decoding fallback error: {conv_err}")

    return None


class XTTSVoiceManager:
    _instance = None

    def __init__(self):
        self.tts = None
        self.sample_rate = 24000
        self.is_loading = False

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def ensure_model_loaded(self):
        """Loads XTTS-v2 model checkpoint lazily on first voice request."""
        if self.tts is not None:
            return self.tts

        if self.is_loading:
            while self.is_loading:
                time.sleep(0.5)
            return self.tts

        self.is_loading = True
        try:
            print("[XTTSVoiceManager] Loading XTTS-v2 checkpoint (tts_models/multilingual/multi-dataset/xtts_v2)...")
            num_threads = max(1, min(os.cpu_count() or 4, 4))
            torch.set_num_threads(num_threads)

            from TTS.api import TTS
            self.tts = TTS(
                model_name="tts_models/multilingual/multi-dataset/xtts_v2",
                progress_bar=False,
                gpu=False
            )
            print("[XTTSVoiceManager] XTTS-v2 model loaded successfully.")
        finally:
            self.is_loading = False

        return self.tts

    def has_speaker_wav(self, voice_id: str) -> bool:
        clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", voice_id.lower().strip())
        wav_path = os.path.join(VOICES_DIR, f"{clean_id}.wav")
        return os.path.exists(wav_path) and os.path.getsize(wav_path) > 1000

    def save_speaker_wav(self, voice_id: str, audio_sample: str) -> str:
        """Decodes a base64 audio sample and saves it to voices/<voice_id>.wav."""
        clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", voice_id.lower().strip())
        wav_path = os.path.join(VOICES_DIR, f"{clean_id}.wav")

        decoded = decode_audio_sample(audio_sample)
        if not decoded:
            raise ValueError(f"Could not decode audio sample for voice '{voice_id}'")

        samples, sr = decoded
        sf.write(wav_path, samples, sr, format="WAV")
        print(f"[XTTSVoiceManager] Saved speaker reference WAV: {wav_path} ({len(samples)} samples @ {sr}Hz)")
        return wav_path

    def list_custom_voices(self) -> List[Dict[str, Any]]:
        """Returns list of all custom voices with speaker WAV references in voices/."""
        voices = []
        if not os.path.exists(VOICES_DIR):
            return voices

        for fname in sorted(os.listdir(VOICES_DIR)):
            if fname.endswith(".wav") and not fname.startswith("."):
                voice_id = fname[:-4]
                file_path = os.path.join(VOICES_DIR, fname)
                file_size = os.path.getsize(file_path)
                if file_size > 1000:
                    voices.append({
                        "id": voice_id,
                        "name": voice_id.replace("_", " ").title(),
                        "engine": "xtts-v2",
                        "size_bytes": file_size,
                    })
        return voices

    def synthesize_custom_voice(
        self,
        text: str,
        voice_id: str,
        audio_sample: Optional[str] = None,
        speed: float = 1.0,
    ) -> Tuple[np.ndarray, List[Dict[str, Any]], int]:
        """
        Synthesizes speech using XTTS-v2 directly conditioned on the speaker's recorded WAV.
        Returns: (audio_numpy_array, speech_marks_list, duration_ms)
        """
        clean_text = text.strip()
        if not clean_text:
            return np.zeros(0, dtype=np.float32), [], 0

        clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", voice_id.lower().strip())
        wav_path = os.path.join(VOICES_DIR, f"{clean_id}.wav")

        # If audio_sample base64 was passed in request, decode & update the reference WAV
        if audio_sample:
            try:
                self.save_speaker_wav(voice_id, audio_sample)
            except Exception as e:
                print(f"[XTTSVoiceManager] Warning saving audio_sample: {e}")

        if not os.path.exists(wav_path) or os.path.getsize(wav_path) < 1000:
            raise FileNotFoundError(
                f"No speaker reference audio found for voice '{voice_id}' at {wav_path}. Please record a voice sample in Voice Studio."
            )

        tts_model = self.ensure_model_loaded()

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out_wav_tmp:
            out_wav_path = out_wav_tmp.name

        try:
            print(f"[XTTSVoiceManager] Generating voice '{clean_id}' for: \"{clean_text[:50]}...\"")
            start_t = time.time()
            tts_model.tts_to_file(
                text=clean_text,
                speaker_wav=wav_path,
                language="en",
                file_path=out_wav_path,
                speed=speed,
            )
            elapsed = time.time() - start_t
            print(f"[XTTSVoiceManager] XTTS synthesis complete in {elapsed:.2f}s")

            audio_data, sr = sf.read(out_wav_path)
            if audio_data.ndim > 1:
                audio_data = np.mean(audio_data, axis=1)
            audio_data = audio_data.astype(np.float32)

            speech_marks, total_duration_ms = self._generate_speech_marks(clean_text, audio_data, sr)
            return audio_data, speech_marks, total_duration_ms
        finally:
            if os.path.exists(out_wav_path):
                os.remove(out_wav_path)

    def _generate_speech_marks(
        self,
        text: str,
        audio_data: np.ndarray,
        sample_rate: int,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Calculates syllable/duration weighted speech marks with acoustic energy envelope detection.
        Aligns words directly to the synthesized waveform for karaoke tracking.
        """
        total_duration_ms = int((len(audio_data) / sample_rate) * 1000)
        speech_marks = []

        words = list(re.finditer(r"\b\w+(?:['’]\w+)?\b", text))
        if not words or total_duration_ms <= 0:
            return speech_marks, total_duration_ms

        # Energy envelope detection to detect leading and trailing silence
        abs_wave = np.abs(audio_data)
        voiced = np.where(abs_wave > 0.012)[0]
        if len(voiced) > 0:
            start_offset_ms = int((voiced[0] / sample_rate) * 1000)
            end_offset_ms = int((voiced[-1] / sample_rate) * 1000)
            active_duration_ms = max(end_offset_ms - start_offset_ms, 200)
        else:
            start_offset_ms = 0
            active_duration_ms = total_duration_ms

        def word_weight(w: str) -> float:
            vowels = len(re.findall(r"[aeiouyAEIOUY]", w))
            return max(vowels * 1.5, len(w) * 0.8, 1.0)

        weights = [word_weight(m.group(0)) for m in words]
        total_weight = sum(weights) or 1.0

        current_char_offset = 0
        elapsed_weight = 0.0

        for idx, match in enumerate(words):
            word_str = match.group(0)
            w = weights[idx]
            word_time = start_offset_ms + int((elapsed_weight / total_weight) * active_duration_ms)
            elapsed_weight += w

            char_pos = text.find(word_str, current_char_offset)
            if char_pos != -1:
                char_start = char_pos
                char_end = char_pos + len(word_str)
                current_char_offset = char_end
            else:
                char_start = current_char_offset
                char_end = current_char_offset + len(word_str)

            speech_marks.append({
                "time": word_time,
                "type": "word",
                "start": char_start,
                "end": char_end,
                "value": word_str,
            })

        return speech_marks, total_duration_ms
