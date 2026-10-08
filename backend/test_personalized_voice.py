"""
backend/test_personalized_voice.py

Unit test suite for Stage 11 — Personalized Voice (ElevenLabs & Piper Fallback).

Tests:
1. Existing Piper TTS works natively.
2. user_identifier=None -> Piper is used.
3. User has no UserVoicePreference -> Piper is used.
4. User has provider="piper" -> Piper is used.
5. User has provider="elevenlabs" + voice_id -> ElevenLabs is attempted.
6. Successful ElevenLabs response (mocked) -> ElevenLabs audio returned.
7. ElevenLabs API failure (mocked error) -> Piper fallback occurs transparently.
8. Missing ELEVENLABS_API_KEY -> Piper fallback occurs transparently.
9. User isolation: User A's custom voice config is never applied to User B.
10. Existing Stage 7-10 pipelines remain completely unaffected.

Run with:
    .\\venv\\Scripts\\python.exe test_personalized_voice.py
"""

import os
import sys
import io
import unittest
from unittest.mock import patch, MagicMock

# Force UTF-8 on Windows stdout
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)

# Django setup
sys.path.insert(0, ".")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from voice.models import UserVoicePreference
from voice.services.tts import generate_speech
from voice.services.elevenlabs_tts import synthesize_elevenlabs


def _clear_voice_prefs(user_id: str):
    UserVoicePreference.objects.filter(user_identifier=user_id).delete()


def run_tests():
    print("=" * 70)
    print("STAGE 11 — PERSONALIZED VOICE TEST SUITE")
    print("=" * 70)
    print()

    user_a = "test_voice_user_a"
    user_b = "test_voice_user_b"
    _clear_voice_prefs(user_a)
    _clear_voice_prefs(user_b)

    try:
        # ── TEST 1: Existing Piper TTS works ─────────────────────────────────
        print("=== TEST 1: Existing Piper TTS Native Execution ===")
        audio_bytes, fmt = generate_speech("Hello Bhavi", "en")
        assert len(audio_bytes) > 0, "Piper returned empty bytes!"
        assert fmt == "wav", f"Expected 'wav', got '{fmt}'"
        print(f"  Result: {len(audio_bytes)} bytes WAV generated via Piper.")
        print("  SUCCESS — TEST 1 Passed\n")

        # ── TEST 2: user_identifier=None -> Piper used ──────────────────────
        print("=== TEST 2: user_identifier=None -> Piper Fallback ===")
        audio_bytes, fmt = generate_speech("Testing fallback", "en", user_identifier=None)
        assert len(audio_bytes) > 0 and fmt == "wav"
        print("  SUCCESS — TEST 2 Passed\n")

        # ── TEST 3: User has no UserVoicePreference -> Piper used ──────────
        print("=== TEST 3: No UserVoicePreference Record -> Piper Used ===")
        audio_bytes, fmt = generate_speech("Testing fallback", "en", user_identifier=user_a)
        assert len(audio_bytes) > 0 and fmt == "wav"
        print("  SUCCESS — TEST 3 Passed\n")

        # ── TEST 4: User has provider='piper' -> Piper used ─────────────────
        print("=== TEST 4: provider='piper' -> Piper Used ===")
        UserVoicePreference.objects.create(user_identifier=user_a, provider="piper", elevenlabs_voice_id="")
        audio_bytes, fmt = generate_speech("Testing piper pref", "en", user_identifier=user_a)
        assert len(audio_bytes) > 0 and fmt == "wav"
        print("  SUCCESS — TEST 4 Passed\n")

        # ── TEST 5 & 6: provider='elevenlabs' + voice_id (Mocked Success) ────
        print("=== TEST 5 & 6: provider='elevenlabs' (Mocked Success) -> ElevenLabs MP3 ===")
        UserVoicePreference.objects.filter(user_identifier=user_a).update(
            provider="elevenlabs", elevenlabs_voice_id="test_voice_123"
        )
        fake_mp3_bytes = b"ID3_FAKE_ELEVENLABS_AUDIO_BYTES_PAYLOAD"

        with patch("voice.services.elevenlabs_tts.synthesize_elevenlabs") as mock_synth:
            mock_synth.return_value = (fake_mp3_bytes, "mp3")

            audio_bytes, fmt = generate_speech("Testing personalized voice", "en", user_identifier=user_a)

            assert mock_synth.called, "synthesize_elevenlabs was not invoked!"
            mock_synth.assert_called_with(
                text="Testing personalized voice",
                voice_id="test_voice_123",
                language="en"
            )
            assert audio_bytes == fake_mp3_bytes, "Did not receive mocked ElevenLabs audio!"
            assert fmt == "mp3", f"Expected 'mp3', got '{fmt}'"
            print("  Mocked ElevenLabs call succeeded and returned MP3 audio.")
        print("  SUCCESS — TEST 5 & 6 Passed\n")

        # ── TEST 7: ElevenLabs API failure -> Transparent Piper Fallback ────
        print("=== TEST 7: ElevenLabs API Failure -> Piper Fallback ===")
        with patch("voice.services.elevenlabs_tts.synthesize_elevenlabs") as mock_synth_err:
            mock_synth_err.side_effect = RuntimeError("Simulated ElevenLabs API Error 500")

            audio_bytes, fmt = generate_speech("Testing API error fallback", "en", user_identifier=user_a)

            assert mock_synth_err.called
            assert len(audio_bytes) > 0 and fmt == "wav", f"Expected Piper WAV fallback, got fmt={fmt}"
            print("  ElevenLabs error gracefully caught. System transparently fell back to Piper WAV.")
        print("  SUCCESS — TEST 7 Passed\n")

        # ── TEST 8: Missing ELEVENLABS_API_KEY -> Piper Fallback ────────────
        print("=== TEST 8: Missing ELEVENLABS_API_KEY -> Piper Fallback ===")
        with patch.dict(os.environ, {"ELEVENLABS_API_KEY": ""}, clear=False):
            # synthesize_elevenlabs directly raises ValueError when API key is missing
            try:
                synthesize_elevenlabs("test", "voice_123")
                assert False, "Should have raised ValueError for missing API key"
            except ValueError as ve:
                assert "ELEVENLABS_API_KEY" in str(ve)
                print(f"  Service correctly raised ValueError on missing API key: {ve}")

            # Routing layer automatically catches it and falls back to Piper
            audio_bytes, fmt = generate_speech("Testing missing key fallback", "en", user_identifier=user_a)
            assert len(audio_bytes) > 0 and fmt == "wav"
            print("  Routing layer automatically fell back to Piper WAV.")
        print("  SUCCESS — TEST 8 Passed\n")

        # ── TEST 9: User Isolation ───────────────────────────────────────────
        print("=== TEST 9: User Isolation (User A vs User B) ===")
        # User A has ElevenLabs config
        # User B has standard Piper config
        UserVoicePreference.objects.create(user_identifier=user_b, provider="piper", elevenlabs_voice_id="")

        with patch("voice.services.elevenlabs_tts.synthesize_elevenlabs") as mock_synth_iso:
            mock_synth_iso.return_value = (b"USER_A_AUDIO", "mp3")

            # Call for User A -> ElevenLabs
            a_bytes, a_fmt = generate_speech("User A speaking", "en", user_identifier=user_a)
            assert a_fmt == "mp3" and a_bytes == b"USER_A_AUDIO"

            # Call for User B -> Piper (ElevenLabs service NOT invoked for B)
            b_bytes, b_fmt = generate_speech("User B speaking", "en", user_identifier=user_b)
            assert b_fmt == "wav" and len(b_bytes) > 0

            # Verify mock was called for A but NEVER for B
            assert mock_synth_iso.call_count == 1
            print("  User isolation verified: User A used ElevenLabs, User B used Piper.")
        print("  SUCCESS — TEST 9 Passed\n")

        # ── TEST 10: Regression Check ───────────────────────────────────────
        print("=== TEST 10: Existing Memory & Risk Detector Pipelines Intact ===")
        from voice.services.memory_store import create_memory, clear_memories
        from voice.services.risk_detector import analyze_risk

        clear_memories(user_identifier="test_voice_reg")
        mem = create_memory(key="pet_name", value="Tommy", memory_type="lifestyle", user_identifier="test_voice_reg")
        assert mem.id is not None

        risk = analyze_risk("I had lunch.")
        assert risk["risk_level"] == "LOW"

        clear_memories(user_identifier="test_voice_reg")
        print("  Regression check passed: memory and risk detection operational.")
        print("  SUCCESS — TEST 10 Passed\n")

    finally:
        _clear_voice_prefs(user_a)
        _clear_voice_prefs(user_b)

    print("=" * 70)
    print("ALL 10 PERSONALIZED VOICE TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
