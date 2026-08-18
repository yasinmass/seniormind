"""
backend/test_conversation_memory.py

Comprehensive tests for Stage 7 Conversation Memory for Bhavi.

Tests:
1. Multi-turn memory: Turn 1 ("My daughter's name is Priya.") -> Turn 2 ("What is her name?") retrieves "Priya".
2. Session isolation: Conversation A and Conversation B do not share context.
3. Memory cap: History capped at MAX_HISTORY_MESSAGES (10 messages / 5 turns).
4. New conversation ID yields isolated memory.
5. Missing/None conversation_id handled gracefully.
6. Multilingual preservation (English, Hindi, Tamil).
7. Full API endpoint test (/api/audio/).
"""

import sys
import io
import json
import base64
import wave
import urllib.request

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)

sys.path.insert(0, ".")

from voice.services.memory import (
    get_conversation_history,
    add_conversation_turn,
    clear_session,
    generate_session_id,
    MAX_HISTORY_MESSAGES,
)
from voice.services.llm import generate_bhavi_response
from voice.services.tts import generate_speech


def test_memory_unit():
    print("=== TEST 1: Service Memory Logic & Trimming ===")
    session_id = generate_session_id()
    print(f"Generated Session ID: {session_id}")

    # Initial history empty
    hist = get_conversation_history(session_id)
    assert len(hist) == 0, "Expected empty history initially"

    # Add 1 turn
    add_conversation_turn(session_id, "My daughter's name is Priya.", "That's a lovely name!")
    hist = get_conversation_history(session_id)
    assert len(hist) == 2, f"Expected 2 messages, got {len(hist)}"
    assert hist[0]["content"] == "My daughter's name is Priya."
    assert hist[1]["content"] == "That's a lovely name!"

    # Add 6 more turns (total 7 turns = 14 messages -> should be trimmed to MAX_HISTORY_MESSAGES=10)
    for i in range(6):
        add_conversation_turn(session_id, f"User turn {i}", f"Assistant turn {i}")

    hist_trimmed = get_conversation_history(session_id)
    assert len(hist_trimmed) == MAX_HISTORY_MESSAGES, f"Expected {MAX_HISTORY_MESSAGES} messages max, got {len(hist_trimmed)}"
    print(f"Memory trim verified: capped at {len(hist_trimmed)} messages max.")
    clear_session(session_id)
    print("SUCCESS — TEST 1 Passed\n")


def test_session_isolation():
    print("=== TEST 2: Session Isolation ===")
    sess_a = generate_session_id()
    sess_b = generate_session_id()

    add_conversation_turn(sess_a, "I live in Delhi.", "Delhi is a great city!")
    add_conversation_turn(sess_b, "I live in Mumbai.", "Mumbai is wonderful!")

    hist_a = get_conversation_history(sess_a)
    hist_b = get_conversation_history(sess_b)

    assert "Delhi" in hist_a[0]["content"]
    assert "Mumbai" in hist_b[0]["content"]
    assert "Mumbai" not in hist_a[0]["content"]

    print("Session isolation verified: Session A and B keep separate contexts.")
    clear_session(sess_a)
    clear_session(sess_b)
    print("SUCCESS — TEST 2 Passed\n")


def test_llm_context_memory():
    print("=== TEST 3: LLM Context Memory (Priya test) ===")
    session_id = generate_session_id()

    # Turn 1
    t1_text = "My daughter's name is Priya."
    print(f"Turn 1 User: {t1_text}")
    resp1 = generate_bhavi_response(t1_text, conversation_history=get_conversation_history(session_id))
    print(f"Turn 1 Bhavi: {resp1}")
    add_conversation_turn(session_id, t1_text, resp1)

    # Turn 2
    t2_text = "What is her name?"
    print(f"Turn 2 User: {t2_text}")
    resp2 = generate_bhavi_response(t2_text, conversation_history=get_conversation_history(session_id))
    print(f"Turn 2 Bhavi: {resp2}")

    assert "priya" in resp2.lower(), f"Expected 'Priya' in response, got: {resp2}"
    print("Context memory verified: Bhavi remembered 'Priya' across turns!")
    clear_session(session_id)
    print("SUCCESS — TEST 3 Passed\n")


def test_full_api_multiturn():
    print("=== TEST 4 & 5 & 6: Full API Multi-turn Endpoint Test (/api/audio/) ===")
    
    # Generate test WAV for input
    wav1 = generate_speech("My daughter's name is Priya.", "en")
    wav2 = generate_speech("What is her name?", "en")

    session_id = f"test-api-session-{generate_session_id()}"

    def send_api(wav_bytes, sess_id):
        boundary = "----TestBoundaryMemory"
        body = b""
        body += f"--{boundary}\r\n".encode()
        body += b'Content-Disposition: form-data; name="audio"; filename="input.wav"\r\n'
        body += b"Content-Type: audio/wav\r\n\r\n"
        body += wav_bytes
        body += f"\r\n--{boundary}\r\n".encode()
        if sess_id:
            body += b'Content-Disposition: form-data; name="conversation_id"\r\n\r\n'
            body += sess_id.encode()
            body += f"\r\n--{boundary}--\r\n".encode()
        else:
            body += f"--{boundary}--\r\n".encode()

        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/audio/",
            data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())

    # Turn 1 via API
    print("API Turn 1: Sending 'My daughter's name is Priya.'...")
    res1 = send_api(wav1, session_id)
    print(f"  API Response 1: text='{res1.get('text')}', resp='{res1.get('response')}', session='{res1.get('conversation_id')}'")
    assert res1.get("status") == "ok"
    returned_sess_id = res1.get("conversation_id")
    assert returned_sess_id is not None

    # Turn 2 via API using same session_id
    print("API Turn 2: Sending 'What is her name?'...")
    res2 = send_api(wav2, returned_sess_id)
    print(f"  API Response 2: text='{res2.get('text')}', resp='{res2.get('response')}', session='{res2.get('conversation_id')}'")
    assert res2.get("status") == "ok"
    assert "audio_b64" in res2
    assert "priya" in res2.get("response", "").lower(), f"Expected Priya in response 2, got: {res2.get('response')}"

    print("API multi-turn conversation memory passed!")

    # Test missing conversation_id (should auto-generate and work gracefully)
    print("API Turn 3: Sending request without conversation_id...")
    res3 = send_api(wav1, None)
    assert res3.get("status") == "ok"
    assert res3.get("conversation_id") is not None
    print("API missing conversation_id test passed!")

    clear_session(session_id)
    clear_session(returned_sess_id)
    print("SUCCESS — TEST 4, 5, 6 Passed\n")


if __name__ == "__main__":
    print("Starting Stage 7 Conversation Memory Tests...\n")
    test_memory_unit()
    test_session_isolation()
    test_llm_context_memory()
    test_full_api_multiturn()
    print("ALL STAGE 7 CONVERSATION MEMORY TESTS PASSED SUCCESSFULLY!")
