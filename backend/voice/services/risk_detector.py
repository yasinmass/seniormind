"""
backend/voice/services/risk_detector.py

Stage 9 — Elder Safety & Risk Detection for Bhavi.

Responsibilities:
1. Analyze the user's transcript via the local LLM (Ollama / LLaMA 3.2 3B).
2. Return a structured risk classification with level, category, and reason.
3. Never crash the main Bhavi voice response on failure.
4. Use context/meaning — not simple keyword matching.

Allowed risk levels  : LOW, MEDIUM, HIGH, CRITICAL
Allowed categories   : NONE, MEDICATION, FALL, MEDICAL, CONFUSION,
                       SAFETY, EMOTIONAL_DISTRESS, SELF_HARM, EMERGENCY, OTHER
"""

import json
import os
import sys
import traceback
import urllib.request
from typing import Dict, Optional

# ── Configuration — reuse the same env-vars as the rest of the project ─────────
OLLAMA_BASE_URL  = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL        = os.environ.get("LLM_MODEL",       "llama3.2:3b")
RISK_LLM_TIMEOUT = int(os.environ.get("RISK_LLM_TIMEOUT_SECONDS", "30"))

# ── Allowed values — used for validation after LLM returns JSON ────────────────
ALLOWED_RISK_LEVELS = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
ALLOWED_CATEGORIES  = {
    "NONE", "MEDICATION", "FALL", "MEDICAL", "CONFUSION",
    "SAFETY", "EMOTIONAL_DISTRESS", "SELF_HARM", "EMERGENCY", "OTHER",
}

# ── Safe default returned when anything goes wrong ─────────────────────────────
SAFE_DEFAULT: Dict = {
    "risk_level": "LOW",
    "category": "NONE",
    "reason": "",
    "requires_attention": False,
}

# ── System prompt for the risk-detection LLM call ─────────────────────────────
RISK_SYSTEM_PROMPT = (
    "You are a safety monitor for Bhavi, a voice assistant used by elderly people.\n"
    "Your job is to read what an elderly person just said and decide whether it signals\n"
    "a potential safety or health risk.\n\n"

    "RISK LEVELS:\n"
    "- LOW    : Normal conversation. No meaningful concern.\n"
    "- MEDIUM : A potential health/safety concern that deserves caregiver attention but\n"
    "           does not appear immediately life-threatening (e.g., missed medication,\n"
    "           recent fall but currently okay, feeling dizzy).\n"
    "- HIGH   : A serious health, emotional, confusion, or self-harm concern requiring\n"
    "           prompt attention (e.g., severe symptoms, repeated confusion, explicit\n"
    "           suicidal thoughts).\n"
    "- CRITICAL: Potential immediate emergency or imminent danger (e.g., cannot get up\n"
    "           after a fall, chest pain, not breathing, immediate danger).\n\n"

    "CATEGORIES:\n"
    "NONE, MEDICATION, FALL, MEDICAL, CONFUSION, SAFETY, EMOTIONAL_DISTRESS, "
    "SELF_HARM, EMERGENCY, OTHER\n\n"

    "RULES:\n"
    "1. Analyze the meaning and context of what the person said — do NOT just look for keywords.\n"
    "2. 'I fell down yesterday but I am okay now' → MEDIUM / FALL (past event, currently safe).\n"
    "3. 'I fell down and I cannot get up' → CRITICAL / FALL (immediate danger).\n"
    "4. 'I forgot to take my medicine' → MEDIUM / MEDICATION.\n"
    "5. 'I have been feeling dizzy since morning' → MEDIUM / MEDICAL.\n"
    "6. 'I want to die / I don't want to live anymore' → HIGH or CRITICAL / SELF_HARM.\n"
    "7. 'I had dosa for breakfast' / 'My daughter called me' → LOW / NONE.\n"
    "8. DO NOT classify ordinary conversation, greetings, or family mentions as a risk.\n"
    "9. DO NOT make medical diagnoses. Use phrases like 'possible concern' or 'may need attention'.\n"
    "10. If there is NO meaningful risk, return LOW / NONE.\n\n"

    "OUTPUT FORMAT — return ONLY this JSON and nothing else:\n"
    '{"risk_level": "LOW", "category": "NONE", "reason": "", "requires_attention": false}\n\n'

    "requires_attention must be true for MEDIUM, HIGH, and CRITICAL levels.\n"
    "requires_attention must be false for LOW / NONE.\n"
    "reason must be a short plain-English explanation (1-2 sentences max) or empty string for LOW/NONE.\n"
)


def _call_risk_llm(transcript: str) -> str:
    """
    Send the risk-detection prompt to Ollama and return the raw response string.
    Raises on network or parse errors — caller handles them.
    """
    endpoint = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": RISK_SYSTEM_PROMPT},
            {"role": "user",   "content": f'Elderly person said: "{transcript}"'},
        ],
        "stream": False,
        "format": "json",          # instruct Ollama to enforce JSON output
        "options": {
            "temperature": 0.1,    # low temperature = consistent, factual output
            "num_predict": 120,    # risk output is short; cap tokens
        },
    }

    body = json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(
        endpoint,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=RISK_LLM_TIMEOUT) as response:
        raw = response.read().decode("utf-8")

    data    = json.loads(raw)
    content = data.get("message", {}).get("content", "").strip()
    return content


def _clean_json(text: str) -> str:
    """Strip markdown code fences if the LLM wraps the JSON in them."""
    t = text.strip()
    if t.startswith("```"):
        lines = t.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines).strip()
    return t


def _validate_risk_result(data: dict) -> Dict:
    """
    Validate and sanitize the dict parsed from LLM JSON.
    Returns a clean, guaranteed-safe risk dict.
    """
    # risk_level
    risk_level = str(data.get("risk_level", "LOW")).strip().upper()
    if risk_level not in ALLOWED_RISK_LEVELS:
        risk_level = "LOW"

    # category
    category = str(data.get("category", "NONE")).strip().upper()
    if category not in ALLOWED_CATEGORIES:
        category = "OTHER" if risk_level != "LOW" else "NONE"

    # reason — keep it short and safe
    reason = str(data.get("reason", "")).strip()
    if len(reason) > 300:
        reason = reason[:300]

    # requires_attention — must be True for MEDIUM/HIGH/CRITICAL, False for LOW
    if risk_level == "LOW":
        requires_attention = False
        category = "NONE" if category == "NONE" else category
    else:
        requires_attention = True

    return {
        "risk_level":         risk_level,
        "category":           category,
        "reason":             reason,
        "requires_attention": requires_attention,
    }


def parse_risk_response(raw_output: str) -> Dict:
    """
    Parse the LLM's JSON output and validate it.
    Returns SAFE_DEFAULT on any parse failure.
    """
    if not raw_output or not raw_output.strip():
        return dict(SAFE_DEFAULT)

    cleaned = _clean_json(raw_output)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"[RiskDetector] JSON parse error: {e}. Raw: {cleaned[:120]}", flush=True)
        return dict(SAFE_DEFAULT)

    if not isinstance(data, dict):
        return dict(SAFE_DEFAULT)

    return _validate_risk_result(data)


def analyze_risk(transcript: str, conversation_context: Optional[str] = None) -> Dict:
    """
    Main public interface for Stage 9 risk detection.

    Args:
        transcript          : The user's STT transcript.
        conversation_context: Optional short context string (unused by the LLM
                              prompt for now; kept for future extensibility).

    Returns:
        A dict with keys: risk_level, category, reason, requires_attention.
        Always returns a valid dict — never raises.
    """
    if not transcript or not transcript.strip():
        print("[RiskDetector] Empty transcript — returning LOW/NONE default.", flush=True)
        return dict(SAFE_DEFAULT)

    print(f"[RiskDetector] Analyzing transcript for risk: '{transcript[:80]}'", flush=True)

    try:
        raw = _call_risk_llm(transcript)
        result = parse_risk_response(raw)
        print(
            f"[RiskDetector] Result: level={result['risk_level']} "
            f"category={result['category']} "
            f"requires_attention={result['requires_attention']}",
            flush=True,
        )
        return result

    except Exception as exc:
        # Never let risk detection crash the main pipeline
        print(f"[RiskDetector] Error during risk analysis (non-fatal): {exc}", flush=True)
        traceback.print_exc(file=sys.stdout)
        sys.stdout.flush()
        return dict(SAFE_DEFAULT)
