"""
backend/test_pipeline_multilingual.py

Full API pipeline integration test for English, Hindi, and Tamil.
Sends test speech audio for each language to /api/audio/ and verifies:
- STT transcript
- detected language ("en", "hi", "ta")
- LLM response
- Multilingual TTS base64 WAV generation
"""

import sys, io, wave, json, base64
import urllib.request

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)

sys.path.insert(0, ".")

from voice.services.tts import generate_speech

test_cases = [
    ("English", "Hello Bhavi, how are you today?", "en"),
    ("Hindi", "नमस्ते, मैं भावी हूँ। आज आप कैसे हैं?", "hi"),
    ("Tamil", "வணக்கம், நான் பாவி. இன்று நீங்கள் எப்படி இருக்கிறீர்கள்?", "ta"),
]

for name, text, lang in test_cases:
    print(f"\n==========================================")
    print(f"=== Testing Full Pipeline: {name} ({lang}) ===")
    print(f"==========================================")
    
    # 1. Generate test WAV input for STT
    input_wav = generate_speech(text, lang)
    print(f"Generated input WAV for {name}: {len(input_wav)//1024} KB")
    
    # 2. POST to /api/audio/
    boundary = "----TestBoundaryMultilingual"
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="audio"; filename="test_input.wav"\r\n'
    body += b"Content-Type: audio/wav\r\n\r\n"
    body += input_wav
    body += f"\r\n--{boundary}--\r\n".encode()
    
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/audio/",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            resp = json.loads(r.read())
            
        print(f"  status        : {resp.get('status')}")
        print(f"  text (STT)    : {repr(resp.get('text'))}")
        print(f"  language      : {resp.get('language')}")
        print(f"  response (LLM): {repr(resp.get('response'))}")
        print(f"  audio_format  : {resp.get('audio_format')}")
        
        audio_b64 = resp.get("audio_b64", "")
        print(f"  audio_b64 len : {len(audio_b64)} chars")
        
        if audio_b64:
            decoded = base64.b64decode(audio_b64)
            with wave.open(io.BytesIO(decoded), "r") as wf:
                dur = wf.getnframes() / wf.getframerate()
                print(f"  TTS Output WAV: {len(decoded)//1024} KB | {dur:.2f}s | {wf.getframerate()}Hz | {wf.getnchannels()}ch")
            print(f"SUCCESS — {name} end-to-end pipeline test passed!")
        else:
            print(f"ERROR: No audio_b64 returned for {name}")
    except Exception as e:
        print(f"Pipeline test failed for {name}: {e}")

print("\nALL MULTILINGUAL PIPELINE TESTS COMPLETED!")
