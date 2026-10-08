"""
backend/voice/services/elevenlabs_tts.py

Isolated service for ElevenLabs Text-to-Speech (Instant Voice Cloning).
Provides optional personalized voice synthesis for SeniorMind AI / Bhavi.

API Key is read safely from environment (ELEVENLABS_API_KEY) and is NEVER
exposed to frontend code or client responses.

All failures raise exceptions so that the caller (voice/services/tts.py)
can automatically and transparently fall back to local Piper TTS.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Optional, Tuple

ELEVENLABS_BASE_URL = os.environ.get(
    "ELEVENLABS_BASE_URL", "https://api.elevenlabs.io/v1"
)
ELEVENLABS_TIMEOUT = int(os.environ.get("ELEVENLABS_TIMEOUT_SECONDS", "10"))


def synthesize_elevenlabs(
    text: str, voice_id: str, language: Optional[str] = "en"
) -> Tuple[bytes, str]:
    """
    Synthesize speech using ElevenLabs API with the specified voice_id.

    Args:
        text:     The text to synthesize.
        voice_id: The custom ElevenLabs voice ID for the user.
        language: Optional language hint ("en", "hi", "ta", etc.).

    Returns:
        Tuple[bytes, str]: (audio_bytes, "mp3") on success.

    Raises:
        ValueError:   If API key, voice_id, or text is missing.
        RuntimeError: For HTTP errors, network timeouts, or invalid responses.
    """
    if "ELEVENLABS_API_KEY" not in os.environ:
        try:
            from dotenv import load_dotenv
            from pathlib import Path
            env_file = Path(__file__).resolve().parent.parent.parent / ".env"
            if env_file.exists():
                load_dotenv(env_file, override=False)
        except Exception:
            pass

    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip().strip("'\"")
    if not api_key:
        print("[ElevenLabs] API key missing (ELEVENLABS_API_KEY is not set)", flush=True)
        raise ValueError("ELEVENLABS_API_KEY environment variable is not configured")




    if not voice_id or not str(voice_id).strip():
        print("[ElevenLabs] Missing voice_id — cannot proceed", flush=True)
        raise ValueError("Missing ElevenLabs voice_id parameter")

    if not text or not str(text).strip():
        print("[ElevenLabs] Empty text provided — returning empty audio", flush=True)
        return b"", "mp3"

    voice_id = str(voice_id).strip()
    clean_text = str(text).strip()

    endpoint = f"{ELEVENLABS_BASE_URL.rstrip('/')}/text-to-speech/{voice_id}"

    payload = {
        "text": clean_text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    }

    body_bytes = json.dumps(payload).encode("utf-8")
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }

    req = urllib.request.Request(
        endpoint,
        data=body_bytes,
        headers=headers,
        method="POST",
    )

    print(f"[ElevenLabs] Synthesizing speech via voice_id '{voice_id[:6]}...'", flush=True)

    try:
        with urllib.request.urlopen(req, timeout=ELEVENLABS_TIMEOUT) as resp:
            status_code = resp.getcode()
            if status_code != 200:
                raise RuntimeError(f"ElevenLabs API responded with status {status_code}")

            audio_bytes = resp.read()
            if not audio_bytes:
                raise RuntimeError("ElevenLabs API returned zero-byte audio output")

            print(
                f"[ElevenLabs] Success: generated {len(audio_bytes) // 1024} KB MP3 audio",
                flush=True,
            )
            return audio_bytes, "mp3"

    except urllib.error.HTTPError as http_err:
        err_msg = f"HTTP {http_err.code}: {http_err.reason}"
        print(f"[ElevenLabs] API Error: {err_msg}", flush=True)
        raise RuntimeError(f"ElevenLabs HTTP Error: {err_msg}") from http_err

    except urllib.error.URLError as url_err:
        print(f"[ElevenLabs] Network connection error: {url_err.reason}", flush=True)
        raise RuntimeError(f"ElevenLabs Network Error: {url_err.reason}") from url_err

    except Exception as exc:
        print(f"[ElevenLabs] Unexpected synthesis failure: {exc}", flush=True)
        raise RuntimeError(f"ElevenLabs synthesis error: {exc}") from exc
