import React from "react";
import { Clock, ChevronRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function ReminderCard({ icon: Icon, title, time, taken, compact = false, onClick }) {
  const { theme } = useTheme();

  if (compact) {
    return (
      <button onClick={onClick} style={{
        width: "100%", background: theme.card, border: "none", borderRadius: 18,
        padding: "13px 16px", display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 1px 4px rgba(23,32,51,0.06)",
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13,
          background: "linear-gradient(135deg, #FFE4E0, #FFD3CC)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#DC2626", flexShrink: 0,
        }}>
          {Icon && <Icon size={19} strokeWidth={2.25} />}
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: theme.text, margin: 0 }}>{title}</p>
          <p style={{ fontSize: 15, color: theme.textSoft, margin: "3px 0 0", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={14} /> {time}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: theme.warning, fontWeight: 700 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: theme.warning, display: "inline-block" }} />
              Upcoming
            </span>
          </p>
        </div>
        <ChevronRight size={20} color={theme.textSoft} />
      </button>
    );
  }

  return (
    <div style={{
      background: theme.card, borderRadius: 22, padding: "20px 22px",
      display: "flex", alignItems: "center", gap: 16,
      boxShadow: "0 1px 4px rgba(23,32,51,0.06)", marginBottom: 14,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, background: theme.lightBlue,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: theme.primaryDark, flexShrink: 0,
      }}>
        {Icon && <Icon size={26} strokeWidth={2} />}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: 0 }}>{title}</p>
        <p style={{ fontSize: 18, color: theme.textSoft, margin: "4px 0 0" }}>{time}</p>
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
        borderRadius: 999, background: taken ? theme.successBg : theme.warningBg,
        color: taken ? theme.success : "#B45309", fontSize: 15, fontWeight: 700, flexShrink: 0,
      }}>
        {taken ? "Taken" : "Upcoming"}
      </div>
    </div>
  );
}
