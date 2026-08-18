"""
backend/voice/services/llm.py

LLM service for SeniorMind — Bhavi's AI response layer.

Current provider: Ollama (local, free, no API key required).
To switch providers in the future, only this file needs to change.
The public interface `generate_bhavi_response(transcript, conversation_history)` stays the same.
"""

import json
import os
import sys
import traceback
import urllib.error
import urllib.request
from typing import Dict, List, Optional

# ── Configuration ─────────────────────────────────────────────────────────────
# All values can be overridden via environment variables.
# Sensible local-development defaults are provided.

LLM_PROVIDER     = os.environ.get("LLM_PROVIDER",     "ollama")
LLM_MODEL        = os.environ.get("LLM_MODEL",        "llama3.2:3b")
OLLAMA_BASE_URL  = os.environ.get("OLLAMA_BASE_URL",  "http://localhost:11434")
LLM_TIMEOUT      = int(os.environ.get("LLM_TIMEOUT_SECONDS", "60"))

# ── Bhavi system prompt ───────────────────────────────────────────────────────
# Bhavi is a warm, caring voice assistant for senior citizens.
# Responses will eventually be spoken aloud, so they must sound natural.
BHAVI_SYSTEM_PROMPT = (
    "You are Bhavi, a warm and caring voice assistant designed specifically for senior citizens.\n\n"
    "Your guidelines:\n"
    "- Respond in a friendly, warm, and respectful tone.\n"
    "- Use simple, clear language. Avoid all technical jargon.\n"
    "- Keep your responses SHORT — normally 1 to 3 sentences only.\n"
    "- Responses must sound natural when read aloud.\n"
    "- Do NOT overwhelm the person with too much information at once.\n"
    "- Ask one simple follow-up question when it feels natural and helpful.\n"
    "- Do NOT pretend to be a doctor or give medical diagnoses.\n"
    "- Do NOT invent personal details about the person you are talking to.\n"
    "- If you are unsure about something, gently say so.\n"
    "- Always be encouraging, patient, and positive."
)


# ── Ollama provider ───────────────────────────────────────────────────────────

def _call_ollama(transcript: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> str:
    """
    Call the local Ollama /api/chat endpoint with the Bhavi system prompt and conversation history.
    Uses only Python's stdlib urllib — no extra packages needed.
    """
    endpoint = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"

    # Build structured messages payload: System prompt + History + Current User Message
    messages = [{"role": "system", "content": BHAVI_SYSTEM_PROMPT}]

    if conversation_history:
        # Include previous user and assistant turns
        messages.extend(conversation_history)

    messages.append({"role": "user", "content": transcript})

    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "stream": False,         # receive full response at once
        "options": {
            "temperature": 0.7,
            "num_predict": 200,  # cap token output for short answers
        },
    }

    body = json.dumps(payload).encode("utf-8")
    req  = urllib.request.Request(
        endpoint,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    history_len = len(conversation_history) if conversation_history else 0
    print(
        f"[LLM] Sending prompt + {history_len} history turn(s) to Ollama "
        f"({OLLAMA_BASE_URL}, model={LLM_MODEL})",
        flush=True
    )

    try:
        with urllib.request.urlopen(req, timeout=LLM_TIMEOUT) as response:
            raw = response.read().decode("utf-8")

    except urllib.error.URLError as url_err:
        cause = str(url_err.reason) if hasattr(url_err, "reason") else str(url_err)
        raise ConnectionError(
            f"Cannot reach Ollama at {OLLAMA_BASE_URL}. "
            f"Is Ollama running? Details: {cause}"
        ) from url_err

    except TimeoutError:
        raise TimeoutError(
            f"Ollama request timed out after {LLM_TIMEOUT}s. "
            "The model may still be loading — try again in a moment."
        )

    # Parse response
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as json_err:
        raise ValueError(f"Ollama returned invalid JSON: {raw[:200]}") from json_err

    # Validate structure
    if "error" in data:
        raise RuntimeError(f"Ollama returned an error: {data['error']}")

    try:
        content = data["message"]["content"].strip()
    except (KeyError, TypeError) as parse_err:
        raise ValueError(
            f"Unexpected Ollama response structure: {raw[:300]}"
        ) from parse_err

    if not content:
        raise ValueError("Ollama returned an empty response.")

    return content


# ── Public interface ──────────────────────────────────────────────────────────

def generate_bhavi_response(
    transcript: str,
    conversation_history: Optional[List[Dict[str, str]]] = None
) -> str:
    """
    Send the STT transcript and optional conversation history to the configured LLM provider
    and return Bhavi's response as a plain string.

    Raises:
        ConnectionError  — if Ollama (or cloud provider) is unreachable.
        TimeoutError     — if the request times out.
        RuntimeError     — for configuration or provider-level errors.
        ValueError       — if the response cannot be parsed.
    """
    print("[LLM] Generating Bhavi response...", flush=True)

    provider = LLM_PROVIDER.lower()

    if provider == "ollama":
        try:
            response_text = _call_ollama(transcript, conversation_history)
            print("[LLM] Response received from Ollama", flush=True)
            return response_text
        except (ConnectionError, TimeoutError, RuntimeError, ValueError):
            raise
        except Exception as exc:
            print(f"[LLM] Unexpected error from Ollama: {type(exc).__name__}: {exc}", flush=True)
            traceback.print_exc(file=sys.stdout)
            sys.stdout.flush()
            raise

    else:
        raise RuntimeError(
            f"[LLM] Unknown provider: '{LLM_PROVIDER}'. "
            "Set LLM_PROVIDER=ollama (or another supported provider)."
        )
