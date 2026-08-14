from django.urls import path
from .views import health_check, upload_audio

urlpatterns = [
    path('health/', health_check, name='health_check'),
    path('audio/', upload_audio, name='upload_audio'),
]

