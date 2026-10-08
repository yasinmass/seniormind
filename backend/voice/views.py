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
from .services.memory_extractor import extract_and_persist_memories
from .services.risk_detector import analyze_risk
from .models import SafetyEvent


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
def caregiver_overview(request, user_identifier=None):
    """
    Stage 10 — Caregiver Dashboard overview endpoint.
    Retrieves elder profile, overall safety status, active SafetyEvent alerts,
    persistent UserMemory insights, and recent synthesized activity timeline.
    """
    if not user_identifier or not str(user_identifier).strip():
        user_identifier = request.GET.get("user_identifier") or request.headers.get("X-User-Identifier") or "default_user"
    user_identifier = str(user_identifier).strip()

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
    """
    try:
        event = SafetyEvent.objects.get(id=event_id)
    except SafetyEvent.DoesNotExist:
        return JsonResponse({"status": "error", "error": "Safety event not found"}, status=404)

    try:
        body = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        body = {}

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
