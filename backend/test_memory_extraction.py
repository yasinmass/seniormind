"""
backend/test_memory_extraction.py

Dedicated test suite for Stage 8.3: Automatic Persistent Memory Extraction.

Tests:
1. Extract a new memory from user statement.
2. Save the extracted memory to UserMemory.
3. Update an existing memory on correction.
4. Do not create duplicates (upsert verification).
5. Ignore conversation with no useful memory (fluff / questions / temporary states).
6. Strict user isolation (Alice vs Bob).
7. Invalid / malformed LLM output does not crash or corrupt database.
8. Empty / blank input handling.
9. Multiple useful memories handled safely and capped.
10. Existing Stage 8.2 memory retrieval still works with extracted memories.
11. Existing short-term conversation memory still works alongside extraction.
12. Sensitive keyword safety filter rejection.
"""

import sys
import os
import json

# Setup Django environment
sys.path.insert(0, ".")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from voice.models import UserMemory
from voice.services.memory_store import (
    clear_memories,
    list_memories,
    get_relevant_memories,
    format_memories_for_prompt,
)
from voice.services.memory import (
    generate_session_id,
    add_conversation_turn,
    get_conversation_history,
    clear_session,
)
from voice.services.memory_extractor import (
    parse_and_validate_extraction,
    validate_single_memory,
    extract_memories_from_text,
    persist_extracted_memories,
    extract_and_persist_memories,
)


def run_stage_8_3_tests():
    print("Starting Stage 8.3 Automatic Persistent Memory Extraction Tests...\n")

    # Clean up test users first
    clear_memories(user_identifier="test_alice")
    clear_memories(user_identifier="test_bob")

    # ── TEST 1: Extract a new memory ─────────────────────────────────────────
    print("=== TEST 1: Extract a New Memory ===")
    user_stmt = "My daughter's name is Priya."
    extracted = extract_memories_from_text(user_stmt)
    print(f"User: '{user_stmt}'")
    print(f"Extracted: {extracted}")
    assert len(extracted) >= 1, f"Expected at least 1 memory extracted, got: {extracted}"
    item = extracted[0]
    assert "daughter" in item["key"] or "daughter_name" in item["key"]
    assert "priya" in item["value"].lower()
    assert item["memory_type"] in ["family", "general"]
    print("SUCCESS — TEST 1 Passed\n")

    # ── TEST 2: Save the extracted memory to UserMemory ──────────────────────
    print("=== TEST 2: Save the Extracted Memory ===")
    saved = persist_extracted_memories(extracted, user_identifier="test_alice")
    assert len(saved) >= 1
    alice_mems = list_memories(user_identifier="test_alice")
    assert len(alice_mems) >= 1
    assert any("priya" in m.value.lower() for m in alice_mems)
    print(f"Saved into DB for test_alice: {alice_mems[0]}")
    print("SUCCESS — TEST 2 Passed\n")

    # ── TEST 3: Update an existing memory (correction) ───────────────────────
    print("=== TEST 3: Update an Existing Memory (Correction) ===")
    correction_stmt = "My daughter is actually called Ananya now."
    extracted_corr = extract_memories_from_text(correction_stmt)
    print(f"User correction: '{correction_stmt}'")
    print(f"Extracted correction: {extracted_corr}")
    assert len(extracted_corr) >= 1
    assert "ananya" in extracted_corr[0]["value"].lower()

    # Persist the update
    persist_extracted_memories(extracted_corr, user_identifier="test_alice")

    alice_mems_updated = list_memories(user_identifier="test_alice")
    daughter_mems = [m for m in alice_mems_updated if "daughter" in m.key]
    assert len(daughter_mems) == 1, f"Expected exactly 1 daughter memory record, found {len(daughter_mems)}"
    assert daughter_mems[0].value.lower() == "ananya", f"Expected 'Ananya', got: {daughter_mems[0].value}"
    print(f"Updated memory value verified: {daughter_mems[0].key} = {daughter_mems[0].value}")
    print("SUCCESS — TEST 3 Passed\n")

    # ── TEST 4: Do not create duplicates ─────────────────────────────────────
    print("=== TEST 4: Verify No Duplicates on Re-extraction ===")
    # Re-extract and re-persist identical statement
    persist_extracted_memories(extracted_corr, user_identifier="test_alice")
    alice_mems_check = list_memories(user_identifier="test_alice")
    daughter_mems_check = [m for m in alice_mems_check if "daughter" in m.key]
    assert len(daughter_mems_check) == 1, "Duplicate record was created!"
    print(f"Verified: exactly 1 record exists in DB for key '{daughter_mems_check[0].key}'.")
    print("SUCCESS — TEST 4 Passed\n")

    # ── TEST 5: Ignore conversation with no useful memory ────────────────────
    print("=== TEST 5: Ignore Conversations with No Useful Memory ===")
    fluff_statements = [
        "What is the weather today?",
        "Tell me a joke.",
        "I am bored right now.",
        "What time is it?",
        "Good morning Bhavi, how are you?",
    ]
    for stmt in fluff_statements:
        fluff_extracted = extract_memories_from_text(stmt)
        print(f"Testing fluff: '{stmt}' -> Extracted: {fluff_extracted}")
        assert len(fluff_extracted) == 0, f"Expected 0 memories for '{stmt}', got: {fluff_extracted}"

    print("SUCCESS — TEST 5 Passed\n")

    # ── TEST 6: Strict User Isolation (Alice vs Bob) ─────────────────────────
    print("=== TEST 6: Strict User Isolation (Alice vs Bob) ===")
    bob_stmt = "My daughter's name is Anjali."
    bob_extracted = extract_memories_from_text(bob_stmt)
    persist_extracted_memories(bob_extracted, user_identifier="test_bob")

    alice_final = list_memories(user_identifier="test_alice")
    bob_final = list_memories(user_identifier="test_bob")

    alice_daughter = [m for m in alice_final if "daughter" in m.key][0]
    bob_daughter = [m for m in bob_final if "daughter" in m.key][0]

    assert alice_daughter.value == "Ananya"
    assert bob_daughter.value == "Anjali"
    assert alice_daughter.user_identifier == "test_alice"
    assert bob_daughter.user_identifier == "test_bob"
    print(f"User isolation verified: Alice -> {alice_daughter.value}, Bob -> {bob_daughter.value}")
    print("SUCCESS — TEST 6 Passed\n")

    # ── TEST 7: Invalid LLM extraction does not crash ────────────────────────
    print("=== TEST 7: Invalid LLM Output Safety & Resilience ===")
    invalid_cases = [
        "not a json at all",
        "{malformed json: 123}",
        json.dumps({"wrong_key": 123}),
        json.dumps({"memories": "not a list"}),
        json.dumps({"memories": [{"invalid": "data"}]}),
        json.dumps({"memories": [{"key": "", "value": "Valid"}]}),
        json.dumps({"memories": [{"key": "a" * 100, "value": "Valid"}]}),
    ]
    for bad_output in invalid_cases:
        res = parse_and_validate_extraction(bad_output)
        assert isinstance(res, list)
        assert len(res) == 0, f"Expected empty list for bad output, got: {res}"

    print("Resilience verified: all malformed/unexpected outputs safely handled without error.")
    print("SUCCESS — TEST 7 Passed\n")

    # ── TEST 8: Empty / Blank extraction handling ────────────────────────────
    print("=== TEST 8: Empty / Blank Extraction Handling ===")
    assert extract_memories_from_text("") == []
    assert extract_memories_from_text("   ") == []
    assert extract_and_persist_memories("", user_identifier="test_alice") == []
    assert parse_and_validate_extraction(json.dumps({"memories": []})) == []
    print("SUCCESS — TEST 8 Passed\n")

    # ── TEST 9: Multiple useful memories handled safely ──────────────────────
    print("=== TEST 9: Multiple Useful Memories Handled Safely ===")
    multi_stmt = "I live in Chennai and I prefer Tamil."
    multi_res = extract_memories_from_text(multi_stmt)
    print(f"Multi-fact statement: '{multi_stmt}' -> Extracted: {multi_res}")
    assert len(multi_res) >= 1
    # Check that cap is respected (max 3)
    assert len(multi_res) <= 3
    persist_extracted_memories(multi_res, user_identifier="test_alice")
    alice_multi = list_memories(user_identifier="test_alice")
    keys = {m.key for m in alice_multi}
    print(f"Alice's keys after multi-fact persistence: {keys}")
    print("SUCCESS — TEST 9 Passed\n")

    # ── TEST 10: Existing Stage 8.2 memory retrieval still works ─────────────
    print("=== TEST 10: Existing Stage 8.2 Retrieval Works with Auto-Saved Memories ===")
    retrieved = get_relevant_memories(user_identifier="test_alice", transcript="Who is my daughter?")
    assert len(retrieved) >= 1
    prompt_context = format_memories_for_prompt(retrieved)
    print(f"Retrieved prompt context for Bhavi:\n{prompt_context}")
    assert "daughter" in prompt_context.lower()
    assert "ananya" in prompt_context.lower()
    print("SUCCESS — TEST 10 Passed\n")

    # ── TEST 11: Existing Short-term Conversation Memory Still Works ─────────
    print("=== TEST 11: Short-term Conversation Memory Uninterrupted ===")
    sess_id = generate_session_id()
    add_conversation_turn(sess_id, "Hello Bhavi!", "Hello! How can I help you today?")
    hist = get_conversation_history(sess_id)
    assert len(hist) == 2
    assert hist[0]["content"] == "Hello Bhavi!"
    assert hist[1]["content"] == "Hello! How can I help you today?"
    clear_session(sess_id)
    print("SUCCESS — TEST 11 Passed\n")

    # ── TEST 12: Sensitive Information Safety Filter ─────────────────────────
    print("=== TEST 12: Sensitive Information Filter Rejection ===")
    sensitive_memory = {
        "memory_type": "general",
        "key": "user_password",
        "value": "secret123",
    }
    validated = validate_single_memory(sensitive_memory)
    assert validated is None, "Sensitive memory with 'password' was not rejected!"

    pin_memory = {
        "memory_type": "general",
        "key": "atm_pin",
        "value": "1234",
    }
    validated_pin = validate_single_memory(pin_memory)
    assert validated_pin is None, "Sensitive memory with 'pin' was not rejected!"
    print("Safety filter verified: sensitive credentials rejected automatically.")
    print("SUCCESS — TEST 12 Passed\n")

    # Cleanup test users
    clear_memories(user_identifier="test_alice")
    clear_memories(user_identifier="test_bob")

    print("ALL STAGE 8.3 AUTOMATIC PERSISTENT MEMORY EXTRACTION TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_stage_8_3_tests()
