"""
backend/test_risk_detection.py

Stage 9 — Elder Safety & Risk Detection Tests.

Tests:
 1.  Normal conversation         -> LOW / NONE
 2.  Missed medication           -> MEDIUM / MEDICATION
 3.  Medical concern (dizziness) -> MEDIUM / MEDICAL
 4.  Fall but okay               -> MEDIUM / FALL
 5.  Cannot get up after fall    -> CRITICAL
 6.  Self-harm statement         -> HIGH or CRITICAL / SELF_HARM
 7.  Family mention              -> LOW / NONE
 8.  Malformed LLM JSON          -> SAFE_DEFAULT (no crash)
 9.  Empty transcript            -> SAFE_DEFAULT
10.  Risk detector failure       -> does NOT break main response
11.  SafetyEvent is persisted    -> DB record created
12.  LOW/NONE conversation       -> NO SafetyEvent created
13.  HIGH/CRITICAL               -> SafetyEvent created
14.  User isolation              -> events scoped to correct user_identifier
15.  Stage 7 conversation memory -> still passes
16.  Stage 8.1 user memory       -> still passes
17.  Stage 8.2 memory context    -> still passes (unit-level only)
18.  Stage 8.3 extraction        -> still passes (unit-level only)

For LLM-dependent risk classification tests (tests 1-7) we call the live Ollama
server so the results are realistic.  Tests 8-14 are fully deterministic and do
not require Ollama.

Run with:
    venv\\Scripts\\python.exe test_risk_detection.py
"""

import sys
import os
import json

# ── Django setup ───────────────────────────────────────────────────────────────
sys.path.insert(0, ".")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

# ── Imports ────────────────────────────────────────────────────────────────────
from voice.models import SafetyEvent, UserMemory
from voice.services.risk_detector import (
    analyze_risk,
    parse_risk_response,
    SAFE_DEFAULT,
    ALLOWED_RISK_LEVELS,
    ALLOWED_CATEGORIES,
)
from voice.services.memory_store import clear_memories, create_memory, list_memories
from voice.services.memory import generate_session_id, add_conversation_turn, get_conversation_history, clear_session


# ── Helpers ────────────────────────────────────────────────────────────────────

def _clear_safety_events(user_identifier: str):
    SafetyEvent.objects.filter(user_identifier=user_identifier).delete()


def _assert_risk(result: dict, expected_level: str, *, attention: bool, allowed_categories=None):
    """Helper: assert risk_level, requires_attention, and optionally category."""
    assert result["risk_level"] == expected_level, (
        f"Expected risk_level={expected_level}, got {result['risk_level']!r}. Full result: {result}"
    )
    assert result["requires_attention"] is attention, (
        f"Expected requires_attention={attention}, got {result['requires_attention']}. Full result: {result}"
    )
    if allowed_categories:
        assert result["category"] in allowed_categories, (
            f"Expected category in {allowed_categories}, got {result['category']!r}. Full result: {result}"
        )
    # Always sanity-check the values are in allowed sets
    assert result["risk_level"] in ALLOWED_RISK_LEVELS
    assert result["category"] in ALLOWED_CATEGORIES


# ══════════════════════════════════════════════════════════════════════════════
# TESTS 1-7: LLM-dependent (live Ollama)
# ══════════════════════════════════════════════════════════════════════════════

def test_01_normal_conversation():
    print("=== TEST 1: Normal conversation -> LOW/NONE ===")
    result = analyze_risk("I had dosa for breakfast.")
    print(f"  Result: {result}")
    _assert_risk(result, "LOW", attention=False, allowed_categories=["NONE"])
    print("  SUCCESS — TEST 1 Passed\n")


def test_02_missed_medication():
    print("=== TEST 2: Missed medication -> MEDIUM/MEDICATION ===")
    result = analyze_risk("I forgot to take my morning medicine.")
    print(f"  Result: {result}")
    _assert_risk(result, "MEDIUM", attention=True, allowed_categories=["MEDICATION"])
    print("  SUCCESS — TEST 2 Passed\n")


def test_03_medical_concern():
    print("=== TEST 3: Medical concern -> MEDIUM/MEDICAL ===")
    result = analyze_risk("I have been feeling dizzy since morning.")
    print(f"  Result: {result}")
    _assert_risk(result, "MEDIUM", attention=True, allowed_categories=["MEDICAL"])
    print("  SUCCESS — TEST 3 Passed\n")


def test_04_fall_but_okay():
    print("=== TEST 4: Fall but okay -> MEDIUM/FALL (not CRITICAL) ===")
    result = analyze_risk("I fell down yesterday but I am okay now.")
    print(f"  Result: {result}")
    # Must NOT be CRITICAL — user is currently safe
    assert result["risk_level"] in ("MEDIUM", "HIGH"), (
        f"Expected MEDIUM or HIGH for a past fall, got {result['risk_level']}"
    )
    assert result["category"] in ("FALL", "MEDICAL", "OTHER"), (
        f"Unexpected category: {result['category']}"
    )
    assert result["requires_attention"] is True
    print("  SUCCESS — TEST 4 Passed\n")


def test_05_cannot_get_up():
    print("=== TEST 5: Cannot get up after fall -> CRITICAL ===")
    result = analyze_risk("I fell down and I can't get up. Please help me.")
    print(f"  Result: {result}")
    assert result["risk_level"] == "CRITICAL", (
        f"Expected CRITICAL for 'cannot get up after fall', got {result['risk_level']}"
    )
    assert result["requires_attention"] is True
    assert result["category"] in ("FALL", "EMERGENCY")
    print("  SUCCESS — TEST 5 Passed\n")


def test_06_self_harm():
    print("=== TEST 6: Self-harm statement -> HIGH or CRITICAL / SELF_HARM ===")
    result = analyze_risk("I want to die. I don't want to live anymore.")
    print(f"  Result: {result}")
    assert result["risk_level"] in ("HIGH", "CRITICAL"), (
        f"Expected HIGH or CRITICAL for self-harm statement, got {result['risk_level']}"
    )
    assert result["requires_attention"] is True
    assert result["category"] in ("SELF_HARM", "EMERGENCY", "EMOTIONAL_DISTRESS")
    print("  SUCCESS — TEST 6 Passed\n")


def test_07_family_mention():
    print("=== TEST 7: Family mention -> LOW/NONE ===")
    result = analyze_risk("My daughter called me this morning. We had a lovely chat.")
    print(f"  Result: {result}")
    _assert_risk(result, "LOW", attention=False, allowed_categories=["NONE"])
    print("  SUCCESS — TEST 7 Passed\n")


# ══════════════════════════════════════════════════════════════════════════════
# TESTS 8-14: Deterministic — do NOT require Ollama
# ══════════════════════════════════════════════════════════════════════════════

def test_08_malformed_llm_json():
    print("=== TEST 8: Malformed LLM JSON -> SAFE_DEFAULT, no crash ===")
    bad_cases = [
        "not json at all",
        "{bad json: true}",
        json.dumps({"wrong_key": "value"}),
        json.dumps({"risk_level": "EXTREME", "category": "NONE", "reason": "", "requires_attention": False}),
        json.dumps({"risk_level": "MEDIUM", "category": "INVALID_CAT", "reason": "test", "requires_attention": True}),
        "",
        "   ",
    ]
    for bad in bad_cases:
        result = parse_risk_response(bad)
        assert isinstance(result, dict), "parse_risk_response must always return a dict"
        assert result["risk_level"] in ALLOWED_RISK_LEVELS
        assert result["category"] in ALLOWED_CATEGORIES
        assert isinstance(result["requires_attention"], bool)
        print(f"  Bad input handled safely: {bad[:40]!r} -> {result['risk_level']}/{result['category']}")
    print("  SUCCESS — TEST 8 Passed\n")


def test_09_empty_transcript():
    print("=== TEST 9: Empty transcript -> SAFE_DEFAULT ===")
    for empty in ["", "   ", None]:
        result = analyze_risk(empty)
        assert result["risk_level"] == "LOW"
        assert result["category"] == "NONE"
        assert result["requires_attention"] is False
    print("  SUCCESS — TEST 9 Passed\n")


def test_10_risk_failure_does_not_break_pipeline():
    """
    Simulate what happens if analyze_risk raises an unexpected exception.
    The view wraps it in try/except, so the main response must still return.
    We test this at the service level: the function itself returns SAFE_DEFAULT on errors.
    """
    print("=== TEST 10: Risk detector failure -> SAFE_DEFAULT, no exception ===")
    # Patch _call_risk_llm to raise an error
    import voice.services.risk_detector as rd

    original_call = rd._call_risk_llm

    def _explode(transcript):
        raise ConnectionError("Simulated Ollama unavailable")

    rd._call_risk_llm = _explode
    try:
        result = analyze_risk("I feel unwell.")
    finally:
        rd._call_risk_llm = original_call  # restore

    assert result["risk_level"] == "LOW"
    assert result["requires_attention"] is False
    print(f"  analyze_risk returned safely: {result}")
    print("  SUCCESS — TEST 10 Passed\n")


def test_11_safety_event_persisted():
    print("=== TEST 11: SafetyEvent is persisted when requires_attention=True ===")
    uid = "test_safety_user_a"
    _clear_safety_events(uid)

    SafetyEvent.objects.create(
        user_identifier=uid,
        risk_level="MEDIUM",
        category="MEDICATION",
        reason="User forgot medication.",
        relevant_text="I forgot to take my medicine.",
        status="NEW",
    )

    events = SafetyEvent.objects.filter(user_identifier=uid)
    assert events.count() == 1
    ev = events.first()
    assert ev.risk_level == "MEDIUM"
    assert ev.category == "MEDICATION"
    assert ev.status == "NEW"
    assert "forgot" in ev.relevant_text

    _clear_safety_events(uid)
    print("  SUCCESS — TEST 11 Passed\n")


def test_12_low_none_no_event():
    print("=== TEST 12: LOW/NONE conversation does NOT create SafetyEvent ===")
    uid = "test_safety_user_b"
    _clear_safety_events(uid)

    # Simulate what the view does: only persist when requires_attention is True
    risk = {"risk_level": "LOW", "category": "NONE", "reason": "", "requires_attention": False}
    if risk.get("requires_attention"):
        SafetyEvent.objects.create(user_identifier=uid, risk_level=risk["risk_level"],
                                   category=risk["category"], reason="", relevant_text="", status="NEW")

    count = SafetyEvent.objects.filter(user_identifier=uid).count()
    assert count == 0, f"Expected 0 SafetyEvent records for LOW/NONE, got {count}"

    _clear_safety_events(uid)
    print("  SUCCESS — TEST 12 Passed\n")


def test_13_high_critical_creates_event():
    print("=== TEST 13: HIGH/CRITICAL creates SafetyEvent ===")
    uid = "test_safety_user_c"
    _clear_safety_events(uid)

    for level, cat in [("HIGH", "SELF_HARM"), ("CRITICAL", "FALL")]:
        risk = {"risk_level": level, "category": cat, "reason": f"Test {level}", "requires_attention": True}
        if risk.get("requires_attention"):
            SafetyEvent.objects.create(
                user_identifier=uid,
                risk_level=risk["risk_level"],
                category=risk["category"],
                reason=risk["reason"],
                relevant_text="test transcript",
                status="NEW",
            )

    events = SafetyEvent.objects.filter(user_identifier=uid)
    assert events.count() == 2, f"Expected 2 SafetyEvent records, got {events.count()}"
    levels = {e.risk_level for e in events}
    assert "HIGH" in levels and "CRITICAL" in levels

    _clear_safety_events(uid)
    print("  SUCCESS — TEST 13 Passed\n")


def test_14_user_isolation():
    print("=== TEST 14: User isolation — events never cross between users ===")
    uid_a = "test_isolation_user_a"
    uid_b = "test_isolation_user_b"
    _clear_safety_events(uid_a)
    _clear_safety_events(uid_b)

    SafetyEvent.objects.create(user_identifier=uid_a, risk_level="HIGH",
                               category="SELF_HARM", reason="A's event",
                               relevant_text="A said something", status="NEW")
    SafetyEvent.objects.create(user_identifier=uid_b, risk_level="MEDIUM",
                               category="MEDICATION", reason="B's event",
                               relevant_text="B said something", status="NEW")

    a_events = list(SafetyEvent.objects.filter(user_identifier=uid_a))
    b_events = list(SafetyEvent.objects.filter(user_identifier=uid_b))

    assert len(a_events) == 1 and a_events[0].risk_level == "HIGH"
    assert len(b_events) == 1 and b_events[0].risk_level == "MEDIUM"

    # Cross-user fetch must return nothing
    assert SafetyEvent.objects.filter(user_identifier=uid_a, reason="B's event").count() == 0
    assert SafetyEvent.objects.filter(user_identifier=uid_b, reason="A's event").count() == 0

    _clear_safety_events(uid_a)
    _clear_safety_events(uid_b)
    print("  User isolation verified: A and B events stay separate.")
    print("  SUCCESS — TEST 14 Passed\n")


# ══════════════════════════════════════════════════════════════════════════════
# TESTS 15-18: Regression — existing stages still work
# ══════════════════════════════════════════════════════════════════════════════

def test_15_stage7_conversation_memory():
    print("=== TEST 15: Stage 7 — Short-term conversation memory still works ===")
    sess = generate_session_id()
    add_conversation_turn(sess, "Hello Bhavi.", "Hello! How can I help you today?")
    hist = get_conversation_history(sess)
    assert len(hist) == 2
    assert hist[0]["role"] == "user" and "Hello Bhavi" in hist[0]["content"]
    assert hist[1]["role"] == "assistant"
    clear_session(sess)
    print("  SUCCESS — TEST 15 Passed\n")


def test_16_stage81_user_memory():
    print("=== TEST 16: Stage 8.1 — Persistent UserMemory still works ===")
    uid = "regression_test_user"
    clear_memories(user_identifier=uid)
    m = create_memory(key="city", value="Chennai", memory_type="lifestyle", user_identifier=uid)
    assert m.id is not None
    mems = list_memories(user_identifier=uid)
    assert len(mems) == 1 and mems[0].value == "Chennai"
    clear_memories(user_identifier=uid)
    print("  SUCCESS — TEST 16 Passed\n")


def test_17_stage82_memory_context():
    print("=== TEST 17: Stage 8.2 — Memory context formatting still works ===")
    from voice.services.memory_store import format_memories_for_prompt, get_relevant_memories
    uid = "regression_context_user"
    clear_memories(user_identifier=uid)
    create_memory(key="daughter_name", value="Priya", memory_type="family", user_identifier=uid)
    mems = get_relevant_memories(user_identifier=uid, transcript="What is my daughter's name?")
    assert len(mems) >= 1
    context = format_memories_for_prompt(mems)
    assert "Priya" in context
    clear_memories(user_identifier=uid)
    print("  SUCCESS — TEST 17 Passed\n")


def test_18_stage83_extraction():
    print("=== TEST 18: Stage 8.3 — parse_and_validate_extraction still works ===")
    from voice.services.memory_extractor import parse_and_validate_extraction
    good_json = json.dumps({"memories": [{"memory_type": "family", "key": "son_name", "value": "Arun"}]})
    result = parse_and_validate_extraction(good_json)
    assert len(result) == 1
    assert result[0]["key"] == "son_name"
    assert result[0]["value"] == "Arun"
    bad_json = "not valid json"
    result_bad = parse_and_validate_extraction(bad_json)
    assert result_bad == []
    print("  SUCCESS — TEST 18 Passed\n")


# ══════════════════════════════════════════════════════════════════════════════
# Main runner
# ══════════════════════════════════════════════════════════════════════════════

def run_all_tests():
    print("=" * 70)
    print("STAGE 9 — ELDER SAFETY & RISK DETECTION TEST SUITE")
    print("=" * 70)
    print()

    print("--- LLM-Dependent Tests (requires Ollama) ---\n")
    test_01_normal_conversation()
    test_02_missed_medication()
    test_03_medical_concern()
    test_04_fall_but_okay()
    test_05_cannot_get_up()
    test_06_self_harm()
    test_07_family_mention()

    print("--- Deterministic Tests (no Ollama needed) ---\n")
    test_08_malformed_llm_json()
    test_09_empty_transcript()
    test_10_risk_failure_does_not_break_pipeline()
    test_11_safety_event_persisted()
    test_12_low_none_no_event()
    test_13_high_critical_creates_event()
    test_14_user_isolation()

    print("--- Regression Tests (existing stages) ---\n")
    test_15_stage7_conversation_memory()
    test_16_stage81_user_memory()
    test_17_stage82_memory_context()
    test_18_stage83_extraction()

    print("=" * 70)
    print("ALL STAGE 9 TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_all_tests()

