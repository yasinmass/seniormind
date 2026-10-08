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
        ("lifestyle", "Lifestyle"),
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


class SafetyEvent(models.Model):
    """
    Stage 9 — stores a safety/health concern detected during a conversation turn.
    A record is created ONLY when requires_attention = True (MEDIUM / HIGH / CRITICAL).
    Raw audio is never stored here.
    """

    RISK_LEVELS = (
        ("LOW",      "Low"),
        ("MEDIUM",   "Medium"),
        ("HIGH",     "High"),
        ("CRITICAL", "Critical"),
    )

    CATEGORIES = (
        ("NONE",               "None"),
        ("MEDICATION",         "Medication"),
        ("FALL",               "Fall"),
        ("MEDICAL",            "Medical"),
        ("CONFUSION",          "Confusion"),
        ("SAFETY",             "Safety"),
        ("EMOTIONAL_DISTRESS", "Emotional Distress"),
        ("SELF_HARM",          "Self Harm"),
        ("EMERGENCY",          "Emergency"),
        ("OTHER",              "Other"),
    )

    STATUS_CHOICES = (
        ("NEW",      "New"),
        ("REVIEWED", "Reviewed"),
        ("RESOLVED", "Resolved"),
    )

    user_identifier = models.CharField(
        max_length=150,
        default="default_user",
        db_index=True,
        help_text="User identifier — matches the voice request user_identifier.",
    )
    risk_level = models.CharField(
        max_length=10,
        choices=RISK_LEVELS,
        default="LOW",
        db_index=True,
    )
    category = models.CharField(
        max_length=30,
        choices=CATEGORIES,
        default="NONE",
        db_index=True,
    )
    reason = models.TextField(
        blank=True,
        default="",
        help_text="Short plain-English description of the detected concern.",
    )
    # A brief excerpt of the relevant part of the transcript (max 200 chars).
    # We deliberately do NOT store the full raw transcript to protect privacy.
    relevant_text = models.CharField(
        max_length=200,
        blank=True,
        default="",
        help_text="Short excerpt (max 200 chars) of the transcript that triggered the alert.",
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="NEW",
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Safety Event"
        verbose_name_plural = "Safety Events"
        ordering = ["-created_at"]

    def __str__(self):
        return (
            f"[{self.user_identifier}] {self.risk_level}/{self.category} "
            f"@ {self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else '?'}"
        )
