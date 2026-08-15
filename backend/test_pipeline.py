"""
Standalone API integration test for Stage 6.5.
Run from backend/ directory with the venv activated.
"""
import sys, io, wave, json, base64
import urllib.request

# Force stdout to UTF-8 on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)

sys.path.insert(0, ".")

# ── 1. Health check ────────────────────────────────────────────────────────────
print("=== 1. Health check ===")
req = urllib.request.urlopen("http://127.0.0.1:8000/api/health/", timeout=5)
health = json.loads(req.read())
print("Health:", health)
print()

# ── 2. Generate a real WAV via Piper to use as the STT input ──────────────────
print("=== 2. Generating test input WAV via Piper ===")
from voice.services.tts import generate_speech
input_wav_bytes = generate_speech("Hello Bhavi, how are you today?", "en")
print(f"Input WAV: {len(input_wav_bytes) // 1024} KB")
print()

# ── 3. POST to /api/audio/ ─────────────────────────────────────────────────────
print("=== 3. Posting to /api/audio/ ===")

boundary = "----TestBoundary98765"
crlf = b"\r\n"

body = b""
body += f"--{boundary}\r\n".encode()
body += b'Content-Disposition: form-data; name="audio"; filename="test_input.wav"\r\n'
body += b"Content-Type: audio/wav\r\n"
body += crlf
body += input_wav_bytes
body += crlf
body += f"--{boundary}--\r\n".encode()

req2 = urllib.request.Request(
    "http://127.0.0.1:8000/api/audio/",
    data=body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    method="POST",
)

print("Sending request (STT + LLM + TTS pipeline — may take 10-30s)...")
try:
    with urllib.request.urlopen(req2, timeout=120) as r:
        resp = json.loads(r.read())
except urllib.error.HTTPError as e:
    body_text = e.read().decode("utf-8", errors="replace")
    print(f"HTTP {e.code}: {body_text}")
    sys.exit(1)

print()
print("=== API Response ===")
print(f"  status        : {resp.get('status')}")
print(f"  text (STT)    : {repr(resp.get('text', ''))}")
print(f"  language      : {resp.get('language')}")
print(f"  response (LLM): {repr(resp.get('response', ''))}")
print(f"  audio_format  : {resp.get('audio_format')}")

audio_b64 = resp.get("audio_b64", "")
print(f"  audio_b64 len : {len(audio_b64)} chars")

print()
if audio_b64:
    decoded = base64.b64decode(audio_b64)
    print(f"=== Decoded audio: {len(decoded) // 1024} KB ===")
    with wave.open(io.BytesIO(decoded), "r") as wf:
        dur = wf.getnframes() / wf.getframerate()
        print(f"  WAV duration  : {dur:.2f}s")
        print(f"  Sample rate   : {wf.getframerate()} Hz")
        print(f"  Channels      : {wf.getnchannels()}")
        print(f"  Bit depth     : {wf.getsampwidth() * 8}-bit")
    print()
    print("SUCCESS — Full pipeline test passed cleanly!")
else:
    print("WARNING: No audio_b64 in response — TTS step may have failed.")
