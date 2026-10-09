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


class UserVoicePreference(models.Model):
    """
    Stores optional per-user personalized voice configuration (e.g. ElevenLabs voice_id).
    Piper remains the default fallback provider.
    No audio recordings are stored in this model.
    """

    PROVIDER_CHOICES = (
        ("piper", "Piper"),
        ("elevenlabs", "ElevenLabs"),
        ("openvoice", "OpenVoice (Local)"),
    )

    user_identifier = models.CharField(
        max_length=150,
        unique=True,
        db_index=True,
        help_text="User identifier for voice preference ownership.",
    )
    provider = models.CharField(
        max_length=20,
        choices=PROVIDER_CHOICES,
        default="piper",
        help_text="TTS provider ('piper', 'elevenlabs', or 'openvoice').",
    )
    elevenlabs_voice_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Optional custom ElevenLabs voice ID for personalized voice cloning.",
    )
    openvoice_reference_path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Optional local file path to reference voice audio for OpenVoice V2 cloning.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Voice Preference"
        verbose_name_plural = "User Voice Preferences"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"[{self.user_identifier}] provider={self.provider} voice_id={self.elevenlabs_voice_id}"


def generate_unique_senior_id() -> str:
    """
    Generate a non-sequential, random Senior ID format: SM-XXXX-YYYY
    Uses un-ambiguous alphanumeric characters (excluding 0, O, 1, I).
    Guarantees uniqueness across SeniorProfile records.
    """
    import secrets
    charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    while True:
        part1 = "".join(secrets.choice(charset) for _ in range(4))
        part2 = "".join(secrets.choice(charset) for _ in range(4))
        candidate = f"SM-{part1}-{part2}"
        if not SeniorProfile.objects.filter(senior_id=candidate).exists():
            return candidate


class SeniorProfile(models.Model):
    """
    Stores persistent Senior Profile and public Senior ID code (e.g. SM-7K4P-9Q2X).
    Maps internal user_identifier to a non-sequential, random public Senior ID.
    Never exposes internal primary keys or internal user_identifier to external caretakers.
    """
    user_identifier = models.CharField(
        max_length=150,
        unique=True,
        db_index=True,
        help_text="Internal user identifier for this senior (e.g. default_user or session uid)."
    )
    senior_id = models.CharField(
        max_length=30,
        unique=True,
        db_index=True,
        help_text="Public unique Senior ID (e.g. SM-7K4P-9Q2X)."
    )
    display_name = models.CharField(
        max_length=150,
        default="Senior Citizen",
        help_text="Display name chosen by the senior."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Senior Profile"
        verbose_name_plural = "Senior Profiles"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.senior_id}] {self.display_name} ({self.user_identifier})"


class CaregiverElderLink(models.Model):
    """
    Represents an authorized or pending relationship between a caretaker and a senior.
    Multiple caretakers can link to the same senior.
    Status transitions: PENDING -> APPROVED | REJECTED | REVOKED.
    """
    STATUS_CHOICES = (
        ("PENDING", "Pending Approval"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("REVOKED", "Revoked"),
    )

    senior = models.ForeignKey(
        SeniorProfile,
        on_delete=models.CASCADE,
        related_name="caregiver_links",
        help_text="The linked senior."
    )
    caretaker_phone = models.CharField(
        max_length=30,
        db_index=True,
        help_text="Caretaker phone number or contact identifier."
    )
    caretaker_name = models.CharField(
        max_length=150,
        default="Caregiver",
        help_text="Caretaker name."
    )
    caretaker_slot = models.CharField(
        max_length=20,
        default="PRIMARY",
        help_text="Caretaker role slot ('PRIMARY' or 'SECONDARY')."
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING",
        db_index=True,
        help_text="Approval status of this link."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Caregiver Elder Link"
        verbose_name_plural = "Caregiver Elder Links"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["senior", "caretaker_phone"],
                name="unique_senior_caretaker_phone"
            )
        ]

    def __str__(self):
        return f"{self.caretaker_name} ({self.caretaker_phone}) -> {self.senior.senior_id} [{self.status}]"


