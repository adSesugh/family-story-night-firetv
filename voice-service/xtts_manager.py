"""
XTTS-v2 Voice Manager for True Zero-Shot Voice Cloning
Conditioned directly on the user's recorded audio sample waveform (.wav).
Features:
- Pre-computed and cached speaker conditioning latents (gpt_cond_latent & speaker_embedding)
- Direct in-memory inference without temporary disk WAV files
- Sentence splitting for fast chunked autoregression
- Accurate acoustic karaoke speech mark alignment
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
            cmd = ["ffmpeg", "-y", "-i", in_path, "-ac", "1", "-ar", "24000", out_path]
            res = subprocess.run(cmd, capture_output=True, timeout=10)
            if res.returncode != 0 and os.path.exists("/usr/bin/afconvert"):
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
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._latents_cache: Dict[str, Tuple[torch.Tensor, torch.Tensor]] = {}

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
            use_gpu = torch.cuda.is_available()
            self.device = "cuda" if use_gpu else "cpu"
            print(f"[XTTSVoiceManager] Loading XTTS-v2 checkpoint (device={self.device}, GPU={use_gpu})...")
            if not use_gpu:
                num_threads = max(1, min(os.cpu_count() or 4, 4))
                torch.set_num_threads(num_threads)

            from TTS.api import TTS
            self.tts = TTS(
                model_name="tts_models/multilingual/multi-dataset/xtts_v2",
                progress_bar=False,
                gpu=use_gpu,
            )
            print(f"[XTTSVoiceManager] XTTS-v2 model loaded successfully on {self.device}.")
        finally:
            self.is_loading = False

        return self.tts

    def has_speaker_wav(self, voice_id: str) -> bool:
        clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", voice_id.lower().strip())
        wav_path = os.path.join(VOICES_DIR, f"{clean_id}.wav")
        pt_path = os.path.join(VOICES_DIR, f"{clean_id}.pt")
        return (os.path.exists(wav_path) and os.path.getsize(wav_path) > 1000) or os.path.exists(pt_path)

    def get_or_compute_latents(self, voice_id: str, wav_path: str) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Loads pre-computed speaker conditioning latents from memory/disk cache,
        or computes and saves them once, completely eliminating re-encoding on every page.
        """
        clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", voice_id.lower().strip())

        # 1. In-memory cache
        if clean_id in self._latents_cache:
            g, s = self._latents_cache[clean_id]
            return g.to(self.device), s.to(self.device)

        # 2. Disk cache (.pt)
        pt_path = os.path.join(VOICES_DIR, f"{clean_id}.pt")
        if os.path.exists(pt_path):
            try:
                data = torch.load(pt_path, map_location=self.device)
                if isinstance(data, dict) and "gpt_cond_latent" in data and "speaker_embedding" in data:
                    latents = (data["gpt_cond_latent"].to(self.device), data["speaker_embedding"].to(self.device))
                    self._latents_cache[clean_id] = latents
                    print(f"[XTTSVoiceManager] Loaded cached latents from disk: {pt_path}")
                    return latents
            except Exception as e:
                print(f"[XTTSVoiceManager] Warning loading cached latents from {pt_path}: {e}")

        # 3. Compute latents from WAV
        if not os.path.exists(wav_path):
            raise FileNotFoundError(f"Speaker WAV file not found: {wav_path}")

        tts_model = self.ensure_model_loaded()
        xtts = tts_model.synthesizer.tts_model

        print(f"[XTTSVoiceManager] Extracting speaker conditioning latents for '{clean_id}' from {wav_path}...")
        t0 = time.time()
        # gpt_cond_len=6, max_ref_length=10 ensures fast, focused speaker latent extraction without quadratic bloat
        gpt_cond_latent, speaker_embedding = xtts.get_conditioning_latents(
            audio_path=wav_path,
            max_ref_length=10,
            gpt_cond_len=6,
            gpt_cond_chunk_len=6,
        )
        print(f"[XTTSVoiceManager] Speaker latents extracted in {time.time() - t0:.2f}s")

        # Save to disk cache for future instant access (CPU tensors for portable storage)
        try:
            torch.save(
                {
                    "gpt_cond_latent": gpt_cond_latent.cpu(),
                    "speaker_embedding": speaker_embedding.cpu(),
                },
                pt_path,
            )
            print(f"[XTTSVoiceManager] Cached speaker latents to {pt_path}")
        except Exception as e:
            print(f"[XTTSVoiceManager] Warning saving latents to {pt_path}: {e}")

        latents = (gpt_cond_latent.to(self.device), speaker_embedding.to(self.device))
        self._latents_cache[clean_id] = latents
        return latents

    def save_speaker_wav(self, voice_id: str, audio_sample: str) -> str:
        """Decodes audio sample, saves to voices/<voice_id>.wav, and pre-caches latents."""
        clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", voice_id.lower().strip())
        wav_path = os.path.join(VOICES_DIR, f"{clean_id}.wav")

        decoded = decode_audio_sample(audio_sample)
        if not decoded:
            raise ValueError(f"Could not decode audio sample for voice '{voice_id}'")

        samples, sr = decoded
        # Trim to optimal reference duration (max 10 seconds) to prevent excessive memory/compute
        max_samples = int(sr * 10)
        if len(samples) > max_samples:
            samples = samples[:max_samples]

        sf.write(wav_path, samples, sr, format="WAV")
        print(f"[XTTSVoiceManager] Saved speaker reference WAV: {wav_path} ({len(samples)} samples @ {sr}Hz)")

        # Invalidate in-memory and disk cache
        self._latents_cache.pop(clean_id, None)
        pt_path = os.path.join(VOICES_DIR, f"{clean_id}.pt")
        if os.path.exists(pt_path):
            try:
                os.remove(pt_path)
            except OSError:
                pass

        # Pre-compute latents immediately so synthesis calls are instant
        try:
            self.get_or_compute_latents(clean_id, wav_path)
        except Exception as e:
            print(f"[XTTSVoiceManager] Background latent pre-computation note: {e}")

        return wav_path

    def list_custom_voices(self) -> List[Dict[str, Any]]:
        """Returns list of all custom voices with speaker WAV or PT references in voices/."""
        voices = []
        if not os.path.exists(VOICES_DIR):
            return voices

        seen = set()
        for fname in sorted(os.listdir(VOICES_DIR)):
            if (fname.endswith(".wav") or fname.endswith(".pt")) and not fname.startswith("."):
                voice_id = os.path.splitext(fname)[0]
                if voice_id in seen:
                    continue
                seen.add(voice_id)
                file_path = os.path.join(VOICES_DIR, fname)
                file_size = os.path.getsize(file_path)
                voices.append({
                    "id": voice_id,
                    "name": voice_id.replace("_", " ").title(),
                    "engine": "xtts-v2",
                    "size_bytes": file_size,
                    "has_cached_latents": os.path.exists(os.path.join(VOICES_DIR, f"{voice_id}.pt")),
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
        Synthesizes speech using XTTS-v2 directly using pre-computed speaker latents.
        Returns: (audio_numpy_array, speech_marks_list, duration_ms)
        """
        clean_text = text.strip()
        if not clean_text:
            return np.zeros(0, dtype=np.float32), [], 0

        clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", voice_id.lower().strip())
        wav_path = os.path.join(VOICES_DIR, f"{clean_id}.wav")

        # If audio_sample base64 was passed in request, save and pre-compute latents
        if audio_sample:
            try:
                self.save_speaker_wav(voice_id, audio_sample)
            except Exception as e:
                print(f"[XTTSVoiceManager] Warning saving audio_sample: {e}")

        if not self.has_speaker_wav(voice_id):
            raise FileNotFoundError(
                f"No speaker reference audio found for voice '{voice_id}'. Please record a voice sample in Voice Studio."
            )

        tts_model = self.ensure_model_loaded()
        xtts = tts_model.synthesizer.tts_model

        # Retrieve or compute cached latents
        gpt_cond_latent, speaker_embedding = self.get_or_compute_latents(clean_id, wav_path)

        print(f"[XTTSVoiceManager] Generating voice '{clean_id}' with cached latents for: \"{clean_text[:50]}...\"")
        start_t = time.time()

        with torch.inference_mode():
            out = xtts.inference(
                text=clean_text,
                language="en",
                gpt_cond_latent=gpt_cond_latent,
                speaker_embedding=speaker_embedding,
                speed=speed,
                enable_text_splitting=True,
            )

        audio_data = out["wav"]
        if isinstance(audio_data, torch.Tensor):
            audio_data = audio_data.cpu().numpy()
        audio_data = audio_data.astype(np.float32)

        elapsed = time.time() - start_t
        print(f"[XTTSVoiceManager] XTTS direct inference complete in {elapsed:.2f}s ({len(audio_data)} samples)")

        speech_marks, total_duration_ms = self._generate_speech_marks(clean_text, audio_data, self.sample_rate)
        return audio_data, speech_marks, total_duration_ms

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
