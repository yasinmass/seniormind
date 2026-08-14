import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import ScreenShell from "../../components/senior/ScreenShell";
import TopBar from "../../components/senior/TopBar";
import BhaviAvatar from "../../components/senior/BhaviAvatar";

const STATE_COPY = {
  idle:      { icon: "🎤", label: "Tap to talk"      },
  listening: { icon: "🎤", label: "Listening..."     },
  thinking:  { icon: "◌",  label: "Thinking..."      },
  speaking:  { icon: "🔊", label: "Bhavi is speaking" },
};

const TRANSCRIPTS = {
  idle:      "Tap the microphone whenever you'd like to talk.",
  listening: "\u201cGood morning Bhavi, how are you?\u201d",
  thinking:  "Bhavi is thinking about what you said...",
  speaking:  "\u201cGood morning! I'm doing well, thank you for asking.\u201d",
};

export default function Bhavi({ onBack }) {
  const { theme } = useTheme();
  const [state, setState] = useState("idle");
  const [showTranscript, setShowTranscript] = useState(false);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const startConversation = () => {
    if (state !== "idle") return;
    setState("listening");
    timers.current.push(setTimeout(() => setState("thinking"), 2200));
    timers.current.push(setTimeout(() => setState("speaking"), 3600));
    timers.current.push(setTimeout(() => setState("idle"),     6400));
  };

  const cur = STATE_COPY[state];

  return (
    <ScreenShell>
      <TopBar title="Bhavi" onBack={onBack} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, padding: "10px 24px" }}>
        <BhaviAvatar state={state} />

        <div style={{ position: "relative", width: 176, height: 176, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {state === "listening" && (
            <>
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: theme.primary, animation: "pulseRing 1.6s ease-out infinite" }} />
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: theme.primary, animation: "pulseRing 1.6s ease-out infinite 0.5s" }} />
            </>
          )}
          {state === "thinking" && (
            <span style={{ position: "absolute", width: 176, height: 176, borderRadius: "50%", border: `6px solid ${theme.lightBlue}`, borderTopColor: theme.primary, animation: "spinSoft 1.1s linear infinite" }} />
          )}
          {state === "speaking" && (
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: theme.primary, animation: "pulseRingSlow 1.3s ease-out infinite" }} />
          )}
          <button onClick={startConversation} disabled={state !== "idle"} aria-label={cur.label} style={{
            width: 152, height: 152, borderRadius: "50%", border: "none",
            background: state === "idle" ? theme.primary : theme.primaryDark,
            color: theme.white, fontSize: 56, boxShadow: "0 10px 24px rgba(37,99,235,0.32)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {state === "speaking" ? (
              <span style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 40 }}>
                {[0,1,2,3,4].map((i) => (
                  <span key={i} style={{ width: 6, background: theme.white, borderRadius: 3, animation: "wave 0.9s ease-in-out infinite", animationDelay: `${i * 0.12}s` }} />
                ))}
              </span>
            ) : cur.icon}
          </button>
        </div>

        <p style={{ fontSize: 24, fontWeight: 700, color: theme.text, marginTop: 30 }}>{cur.label}</p>

        <button onClick={() => setShowTranscript((s) => !s)} style={{
          marginTop: 18, background: "transparent", border: "none",
          color: theme.primary, fontSize: 17, fontWeight: 700, textDecoration: "underline",
        }}>
          {showTranscript ? "Hide text" : "Show text"}
        </button>

        {showTranscript && (
          <div className="fade-in" style={{
            marginTop: 16, width: "100%", maxWidth: 340, background: theme.card,
            borderRadius: 18, padding: "16px 18px", boxShadow: "0 1px 4px rgba(23,32,51,0.06)",
          }}>
            <p style={{ fontSize: 18, color: theme.textSoft, margin: 0, lineHeight: 1.5 }}>
              {TRANSCRIPTS[state]}
            </p>
          </div>
        )}
      </div>
    </ScreenShell>
  );
}
