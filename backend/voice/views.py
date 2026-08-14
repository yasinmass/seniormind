from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

def health_check(request):
    return JsonResponse({
        "status": "ok",
        "service": "SeniorMind backend"
    })

@csrf_exempt
@require_POST
def upload_audio(request):
    audio_file = request.FILES.get('audio')
    if not audio_file:
        return JsonResponse({
            "status": "error",
            "message": "Audio file is required"
        }, status=400)

    return JsonResponse({
        "status": "ok",
        "filename": audio_file.name or "recording.webm",
        "content_type": audio_file.content_type or "audio/webm",
        "size": audio_file.size
    })


