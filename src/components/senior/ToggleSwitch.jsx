import React from "react";
import { useTheme } from "../../context/ThemeContext";

export default function ToggleSwitch({ checked, onChange, ariaLabel }) {
  const { theme } = useTheme();
  return (
    <button
      role="switch" aria-checked={checked} aria-label={ariaLabel} onClick={onChange}
      style={{
        width: 56, height: 32, borderRadius: 999, border: "none",
        background: checked ? theme.primary : theme.border,
        position: "relative", flexShrink: 0, transition: "background 0.2s ease", padding: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 27 : 3,
        width: 26, height: 26, borderRadius: "50%", background: theme.white,
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.2s ease",
      }} />
    </button>
  );
}
