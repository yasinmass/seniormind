import React from "react";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function TopBar({ title, onBack }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "22px 20px 14px" }}>
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{
            width: 48, height: 48, borderRadius: 16, border: "none",
            background: theme.card, boxShadow: "0 1px 3px rgba(23,32,51,0.08)",
            color: theme.text, flexShrink: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <ArrowLeft size={22} strokeWidth={2.25} />
        </button>
      )}
      <h1 style={{ fontSize: 28, fontWeight: 700, color: theme.text, margin: 0 }}>{title}</h1>
    </div>
  );
}
