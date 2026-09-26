"""
XTTS-v2 Voice Manager for True Zero-Shot Voice Cloning
Conditioned directly on the user's recorded audio sample waveform (.wav).
Completely eliminates base voice scaffolding (no Joanna / Matthew / Bella fallback).
"""

import os
import io
import re
import time
import base64
import tempfile
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import soundfile as sf
import torch

# Agree to Coqui public model license non-interactively
os.environ["COQUI_TOS_AGREED"] = "1"

VOICES_DIR = os.path.join(os.path.dirname(__file__), "voices")
os.makedirs(VOICES_DIR, exist_ok=True)

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
        """Loads XTTS-v2 model checkpoint lazily on first custom voice request."""
        if self.tts is not None:
            return self.tts

        if self.is_loading:
            while self.is_loading:
                time.sleep(0.5)
            return self.tts

        self.is_loading = True
        try:
            print("[XTTSVoiceManager] Loading XTTS-v2 checkpoint (tts_models/multilingual/multi-dataset/xtts_v2)...")
            # Limit PyTorch CPU threads to physical cores to avoid thread contention on Intel mac
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
                from voice_manager import decode_audio_sample
                decoded = decode_audio_sample(audio_sample)
                if decoded:
                    samples, sr = decoded
                    sf.write(wav_path, samples, sr, format="WAV")
                    print(f"[XTTSVoiceManager] Updated speaker reference WAV: {wav_path} ({len(samples)} samples @ {sr}Hz)")
            except Exception as e:
                print(f"[XTTSVoiceManager] Warning decoding audio_sample: {e}")

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
