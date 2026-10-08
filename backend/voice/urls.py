from django.urls import path
from .views import (
    health_check,
    upload_audio,
    manage_memories,
    manage_single_memory,
    caregiver_overview,
    update_safety_event,
    enroll_personalized_voice,
    enroll_openvoice_voice,
    disable_personalized_voice,
    get_voice_status,
)

urlpatterns = [
    path('health/', health_check, name='health_check'),
    path('audio/', upload_audio, name='upload_audio'),
    path('memories/', manage_memories, name='manage_memories'),
    path('memories/<int:memory_id>/', manage_single_memory, name='manage_single_memory'),
    path('caregiver/overview/', caregiver_overview, name='caregiver_overview_default'),
    path('caregiver/<str:user_identifier>/overview/', caregiver_overview, name='caregiver_overview'),
    path('safety-events/<int:event_id>/', update_safety_event, name='update_safety_event'),
    # Stage 11 Phase 3 — Personalized Voice
    path('voice/personalized/', enroll_personalized_voice, name='enroll_personalized_voice'),
    path('voice/personalized/openvoice/', enroll_openvoice_voice, name='enroll_openvoice_voice'),
    path('voice/personalized/disable/', disable_personalized_voice, name='disable_personalized_voice'),
    path('voice/personalized/status/', get_voice_status, name='get_voice_status'),
]
