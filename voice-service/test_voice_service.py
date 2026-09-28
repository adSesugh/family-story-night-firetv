"""
Test XTTS-v2 Zero-Shot Voice Cloning Microservice
"""

import os
import sys
from xtts_manager import XTTSVoiceManager

print("Testing XTTS-v2 Zero-Shot Voice Manager...")
xtts = XTTSVoiceManager.get_instance()

custom_voice_id = "custom_joanna_1790377697825_ys3kj"
has_wav = xtts.has_speaker_wav(custom_voice_id)
print(f"XTTS has speaker WAV for '{custom_voice_id}': {has_wav}")

# Verify voices list
voices = xtts.list_custom_voices()
print(f"Found {len(voices)} registered custom voices.")

print("\nTesting XTTS-v2 synthesis...")
audio, marks, duration_ms = xtts.synthesize_custom_voice(
    text="Goodnight little lion, dream sweet dreams tonight.",
    voice_id=custom_voice_id,
)

print(f"XTTS-v2 Success! Audio samples: {len(audio)}, Marks: {len(marks)}, Duration: {duration_ms}ms")
assert len(audio) > 0, "Audio should not be empty"
assert len(marks) > 0, "Speech marks should be generated"
assert duration_ms > 0, "Duration should be positive"
print("First karaoke speech mark:", marks[0])
print("\nALL XTTS-v2 TESTS PASSED!")
