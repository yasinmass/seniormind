import sys
import io
import time
import traceback
from typing import Optional, Tuple
from faster_whisper import WhisperModel

# Force stdout to UTF-8 on Windows to prevent cp1252 UnicodeEncodeError
# when Whisper returns non-ASCII characters (e.g. Hindi, Arabic, CJK).
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)

_model_instance: Optional[WhisperModel] = None

MODEL_NAME = "small"
DEVICE = "cuda"
COMPUTE_TYPE = "float16"

def get_stt_model() -> WhisperModel:
    global _model_instance
    if _model_instance is None:
        print("[STT] Loading Whisper model...", flush=True)
        print(f"[STT] Target Config -> Model: '{MODEL_NAME}', Device: '{DEVICE}', Compute Type: '{COMPUTE_TYPE}'", flush=True)
        start_time = time.time()
        try:
            _model_instance = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)
            elapsed = time.time() - start_time
            print(f"[STT] Whisper model loaded in {elapsed:.2f}s", flush=True)
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"[STT] CUDA initialization failed after {elapsed:.2f}s: {e}", flush=True)
            print("[STT] Falling back to CPU / int8...", flush=True)
            traceback.print_exc(file=sys.stdout)
            sys.stdout.flush()
            start_cpu_time = time.time()
            _model_instance = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
            elapsed_cpu = time.time() - start_cpu_time
            print(f"[STT] Whisper model loaded on CPU in {elapsed_cpu:.2f}s", flush=True)
    else:
        print("[STT] Reusing existing cached Whisper model instance", flush=True)

    return _model_instance

def transcribe_audio(file_path: str) -> Tuple[str, str]:
    """
    Transcribes audio file located at file_path using Faster-Whisper.
    Returns tuple of (transcript_text, detected_language).
    """
    global _model_instance
    print(f"[STT] Starting transcription for {file_path}", flush=True)
    model = get_stt_model()

    print("[STT] Starting inference...", flush=True)
    inference_start = time.time()

    try:
        segments_gen, info = model.transcribe(file_path, beam_size=5)
        print(f"[STT] Detected language: '{info.language}' (probability: {info.language_probability:.2f})", flush=True)

        text_segments = []
        for segment in segments_gen:
            safe_text = segment.text.encode('utf-8', errors='replace').decode('utf-8')
            print(f"[STT] Segment [{segment.start:.2f}s -> {segment.end:.2f}s]: {safe_text}", flush=True)
            if segment.text:
                text_segments.append(segment.text.strip())

        full_text = " ".join(text_segments).strip()
        elapsed_inference = time.time() - inference_start
        print(f"[STT] Inference completed in {elapsed_inference:.2f}s", flush=True)
        print(f"[STT] Language: {info.language}", flush=True)
        safe_full_text = full_text.encode('utf-8', errors='replace').decode('utf-8')
        print(f"[STT] Text: {safe_full_text}", flush=True)

        return full_text, info.language
    except Exception as e:
        error_msg = str(e)
        print(f"[STT] Inference failed with error: {error_msg}", flush=True)
        if ("cublas" in error_msg.lower() or "cuda" in error_msg.lower() or "cudnn" in error_msg.lower()) and DEVICE == "cuda":
            print("[STT] CUDA runtime DLL missing. Automatically falling back to CPU ('small', device='cpu', compute_type='int8')...", flush=True)
            start_cpu_time = time.time()
            _model_instance = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
            elapsed_cpu = time.time() - start_cpu_time
            print(f"[STT] Whisper model reloaded on CPU in {elapsed_cpu:.2f}s", flush=True)
            return transcribe_audio(file_path)

        traceback.print_exc(file=sys.stdout)
        sys.stdout.flush()
        raise
