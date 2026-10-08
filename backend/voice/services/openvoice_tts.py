"""
backend/voice/services/openvoice_tts.py

Isolated client service for OpenVoice V2 local HTTP microservice.
Provides free, local personalized voice cloning for SeniorMind / Bhavi.

Calls the local OpenVoice server running at OPENVOICE_SERVER_URL (default: http://127.0.0.1:8001).
All exceptions are caught and raised cleanly so caller (voice/services/tts.py) can
transparently fall back to local Piper TTS without crashing Django.
"""

import json
import os
import urllib.error
import urllib.request
from typing import Optional, Tuple

OPENVOICE_SERVER_URL = os.environ.get(
    "OPENVOICE_SERVER_URL", "http://127.0.0.1:8001"
).rstrip("/")

OPENVOICE_TIMEOUT = int(os.environ.get("OPENVOICE_TIMEOUT_SECONDS", "15"))


def check_openvoice_health() -> bool:
    """
    Checks if the local OpenVoice V2 microservice is running and healthy.
    Returns True if healthy, False otherwise.
    """
    endpoint = f"{OPENVOICE_SERVER_URL}/health"
    try:
        req = urllib.request.Request(endpoint, method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("status") == "ok"
    except Exception as err:
        print(f"[OpenVoice] Health check failed: {err}", flush=True)
    return False


def generate_openvoice_speech(
    text: str,
    reference_audio: str,
    speed: float = 1.0,
) -> Tuple[bytes, str]:
    """
    Synthesize speech using the local OpenVoice V2 microservice.

    Args:
        text:            The text for Bhavi to speak.
        reference_audio: Absolute path to the reference voice sample on the server.
        speed:           Speech rate (default: 1.0).

    Returns:
        Tuple[bytes, str]: (audio_bytes, "wav") on success.

    Raises:
        ValueError:   If reference_audio or text is missing / invalid.
        RuntimeError: For HTTP errors, network timeouts, or invalid responses.
    """
    if not text or not str(text).strip():
        print("[OpenVoice] Empty text received — returning empty audio", flush=True)
        return b"", "wav"

    if not reference_audio or not str(reference_audio).strip():
        raise ValueError("Missing reference_audio path parameter for OpenVoice synthesis")

    clean_ref = str(reference_audio).strip()
    clean_text = str(text).strip()

    endpoint = f"{OPENVOICE_SERVER_URL}/synthesize"

    payload = {
        "text": clean_text,
        "reference_audio": clean_ref,
        "speed": speed,
    }

    body_bytes = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Accept": "audio/wav",
    }

    req = urllib.request.Request(
        endpoint,
        data=body_bytes,
        headers=headers,
        method="POST",
    )

    print(
        f"[OpenVoice] Calling local microservice for text ({len(clean_text)} chars)...",
        flush=True,
    )

    try:
        with urllib.request.urlopen(req, timeout=OPENVOICE_TIMEOUT) as resp:
            if resp.status == 200:
                audio_bytes = resp.read()
                latency_header = resp.headers.get("X-Latency-Total", "unknown")
                print(
                    f"[OpenVoice] Received {len(audio_bytes) // 1024} KB WAV audio "
                    f"(server latency: {latency_header}s)",
                    flush=True,
                )
                return audio_bytes, "wav"
            else:
                raise RuntimeError(
                    f"OpenVoice server returned unexpected HTTP status {resp.status}"
                )

    except urllib.error.HTTPError as http_err:
        err_msg = http_err.read().decode("utf-8", errors="replace")
        print(
            f"[OpenVoice] HTTP {http_err.code} from local server: {err_msg[:200]}",
            flush=True,
        )
        raise RuntimeError(
            f"OpenVoice HTTP {http_err.code}: {err_msg[:200]}"
        ) from http_err

    except urllib.error.URLError as url_err:
        print(f"[OpenVoice] Connection error: {url_err.reason}", flush=True)
        raise RuntimeError(
            f"OpenVoice local service connection error: {url_err.reason}"
        ) from url_err

    except Exception as exc:
        print(f"[OpenVoice] Unexpected error: {exc}", flush=True)
        raise RuntimeError(f"OpenVoice synthesis failed: {exc}") from exc
