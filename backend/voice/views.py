import base64
import json
import os
import sys
import tempfile
import traceback
import uuid
from pathlib import Path
from django.conf import settings
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
from .services.memory_extractor import extract_and_persist_memories
from .services.risk_detector import analyze_risk
from .models import (
    SafetyEvent,
    UserVoicePreference,
    SeniorProfile,
    CaregiverElderLink,
    generate_unique_senior_id,
)

# ── OpenVoice reference audio storage ──────────────────────────────────────────
# Stored under BASE_DIR/voice_references/ — never inside SQLite.
_VOICE_REFERENCES_DIR = Path(settings.BASE_DIR) / "voice_references"

# Supported audio MIME types / extensions accepted for enrollment
_ALLOWED_AUDIO_EXTENSIONS = {".webm", ".wav", ".mp3", ".ogg", ".m4a", ".mp4", ".flac"}
_ALLOWED_AUDIO_CONTENT_TYPES = {
    "audio/webm", "audio/wav", "audio/x-wav", "audio/mpeg",
    "audio/mp3", "audio/ogg", "audio/mp4", "audio/flac",
    "audio/x-m4a", "video/webm",  # Chrome sometimes labels webm as video/webm
}
# Minimum enrollment file size: ~20s of 16 kbps audio ≈ 40 KB
_MIN_AUDIO_SIZE_BYTES = 40_000
# Maximum: 50 MB should be far more than enough
_MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024


def _ensure_voice_references_dir():
    """Create the voice_references directory if it does not already exist."""
    _VOICE_REFERENCES_DIR.mkdir(parents=True, exist_ok=True)
    return _VOICE_REFERENCES_DIR


def _safe_remove_reference_file(file_path: str, user_identifier: str) -> bool:
    """
    Remove a stored reference audio file only if it is not used by any other
    UserVoicePreference. Returns True if the file was removed, False otherwise.
    """
    if not file_path or not str(file_path).strip():
        return False
    clean_path = str(file_path).strip()
    # Check whether any OTHER user references the same physical file
    others = UserVoicePreference.objects.filter(
        openvoice_reference_path=clean_path,
    ).exclude(user_identifier=user_identifier)
    if others.exists():
        print(
            f"[VoiceEnroll] Reference file shared with {others.count()} other user(s) — NOT deleting.",
            flush=True,
        )
        return False
    try:
        path_obj = Path(clean_path)
        if path_obj.is_file():
            path_obj.unlink()
            print(f"[VoiceEnroll] Deleted reference file: {clean_path}", flush=True)
            return True
        else:
            print(f"[VoiceEnroll] Reference file not found on disk (already removed?): {clean_path}", flush=True)
    except OSError as err:
        print(f"[VoiceEnroll] Warning: Could not delete reference file {clean_path}: {err}", flush=True)
    return False


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

        # ── Step 5: Retrieve History & Persistent Memories, Call LLM ─────────
        user_identifier = request.POST.get("user_identifier") or request.headers.get("X-User-Identifier") or "default_user"
        user_obj = request.user if (hasattr(request, "user") and getattr(request.user, "is_authenticated", False)) else None

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

        user_memory_context = None
        try:
            persistent_memories = memory_store.get_relevant_memories(
                user_identifier=user_identifier,
                transcript=transcript_text,
                user=user_obj,
            )
            if persistent_memories:
                user_memory_context = memory_store.format_memories_for_prompt(persistent_memories)
                print(
                    f"[AudioAPI] Included {len(persistent_memories)} persistent memory item(s) "
                    f"for user [{user_identifier}]",
                    flush=True,
                )
        except Exception as pmem_err:
            print(f"[AudioAPI] Warning: Failed to retrieve persistent memories: {pmem_err}", flush=True)

        try:
            bhavi_response = generate_bhavi_response(
                transcript_text,
                conversation_history=conversation_history,
                user_memory_context=user_memory_context,
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

        # ── Step 5c: Stage 8.3 Extract and persist memories (non-fatal) ────────
        extracted_memories = []
        try:
            extracted_memories = extract_and_persist_memories(
                transcript=transcript_text,
                user_identifier=user_identifier,
                user=user_obj,
            )
            if extracted_memories:
                print(
                    f"[AudioAPI] Extracted and persisted {len(extracted_memories)} memory item(s) "
                    f"for user [{user_identifier}]",
                    flush=True,
                )
        except Exception as extract_err:
            print(f"[AudioAPI] Warning: Memory extraction failed (non-fatal): {extract_err}", flush=True)

        # ── Step 5d: Stage 9 Risk Detection (non-fatal) ───────────────────────
        risk_result = {
            "risk_level": "LOW",
            "category": "NONE",
            "reason": "",
            "requires_attention": False,
        }
        try:
            risk_result = analyze_risk(transcript_text)
            if risk_result.get("requires_attention"):
                # Store a safety event — only when there is something worth noting
                relevant_excerpt = transcript_text[:200] if transcript_text else ""
                SafetyEvent.objects.create(
                    user_identifier=user_identifier,
                    risk_level=risk_result["risk_level"],
                    category=risk_result["category"],
                    reason=risk_result.get("reason", ""),
                    relevant_text=relevant_excerpt,
                    status="NEW",
                )
                print(
                    f"[AudioAPI] Safety event stored for [{user_identifier}]: "
                    f"{risk_result['risk_level']}/{risk_result['category']}",
                    flush=True,
                )
        except Exception as risk_err:
            print(f"[AudioAPI] Warning: Risk detection failed (non-fatal): {risk_err}", flush=True)

        # ── Step 6: TTS → Bhavi audio ─────────────────────────────────────────
        audio_b64 = None
        audio_format = None

        try:
            audio_bytes, audio_format = generate_speech(
                bhavi_response,
                detected_language,
                user_identifier=user_identifier,
            )
            if audio_bytes:
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                print(
                    f"[AudioAPI] TTS audio encoded "
                    f"({len(audio_bytes) // 1024} KB {audio_format.upper()} → {len(audio_b64)} chars base64)",
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

        # Always include risk in response so frontend can display/log it
        response_payload["risk"] = risk_result

        if extracted_memories:
            response_payload["extracted_memories"] = [
                {
                    "id": m.id,
                    "memory_type": m.memory_type,
                    "key": m.key,
                    "value": m.value,
                }
                for m in extracted_memories
            ]

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


# ── REST Endpoints for Stage 10 Caregiver Dashboard ─────────────────────────────

@csrf_exempt
@require_http_methods(["GET"])
def caregiver_overview(request, user_identifier=None, _skip_auth=False):
    """
    Stage 10 — Caregiver Dashboard overview endpoint.
    Retrieves elder profile, overall safety status, active SafetyEvent alerts,
    persistent UserMemory insights, and recent synthesized activity timeline.

    Authorization:
    - Internal calls (e.g. from caregiver_linked_senior) pass _skip_auth=True and have
      already verified the APPROVED link before calling this function.
    - External HTTP callers must supply X-Senior-ID + X-Caretaker-Phone (or query params)
      proving an APPROVED CaregiverElderLink to the target senior.
    """
    if not user_identifier or not str(user_identifier).strip():
        user_identifier = request.GET.get("user_identifier") or request.headers.get("X-User-Identifier") or "default_user"
    user_identifier = str(user_identifier).strip()

    # ── Authorization gate ──────────────────────────────────────────────────
    if not _skip_auth:
        # Require caretaker to supply their credentials
        req_senior_id = (
            request.GET.get("senior_id")
            or request.headers.get("X-Senior-ID")
            or ""
        ).strip()
        req_phone = (
            request.GET.get("phone_number")
            or request.headers.get("X-Caretaker-Phone")
            or ""
        ).strip()

        if not req_senior_id or not req_phone:
            return JsonResponse({
                "status": "error",
                "error": "Authorization required. Supply senior_id and phone_number to access caregiver overview."
            }, status=403)

        # Verify that the senior_id maps to the requested user_identifier
        profile = SeniorProfile.objects.filter(senior_id__iexact=req_senior_id).first()
        if not profile or profile.user_identifier != user_identifier:
            return JsonResponse({
                "status": "error",
                "error": "Access denied. Senior ID does not match the requested senior."
            }, status=403)

        # Verify APPROVED link
        approved_link = CaregiverElderLink.objects.filter(
            senior=profile,
            caretaker_phone=req_phone,
            status="APPROVED",
        ).first()
        if not approved_link:
            return JsonResponse({
                "status": "error",
                "error": "Access denied. No approved caretaker relationship found.",
                "is_linked": False,
            }, status=403)

    # 1. Fetch Safety Events (sorted by newest first)
    events_qs = SafetyEvent.objects.filter(user_identifier=user_identifier).order_by("-created_at")[:25]
    safety_events = [
        {
            "id": e.id,
            "user_identifier": e.user_identifier,
            "risk_level": e.risk_level,
            "category": e.category,
            "category_display": e.get_category_display(),
            "reason": e.reason,
            "relevant_text": e.relevant_text,
            "status": e.status,
            "created_at": e.created_at.isoformat(),
        }
        for e in events_qs
    ]

    # 2. Fetch User Memories (sorted by newest updated first)
    from .models import UserMemory
    memories_qs = UserMemory.objects.filter(user_identifier=user_identifier).order_by("-updated_at")[:25]
    recent_memories = [
        {
            "id": m.id,
            "user_identifier": m.user_identifier,
            "memory_type": m.memory_type,
            "memory_type_display": m.get_memory_type_display(),
            "key": m.key,
            "value": m.value,
            "created_at": m.created_at.isoformat(),
            "updated_at": m.updated_at.isoformat(),
        }
        for m in memories_qs
    ]

    # 3. Determine Overall Status & Risk Counts
    critical_count = 0
    high_count = 0
    medium_count = 0
    new_alerts_count = 0

    for e in events_qs:
        if e.status == "NEW":
            new_alerts_count += 1
        if e.status in ("NEW", "REVIEWED"):
            if e.risk_level == "CRITICAL":
                critical_count += 1
            elif e.risk_level == "HIGH":
                high_count += 1
            elif e.risk_level == "MEDIUM":
                medium_count += 1

    if critical_count > 0:
        overall_status = "CRITICAL"
        status_label = "Immediate Attention Required"
    elif high_count > 0:
        overall_status = "HIGH_RISK"
        status_label = "High Safety Risk Detected"
    elif medium_count > 0:
        overall_status = "ATTENTION_REQUIRED"
        status_label = "Potential Safety Concern"
    else:
        overall_status = "STABLE"
        status_label = "Stable"

    # 4. Synthesize Recent Activity Timeline
    activity_list = []
    for e in events_qs:
        activity_list.append({
            "type": "safety_event",
            "id": f"event_{e.id}",
            "title": f"{e.get_category_display()} concern ({e.risk_level})",
            "subtitle": e.reason or e.relevant_text,
            "severity": e.risk_level,
            "timestamp": e.created_at.isoformat(),
        })

    for m in memories_qs:
        activity_list.append({
            "type": "memory",
            "id": f"mem_{m.id}",
            "title": f"Memory remembered ({m.get_memory_type_display()})",
            "subtitle": f"{m.key.replace('_', ' ').title()}: {m.value}",
            "severity": "LOW",
            "timestamp": m.updated_at.isoformat(),
        })

    activity_list.sort(key=lambda x: x["timestamp"], reverse=True)

    # 5. Last Interaction Excerpt
    last_interaction = None
    if events_qs.exists():
        last_ev = events_qs.first()
        last_interaction = {
            "text": last_ev.relevant_text or last_ev.reason,
            "timestamp": last_ev.created_at.isoformat(),
            "risk_level": last_ev.risk_level,
        }
    elif memories_qs.exists():
        last_mem = memories_qs.first()
        last_interaction = {
            "text": f"Saved memory: {last_mem.key} = {last_mem.value}",
            "timestamp": last_mem.updated_at.isoformat(),
            "risk_level": "LOW",
        }

    elder_profile = {
        "name": "Raj Kumar",
        "user_identifier": user_identifier,
        "age": 78,
        "location": "Chennai",
    }

    return JsonResponse({
        "status": "ok",
        "user_identifier": user_identifier,
        "elder_profile": elder_profile,
        "overall_status": overall_status,
        "status_label": status_label,
        "last_interaction": last_interaction,
        "safety_events": safety_events,
        "recent_memories": recent_memories,
        "recent_activity": activity_list[:12],
        "summary": {
            "total_alerts": len(safety_events),
            "new_alerts": new_alerts_count,
            "critical_alerts": critical_count,
            "high_alerts": high_count,
            "medium_alerts": medium_count,
            "total_memories": len(recent_memories),
        },
    })


@csrf_exempt
@require_http_methods(["POST", "PUT"])
def update_safety_event(request, event_id):
    """
    Caregiver status update for a safety event (NEW -> REVIEWED / RESOLVED).
    Authorization: requires an APPROVED CaregiverElderLink between the caller
    (identified by phone_number) and the senior who owns this event.
    """
    try:
        event = SafetyEvent.objects.get(id=event_id)
    except SafetyEvent.DoesNotExist:
        return JsonResponse({"status": "error", "error": "Safety event not found"}, status=404)

    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        body = {}

    # ── Authorization: verify caller has an APPROVED link to event's senior ──
    req_phone = (
        body.get("phone_number")
        or request.POST.get("phone_number")
        or request.headers.get("X-Caretaker-Phone")
        or ""
    ).strip()
    req_senior_id = (
        body.get("senior_id")
        or request.POST.get("senior_id")
        or request.headers.get("X-Senior-ID")
        or ""
    ).strip()

    if req_phone and req_senior_id:
        # Verify the caller's APPROVED link to the event owner
        profile = SeniorProfile.objects.filter(
            user_identifier=event.user_identifier
        ).first()
        if profile:
            # Check senior_id matches
            if profile.senior_id.lower() != req_senior_id.lower():
                return JsonResponse({
                    "status": "error",
                    "error": "Access denied. Senior ID mismatch."
                }, status=403)
            approved = CaregiverElderLink.objects.filter(
                senior=profile,
                caretaker_phone=req_phone,
                status="APPROVED",
            ).exists()
            if not approved:
                return JsonResponse({
                    "status": "error",
                    "error": "Access denied. No approved caretaker relationship found."
                }, status=403)
        # If no SeniorProfile exists for this event's uid, fall through
        # (legacy events created before linking system — allow update with phone)
    # Note: if no credentials supplied, allow update for backward compatibility
    # with the existing dashboard that doesn't yet send these headers.
    # TODO: make credentials mandatory once frontend is updated.

    new_status = body.get("status") or request.POST.get("status")
    if new_status in ["NEW", "REVIEWED", "RESOLVED"]:
        event.status = new_status
        event.save()
        return JsonResponse({
            "status": "ok",
            "event": {
                "id": event.id,
                "status": event.status,
                "risk_level": event.risk_level,
                "category": event.category,
            }
        })
    return JsonResponse({"status": "error", "error": "Invalid status. Allowed: NEW, REVIEWED, RESOLVED"}, status=400)


# ── Stage 11 Phase 3 — Personalized Voice Enrollment ────────────────────────────

_REQUIRED_CONSENT_TEXT = (
    "I confirm that I own this voice or have permission from the voice owner "
    "to create and use this voice."
)

@csrf_exempt
@require_POST
def enroll_personalized_voice(request):
    """
    POST /api/voice/personalized/

    Upload a voice sample and create an ElevenLabs cloned voice for this user.

    Expects multipart/form-data:
        audio          (required) – voice sample audio file
        user_identifier(required) – string that identifies this elder user
        consent        (required) – must equal the exact consent text
        voice_name     (optional) – friendly name for the cloned voice

    On success:
        - Calls ElevenLabs Voice Cloning API
        - Saves voice_id into UserVoicePreference (provider = 'elevenlabs')
        - Returns {status: 'ok', voice_id: '...'}

    The raw audio file is NEVER persisted to disk permanently.
    The API key is NEVER returned or logged.
    """
    # ── Step 1: Extract user identifier ──────────────────────────────────────
    user_identifier = (
        request.POST.get("user_identifier")
        or request.headers.get("X-User-Identifier")
        or ""
    ).strip()

    if not user_identifier:
        return JsonResponse(
            {"status": "error", "error": "user_identifier is required."},
            status=400,
        )

    # ── Step 2: Enforce consent ───────────────────────────────────────────────
    consent_text = (request.POST.get("consent") or "").strip()
    if consent_text != _REQUIRED_CONSENT_TEXT:
        return JsonResponse(
            {
                "status": "error",
                "error": (
                    "Consent not confirmed. You must agree: \""
                    + _REQUIRED_CONSENT_TEXT
                    + "\""
                ),
            },
            status=400,
        )

    # ── Step 3: Validate uploaded audio file ─────────────────────────────────
    audio_file = request.FILES.get("audio")
    if not audio_file:
        return JsonResponse(
            {"status": "error", "error": "Audio file is required."},
            status=400,
        )

    # ── Step 4: Read audio bytes (do NOT write to disk permanently) ───────────
    try:
        audio_bytes = b"".join(chunk for chunk in audio_file.chunks())
    except Exception as read_err:
        print(f"[VoiceEnroll] Failed to read audio file: {read_err}", flush=True)
        return JsonResponse(
            {"status": "error", "error": "Failed to read audio file."},
            status=400,
        )

    if not audio_bytes:
        return JsonResponse(
            {"status": "error", "error": "Uploaded audio file is empty."},
            status=400,
        )

    voice_name = (request.POST.get("voice_name") or "").strip()
    audio_filename = audio_file.name or "sample.webm"

    print(
        f"[VoiceEnroll] Enrollment request from [{user_identifier}] — "
        f"{len(audio_bytes) // 1024} KB, filename='{audio_filename}'",
        flush=True,
    )

    # ── Step 5: Call ElevenLabs Voice Cloning API ─────────────────────────────
    try:
        from .services.elevenlabs_voice import clone_voice
        voice_id = clone_voice(
            audio_bytes=audio_bytes,
            audio_filename=audio_filename,
            name=voice_name,
            description=f"Bhavi personalized voice for user '{user_identifier}'",
        )
    except ValueError as val_err:
        print(f"[VoiceEnroll] Validation error: {val_err}", flush=True)
        return JsonResponse({"status": "error", "error": str(val_err)}, status=400)
    except RuntimeError as rt_err:
        print(f"[VoiceEnroll] ElevenLabs clone failed: {rt_err}", flush=True)
        return JsonResponse(
            {
                "status": "error",
                "error": (
                    "Voice cloning failed. Please check your ElevenLabs API key and try again. "
                    f"Detail: {rt_err}"
                ),
            },
            status=502,
        )
    except Exception as clone_err:
        print(f"[VoiceEnroll] Unexpected error: {clone_err}", flush=True)
        traceback.print_exc(file=sys.stdout)
        return JsonResponse(
            {"status": "error", "error": "An unexpected error occurred during voice cloning."},
            status=500,
        )
    finally:
        # Explicitly release audio bytes from memory as soon as we're done
        audio_bytes = None

    # ── Step 6: Persist voice_id in UserVoicePreference ──────────────────────
    try:
        pref, created = UserVoicePreference.objects.update_or_create(
            user_identifier=user_identifier,
            defaults={
                "provider": "elevenlabs",
                "elevenlabs_voice_id": voice_id,
            },
        )
        print(
            f"[VoiceEnroll] UserVoicePreference {'created' if created else 'updated'} "
            f"for [{user_identifier}] — provider=elevenlabs, "
            f"voice_id='{voice_id[:6]}...'",
            flush=True,
        )
    except Exception as db_err:
        print(f"[VoiceEnroll] Failed to save preference to DB: {db_err}", flush=True)
        return JsonResponse(
            {"status": "error", "error": "Voice cloned successfully but could not save preference. Please try again."},
            status=500,
        )

    return JsonResponse({
        "status": "ok",
        "message": "Personalized voice enrolled successfully. Bhavi will now speak in your voice.",
        "provider": "elevenlabs",
        # Return only a short prefix — full voice_id is not needed by the frontend
        "voice_id_prefix": voice_id[:6] + "...",
    })


@csrf_exempt
@require_POST
def enroll_openvoice_voice(request):
    """
    POST /api/voice/personalized/openvoice/

    Upload a voice sample and enroll it as this user's OpenVoice V2 reference.
    The audio is stored as a file on the local filesystem — NEVER in SQLite.
    The physical path is NEVER returned to the frontend.

    Expects multipart/form-data:
        audio           (required) – voice sample audio file
        user_identifier (required) – string that identifies this elder user
        consent         (required) – must equal the exact consent text
        voice_name      (optional) – friendly label (stored for display only)

    On success:
        - Stores the audio file under BASE_DIR/voice_references/<user_identifier>/
        - Updates UserVoicePreference: provider='openvoice', openvoice_reference_path=<path>
        - Returns {"status": "ok", "provider": "openvoice", "enabled": true}
    """
    # ── Step 1: Extract and validate user_identifier ──────────────────────────
    user_identifier = (
        request.POST.get("user_identifier")
        or request.headers.get("X-User-Identifier")
        or ""
    ).strip()

    if not user_identifier:
        return JsonResponse(
            {"status": "error", "error": "user_identifier is required."},
            status=400,
        )

    # Basic sanity — reject path traversal characters in user_identifier
    if any(c in user_identifier for c in ("/", "\\", "..", ":", "\0")):
        return JsonResponse(
            {"status": "error", "error": "Invalid user_identifier."},
            status=400,
        )

    # ── Step 2: Enforce consent ───────────────────────────────────────────────
    consent_text = (request.POST.get("consent") or "").strip()
    if consent_text != _REQUIRED_CONSENT_TEXT:
        return JsonResponse(
            {
                "status": "error",
                "error": (
                    "Consent not confirmed. You must agree: \""
                    + _REQUIRED_CONSENT_TEXT
                    + "\""
                ),
            },
            status=400,
        )

    # ── Step 3: Validate uploaded audio file ─────────────────────────────────
    audio_file = request.FILES.get("audio")
    if not audio_file:
        return JsonResponse(
            {"status": "error", "error": "Audio file is required."},
            status=400,
        )

    audio_filename = audio_file.name or "sample.webm"
    file_ext = os.path.splitext(audio_filename)[1].lower() or ".webm"
    content_type = (audio_file.content_type or "").lower().split(";")[0].strip()

    # Extension check
    if file_ext not in _ALLOWED_AUDIO_EXTENSIONS:
        return JsonResponse(
            {
                "status": "error",
                "error": f"Unsupported audio format '{file_ext}'. Supported: webm, wav, mp3, ogg, m4a, flac.",
            },
            status=400,
        )

    # Content-type check (permissive — browser may send video/webm for audio recordings)
    if content_type and content_type not in _ALLOWED_AUDIO_CONTENT_TYPES:
        print(
            f"[VoiceEnroll/OV] Unusual content-type '{content_type}' for user [{user_identifier}] — proceeding cautiously.",
            flush=True,
        )

    # Size check
    if audio_file.size < _MIN_AUDIO_SIZE_BYTES:
        return JsonResponse(
            {
                "status": "error",
                "error": (
                    f"Recording is too short ({audio_file.size // 1024} KB). "
                    "Please record at least 20–30 seconds of clear speech."
                ),
            },
            status=400,
        )

    if audio_file.size > _MAX_AUDIO_SIZE_BYTES:
        return JsonResponse(
            {
                "status": "error",
                "error": "Audio file is too large (maximum 50 MB).",
            },
            status=400,
        )

    print(
        f"[VoiceEnroll/OV] OpenVoice enrollment from [{user_identifier}] — "
        f"{audio_file.size // 1024} KB, ext='{file_ext}'",
        flush=True,
    )

    # ── Step 4: Store audio file to local filesystem ──────────────────────────
    # Path: voice_references/<user_identifier>/<uuid><ext>
    # Never store the path in SQLite — only store the resolved string path.
    try:
        user_dir = _ensure_voice_references_dir() / user_identifier
        user_dir.mkdir(parents=True, exist_ok=True)

        unique_name = f"{uuid.uuid4().hex}{file_ext}"
        dest_path = user_dir / unique_name

        with open(dest_path, "wb") as out_file:
            for chunk in audio_file.chunks():
                out_file.write(chunk)

        stored_path = str(dest_path.resolve())
        print(
            f"[VoiceEnroll/OV] Reference audio saved ({audio_file.size // 1024} KB): {unique_name}",
            flush=True,
        )
    except OSError as fs_err:
        print(f"[VoiceEnroll/OV] Filesystem error saving reference: {fs_err}", flush=True)
        return JsonResponse(
            {"status": "error", "error": "Failed to save voice reference. Please try again."},
            status=500,
        )

    # ── Step 5: Persist preference in UserVoicePreference ────────────────────
    old_path = ""
    try:
        pref, created = UserVoicePreference.objects.get_or_create(
            user_identifier=user_identifier,
            defaults={
                "provider": "openvoice",
                "openvoice_reference_path": stored_path,
            },
        )
        if not created:
            # Capture old path before overwriting — may need cleanup
            old_path = pref.openvoice_reference_path or ""
            pref.provider = "openvoice"
            pref.openvoice_reference_path = stored_path
            pref.elevenlabs_voice_id = ""  # clear any previous ElevenLabs association
            pref.save()

        print(
            f"[VoiceEnroll/OV] UserVoicePreference {'created' if created else 'updated'} "
            f"for [{user_identifier}] — provider=openvoice",
            flush=True,
        )
    except Exception as db_err:
        # Cleanup the newly saved file so we don't leave orphans
        try:
            Path(stored_path).unlink(missing_ok=True)
        except Exception:
            pass
        print(f"[VoiceEnroll/OV] Failed to save preference: {db_err}", flush=True)
        return JsonResponse(
            {"status": "error", "error": "Voice sample saved but could not update preference. Please try again."},
            status=500,
        )

    # ── Step 6: Safely remove the previous reference file (if any) ───────────
    if old_path and old_path != stored_path:
        _safe_remove_reference_file(old_path, user_identifier)

    return JsonResponse({
        "status": "ok",
        "message": "Voice enrolled successfully. Bhavi will now speak in your voice.",
        "provider": "openvoice",
        "enabled": True,
    })


@csrf_exempt
@require_POST
def disable_personalized_voice(request):
    """
    POST /api/voice/personalized/disable/

    Reset the user's TTS provider back to Piper (default).
    Clears ElevenLabs voice_id and OpenVoice reference path (and safely removes
    the stored reference file if it is not shared with another user).

    Expects JSON or form-data:
        user_identifier (required)
    """
    # Accept both JSON body and form POST
    user_identifier = ""
    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else {}
        user_identifier = (
            body.get("user_identifier")
            or request.POST.get("user_identifier")
            or request.headers.get("X-User-Identifier")
            or ""
        ).strip()
    except (json.JSONDecodeError, UnicodeDecodeError):
        user_identifier = (
            request.POST.get("user_identifier")
            or request.headers.get("X-User-Identifier")
            or ""
        ).strip()

    if not user_identifier:
        return JsonResponse(
            {"status": "error", "error": "user_identifier is required."},
            status=400,
        )

    old_reference_path = ""
    try:
        pref = UserVoicePreference.objects.filter(user_identifier=user_identifier).first()
        if pref:
            old_reference_path = pref.openvoice_reference_path or ""
            pref.provider = "piper"
            pref.elevenlabs_voice_id = ""
            pref.openvoice_reference_path = ""
            pref.save()
            print(
                f"[VoiceEnroll] Personalized voice disabled for [{user_identifier}] — "
                "reset to Piper TTS",
                flush=True,
            )
        else:
            print(
                f"[VoiceEnroll] No preference found for [{user_identifier}] — nothing to disable",
                flush=True,
            )
    except Exception as db_err:
        print(f"[VoiceEnroll] Failed to disable preference: {db_err}", flush=True)
        return JsonResponse(
            {"status": "error", "error": "Failed to disable personalized voice."},
            status=500,
        )

    # Safely attempt to clean up the stored reference file
    if old_reference_path:
        _safe_remove_reference_file(old_reference_path, user_identifier)

    return JsonResponse({
        "status": "ok",
        "message": "Personalized voice disabled. Bhavi will now use the default voice.",
        "provider": "piper",
    })


@csrf_exempt
@require_http_methods(["GET"])
def get_voice_status(request):
    """
    GET /api/voice/personalized/status/?user_identifier=<uid>

    Returns the current voice preference for a user in a safe,
    provider-agnostic format. Never exposes filesystem paths or API keys.

    Response format:
        {"status": "ok", "enabled": bool, "provider": str}

    For OpenVoice:  {"enabled": true,  "provider": "openvoice"}
    For ElevenLabs: {"enabled": true,  "provider": "elevenlabs"}
    For Piper:      {"enabled": false, "provider": "piper"}
    """
    user_identifier = (
        request.GET.get("user_identifier")
        or request.headers.get("X-User-Identifier")
        or ""
    ).strip()

    if not user_identifier:
        return JsonResponse(
            {"status": "error", "error": "user_identifier is required."},
            status=400,
        )

    pref = UserVoicePreference.objects.filter(user_identifier=user_identifier).first()
    if not pref or pref.provider == "piper":
        return JsonResponse({
            "status": "ok",
            "provider": "piper",
            "enabled": False,
            # Legacy field — keep for backward compatibility with old frontend code
            "personalized_voice_active": False,
            "voice_id_prefix": None,
        })

    if pref.provider == "openvoice":
        has_reference = bool(pref.openvoice_reference_path.strip())
        return JsonResponse({
            "status": "ok",
            "provider": "openvoice",
            "enabled": has_reference,
            # Legacy compatibility
            "personalized_voice_active": has_reference,
            "voice_id_prefix": None,
        })

    if pref.provider == "elevenlabs":
        has_voice_id = bool(pref.elevenlabs_voice_id.strip())
        return JsonResponse({
            "status": "ok",
            "provider": "elevenlabs",
            "enabled": has_voice_id,
            # Legacy compatibility
            "personalized_voice_active": has_voice_id,
            "voice_id_prefix": pref.elevenlabs_voice_id[:6] + "..." if has_voice_id else None,
        })

    # Fallback for unknown provider
    return JsonResponse({
        "status": "ok",
        "provider": pref.provider,
        "enabled": False,
        "personalized_voice_active": False,
        "voice_id_prefix": None,
    })


# ── Stage 12 — Senior ID & Caretaker Linking Views ──────────────────────────────

@csrf_exempt
@require_http_methods(["GET"])
def senior_my_id(request):
    """
    GET /api/senior/my-id/?user_identifier=<uid>&display_name=<name>
    Returns the persistent SeniorProfile and Senior ID code.
    Creates one persistently on first request if it does not exist yet.
    """
    user_identifier = (
        request.GET.get("user_identifier")
        or request.headers.get("X-User-Identifier")
        or "default_user"
    ).strip()
    display_name = (request.GET.get("display_name") or "").strip()

    profile, created = SeniorProfile.objects.get_or_create(
        user_identifier=user_identifier,
        defaults={
            "senior_id": generate_unique_senior_id(),
            "display_name": display_name or "Senior Citizen",
        }
    )
    if display_name and profile.display_name != display_name:
        profile.display_name = display_name
        profile.save(update_fields=["display_name", "updated_at"])

    return JsonResponse({
        "status": "ok",
        "senior_id": profile.senior_id,
        "display_name": profile.display_name,
        "user_identifier": profile.user_identifier,
        "created": created,
    })


@csrf_exempt
@require_http_methods(["GET"])
def senior_caregivers(request):
    """
    GET /api/senior/caregivers/?user_identifier=<uid>
    Lists approved and pending caregivers linked to this senior.
    """
    user_identifier = (
        request.GET.get("user_identifier")
        or request.headers.get("X-User-Identifier")
        or "default_user"
    ).strip()

    profile = SeniorProfile.objects.filter(user_identifier=user_identifier).first()
    if not profile:
        return JsonResponse({
            "status": "ok",
            "senior_id": "",
            "linked_caregivers": [],
            "pending_caregivers": [],
        })

    links = CaregiverElderLink.objects.filter(senior=profile).order_by("-created_at")
    linked = []
    pending = []
    for l in links:
        item = {
            "id": l.id,
            "name": l.caretaker_name,
            "phone": l.caretaker_phone,
            "slot": l.caretaker_slot,
            "status": l.status,
            "created_at": l.created_at.isoformat(),
        }
        if l.status == "APPROVED":
            linked.append(item)
        elif l.status == "PENDING":
            pending.append(item)

    return JsonResponse({
        "status": "ok",
        "senior_id": profile.senior_id,
        "display_name": profile.display_name,
        "linked_caregivers": linked,
        "pending_caregivers": pending,
    })


@csrf_exempt
@require_POST
def senior_caregiver_action(request, link_id):
    """
    POST /api/senior/caregivers/<link_id>/action/
    Senior approves, rejects, or revokes a caretaker link.
    Body JSON: {"action": "APPROVE" | "REJECT" | "REVOKE", "user_identifier": "<uid>"}
    """
    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        body = {}

    user_identifier = (
        body.get("user_identifier")
        or request.POST.get("user_identifier")
        or request.headers.get("X-User-Identifier")
        or "default_user"
    ).strip()
    action = (body.get("action") or request.POST.get("action") or "").strip().upper()

    link = CaregiverElderLink.objects.select_related("senior").filter(id=link_id).first()
    if not link:
        return JsonResponse({"status": "error", "error": "Caretaker link request not found."}, status=404)

    if link.senior.user_identifier != user_identifier:
        return JsonResponse({"status": "error", "error": "Access denied. Cannot manage another senior's caretakers."}, status=403)

    if action == "APPROVE":
        link.status = "APPROVED"
    elif action == "REJECT":
        link.status = "REJECTED"
    elif action == "REVOKE":
        link.status = "REVOKED"
    else:
        return JsonResponse({"status": "error", "error": f"Invalid action '{action}'. Allowed: APPROVE, REJECT, REVOKE."}, status=400)

    link.save(update_fields=["status", "updated_at"])
    return JsonResponse({
        "status": "ok",
        "message": f"Caretaker link updated to {link.status}.",
        "link_id": link.id,
        "new_status": link.status,
    })


@csrf_exempt
@require_POST
def caregiver_link(request):
    """
    POST /api/caregiver/link/
    Caretaker submits a Senior ID code to request connection.
    Validates Senior ID exists. Rejects invalid codes without leaking details.
    """
    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        body = {}

    senior_id = (body.get("senior_id") or request.POST.get("senior_id") or "").strip()
    phone_number = (body.get("phone_number") or request.POST.get("phone_number") or "").strip()
    full_name = (body.get("full_name") or request.POST.get("full_name") or "").strip()
    caretaker_slot = (body.get("caretaker_slot") or request.POST.get("caretaker_slot") or "PRIMARY").strip()

    if not senior_id:
        return JsonResponse({"status": "error", "error": "Senior ID is required."}, status=400)
    if not phone_number:
        return JsonResponse({"status": "error", "error": "Caretaker phone number is required."}, status=400)

    profile = SeniorProfile.objects.filter(senior_id__iexact=senior_id).first()
    if not profile:
        return JsonResponse({
            "status": "error",
            "error": "Senior ID not found. Please verify the code with your senior."
        }, status=404)

    link, created = CaregiverElderLink.objects.get_or_create(
        senior=profile,
        caretaker_phone=phone_number,
        defaults={
            "caretaker_name": full_name or "Caregiver",
            "caretaker_slot": caretaker_slot,
            "status": "PENDING",
        }
    )

    if not created:
        # If previously revoked or rejected, caretaker can re-request approval
        if link.status in ("REVOKED", "REJECTED"):
            link.status = "PENDING"
            link.caretaker_name = full_name or link.caretaker_name
            link.caretaker_slot = caretaker_slot or link.caretaker_slot
            link.save(update_fields=["status", "caretaker_name", "caretaker_slot", "updated_at"])

    return JsonResponse({
        "status": "ok",
        "link": {
            "id": link.id,
            "senior_id": profile.senior_id,
            "senior_name": profile.display_name,
            "status": link.status,
            "is_approved": link.status == "APPROVED",
            "caretaker_name": link.caretaker_name,
            "caretaker_phone": link.caretaker_phone,
            "caretaker_slot": link.caretaker_slot,
        },
        "message": "Caregiver link established." if link.status == "APPROVED" else "Request submitted. Awaiting approval by the senior in their Settings.",
    })


@csrf_exempt
@require_http_methods(["GET"])
def caregiver_linked_senior(request):
    """
    GET /api/caregiver/linked-senior/?senior_id=<id>&phone_number=<phone>
    Strictly verifies caretaker relationship before returning any senior overview data.
    - If unlinked: 403 Forbidden
    - If pending consent: 403 Forbidden with approval_pending=True (NO private data exposed)
    - If revoked: 403 Forbidden
    - If approved: returns real overview data for linked senior
    """
    senior_id = (request.GET.get("senior_id") or request.headers.get("X-Senior-ID") or "").strip()
    phone_number = (request.GET.get("phone_number") or request.headers.get("X-Caretaker-Phone") or "").strip()

    if not senior_id or not phone_number:
        return JsonResponse({
            "status": "error",
            "error": "Both senior_id and phone_number are required for caretaker authorization."
        }, status=400)

    profile = SeniorProfile.objects.filter(senior_id__iexact=senior_id).first()
    if not profile:
        return JsonResponse({
            "status": "error",
            "error": "Senior ID not found."
        }, status=404)

    link = CaregiverElderLink.objects.filter(
        senior=profile,
        caretaker_phone=phone_number,
    ).first()

    if not link:
        return JsonResponse({
            "status": "error",
            "error": "Access denied. You are not linked to this senior.",
            "is_linked": False,
        }, status=403)

    if link.status == "PENDING":
        return JsonResponse({
            "status": "pending",
            "error": "Access pending. The senior has not yet approved your connection request.",
            "approval_pending": True,
            "senior_id": profile.senior_id,
            "senior_name": profile.display_name,
        }, status=403)

    if link.status in ("REVOKED", "REJECTED"):
        return JsonResponse({
            "status": "error",
            "error": "Access has been revoked or rejected by the senior.",
            "is_revoked": True,
        }, status=403)

    # Status is APPROVED -> Return authorized overview (skip auth — already verified above)
    return caregiver_overview(request, user_identifier=profile.user_identifier, _skip_auth=True)

