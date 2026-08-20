"""
backend/voice/services/memory_store.py

Dedicated service for managing persistent user memory records.
All database operations for UserMemory pass through this service to ensure:
- Validation (rejecting empty keys/values)
- Ownership isolation (scoping requests to the owner's user_identifier)
- Predictable error handling
"""

from typing import Dict, List, Optional, Union
from voice.models import UserMemory


def _resolve_user_identifier(user_identifier: Optional[str], user=None) -> str:
    """Helper to determine the active user identifier string."""
    if user and hasattr(user, "username") and user.username:
        return user.username
    if user_identifier and isinstance(user_identifier, str) and user_identifier.strip():
        return user_identifier.strip()
    return "default_user"


def create_memory(
    key: str,
    value: str,
    memory_type: str = "general",
    user_identifier: Optional[str] = "default_user",
    user=None,
) -> UserMemory:
    """
    Create or update a persistent memory record for a user.

    Args:
        key: Memory key (e.g., 'daughter_name', 'preferred_language')
        value: Memory value (e.g., 'Priya', 'Tamil')
        memory_type: Category ('preference', 'family', 'interest', 'general')
        user_identifier: User identifier string
        user: Optional Django User instance

    Returns:
        UserMemory model instance.

    Raises:
        ValueError: If key or value is empty or invalid.
    """
    if not key or not str(key).strip():
        raise ValueError("Memory key cannot be empty.")
    if not value or not str(value).strip():
        raise ValueError("Memory value cannot be empty.")

    clean_key = str(key).strip()
    clean_val = str(value).strip()
    clean_type = str(memory_type).strip().lower() if memory_type else "general"
    uid = _resolve_user_identifier(user_identifier, user)

    # Upsert pattern: update if key exists for this user_identifier & memory_type
    memory_obj, created = UserMemory.objects.update_or_create(
        user_identifier=uid,
        memory_type=clean_type,
        key=clean_key,
        defaults={
            "value": clean_val,
            "user": user if (user and getattr(user, "is_authenticated", False)) else None,
        },
    )

    action = "Created" if created else "Updated"
    print(f"[MemoryStore] {action} memory [{uid}] {clean_type}:{clean_key} = {clean_val[:30]}", flush=True)
    return memory_obj


def list_memories(
    user_identifier: Optional[str] = "default_user",
    memory_type: Optional[str] = None,
    user=None,
) -> List[UserMemory]:
    """
    List all memories owned by the specified user.

    Args:
        user_identifier: User identifier string
        memory_type: Optional filter by memory type
        user: Optional Django User instance

    Returns:
        List of UserMemory instances owned by the user.
    """
    uid = _resolve_user_identifier(user_identifier, user)
    qs = UserMemory.objects.filter(user_identifier=uid)

    if memory_type and str(memory_type).strip():
        qs = qs.filter(memory_type=str(memory_type).strip().lower())

    return list(qs)


def get_memory(
    memory_id: int,
    user_identifier: Optional[str] = "default_user",
    user=None,
) -> Optional[UserMemory]:
    """
    Get a single memory by ID, enforcing user ownership.
    Returns None if not found or owned by another user.
    """
    uid = _resolve_user_identifier(user_identifier, user)
    try:
        return UserMemory.objects.get(id=memory_id, user_identifier=uid)
    except UserMemory.DoesNotExist:
        return None


def update_memory(
    memory_id: int,
    value: str,
    user_identifier: Optional[str] = "default_user",
    memory_type: Optional[str] = None,
    user=None,
) -> Optional[UserMemory]:
    """
    Update an existing memory record owned by the user.

    Raises:
        ValueError: If value is empty.
    """
    if not value or not str(value).strip():
        raise ValueError("Memory value cannot be empty.")

    memory_obj = get_memory(memory_id, user_identifier=user_identifier, user=user)
    if not memory_obj:
        return None

    memory_obj.value = str(value).strip()
    if memory_type and str(memory_type).strip():
        memory_obj.memory_type = str(memory_type).strip().lower()

    memory_obj.save()
    print(f"[MemoryStore] Updated memory #{memory_id} for user [{memory_obj.user_identifier}]", flush=True)
    return memory_obj


def delete_memory(
    memory_id: int,
    user_identifier: Optional[str] = "default_user",
    user=None,
) -> bool:
    """
    Delete a single memory record, enforcing ownership.
    Returns True if deleted, False if not found or unauthorized.
    """
    memory_obj = get_memory(memory_id, user_identifier=user_identifier, user=user)
    if not memory_obj:
        print(f"[MemoryStore] Delete failed: Memory #{memory_id} not found for user [{user_identifier}]", flush=True)
        return False

    memory_obj.delete()
    print(f"[MemoryStore] Deleted memory #{memory_id} for user [{user_identifier}]", flush=True)
    return True


def clear_memories(
    user_identifier: Optional[str] = "default_user",
    user=None,
) -> int:
    """
    Clear all memories for the specified user ONLY.
    Returns count of deleted memories.
    """
    uid = _resolve_user_identifier(user_identifier, user)
    deleted_count, _ = UserMemory.objects.filter(user_identifier=uid).delete()
    print(f"[MemoryStore] Cleared {deleted_count} memories for user [{uid}]", flush=True)
    return deleted_count


def get_relevant_memories(
    user_identifier: Optional[str] = "default_user",
    transcript: Optional[str] = None,
    user=None,
    max_memories: int = 5,
) -> List[UserMemory]:
    """
    Retrieve relevant persistent memories owned by the specified user for LLM context inclusion.

    Selection strategy:
    1. Filter strictly by user_identifier (or user).
    2. If transcript is provided, prioritize memories whose key, value, or memory_type
       matches terms in the transcript.
    3. Cap output to max_memories (default: 5) to keep LLM context bounded.

    Args:
        user_identifier: User identifier string
        transcript: Optional user transcript for keyword relevance matching
        user: Optional Django User instance
        max_memories: Maximum number of memories to return (default: 5)

    Returns:
        List of UserMemory objects owned ONLY by this user.
    """
    uid = _resolve_user_identifier(user_identifier, user)
    user_memories = list(UserMemory.objects.filter(user_identifier=uid))

    if not user_memories:
        return []

    if not transcript or not str(transcript).strip():
        # No transcript keyword matching needed, return most recently updated memories up to cap
        return user_memories[:max_memories]

    transcript_lower = str(transcript).strip().lower()
    words = [w.strip("?,.!") for w in transcript_lower.split() if len(w) > 2]

    relevant = []
    other = []

    for mem in user_memories:
        key_lower = mem.key.lower()
        val_lower = mem.value.lower()
        type_lower = mem.memory_type.lower()

        # Check for direct or word-level matches
        is_relevant = (
            key_lower in transcript_lower
            or val_lower in transcript_lower
            or type_lower in transcript_lower
            or any(w in key_lower or w in val_lower for w in words)
        )

        if is_relevant:
            relevant.append(mem)
        else:
            other.append(mem)

    # Combine relevant first, then fill up to max_memories with remaining user memories
    combined = relevant + other
    return combined[:max_memories]


def format_memories_for_prompt(memories: List[UserMemory]) -> str:
    """
    Format a list of UserMemory objects into a structured text prompt for the LLM.
    Example:
        Known information about the user:
        - Family: daughter_name = Priya
        - Preference: preferred_language = Tamil
    """
    if not memories:
        return ""

    lines = ["Known information about the user:"]
    for m in memories:
        category = m.memory_type.capitalize() if m.memory_type else "General"
        lines.append(f"- {category}: {m.key} = {m.value}")

    return "\n".join(lines)
