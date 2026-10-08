"""
backend/voice/services/tts.py

Multilingual TTS (Text-to-Speech) service for SeniorMind — Bhavi's voice layer.

Supported languages:
- "en" (English) -> en_US-lessac-medium
- "hi" (Hindi)   -> hi_IN-priyamvada-medium
- "ta" (Tamil)   -> ta_IN-rasa_female-medium

Current provider: Piper (local, free, no API key required).
To switch providers in the future, only this file needs to change.
The public interface `generate_speech(text, language)` stays consistent.

Returns raw WAV bytes so the caller (views.py) can encode/deliver them
inline or as URLs.
"""

import io
import os
import sys
import wave
from pathlib import Path
from typing import Dict, Optional, Tuple

# ── Base Directory ─────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/

# ── Configuration & Default Paths ──────────────────────────────────────────────
TTS_PROVIDER = os.environ.get("TTS_PROVIDER", "piper")

_DEFAULT_MODEL_PATHS = {
    "en": str(
        _BACKEND_DIR
        / "models" / "tts"
        / "en" / "en_US" / "lessac" / "medium"
        / "en_US-lessac-medium.onnx"
    ),
    "hi": str(
        _BACKEND_DIR
        / "models" / "tts"
        / "hi" / "hi_IN" / "priyamvada" / "medium"
        / "hi_IN-priyamvada-medium.onnx"
    ),
    "ta": str(
        _BACKEND_DIR
        / "models" / "tts"
        / "ta_IN-rasa_female-medium.onnx"
    ),
}

# Environment variable overrides per language
TTS_MODEL_PATHS = {
    "en": os.environ.get("TTS_MODEL_PATH_EN", os.environ.get("TTS_MODEL_PATH", _DEFAULT_MODEL_PATHS["en"])),
    "hi": os.environ.get("TTS_MODEL_PATH_HI", _DEFAULT_MODEL_PATHS["hi"]),
    "ta": os.environ.get("TTS_MODEL_PATH_TA", _DEFAULT_MODEL_PATHS["ta"]),
}

# Descriptive voice names for logging
VOICE_NAMES = {
    "en": "en_US-lessac-medium",
    "hi": "hi_IN-priyamvada-medium",
    "ta": "ta_IN-rasa_female-medium",
}

# ── Piper Voices Cache (Singleton per language) ────────────────────────────────
_piper_voices: Dict[str, object] = {}


def _normalize_language(language: Optional[str]) -> str:
    """
    Safely normalizes language codes to primary 2-letter ISO code.
    Examples:
        "en"    -> "en"
        "en-US" -> "en"
        "hi_IN" -> "hi"
        "ta-IN" -> "ta"
        "fr"    -> fallback to "en"
        None    -> fallback to "en"
    """
    if not language or not isinstance(language, str):
        print("[TTS] Missing language, falling back to English", flush=True)
        return "en"

    clean_lang = language.strip().lower().replace("_", "-")
    primary_code = clean_lang.split("-")[0]

    if primary_code in TTS_MODEL_PATHS:
        return primary_code

    print(
        f"[TTS] Unsupported language '{language}', falling back to English",
        flush=True,
    )
    return "en"


def _get_piper_voice(lang_code: str):
    """
    Lazily load and cache the PiperVoice instance for the target language.
    Reuses cached instances across requests.
    """
    if lang_code in _piper_voices:
        print(f"[TTS] Reusing cached Piper voice instance for '{lang_code}'", flush=True)
        return _piper_voices[lang_code]

    model_path = TTS_MODEL_PATHS.get(lang_code, TTS_MODEL_PATHS["en"])

    # Resolve relative path if needed
    if not os.path.isabs(model_path):
        model_path = str(_BACKEND_DIR / model_path)

    print(f"[TTS] Loading Piper voice model for '{lang_code}': {model_path}", flush=True)

    if not os.path.isfile(model_path):
        raise FileNotFoundError(
            f"[TTS] Piper model for '{lang_code}' not found at: {model_path}\n"
            "Please verify that the model file exists."
        )

    try:
        from piper.voice import PiperVoice  # type: ignore[import]
        import time
        t0 = time.time()
        voice_instance = PiperVoice.load(model_path)
        elapsed = time.time() - t0
        print(f"[TTS] Piper voice model '{lang_code}' loaded in {elapsed:.2f}s", flush=True)
        _piper_voices[lang_code] = voice_instance
        return voice_instance
    except ImportError as exc:
        raise ImportError(
            "[TTS] piper-tts is not installed. "
            "Run: pip install piper-tts"
        ) from exc


# ── Public Interface ───────────────────────────────────────────────────────────

def generate_speech(
    text: str,
    language: Optional[str] = "en",
    user_identifier: Optional[str] = None,
) -> Tuple[bytes, str]:
    """
    Convert text to speech in the specified language, returning a tuple of (audio_bytes, audio_format).

    Args:
        text:            The text to synthesize. Empty/whitespace strings return (b"", "wav").
        language:        Language code ("en", "hi", "ta", etc.). Defaults to "en".
        user_identifier: Optional user identifier string to check for personalized voice preferences.

    Returns:
        Tuple[bytes, str]: (audio_bytes, "wav") or (audio_bytes, "mp3").

    Raises:
        FileNotFoundError: If the Piper voice model file for the language is missing.
        ImportError:       If piper-tts is not installed.
        RuntimeError:      For synthesis failure or unknown default provider.
    """
    if not text or not text.strip():
        print("[TTS] Empty text received — skipping synthesis", flush=True)
        return b"", "wav"

    # 1. Check for personalized voice preference (OpenVoice or ElevenLabs) if user_identifier is provided
    if user_identifier and str(user_identifier).strip():
        try:
            from voice.models import UserVoicePreference
            pref = UserVoicePreference.objects.filter(user_identifier=user_identifier).first()
            if pref:
                # ── OpenVoice V2 (Local / Free) ─────────────────────────────
                if pref.provider == "openvoice" and pref.openvoice_reference_path.strip():
                    ref_audio = pref.openvoice_reference_path.strip()
                    print(
                        f"[TTS] Personalized OpenVoice V2 configured for [{user_identifier}] "
                        f"(reference: '{os.path.basename(ref_audio)}')",
                        flush=True,
                    )
                    from .openvoice_tts import generate_openvoice_speech
                    try:
                        audio_bytes, audio_fmt = generate_openvoice_speech(
                            text=text.strip(),
                            reference_audio=ref_audio,
                        )
                        if audio_bytes:
                            return audio_bytes, audio_fmt
                    except Exception as ov_err:
                        print(
                            f"[TTS] OpenVoice personalized voice failed (non-fatal): {ov_err}. "
                            "Automatically falling back to local Piper TTS.",
                            flush=True,
                        )

                # ── ElevenLabs (Cloud) ──────────────────────────────────────
                elif pref.provider == "elevenlabs" and pref.elevenlabs_voice_id.strip():
                    print(
                        f"[TTS] Personalized voice configured for [{user_identifier}] "
                        f"(ElevenLabs voice_id: '{pref.elevenlabs_voice_id[:6]}...')",
                        flush=True,
                    )
                    from .elevenlabs_tts import synthesize_elevenlabs
                    try:
                        audio_bytes, audio_fmt = synthesize_elevenlabs(
                            text=text.strip(),
                            voice_id=pref.elevenlabs_voice_id.strip(),
                            language=language,
                        )
                        if audio_bytes:
                            return audio_bytes, audio_fmt
                    except Exception as el_err:
                        print(
                            f"[TTS] ElevenLabs personalized voice failed (non-fatal): {el_err}. "
                            "Automatically falling back to local Piper TTS.",
                            flush=True,
                        )
        except Exception as db_err:
            print(
                f"[TTS] Warning: Failed to check UserVoicePreference ({db_err}). "
                "Proceeding with standard Piper TTS.",
                flush=True,
            )

    # 2. Standard Default Provider: Piper TTS
    provider = TTS_PROVIDER.lower()
    if provider == "piper":
        lang_code = _normalize_language(language)
        voice_name = VOICE_NAMES.get(lang_code, "en_US-lessac-medium")
        print(f"[TTS] Piper synthesis — Language: {lang_code}, Voice: {voice_name}", flush=True)
        wav_bytes = _synthesise_piper(text.strip(), lang_code)
        return wav_bytes, "wav"

    raise RuntimeError(
        f"[TTS] Unknown provider: '{TTS_PROVIDER}'. "
        "Set TTS_PROVIDER=piper (or another supported provider)."
    )



def _synthesise_piper(text: str, lang_code: str) -> bytes:
    """
    Synthesise speech using the local Piper TTS engine for the specified language.
    Returns the result as raw WAV bytes (in-memory, no temp files).
    """
    import time

    print(f"[TTS] Generating speech ({lang_code}) for: {text!r}", flush=True)

    voice = _get_piper_voice(lang_code)

    t0 = time.time()
    try:
        buffer = io.BytesIO()
        with wave.open(buffer, "w") as wav_file:
            voice.synthesize_wav(text, wav_file)

        wav_bytes = buffer.getvalue()
        elapsed = time.time() - t0

        size_kb = len(wav_bytes) / 1024
        print(
            f"[TTS] Audio generated in {elapsed:.2f}s ({size_kb:.1f} KB)",
            flush=True,
        )
        return wav_bytes

    except Exception as exc:
        elapsed = time.time() - t0
        print(
            f"[TTS] Synthesis failed after {elapsed:.2f}s: "
            f"{type(exc).__name__}: {exc}",
            flush=True,
        )
        import traceback
        traceback.print_exc(file=sys.stdout)
        sys.stdout.flush()
        raise RuntimeError(f"Piper TTS synthesis failed for '{lang_code}': {exc}") from exc
