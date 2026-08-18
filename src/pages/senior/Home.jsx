import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, Pill } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import ScreenShell from "../../components/senior/ScreenShell";
import SeniorHeader from "../../components/senior/SeniorHeader";
import VoiceButton from "../../components/senior/VoiceButton";
import VoiceState from "../../components/senior/VoiceState";
import ReminderCard from "../../components/senior/ReminderCard";
import { nextReminder } from "../../data/seniorMockData";

const STATE_LABELS = {
  idle: "Talk to Bhavi", listening: "Listening...",
  thinking: "Thinking...", speaking: "Bhavi is speaking",
};

export default function Home({ name, inConversation, onEnterConversation, onExitConversation }) {
  const { theme } = useTheme();
  const [state, setState] = useState("idle");
  const timers = useRef([]);

  // Session memory ref — persists across turns during an active conversation session,
  // reset to null when exiting conversation mode.
  const conversationIdRef = useRef(null);

  // Audio playback refs — never cause re-renders.
  const audioRef    = useRef(null);   // current HTMLAudioElement
  const audioBlobRef = useRef(null);  // current object URL (for revoke on cleanup)

  // Helper to generate a unique session ID client-side
  const getOrCreateSessionId = () => {
    if (!conversationIdRef.current) {
      conversationIdRef.current = `session-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
      console.log("[Memory] Created new frontend conversation ID:", conversationIdRef.current);
    }
    return conversationIdRef.current;
  };

  // Cleanup: cancel timers + stop any playing audio on unmount.
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      _stopAudio();
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio helpers ─────────────────────────────────────────────────────────

  const _stopAudio = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.onended  = null;
        audioRef.current.onerror  = null;
      } catch (_) {}
      audioRef.current = null;
    }
    if (audioBlobRef.current) {
      try { URL.revokeObjectURL(audioBlobRef.current); } catch (_) {}
      audioBlobRef.current = null;
    }
  };

  /**
   * Decode the base64 WAV returned by the API and play it.
   * Transitions: thinking → speaking (on play start), speaking → idle (on end).
   */
  const _playAudio = (audio_b64, audio_format) => {
    _stopAudio();

    const dataUrl = `data:audio/${audio_format};base64,${audio_b64}`;
    const audio = new Audio(dataUrl);
    audioRef.current = audio;

    audio.onended = () => {
      console.log("[TTS] Audio playback finished");
      _stopAudio();
      setState("idle");
      // Keep in conversation mode for subsequent voice turns within the same session
    };

    audio.onerror = (err) => {
      console.error("[TTS] Audio playback error:", err);
      _stopAudio();
      timers.current.push(setTimeout(() => {
        setState("idle");
      }, 800));
    };

    audio.play()
      .then(() => {
        console.log("[TTS] Audio playback started");
        setState("speaking");
      })
      .catch((err) => {
        console.warn(
          "[TTS] Autoplay blocked or playback failed — falling back to timer.",
          err
        );
        _stopAudio();
        setState("speaking");
        timers.current.push(setTimeout(() => {
          setState("idle");
        }, 3500));
      });
  };

  // ── Called by VoiceButton on first tap (idle → listening) ─────────────────
  const startConversation = () => {
    if (inConversation) return;
    getOrCreateSessionId();
    onEnterConversation();
    setState("listening");
  };

  // ── Called by VoiceButton when recording stops ────────────────────────────
  const handleRecordingComplete = async (audioBlob) => {
    console.log("[Home] Recording complete – blob ready:", audioBlob);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setState("thinking");

    const sessionId = getOrCreateSessionId();

    console.log(`[AudioUpload] Sending audio (conversation_id: ${sessionId})`);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("conversation_id", sessionId);

      const response = await fetch("http://127.0.0.1:8000/api/audio/", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("[AudioUpload] Upload successful");
      console.log("[AudioUpload] Server response:", data);

      if (data.conversation_id) {
        conversationIdRef.current = data.conversation_id;
      }
      if (data.text !== undefined) {
        console.log("[STT] Transcript:", data.text);
      }
      if (data.response !== undefined) {
        console.log("[Bhavi] Response:", data.response);
      }

      // ── Play Bhavi's audio if returned ────────────────────────────────────
      if (data.audio_b64 && data.audio_format) {
        console.log(
          `[TTS] Received audio (${Math.round(data.audio_b64.length * 0.75 / 1024)} KB WAV)`
        );
        _playAudio(data.audio_b64, data.audio_format);
      } else {
        console.warn("[TTS] No audio in response — using fallback timer");
        timers.current.push(setTimeout(() => setState("speaking"), 1400));
        timers.current.push(setTimeout(() => {
          setState("idle");
        }, 4200));
      }

    } catch (err) {
      console.error("[AudioUpload] Upload failed:", err);
      timers.current.push(setTimeout(() => {
        setState("idle");
      }, 1500));
    }
  };

  const handleBack = () => {
    console.log("[Home] Resetting conversation memory session ID on exit");
    conversationIdRef.current = null;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    _stopAudio();
    setState("idle");
    onExitConversation();
  };

  return (
    <ScreenShell bottomPad={!inConversation}>
      {inConversation ? (
        <div style={{ padding: "22px 20px 6px" }}>
          <button onClick={handleBack} aria-label="Back to Home" style={{
            width: 48, height: 48, borderRadius: 16, border: "none",
            background: theme.card, boxShadow: "0 1px 3px rgba(23,32,51,0.08)",
            color: theme.text, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ArrowLeft size={22} strokeWidth={2.25} />
          </button>
        </div>
      ) : (
        <SeniorHeader name={name} />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <VoiceButton
          state={state}
          onClick={startConversation}
          onRecordingComplete={handleRecordingComplete}
          disabled={state === "thinking" || state === "speaking"}
        />
        <p style={{ fontSize: 22, fontWeight: 700, color: theme.primaryDark, marginTop: 20 }}>
          {STATE_LABELS[state]}
        </p>
        <VoiceState state={state} visible={inConversation} />
      </div>

      {!inConversation && (
        <div style={{ padding: "0 20px" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: theme.textSoft, letterSpacing: 0.4, margin: "0 0 8px 4px" }}>
            NEXT REMINDER
          </p>
          <ReminderCard icon={Pill} title={nextReminder.title} time={nextReminder.time} compact />
        </div>
      )}
    </ScreenShell>
  );
}
