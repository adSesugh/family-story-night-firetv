import os
import sys

# Test Kokoro first
from voice_manager import KokoroVoiceManager
kokoro = KokoroVoiceManager()
print("1. Testing Kokoro stock voice synthesis...")
k_audio, k_marks, k_dur = kokoro.synthesize("Hello little star, time for bed.", voice_name="af_bella")
print(f"Kokoro success: {len(k_audio)} samples, {len(k_marks)} marks, duration: {k_dur}ms")
assert len(k_audio) > 0
assert len(k_marks) > 0
print("First Kokoro mark:", k_marks[0])

print("\n2. Testing XTTS-v2 custom voice synthesis...")
from xtts_manager import XTTSVoiceManager
xtts = XTTSVoiceManager.get_instance()
print("XTTS has speaker WAV:", xtts.has_speaker_wav("custom_joanna_1790377697825_ys3kj"))

# Test XTTS synthesis with short test bedtime phrase
x_audio, x_marks, x_dur = xtts.synthesize_custom_voice(
    text="Goodnight little lion, dream sweet dreams tonight.",
    voice_id="custom_joanna_1790377697825_ys3kj"
)
print(f"XTTS success: {len(x_audio)} samples, {len(x_marks)} marks, duration: {x_dur}ms")
assert len(x_audio) > 0
assert len(x_marks) > 0
print("First XTTS mark:", x_marks[0])

print("\nALL VOICE TESTS PASSED!")
