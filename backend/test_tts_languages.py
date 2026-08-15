"""
backend/test_tts_languages.py

Unit/service test for Stage 6.5 multilingual TTS service.
Tests English, Hindi, Tamil, missing language, and unsupported language.
"""

import sys
import io
import wave
import os

# Force stdout to UTF-8 on Windows to prevent cp1252 UnicodeEncodeError
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)

sys.path.insert(0, ".")

from voice.services.tts import generate_speech

def test_language(name, text, lang_code, expected_min_duration=0.5):
    print(f"=== Testing {name} (code: {repr(lang_code)}) ===")
    print(f"Text: {text}")
    wav_bytes = generate_speech(text, lang_code)
    
    assert len(wav_bytes) > 0, f"Error: Got empty bytes for {name}"
    
    with wave.open(io.BytesIO(wav_bytes), "r") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        duration = frames / float(rate)

    print(f"Result: {len(wav_bytes)} bytes | {duration:.2f}s | {rate}Hz | {channels}ch | {sampwidth*8}-bit WAV")
    assert duration >= expected_min_duration, f"Duration too short for {name}"
    print(f"SUCCESS — {name} passed\n")

if __name__ == "__main__":
    print("Starting Multilingual TTS Service Tests...\n")
    
    # 1. English
    test_language("English", "Hello, I am Bhavi.", "en")
    
    # 2. Hindi
    test_language("Hindi", "नमस्ते, मैं भावी हूँ।", "hi")
    
    # 3. Tamil
    test_language("Tamil", "வணக்கம், நான் பாவி.", "ta")
    
    # 4. Missing language (None) -> English fallback
    test_language("Missing Language (None)", "Hello, I am Bhavi.", None)
    
    # 5. Unsupported language ("fr") -> English fallback
    test_language("Unsupported Language ('fr')", "Hello, I am Bhavi.", "fr")
    
    print("ALL 5 TTS SERVICE TESTS PASSED SUCCESSFULLY!")
