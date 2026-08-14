import React from "react";
import { ChevronRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function SettingsRow({ icon: Icon, label, onClick, value }) {
  const { theme } = useTheme();
  return (
    <button onClick={onClick} style={{
      width: "100%", background: theme.card, border: "none", borderRadius: 20,
      padding: "18px 20px", display: "flex", alignItems: "center", gap: 16,
      marginBottom: 12, boxShadow: "0 1px 4px rgba(23,32,51,0.06)",
    }}>
      <span style={{
        width: 44, height: 44, borderRadius: 14, background: theme.lightBlue,
        color: theme.primaryDark, display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={22} strokeWidth={2} />
      </span>
      <span style={{ fontSize: 20, fontWeight: 700, color: theme.text, flex: 1, textAlign: "left" }}>
        {label}
      </span>
      {value && <span style={{ fontSize: 17, color: theme.textSoft }}>{value}</span>}
      <ChevronRight size={20} color={theme.textSoft} />
    </button>
  );
}
