import React from "react";
import { Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function SeniorHeader({ name }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 22px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 54, height: 54, borderRadius: "50%", background: theme.lightBlue,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, flexShrink: 0, border: "2px solid #FFFFFF",
          boxShadow: "0 1px 4px rgba(23,32,51,0.10)",
        }}>
          👴🏻
        </div>
        <div>
          <p style={{ fontSize: 24, fontWeight: 700, color: theme.text, margin: 0, lineHeight: 1.25 }}>
            Good Morning,<br />{name || "Raman"}
          </p>
        </div>
      </div>
      <div style={{
        width: 44, height: 44, borderRadius: "50%", background: theme.card,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 4px rgba(23,32,51,0.10)", flexShrink: 0,
      }}>
        <Sun size={22} color={theme.warning} strokeWidth={2.25} />
      </div>
    </div>
  );
}
