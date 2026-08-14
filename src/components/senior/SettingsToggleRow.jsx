import React from "react";
import { useTheme } from "../../context/ThemeContext";
import ToggleSwitch from "./ToggleSwitch";

export default function SettingsToggleRow({ icon: Icon, label, checked, onChange }) {
  const { theme } = useTheme();
  return (
    <div style={{
      width: "100%", background: theme.card, borderRadius: 20, padding: "18px 20px",
      display: "flex", alignItems: "center", gap: 16, marginBottom: 12,
      boxShadow: `0 1px 4px ${theme.shadowSoft}`,
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
      <ToggleSwitch checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  );
}
