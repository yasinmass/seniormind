import React from "react";
import { Mic } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function VoiceButton({ state = "idle", onClick, disabled = false, size = 184, btnSize = 164 }) {
  const { theme } = useTheme();
  const label = { idle: "Talk to Bhavi", listening: "Listening...", thinking: "Thinking...", speaking: "Bhavi is speaking" }[state];
  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {state === "listening" && (
        <>
          <span style={{ position: "absolute", inset: 10, borderRadius: "50%", background: theme.primary, animation: "pulseRing 1.6s ease-out infinite" }} />
          <span style={{ position: "absolute", inset: 10, borderRadius: "50%", background: theme.primary, animation: "pulseRing 1.6s ease-out infinite 0.5s" }} />
        </>
      )}
      {state === "thinking" && (
        <span style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `6px solid ${theme.lightBlue}`, borderTopColor: theme.primary, animation: "spinSoft 1.1s linear infinite" }} />
      )}
      {state === "speaking" && (
        <span style={{ position: "absolute", inset: 10, borderRadius: "50%", background: theme.primary, animation: "pulseRingSlow 1.3s ease-out infinite" }} />
      )}
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        style={{
          width: btnSize, height: btnSize, borderRadius: "50%", border: "none",
          background: theme.primary,
          boxShadow: "0 10px 26px rgba(37,99,235,0.28), 0 0 0 10px rgba(37,99,235,0.10)",
          display: "flex", alignItems: "center", justifyContent: "center", color: theme.white,
        }}
      >
        {state === "thinking" ? (
          <span style={{ fontSize: 46, lineHeight: 1 }}>◌</span>
        ) : state === "speaking" ? (
          <span style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 42 }}>
            {[0,1,2,3,4].map((i) => (
              <span key={i} style={{ width: 7, background: theme.white, borderRadius: 4, animation: "wave 0.9s ease-in-out infinite", animationDelay: `${i * 0.12}s` }} />
            ))}
          </span>
        ) : (
          <Mic size={64} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
