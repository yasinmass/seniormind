import React from "react";
import { useTheme } from "../../context/ThemeContext";
import { voiceTranscripts } from "../../data/seniorMockData";

export default function VoiceState({ state = "idle", visible = true }) {
  const { theme } = useTheme();
  if (!visible) return null;
  return (
    <div className="fade-in" style={{
      marginTop: 22, width: "100%", maxWidth: 320, background: theme.card,
      borderRadius: 18, padding: "16px 18px", boxShadow: "0 1px 4px rgba(23,32,51,0.06)",
    }}>
      <p style={{ fontSize: 18, color: theme.textSoft, margin: 0, lineHeight: 1.5, textAlign: "center" }}>
        {voiceTranscripts[state]}
      </p>
    </div>
  );
}
