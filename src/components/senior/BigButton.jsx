import React from "react";
import { useTheme } from "../../context/ThemeContext";

export default function BigButton({ children, onClick, tone = "primary", style = {} }) {
  const { theme } = useTheme();
  const tones = {
    primary: { bg: theme.primary,   fg: theme.white       },
    light:   { bg: theme.lightBlue, fg: theme.primaryDark },
    danger:  { bg: theme.danger,    fg: theme.white       },
    white:   { bg: theme.card,      fg: theme.text        },
  };
  const t = tones[tone];
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", background: t.bg, color: t.fg,
        border: tone === "white" ? `1px solid ${theme.border}` : "none",
        borderRadius: 20, padding: "20px 22px", fontSize: 21, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        boxShadow: tone === "primary"
          ? "0 6px 16px rgba(37,99,235,0.28)"
          : "0 1px 3px rgba(23,32,51,0.06)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
