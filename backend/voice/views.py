import base64
import os
import sys
import tempfile
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .services.stt import transcribe_audio
from .services.llm import generate_bhavi_response
from .services.tts import generate_speech


def health_check(request):
    return JsonResponse({
        "status": "ok",
        "service": "SeniorMind backend"
    })


@csrf_exempt
@require_POST
def upload_audio(request):
    print("\n[AudioAPI] Request received", flush=True)

    # ── Step 1: Validate uploaded file ───────────────────────────────────────
    audio_file = request.FILES.get('audio')
    if not audio_file:
        print("[AudioAPI] Error: Missing 'audio' file in request", flush=True)
        return JsonResponse({
            "status": "error",
            "error": "Audio file is required"
        }, status=400)

    print("[AudioAPI] File received", flush=True)
    print(f"[AudioAPI] Filename: {audio_file.name}", flush=True)
    print(f"[AudioAPI] Content-Type: {audio_file.content_type}", flush=True)
    print(f"[AudioAPI] Size: {audio_file.size} bytes", flush=True)

    suffix = os.path.splitext(audio_file.name)[1] or ".webm"
    temp_file_path = None

    try:
        # ── Step 2: Write to temporary file ──────────────────────────────────
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file_path = temp_file.name
            print(f"[AudioAPI] Temporary file created: {temp_file_path}", flush=True)
            for chunk in audio_file.chunks():
                temp_file.write(chunk)
            print("[AudioAPI] Temporary file written", flush=True)

        # ── Step 3: Speech-to-Text ────────────────────────────────────────────
        try:
            transcript_text, detected_language = transcribe_audio(temp_file_path)
        except Exception as stt_err:
            print(f"[AudioAPI] STT failed: {stt_err}", flush=True)
            traceback.print_exc(file=sys.stdout)
            sys.stdout.flush()
            return JsonResponse({
                "status": "error",
                "error": "Speech-to-text processing failed"
            }, status=500)

        # ── Step 4: Guard against empty transcript ────────────────────────────
        if not transcript_text or not transcript_text.strip():
            print("[AudioAPI] No speech detected in audio", flush=True)
            return JsonResponse({
                "status": "error",
                "error": "No speech detected"
            }, status=422)

        print(f"[AudioAPI] Transcript: {transcript_text}", flush=True)

        # ── Step 5: LLM → Bhavi response ─────────────────────────────────────
        try:
            bhavi_response = generate_bhavi_response(transcript_text)
        except ConnectionError as conn_err:
            print(f"[AudioAPI] LLM connection error: {conn_err}", flush=True)
            return JsonResponse({
                "status": "error",
                "error": "Bhavi is currently unavailable. Please try again shortly."
            }, status=503)
        except TimeoutError as timeout_err:
            print(f"[AudioAPI] LLM timeout: {timeout_err}", flush=True)
            return JsonResponse({
                "status": "error",
                "error": "Bhavi took too long to respond. Please try again."
            }, status=503)
        except RuntimeError as cfg_err:
            print(f"[AudioAPI] LLM config error: {cfg_err}", flush=True)
            return JsonResponse({
                "status": "error",
                "error": "Bhavi response service is not configured correctly on the server"
            }, status=503)
        except Exception as llm_err:
            print(f"[AudioAPI] LLM call failed: {llm_err}", flush=True)
            traceback.print_exc(file=sys.stdout)
            sys.stdout.flush()
            return JsonResponse({
                "status": "error",
                "error": "Bhavi response service unavailable"
            }, status=503)

        # ── Step 6: TTS → Bhavi audio ─────────────────────────────────────────
        audio_b64 = None
        audio_format = None

        try:
            wav_bytes = generate_speech(bhavi_response, detected_language)
            if wav_bytes:
                audio_b64 = base64.b64encode(wav_bytes).decode("utf-8")
                audio_format = "wav"
                print(
                    f"[AudioAPI] TTS audio encoded "
                    f"({len(wav_bytes) // 1024} KB → {len(audio_b64)} chars base64)",
                    flush=True,
                )
            else:
                print("[AudioAPI] TTS returned empty audio — text response only", flush=True)
        except Exception as tts_err:
            # TTS failure is non-fatal: return text response, log the error.
            print(f"[AudioAPI] TTS failed (non-fatal): {tts_err}", flush=True)
            traceback.print_exc(file=sys.stdout)
            sys.stdout.flush()

        # ── Step 7: Return full response ──────────────────────────────────────
        print("[AudioAPI] Returning response", flush=True)

        response_payload = {
            "status": "ok",
            "text": transcript_text,         # STT transcript
            "language": detected_language,   # detected language
            "response": bhavi_response,      # Bhavi text response
        }

        # Audio is optional — only included when TTS succeeded.
        if audio_b64:
            response_payload["audio_b64"]    = audio_b64
            response_payload["audio_format"] = audio_format

        return JsonResponse(response_payload)

    except Exception as e:
        print(f"[AudioAPI] Unexpected error: {e}", flush=True)
        traceback.print_exc(file=sys.stdout)
        sys.stdout.flush()
        return JsonResponse({
            "status": "error",
            "error": "An unexpected server error occurred"
        }, status=500)

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                print("[AudioAPI] Temporary file deleted", flush=True)
            except OSError as err:
                print(f"[AudioAPI] Warning: Failed to delete temp file: {err}", flush=True)
