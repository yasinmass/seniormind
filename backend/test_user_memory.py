"""
backend/test_user_memory.py

Comprehensive test suite for Stage 8.1 Persistent User Memory Foundation.
Fast, database-focused tests (no Ollama, Whisper, or Piper required).

Tests:
1. Create a memory
2. Retrieve memories
3. Update a memory
4. Delete one memory
5. Clear all memories for a user
6. Database persistence check
7. User ownership / isolation (User A vs User B)
8. Empty / invalid memory rejection
9. REST API endpoints (/api/memories/ GET, POST, DELETE, DELETE <id>)
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
    create_memory,
    list_memories,
    get_memory,
    update_memory,
    delete_memory,
    clear_memories,
)
from django.test import RequestFactory
from voice.views import manage_memories, manage_single_memory


def run_memory_foundation_tests():
    print("Starting Stage 8.1 Persistent User Memory Tests...\n")

    # Clean up test users first
    clear_memories(user_identifier="user_alice")
    clear_memories(user_identifier="user_bob")

    # ── TEST 1: Create a memory ─────────────────────────────────────────────
    print("=== TEST 1: Create a Memory ===")
    mem1 = create_memory(
        key="daughter_name",
        value="Priya",
        memory_type="family",
        user_identifier="user_alice",
    )
    assert mem1.id is not None
    assert mem1.key == "daughter_name"
    assert mem1.value == "Priya"
    assert mem1.memory_type == "family"
    assert mem1.user_identifier == "user_alice"
    print("SUCCESS — TEST 1 Passed\n")

    # ── TEST 2: Retrieve memories ───────────────────────────────────────────
    print("=== TEST 2: Retrieve Memories ===")
    mem2 = create_memory(
        key="preferred_language",
        value="Tamil",
        memory_type="preference",
        user_identifier="user_alice",
    )
    memories = list_memories(user_identifier="user_alice")
    assert len(memories) == 2, f"Expected 2 memories, got {len(memories)}"
    keys = {m.key for m in memories}
    assert "daughter_name" in keys and "preferred_language" in keys
    print("SUCCESS — TEST 2 Passed\n")

    # ── TEST 3: Update a memory ─────────────────────────────────────────────
    print("=== TEST 3: Update a Memory ===")
    updated_mem = update_memory(
        memory_id=mem1.id,
        value="Priya Sharma",
        user_identifier="user_alice",
    )
    assert updated_mem is not None
    assert updated_mem.value == "Priya Sharma"

    # Verify retrieval reflects update
    retrieved = get_memory(mem1.id, user_identifier="user_alice")
    assert retrieved.value == "Priya Sharma"
    print("SUCCESS — TEST 3 Passed\n")

    # ── TEST 4: Delete one memory ───────────────────────────────────────────
    print("=== TEST 4: Delete One Memory ===")
    deleted = delete_memory(mem2.id, user_identifier="user_alice")
    assert deleted is True
    remaining = list_memories(user_identifier="user_alice")
    assert len(remaining) == 1
    assert remaining[0].id == mem1.id
    print("SUCCESS — TEST 4 Passed\n")

    # ── TEST 5: Clear all memories ──────────────────────────────────────────
    print("=== TEST 5: Clear All Memories ===")
    create_memory(key="city", value="Chennai", memory_type="general", user_identifier="user_alice")
    count_cleared = clear_memories(user_identifier="user_alice")
    assert count_cleared == 2
    assert len(list_memories(user_identifier="user_alice")) == 0
    print("SUCCESS — TEST 5 Passed\n")

    # ── TEST 6: Persistence across service calls ────────────────────────────
    print("=== TEST 6: Verify Database Persistence ===")
    create_memory(key="doctor_name", value="Dr. Aris", memory_type="general", user_identifier="user_alice")

    # Fetch directly from DB via ORM to ensure real persistence
    db_record = UserMemory.objects.get(user_identifier="user_alice", key="doctor_name")
    assert db_record.value == "Dr. Aris"
    print("SUCCESS — TEST 6 Passed\n")

    # ── TEST 7: User Ownership Isolation ────────────────────────────────────
    print("=== TEST 7: User Ownership Isolation (Alice vs Bob) ===")
    create_memory(key="pet_name", value="Tommy", memory_type="general", user_identifier="user_bob")

    alice_memories = list_memories(user_identifier="user_alice")
    bob_memories = list_memories(user_identifier="user_bob")

    assert len(alice_memories) == 1
    assert len(bob_memories) == 1

    assert alice_memories[0].key == "doctor_name"
    assert bob_memories[0].key == "pet_name"

    # Bob cannot fetch or delete Alice's memory
    stolen_fetch = get_memory(db_record.id, user_identifier="user_bob")
    assert stolen_fetch is None

    stolen_delete = delete_memory(db_record.id, user_identifier="user_bob")
    assert stolen_delete is False

    print("User isolation verified: Bob cannot access or modify Alice's memories.")
    print("SUCCESS — TEST 7 Passed\n")

    # ── TEST 8: Empty / Invalid Value Rejection ─────────────────────────────
    print("=== TEST 8: Empty / Invalid Memory Rejection ===")
    try:
        create_memory(key="", value="Valid", user_identifier="user_alice")
        assert False, "Should have raised ValueError for empty key"
    except ValueError as e:
        print(f"Empty key correctly rejected: {e}")

    try:
        create_memory(key="valid_key", value="   ", user_identifier="user_alice")
        assert False, "Should have raised ValueError for empty value"
    except ValueError as e:
        print(f"Empty value correctly rejected: {e}")

    print("SUCCESS — TEST 8 Passed\n")

    # ── TEST 9: REST API Endpoint Tests ─────────────────────────────────────
    print("=== TEST 9: REST API Endpoints (/api/memories/) ===")
    rf = RequestFactory()

    # Clear Alice
    clear_memories(user_identifier="user_alice")

    # 1. POST /api/memories/
    req_post = rf.post(
        "/api/memories/",
        data=json.dumps({
            "user_identifier": "user_alice",
            "memory_type": "family",
            "key": "son_name",
            "value": "Rohan"
        }),
        content_type="application/json"
    )
    resp_post = manage_memories(req_post)
    assert resp_post.status_code == 201
    post_json = json.loads(resp_post.content)
    assert post_json["status"] == "ok"
    mem_id = post_json["memory"]["id"]
    assert post_json["memory"]["key"] == "son_name"

    # 2. GET /api/memories/
    req_get = rf.get("/api/memories/?user_identifier=user_alice")
    resp_get = manage_memories(req_get)
    assert resp_get.status_code == 200
    get_json = json.loads(resp_get.content)
    assert len(get_json["memories"]) == 1
    assert get_json["memories"][0]["value"] == "Rohan"

    # 3. DELETE /api/memories/<id>/
    req_del = rf.delete(f"/api/memories/{mem_id}/?user_identifier=user_alice")
    resp_del = manage_single_memory(req_del, memory_id=mem_id)
    assert resp_del.status_code == 200
    del_json = json.loads(resp_del.content)
    assert del_json["status"] == "ok"

    # Verify list is empty
    req_get_empty = rf.get("/api/memories/?user_identifier=user_alice")
    resp_get_empty = manage_memories(req_get_empty)
    assert len(json.loads(resp_get_empty.content)["memories"]) == 0

    # Cleanup
    clear_memories(user_identifier="user_alice")
    clear_memories(user_identifier="user_bob")

    print("SUCCESS — TEST 9 (REST API) Passed\n")
    print("ALL STAGE 8.1 PERSISTENT USER MEMORY TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    run_memory_foundation_tests()
