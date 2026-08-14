import React, { useRef, useCallback, useEffect } from "react";
import { Mic } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

/**
 * VoiceButton – Step 1 of the voice pipeline.
 *
 * Props (all backwards-compatible):
 *   state              : "idle" | "listening" | "thinking" | "speaking"
 *   onClick            : () => void   – called when starting recording
 *   onRecordingComplete: (blob) => void – called when recording stops
 *   disabled           : boolean
 *   size / btnSize     : number
 *
 * ── Why ref-based toggle? ─────────────────────────────────────────────────
 *   handleClick MUST NOT close over the `state` prop to decide whether to
 *   stop recording.  startRecording() is async (awaits getUserMedia), so by
 *   the time React commits the re-render that changes state → "listening",
 *   the user could already be tapping again with a stale handleClick that
 *   still sees state="idle" and would start a second recording instead of
 *   stopping the first.
 *
 *   Instead, isRecordingRef is the single source of truth.  It is set true
 *   synchronously after recorder.start() and false inside recorder.onstop.
 *   Refs are always live – no stale closures possible.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default function VoiceButton({
  state = "idle",
  onClick,
  onRecordingComplete,
  disabled = false,
  size = 184,
  btnSize = 164,
}) {
  const { theme } = useTheme();
  const label = {
    idle:      "Talk to Bhavi",
    listening: "Listening...",
    thinking:  "Thinking...",
    speaking:  "Bhavi is speaking",
  }[state];

  // ── Refs (live across every re-render, no stale-closure risk) ────────────
  const mediaRecorderRef        = useRef(null);
  const streamRef               = useRef(null);
  const chunksRef               = useRef([]);
  const isRecordingRef          = useRef(false); // single source of truth
  const isStartingRef           = useRef(false); // getUserMedia pending
  const shouldStopRef           = useRef(false); // tapped stop before stream arrived

  // Stable refs to callbacks – always point to the latest prop values
  const onRecordingCompleteRef  = useRef(onRecordingComplete);
  useEffect(() => { onRecordingCompleteRef.current = onRecordingComplete; }, [onRecordingComplete]);

  const onClickRef = useRef(onClick);
  useEffect(() => { onClickRef.current = onClick; }, [onClick]);

  // ── Stop recording ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    console.log("[VoiceButton] STOP REQUEST");

    // Signal getUserMedia to abort if it hasn't resolved yet.
    if (isStartingRef.current) {
      shouldStopRef.current = true;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop(); // fires ondataavailable then onstop
      } catch (err) {
        console.error("[VoiceButton] Error stopping MediaRecorder:", err);
      }
    }

    // Stop every mic track so the browser indicator light turns off.
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch (err) {
        console.error("[VoiceButton] Error stopping stream tracks:", err);
      }
      streamRef.current = null;
    }

    isRecordingRef.current = false;
  }, []); // reads/writes only refs — no deps needed

  // ── Start recording ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!window.MediaRecorder) {
      console.error("[VoiceButton] MediaRecorder is not supported in this browser.");
      return;
    }

    // Prevent double-start.
    if (isRecordingRef.current || isStartingRef.current) return;

    isStartingRef.current = true;
    shouldStopRef.current = false;
    console.log("[VoiceButton] START REQUEST");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // User tapped stop while the permission prompt was open.
      if (shouldStopRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        isStartingRef.current = false;
        shouldStopRef.current = false;
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        console.log("[VoiceButton] RECORDER STOPPED");
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        console.log("[VoiceButton] BLOB CREATED");
        console.log("[VoiceButton] Blob type:", blob.type);
        console.log("[VoiceButton] Blob size:", blob.size);

        chunksRef.current = [];
        isRecordingRef.current = false;
        if (typeof onRecordingCompleteRef.current === "function") {
          onRecordingCompleteRef.current(blob);
        }
      };

      recorder.start();
      isRecordingRef.current = true;
      isStartingRef.current  = false;
      console.log("[VoiceButton] RECORDING STARTED");
    } catch (err) {
      isStartingRef.current  = false;
      isRecordingRef.current = false;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        console.error("[VoiceButton] Microphone permission denied.", err);
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        console.error("[VoiceButton] Microphone not found / unavailable.", err);
      } else {
        console.error("[VoiceButton] Could not access microphone.", err);
      }
    }
  }, []); // reads only refs + onRecordingCompleteRef — no deps needed

  // Release mic if component unmounts mid-recording.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch (_) {}
      }
      if (streamRef.current) {
        try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch (_) {}
      }
    };
  }, []);

  // ── Click handler ─────────────────────────────────────────────────────────
  // CRITICAL: `state` is NOT in the dependency array.
  // We check isRecordingRef directly — it is always the live value.
  // Closing over `state` would create a stale closure that misses the 2nd tap.
  const handleClick = useCallback(() => {
    console.log("[VoiceButton] CLICK");
    if (disabled) return;

    const alreadyRecording =
      isRecordingRef.current ||
      isStartingRef.current ||
      (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording");

    if (alreadyRecording) {
      console.log("[VoiceButton] CLICK WHILE RECORDING");
      stopRecording();
      // Parent learns the session ended via onRecordingComplete — no onClick() here.
    } else {
      startRecording();
      // Tell the parent to transition its UI to "listening".
      if (typeof onClickRef.current === "function") {
        onClickRef.current();
      }
    }
  }, [disabled, startRecording, stopRecording]); // NO `state` — intentional

  // ── Render (visual design unchanged) ─────────────────────────────────────
  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {state === "listening" && (
        <>
          {/* pointerEvents:none – these are decorative; clicks must reach the <button> below */}
          <span style={{ position: "absolute", inset: 10, borderRadius: "50%", background: theme.primary, animation: "pulseRing 1.6s ease-out infinite", pointerEvents: "none" }} />
          <span style={{ position: "absolute", inset: 10, borderRadius: "50%", background: theme.primary, animation: "pulseRing 1.6s ease-out infinite 0.5s", pointerEvents: "none" }} />
        </>
      )}
      {state === "thinking" && (
        <span style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `6px solid ${theme.lightBlue}`, borderTopColor: theme.primary, animation: "spinSoft 1.1s linear infinite", pointerEvents: "none" }} />
      )}
      {state === "speaking" && (
        <span style={{ position: "absolute", inset: 10, borderRadius: "50%", background: theme.primary, animation: "pulseRingSlow 1.3s ease-out infinite", pointerEvents: "none" }} />
      )}
      <button
        onClick={handleClick}
        disabled={disabled}
        aria-label={label}
        style={{
          width: btnSize, height: btnSize, borderRadius: "50%", border: "none",
          background: theme.primary,
          boxShadow: "0 10px 26px rgba(37,99,235,0.28), 0 0 0 10px rgba(37,99,235,0.10)",
          display: "flex", alignItems: "center", justifyContent: "center", color: theme.white,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {state === "thinking" ? (
          <span style={{ fontSize: 46, lineHeight: 1 }}>◌</span>
        ) : state === "speaking" ? (
          <span style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 42 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                style={{
                  width: 7, background: theme.white, borderRadius: 4,
                  animation: "wave 0.9s ease-in-out infinite",
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </span>
        ) : (
          <Mic size={64} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
