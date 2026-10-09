"""
backend/test_senior_linking.py

Stage 12 — Senior-Caretaker Linking & Senior ID Test Suite

Tests:
 1. Senior ID generation format (SM-XXXX-YYYY) and non-empty.
 2. Senior ID persistence: subsequent requests return the exact same ID.
 3. Senior ID uniqueness: two different seniors receive distinct Senior IDs.
 4. Caretaker linking: non-existent Senior ID rejected with 404 (safe error, no details leaked).
 5. Caretaker linking: valid Senior ID creates a PENDING relationship.
 6. Multiple caretakers: Caretaker 1 and Caretaker 2 can both link to the same senior.
 7. Duplicate links: duplicate link submission gracefully handled without unique constraint error.
 8. Unauthorized / Pending caretaker data access denied: 403 Forbidden with approval_pending=True (no memories/events leaked).
 9. Senior approval: senior approves link via action endpoint -> status becomes APPROVED.
 10. Authorized data access: approved caretaker receives full senior overview for the linked senior.
 11. Tampering protection: caretaker cannot read another senior's data by changing the Senior ID.
 12. Immediate Revocation: senior revokes link -> caretaker is immediately blocked (403 Forbidden).
"""

import json
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.test import RequestFactory
from voice.models import (
    SeniorProfile,
    CaregiverElderLink,
    UserMemory,
    SafetyEvent,
    generate_unique_senior_id,
)
from voice.views import (
    senior_my_id,
    senior_caregivers,
    senior_caregiver_action,
    caregiver_link,
    caregiver_linked_senior,
)


def run_tests():
    factory = RequestFactory()
    print("=" * 70)
    print("STAGE 12 — SENIOR-CARETAKER LINKING TEST SUITE")
    print("=" * 70)

    # Clean up test records
    CaregiverElderLink.objects.filter(caretaker_phone__startswith="+91 9999").delete()
    SeniorProfile.objects.filter(user_identifier__startswith="test_link_senior_").delete()

    # ── TEST 1: Senior ID Generation Format ──────────────────────────────────
    print("\n=== TEST 1: Senior ID Generation Format ===")
    test_id = generate_unique_senior_id()
    assert test_id.startswith("SM-"), f"Expected ID to start with SM-, got: {test_id}"
    parts = test_id.split("-")
    assert len(parts) == 3, f"Expected 3 parts in {test_id}, got {len(parts)}"
    assert len(parts[1]) == 4 and len(parts[2]) == 4, f"Invalid format in {test_id}"
    print(f"Generated sample Senior ID: {test_id} (Format: SM-XXXX-YYYY ✓)")
    print("SUCCESS — TEST 1 Passed")

    # ── TEST 2: Senior ID Persistence ────────────────────────────────────────
    print("\n=== TEST 2: Senior ID Persistence ===")
    req1 = factory.get("/api/senior/my-id/?user_identifier=test_link_senior_1&display_name=Raman")
    resp1 = senior_my_id(req1)
    data1 = json.loads(resp1.content)
    assert data1["status"] == "ok"
    senior_id_1 = data1["senior_id"]

    # Second call should return the EXACT same ID
    req2 = factory.get("/api/senior/my-id/?user_identifier=test_link_senior_1")
    resp2 = senior_my_id(req2)
    data2 = json.loads(resp2.content)
    assert data2["senior_id"] == senior_id_1, f"ID changed across requests: {data2['senior_id']} != {senior_id_1}"
    print(f"Senior ID persistently mapped: [{senior_id_1}] for user [test_link_senior_1]")
    print("SUCCESS — TEST 2 Passed")

    # ── TEST 3: Senior ID Uniqueness ─────────────────────────────────────────
    print("\n=== TEST 3: Senior ID Uniqueness ===")
    req_b = factory.get("/api/senior/my-id/?user_identifier=test_link_senior_2&display_name=Kamala")
    resp_b = senior_my_id(req_b)
    data_b = json.loads(resp_b.content)
    senior_id_2 = data_b["senior_id"]
    assert senior_id_1 != senior_id_2, f"Collision detected! Both users got {senior_id_1}"
    print(f"Senior 1 ID: {senior_id_1} != Senior 2 ID: {senior_id_2} (Unique ✓)")
    print("SUCCESS — TEST 3 Passed")

    # ── TEST 4: Invalid Senior ID Rejected ───────────────────────────────────
    print("\n=== TEST 4: Invalid Senior ID Rejected ===")
    bad_req = factory.post(
        "/api/caregiver/link/",
        data=json.dumps({
            "senior_id": "SM-INVALID-9999",
            "phone_number": "+91 99991 00001",
            "full_name": "Anita Raman",
            "caretaker_slot": "PRIMARY",
        }),
        content_type="application/json",
    )
    bad_resp = caregiver_link(bad_req)
    assert bad_resp.status_code == 404, f"Expected 404, got {bad_resp.status_code}"
    bad_data = json.loads(bad_resp.content)
    assert "not found" in bad_data["error"].lower()
    print("Invalid Senior ID safely rejected with 404 without leaking internal records.")
    print("SUCCESS — TEST 4 Passed")

    # ── TEST 5: Caretaker Linking (Initial Status: PENDING) ───────────────────
    print("\n=== TEST 5: Valid Caretaker Link Creation (Status: PENDING) ===")
    link_req = factory.post(
        "/api/caregiver/link/",
        data=json.dumps({
            "senior_id": senior_id_1,
            "phone_number": "+91 99991 00001",
            "full_name": "Anita Raman",
            "caretaker_slot": "PRIMARY",
        }),
        content_type="application/json",
    )
    link_resp = caregiver_link(link_req)
    assert link_resp.status_code == 200
    link_data = json.loads(link_resp.content)
    assert link_data["status"] == "ok"
    assert link_data["link"]["status"] == "PENDING"
    link_id_1 = link_data["link"]["id"]
    print(f"Link created (ID={link_id_1}) for caretaker Anita -> Senior [{senior_id_1}], status=PENDING")
    print("SUCCESS — TEST 5 Passed")

    # ── TEST 6: Multiple Caretakers Linking to Same Senior ───────────────────
    print("\n=== TEST 6: Multiple Caretakers for Same Senior ===")
    link2_req = factory.post(
        "/api/caregiver/link/",
        data=json.dumps({
            "senior_id": senior_id_1,
            "phone_number": "+91 99991 00002",
            "full_name": "Suresh Raman",
            "caretaker_slot": "SECONDARY",
        }),
        content_type="application/json",
    )
    link2_resp = caregiver_link(link2_req)
    assert link2_resp.status_code == 200
    link2_data = json.loads(link2_resp.content)
    assert link2_data["status"] == "ok"
    link_id_2 = link2_data["link"]["id"]
    assert link_id_1 != link_id_2

    # Verify senior now has 2 pending links
    cg_req = factory.get("/api/senior/caregivers/?user_identifier=test_link_senior_1")
    cg_resp = senior_caregivers(cg_req)
    cg_data = json.loads(cg_resp.content)
    assert len(cg_data["pending_caregivers"]) == 2
    print(f"Senior has {len(cg_data['pending_caregivers'])} distinct pending caretakers (Anita & Suresh).")
    print("SUCCESS — TEST 6 Passed")

    # ── TEST 7: Duplicate Link Prevention ────────────────────────────────────
    print("\n=== TEST 7: Duplicate Link Submission Handled Gracefully ===")
    dup_req = factory.post(
        "/api/caregiver/link/",
        data=json.dumps({
            "senior_id": senior_id_1,
            "phone_number": "+91 99991 00001",
            "full_name": "Anita Raman",
            "caretaker_slot": "PRIMARY",
        }),
        content_type="application/json",
    )
    dup_resp = caregiver_link(dup_req)
    assert dup_resp.status_code == 200
    dup_data = json.loads(dup_resp.content)
    assert dup_data["link"]["id"] == link_id_1, "Duplicate link created instead of reusing existing!"
    print("Duplicate link prevented; existing link returned cleanly.")
    print("SUCCESS — TEST 7 Passed")

    # ── TEST 8: Pending Caretaker Denied Private Data Access ─────────────────
    print("\n=== TEST 8: Pending Caretaker Cannot Access Senior Overview (403) ===")
    blocked_req = factory.get(f"/api/caregiver/linked-senior/?senior_id={senior_id_1}&phone_number=%2B91+99991+00001")
    blocked_resp = caregiver_linked_senior(blocked_req)
    assert blocked_resp.status_code == 403, f"Expected 403, got {blocked_resp.status_code}"
    blocked_data = json.loads(blocked_resp.content)
    assert blocked_data.get("approval_pending") is True
    # Ensure NO memories or events leaked in response
    assert "safety_events" not in blocked_data
    assert "recent_memories" not in blocked_data
    print("Access properly denied with 403. Zero private senior data exposed while pending.")
    print("SUCCESS — TEST 8 Passed")

    # ── TEST 9: Senior Approves Caretaker ────────────────────────────────────
    print("\n=== TEST 9: Senior Approves Caretaker ===")
    appr_req = factory.post(
        f"/api/senior/caregivers/{link_id_1}/action/",
        data=json.dumps({"action": "APPROVE", "user_identifier": "test_link_senior_1"}),
        content_type="application/json",
    )
    appr_resp = senior_caregiver_action(appr_req, link_id_1)
    assert appr_resp.status_code == 200
    appr_data = json.loads(appr_resp.content)
    assert appr_data["new_status"] == "APPROVED"

    # Verify link is now in linked_caregivers list
    cg_req2 = factory.get("/api/senior/caregivers/?user_identifier=test_link_senior_1")
    cg_data2 = json.loads(senior_caregivers(cg_req2).content)
    assert len(cg_data2["linked_caregivers"]) == 1
    assert cg_data2["linked_caregivers"][0]["name"] == "Anita Raman"
    print(f"Caretaker #{link_id_1} (Anita Raman) approved by senior. Link is now APPROVED.")
    print("SUCCESS — TEST 9 Passed")

    # ── TEST 10: Authorized Caretaker Accesses Real Senior Data ──────────────
    print("\n=== TEST 10: Approved Caretaker Accesses Real Senior Data ===")
    # Seed a memory and safety event for test_link_senior_1
    UserMemory.objects.get_or_create(
        user_identifier="test_link_senior_1",
        memory_type="lifestyle",
        key="morning_drink",
        defaults={"value": "Filter coffee with milk"},
    )
    SafetyEvent.objects.create(
        user_identifier="test_link_senior_1",
        risk_level="MEDIUM",
        category="FALL",
        reason="Stumbled near bathroom door, no injury reported.",
        status="NEW",
    )

    auth_req = factory.get(f"/api/caregiver/linked-senior/?senior_id={senior_id_1}&phone_number=%2B91+99991+00001")
    auth_resp = caregiver_linked_senior(auth_req)
    assert auth_resp.status_code == 200
    auth_data = json.loads(auth_resp.content)
    assert auth_data["status"] == "ok"
    assert len(auth_data["recent_memories"]) >= 1
    assert len(auth_data["safety_events"]) >= 1
    assert auth_data["safety_events"][0]["category"] == "FALL"
    print(f"Authorized caretaker successfully retrieved overview for [{auth_data['user_identifier']}]")
    print("SUCCESS — TEST 10 Passed")

    # ── TEST 11: Tampering Protection ────────────────────────────────────────
    print("\n=== TEST 11: Tampering Protection (Accessing Senior 2 with Caretaker 1) ===")
    tamper_req = factory.get(f"/api/caregiver/linked-senior/?senior_id={senior_id_2}&phone_number=%2B91+99991+00001")
    tamper_resp = caregiver_linked_senior(tamper_req)
    assert tamper_resp.status_code == 403, f"Expected 403, got {tamper_resp.status_code}"
    print("Tampering attempt blocked with 403 Forbidden. Caretaker cannot view unlinked senior.")
    print("SUCCESS — TEST 11 Passed")

    # ── TEST 12: Immediate Revocation ────────────────────────────────────────
    print("\n=== TEST 12: Senior Revokes Caretaker Access ===")
    rev_req = factory.post(
        f"/api/senior/caregivers/{link_id_1}/action/",
        data=json.dumps({"action": "REVOKE", "user_identifier": "test_link_senior_1"}),
        content_type="application/json",
    )
    rev_resp = senior_caregiver_action(rev_req, link_id_1)
    assert rev_resp.status_code == 200
    assert json.loads(rev_resp.content)["new_status"] == "REVOKED"

    # Now caretaker should immediately get 403 Forbidden!
    blocked_rev_req = factory.get(f"/api/caregiver/linked-senior/?senior_id={senior_id_1}&phone_number=%2B91+99991+00001")
    blocked_rev_resp = caregiver_linked_senior(blocked_rev_req)
    assert blocked_rev_resp.status_code == 403
    assert json.loads(blocked_rev_resp.content).get("is_revoked") is True
    print("Revocation immediately enforced by backend. Caretaker blocked with 403.")
    print("SUCCESS — TEST 12 Passed")

    # Clean up test records
    CaregiverElderLink.objects.filter(caretaker_phone__startswith="+91 9999").delete()
    SeniorProfile.objects.filter(user_identifier__startswith="test_link_senior_").delete()

    print("\n" + "=" * 70)
    print("ALL 12 SENIOR-CARETAKER LINKING TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
