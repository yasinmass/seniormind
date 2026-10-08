"""
backend/voice/services/memory_extractor.py

Dedicated service for Stage 8.3: Automatic Persistent Memory Extraction for Bhavi.

Responsibilities:
1. Analyze user transcript via local LLM (Ollama / LLaMA 3.2 3B).
2. Extract useful, stable personal facts (family, preferences, interests, lifestyle).
3. Strictly ignore temporary conversation fluff, questions, and uncertain statements.
4. Enforce strict safety limits (max keys, max length, sensitive keyword rejection).
5. Enforce user isolation and upsert into UserMemory via memory_store.
6. Non-fatal error isolation: failures never interrupt the primary Bhavi voice response.
"""

import json
import os
import re
import sys
import traceback
import urllib.error
import urllib.request
from typing import Dict, List, Optional
from voice.models import UserMemory
from voice.services import memory_store

# ── Configuration ─────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL       = os.environ.get("LLM_MODEL", "llama3.2:3b")
EXTRACTION_TIMEOUT = int(os.environ.get("EXTRACTION_TIMEOUT_SECONDS", "30"))

# Safety & Validation limits
MAX_MEMORIES_PER_TURN = 3
MAX_KEY_LENGTH        = 50
MAX_VALUE_LENGTH      = 150
ALLOWED_MEMORY_TYPES  = {"family", "preference", "interest", "lifestyle", "general", "basic"}

# Sensitive/disallowed keywords (must never be automatically persisted).
# Uses simple substring matching (no word-boundary) so compound keys like
# "user_password" or "atm_pin" are also caught.
SENSITIVE_PATTERNS = [
    r"password", r"\bpin\b", r"_pin", r"pin_", r"\botp\b", r"\bssn\b", r"\baadhar\b",
    r"credit.?card", r"debit.?card", r"bank.?account",
    r"\bcvv\b", r"secret", r"\bdiagnosis\b", r"\bcancer\b", r"\bchemotherapy\b"
]

EXTRACTION_SYSTEM_PROMPT = (
    "You are an accurate memory extraction engine for Bhavi, a voice assistant for senior citizens.\n"
    "Your task is to identify and extract STABLE, LONG-TERM personal facts about the user from what they said.\n\n"
    "GUIDELINES:\n"
    "1. Extract ONLY clear, stable, long-term personal facts explicitly stated by the user about themselves, "
    "their family, or their enduring preferences (e.g., names, family members, location/city, preferred language, "
    "hobbies, music taste, routine wake-up time).\n"
    "2. DO NOT extract temporary states, questions, greetings, or casual chatter.\n"
    "   - Examples to IGNORE: 'What is the weather?', 'Tell me a joke', 'I am bored right now', 'What time is it?', 'I had tea today'.\n"
    "3. DO NOT extract uncertain or speculative statements.\n"
    "   - Examples to IGNORE: 'I think my daughter may visit tomorrow', 'Maybe my favorite food is dosa', 'I might go for a walk'.\n"
    "4. DO NOT extract sensitive medical, financial, or authentication data (passwords, PINs, card numbers).\n"
    "5. Categorize each memory into one of: 'family', 'preference', 'interest', 'lifestyle', 'general'.\n"
    "6. Key must be concise snake_case (e.g., 'daughter_name', 'son_name', 'city', 'preferred_language', 'favorite_music', 'wake_up_time').\n"
    "7. Value must be a concise string (e.g., 'Priya', 'Tamil', 'Old Tamil songs', 'Chennai', '6 AM').\n\n"
    "OUTPUT FORMAT:\n"
    "You must return ONLY a JSON object with this exact schema:\n"
    "{\n"
    '  "memories": [\n'
    '    {"memory_type": "family", "key": "daughter_name", "value": "Priya"}\n'
    "  ]\n"
    "}\n\n"
    "If there are NO useful, stable long-term facts to extract, return:\n"
    '{"memories": []}\n'
)


def _call_extraction_llm(user_text: str) -> str:
    """Send extraction prompt to Ollama."""
    endpoint = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            {"role": "user", "content": f"User statement:\n\"{user_text}\""}
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.1,  # Low temperature for strict factual extraction
            "num_predict": 180,
        },
    }

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=EXTRACTION_TIMEOUT) as response:
        raw = response.read().decode("utf-8")

    data = json.loads(raw)
    content = data.get("message", {}).get("content", "").strip()
    return content


def _clean_json_content(content: str) -> str:
    """Strip markdown code fences if present."""
    trimmed = content.strip()
    if trimmed.startswith("```"):
        lines = trimmed.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        trimmed = "\n".join(lines).strip()
    return trimmed


def validate_single_memory(item: Dict) -> Optional[Dict[str, str]]:
    """
    Validate and sanitize a single candidate memory dictionary.
    Returns cleaned dict if valid, or None if rejected.
    """
    if not isinstance(item, dict):
        return None

    key = item.get("key")
    val = item.get("value")
    mtype = item.get("memory_type", "general")

    if not key or not isinstance(key, str):
        return None
    if not val or not isinstance(val, str):
        return None

    clean_key = key.strip().lower()
    clean_val = val.strip()
    clean_type = str(mtype).strip().lower()

    # Reject empty
    if not clean_key or not clean_val:
        return None

    # Length checks
    if len(clean_key) > MAX_KEY_LENGTH or len(clean_val) > MAX_VALUE_LENGTH:
        return None

    # Key format check (must be snake_case identifier)
    clean_key = re.sub(r"[^a-z0-9_]", "_", clean_key).strip("_")
    if not clean_key:
        return None

    # Sensitive keyword check
    combined_text = f"{clean_key} {clean_val}".lower()
    for pattern in SENSITIVE_PATTERNS:
        if re.search(pattern, combined_text):
            print(f"[MemoryExtractor] Rejected sensitive memory candidate: '{clean_key}'", flush=True)
            return None

    # Normalize memory type
    if clean_type == "basic":
        clean_type = "general"
    elif clean_type not in ALLOWED_MEMORY_TYPES:
        clean_type = "general"

    return {
        "memory_type": clean_type,
        "key": clean_key,
        "value": clean_val,
    }


def parse_and_validate_extraction(raw_output: str) -> List[Dict[str, str]]:
    """
    Parse LLM output JSON and validate extracted memories against safety/domain rules.
    """
    if not raw_output or not raw_output.strip():
        return []

    cleaned = _clean_json_content(raw_output)
    try:
        data = json.loads(cleaned)
    except Exception as e:
        print(f"[MemoryExtractor] JSON parsing failed: {e}. Output was: {cleaned[:100]}", flush=True)
        return []

    if not isinstance(data, dict):
        return []

    memories_raw = data.get("memories")
    if not isinstance(memories_raw, list):
        return []

    validated_memories: List[Dict[str, str]] = []
    seen_keys = set()

    for item in memories_raw:
        if len(validated_memories) >= MAX_MEMORIES_PER_TURN:
            break
        valid_item = validate_single_memory(item)
        if valid_item:
            # Prevent duplicate keys within the same extraction turn
            composite_key = (valid_item["memory_type"], valid_item["key"])
            if composite_key not in seen_keys:
                seen_keys.add(composite_key)
                validated_memories.append(valid_item)

    return validated_memories


def extract_memories_from_text(user_text: str) -> List[Dict[str, str]]:
    """
    Call LLM to extract candidate memories from user transcript, parse and validate.
    Safe: returns empty list on any failure.
    """
    if not user_text or not user_text.strip():
        return []

    try:
        raw_llm_output = _call_extraction_llm(user_text)
        return parse_and_validate_extraction(raw_llm_output)
    except Exception as exc:
        print(f"[MemoryExtractor] LLM extraction error: {exc}", flush=True)
        return []


def persist_extracted_memories(
    memories: List[Dict[str, str]],
    user_identifier: str = "default_user",
    user=None
) -> List[UserMemory]:
    """
    Persist validated memories to UserMemory database table.
    Enforces user isolation and update/upsert rules:
    - If user_identifier + memory_type + key exists: updates value.
    - If key already exists for this user under a different type, updates that record to prevent duplicates.
    """
    if not memories:
        return []

    persisted: List[UserMemory] = []
    uid = memory_store._resolve_user_identifier(user_identifier, user)

    for mem in memories:
        mtype = mem["memory_type"]
        key = mem["key"]
        val = mem["value"]

        try:
            # Check if key exists under any other category for this user
            existing = UserMemory.objects.filter(user_identifier=uid, key=key).first()
            if existing and existing.memory_type != mtype:
                # Update existing memory with new value and updated category
                existing.value = val
                existing.memory_type = mtype
                existing.save()
                print(f"[MemoryExtractor] Updated existing memory [{uid}] {mtype}:{key} = {val}", flush=True)
                persisted.append(existing)
            else:
                saved_obj = memory_store.create_memory(
                    key=key,
                    value=val,
                    memory_type=mtype,
                    user_identifier=uid,
                    user=user,
                )
                persisted.append(saved_obj)
        except Exception as save_err:
            print(f"[MemoryExtractor] Failed to persist memory {key} for [{uid}]: {save_err}", flush=True)

    return persisted


def extract_and_persist_memories(
    transcript: str,
    user_identifier: str = "default_user",
    user=None
) -> List[UserMemory]:
    """
    High-level entrypoint for Stage 8.3:
    Extracts stable facts from user transcript and saves them to UserMemory.
    Always safe: will never raise an uncaught exception.
    """
    if not transcript or not transcript.strip():
        return []

    try:
        extracted = extract_memories_from_text(transcript)
        if not extracted:
            return []
        print(f"[MemoryExtractor] Extracted {len(extracted)} valid memory candidates from transcript", flush=True)
        return persist_extracted_memories(extracted, user_identifier=user_identifier, user=user)
    except Exception as exc:
        print(f"[MemoryExtractor] Unexpected error in extract_and_persist_memories: {exc}", flush=True)
        traceback.print_exc(file=sys.stdout)
        sys.stdout.flush()
        return []
