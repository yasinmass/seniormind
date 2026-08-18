import base64
import json
import os
import sys
import tempfile
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST
from .services.stt import transcribe_audio
from .services.llm import generate_bhavi_response
from .services.tts import generate_speech
from .services.memory import (
    get_conversation_history,
    add_conversation_turn,
    generate_session_id,
)
from .services import memory_store


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

    # Extract or generate conversation_id
    conversation_id = request.POST.get('conversation_id') or request.POST.get('session_id')
    if not conversation_id or not conversation_id.strip():
        conversation_id = generate_session_id()
        print(f"[AudioAPI] No conversation_id provided — generated new session: {conversation_id}", flush=True)
    else:
        conversation_id = conversation_id.strip()
        print(f"[AudioAPI] Conversation ID: {conversation_id}", flush=True)

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

        # ── Step 5: Retrieve History & Call LLM ──────────────────────────────
        conversation_history = []
        try:
            conversation_history = get_conversation_history(conversation_id)
            print(
                f"[AudioAPI] Retrieved {len(conversation_history)} historical message(s) "
                f"for session {conversation_id}",
                flush=True,
            )
        except Exception as mem_err:
            print(f"[AudioAPI] Warning: Failed to retrieve memory for {conversation_id}: {mem_err}", flush=True)

        try:
            bhavi_response = generate_bhavi_response(
                transcript_text,
                conversation_history=conversation_history
            )
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

        # ── Step 5b: Save turn to memory ──────────────────────────────────────
        try:
            add_conversation_turn(conversation_id, transcript_text, bhavi_response)
        except Exception as turn_err:
            print(f"[AudioAPI] Warning: Failed to save turn to memory: {turn_err}", flush=True)

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
            print(f"[AudioAPI] TTS failed (non-fatal): {tts_err}", flush=True)
            traceback.print_exc(file=sys.stdout)
            sys.stdout.flush()

        # ── Step 7: Return full response ──────────────────────────────────────
        print("[AudioAPI] Returning response", flush=True)

        response_payload = {
            "status": "ok",
            "text": transcript_text,           # STT transcript
            "language": detected_language,     # detected language
            "response": bhavi_response,        # Bhavi text response
            "conversation_id": conversation_id,# Session ID for conversation tracking
        }

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


# ── REST Endpoints for Stage 8.1 Persistent User Memory ─────────────────────────

@csrf_exempt
@require_http_methods(["GET", "POST", "DELETE"])
def manage_memories(request):
    """
    REST Endpoint for User Memory collection management:
    - GET /api/memories/          -> List current user's memories
    - POST /api/memories/         -> Create or update a memory record
    - DELETE /api/memories/       -> Clear all memories for current user
    """
    user_identifier = request.GET.get("user_identifier") or request.headers.get("X-User-Identifier") or "default_user"
    user_obj = request.user if (hasattr(request, "user") and getattr(request.user, "is_authenticated", False)) else None

    if request.method == "GET":
        memory_type = request.GET.get("memory_type")
        memories = memory_store.list_memories(
            user_identifier=user_identifier,
            memory_type=memory_type,
            user=user_obj
        )
        memories_data = [
            {
                "id": m.id,
                "user_identifier": m.user_identifier,
                "memory_type": m.memory_type,
                "key": m.key,
                "value": m.value,
                "created_at": m.created_at.isoformat(),
                "updated_at": m.updated_at.isoformat(),
            }
            for m in memories
        ]
        return JsonResponse({"status": "ok", "memories": memories_data})

    elif request.method == "POST":
        try:
            body = json.loads(request.body.decode("utf-8")) if request.body else {}
        except json.JSONDecodeError:
            return JsonResponse({"status": "error", "error": "Invalid JSON body"}, status=400)

        key = body.get("key")
        value = body.get("value")
        memory_type = body.get("memory_type", "general")
        body_uid = body.get("user_identifier")
        active_uid = body_uid if (body_uid and str(body_uid).strip()) else user_identifier

        try:
            memory_obj = memory_store.create_memory(
                key=key,
                value=value,
                memory_type=memory_type,
                user_identifier=active_uid,
                user=user_obj,
            )
            return JsonResponse({
                "status": "ok",
                "memory": {
                    "id": memory_obj.id,
                    "user_identifier": memory_obj.user_identifier,
                    "memory_type": memory_obj.memory_type,
                    "key": memory_obj.key,
                    "value": memory_obj.value,
                    "created_at": memory_obj.created_at.isoformat(),
                    "updated_at": memory_obj.updated_at.isoformat(),
                }
            }, status=201)
        except ValueError as val_err:
            return JsonResponse({"status": "error", "error": str(val_err)}, status=400)
        except Exception as err:
            return JsonResponse({"status": "error", "error": str(err)}, status=500)

    elif request.method == "DELETE":
        deleted_count = memory_store.clear_memories(user_identifier=user_identifier, user=user_obj)
        return JsonResponse({
            "status": "ok",
            "message": f"Cleared {deleted_count} memories for user [{user_identifier}]",
            "deleted_count": deleted_count
        })


@csrf_exempt
@require_http_methods(["DELETE", "GET", "PUT"])
def manage_single_memory(request, memory_id):
    """
    REST Endpoint for single memory item:
    - DELETE /api/memories/<id>/ -> Delete single memory owned by user
    - GET /api/memories/<id>/    -> Retrieve single memory
    - PUT /api/memories/<id>/    -> Update value of single memory
    """
    user_identifier = request.GET.get("user_identifier") or request.headers.get("X-User-Identifier") or "default_user"
    user_obj = request.user if (hasattr(request, "user") and getattr(request.user, "is_authenticated", False)) else None

    if request.method == "DELETE":
        success = memory_store.delete_memory(memory_id, user_identifier=user_identifier, user=user_obj)
        if success:
            return JsonResponse({"status": "ok", "message": f"Memory #{memory_id} deleted"})
        return JsonResponse({"status": "error", "error": "Memory not found or access denied"}, status=404)

    elif request.method == "GET":
        memory_obj = memory_store.get_memory(memory_id, user_identifier=user_identifier, user=user_obj)
        if not memory_obj:
            return JsonResponse({"status": "error", "error": "Memory not found or access denied"}, status=404)
        return JsonResponse({
            "status": "ok",
            "memory": {
                "id": memory_obj.id,
                "user_identifier": memory_obj.user_identifier,
                "memory_type": memory_obj.memory_type,
                "key": memory_obj.key,
                "value": memory_obj.value,
                "created_at": memory_obj.created_at.isoformat(),
                "updated_at": memory_obj.updated_at.isoformat(),
            }
        })

    elif request.method == "PUT":
        try:
            body = json.loads(request.body.decode("utf-8")) if request.body else {}
        except json.JSONDecodeError:
            return JsonResponse({"status": "error", "error": "Invalid JSON body"}, status=400)

        value = body.get("value")
        memory_type = body.get("memory_type")

        try:
            memory_obj = memory_store.update_memory(
                memory_id=memory_id,
                value=value,
                memory_type=memory_type,
                user_identifier=user_identifier,
                user=user_obj,
            )
            if not memory_obj:
                return JsonResponse({"status": "error", "error": "Memory not found or access denied"}, status=404)

            return JsonResponse({
                "status": "ok",
                "memory": {
                    "id": memory_obj.id,
                    "user_identifier": memory_obj.user_identifier,
                    "memory_type": memory_obj.memory_type,
                    "key": memory_obj.key,
                    "value": memory_obj.value,
                    "created_at": memory_obj.created_at.isoformat(),
                    "updated_at": memory_obj.updated_at.isoformat(),
                }
            })
        except ValueError as val_err:
            return JsonResponse({"status": "error", "error": str(val_err)}, status=400)
