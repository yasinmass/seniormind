"""
backend/voice/services/elevenlabs_voice.py

Voice Cloning service for SeniorMind AI / Bhavi — Stage 11 Phase 3.

Handles:
  - Uploading a voice sample to ElevenLabs Instant Voice Cloning API
  - Returns a stable voice_id string on success
  - NEVER exposes the ELEVENLABS_API_KEY to frontend code

Security rules enforced here:
  - API key is read from environment at call time (not module level)
  - Raw audio bytes are not logged
  - Caller is responsible for not persisting audio permanently

All failures raise exceptions; the view layer catches them and returns
clean error responses — ElevenLabs failures are always NON-FATAL to the
main Bhavi voice pipeline.
"""

import json
import os
import uuid
from typing import Tuple

# ─── Constants ────────────────────────────────────────────────────────────────
ELEVENLABS_BASE_URL = os.environ.get(
    "ELEVENLABS_BASE_URL", "https://api.elevenlabs.io/v1"
)
ELEVENLABS_VOICE_CLONE_TIMEOUT = int(
    os.environ.get("ELEVENLABS_CLONE_TIMEOUT_SECONDS", "30")
)

# Maximum audio size we'll forward to ElevenLabs (25 MB)
MAX_AUDIO_BYTES = 25 * 1024 * 1024


def clone_voice(
    audio_bytes: bytes,
    audio_filename: str = "sample.webm",
    name: str = "",
    description: str = "Bhavi personalized voice",
) -> str:
    """
    Upload a voice sample to ElevenLabs and create a cloned voice.

    Args:
        audio_bytes:    Raw audio bytes (WebM/WAV/MP4 — anything ElevenLabs accepts).
        audio_filename: Original filename (used for MIME type inference).
        name:           Display name for the cloned voice on ElevenLabs dashboard.
        description:    Short description stored on the ElevenLabs side.

    Returns:
        str: The stable ElevenLabs voice_id for the newly created voice clone.

    Raises:
        ValueError:   If the API key is missing, audio is empty, or audio exceeds limit.
        RuntimeError: For HTTP errors, network failures, or unexpected API responses.
    """
    import urllib.error
    import urllib.request

    # ── Validation ─────────────────────────────────────────────────────────────
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
        raise ValueError(
            "ELEVENLABS_API_KEY environment variable is not configured. "
            "Add it to your .env file before using personalized voice cloning."
        )




    if not audio_bytes:
        raise ValueError("No audio data provided for voice cloning.")

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise ValueError(
            f"Audio sample is too large ({len(audio_bytes) // (1024 * 1024)} MB). "
            f"Maximum allowed is {MAX_AUDIO_BYTES // (1024 * 1024)} MB."
        )

    # ── Build multipart/form-data request manually ─────────────────────────────
    # urllib doesn't have built-in multipart support, so we build it by hand.
    boundary = f"BhaviBoundary{uuid.uuid4().hex}"

    # Determine MIME type from filename extension
    ext = audio_filename.rsplit(".", 1)[-1].lower() if "." in audio_filename else "webm"
    mime_type_map = {
        "webm": "audio/webm",
        "wav":  "audio/wav",
        "mp3":  "audio/mpeg",
        "mp4":  "audio/mp4",
        "m4a":  "audio/mp4",
        "ogg":  "audio/ogg",
        "flac": "audio/flac",
    }
    mime_type = mime_type_map.get(ext, "audio/webm")

    # Voice name: sanitize, default to something unique
    safe_name = str(name).strip()[:80] if name and str(name).strip() else f"Bhavi-Clone-{uuid.uuid4().hex[:8]}"

    body_parts = []

    # Part 1: name
    body_parts.append(
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="name"\r\n\r\n'
        f"{safe_name}\r\n"
    )

    # Part 2: description
    body_parts.append(
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="description"\r\n\r\n'
        f"{description}\r\n"
    )

    # Part 3: files (the audio sample)
    file_header = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="files"; filename="{audio_filename}"\r\n'
        f"Content-Type: {mime_type}\r\n\r\n"
    )

    # Assemble body
    preamble = "".join(body_parts).encode("utf-8")
    file_header_bytes = file_header.encode("utf-8")
    epilogue = f"\r\n--{boundary}--\r\n".encode("utf-8")

    body = preamble + file_header_bytes + audio_bytes + epilogue

    endpoint = f"{ELEVENLABS_BASE_URL.rstrip('/')}/voices/add"

    headers = {
        "xi-api-key": api_key,
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "application/json",
    }

    req = urllib.request.Request(
        endpoint,
        data=body,
        headers=headers,
        method="POST",
    )

    print(
        f"[ElevenLabsVoice] Uploading voice sample ({len(audio_bytes) // 1024} KB) "
        f"for cloning as '{safe_name}'",
        flush=True,
    )

    # ── HTTP call ──────────────────────────────────────────────────────────────
    try:
        with urllib.request.urlopen(req, timeout=ELEVENLABS_VOICE_CLONE_TIMEOUT) as resp:
            status_code = resp.getcode()
            raw_body = resp.read()

            if status_code not in (200, 201):
                raise RuntimeError(
                    f"ElevenLabs Voice Clone API responded with status {status_code}"
                )

            try:
                data = json.loads(raw_body.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError) as parse_err:
                raise RuntimeError(
                    f"Could not parse ElevenLabs response: {parse_err}"
                ) from parse_err

            voice_id = data.get("voice_id", "").strip()
            if not voice_id:
                raise RuntimeError(
                    "ElevenLabs returned a response without a voice_id. "
                    f"Response keys: {list(data.keys())}"
                )

            print(
                f"[ElevenLabsVoice] Voice clone created successfully. "
                f"voice_id='{voice_id[:6]}...'",
                flush=True,
            )
            return voice_id

    except urllib.error.HTTPError as http_err:
        # Try to read the error body for a more helpful message
        try:
            err_body = http_err.read().decode("utf-8", errors="replace")
            err_detail = json.loads(err_body).get("detail", err_body)
        except Exception:
            err_detail = http_err.reason

        print(
            f"[ElevenLabsVoice] API Error HTTP {http_err.code}: {err_detail}",
            flush=True,
        )
        raise RuntimeError(
            f"ElevenLabs Voice Clone HTTP {http_err.code}: {err_detail}"
        ) from http_err

    except urllib.error.URLError as url_err:
        print(f"[ElevenLabsVoice] Network error: {url_err.reason}", flush=True)
        raise RuntimeError(
            f"ElevenLabs Voice Clone network error: {url_err.reason}"
        ) from url_err

    except RuntimeError:
        raise  # re-raise already-formatted RuntimeErrors

    except Exception as exc:
        print(f"[ElevenLabsVoice] Unexpected error: {exc}", flush=True)
        raise RuntimeError(f"ElevenLabs Voice Clone unexpected error: {exc}") from exc
