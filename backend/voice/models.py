from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class UserMemory(models.Model):
    """
    Persistent model storing user preferences, family details, interests, and facts.
    Each memory belongs to a user (via ForeignKey when authenticated, or user_identifier string).
    """

    MEMORY_TYPES = (
        ("preference", "Preference"),
        ("family", "Family"),
        ("interest", "Interest"),
        ("general", "General"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="memories",
        null=True,
        blank=True,
    )
    user_identifier = models.CharField(
        max_length=150,
        default="default_user",
        db_index=True,
        help_text="User identifier for isolation and session ownership."
    )
    memory_type = models.CharField(
        max_length=50,
        choices=MEMORY_TYPES,
        default="general",
        db_index=True
    )
    key = models.CharField(max_length=100, db_index=True)
    value = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Memory"
        verbose_name_plural = "User Memories"
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user_identifier", "memory_type", "key"],
                name="unique_memory_per_user_key"
            )
        ]

    def __str__(self):
        return f"[{self.user_identifier}] {self.memory_type}:{self.key} = {self.value[:30]}"
