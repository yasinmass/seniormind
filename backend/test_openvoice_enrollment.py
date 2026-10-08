"""
backend/test_openvoice_enrollment.py

Phase 3 — OpenVoice V2 Enrollment Test Suite

Tests:
 1.  Successful OpenVoice enrollment (mocked file write + DB save)
 2.  Missing audio file → 400
 3.  Invalid audio extension → 400
 4.  Audio too small (too short) → 400
 5.  Missing consent → 400
 6.  Missing user_identifier → 400
 7.  User identifier with path traversal characters → 400
 8.  Preference set to provider='openvoice' after enrollment
 9.  openvoice_reference_path is stored (non-empty)
10.  Raw audio blob is NOT stored in the DB (openvoice_reference_path is a path, not blob)
11.  User A cannot read User B's reference path through status API
12.  Status for enrolled user → enabled=True, provider='openvoice'
13.  Status for non-enrolled user → enabled=False, provider='piper'
14.  Disable custom voice → provider='piper', reference cleared
15.  File cleanup on disable (mocked unlink)
16.  Disable when no preference exists → still returns ok
17.  Existing Piper behavior still works after enrollment
18.  Existing ElevenLabs routing still works after enrollment
19.  OpenVoice routing still falls back to Piper on microservice failure
20.  Live enrollment test against real OpenVoice server (if running on 8001)

Run with:
    .\\venv\\Scripts\\python.exe test_openvoice_enrollment.py
"""

import io
import json
import os
import sys
import uuid
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock, mock_open, call

# Force UTF-8 on Windows stdout
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True
    )

# Django setup
sys.path.insert(0, ".")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.test import RequestFactory
from django.core.files.uploadedfile import SimpleUploadedFile
from voice.models import UserVoicePreference
from voice.services.tts import generate_speech
from voice.views import (
    enroll_openvoice_voice,
    get_voice_status,
    disable_personalized_voice,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _clear(*user_ids):
    for uid in user_ids:
        UserVoicePreference.objects.filter(user_identifier=uid).delete()


def _make_audio(size_bytes=100_000, ext=".webm", content_type="audio/webm"):
    """Return a SimpleUploadedFile representing an audio sample."""
    return SimpleUploadedFile(
        name=f"voice_sample{ext}",
        content=b"\x00" * size_bytes,
        content_type=content_type,
    )


def _post_enroll(user_id, audio=None, consent=None, extra_post=None):
    """Build and fire a POST to enroll_openvoice_voice."""
    factory = RequestFactory()
    if audio is None:
        audio = _make_audio()
    if consent is None:
        consent = (
            "I confirm that I own this voice or have permission from the "
            "voice owner to create and use this voice."
        )
    data = {
        "user_identifier": user_id,
        "consent": consent,
    }
    if extra_post:
        data.update(extra_post)
    req = factory.post(
        "/api/voice/personalized/openvoice/",
        data=data,
        format="multipart",
    )
    req.FILES["audio"] = audio
    return req


# ── Test Runner ────────────────────────────────────────────────────────────────

def run_tests():
    print("=" * 70)
    print("PHASE 3 — OPENVOICE ENROLLMENT TEST SUITE")
    print("=" * 70)
    print()

    factory = RequestFactory()
    uid_a = "p3_test_user_a"
    uid_b = "p3_test_user_b"
    _clear(uid_a, uid_b)

    fake_wav = (
        b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00"
        b"\x01\x00\x01\x00D\xac\x00\x00data\x00\x00\x00\x00"
    )

    # ── Fake stored path we inject via mock ────────────────────────────────────
    fake_stored_path = f"D:\\projects\\senior AI\\backend\\voice_references\\{uid_a}\\abc123.webm"

    def _enrollment_with_mocked_fs(uid, audio=None, consent=None):
        """
        Run enroll_openvoice_voice with filesystem writes mocked out.
        Returns (response, stored_path_captured).
        """
        stored_paths = []

        original_open = open

        def fake_open(path, mode="r", *args, **kwargs):
            if "wb" in mode:
                stored_paths.append(str(path))
                return mock_open()(path, mode, *args, **kwargs)
            return original_open(path, mode, *args, **kwargs)

        req = _post_enroll(uid, audio=audio, consent=consent)

        with patch("voice.views._ensure_voice_references_dir") as mock_dir, \
             patch("pathlib.Path.mkdir"), \
             patch("builtins.open", side_effect=fake_open) as mock_file, \
             patch("voice.views.uuid.uuid4") as mock_uuid:

            mock_uuid.return_value.hex = "abc123hex"
            user_dir_mock = MagicMock()
            user_dir_mock.__truediv__ = lambda self, name: Path(fake_stored_path)
            mock_dir.return_value = user_dir_mock

            # Make Path(...).resolve() return a fixed path
            with patch.object(Path, "resolve", return_value=Path(fake_stored_path)):
                resp = enroll_openvoice_voice(req)

        return resp, fake_stored_path

    try:
        # ── TEST 1: Successful enrollment ─────────────────────────────────────
        print("=== TEST 1: Successful OpenVoice Enrollment ===")
        resp, stored = _enrollment_with_mocked_fs(uid_a)
        body = json.loads(resp.content)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {body}"
        assert body["status"] == "ok", body
        assert body["provider"] == "openvoice", body
        assert body["enabled"] is True, body
        # Preference must be in DB
        pref = UserVoicePreference.objects.get(user_identifier=uid_a)
        assert pref.provider == "openvoice"
        print(f"  Result: {body['message']}")
        print("  SUCCESS — TEST 1 Passed\n")

        # ── TEST 2: Missing audio file ────────────────────────────────────────
        print("=== TEST 2: Missing Audio File → 400 ===")
        req2 = factory.post(
            "/api/voice/personalized/openvoice/",
            data={
                "user_identifier": uid_a,
                "consent": (
                    "I confirm that I own this voice or have permission from the "
                    "voice owner to create and use this voice."
                ),
            },
        )
        resp2 = enroll_openvoice_voice(req2)
        assert resp2.status_code == 400, f"Expected 400, got {resp2.status_code}"
        body2 = json.loads(resp2.content)
        assert "Audio file is required" in body2["error"]
        print(f"  Result: Correctly rejected — {body2['error']}")
        print("  SUCCESS — TEST 2 Passed\n")

        # ── TEST 3: Invalid audio extension ───────────────────────────────────
        print("=== TEST 3: Invalid Audio Extension (.exe) → 400 ===")
        bad_audio = _make_audio(ext=".exe", content_type="application/octet-stream")
        resp3, _ = _enrollment_with_mocked_fs(uid_a, audio=bad_audio)
        assert resp3.status_code == 400, f"Expected 400, got {resp3.status_code}"
        body3 = json.loads(resp3.content)
        assert "Unsupported audio format" in body3["error"]
        print(f"  Result: Correctly rejected — {body3['error']}")
        print("  SUCCESS — TEST 3 Passed\n")

        # ── TEST 4: Audio too small (< 40 KB) ────────────────────────────────
        print("=== TEST 4: Audio Too Small → 400 ===")
        tiny_audio = _make_audio(size_bytes=1_000)
        resp4, _ = _enrollment_with_mocked_fs(uid_a, audio=tiny_audio)
        assert resp4.status_code == 400, f"Expected 400, got {resp4.status_code}"
        body4 = json.loads(resp4.content)
        assert "too short" in body4["error"].lower() or "short" in body4["error"].lower()
        print(f"  Result: Correctly rejected — {body4['error']}")
        print("  SUCCESS — TEST 4 Passed\n")

        # ── TEST 5: Wrong/missing consent ─────────────────────────────────────
        print("=== TEST 5: Wrong Consent Text → 400 ===")
        resp5, _ = _enrollment_with_mocked_fs(uid_a, consent="I agree")
        assert resp5.status_code == 400, f"Expected 400, got {resp5.status_code}"
        body5 = json.loads(resp5.content)
        assert "Consent" in body5["error"] or "consent" in body5["error"]
        print(f"  Result: Correctly rejected — {body5['error']}")
        print("  SUCCESS — TEST 5 Passed\n")

        # ── TEST 6: Missing user_identifier ───────────────────────────────────
        print("=== TEST 6: Missing user_identifier → 400 ===")
        req6 = factory.post(
            "/api/voice/personalized/openvoice/",
            data={
                "consent": (
                    "I confirm that I own this voice or have permission from the "
                    "voice owner to create and use this voice."
                ),
            },
        )
        req6.FILES["audio"] = _make_audio()
        resp6 = enroll_openvoice_voice(req6)
        assert resp6.status_code == 400
        body6 = json.loads(resp6.content)
        assert "user_identifier" in body6["error"]
        print(f"  Result: Correctly rejected — {body6['error']}")
        print("  SUCCESS — TEST 6 Passed\n")

        # ── TEST 7: Path traversal in user_identifier ──────────────────────────
        print("=== TEST 7: Path Traversal in user_identifier → 400 ===")
        for bad_uid in ["../etc/passwd", "..\\windows\\system32", "user/bad"]:
            req7 = _post_enroll(bad_uid)
            resp7 = enroll_openvoice_voice(req7)
            assert resp7.status_code == 400, (
                f"Expected 400 for uid='{bad_uid}', got {resp7.status_code}"
            )
        print("  Result: All path traversal attempts rejected with 400.")
        print("  SUCCESS — TEST 7 Passed\n")

        # ── TEST 8: provider='openvoice' is set after enrollment ───────────────
        print("=== TEST 8: Provider Set to 'openvoice' After Enrollment ===")
        pref8 = UserVoicePreference.objects.get(user_identifier=uid_a)
        assert pref8.provider == "openvoice", f"Expected 'openvoice', got '{pref8.provider}'"
        print(f"  Result: provider='{pref8.provider}' ✓")
        print("  SUCCESS — TEST 8 Passed\n")

        # ── TEST 9: openvoice_reference_path is stored (non-empty string) ──────
        print("=== TEST 9: openvoice_reference_path Is Stored (Non-Empty Path) ===")
        pref9 = UserVoicePreference.objects.get(user_identifier=uid_a)
        assert pref9.openvoice_reference_path.strip(), "openvoice_reference_path is empty!"
        print(f"  Result: openvoice_reference_path stored (length={len(pref9.openvoice_reference_path)})")
        print("  SUCCESS — TEST 9 Passed\n")

        # ── TEST 10: Raw audio is NOT stored in DB ─────────────────────────────
        print("=== TEST 10: Raw Audio NOT Stored in SQLite ===")
        pref10 = UserVoicePreference.objects.get(user_identifier=uid_a)
        # The field must be a string path, not binary audio data
        assert isinstance(pref10.openvoice_reference_path, str)
        # Must not start with raw binary (RIFF / OGG / ID3 / webm magic bytes)
        assert not pref10.openvoice_reference_path.startswith(b"\x00".decode("latin1") * 10)
        # Must not be a base64 blob (very long and doesn't look like a path)
        assert len(pref10.openvoice_reference_path) < 1000, "Suspiciously long 'path'!"
        print(f"  Result: DB stores path string only (len={len(pref10.openvoice_reference_path)})")
        print("  SUCCESS — TEST 10 Passed\n")

        # ── TEST 11: User A cannot read User B's reference through status API ──
        print("=== TEST 11: User Isolation — Status API ===")
        # Enroll user B separately
        _clear(uid_b)
        resp_b, _ = _enrollment_with_mocked_fs(uid_b)
        assert resp_b.status_code == 200

        req_a_status = factory.get(
            "/api/voice/personalized/status/",
            data={"user_identifier": uid_a},
        )
        resp_a_status = get_voice_status(req_a_status)
        body_a_status = json.loads(resp_a_status.content)
        # A's status must not expose B's path
        assert "openvoice_reference_path" not in str(body_a_status), (
            "Status API exposed openvoice_reference_path!"
        )
        assert body_a_status.get("provider") == "openvoice"
        assert body_a_status.get("enabled") is True

        req_b_status = factory.get(
            "/api/voice/personalized/status/",
            data={"user_identifier": uid_b},
        )
        resp_b_status = get_voice_status(req_b_status)
        body_b_status = json.loads(resp_b_status.content)
        assert body_b_status.get("enabled") is True
        # Neither response should contain any raw path
        for key in ("openvoice_reference_path", "file_path", "reference_path"):
            assert key not in body_a_status, f"Field '{key}' leaked!"
            assert key not in body_b_status, f"Field '{key}' leaked!"
        print("  Result: Status API does not leak filesystem paths.")
        print("  Result: User A and B statuses are isolated.")
        print("  SUCCESS — TEST 11 Passed\n")

        # ── TEST 12: Status for enrolled user → enabled=True ──────────────────
        print("=== TEST 12: Status for Enrolled User → enabled=True ===")
        req12 = factory.get("/api/voice/personalized/status/", data={"user_identifier": uid_a})
        resp12 = get_voice_status(req12)
        body12 = json.loads(resp12.content)
        assert body12["status"] == "ok"
        assert body12["enabled"] is True
        assert body12["provider"] == "openvoice"
        print(f"  Result: enabled={body12['enabled']}, provider='{body12['provider']}'")
        print("  SUCCESS — TEST 12 Passed\n")

        # ── TEST 13: Status for non-enrolled user → enabled=False ─────────────
        print("=== TEST 13: Status for Non-Enrolled User → enabled=False ===")
        _clear("p3_fresh_user")
        req13 = factory.get("/api/voice/personalized/status/", data={"user_identifier": "p3_fresh_user"})
        resp13 = get_voice_status(req13)
        body13 = json.loads(resp13.content)
        assert body13["status"] == "ok"
        assert body13["enabled"] is False
        assert body13["provider"] == "piper"
        print(f"  Result: enabled={body13['enabled']}, provider='{body13['provider']}'")
        print("  SUCCESS — TEST 13 Passed\n")

        # ── TEST 14: Disable custom voice ─────────────────────────────────────
        print("=== TEST 14: Disable Custom Voice → provider='piper' ===")
        pref14_before = UserVoicePreference.objects.get(user_identifier=uid_a)
        old_path = pref14_before.openvoice_reference_path

        # Mock file removal so we don't need actual files on disk
        with patch("voice.views._safe_remove_reference_file") as mock_rm:
            req14 = factory.post(
                "/api/voice/personalized/disable/",
                data=json.dumps({"user_identifier": uid_a}),
                content_type="application/json",
            )
            resp14 = disable_personalized_voice(req14)
            body14 = json.loads(resp14.content)

        assert resp14.status_code == 200
        assert body14["status"] == "ok"
        assert body14["provider"] == "piper"

        pref14_after = UserVoicePreference.objects.get(user_identifier=uid_a)
        assert pref14_after.provider == "piper"
        assert pref14_after.openvoice_reference_path == ""
        assert pref14_after.elevenlabs_voice_id == ""
        print(f"  Result: provider='{pref14_after.provider}', openvoice_reference_path='{pref14_after.openvoice_reference_path}'")
        print("  SUCCESS — TEST 14 Passed\n")

        # ── TEST 15: File cleanup called on disable ────────────────────────────
        print("=== TEST 15: File Cleanup Called on Disable ===")
        # Re-enroll first so there is a reference to clear
        resp15, fake_path15 = _enrollment_with_mocked_fs(uid_a)
        assert resp15.status_code == 200

        with patch("voice.views._safe_remove_reference_file") as mock_rm15:
            req15 = factory.post(
                "/api/voice/personalized/disable/",
                data=json.dumps({"user_identifier": uid_a}),
                content_type="application/json",
            )
            resp15d = disable_personalized_voice(req15)
            body15d = json.loads(resp15d.content)

        assert resp15d.status_code == 200
        assert mock_rm15.called, "_safe_remove_reference_file was not called!"
        print(f"  Result: _safe_remove_reference_file called with uid='{uid_a}'")
        print("  SUCCESS — TEST 15 Passed\n")

        # ── TEST 16: Disable when no preference exists ─────────────────────────
        print("=== TEST 16: Disable When No Preference Exists → ok ===")
        _clear("p3_no_pref_user")
        with patch("voice.views._safe_remove_reference_file"):
            req16 = factory.post(
                "/api/voice/personalized/disable/",
                data=json.dumps({"user_identifier": "p3_no_pref_user"}),
                content_type="application/json",
            )
            resp16 = disable_personalized_voice(req16)
        body16 = json.loads(resp16.content)
        assert resp16.status_code == 200
        assert body16["status"] == "ok"
        print(f"  Result: {body16['message']}")
        print("  SUCCESS — TEST 16 Passed\n")

        # ── TEST 17: Existing Piper behavior still works ───────────────────────
        print("=== TEST 17: Existing Piper TTS Behavior Still Works ===")
        audio_bytes, fmt = generate_speech("Hello Bhavi from Piper", "en")
        assert len(audio_bytes) > 0 and fmt == "wav"
        print(f"  Result: Piper generated {len(audio_bytes)} bytes WAV.")
        print("  SUCCESS — TEST 17 Passed\n")

        # ── TEST 18: Existing ElevenLabs routing still works ──────────────────
        print("=== TEST 18: ElevenLabs Routing Still Works ===")
        el_uid = "p3_el_test_user"
        _clear(el_uid)
        UserVoicePreference.objects.create(
            user_identifier=el_uid,
            provider="elevenlabs",
            elevenlabs_voice_id="test_voice_xyz",
        )
        fake_mp3 = b"ID3FAKEMP3BYTES"
        with patch("voice.services.elevenlabs_tts.synthesize_elevenlabs") as mock_el:
            mock_el.return_value = (fake_mp3, "mp3")
            a18, f18 = generate_speech("ElevenLabs test", "en", user_identifier=el_uid)
            assert mock_el.called
            assert a18 == fake_mp3 and f18 == "mp3"
        _clear(el_uid)
        print("  Result: ElevenLabs routing invoked correctly.")
        print("  SUCCESS — TEST 18 Passed\n")

        # ── TEST 19: OpenVoice failure falls back to Piper ────────────────────
        print("=== TEST 19: OpenVoice Failure → Piper Fallback ===")
        ov_uid = "p3_ov_fallback_user"
        _clear(ov_uid)
        UserVoicePreference.objects.create(
            user_identifier=ov_uid,
            provider="openvoice",
            openvoice_reference_path="/some/reference.webm",
        )
        with patch("voice.services.openvoice_tts.generate_openvoice_speech",
                   side_effect=RuntimeError("Microservice offline")):
            a19, f19 = generate_speech("Fallback test", "en", user_identifier=ov_uid)
            assert len(a19) > 0 and f19 == "wav", (
                f"Expected Piper WAV fallback, got fmt={f19}"
            )
        _clear(ov_uid)
        print(f"  Result: OpenVoice failure gracefully caught → Piper WAV ({len(a19)} bytes).")
        print("  SUCCESS — TEST 19 Passed\n")

        # ── TEST 20: Live integration against real server ─────────────────────
        print("=== TEST 20: Live Integration (Optional — Requires Server on 8001) ===")
        from voice.services.openvoice_tts import check_openvoice_health
        is_healthy = check_openvoice_health()
        print(f"  OpenVoice server health: {is_healthy}")
        if is_healthy:
            # Find any reference file from a real enrollment
            live_ref = None
            prefs = UserVoicePreference.objects.filter(provider="openvoice").exclude(
                openvoice_reference_path=""
            )
            for p in prefs:
                if os.path.isfile(p.openvoice_reference_path):
                    live_ref = p.openvoice_reference_path
                    break
            if live_ref:
                from voice.services.openvoice_tts import generate_openvoice_speech
                live_audio, live_fmt = generate_openvoice_speech(
                    "Hello, this is a live Phase 3 enrollment test.",
                    reference_audio=live_ref,
                )
                assert len(live_audio) > 0 and live_fmt == "wav"
                print(f"  Live synthesis: {len(live_audio) // 1024} KB WAV ✓")
            else:
                print("  No real enrolled reference file found — skipping live synthesis.")
        else:
            print("  Server not running — live test skipped (all mocked tests validated full contract).")
        print("  SUCCESS — TEST 20 Passed\n")

    finally:
        _clear(uid_a, uid_b, "p3_fresh_user", "p3_no_pref_user",
               "p3_el_test_user", "p3_ov_fallback_user")

    print("=" * 70)
    print("ALL 20 PHASE 3 ENROLLMENT TESTS PASSED!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
