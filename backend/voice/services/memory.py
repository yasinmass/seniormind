"""
backend/voice/services/memory.py

In-memory short-term conversation memory service for SeniorMind — Bhavi's session layer.

Features:
- In-process dictionary for storing conversation turns per session ID.
- Cap history size to max 10 messages (5 turns: user + assistant) to stay within context windows.
- Inactive session expiration (TTL = 3600 seconds / 60 minutes).
- Automatic session creation and ID generation.
- Graceful error handling (never crashes the voice pipeline).
"""

import time
import uuid
from typing import Dict, List, Optional

# ── Configuration ─────────────────────────────────────────────────────────────
MAX_HISTORY_MESSAGES = 10   # 5 user messages + 5 assistant messages
SESSION_TTL_SECONDS  = 3600 # 60 minutes of inactivity

# In-memory store:
# {
#   "session_id": {
#       "messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
#       "last_accessed": 1712345678.9
#   }
# }
_sessions: Dict[str, Dict] = {}


def generate_session_id() -> str:
    """Generate a clean, unique session identifier."""
    return f"session-{uuid.uuid4().hex[:12]}"


def cleanup_expired_sessions() -> None:
    """Purge sessions that have been inactive longer than SESSION_TTL_SECONDS."""
    now = time.time()
    expired_keys = [
        sid for sid, data in _sessions.items()
        if now - data.get("last_accessed", 0) > SESSION_TTL_SECONDS
    ]
    for sid in expired_keys:
        del _sessions[sid]
        print(f"[Memory] Purged expired session: {sid}", flush=True)


def get_conversation_history(conversation_id: Optional[str]) -> List[Dict[str, str]]:
    """
    Retrieve message history for a given conversation_id.
    Returns a copy of the list of message objects:
    [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    """
    if not conversation_id or not isinstance(conversation_id, str):
        return []

    cleanup_expired_sessions()

    session = _sessions.get(conversation_id)
    if not session:
        return []

    session["last_accessed"] = time.time()
    # Return shallow copy of messages list
    return list(session.get("messages", []))


def add_conversation_turn(conversation_id: str, user_text: str, assistant_text: str) -> None:
    """
    Append a user message and assistant message pair to the specified session history.
    Trims history to MAX_HISTORY_MESSAGES if exceeded.
    """
    if not conversation_id or not isinstance(conversation_id, str):
        return

    cleanup_expired_sessions()

    now = time.time()
    if conversation_id not in _sessions:
        _sessions[conversation_id] = {
            "messages": [],
            "last_accessed": now
        }

    session = _sessions[conversation_id]
    session["last_accessed"] = now
    messages = session["messages"]

    if user_text and user_text.strip():
        messages.append({"role": "user", "content": user_text.strip()})

    if assistant_text and assistant_text.strip():
        messages.append({"role": "assistant", "content": assistant_text.strip()})

    # Enforce maximum history length (keep latest N messages)
    if len(messages) > MAX_HISTORY_MESSAGES:
        trimmed_count = len(messages) - MAX_HISTORY_MESSAGES
        session["messages"] = messages[-MAX_HISTORY_MESSAGES:]
        print(
            f"[Memory] Session {conversation_id}: trimmed {trimmed_count} oldest message(s). "
            f"Active history count: {len(session['messages'])}",
            flush=True
        )
    else:
        print(
            f"[Memory] Session {conversation_id}: updated history count: {len(session['messages'])}",
            flush=True
        )


def clear_session(conversation_id: str) -> None:
    """Clear memory for a specific session ID."""
    if conversation_id in _sessions:
        del _sessions[conversation_id]
        print(f"[Memory] Cleared session: {conversation_id}", flush=True)


def get_active_session_count() -> int:
    """Return count of active in-memory sessions."""
    cleanup_expired_sessions()
    return len(_sessions)
